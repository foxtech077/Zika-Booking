"use client";
import React, { useState, useEffect, useRef } from "react";
import { listingApi } from "@/lib/listing-api";

interface ListingImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  listingId?: string | null;
  fallbackNode?: React.ReactNode;
}

export default function ListingImage({ listingId, fallbackNode, className, alt, src, ...props }: ListingImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(src || null);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (src) {
      setImageUrl(src);
      setFailed(false);
      return;
    }
    
    if (!listingId) {
      setFailed(true);
      return;
    }
    let isMounted = true;
    listingApi.get(`/listings/${listingId}/public`)
      .then((res) => {
        if (!isMounted) return;
        const data = res.data?.data || res.data;
        const url =
          data?.primaryPhotoThumbUrl || data?.imageUrl || data?.primaryPhotoUrl ||
          data?.photos?.[0]?.thumbUrl || data?.photos?.[0]?.cdnUrl || data?.photos?.[0]?.url;
        if (url) {
          setImageUrl(url);
          setFailed(false);
        } else {
          setFailed(true);
        }
      })
      .catch(() => {
        if (isMounted) setFailed(true);
      });
    return () => { isMounted = false; };
  }, [listingId, src]);

  // Re-arm the skeleton on change. A cached image may already be decoded and
  // will not fire onLoad again, so settle that here too — one effect, so the
  // reset can never land after the check and strand the skeleton.
  useEffect(() => {
    setLoaded(imgRef.current?.complete === true);
  }, [imageUrl]);

  if (failed) {
    if (fallbackNode) return <>{fallbackNode}</>;
    // Default fallback image if API fails and no fallbackNode provided
    return (
      <img
        src="https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400&q=80"
        alt={alt}
        className={className}
        {...props}
      />
    );
  }

  if (!imageUrl) {
    return <div className={`bg-slate-100 animate-pulse ${className}`} />;
  }

  return (
    // Skeleton is the <img>'s own background: an image with no bytes yet is
    // transparent, so it shows through and fills exactly the photo's box
    // without a wrapper that would break callers' sizing and hover classes.
    <img
      ref={imgRef}
      src={imageUrl}
      alt={alt}
      loading="lazy"
      decoding="async"
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
      {...props}
      className={`${className ?? ""}${loaded ? "" : " bg-slate-200 animate-pulse"}`}
    />
  );
}
