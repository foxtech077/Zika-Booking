module.exports = {
	apps: [
		{
			name: "@zika-auth",
			script: "pnpm",
			args: "start",
			cwd: "/home/ubuntu/Zika-Booking/services/auth-service",
			interpreter: "none",
		},
		{
			name: "@zika-listing",
			script: "pnpm",
			args: "start",
			cwd: "/home/ubuntu/Zika-Booking/services/listing-service",
			interpreter: "none",
		},
		{
			name: "@zika-payment",
			script: "pnpm",
			args: "start",
			cwd: "/home/ubuntu/Zika-Booking/services/payment-service",
			interpreter: "none",
		},
		{
			name: "@zika-provider",
			script: "pnpm",
			args: "start",
			cwd: "/home/ubuntu/Zika-Booking/apps/provider",
			interpreter: "none",
		},
		{
			name: "@zika-admin",
			script: "pnpm",
			args: "start",
			cwd: "/home/ubuntu/Zika-Booking/apps/admin",
			interpreter: "none",
		},
		{
			name: "@zika-web",
			script: "pnpm",
			args: "start",
			cwd: "/home/ubuntu/Zika-Booking/apps/web",
			interpreter: "none",
		},
	],
};
