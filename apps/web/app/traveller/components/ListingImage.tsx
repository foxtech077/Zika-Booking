"use client";
import React, { useState, useEffect } from "react";
import { listingApi } from "@/lib/listing-api";

interface ListingImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  listingId?: string | null;
  fallbackNode?: React.ReactNode;
}

export default function ListingImage({ listingId, fallbackNode, className, alt, ...props }: ListingImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(props.src || null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (props.src) {
      setImageUrl(props.src);
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
        const url = data?.imageUrl || data?.primaryPhotoUrl || data?.photos?.[0]?.cdnUrl || data?.photos?.[0]?.url;
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
  }, [listingId]);

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
    <img 
      src={imageUrl} 
      alt={alt} 
      className={className} 
      onError={() => setFailed(true)} 
      {...props} 
    />
  );
}
