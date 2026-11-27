import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { loadTs } from "./digital-guard-test-loader.mjs";

const { openGanCameraPilotSyntheticEdge } = loadTs("lib/domain/digital-observer/gan-camera-pilot-synthetic-edge.ts");
const scope = { viewerId: "qa-viewer", role: "parent", gardenId: "qa-garden", siteId: "qa-site", cameraId: "qa-camera",
  protocol: "WebRTC", tenantId: "qa-tenant", sessionId: "qa-session", sourceId: "synthetic", gatewayId: "loopback", streamId: "canvas" };
const handle = "h".repeat(43);

// CDP communicates over inherited pipes. Chrome exposes no debugging port.
async function chrome(onCleanup, directory, executable) {
  const child = spawn(executable, [
    "--headless", "--browser-test", "--remote-debugging-pipe", "--disable-background-networking", "--disable-extensions",
    "--disable-component-update", "--no-first-run", "--no-default-browser-check", "--no-proxy-server",
    "--host-resolver-rules=MAP * ~NOTFOUND", "--allow-loopback-in-peer-connection",
    "--disable-features=WebRtcHideLocalIpsWithMdns", `--user-data-dir=${join(directory, "profile")}`,
    `--disk-cache-dir=${join(directory, "cache")}`, "about:blank"
  ], { stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"], env: { ...process.env, TMPDIR: directory } });
  const pending = new Map();
  let lastId = 0;
  let buffered = "";
  let diagnostics = "";
  child.stderr.setEncoding("utf8").on("data", (data) => { diagnostics = (diagnostics + data).slice(-1500); });
  child.stdio[4].setEncoding("utf8").on("data", (data) => {
    const messages = (buffered + data).split("\0");
    buffered = messages.pop();
    for (const line of messages) {
      const message = JSON.parse(line);
      const request = pending.get(message.id);
      if (!request) continue;
      pending.delete(message.id);
      clearTimeout(request.timer);
      if (message.error) request.reject(Error(message.error.message));
      else request.resolve(message.result);
    }
  });
  const closed = new Promise((resolveClosed) => child.once("close", resolveClosed));
  const failPending = (error) => {
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(error);
    }
    pending.clear();
  };
  child.once("error", failPending);
  child.stdio[3].on("error", failPending);
  closed.then(() => failPending(Error(`Chrome closed: ${diagnostics}`)));
  onCleanup(async () => { child.kill(); await closed; });
  await once(child, "spawn");
  function send(method, params = {}, sessionId) {
    return new Promise((resolveResult, reject) => {
      const id = ++lastId;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(Error(`Chrome command timed out: ${method}`));
      }, 10_000);
      pending.set(id, { resolve: resolveResult, reject, timer });
      child.stdio[3].write(JSON.stringify({ id, method, params, sessionId }) + "\0");
    });
  }
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  return async (fn, args) => {
    const { result, exceptionDetails } = await send("Runtime.evaluate", {
      expression: `(${fn})(${JSON.stringify(args) ?? ""})`, returnByValue: true, awaitPromise: true
    }, sessionId);
    if (exceptionDetails) throw Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    return result.value;
  };
}

