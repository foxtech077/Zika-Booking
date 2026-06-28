import { useState } from "react";
import { View, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../../store/auth";
import { listingApi } from "../../lib/listing-api";
import { AppHeader } from "./AppHeader";
import { BottomTabBar } from "./BottomTabBar";
import { BurgerDrawer } from "./BurgerDrawer";

interface Props {
  children: React.ReactNode;
}

export function AppLayout({ children }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const user = useAuthStore((s) => s.user);

  const { data } = useQuery<{ unreadMessages?: number }>({
    queryKey: ["providerDashboard"],
    queryFn: async () => {
      const res = await listingApi.get<{ data: any }>("/provider/dashboard");
      return res.data.data;
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  return (
    <View style={s.container}>
      <AppHeader
        onBurgerPress={() => setMenuOpen(true)}
        unreadCount={data?.unreadMessages ?? 0}
      />
      <View style={s.content}>{children}</View>
      <BottomTabBar />
      <BurgerDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F4F1" },
  content:   { flex: 1 },
});
