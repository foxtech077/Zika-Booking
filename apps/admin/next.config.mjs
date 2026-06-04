const authApiUrl = (process.env.ADMIN_API_URL ?? "http://localhost:3001")
	.replace(/\/(auth|admin)\/?$/, "");

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
				destination: `${authApiUrl}/:path*`,
				basePath: false,
			},
			{
				source: "/listing-api/:path*",
				destination: `${process.env.ADMIN_LISTING_API_URL ?? "http://localhost:3003"}/:path*`,
				basePath: false,
			},
			{
				source: "/payment-api/:path*",
				destination: `${process.env.ADMIN_PAYMENT_API_URL ?? "http://localhost:3004"}/:path*`,
				basePath: false,
			},
		];
	},
};

export default nextConfig;
