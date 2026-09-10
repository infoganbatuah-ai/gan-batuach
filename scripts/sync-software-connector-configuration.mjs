import { syncSoftwareConnectorConfiguration } from "../services/video-gateway/software-connector-cloud.mjs";

const result = await syncSoftwareConnectorConfiguration();
console.log(JSON.stringify({ status: result.configured ? "CONFIGURED" : "WAITING_FOR_CAMERA", camera_count: result.cameraCount, credentials_printed: false, private_addresses_printed: false }));
