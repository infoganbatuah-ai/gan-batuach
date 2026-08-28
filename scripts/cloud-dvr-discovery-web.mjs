import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import http from "node:http";

const gatewayPort = Number(process.env.LOCAL_DVR_GATEWAY_PORT || 18080);
const webPort = Number(process.env.LOCAL_DVR_ONBOARDING_PORT || 18180);
const gatewayUrl = `http://127.0.0.1:${gatewayPort}`;
const productionBaseUrl = process.env.VIDEO_GATEWAY_CLOUD_BASE_URL || "https://gan-batuach.vercel.app";
const runtimeConfigPath = process.env.GAN_BATUACH_GATEWAY_CONFIG || `${process.env.HOME}/.config/gan-batuach/home-gateway.json`;
const pairingClaimTtlMs = 14 * 60 * 1000;
let running = false;
let lastResult = null;
let gatewayProcess = null;
let learningTimer = null;
const pendingClaims = new Map();

const gatewaySecret = process.env.VIDEO_GATEWAY_SIGNING_SECRET || readRuntimeKeychainSecret("gateway_signing_secret") || crypto.randomBytes(48).toString("base64url");

function readRuntimeKeychainSecret(account) {
  const service = process.env.GAN_BATUACH_GATEWAY_KEYCHAIN_SERVICE || "com.ganbatuach.video-gateway.runtime";
  const result = spawnSync("/usr/bin/security", ["find-generic-password", "-s", service, "-a", account, "-w"], { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "";
}

function purgeExpiredClaims() {
  const now = Date.now();
  for (const [id, claim] of pendingClaims.entries()) {
    if (!claim || claim.expiresAtMs <= now) pendingClaims.delete(id);
  }
}

function readDvrProfileConfig() {
  if (!existsSync(runtimeConfigPath)) return { configured: false, reason: "missing_local_profile" };
  try {
    const config = JSON.parse(readFileSync(runtimeConfigPath, "utf8"));
    const required = ["endpoint", "port", "username", "vendor", "channel_count", "keychain_service"];
    const missing = required.filter((key) => !config?.[key]);
    if (missing.length) return { configured: false, reason: "incomplete_local_profile" };
    return { configured: true, config };
  } catch {
    return { configured: false, reason: "invalid_local_profile" };
  }
}

function hasDvrPasswordInKeychain(config) {
  if (!config?.keychain_service || !config?.username) return false;
  const result = spawnSync("/usr/bin/security", ["find-generic-password", "-s", String(config.keychain_service), "-a", String(config.username)], { encoding: "utf8" });
  return result.status === 0;
}

function dvrProfileStatus() {
  const profile = readDvrProfileConfig();
  if (!profile.configured) return { configured: false, reason: profile.reason, password_storage: "keychain" };
  if (!hasDvrPasswordInKeychain(profile.config)) return { configured: false, reason: "missing_keychain_password", password_storage: "keychain" };
  return { configured: true, status: "ready", profile_storage: "secure_local_config", password_storage: "keychain", values_returned: false };
}

function loadExistingDvrProfileForConnect() {
  const profile = readDvrProfileConfig();
  if (!profile.configured) throw new Error("פרופיל DVR מקומי לא נמצא. נדרשת הזנה חד־פעמית במסך המקומי.");
  const config = profile.config;
  const passwordResult = spawnSync("/usr/bin/security", ["find-generic-password", "-s", String(config.keychain_service), "-a", String(config.username), "-w"], { encoding: "utf8" });
  if (passwordResult.status !== 0 || !passwordResult.stdout.trim()) throw new Error("סיסמת DVR אינה זמינה ב-Keychain המקומי. נדרשת הזנה חד־פעמית במסך המקומי.");
  return {
    endpoint: String(config.endpoint || ""),
    port: Number(config.port || 554),
    username: String(config.username || ""),
    password: passwordResult.stdout.trim(),
    vendor: String(config.vendor || "generic"),
    channelCount: Number(config.channel_count || 16)
  };
}

function page() {
  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>חיבור DVR מקומי</title>
  <style>
    :root { color-scheme: light; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f6f7f9; color: #172033; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; }
    main { width: min(720px, 100%); background: white; border: 1px solid #d9dee8; border-radius: 8px; padding: 24px; box-shadow: 0 18px 60px rgba(20, 30, 50, .10); }
    h1 { margin: 0 0 8px; font-size: 28px; }
    p { color: #536070; line-height: 1.55; }
    form { display: grid; gap: 16px; margin-top: 22px; }
    label { display: grid; gap: 7px; font-weight: 700; }
    input, select { border: 1px solid #cbd3df; border-radius: 6px; padding: 12px; font: inherit; direction: ltr; text-align: left; }
    .grid { display: grid; gap: 14px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .full { grid-column: 1 / -1; }
    .notice { border-radius: 6px; padding: 12px 14px; background: #eef6ff; color: #16395f; border: 1px solid #c8def7; }
    .warn { background: #fff8e7; border-color: #ecd69d; color: #5f4716; }
    button { border: 0; border-radius: 6px; padding: 13px 18px; font: inherit; font-weight: 800; cursor: pointer; }
    button.primary { background: #123a66; color: white; }
    button:disabled { opacity: .55; cursor: wait; }
    #status { min-height: 26px; font-weight: 700; }
    @media (max-width: 640px) { .grid { grid-template-columns: 1fr; } main { padding: 18px; } }
  </style>
</head>
<body>
  <main>
    <h1>חיבור מצלמות הבית ל-DVR</h1>
    <p>הפרטים נשארים בתהליך המקומי על המקבוק ומשמשים רק לבדיקת discovery בקריאה בלבד. לא מתבצעת שליטה במצלמות, PTZ, סירנה, אור או שינוי הגדרות.</p>
    <div class="notice">קודם מאשרים Pairing מול הדשבורד. לחיצה על CONNECT בשלב הבא היא האישור הסופי להתחיל בדיקה לקריאה בלבד. עד הלחיצה לא נשלחת בקשה ל-DVR.</div>
    <form id="pairing-form" autocomplete="off" novalidate>
      <label>קוד pairing מהדשבורד
        <input id="pairing-code" name="pairingCode" required type="password" autocomplete="one-time-code" autocapitalize="none" spellcheck="false" />
      </label>
      <div class="notice warn">הדביקו כאן את הקוד החד־פעמי. פרטי DVR אינם מוצגים או נשלחים לפני שלב זה.</div>
      <button id="pairing-submit" class="primary" type="submit">אישור pairing והמשך</button>
      <div id="pairing-status" role="status"></div>
    </form>
    <section id="existing-profile" hidden>
      <div class="notice">המקליט הקיים מוכן. פרטי ה-DVR נשארים במקבוק: פרופיל מקומי מאובטח וסיסמה ב-Keychain. הדשבורד לא מקבל סיסמה או כתובת stream.</div>
      <form id="existing-profile-form" autocomplete="off">
        <button id="existing-connect" class="primary" type="submit">CONNECT / DISCOVER מהמקליט הקיים</button>
        <button id="manual-entry" type="button">הזנה חד־פעמית מחדש</button>
      </form>
    </section>
    <form id="dvr-form" autocomplete="off" hidden>
      <div class="grid">
        <label class="full">כתובת DVR
          <input name="endpoint" required autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="לדוגמה: כתובת מקומית או שם מארח" />
        </label>
        <label>פורט RTSP
          <input name="port" inputmode="numeric" value="554" />
        </label>
        <label>יצרן / סוג
          <select name="vendor">
            <option value="generic">Generic</option>
            <option value="hikvision">Hikvision</option>
            <option value="dahua">Dahua</option>
            <option value="uniview">Uniview</option>
            <option value="private_nvr">Private NVR (ER)</option>
          </select>
        </label>
        <label>שם משתמש
          <input name="username" required autocomplete="username" autocapitalize="none" spellcheck="false" />
        </label>
        <label>סיסמה
          <input name="password" required type="password" autocomplete="current-password" />
        </label>
        <label>מספר ערוצים צפוי
          <input name="channelCount" inputmode="numeric" value="16" />
        </label>
      </div>
    <div class="notice warn">קודם יוצרים קוד pairing חד־פעמי בדשבורד המחובר. לא להדביק כאן cookies, קישורי דפדפן או כתובות stream.</div>
      <button id="connect" class="primary" type="submit">CONNECT - התחלת בדיקת קריאה בלבד</button>
      <div id="status" role="status"></div>
    </form>
  </main>
  <script>
    const pairingForm = document.getElementById("pairing-form");
    const pairingButton = document.getElementById("pairing-submit");
    const pairingStatus = document.getElementById("pairing-status");
    const existingProfile = document.getElementById("existing-profile");
    const existingProfileForm = document.getElementById("existing-profile-form");
    const existingConnect = document.getElementById("existing-connect");
    const manualEntry = document.getElementById("manual-entry");
    const form = document.getElementById("dvr-form");
    const button = document.getElementById("connect");
    const status = document.getElementById("status");
    let claimSessionId = "";
    async function connectWithBody(body) {
      const response = await fetch("/connect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "החיבור נכשל");
      status.textContent = "החיבור הושלם. ערוצים שמופו: " + data.channel_count + ", ערוצים מחוברים: " + data.connected_channel_count + ".";
      return data;
    }
    async function showNextStepAfterPairing() {
      try {
        const response = await fetch("/dvr-profile/status", { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (response.ok && data.configured === true) {
          existingProfile.hidden = false;
          form.hidden = true;
          status.textContent = "המקליט הקיים מוכן. לחיצה על CONNECT / DISCOVER תתחיל discovery בקריאה בלבד.";
          return;
        }
        existingProfile.hidden = true;
        form.hidden = false;
        const reason = data.reason === "missing_keychain_password" ? "סיסמת ה-DVR לא נמצאה ב-Keychain." : "לא נמצא פרופיל DVR מקומי מלא.";
        status.textContent = reason + " הזינו פרטי DVR חד־פעמית במסך המקומי בלבד, ואז לחצו CONNECT.";
      } catch {
        existingProfile.hidden = true;
        form.hidden = false;
        status.textContent = "ה-Pairing אומת, אך לא ניתן כרגע לבדוק פרופיל מקומי. אפשר להזין פרטי DVR חד־פעמית במסך זה בלבד.";
      }
    }
    pairingForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const pairingInput = document.getElementById("pairing-code");
      const pairingCode = pairingInput.value.trim();
      if (!pairingCode) {
        pairingStatus.textContent = "יש להדביק קוד pairing לפני ההמשך.";
        return;
      }
      pairingButton.disabled = true;
      pairingStatus.textContent = "מאמת pairing מול הדשבורד המאושר...";
      try {
        const response = await fetch("/pairing/claim", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pairingCode })
        });
        pairingInput.value = "";
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.claim_session_id) throw new Error(data.error || "Pairing נכשל או פג תוקף.");
        claimSessionId = data.claim_session_id;
        pairingStatus.textContent = "Pairing אומת. בודק את מצב המקליט המקומי...";
        pairingForm.hidden = true;
        await showNextStepAfterPairing();
      } catch (error) {
        pairingStatus.textContent = error instanceof Error ? error.message : "Pairing נכשל.";
        pairingButton.disabled = false;
      }
    });
    manualEntry.addEventListener("click", () => {
      existingProfile.hidden = true;
      form.hidden = false;
      status.textContent = "הזינו פרטי DVR חד־פעמית במסך המקומי בלבד. הסיסמה אינה נשלחת לדשבורד.";
    });
    existingProfileForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      existingConnect.disabled = true;
      status.textContent = "מתחיל discovery מהמקליט הקיים בקריאה בלבד...";
      if (!claimSessionId) {
        status.textContent = "יש להשלים Pairing מאומת לפני CONNECT.";
        existingConnect.disabled = false;
        return;
      }
      try {
        await connectWithBody({ claimSessionId, useExistingProfile: true });
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : "החיבור נכשל";
        existingConnect.disabled = false;
      }
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      button.disabled = true;
      status.textContent = "מתחיל בדיקה מקומית לקריאה בלבד...";
      if (!claimSessionId) {
        status.textContent = "יש להשלים Pairing מאומת לפני CONNECT.";
        button.disabled = false;
        return;
      }
      const body = { ...Object.fromEntries(new FormData(form).entries()), claimSessionId };
      try {
        await connectWithBody(body);
        form.reset();
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : "החיבור נכשל";
        button.disabled = false;
      }
    });
  </script>
</body>
</html>`;
}

function send(response, status, body, type = "application/json; charset=utf-8") {
  response.writeHead(status, {
    "content-type": type,
    "cache-control": "private, no-store, max-age=0",
    "x-content-type-options": "nosniff"
  });
  response.end(body);
}

async function readJson(request) {
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 32768) throw new Error("הטופס גדול מדי.");
  }
  return JSON.parse(raw || "{}");
}

function startGateway() {
  if (gatewayProcess && !gatewayProcess.killed) return gatewayProcess;
  gatewayProcess = spawn("node", ["services/video-gateway/server.mjs"], {
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(gatewayPort),
      VIDEO_GATEWAY_SIGNING_SECRET: gatewaySecret,
      DVR_EXPECTED_CHANNEL_COUNT: "16"
    },
    stdio: ["ignore", "ignore", "ignore"]
  });
  return gatewayProcess;
}

async function waitForGateway(timeoutMs = 60000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${gatewayUrl}/health`);
      if (response.ok) return;
    } catch {
      // Continue polling.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("ה-Gateway המקומי לא עלה בזמן.");
}

function sanitizeDiscovery(discovery, inputData) {
  const channels = Array.isArray(discovery.channels) ? discovery.channels : [];
  return {
    gateway_id: inputData.gatewayId,
    observer_site_id: inputData.observerSiteId || undefined,
    garden_id: inputData.gardenId || undefined,
    connection_type: "dvr",
    vendor: inputData.vendor,
    discovery_id: crypto.randomUUID(),
    discovered_at: new Date().toISOString(),
    channel_count: Number(discovery.channel_count || channels.length || inputData.channelCount),
    connected_channel_count: Number(discovery.connected_channel_count || channels.filter((channel) => channel.status === "connected").length),
    failed_channel_count: Number(discovery.failed_channel_count || channels.filter((channel) => channel.status !== "connected").length),
    latency_ms: Number(discovery.latency_ms || 0),
    read_only: true,
    controls_supported: false,
    no_secrets_returned: true,
    channels: channels.map((channel, index) => Object.fromEntries(Object.entries({
      channel: Number(channel.channel || index + 1),
      name: channel.name,
      area: channel.area,
      stream_id: channel.stream_id,
      gateway_stream_id: channel.gateway_stream_id,
      status: channel.status,
      health_status: channel.health_status,
      width: channel.width ?? null,
      height: channel.height ?? null,
      candidates_tried: channel.candidates_tried,
      template: channel.template,
      reason: channel.reason
    }).filter(([, value]) => value !== undefined && value !== null))),
    metadata: {
      source: "local_gateway_cloud_discovery_web",
      ai_shadow_only: true,
      read_only: true
    }
  };
}

function signBody(timestamp, nonce, body, secret) {
  return `sha256=${crypto.createHmac("sha256", secret).update(`${timestamp}.${nonce}.${body}`).digest("hex")}`;
}

async function claimPairing(input) {
  purgeExpiredClaims();
  const [pairingId, pairingCode] = String(input.pairingCode || "").trim().split(".");
  if (!pairingId || !pairingCode) throw new Error("קוד pairing לא תקין או חסר.");

  const gatewayId = crypto.randomUUID();
  const claimResponse = await fetch(`${productionBaseUrl.replace(/\/$/, "")}/api/digital-observer/gateway-pairing`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "claim", pairing_id: pairingId, pairing_code: pairingCode, gateway_id: gatewayId })
  });
  const claim = await claimResponse.json().catch(() => ({}));
  if (!claimResponse.ok || !claim.data?.discovery_token || !claim.data?.observer_site_id) throw new Error(claim.error || "קוד pairing אינו תקף או שפג תוקפו.");

  const sessionId = crypto.randomUUID();
  const expiresAtMs = Math.min(Date.parse(String(claim.data.expires_at || "")) || Date.now() + pairingClaimTtlMs, Date.now() + pairingClaimTtlMs);
  pendingClaims.set(sessionId, {
    gatewayId,
    observerSiteId: String(claim.data.observer_site_id),
    discoveryToken: String(claim.data.discovery_token),
    expiresAtMs
  });
  return { claim_session_id: sessionId, expires_at: new Date(expiresAtMs).toISOString(), status: "paired" };
}

function consumePairingClaim(claimSessionId) {
  purgeExpiredClaims();
  const sessionId = String(claimSessionId || "").trim();
  const claim = pendingClaims.get(sessionId);
  if (!claim) throw new Error("ה-Pairing המקומי חסר או פג תוקף. יש ליצור קוד חדש בדשבורד ולבצע Pairing מחדש.");
  pendingClaims.delete(sessionId);
  if (claim.expiresAtMs <= Date.now()) throw new Error("ה-Pairing המקומי פג תוקף. יש ליצור קוד חדש בדשבורד ולבצע Pairing מחדש.");
  return claim;
}

async function pushLearningSample({ productionBaseUrl, gatewayId, cloudSecret, observerSiteId, channels }) {
  if (!observerSiteId) return { sampled: 0 };
  const samples = (await Promise.all(channels
    .filter((channel) => channel.status === "connected" && channel.gateway_stream_id)
    .map(async (channel) => {
      try {
        const response = await fetch(`${gatewayUrl}/camera/${encodeURIComponent(channel.gateway_stream_id)}/insights`, {
          headers: { "x-video-gateway-secret": gatewaySecret }
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.local_processing !== true || data.no_raw_video_returned !== true) return null;
        return {
          stream_id: channel.gateway_stream_id,
          motion_score: Number(data.insight?.motion_score ?? 0),
          luminance_score: Number(data.insight?.luminance_score ?? 0),
          sampled_at: String(data.insight?.sampled_at ?? new Date().toISOString()),
          sample_frames: Number(data.insight?.sample_frames ?? 1)
        };
      } catch {
        return null;
      }
    }))).filter(Boolean);
  if (!samples.length) return { sampled: 0 };
  const payload = {
    gateway_id: gatewayId,
    observer_site_id: observerSiteId,
    sample_id: crypto.randomUUID(),
    sampled_at: new Date().toISOString(),
    local_processing: true,
    no_raw_video_returned: true,
    samples
  };
  const body = JSON.stringify(payload);
  const timestamp = new Date().toISOString();
  const nonce = crypto.randomUUID();
  const response = await fetch(`${productionBaseUrl.replace(/\/$/, "")}/api/video-gateway/cloud-learning`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-video-gateway-id": gatewayId,
      "x-video-gateway-timestamp": timestamp,
      "x-video-gateway-nonce": nonce,
      "x-video-gateway-signature": signBody(timestamp, nonce, body, cloudSecret)
    },
    body
  });
  if (!response.ok) return { sampled: 0 };
  return { sampled: samples.length };
}

