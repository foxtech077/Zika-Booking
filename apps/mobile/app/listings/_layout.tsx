import { Stack } from "expo-router";

export default function ListingsLayout() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="index" options={{ title: "My Listings" }} />
      <Stack.Screen name="new" options={{ title: "New Listing" }} />
      <Stack.Screen name="[id]/index" options={{ title: "Edit Listing" }} />
      <Stack.Screen name="[id]/submit" options={{ title: "Review & Submit" }} />
    </Stack>
  );
}
