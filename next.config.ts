import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
   eslint: {
    ignoreDuringBuilds: true, // This tells Next.js to ignore ESLint during builds
  },
  images: {
    domains: [
      'lh3.googleusercontent.com', // Add this hostname for Google user avatars
      // Add any other external image domains you might use
    ],
  },
};

export default nextConfig;
