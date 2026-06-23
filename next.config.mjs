/** @type {import('next').NextConfig} */

// In dev, proxy API + health to the Rust backend so the browser sees a single
// origin (keeps the SameSite=Strict auth cookie working without CORS). In prod
// Nginx does this and API_PROXY is unused.
const API_PROXY = process.env.API_PROXY || "http://localhost:8090";

const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API_PROXY}/api/:path*` },
      { source: "/health", destination: `${API_PROXY}/health` },
    ];
  },
};

export default nextConfig;
