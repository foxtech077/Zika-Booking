import { Stack } from "expo-router";

export default function ListingsLayout() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="index" options={{ title: "My Listings" }} />
      <Stack.Screen name="new" options={{ title: "New Listing", headerShown: false }} />
      <Stack.Screen name="hotel" options={{ title: "Hotel Listing", headerShown: false }} />
      <Stack.Screen name="apartment" options={{ title: "Apartment Listing", headerShown: false }} />
      <Stack.Screen name="car" options={{ title: "Vehicle Listing", headerShown: false }} />
      <Stack.Screen name="[id]/index" options={{ title: "Edit Listing", headerShown: false }} />
      <Stack.Screen name="[id]/view" options={{ title: "Listing Details", headerShown: false }} />
      <Stack.Screen name="[id]/submit" options={{ title: "Review & Submit" }} />
      <Stack.Screen name="[id]/success" options={{ title: "Submitted", headerShown: false }} />
    </Stack>
  );
}