function startLearningLoop(config) {
  if (learningTimer) clearInterval(learningTimer);
  void pushLearningSample(config);
  learningTimer = setInterval(() => void pushLearningSample(config), 5 * 60 * 1000);
  learningTimer.unref?.();
}

async function connect(input) {
  // The pairing claim is consumed before any DVR request. Its token stays in local process memory only.
  const { gatewayId, observerSiteId, discoveryToken } = consumePairingClaim(input.claimSessionId);
  const connection = input.useExistingProfile ? loadExistingDvrProfileForConnect() : {
    endpoint: String(input.endpoint || ""),
    port: Number(input.port || 554),
    username: String(input.username || ""),
    password: String(input.password || ""),
    vendor: String(input.vendor || "generic"),
    channelCount: Number(input.channelCount || 16)
  };

  startGateway();
  await waitForGateway();
  const channelCount = Number(connection.channelCount || 16);
  const vendor = String(connection.vendor || "generic");
  const discoveryResponse = await fetch(`${gatewayUrl}/dvr/connect`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-video-gateway-secret": gatewaySecret
    },
    body: JSON.stringify({
      connection_type: "dvr",
      endpoint: connection.endpoint,
      port: connection.port,
      username: connection.username,
      password: connection.password,
      metadata: { vendor, expected_channel_count: channelCount, read_only_requested: true }
    })
  });
  const discovery = await discoveryResponse.json();
  if (!discoveryResponse.ok) throw new Error("בדיקת ה-DVR המקומית נכשלה.");

  const payload = sanitizeDiscovery(discovery, { gatewayId, gardenId: "", observerSiteId, vendor, channelCount });
  const body = JSON.stringify(payload);
  const timestamp = new Date().toISOString();
  const nonce = crypto.randomUUID();
  const cloudResponse = await fetch(`${productionBaseUrl.replace(/\/$/, "")}/api/video-gateway/cloud-discovery`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-video-gateway-id": gatewayId,
      "x-video-gateway-timestamp": timestamp,
      "x-video-gateway-nonce": nonce,
      "x-video-gateway-pairing-token": discoveryToken
    },
    body
  });
  const cloudResult = await cloudResponse.json().catch(() => ({}));
  if (!cloudResponse.ok) throw new Error(cloudResult.error || "מיפוי הערוצים לענן נכשל.");
  return {
    channel_count: cloudResult.data?.channel_count ?? payload.channels.length,
    connected_channel_count: cloudResult.data?.connected_channel_count ?? payload.connected_channel_count
  };
}

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === "GET" && request.url === "/") {
      send(response, 200, page(), "text/html; charset=utf-8");
      return;
    }
    if (request.method === "GET" && request.url === "/status") {
      purgeExpiredClaims();
      send(response, 200, JSON.stringify({ running, lastResult, pairing: { pending_claims: pendingClaims.size, token_storage: "memory_only", keychain_runtime_service: "com.ganbatuach.video-gateway.runtime" } }));
      return;
    }
    if (request.method === "GET" && request.url === "/dvr-profile/status") {
      send(response, 200, JSON.stringify(dvrProfileStatus()));
      return;
    }
    if (request.method === "POST" && request.url === "/pairing/claim") {
      const result = await claimPairing(await readJson(request));
      send(response, 200, JSON.stringify(result));
      return;
    }
    if (request.method === "POST" && request.url === "/connect") {
      if (running) {
        send(response, 409, JSON.stringify({ error: "בדיקה כבר רצה." }));
        return;
      }
      running = true;
      try {
        const result = await connect(await readJson(request));
        lastResult = result;
        send(response, 200, JSON.stringify(result));
      } finally {
        running = false;
      }
      return;
    }
    send(response, 404, JSON.stringify({ error: "not_found" }));
  } catch (error) {
    send(response, 500, JSON.stringify({ error: error instanceof Error ? error.message : "הפעולה נכשלה." }));
  }
});

server.listen(webPort, "127.0.0.1", () => {
  console.log(`Local DVR onboarding is ready at http://127.0.0.1:${webPort}`);
  console.log("No DVR request is sent until the CONNECT button is clicked.");
});

function shutdown() {
  if (learningTimer) clearInterval(learningTimer);
  if (gatewayProcess && !gatewayProcess.killed) gatewayProcess.kill("SIGTERM");
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
