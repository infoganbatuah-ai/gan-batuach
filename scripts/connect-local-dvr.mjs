import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

function questioner() {
  return readline.createInterface({ input, output });
}

async function ask(prompt, defaultValue = "") {
  const rl = questioner();
  const suffix = defaultValue ? ` (${defaultValue})` : "";
  const answer = await rl.question(`${prompt}${suffix}: `);
  rl.close();
  return answer.trim() || defaultValue;
}

async function askHidden(prompt) {
  if (!input.isTTY) return ask(prompt);
  output.write(`${prompt}: `);
  input.setRawMode(true);
  input.resume();
  input.setEncoding("utf8");
  let value = "";
  return new Promise((resolve) => {
    const onData = (char) => {
      if (char === "\r" || char === "\n") {
        input.setRawMode(false);
        input.off("data", onData);
        output.write("\n");
        resolve(value);
        return;
      }
      if (char === "\u0003") {
        input.setRawMode(false);
        input.off("data", onData);
        output.write("\n");
        process.exit(130);
      }
      if (char === "\u007f") {
        value = value.slice(0, -1);
        return;
      }
      value += char;
    };
    input.on("data", onData);
  });
}

async function main() {
  console.log("Local DVR onboarding. Secrets are sent only to the local server request and are not written by this script.");
  const appUrl = await ask("Local app URL", "http://127.0.0.1:3000");
  const onboardingToken = await askHidden("Local DVR onboarding token");
  const gatewayUrl = await ask("Local Gateway URL", "http://127.0.0.1:8080");
  const gatewaySecret = await askHidden("Video Gateway shared secret");
  const gardenId = await ask("Garden/site UUID");
  const endpoint = await askHidden("DVR endpoint or host");
  const portRaw = await ask("DVR RTSP port", "554");
  const vendor = await ask("Vendor template (hikvision/dahua/uniview/generic)", "generic");
  const username = await askHidden("DVR username");
  const password = await askHidden("DVR password");
  const channelCountRaw = await ask("Expected channel count", "16");

  const confirmation = await ask("Type CONNECT to run live read-only channel discovery now");
  if (confirmation !== "CONNECT") {
    console.log("Cancelled before any DVR connection attempt.");
    return;
  }

  const response = await fetch(`${appUrl.replace(/\/$/, "")}/api/video-gateway/local-dvr-onboarding`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-local-dvr-onboarding-token": onboardingToken
    },
    body: JSON.stringify({
      garden_id: gardenId,
      connection_type: "dvr",
      endpoint,
      port: Number(portRaw),
      username,
      password,
      gateway_url: gatewayUrl,
      gateway_secret: gatewaySecret,
      metadata: {
        vendor,
        expected_channel_count: Number(channelCountRaw),
        source: "local_dvr_onboarding",
        read_only_requested: true,
        ai_shadow_only: true
      }
    })
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error(`Connection failed with HTTP ${response.status}.`);
    console.error(body.error || "No error details returned.");
    process.exit(1);
  }

  const data = body.data ?? {};
  const channels = Array.isArray(data.channels) ? data.channels : [];
  const connected = channels.filter((item) => item?.camera?.status === "connected").length;
  console.log("DVR onboarding completed.");
  console.log(`Connection status: ${data.connection?.status ?? "unknown"}`);
  console.log(`Channels materialized: ${channels.length}`);
  console.log(`Connected channels: ${connected}`);
  console.log("No DVR credentials or RTSP URLs are printed by this script.");
}

await main();
