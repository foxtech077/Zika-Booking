/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@zika/types", "@zika/validators"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/:path*`,
      },
      {
        source: "/listing-api/:path*",
        destination: `${process.env.NEXT_PUBLIC_LISTING_API_URL ?? "http://localhost:3003"}/:path*`,
      },
    ];
  },
  images: {
    domains: ["zika-listings.s3.us-east-1.amazonaws.com", "localhost"],
  },
};

export default nextConfig;
