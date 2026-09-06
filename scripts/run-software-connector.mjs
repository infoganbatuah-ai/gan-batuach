import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const dataRoot = resolve(process.env.OBSERVER_CONNECTOR_DATA_DIR || ".observer-connector");
const secretDir = resolve(process.env.OBSERVER_CONNECTOR_SECRET_DIR || `${dataRoot}/secrets`);
mkdirSync(dataRoot, { recursive: true, mode: 0o700 });
mkdirSync(secretDir, { recursive: true, mode: 0o700 });

process.env.OBSERVER_EDGE_DEVICE_TYPE = "SOFTWARE_CONNECTOR";
process.env.OBSERVER_EDGE_DATA_DIR = dataRoot;
process.env.GAN_BATUACH_GATEWAY_SECRET_DIR = secretDir;
process.env.GAN_BATUACH_GATEWAY_DVR_SECRET_DIR ||= secretDir;
process.env.GAN_BATUACH_GATEWAY_DISCOVERY ||= "1";

await import("./run-persistent-home-gateway.mjs");
