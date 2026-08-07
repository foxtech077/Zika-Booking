/** @type {import('next').NextConfig} */
const nextConfig = {
  // React StrictMode double-mounts refs/effects in dev, which trips react-leaflet
  // v4's ref-callback map init ("Map container is already initialized"). The app
  // is pinned to React 18, so react-leaflet v5 (React 19 only) is not an option;
  // disabling StrictMode is the reliable fix. Production is unaffected.
  reactStrictMode: false,
  transpilePackages: ["@zika/types", "@zika/validators"],
  // async rewrites() {
  //   return [
  //     {
  //       source: "/api/:path*",
  //       destination: `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/:path*`,
  //     },
  //     {
  //       source: "/listing-api/:path*",
  //       destination: `${process.env.NEXT_PUBLIC_LISTING_API_URL ?? "http://localhost:3003"}/:path*`,
  //     },
  //     {
  //       source: "/payment-api/:path*",
  //       destination: `${process.env.NEXT_PUBLIC_PAYMENT_API_URL ?? "http://localhost:3004"}/:path*`,
  //     },
  //   ];
  // },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: process.env.S3_CDN_BASE_URL
          ? new URL(process.env.S3_CDN_BASE_URL).hostname
          : "zika-storage.s3.af-south-1.amazonaws.com",
      },
      {
        protocol: "http",
        hostname: "localhost",
      },
    ],
  },
};

export default nextConfig;
