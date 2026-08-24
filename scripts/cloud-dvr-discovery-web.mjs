import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import http from "node:http";

const gatewayPort = Number(process.env.LOCAL_DVR_GATEWAY_PORT || 18080);
const webPort = Number(process.env.LOCAL_DVR_ONBOARDING_PORT || 18180);
const gatewayUrl = `http://127.0.0.1:${gatewayPort}`;
const gatewaySecret = crypto.randomBytes(48).toString("base64url");
const localCloudConfigPath = ".env.video-gateway.local";
let running = false;
let lastResult = null;
let gatewayProcess = null;

function loadLocalCloudConfig() {
  if (!existsSync(localCloudConfigPath)) return {};
  const config = {};
  const content = readFileSync(localCloudConfigPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    const raw = trimmed.slice(separator + 1).trim();
    config[key] = raw.replace(/^["']|["']$/g, "");
  }
  return config;
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
    <div class="notice">לחיצה על CONNECT היא האישור הסופי להתחיל בדיקה לקריאה בלבד. עד הלחיצה לא נשלחת בקשה ל-DVR.</div>
    <form id="dvr-form" autocomplete="off">
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
          </select>
        </label>
        <label>שם משתמש
          <input name="username" required autocomplete="off" autocapitalize="none" spellcheck="false" />
        </label>
        <label>סיסמה
          <input name="password" required type="password" autocomplete="new-password" />
        </label>
        <label>מספר ערוצים צפוי
          <input name="channelCount" inputmode="numeric" value="16" />
        </label>
      </div>
      <div class="notice warn">לא להדביק כאן cookies, קישורי דפדפן או כתובות stream. רק פרטי החיבור הרגילים של ה-DVR.</div>
      <button id="connect" class="primary" type="submit">CONNECT - התחלת בדיקת קריאה בלבד</button>
      <div id="status" role="status"></div>
    </form>
  </main>
  <script>
    const form = document.getElementById("dvr-form");
    const button = document.getElementById("connect");
    const status = document.getElementById("status");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      button.disabled = true;
      status.textContent = "מתחיל בדיקה מקומית לקריאה בלבד...";
      const body = Object.fromEntries(new FormData(form).entries());
      try {
        const response = await fetch("/connect", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body)
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "החיבור נכשל");
        status.textContent = "החיבור הושלם. ערוצים שמופו: " + data.channel_count + ", ערוצים מחוברים: " + data.connected_channel_count + ".";
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
    channels: channels.map((channel, index) => ({
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
    })),
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

async function connect(input) {
  const cloudConfig = loadLocalCloudConfig();
  const productionBaseUrl = process.env.VIDEO_GATEWAY_CLOUD_BASE_URL || cloudConfig.VIDEO_GATEWAY_CLOUD_BASE_URL || "https://gan-batuach.vercel.app";
  const gatewayId = process.env.VIDEO_GATEWAY_CLOUD_GATEWAY_ID || cloudConfig.VIDEO_GATEWAY_CLOUD_GATEWAY_ID;
  const cloudSecret = process.env.VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET || cloudConfig.VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET;
  const gardenId = process.env.VIDEO_GATEWAY_CLOUD_GARDEN_ID || cloudConfig.VIDEO_GATEWAY_CLOUD_GARDEN_ID || "";
  const observerSiteId = process.env.VIDEO_GATEWAY_CLOUD_OBSERVER_SITE_ID || cloudConfig.VIDEO_GATEWAY_CLOUD_OBSERVER_SITE_ID || "";
  if (!gatewayId || !cloudSecret || (!gardenId && !observerSiteId)) {
    throw new Error("חסרה הגדרת ענן מקומית ל-Gateway.");
  }

  startGateway();
  await waitForGateway();
  const channelCount = Number(input.channelCount || 16);
  const vendor = String(input.vendor || "generic");
  const discoveryResponse = await fetch(`${gatewayUrl}/dvr/connect`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-video-gateway-secret": gatewaySecret
    },
    body: JSON.stringify({
      connection_type: "dvr",
      endpoint: String(input.endpoint || ""),
      port: Number(input.port || 554),
      username: String(input.username || ""),
      password: String(input.password || ""),
      metadata: { vendor, expected_channel_count: channelCount, read_only_requested: true }
    })
  });
  const discovery = await discoveryResponse.json();
  if (!discoveryResponse.ok) throw new Error("בדיקת ה-DVR המקומית נכשלה.");

  const payload = sanitizeDiscovery(discovery, { gatewayId, gardenId, observerSiteId, vendor, channelCount });
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
      "x-video-gateway-signature": signBody(timestamp, nonce, body, cloudSecret)
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
      send(response, 200, JSON.stringify({ running, lastResult }));
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
  if (gatewayProcess && !gatewayProcess.killed) gatewayProcess.kill("SIGTERM");
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
