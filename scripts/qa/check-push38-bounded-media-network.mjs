import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assignedGlobalIpv6Addresses,
  ipv6FirewallSoapEnvelope,
  parseIpv6FirewallStatus,
  parseIpv6PinholeUniqueId,
  parseUpnpSoapErrorCode,
  selectBoundedMediaIpv6,
  selectBoundedMediaIpv6WithoutUpnp,
  upnpDeviceDescriptionUrl,
  upnpLocalLanIpv6,
  wanIpv6FirewallControl,
  wanIpv6FirewallServiceType
} from "../../services/video-gateway/push38-bounded-media-network.mjs";

const stable = "2001:db8:1::10";
const temporary = "2001:db8:1::20";
const interfaceState = `
  inet6 fe80::1%en0 prefixlen 64 secured scopeid 0x7
  inet6 ${stable} prefixlen 64 autoconf secured
  inet6 ${temporary} prefixlen 64 autoconf temporary
`;

test("uses the router-selected address only when it is assigned to the interface", () => {
  const output = `Local LAN ip address : ${temporary}\n`;
  assert.equal(selectBoundedMediaIpv6({ ifconfigOutput: interfaceState, upnpOutput: output }), temporary);
  assert.deepEqual([...assignedGlobalIpv6Addresses(interfaceState)], [stable, temporary]);
  assert.equal(upnpLocalLanIpv6(output), temporary);
});

test("fails closed for a different, local-only, malformed, or missing address", () => {
  for (const value of ["2001:db8:1::30", "fe80::1", "fd00::1", "not-an-address", ""]) {
    assert.equal(selectBoundedMediaIpv6({
      ifconfigOutput: interfaceState,
      upnpOutput: value ? `Local LAN ip address : ${value}\n` : ""
    }), "");
  }
});

test("accepts an interface zone suffix without leaking it into the bind address", () => {
  const zoned = `  inet6 ${stable}%en0 prefixlen 64 autoconf secured\n`;
  assert.equal(selectBoundedMediaIpv6({
    ifconfigOutput: zoned,
    upnpOutput: `Local LAN ip address : ${stable}%en0\n`
  }), stable);
});

test("uses an assigned stable global address for externally proved no-UPnP exposure", () => {
  assert.equal(selectBoundedMediaIpv6WithoutUpnp(interfaceState), stable);
  assert.equal(selectBoundedMediaIpv6WithoutUpnp(
    `  inet6 ${temporary} prefixlen 64 autoconf temporary\n`), temporary);
  assert.equal(selectBoundedMediaIpv6WithoutUpnp(
    "  inet6 fe80::1%en0 prefixlen 64 secured scopeid 0x7\n"), "");
});

test("discovers the router IPv6 firewall service without trusting a public control endpoint", () => {
  const descriptionUrl = upnpDeviceDescriptionUrl(`desc: http://192.168.1.1:1900/rootDesc.xml\n`);
  assert.equal(descriptionUrl, "http://192.168.1.1:1900/rootDesc.xml");
  assert.equal(upnpDeviceDescriptionUrl("desc: https://example.com/rootDesc.xml\n"), "");
  const description = `<root><device><serviceList><service>` +
    `<serviceType>${wanIpv6FirewallServiceType}</serviceType>` +
    `<controlURL>/ctl/IP6FCtl</controlURL></service></serviceList></device></root>`;
  assert.deepEqual(wanIpv6FirewallControl(description, descriptionUrl), {
    serviceType: wanIpv6FirewallServiceType,
    controlUrl: "http://192.168.1.1:1900/ctl/IP6FCtl"
  });
  assert.equal(wanIpv6FirewallControl(description, "https://example.com/rootDesc.xml"), null);
});

test("builds and parses bounded IPv6 firewall SOAP messages", () => {
  const envelope = ipv6FirewallSoapEnvelope("AddPinhole", {
    RemoteHost: "", RemotePort: 0, InternalClient: stable, InternalPort: 18443,
    Protocol: 6, LeaseTime: 1200
  });
  assert.match(envelope, /<u:AddPinhole/);
  assert.match(envelope, /<InternalPort>18443<\/InternalPort>/);
  assert.match(envelope, /<LeaseTime>1200<\/LeaseTime>/);
  assert.deepEqual(parseIpv6FirewallStatus(
    "<FirewallEnabled>1</FirewallEnabled><InboundPinholeAllowed>1</InboundPinholeAllowed>"),
  { firewallEnabled: true, inboundPinholeAllowed: true });
  assert.equal(parseIpv6PinholeUniqueId("<UniqueID>42</UniqueID>"), 42);
  assert.equal(parseIpv6PinholeUniqueId("<UniqueID>70000</UniqueID>"), null);
  assert.equal(parseUpnpSoapErrorCode("<errorCode>701</errorCode>"), 701);
  assert.throws(() => ipv6FirewallSoapEnvelope("OpenEverything"), /ACTION_INVALID/);
});
