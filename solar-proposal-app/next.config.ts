import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-pg",
    "pg",
    "bcryptjs",
    "sharp",
  ],
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
