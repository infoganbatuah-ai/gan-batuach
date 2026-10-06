import { isIP } from "node:net";

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
