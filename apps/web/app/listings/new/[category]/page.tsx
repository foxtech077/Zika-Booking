use client;

import { useParams, useRouter, useEffect } from "next/navigation";
import ListingForm from "@/components/ListingForm";

export default function NewCategoryPage() {
  const router = useRouter();
  const params = useParams<{ category: string }>();
  const category = params?.category ?? "";

  // ── Auth guard ──
  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = sessionStorage.getItem("zika:access_token");
      if (!token) router.push("/login");
    }
  }, []);

  return <ListingForm mode="create" category={category} />;
}
