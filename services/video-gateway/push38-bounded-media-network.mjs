import { isIP } from "node:net";

const IPV6_FIREWALL_SERVICE = "urn:schemas-upnp-org:service:WANIPv6FirewallControl:1";

function normalizeIpv6(value) {
  return String(value || "").trim().replace(/^\[|\]$/g, "").split("%")[0].toLowerCase();
}

function isGlobalIpv6(value) {
  const address = normalizeIpv6(value);
  return isIP(address) === 6 && address !== "::" && address !== "::1" &&
    !address.startsWith("fe8") && !address.startsWith("fe9") &&
    !address.startsWith("fea") && !address.startsWith("feb") &&
    !address.startsWith("fc") && !address.startsWith("fd") &&
    !address.startsWith("ff");
}

export function assignedGlobalIpv6Addresses(ifconfigOutput) {
  const assigned = new Set();
  for (const line of String(ifconfigOutput || "").split("\n")) {
    const address = normalizeIpv6(/\binet6\s+([^\s]+)/.exec(line)?.[1]);
    if (isGlobalIpv6(address)) assigned.add(address);
  }
  return assigned;
}

export function upnpLocalLanIpv6(upnpOutput) {
  const address = normalizeIpv6(/Local LAN ip address\s*:\s*([^\s]+)/i.exec(String(upnpOutput || ""))?.[1]);
  return isGlobalIpv6(address) ? address : "";
}

export function selectBoundedMediaIpv6({ ifconfigOutput, upnpOutput }) {
  const assigned = assignedGlobalIpv6Addresses(ifconfigOutput);
  const selected = upnpLocalLanIpv6(upnpOutput);
  if (!selected || !assigned.has(selected)) return "";
  return selected;
}

export function selectBoundedMediaIpv6WithoutUpnp(ifconfigOutput) {
  let temporary = "";
  for (const line of String(ifconfigOutput || "").split("\n")) {
    const address = normalizeIpv6(/\binet6\s+([^\s]+)/.exec(line)?.[1]);
    if (!isGlobalIpv6(address)) continue;
    if (!/\btemporary\b/i.test(line)) return address;
    if (!temporary) temporary = address;
  }
  return temporary;
}

function privateIpv4(value) {
  if (isIP(value) !== 4) return false;
  const [first, second] = value.split(".").map(Number);
  return first === 10 || first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168);
}

function xmlValue(xml, name) {
  return new RegExp(`<${name}>([^<]+)</${name}>`, "i").exec(String(xml || ""))?.[1]?.trim() || "";
}

function escapeXml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&apos;"
  })[character]);
}

export function upnpDeviceDescriptionUrl(upnpOutput) {
  const raw = /^\s*desc:\s*(https?:\/\/\S+)\s*$/mi.exec(String(upnpOutput || ""))?.[1] || "";
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return url.protocol === "http:" && privateIpv4(url.hostname) && !url.username && !url.password
      ? url.href : "";
  } catch { return ""; }
}

export function wanIpv6FirewallControl(descriptionXml, descriptionUrl) {
  let origin;
  try {
    const description = new URL(descriptionUrl);
    if (description.protocol !== "http:" || !privateIpv4(description.hostname) ||
      description.username || description.password) return null;
    origin = description;
  } catch { return null; }
  const services = String(descriptionXml || "").match(/<service>[^]*?<\/service>/gi) || [];
  const service = services.find(candidate => xmlValue(candidate, "serviceType") === IPV6_FIREWALL_SERVICE);
  const controlPath = service ? xmlValue(service, "controlURL") : "";
  if (!controlPath) return null;
  try {
    const control = new URL(controlPath, origin);
    if (control.protocol !== "http:" || control.hostname !== origin.hostname ||
      control.username || control.password) return null;
    return { serviceType: IPV6_FIREWALL_SERVICE, controlUrl: control.href };
  } catch { return null; }
}

export function ipv6FirewallSoapEnvelope(action, argumentsByName = {}) {
  if (!["GetFirewallStatus", "AddPinhole", "DeletePinhole", "CheckPinholeWorking"]
    .includes(action)) throw new Error("P38_IPV6_FIREWALL_ACTION_INVALID");
  const argumentsXml = Object.entries(argumentsByName)
    .map(([name, value]) => {
      if (!/^[A-Za-z][A-Za-z0-9]*$/.test(name)) throw new Error("P38_IPV6_FIREWALL_ARGUMENT_INVALID");
      return `<${name}>${escapeXml(value)}</${name}>`;
    }).join("");
  return `<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" ` +
    `s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body>` +
    `<u:${action} xmlns:u="${IPV6_FIREWALL_SERVICE}">${argumentsXml}</u:${action}>` +
    `</s:Body></s:Envelope>`;
}

export function parseIpv6FirewallStatus(xml) {
  const enabled = xmlValue(xml, "FirewallEnabled");
  const allowed = xmlValue(xml, "InboundPinholeAllowed");
  if (!/^[01]$/.test(enabled) || !/^[01]$/.test(allowed)) return null;
  return { firewallEnabled: enabled === "1", inboundPinholeAllowed: allowed === "1" };
}

export function parseIpv6PinholeUniqueId(xml) {
  const value = xmlValue(xml, "UniqueID");
  if (!/^\d{1,5}$/.test(value)) return null;
  const id = Number(value);
  return Number.isInteger(id) && id >= 0 && id <= 65535 ? id : null;
}

export function parseUpnpSoapErrorCode(xml) {
  const value = xmlValue(xml, "errorCode");
  return /^\d{3,5}$/.test(value) ? Number(value) : null;
}

export const wanIpv6FirewallServiceType = IPV6_FIREWALL_SERVICE;
