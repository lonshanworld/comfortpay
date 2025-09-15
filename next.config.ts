import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
 typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",  // accept from any domain
      },
    ],
    dangerouslyAllowSVG: true,
    unoptimized: process.env.NODE_ENV === "development",
  },
  // compiler: {
  //  removeConsole: {
  //     exclude: ['error'],
  //   },
  // },

  
  // async headers()
  //   return [
  //     {
  //       source: "/(.*)",
  //       headers: [
  //         {
  //           key: "Content-Security-Policy",
  //           value: "default-src 'self'; script-src 'none'; sandbox;",
  //         },
  //       ],
  //     },
  //   ];
  // },
};

export default nextConfig;
