import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@google-cloud/vision", "@google/genai"],
};

export default nextConfig;
