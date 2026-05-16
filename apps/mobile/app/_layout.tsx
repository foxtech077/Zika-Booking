import "../global.css";
import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "../store/auth";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

export default function RootLayout() {
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="search" options={{ headerShown: true, title: "Search Results", headerBackTitle: "Back" }} />
        <Stack.Screen name="listing/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="book/[listingId]" options={{ headerShown: true, headerBackTitle: "Back" }} />
        <Stack.Screen name="booking/[id]" options={{ headerShown: true, title: "Booking Details", headerBackTitle: "My Bookings" }} />
        <Stack.Screen name="pay/[bookingId]" options={{ headerShown: true, title: "Complete Payment", headerBackTitle: "Back" }} />
        <Stack.Screen name="review/[bookingId]" options={{ headerShown: true, title: "Leave a Review", headerBackTitle: "Back" }} />
      </Stack>
    </QueryClientProvider>
  );
}
