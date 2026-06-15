/** @type {import('next').NextConfig} */
const nextConfig = {
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
    // domains: ["zika-storage.s3.af-south-1.amazonaws.com", "localhost"],
    domains: [
      process.env.S3_CDN_BASE_URL 
        ? new URL(process.env.S3_CDN_BASE_URL).hostname 
        : "zika-storage.s3.af-south-1.amazonaws.com",
      "localhost"
    ],
  },
};

export default nextConfig;
