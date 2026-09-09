export const FLEET_CONTRACT = "observer-edge-fleet-v1" as const;
export const FLEET_COMMANDS = ["REFRESH_CONFIGURATION","HEALTH_PROBE","REDISCOVER_CAMERAS","RECONNECT_CAMERAS","RESTART_SERVICE","ASSIGN_UPDATE_CHANNEL","INITIATE_APPROVED_UPDATE","PAUSE_ROLLOUT"] as const;
export type FleetCommand = typeof FLEET_COMMANDS[number];
export type FleetDevice = {
  id:string; enrollmentId:string; tenantId:string; siteId:string; siteName:string; profile:"SOFTWARE_CONNECTOR"|"PHYSICAL_GATEWAY"|"ENTERPRISE_EDGE";
  platform:string|null; architecture:string|null; runtimeVersion:string|null; buildSha:string|null; configurationVersion:number;
  desiredConfigurationVersion:number; lifecycleState:string; identityState:string; credentialState:string; updateChannel:string|null;
  updateState:string|null; health:"HEALTHY"|"RECOVERING"|"OFFLINE"|"AUTH_DEGRADED"|"NEEDS_ATTENTION"; lastSeenAt:string|null;
  supervisionState:string|null; backlogRecords:number; backlogBytes:number; resyncState:string|null; dependentPhysicalCameras:number; emptyChannels:number;
};

export function classifyFleetHealth(input:{lastSeenAt:string|null;lifecycleState:string;credentialState:string;runtimeHealth?:string|null;supervisionState?:string|null;now?:number}) {
  if (input.lifecycleState !== "ACTIVE" || input.credentialState === "REVOKED") return "AUTH_DEGRADED" as const;
  const age = (input.now ?? Date.now()) - Date.parse(input.lastSeenAt || "");
  if (!Number.isFinite(age) || age > 180_000) return "OFFLINE" as const;
  if (input.supervisionState === "RECOVERING") return "RECOVERING" as const;
  if (input.supervisionState === "NEEDS_ATTENTION" || !["HEALTHY","healthy"].includes(input.runtimeHealth || "")) return "NEEDS_ATTENTION" as const;
  return "HEALTHY" as const;
}

export function summarizeFleet(devices:FleetDevice[]) {
  const states = ["HEALTHY","RECOVERING","OFFLINE","AUTH_DEGRADED","NEEDS_ATTENTION"] as const;
  return { contract:FLEET_CONTRACT, total:devices.length,
    byHealth:Object.fromEntries(states.map(state=>[state,devices.filter(device=>device.health===state).length])),
    physicalCameras:devices.reduce((sum,item)=>sum+item.dependentPhysicalCameras,0),
    emptyChannels:devices.reduce((sum,item)=>sum+item.emptyChannels,0),
    backlogRecords:devices.reduce((sum,item)=>sum+item.backlogRecords,0),
    versions:Object.entries(devices.reduce<Record<string,number>>((all,item)=>{const key=item.runtimeVersion||"UNKNOWN";all[key]=(all[key]||0)+1;return all;},{})).sort((a,b)=>b[1]-a[1]) };
}

export function resolveFleetTargets(devices:FleetDevice[], filter:{tenantId:string;siteIds?:string[];deviceIds?:string[];profiles?:string[];health?:string[]}, maximum=100) {
  const scoped=devices.filter(d=>d.tenantId===filter.tenantId
    && (!filter.siteIds?.length||filter.siteIds.includes(d.siteId))
    && (!filter.deviceIds?.length||filter.deviceIds.includes(d.id))
    && (!filter.profiles?.length||filter.profiles.includes(d.profile))
    && (!filter.health?.length||filter.health.includes(d.health)));
  if (scoped.length>maximum) throw new Error("FLEET_BLAST_RADIUS_EXCEEDED");
  return scoped.map(device=>device.id).sort();
}

export function validateFleetCommand(input:{command:FleetCommand;expiresAt:string;targetCount:number;confirmed:boolean;now?:number}) {
  if (!FLEET_COMMANDS.includes(input.command)) throw new Error("FLEET_COMMAND_NOT_ALLOWED");
  const ttl=Date.parse(input.expiresAt)-(input.now??Date.now());
  if (!Number.isFinite(ttl)||ttl<=0||ttl>30*60_000) throw new Error("FLEET_COMMAND_TTL_INVALID");
  if (input.targetCount<1||input.targetCount>100) throw new Error("FLEET_TARGET_COUNT_INVALID");
  if ((input.targetCount>1||["RESTART_SERVICE","INITIATE_APPROVED_UPDATE"].includes(input.command))&&!input.confirmed) throw new Error("FLEET_CONFIRMATION_REQUIRED");
  return true;
}

export function dedupeInfrastructureAlerts(devices:FleetDevice[]) {
  return devices.filter(device=>device.health!=="HEALTHY").map(device=>({dedupeKey:`edge:${device.id}:${device.health}`,componentId:device.id,
    state:device.health,affectedPhysicalCameras:device.dependentPhysicalCameras,
    message:device.dependentPhysicalCameras>1?`Managed component affects ${device.dependentPhysicalCameras} physical cameras.`:"Managed component requires attention."}));
}
