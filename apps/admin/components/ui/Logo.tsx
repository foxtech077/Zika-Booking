import type { ImgHTMLAttributes } from "react";

interface LogoProps extends ImgHTMLAttributes<HTMLImageElement> {
  size?: number;
  variant?: "mark" | "full";
}

export function Logo({ size = 36, variant = "mark", className, ...props }: LogoProps) {
  // admin app uses a basePath of /admin (see apps/admin/next.config.mjs)
  const BASE = "/admin";
  // Use the exact original image already uploaded (URL-encoded filename)
  const WHATSAPP_IMG = "WhatsApp%20Image%202026-05-27%20at%2011.17.45%20AM.jpeg";
  const src = variant === "full"
    ? `${BASE}/${WHATSAPP_IMG}`
    : `${BASE}/${WHATSAPP_IMG}`;
  const alt = variant === "full" ? "Kainook logo" : "Kainook mark";
  const width = variant === "full" ? size * 7 : size;
  const height = variant === "full" ? size * 2.5 : size;

  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      {...props}
      style={{ display: "block", width, height }}
    />
  );
}
