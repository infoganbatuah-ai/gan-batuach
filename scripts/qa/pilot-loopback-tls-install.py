"""Owner-approved, one-time HOME_QA certificate recovery; dry-run by default.

Only certificates, QA pins and the QA ingress service are replaced. Signed
camera slots, identity stores and release records are never written here.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import plistlib
import re
import shlex
import signal
import ssl
import subprocess
import time
import urllib.error
import urllib.request

HOME = Path.home()
APP = HOME / "Library/Application Support/Digital Observer"
ROOT = APP / "push38-qualification/loopback-tls-v3-20261029"
AGENTS = HOME / "Library/LaunchAgents"
INGRESS = "com.ganbatuach.push38.remote-ingress"
STALE_INGRESS = "com.ganbatuach.push38.qa-control-ingress"
RENEW = "com.ganbatuach.push38.qa-tls-maintenance"
SPECS = [
    ("observer-connector", "com.ganbatuach.software-connector.tapo", 18083, "0.2.40-p38-health"),
    ("observer-gateway", "com.ganbatuach.video-gateway", 18082, "0.2.101-p38-health"),
]
SOURCE = Path("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/worktrees/push38-aws-signing")
FILES = ["services/video-gateway/push38t-ota-ingress.mjs",
         "services/video-gateway/push38-remote-playback-page.mjs",
         "services/video-gateway/push38-r2-phone-media.mjs",
         "services/video-gateway/playback-ingress.mjs",
         "lib/domain/gateway-device-enrollment.ts"]
HERE = Path(__file__).resolve().parent
DOMAIN = f"gui/{os.getuid()}"


def run(args):
    return subprocess.check_output(args, stderr=subprocess.PIPE, timeout=35)


def digest(path):
    with path.open("rb") as source:
        return hashlib.file_digest(source, "sha256").hexdigest()


def checked(path):
    stat = path.lstat()
    if path.is_symlink() or not path.is_file() or stat.st_uid != os.getuid() or stat.st_mode & 0o022:
        raise RuntimeError("RECOVERY_INPUT_UNSAFE")
    return path.read_bytes()


def atomic(path, data):
    temporary = path.with_name(path.name + f".{os.getpid()}.incident-staging")
    with temporary.open("xb") as target:
        os.chmod(temporary, 0o600)
        target.write(data)
        target.flush()
        os.fsync(target.fileno())
    os.replace(temporary, path)


def registered(label):
    try:
        run(["/bin/launchctl", "print", f"{DOMAIN}/{label}"])
        return True
    except subprocess.CalledProcessError:
        return False


def witnessed_live_ingress():
    description = run(["/bin/launchctl", "print", f"{DOMAIN}/{INGRESS}"]).decode()
    pid = int(re.search(r"\bpid = (\d+)", description).group(1))
    raw = run(["/bin/ps", "-p", str(pid), "-o", "uid=,args="]).decode().strip()
    uid, command = raw.split(None, 1)
    args = shlex.split(command)
    expected_script = str(SOURCE / "scripts/qa/start-push38-remote-control-ingress.mjs")
    if int(uid) != os.getuid() or len(args) != 5 or args[:2] != ["/usr/local/bin/node", expected_script]:
        raise RuntimeError("RECOVERY_LIVE_INGRESS_NOT_WITNESSED")
    flags = dict(arg[2:].split("=", 1) for arg in args[2:] if arg.startswith("--") and "=" in arg)
    if set(flags) != {"runtime-secrets", "tls-key", "tls-cert"}:
        raise RuntimeError("RECOVERY_LIVE_INGRESS_FLAGS_INVALID")
    if digest(Path(flags["tls-cert"])) != digest(APP / "observer-gateway/ota/qa-control-plane-ca.crt"):
        raise RuntimeError("RECOVERY_LIVE_CERTIFICATE_NOT_PINNED")
    return plistlib.dumps({"Label": INGRESS, "ProgramArguments": args, "RunAtLoad": True,
                          "KeepAlive": True, "ThrottleInterval": 10,
                          "WorkingDirectory": str(SOURCE),
                          "EnvironmentVariables": {"PATH": "/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"},
                          "StandardOutPath": str(APP / "push38-qualification/durable-control-plane/ingress.stdout.log"),
                          "StandardErrorPath": str(APP / "push38-qualification/durable-control-plane/ingress.stderr.log")})


def stop(label):
    if registered(label):
        run(["/bin/launchctl", "bootout", f"{DOMAIN}/{label}"])
    for _ in range(40):
        if not registered(label):
            return
        time.sleep(0.25)
    raise RuntimeError("RECOVERY_SERVICE_DID_NOT_STOP")


def stop_exact_orphan_ingress(original_plist, pinned_certificate=None):
    probe = subprocess.run(["/usr/sbin/lsof", "-nP", "-iTCP:3101", "-sTCP:LISTEN", "-t"],
                           capture_output=True, timeout=5)
    pids = {int(value) for value in probe.stdout.split()}
    if not pids:
        return
    if len(pids) != 1:
        raise RuntimeError("RECOVERY_INGRESS_MULTIPLE_OWNERS")
    pid = next(iter(pids))
    command = run(["/bin/ps", "-p", str(pid), "-o", "uid=,args="]).decode().strip()
    uid, command = command.split(None, 1)
    expected = plistlib.loads(original_plist)["ProgramArguments"]
    actual = shlex.split(command)
    same_owner = actual == expected
    # The previous manual renewal left a detached ingress using the newer
    # certificate, while its LaunchAgent still referenced the older pair.
    # Accept that exact witnessed difference only if script, secret-store
    # reference and flags match and its public cert is the installed QA pin.
    if not same_owner and pinned_certificate and len(actual) == len(expected) == 5 and actual[:3] == expected[:3]:
        pair = dict(value[2:].split("=", 1) for value in actual[3:] if value.startswith("--") and "=" in value)
        if set(pair) == {"tls-cert", "tls-key"}:
            cert, key = Path(pair["tls-cert"]), Path(pair["tls-key"])
            restricted = Path("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted")
            same_owner = (cert.parent == key.parent == restricted and cert.stem == key.stem and
                          re.fullmatch(r"push38t-ota-loopback-[0-9]{8}", cert.stem) is not None and
                          cert.suffix == ".crt" and key.suffix == ".key" and
                          digest(cert) == digest(pinned_certificate))
            if same_owner:
                checked(cert)
                info = key.lstat()
                same_owner = not key.is_symlink() and key.is_file() and info.st_uid == os.getuid() and not (info.st_mode & 0o077)
    if int(uid) != os.getuid() or not same_owner:
        raise RuntimeError("RECOVERY_INGRESS_OWNER_NOT_EXACT")
    os.kill(pid, signal.SIGTERM)
    for _ in range(40):
        probe = subprocess.run(["/usr/sbin/lsof", "-nP", "-iTCP:3101", "-sTCP:LISTEN", "-t"],
                               capture_output=True, timeout=5)
        if not probe.stdout.strip():
            return
        time.sleep(0.25)
    raise RuntimeError("RECOVERY_INGRESS_OWNER_DID_NOT_STOP")


def start(label):
    if registered(label):
        raise RuntimeError("RECOVERY_SERVICE_ALREADY_REGISTERED")
    for attempt in range(3):
        try:
            run(["/bin/launchctl", "bootstrap", DOMAIN, str(AGENTS / f"{label}.plist")])
            return
        except subprocess.CalledProcessError:
            if attempt == 2 or registered(label):
                raise
            time.sleep(0.5)


def endpoint(url, context=None):
    try:
        with urllib.request.urlopen(url, timeout=5, context=context) as response:
            return response.status, json.loads(response.read(200000))
    except urllib.error.HTTPError as error:
        return error.code, {}


def current_pointers():
    return {profile: digest(APP / profile / "ota/current.json") for profile, *_ in SPECS}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--resume-prepared", action="store_true")
    args = parser.parse_args()
    expected = current_pointers()
    original = {}
    states = {}
    for profile, label, _, version in SPECS:
        root = APP / profile / "ota"
        current = json.loads(checked(root / "current.json"))
        manifest = json.loads(checked(Path(current["slot"]) / "release.json"))
        if current["version"] != version or digest(Path(current["slot"]) / "artifact.bin") != manifest["artifact_sha256"]:
            raise RuntimeError("RECOVERY_SIGNED_BASELINE_CHANGED")
        state = json.loads(checked(root / "update-state.json"))
        if state["state"] != "ROLLED_BACK":
            raise RuntimeError("RECOVERY_UPDATE_IN_PROGRESS")
        for filename in ["agent-config.json", "qa-control-plane-ca.crt"]:
            path = root / filename
            original[path] = checked(path)
        config = json.loads(original[root / "agent-config.json"])
        if config["channel"] != "HOME_QA" or config["managedRoot"] != str(root):
            raise RuntimeError("RECOVERY_PROFILE_NOT_HOME_QA")
        for service in [label, label + ".ota-agent"]:
            original[AGENTS / f"{service}.plist"] = checked(AGENTS / f"{service}.plist")
            present = registered(service)
            states[service] = True
            if not present and not (args.resume_prepared and service.endswith(".ota-agent")):
                raise RuntimeError("RECOVERY_EXPECTED_SERVICE_ABSENT")
    live_path = AGENTS / f"{INGRESS}.plist"
    original[live_path] = checked(live_path) if live_path.exists() else witnessed_live_ingress()
    original[AGENTS / f"{STALE_INGRESS}.plist"] = checked(AGENTS / f"{STALE_INGRESS}.plist")
    states[STALE_INGRESS] = registered(STALE_INGRESS)
    states[INGRESS] = registered(INGRESS)
    if not states[INGRESS] or (ROOT.exists() and not args.resume_prepared) or (AGENTS / f"{RENEW}.plist").exists():
        raise RuntimeError("RECOVERY_TARGET_EXISTS_OR_INGRESS_ABSENT")
    for relative in FILES:
        if checked(SOURCE / relative) != run(["git", "-C", str(SOURCE), "show", f"HEAD:{relative}"]):
            raise RuntimeError("RECOVERY_QA_SOURCE_DIRTY")
    if not args.apply:
        print(json.dumps({"status": "PREPARED_DRY_RUN", "profiles": len(SPECS),
                          "signed_versions": [item[3] for item in SPECS], "production_changes": False,
                          "update_delivery_hold": True, "new_service_root": str(ROOT)}))
        return

    if args.resume_prepared:
        previous = json.loads(checked(ROOT / "application-result.json"))
        if previous["status"] != "FAILED_ORIGINAL_CONFIGURATION_RESTORED":
            raise RuntimeError("RECOVERY_PREPARED_STATE_NOT_SAFE")
        for record in json.loads(checked(ROOT / "recovery-backup/index.json")):
            if digest(Path(record["path"])) != record["sha256"] or digest(Path(record["backup"])) != record["sha256"]:
                raise RuntimeError("RECOVERY_BACKUP_OR_ORIGINAL_CHANGED")
    else:
        ROOT.mkdir(mode=0o700)
    backup = ROOT / "recovery-backup"
    if not args.resume_prepared:
        backup.mkdir(mode=0o700)
    recovery_index = []
    for number, (path, data) in enumerate(original.items()):
        saved = backup / f"{number:02d}-{path.name}"
        if not args.resume_prepared:
            atomic(saved, data)
        if saved.read_bytes() != data:
            raise RuntimeError("RECOVERY_BACKUP_MISMATCH")
        recovery_index.append({"path": str(path), "backup": str(saved), "sha256": digest(saved)})
    if not args.resume_prepared:
        atomic(backup / "index.json", json.dumps(recovery_index, indent=2).encode())
    for filename in ["pilot-loopback-tls.mjs", "pilot-loopback-tls-service.mjs"]:
        if args.resume_prepared:
            if checked(ROOT / filename) != checked(HERE / filename):
                raise RuntimeError("RECOVERY_PREPARED_SOURCE_CHANGED")
        else:
            atomic(ROOT / filename, checked(HERE / filename))
    source_files = []
    for relative in FILES:
        destination = ROOT / "ingress-source" / relative
        destination.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        if args.resume_prepared:
            if checked(destination) != checked(SOURCE / relative):
                raise RuntimeError("RECOVERY_PREPARED_INGRESS_CHANGED")
        else:
            atomic(destination, checked(SOURCE / relative))
        source_files.append({"path": str(destination), "sha256": digest(destination)})
    module = ROOT / "ingress-source" / FILES[0]
    service = {"contract": "observer-loopback-tls-service-v1", "ingressLabel": INGRESS,
               "ingressModule": str(module), "ingressModuleSha256": digest(module),
               "sourceFiles": source_files, "updateDeliveryHold": True}
    if not args.resume_prepared:
        atomic(ROOT / "service.json", json.dumps(service, indent=2).encode())
    method = "inspectBundle" if args.resume_prepared else "initializeBundle"
    result = json.loads(run(["/usr/local/bin/node", "--input-type=module", "-e",
                            "import {" + method + "} from " + json.dumps((ROOT / "pilot-loopback-tls.mjs").as_uri()) +
                            "; console.log(JSON.stringify(" + method + "(" + json.dumps(str(ROOT)) + "))); "]))
    ca = checked(ROOT / "issuer.crt")
    ingress_plist = plistlib.loads(original[AGENTS / f"{INGRESS}.plist"])
    ingress_plist["ProgramArguments"] = ["/usr/local/bin/node", str(ROOT / "pilot-loopback-tls-service.mjs"),
                                         "serve", f"--root={ROOT}"]
    ingress_plist["StandardOutPath"] = str(ROOT / "ingress.stdout.log")
    ingress_plist["StandardErrorPath"] = str(ROOT / "ingress.stderr.log")
    ingress_plist["WorkingDirectory"] = str(ROOT)
    renew_plist = {"Label": RENEW, "ProgramArguments": ["/usr/local/bin/node",
                   str(ROOT / "pilot-loopback-tls-service.mjs"), "renew", f"--root={ROOT}"],
                   "RunAtLoad": True, "StartInterval": 21600,
                   "StandardOutPath": str(ROOT / "maintenance.stdout.log"),
                   "StandardErrorPath": str(ROOT / "maintenance.stderr.log"),
                   "EnvironmentVariables": {"PATH": "/usr/local/bin:/usr/bin:/bin"}}
    mutated = False
    phase = "PAUSE_OTA"
    try:
        for _, label, _, _ in SPECS:
            stop(label + ".ota-agent")
        if current_pointers() != expected:
            raise RuntimeError("RECOVERY_CONCURRENT_RELEASE_CHANGE")
        phase = "STOP_SAME_VERSION_RUNTIMES"
        for _, label, _, _ in SPECS:
            stop(label)
        stop(INGRESS)
        stop(STALE_INGRESS)
        phase = "RECONCILE_EXACT_INGRESS_OWNER"
        stop_exact_orphan_ingress(original[AGENTS / f"{INGRESS}.plist"],
                                 APP / "observer-gateway/ota/qa-control-plane-ca.crt")
        phase = "INSTALL_QA_CERTIFICATE_PINS"
        mutated = True
        stale = plistlib.loads(original[AGENTS / f"{STALE_INGRESS}.plist"])
        stale["RunAtLoad"] = False
        atomic(AGENTS / f"{STALE_INGRESS}.plist", plistlib.dumps(stale))
        for profile, *_ in SPECS:
            path = APP / profile / "ota/agent-config.json"
            config = json.loads(original[path])
            config["qaTlsCaSha256"] = result["caSha256"]
            atomic(path, json.dumps(config, indent=2).encode() + b"\n")
            atomic(APP / profile / "ota/qa-control-plane-ca.crt", ca)
        atomic(AGENTS / f"{INGRESS}.plist", plistlib.dumps(ingress_plist))
        start(INGRESS)
        run(["/bin/launchctl", "kickstart", f"{DOMAIN}/{INGRESS}"])
        phase = "VERIFY_TLS_AND_SCOPE"
        ctx = ssl.create_default_context(cafile=str(ROOT / "issuer.crt"))
        last_probe = "NOT_STARTED"
        for attempt in range(60):
            try:
                status, _ = endpoint("https://127.0.0.1:3101/api/video-gateway/event-manifest", ctx)
                last_probe = f"HTTP_{status}"
                if status in [401, 403]:
                    break
            except (OSError, urllib.error.URLError) as error:
                last_probe = str(error)[:160]
            time.sleep(0.5)
        else:
            raise RuntimeError("RECOVERY_TLS_AUTH_GATE_FAILED_" + last_probe)
        if endpoint("https://127.0.0.1:3101/api/video-gateway/edge-updates", ctx)[0] != 503:
            raise RuntimeError("RECOVERY_UPDATE_HOLD_FAILED")
        if endpoint("https://127.0.0.1:3101/api/health", ctx)[0] != 404:
            raise RuntimeError("RECOVERY_INGRESS_SCOPE_CHANGED")
        observations = []
        phase = "RESTART_SAME_SIGNED_RUNTIMES"
        for profile, label, port, version in SPECS:
            start(label)
            deadline = time.monotonic() + 60
            while time.monotonic() < deadline:
                try:
                    status, body = endpoint(f"http://127.0.0.1:{port}/health")
                    if status == 200 and body.get("edgeRuntime", {}).get("software_version") == version:
                        observations.append({"profile": profile, "version": version,
                                             "authorization": body.get("deviceAuthorization", {}).get("status")})
                        break
                except (OSError, urllib.error.URLError):
                    pass
                time.sleep(1)
            else:
                raise RuntimeError("RECOVERY_SAME_VERSION_RESTART_FAILED")
        if current_pointers() != expected:
            raise RuntimeError("RECOVERY_RELEASE_POINTER_CHANGED")
        # Existing OTA self-healing remains; the local ingress denies discovery
        # and downloads, so this incident cannot select a new release.
        for _, label, _, _ in SPECS:
            start(label + ".ota-agent")
        phase = "REGISTER_CERTIFICATE_MAINTENANCE"
        atomic(AGENTS / f"{RENEW}.plist", plistlib.dumps(renew_plist))
        start(RENEW)
        evidence = {"status": "APPLIED_SAME_SIGNED_VERSIONS", "observations": observations,
                    "certificates": result, "current_pointers_unchanged": current_pointers() == expected,
                    "update_delivery_hold": True, "issuer_in_os_trust_store": False,
                    "production_changed": False, "identity_store_changed_by_installer": False,
                    "backup_verified": True, "maintenance_interval_seconds": 21600}
        atomic(ROOT / "application-result.json", json.dumps(evidence, indent=2).encode())
        print(json.dumps(evidence))
    except BaseException as error:
        for label in [RENEW, *[s[1] + ".ota-agent" for s in SPECS], *[s[1] for s in SPECS], INGRESS, STALE_INGRESS]:
            try:
                stop(label)
            except Exception:
                pass
        restore_errors = []
        if mutated:
            for path, data in original.items():
                try:
                    atomic(path, data)
                except Exception as restore_error:
                    restore_errors.append(type(restore_error).__name__)
        for label, was_registered in states.items():
            if was_registered and not registered(label):
                try:
                    start(label)
                except Exception as restore_error:
                    restore_errors.append(type(restore_error).__name__)
        restored = not restore_errors and all(path.exists() and path.read_bytes() == data
                                              for path, data in original.items())
        restored = restored and all(not was_registered or registered(label)
                                    for label, was_registered in states.items())
        code = str(error) if isinstance(error, RuntimeError) else type(error).__name__
        atomic(ROOT / "application-result.json", json.dumps({"status": "FAILED_ORIGINAL_CONFIGURATION_RESTORED"
               if restored else "FAILED_RESTORE_REQUIRES_OPERATOR", "phase": phase, "category": code,
               "configuration_restore_verified": restored, "restore_error_count": len(restore_errors)}).encode())
        raise RuntimeError(f"RECOVERY_APPLY_FAILED_{phase}_{code}") from None


if __name__ == "__main__":
    main()
