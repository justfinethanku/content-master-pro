import type { NextConfig } from "next";
import withPWAInit from "next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  // Empty turbopack config to acknowledge PWA uses webpack
  // PWA service worker generation requires webpack
  turbopack: {},
};

export default withPWA(nextConfig);
