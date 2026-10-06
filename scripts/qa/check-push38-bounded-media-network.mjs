import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assignedGlobalIpv6Addresses,
  selectBoundedMediaIpv6,
  selectBoundedMediaIpv6WithoutUpnp,
  upnpLocalLanIpv6
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
