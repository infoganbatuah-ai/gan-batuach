import { request as httpRequest } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { readFileSync } from "node:fs";
import { once } from "node:events";
import { isIP } from "node:net";
import { createPlaybackIngress, playbackIngressAllows } from "../../services/video-gateway/playback-ingress.mjs";

const args = new Map(process.argv.slice(2).map(value => {
  const [key, ...rest] = value.replace(/^--/, "").split("=");
  return [key, rest.join("=") || true];
}));
const hostnamePattern = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+ganbatuach\.com$/;
const gatewayHost = String(args.get("gateway-host") || "").toLowerCase();
const connectorHost = String(args.get("connector-host") || "").toLowerCase();
const port = Number(args.get("port") || 18443);
const bindAddress = String(args.get("bind-address") || "");
const keyPath = String(args.get("tls-key") || "");
const certPath = String(args.get("tls-cert") || "");
const browserOrigin = String(args.get("browser-origin") || "");
if (!hostnamePattern.test(gatewayHost) || !hostnamePattern.test(connectorHost) || gatewayHost === connectorHost)
  throw new Error("PUSH38_MEDIA_HOSTS_INVALID");
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("PUSH38_MEDIA_PORT_INVALID");
if (isIP(bindAddress) !== 6 || bindAddress === "::" || bindAddress.toLowerCase().startsWith("fe80:"))
  throw new Error("PUSH38_MEDIA_BIND_ADDRESS_INVALID");
if (!keyPath || !certPath) throw new Error("PUSH38_MEDIA_TLS_REQUIRED");
const browserUrl = new URL(browserOrigin);
if (browserUrl.protocol !== "https:" || browserUrl.username || browserUrl.password || browserUrl.pathname !== "/" ||
  browserUrl.search || browserUrl.hash || !hostnamePattern.test(browserUrl.hostname))
  throw new Error("PUSH38_MEDIA_BROWSER_ORIGIN_INVALID");
const loopbackOrigin = (raw, fallback) => {
  const value = new URL(String(raw || fallback));
  const originPort = Number(value.port);
  if (value.protocol !== "http:" || value.hostname !== "127.0.0.1" || value.username || value.password
    || value.pathname !== "/" || value.search || value.hash || !Number.isInteger(originPort)
    || originPort < 1024 || originPort > 65535) throw new Error("PUSH38_MEDIA_ORIGIN_INVALID");
  return value.origin;
};

const profiles = [
  { hostname: gatewayHost, profile: "PHYSICAL_GATEWAY",
    origin: loopbackOrigin(args.get("gateway-origin"), "http://127.0.0.1:18082") },
  { hostname: connectorHost, profile: "SOFTWARE_CONNECTOR",
    origin: loopbackOrigin(args.get("connector-origin"), "http://127.0.0.1:18083") }
];
for (const profile of profiles) {
  profile.ingress = createPlaybackIngress({ origin: profile.origin });
  profile.ingress.listen(0, "127.0.0.1");
  await once(profile.ingress, "listening");
  profile.ingressPort = profile.ingress.address().port;
}
const byHost = new Map(profiles.map(profile => [profile.hostname, profile]));
const front = createHttpsServer({
  key: readFileSync(keyPath),
  cert: readFileSync(certPath),
  minVersion: "TLSv1.2"
}, (request, response) => {
  const url = new URL(request.url || "/", "https://qualification.invalid");
  const rawHost = String(request.headers.host || "").toLowerCase();
  const hostname = rawHost.replace(new RegExp(`:${port}$`), "");
  const profile = byHost.get(hostname);
  if (!profile || !playbackIngressAllows(request.method, url.pathname, url.search)) {
    response.writeHead(404, { "cache-control": "no-store" }).end();
    return;
  }
  const headers = {};
  for (const key of ["origin", "content-type", "access-control-request-method", "access-control-request-headers"])
    if (typeof request.headers[key] === "string") headers[key] = request.headers[key];
  const direct = String(request.socket.remoteAddress || "");
  if (isIP(direct)) headers["x-forwarded-for"] = direct;
  const upstream = httpRequest({
    hostname: "127.0.0.1",
    port: profile.ingressPort,
    method: request.method,
    path: `${url.pathname}${url.search}`,
    headers
  }, upstreamResponse => {
    const responseHeaders = { ...upstreamResponse.headers };
    if (String(request.headers.origin || "").replace(/\/$/, "") === browserUrl.origin) {
      responseHeaders["access-control-allow-origin"] = browserUrl.origin;
      responseHeaders.vary = "Origin";
    }
    response.writeHead(upstreamResponse.statusCode || 502, responseHeaders);
    upstreamResponse.pipe(response);
  });
  upstream.setTimeout(30_000, () => upstream.destroy(new Error("PUSH38_MEDIA_UPSTREAM_TIMEOUT")));
  upstream.on("error", () => {
    if (!response.headersSent) response.writeHead(502, { "cache-control": "no-store" }).end();
    else response.destroy();
  });
  request.pipe(upstream);
});
front.on("tlsClientError", () => {});
front.listen({ port, host: bindAddress, ipv6Only: true });
await once(front, "listening");
process.stdout.write(`${JSON.stringify({
  contract: "observer-push38-https-playback-ingress-v1",
  bind: `[${bindAddress === "::1" ? "loopback" : "configured-ipv6"}]:${port}`,
  hosts: profiles.map(({ hostname, profile }) => ({ hostname, profile })),
  browser_origin: browserUrl.origin,
  exposed_routes: ["POST /playback/claim", "GET /hls/{stream}/index.m3u8", "GET /hls/{stream}/segment-{n}.ts"],
  default_deny: true,
  rate_limited: true,
  tls_minimum: "TLSv1.2",
  recurring_cost_introduced: false
})}\n`);

const close = async () => {
  front.close();
  for (const profile of profiles) profile.ingress.close();
  await Promise.all([once(front, "close"), ...profiles.map(profile => once(profile.ingress, "close"))]);
};
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => close().finally(() => process.exit(0)));
