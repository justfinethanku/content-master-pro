declare module "next-pwa" {
  import { NextConfig } from "next";

  interface PWAConfig {
    dest?: string;
    register?: boolean;
    skipWaiting?: boolean;
    disable?: boolean;
    sw?: string;
    scope?: string;
    runtimeCaching?: unknown[];
    buildExcludes?: unknown[];
    publicExcludes?: string[];
    fallbacks?: {
      document?: string;
      image?: string;
      audio?: string;
      video?: string;
      font?: string;
    };
    cacheOnFrontEndNav?: boolean;
    subdomainPrefix?: string;
    reloadOnOnline?: boolean;
    customWorkerDir?: string;
    customWorkerSrc?: string;
    workboxOptions?: unknown;
  }

  function withPWAInit(config: PWAConfig): (nextConfig: NextConfig) => NextConfig;

  export default withPWAInit;
}
