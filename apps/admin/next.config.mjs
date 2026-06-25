const authApiUrl = process.env.ADMIN_API_URL ?? "http://localhost:3001";


/** @type {import('next').NextConfig} */
const nextConfig = {
	basePath: "/admin",
	transpilePackages: ["@zika/types", "@zika/validators", "victory-vendor"],
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
	// async rewrites() {
	// 	return [
	// 		{
	// 			source: "/api/:path*",
	// 			destination: `${process.env.ADMIN_API_URL ?? "https://api.kainook.com/auth"}/:path*`,
	// 		},
	// 		{
	// 			source: "/listing-api/:path*",
	// 			destination: `${process.env.ADMIN_LISTING_API_URL ?? "https://api.kainook.com/listings"}/:path*`,
	// 		},
	// 	];
	// },
};

export default nextConfig;
