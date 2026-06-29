import { Suspense } from "react";
import WishlistClient from "./WishlistClient";

export const metadata = { title: "My Wishlist — Kainook" };

export default function WishlistPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
          <div className="animate-spin h-10 w-10 border-4 border-[#1D8D2B] border-t-transparent rounded-full" />
        </div>
      }
    >
      <WishlistClient />
    </Suspense>
  );
}
