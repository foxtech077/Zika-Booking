"use client";
import React from "react";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
}

const sizeClasses: Record<string, string> = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-10 w-10",
};

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = "lg" }) => (
  <div className="flex items-center justify-center">
    <div className={`animate-spin border-4 border-[#0B1E3F] border-t-transparent rounded-full ${sizeClasses[size]}`} />
  </div>
);

export default LoadingSpinner;
