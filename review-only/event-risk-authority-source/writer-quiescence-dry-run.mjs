#!/usr/bin/env node
// Read-only inventory gate. No arm/apply/pause mode exists by design.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync(new URL("./writer-quiescence-source-manifest.json", import.meta.url), "utf8"));
const dockerBin = "/opt/homebrew/bin/docker";
const limaBin = "/opt/homebrew/bin/limactl";

function run(label, bin, args, env = {}) {
  const result = spawnSync(bin, args, {
    encoding: "utf8", timeout: 15000, maxBuffer: 256 * 1024,
    env: { ...process.env, ...env }
  });
  // Never include stderr: provider/daemon diagnostics can contain addresses or secrets.
  if (result.error || result.status !== 0) throw new Error(`COLLECT_${label}_FAILED`);
  return result.stdout.trim();
}

function inspectContainer(source, name) {
  const line = run("CONTAINER", dockerBin, ["-H", source.dockerSocket, "inspect", "--format",
    "{{json .Id}}|{{json .Name}}|{{json .State.Running}}|{{json .HostConfig.NetworkMode}}|{{json .Mounts}}|{{json .HostConfig.PortBindings}}", name]);
  const fields = line.split("|");
  if (fields.length !== 6) throw new Error("COLLECT_CONTAINER_FORMAT_FAILED");
  const [id, rawName, running, networkMode, mounts, bindings] = fields.map(JSON.parse);
  return {
    id, name: rawName.replace(/^\//, ""), running, networkMode,
    mounts: mounts.map(m => ({ name: m.Name || null, destination: m.Destination, type: m.Type })),
    published: Object.fromEntries(Object.entries(bindings || {}).map(([port, values]) =>
      [port, values?.[0]?.HostPort || null]))
  };
}

function inspectNetwork(source) {
  const line = run("NETWORK", dockerBin, ["-H", source.dockerSocket, "network", "inspect",
    source.network, "--format", "{{json .Containers}}|{{json .Internal}}"]);
  const fields = line.split("|");
  if (fields.length !== 2) throw new Error("COLLECT_NETWORK_FORMAT_FAILED");
  const containers = JSON.parse(fields[0]);
  return {
    internal: fields[1] === "true",
    members: Object.values(containers || {}).map(c => c.Name).sort(),
    addressToName: Object.fromEntries(Object.values(containers || {}).map(c =>
      [String(c.IPv4Address || "").split("/")[0], c.Name]))
  };
}

function readActivity(source, addressToName) {
  const sql = "BEGIN READ ONLY; SELECT coalesce(usename,'(none)'), coalesce(host(client_addr),'local'), coalesce(state,'(none)') FROM pg_stat_activity WHERE backend_type = 'client backend'; COMMIT;";
  const output = run("DB_ACTIVITY", dockerBin, ["-H", source.dockerSocket, "exec", "-u", "postgres",
    "supabase_db_gan-batuach-integration", "psql", "-X", "-qAt", "-F", "|", "-U", "postgres", "-d", "postgres", "-c", sql]);
  return output.split("\n").filter(line => line.split("|").length === 3).map(line => {
    const [role, address, state] = line.split("|");
    // The raw address exists only in process memory. Never return it or SQL text.
    const sourceName = address === "local" ? "local" : addressToName[address] || "unknown";
    return { role, source: sourceName, state };
  });
}

function readScheduleMetadata(source) {
  const databases = ["postgres", "_supabase", "gan_batuach_baseline_builder_v2"];
  return databases.map(database => {
    const sql = "BEGIN READ ONLY; SELECT extname FROM pg_extension WHERE extname IN ('pg_cron','pg_net'); SELECT coalesce(to_regclass('cron.job')::text,'none'), coalesce(to_regclass('net.http_request_queue')::text,'none'); COMMIT;";
    const output = run("DB_SCHEDULE_CATALOG", dockerBin, ["-H", source.dockerSocket, "exec", "-u", "postgres",
      "supabase_db_gan-batuach-integration", "psql", "-X", "-qAt", "-F", "|", "-U", "postgres", "-d", database, "-c", sql]);
    const entries = output.split("\n").filter(Boolean);
    return { database, installed: entries.filter(x => x === "pg_cron" || x === "pg_net"),
      relationState: entries.find(x => x.includes("|")) || "unknown" };
  });
}

export function evaluate(snapshot, expected = manifest) {
  const reasons = [];
  const add = code => { if (!reasons.includes(code)) reasons.push(code); };
  const source = expected.source;
  if (snapshot.daemonId !== source.dockerDaemonId || snapshot.daemonName !== source.dockerDaemonName)
    add("SOURCE_DAEMON_IDENTITY_CHANGED");
  if (snapshot.limaDaemonId !== source.dockerDaemonId) add("INDEPENDENT_LIMA_PATH_NOT_VERIFIED");
  if (snapshot.configSha256 !== source.colimaConfigSha256) add("COLIMA_CONFIG_CHANGED");
  if (snapshot.networkInternal !== source.networkInternal) add("NETWORK_MODE_CHANGED");
  const desiredNames = expected.containers.map(c => c.name).sort();
  if (JSON.stringify((snapshot.networkMembers || []).slice().sort()) !== JSON.stringify(desiredNames))
    add("NETWORK_MEMBERSHIP_CHANGED");
  for (const pinned of expected.containers) {
    const found = (snapshot.containers || []).find(c => c.name === pinned.name);
    if (!found || found.id !== pinned.id || !found.running || found.networkMode !== source.network) {
      add(`CONTAINER_IDENTITY_CHANGED_${pinned.service.toUpperCase()}`);
      continue;
    }
    const actualMounts = found.mounts.map(m => ({ name: m.name, destination: m.destination })).sort((a,b) => a.destination.localeCompare(b.destination));
    const requiredMounts = pinned.mounts.slice().sort((a,b) => a.destination.localeCompare(b.destination));
    if (found.mounts.some(m => m.type !== "volume") || JSON.stringify(actualMounts) !== JSON.stringify(requiredMounts))
      add(`MOUNT_SET_CHANGED_${pinned.service.toUpperCase()}`);
    if (JSON.stringify(found.published) !== JSON.stringify(pinned.published))
      add(`PORT_BINDING_CHANGED_${pinned.service.toUpperCase()}`);
  }
  if ((snapshot.containers || []).length !== expected.containers.length) add("CONTAINER_SET_CHANGED");
  const pinnedIds = new Set(expected.containers.map(c => c.id));
  const protectedVolumes = new Set(expected.volumes.map(v => v.name));
  if ((snapshot.allRunningContainers || []).some(c => !pinnedIds.has(c.id) &&
      c.mounts.some(m => protectedVolumes.has(m.name)))) add("UNEXPECTED_VOLUME_WRITER");
  if (!Array.isArray(snapshot.allRunningContainers)) add("ALL_RUNNING_CONTAINERS_NOT_INVENTORIED");
  for (const volume of expected.volumes) {
    const found = (snapshot.volumes || []).find(v => v.name === volume.name);
    if (!found || found.driver !== volume.driver || found.scope !== volume.scope || found.createdAt !== volume.createdAt)
      add("VOLUME_IDENTITY_CHANGED");
  }
  for (const endpoint of expected.ingress) {
    const listener = (snapshot.hostListeners || []).find(x => x.port === endpoint.port);
    if (!listener || !listener.loopbackOnly) add(`HOST_INGRESS_NOT_LOOPBACK_${endpoint.port}`);
  }
  if ((snapshot.dbClients || []).some(c => c.source === "unknown")) add("UNKNOWN_DB_CLIENT_SOURCE");
  if ((snapshot.dbClients || []).length > 0) add("EXISTING_DB_CLIENTS_NOT_DRAINED_OR_FENCED");
  if ((snapshot.scheduleCatalog || []).length !== 3 ||
      snapshot.scheduleCatalog.some(x => x.installed.length || x.relationState !== "none|none"))
    add("SCHEDULED_WRITER_CATALOG_UNRESOLVED");
  if (snapshot.hostProcessInventory !== "sampled") add("HOST_PROCESS_INVENTORY_UNAVAILABLE");
  // These cannot be proven from a momentary read-only snapshot, even if the caller
  // supplies forged `proof` fields. No PASS or mutation mode is exposed.
  add("FUTURE_API_DB_AND_DOCKER_WRITER_EXCLUSION_UNVERIFIED");
  add("SCHEDULED_AND_HOST_WRITER_EXCLUSION_UNVERIFIED");
  add("AUTO_RESUME_AFTER_GUEST_DAEMON_FAILURE_UNVERIFIED");
  add("SOURCE_WINDOW_AND_ROLLBACK_NOT_EXERCISED");
  return { status: "BLOCKED", mode: "READ_ONLY_DRY_RUN", reasons,
    summary: { pinnedServices: expected.containers.length, observedServices: (snapshot.containers || []).length,
      allRunningContainers: (snapshot.allRunningContainers || []).length,
      observedDbClients: (snapshot.dbClients || []).length,
      possibleWriterProcessCount: snapshot.possibleWriterProcessCount ?? null,
      projectJobLabelCount: snapshot.projectJobLabelCount ?? null,
      clientSources: Object.fromEntries([...new Set((snapshot.dbClients || []).map(c => c.source))].sort().map(name =>
        [name, snapshot.dbClients.filter(c => c.source === name).length])),
      clientRoleSources: Object.fromEntries([...new Set((snapshot.dbClients || []).map(c => `${c.role}@${c.source}`))].sort().map(key =>
        [key, snapshot.dbClients.filter(c => `${c.role}@${c.source}` === key).length])) } };
}

export function collectLive(expected = manifest) {
  const source = expected.source;
  const daemonLine = run("DAEMON", dockerBin, ["-H", source.dockerSocket, "info", "--format", "{{.ID}}|{{.Name}}"]).split("|");
  const limaLine = run("LIMA", limaBin, ["shell", "--tty=false", source.limaInstance, "sudo", "docker", "info", "--format", "{{.ID}}"],
    { LIMA_HOME: source.limaHome }).trim();
  const configSha256 = createHash("sha256").update(readFileSync(`${source.colimaHome}/gbi/colima.yaml`)).digest("hex");
  const network = inspectNetwork(source);
  const containers = expected.containers.map(c => inspectContainer(source, c.name));
  const allNames = run("ALL_RUNNING_CONTAINERS", dockerBin, ["-H", source.dockerSocket, "ps", "--format", "{{.Names}}"]).split("\n").filter(Boolean);
  const allRunningContainers = allNames.map(name => inspectContainer(source, name));
  const volumes = expected.volumes.map(v => {
    const line = run("VOLUME", dockerBin, ["-H", source.dockerSocket, "volume", "inspect", v.name,
      "--format", "{{.Name}}|{{.Driver}}|{{.Scope}}|{{.CreatedAt}}"]).split("|");
    if (line.length !== 4) throw new Error("COLLECT_VOLUME_FORMAT_FAILED");
    return { name: line[0], driver: line[1], scope: line[2], createdAt: line[3] };
  });
  const listeners = run("HOST_LISTENERS", "/usr/sbin/lsof", ["-nP", "-iTCP:55421", "-iTCP:55422", "-sTCP:LISTEN", "-F", "n"]);
  const hostListeners = expected.ingress.map(e => {
    const names = listeners.split("\n").filter(line => line.startsWith("n") && line.endsWith(`:${e.port}`));
    return { port: e.port, loopbackOnly: names.length > 0 && names.every(line => /^n(?:127\.0\.0\.1|\[::1\]):/.test(line)) };
  });
  const dbClients = readActivity(source, network.addressToName);
  const scheduleCatalog = readScheduleMetadata(source);
  // Executable names only; never command arguments, environment, cwd or credentials.
  const hostProcessNames = run("HOST_PROCESSES", "/bin/ps", ["-axo", "comm="]);
  const hostJobLabels = run("HOST_JOBS", "/bin/launchctl", ["list"]);
  const possibleWriterProcessCount = hostProcessNames.split("\n").filter(x =>
    /node|postgres|docker|colima|cron|supabase/i.test(x)).length;
  const projectJobLabelCount = hostJobLabels.split("\n").filter(x =>
    /gan[-_]?batuach|digital[-_]?observer|supabase/i.test(x)).length;
  return { daemonId: daemonLine[0], daemonName: daemonLine[1], limaDaemonId: limaLine,
    configSha256, networkInternal: network.internal, networkMembers: network.members,
    containers, allRunningContainers, volumes, hostListeners, dbClients, scheduleCatalog,
    hostProcessInventory: "sampled", possibleWriterProcessCount, projectJobLabelCount };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  if (process.argv.length > 3 || (process.argv[2] && process.argv[2] !== "--dry-run")) {
    console.error("Only --dry-run is supported; no apply mode exists.");
    process.exitCode = 2;
  } else {
    try {
      console.log(JSON.stringify(evaluate(collectLive())));
      process.exitCode = 1; // A blocked safety gate must never look like a successful preflight.
    } catch (error) {
      console.log(JSON.stringify({ status: "BLOCKED", mode: "READ_ONLY_DRY_RUN",
        reasons: [String(error.message).startsWith("COLLECT_") ? error.message : "COLLECT_UNEXPECTED_FAILURE"] }));
      process.exitCode = 1;
    }
  }
}
