/* eslint-disable @typescript-eslint/no-explicit-any -- fleet tables are migration-backed pending generated database types. */
import { createAdminClient } from "@/lib/supabase/admin";
import { classifyFleetHealth, dedupeInfrastructureAlerts, summarizeFleet, type FleetDevice } from "./fleet-control-plane";

function object(value:unknown):Record<string,any>{return value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,any>:{};}
export async function loadFleetSnapshot(input:{tenantId?:string;siteId?:string;profile?:string;health?:string;cursor?:string;limit?:number}={}) {
  const admin=createAdminClient() as any; const limit=Math.min(Math.max(input.limit||100,1),200);
  let query=admin.from("video_gateway_device_enrollments").select("id,gateway_id,tenant_id,observer_site_id,deployment_profile,identity_scheme,credential_version,lifecycle_state,runtime_version,config_version,last_seen_at,metadata,observer_sites(name)")
    .not("gateway_id","is",null).order("id").limit(limit+1);
  if(input.tenantId) query=query.eq("tenant_id",input.tenantId); if(input.siteId) query=query.eq("observer_site_id",input.siteId);
  if(input.profile) query=query.eq("deployment_profile",input.profile); if(input.cursor) query=query.gt("id",input.cursor);
  const enrolled=await query; if(enrolled.error) throw new Error("FLEET_INVENTORY_READ_FAILED");
  const rows=(enrolled.data||[]).slice(0,limit); const ids=rows.map((row:any)=>row.id); const siteIds=[...new Set(rows.map((row:any)=>row.observer_site_id))];
  const [updates,sources]=await Promise.all([
    ids.length?admin.from("observer_edge_device_updates").select("enrollment_id,state,current_version,target_version,known_good_version,last_seen_at").in("enrollment_id",ids).order("last_seen_at",{ascending:false}):Promise.resolve({data:[],error:null}),
    siteIds.length?admin.from("digital_observer_camera_sources").select("id,observer_site_id,status,health_status,connector_type,metadata").in("observer_site_id",siteIds):Promise.resolve({data:[],error:null})
  ]); if(updates.error||sources.error) throw new Error("FLEET_DEPENDENCY_READ_FAILED");
  const latestUpdate=new Map<string,any>(); for(const update of updates.data||[]) if(!latestUpdate.has(update.enrollment_id))latestUpdate.set(update.enrollment_id,update);
  let devices:FleetDevice[]=rows.map((row:any)=>{const metadata=object(row.metadata), health=object(metadata.health), supervision=object(metadata.supervision), offline=object(metadata.offline_buffer);
    const gatewayId=String(row.gateway_id||""); const dependent=(sources.data||[]).filter((source:any)=>{const m=object(source.metadata);return m.gateway_id===gatewayId||m.connector_gateway_id===gatewayId||m.device_id===gatewayId;});
    const emptyChannels=Number(metadata.empty_channel_count||metadata.unassigned_channel_count||0); const credentialState=row.lifecycle_state==="ACTIVE"?"ACTIVE":row.lifecycle_state;
    const fleetHealth=classifyFleetHealth({lastSeenAt:row.last_seen_at,lifecycleState:row.lifecycle_state,credentialState,runtimeHealth:health.status,supervisionState:supervision.state});
    const update=latestUpdate.get(row.id); return {id:gatewayId,enrollmentId:row.id,tenantId:row.tenant_id,siteId:row.observer_site_id,siteName:row.observer_sites?.name||"Site",profile:row.deployment_profile||"PHYSICAL_GATEWAY",
      platform:metadata.platform||null,architecture:metadata.architecture||null,runtimeVersion:row.runtime_version||metadata.software_version||null,buildSha:metadata.build_sha||null,
      configurationVersion:Number(row.config_version||1),desiredConfigurationVersion:Number(metadata.connector_config_version||row.config_version||1),lifecycleState:row.lifecycle_state,
      identityState:row.identity_scheme||"LEGACY_HMAC",credentialState,updateChannel:metadata.update_channel||null,updateState:update?.state||metadata.update_state||null,
      health:fleetHealth,lastSeenAt:row.last_seen_at,supervisionState:supervision.state||null,backlogRecords:Number(offline.depth||0),backlogBytes:Number(offline.bytes||0),
      resyncState:offline.state||null,dependentPhysicalCameras:dependent.filter((source:any)=>object(source.metadata).channel_state!=="CHANNEL_EMPTY").length,
      emptyChannels,} as FleetDevice;});
  if(input.health)devices=devices.filter(device=>device.health===input.health);
  return {devices,summary:summarizeFleet(devices),alerts:dedupeInfrastructureAlerts(devices),nextCursor:(enrolled.data||[]).length>limit?rows.at(-1)?.id:null};
}
