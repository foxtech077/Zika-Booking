import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Toaster } from "@/components/ui/Toast";
import { Poppins } from "next/font/google";

const poppins = Poppins({
  subsets: ["latin"],
  variable: "--font-poppins",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Kainook", template: "%s | Kainook" },
  description: "Book hotels, apartments, and car rentals worldwide.",
  metadataBase: new URL(process.env.WEB_BASE_URL ?? "http://localhost:3000"),
  icons: { icon: "/kainook-logo.jpeg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={poppins.variable}>
      <body className="antialiased bg-white text-gray-900 font-sans">
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}


