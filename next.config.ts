import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  images: {
    domains: [
      'lh3.googleusercontent.com', // Add this hostname for Google user avatars
      // Add any other external image domains you might use
    ],
  },
};

export default nextConfig;
