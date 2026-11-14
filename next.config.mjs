import { hostname } from 'node:os';

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  env: {
    NEXT_PUBLIC_CLERK_TELEMETRY_DISABLED: "1",
  },
  reactStrictMode:false,
  images:{
    remotePatterns:[
      {
        protocol:"https",
        hostname:"randomuser.me"
      }
    ]
  },
  allowedDevOrigins: ["10.203.209.127"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
