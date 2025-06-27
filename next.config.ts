import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  env: {
    CREATOR_USERNAME: process.env.CREATOR_USERNAME,
  },
};

export default nextConfig;
