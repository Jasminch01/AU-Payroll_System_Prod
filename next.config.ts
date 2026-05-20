import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Compress all HTTP responses (gzip/brotli) — reduces payload size significantly
  compress: true,

  // React strict mode — catches double-render bugs and deprecated APIs early
  reactStrictMode: true,

  // Image optimisation — serve modern formats to supported browsers
  images: {
    formats: ['image/avif', 'image/webp'],
  },

  // Compiler options — remove console.log in production builds
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
      ? { exclude: ['error', 'warn'] }
      : false,
  },
};

export default nextConfig;
