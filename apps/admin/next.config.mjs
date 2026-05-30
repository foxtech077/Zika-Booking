/** @type {import('next').NextConfig} */
const nextConfig = {
	basePath: "/admin",
	transpilePackages: ["@zika/types", "@zika/validators"],
	async redirects() {
		return [
			{
				source: "/",
				destination: "/admin",
				basePath: false,
				permanent: false,
			},
		];
	},
	async rewrites() {
		return [
			{
				source: "/api/:path*",
				destination: `${process.env.ADMIN_API_URL ?? "http://localhost:3001"}/:path*`,
			},
			{
				source: "/listing-api/:path*",
				destination: `${process.env.ADMIN_LISTING_API_URL ?? "http://localhost:3003"}/:path*`,
			},
		];
	},
};

export default nextConfig;
