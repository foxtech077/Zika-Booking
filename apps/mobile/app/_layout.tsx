import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "../store/auth";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

// Per-screen header options — avoids JSX children that break with react-native-css-interop
const screenOptionsByName: Record<string, object> = {
  search:               { headerShown: true, title: "Search Results", headerBackTitle: "Back" },
  "book/[listingId]":   { headerShown: true, headerBackTitle: "Back" },
  "booking/[id]":       { headerShown: true, title: "Booking Details", headerBackTitle: "My Bookings" },
  "pay/[bookingId]":    { headerShown: true, title: "Complete Payment", headerBackTitle: "Back" },
  "review/[bookingId]": { headerShown: true, title: "Leave a Review", headerBackTitle: "Back" },
};

export default function RootLayout() {
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="auto" />
      <Stack
        screenOptions={({ route }) => ({
          headerShown: false,
          ...(screenOptionsByName[route.name] ?? {}),
        })}
      />
    </QueryClientProvider>
  );
}