const executable = process.env.GAN_PILOT_QA_CHROME;
test("loopback WebRTC decodes synthetic frames and delivers none after revocation", { skip: !executable, timeout: 35_000 }, async (t) => {
  const localAddresses = Object.values(networkInterfaces()).flat().filter((entry) => entry && !entry.scopeid)
    .filter(({ address, family }) => {
      try {
        const route = execFileSync("/sbin/route", ["-n", "get", ...(family === "IPv6" ? ["-inet6"] : []), address],
          { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
        return /^\s*interface:\s+lo0\s*$/m.test(route);
      } catch { return false; }
    }).map(({ address }) => address);
  assert.ok(localAddresses.length > 0, "no self-address routed over lo0");
  const directory = mkdtempSync(resolve(".gan-pilot-browser-"));
  let closeBrowser;
  t.after(async () => {
    try { await closeBrowser?.(); }
    finally { rmSync(directory, { recursive: true, force: true }); }
  });
  const edge = openGanCameraPilotSyntheticEdge({ databasePath: join(directory, "window.db"),
    windowId: "w".repeat(32), scope, now: () => 10_000, deadlineMs: 310_000 });
  t.after(() => edge.close());
  assert.equal(await edge.store.issue({ handle, scope, expiresAtMs: 50_000 }, "j".repeat(32)), true);
  assert.ok(await edge.store.consume(handle, scope, 50_000));
  const evaluate = await chrome((cleanup) => { closeBrowser = cleanup; }, directory, executable);
  const peer = await evaluate(async (allowed) => {
    const canvas = Object.assign(document.createElement("canvas"), { width: 32, height: 32 });
    const ctx = canvas.getContext("2d");
    const track = canvas.captureStream(0).getVideoTracks()[0];
    const video = Object.assign(document.createElement("video"), { autoplay: true, muted: true });
    document.body.append(video);
    const snapshot = Object.assign(document.createElement("canvas"), { width: 32, height: 32 }).getContext("2d");
    const sender = new RTCPeerConnection({ iceServers: [] });
    const receiver = new RTCPeerConnection({ iceServers: [] });
    sender.addTrack(track);
    receiver.ontrack = (event) => { video.srcObject = new MediaStream([event.track]); };
    const pending = [];
    const gathered = { loopback: 0, other: 0, mdns: 0, ipv6: 0, absent: 0, allowed: 0, host: 0 };
    const forward = (target) => ({ candidate }) => {
      const address = candidate?.address || candidate?.candidate.split(" ")[4];
      const type = candidate?.type || candidate?.candidate.split(" ")[7];
      if (type === "host" && allowed.includes(address)) {
        gathered.loopback++;
        pending.push([target, candidate]);
      } else if (candidate) {
        gathered.other++;
        if (address?.endsWith(".local")) gathered.mdns++;
        if (address?.includes(":")) gathered.ipv6++;
        if (!address) gathered.absent++;
        if (allowed.includes(address)) gathered.allowed++;
        if (type === "host") gathered.host++;
      }
    };
    sender.onicecandidate = forward(receiver);
    receiver.onicecandidate = forward(sender);
    const offer = await sender.createOffer();
    await sender.setLocalDescription(offer);
    await receiver.setRemoteDescription(offer);
    const answer = await receiver.createAnswer();
    await receiver.setLocalDescription(answer);
    await sender.setRemoteDescription(answer);
    const deadline = performance.now() + 6_000;
    while (receiver.connectionState !== "connected" && performance.now() < deadline) {
      while (pending.length) {
        const [target, candidate] = pending.shift();
        await target.addIceCandidate(candidate);
      }
      await new Promise((resolveTimer) => setTimeout(resolveTimer, 10));
    }
    if (receiver.connectionState !== "connected") throw Error(`No loopback-only ICE pair: ${JSON.stringify(gathered)}`);
    let frames = 0;
    const observe = () => video.requestVideoFrameCallback(() => { frames++; observe(); });
    observe();
    globalThis.syntheticPilot = {
      emit(color) {
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 32, 32);
        track.requestFrame();
      },
      sample() {
        if (!frames) return { frames };
        snapshot.drawImage(video, 0, 0);
        return { frames, pixel: [...snapshot.getImageData(16, 16, 1, 1).data] };
      }
    };
    const stats = [...(await receiver.getStats()).values()];
    const selected = stats.find((item) => item.type === "transport")?.selectedCandidatePairId;
    const pair = stats.find((item) => item.id === selected);
    return [pair?.localCandidateId, pair?.remoteCandidateId].map((id) => stats.find((item) => item.id === id)?.address);
  }, localAddresses);
  assert.ok(peer.every((address) => localAddresses.includes(address)));

  async function send(sequence, color) {
    let permittedColor;
    const accepted = edge.deliverSyntheticChunk({ handle, scope, sequence, payload: Buffer.from(color),
      write: (payload) => { permittedColor = payload.toString(); return true; } });
    if (accepted) await evaluate((value) => globalThis.syntheticPilot.emit(value), permittedColor);
    return accepted;
  }
  const sample = () => evaluate(() => globalThis.syntheticPilot.sample());
  async function observe(channel) {
    for (let attempt = 0; attempt < 100; attempt++) {
      const result = await sample();
      if (result.pixel?.[channel] > 180) return result;
      await new Promise((resolveTimer) => setTimeout(resolveTimer, 20));
    }
    assert.fail("Expected color was not decoded by the WebRTC receiver");
  }
  assert.equal(await send(1, "#ff0000"), true);
  const red = await observe(0);
  assert.equal(await send(2, "#0000ff"), true);
  const blue = await observe(2);
  assert.ok(blue.frames > red.frames);
  await edge.store.revoke(handle);
  assert.equal(await send(3, "#00ff00"), false);
  await new Promise((resolveTimer) => setTimeout(resolveTimer, 300));
  const stopped = await sample();
  assert.equal(stopped.frames, blue.frames);
  assert.ok(stopped.pixel[2] > 180);
});
