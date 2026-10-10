// Establishes an identity-only recovery binding for the already-authorized
// Home DVR. No endpoint, credential, raw serial or MAC leaves Keychain.
import { createHash } from "node:crypto";
import { chmodSync, existsSync, realpathSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { createEdgeSecretStoreSync } from "../../services/video-gateway/edge-secret-store-sync.mjs";
import { createPrivateNvrIdentityBinding, PRIVATE_NVR_IDENTITY_BINDING_ACCOUNT,
  probePrivateNvrIdentity, privateIpv4Endpoint } from
  "../../services/video-gateway/private-nvr-endpoint-recovery.mjs";

const EXPECTED = Object.freeze({ model: "ERO-N7516HR", software: "8.2.4.1", channelCapacity: 16 });
const option = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) || "";
const output = resolve(option("output") || ".");
const restricted = `${realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted")}${sep}`;
if (!output.startsWith(restricted) || existsSync(output)) throw new Error("P38_DVR_IDENTITY_BINDING_OUTPUT_INVALID");
const store = createEdgeSecretStoreSync({ keychainService: "com.ganbatuach.video-gateway.runtime" });
const rawProfile = store.read("dvr_profile_json"), password = store.read("dvr_password");
if (!rawProfile || !password) throw new Error("P38_DVR_PROFILE_UNAVAILABLE");
const profile = JSON.parse(rawProfile), host = privateIpv4Endpoint(profile.endpoint).hostname;
const identity = await probePrivateNvrIdentity({ profile, password, host });
const text = JSON.stringify(identity?.deviceInfo || {});
if (!identity || !text.includes(EXPECTED.model) || !text.includes(EXPECTED.software)
  || identity.channel_capacity < EXPECTED.channelCapacity) throw new Error("P38_DVR_AUTHORITATIVE_IDENTITY_MISMATCH");
const binding = createPrivateNvrIdentityBinding({ deviceInfo: identity.deviceInfo,
  systemInfo: identity.systemInfo,
  credentialAnchor: createHash("sha256").update(`${profile.username}\0${password}`).digest("hex"),
  model: EXPECTED.model, software: EXPECTED.software, channelCapacity: EXPECTED.channelCapacity });
store.write(PRIVATE_NVR_IDENTITY_BINDING_ACCOUNT, JSON.stringify(binding));
if (store.read(PRIVATE_NVR_IDENTITY_BINDING_ACCOUNT) !== JSON.stringify(binding)) {
  throw new Error("P38_DVR_IDENTITY_BINDING_PERSISTENCE_FAILED");
}
const evidence = { contract: "observer-push38-dvr-identity-binding-evidence-v1",
  observed_at: new Date().toISOString(), recorder_identity: "PASS",
  model: EXPECTED.model, software: EXPECTED.software, channel_capacity: EXPECTED.channelCapacity,
  fingerprint_present: true, endpoint_exposed: false, credentials_exposed: false,
  binding_sha256: createHash("sha256").update(JSON.stringify(binding)).digest("hex") };
writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600, flag: "wx" });
chmodSync(output, 0o600);
console.log(JSON.stringify({ status: "PASS", ...evidence }));
