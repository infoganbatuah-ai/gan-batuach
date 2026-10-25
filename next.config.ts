import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const qaDevHost = process.env.PUSH44_QA_DEV_ORIGIN_HOST;
if (qaDevHost && !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(qaDevHost)) {
  throw new Error("PUSH44_QA_DEV_ORIGIN_HOST must be one exact hostname");
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  ...(process.env.NODE_ENV === "development" && qaDevHost
    ? { allowedDevOrigins: [qaDevHost] }
    : {}),
  experimental: {
    serverActions: { bodySizeLimit: "6mb" }
  },
  turbopack: {
    root: process.cwd()
  }
};

export default withSentryConfig(nextConfig, {
  org: "gan-batuah",
  project: "javascript-nextjs",
  silent: !process.env.CI,
  telemetry: false,
  tunnelRoute: "/monitoring",
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
    deleteSourcemapsAfterUpload: true
  },
  webpack: {
    treeshake: {
      removeDebugLogging: true,
      excludeReplayIframe: true,
      excludeReplayShadowDOM: true,
      excludeReplayCompressionWorker: true
    }
  }
});
