import { connect } from "node:tls";

const target = {
  host: "2606:4700:4700::1111",
  port: 443,
  servername: "cloudflare-dns.com",
  family: 6,
  rejectUnauthorized: true
};

const socket = connect(target);
const timeout = setTimeout(() => socket.destroy(new Error("REMOTE_CLIENT_IPV6_TIMEOUT")), 10_000);

socket.once("secureConnect", () => {
  clearTimeout(timeout);
  socket.end();
  console.log(JSON.stringify({
    status: "PASS",
    capability: "OUTBOUND_IPV6_TLS",
    client: "SEPARATE_GITHUB_HOSTED_RUNNER",
    edge_software_installed: false,
    address_logged: false
  }));
});

socket.once("error", error => {
  clearTimeout(timeout);
  console.error(JSON.stringify({
    status: "FAIL",
    capability: "OUTBOUND_IPV6_TLS",
    reason: String(error?.code || "REMOTE_CLIENT_IPV6_UNAVAILABLE")
  }));
  process.exitCode = 1;
});
