import { spawn } from "node:child_process";

// Native timestamp semantics still require synthetic-media acceptance before
// deployment. Never substitute request time or a guessed zero for missing PTS.
export function decodeAnchoredFrame(bytes, { spawnProcess = spawn, timeoutMs = 7000, signal } = {}) {
  if (signal?.aborted || !Buffer.isBuffer(bytes) || !bytes.length || bytes.length > 8 * 1024 * 1024) return Promise.resolve(null);
  return new Promise(resolve => {
    let child;
    try {
      child = spawnProcess("ffmpeg", ["-hide_banner", "-loglevel", "info", "-nostats",
        "-threads", "1", "-filter_threads", "1", "-copyts", "-start_at_zero", "-f", "mpegts", "-i", "pipe:0",
        "-map", "0:v:0", "-an", "-frames:v", "1", "-threads", "1", "-vf", "scale=300:300,format=rgb24,showinfo",
        "-fps_mode", "passthrough", "-f", "rawvideo", "pipe:1"], { stdio: ["pipe", "pipe", "pipe"] });
    } catch { resolve(null); return; }
    let settled = false, size = 0, diagnostics = "", diagnosticSize = 0;
    const chunks = [];
    const finish = value => { if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener("abort", abort); resolve(value); };
    const abort = () => { child.kill("SIGKILL"); finish(null); };
    const timer = setTimeout(abort, timeoutMs);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) { abort(); return; }
    child.on("error", abort);
    child.stdin.on("error", abort);
    child.stdout.on("error", abort);
    child.stderr.on("error", abort);
    child.stdout.on("data", chunk => {
      if (settled) return;
      size += chunk.length;
      if (size > 270_000) return abort();
      chunks.push(chunk);
    });
    child.stderr.on("data", chunk => {
      if (settled) return;
      diagnosticSize += chunk.length;
      if (diagnosticSize > 32_768) return abort();
      diagnostics += chunk.toString("utf8");
    });
    child.on("close", code => {
      if (settled) return;
      const records = diagnostics.split(/\r?\n/).filter(line => /\[Parsed_showinfo_\d+ @ [^\]]+\]\s+n:\s*0\s/.test(line));
      const pts = records.length === 1 ? /\bpts_time:([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s/i.exec(records[0]) : null;
      const offset = pts ? Number(pts[1]) : NaN;
      if (code !== 0 || size !== 270_000 || !Number.isFinite(offset) || offset < 0 || !/\biskey:1\b/.test(records[0] ?? "")) return finish(null);
      finish({ pixels: Buffer.concat(chunks), offset_seconds: offset });
    });
    try { child.stdin.end(bytes); } catch { abort(); }
  });
}
