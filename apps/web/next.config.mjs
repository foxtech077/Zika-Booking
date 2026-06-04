/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@zika/types", "@zika/validators"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? "https://api.kainook.com"}/:path*`,
      },
      {
        source: "/listing-api/:path*",
        destination: `${process.env.NEXT_PUBLIC_LISTING_API_URL ?? "https://api.kainook.com/listings"}/:path*`,
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "zika-storage.s3.af-south-1.amazonaws.com" },
      { protocol: "https", hostname: "zika-listings.s3.us-east-1.amazonaws.com" },
      { protocol: "https", hostname: "*.s3.amazonaws.com" },
      { protocol: "https", hostname: "*.s3.*.amazonaws.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "http",  hostname: "localhost" },
    ],
  },
};

export default nextConfig;
