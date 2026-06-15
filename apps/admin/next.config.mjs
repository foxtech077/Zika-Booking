const authApiUrl = process.env.ADMIN_API_URL ?? "http://localhost:3001";

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
<<<<<<< HEAD
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
=======
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
>>>>>>> 25f4b9c698d379b7b945cf1379909920033c67b3
};

export default nextConfig;
