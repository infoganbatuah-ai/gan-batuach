// Run on a reviewed Windows x64 build host. Produces a self-contained MSI;
// it never enrolls a device, contacts a camera or needs Node/npm on the customer PC.
import { cpSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
const args = Object.fromEntries(process.argv.slice(2).map(arg => { const i = arg.indexOf("="); return [arg.slice(0, i), arg.slice(i + 1)]; }));
for (const name of ["out", "node", "ffmpeg", "ffprobe", "ort", "model"]) if (!args[`--${name}`]) throw new Error(`BUILD_INPUT_REQUIRED_${name}`);
if (process.platform !== "win32" || process.arch !== "x64") throw new Error("WINDOWS_X64_BUILD_HOST_REQUIRED");
const out = resolve(args["--out"]); if (existsSync(out)) throw new Error("BUILD_OUTPUT_MUST_BE_NEW");
const model = readFileSync(args["--model"]);
if (createHash("sha256").update(model).digest("hex") !== "1fbcf47654165f2e0b5f1bdf3f123b9e9e1128cd6463717767b76ab4b5246f9a") throw new Error("MODEL_DIGEST_MISMATCH");
const ort = resolve(args["--ort"]); if (JSON.parse(readFileSync(join(ort, "package.json"))).version !== "1.29.0") throw new Error("ORT_VERSION_NOT_REVIEWED");
const payload = join(out, "payload"), runtime = join(payload, "runtime");
for (const path of ["bin", "models", "runtime/scripts", "runtime/services/video-gateway", "runtime/node_modules"]) mkdirSync(join(payload, path), { recursive: true });
for (const name of ["connector-desktop-service.mjs", "run-software-connector.mjs", "run-persistent-home-gateway.mjs", "discover-software-connector-cameras.mjs"]) copyFileSync(join("scripts", name), join(runtime, "scripts", name));
for (const name of readdirSync("services/video-gateway").filter(name => name.endsWith(".mjs"))) copyFileSync(join("services/video-gateway", name), join(runtime, "services/video-gateway", name));
for (const name of ["node", "ffmpeg", "ffprobe"]) copyFileSync(args[`--${name}`], join(payload, "bin", `${name}.exe`));
writeFileSync(join(payload, "models/ssd_mobilenet_v1_10.onnx"), model); copyFileSync("services/connector-desktop/THIRD_PARTY_NOTICES.txt", join(payload, "THIRD_PARTY_NOTICES.txt"));
for (const pkg of ["onnxruntime-node", "onnxruntime-common"]) {
  const source = join(dirname(ort), pkg), destination = join(runtime, "node_modules", pkg); mkdirSync(destination);
  copyFileSync(join(source, "package.json"), join(destination, "package.json")); cpSync(join(source, "dist"), join(destination, "dist"), { recursive: true });
  if (pkg === "onnxruntime-node") cpSync(join(source, "bin/napi-v6/win32/x64"), join(destination, "bin/napi-v6/win32/x64"), { recursive: true });
}
execFileSync("dotnet", ["publish", "services/connector-desktop/windows/DigitalObserverConnector.csproj", "-c", "Release", "-r", "win-x64", "--self-contained", "true", "-o", join(out, "host")], { stdio: "inherit" });
for (const name of readdirSync(join(out, "host"))) renameSync(join(out, "host", name), join(payload, name));
const wxs = `<?xml version="1.0" encoding="UTF-8"?><Wix xmlns="http://wixtoolset.org/schemas/v4/wxs"><Package Name="Digital Observer Connector" Manufacturer="Digital Observer" Version="0.1.0" UpgradeCode="7D52CC21-E9B5-44A1-BC43-748226E2B735" Scope="perMachine"><MajorUpgrade DowngradeErrorMessage="A newer version is installed."/><MediaTemplate EmbedCab="yes"/><StandardDirectory Id="ProgramFiles64Folder"><Directory Id="INSTALLFOLDER" Name="Digital Observer Connector"/></StandardDirectory><ComponentGroup Id="ProductComponents" Directory="INSTALLFOLDER"><Component Id="Host" Guid="*"><File Id="HostFile" Source="${join(payload, "DigitalObserver.exe")}" KeyPath="yes"><ProgId Id="DigitalObserver.Connect" Description="Digital Observer installation request"><Extension Id="observer-connect"><Verb Id="open" Command="Open with Digital Observer" TargetFile="HostFile" Argument="&quot;%1&quot;"/></Extension></ProgId></File><ServiceInstall Id="ConnectorService" Name="DigitalObserverConnector" DisplayName="Digital Observer Connector" Description="Secure outbound camera connection" Type="ownProcess" Start="auto" ErrorControl="normal" Account="LocalSystem" Arguments="--service"/><ServiceControl Id="ConnectorServiceControl" Name="DigitalObserverConnector" Start="install" Stop="both" Remove="uninstall" Wait="yes"/></Component><Component Id="Payload" Guid="*"><Files Include="${join(payload, "**")}" Exclude="${join(payload, "DigitalObserver.exe")}"/></Component></ComponentGroup><Feature Id="Main" Title="Digital Observer Connector" Level="1"><ComponentGroupRef Id="ProductComponents"/></Feature></Package></Wix>`;
writeFileSync(join(out, "DigitalObserverConnector.wxs"), wxs);
const msi = join(out, "Digital Observer Connector.msi"); execFileSync("wix", ["build", join(out, "DigitalObserverConnector.wxs"), "-arch", "x64", "-o", msi], { stdio: "inherit" });
const sha256 = createHash("sha256").update(readFileSync(msi)).digest("hex"); writeFileSync(join(out, "package-status.json"), JSON.stringify({ status: "WINDOWS_PACKAGE_BUILT_VALIDATION_REQUIRED", platform: "windows-x64", msi: basename(msi), sha256, service: "AUTO_START", customerRuntimeDependencies: 0, publicDownloadAllowed: false, ota: { contract: "observer-edge-update-v1", agentBundled: true, signedManifestRequired: true, atomicSlots: true, automaticRollback: true } }, null, 2));
console.log(JSON.stringify({ status: "WINDOWS_PACKAGE_BUILT_VALIDATION_REQUIRED", msi, sha256 }));
