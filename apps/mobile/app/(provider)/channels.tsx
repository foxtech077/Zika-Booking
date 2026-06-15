import { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  Clipboard,
  Share,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listingApi } from "../../lib/listing-api";
import { K } from "../../constants/theme";
import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

// ── Layout constants ───────────────────────────────────────────────────────────
const SCREEN_W = Dimensions.get("window").width;
// scroll padding (16×2) + card padding (16×2) = 64 consumed horizontally
const CELL_SIZE = Math.floor((SCREEN_W - 64) / 7) - 2;

// ── Calendar config ────────────────────────────────────────────────────────────
const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type DateStatus = "confirmed" | "held" | "blocked" | "available";

const DATE_CFG: Record<DateStatus, { bg: string; text: string; stripe: boolean; label: string }> = {
  confirmed: { bg: "#DCFCE7", text: "#16A34A", stripe: false, label: "Confirmed" },
  held:      { bg: "#FEF3C7", text: "#92400E", stripe: false, label: "Held" },
  blocked:   { bg: "#E2E8F0", text: "#64748B", stripe: true,  label: "External Block" },
  available: { bg: "#FFFFFF", text: K.colors.textDark, stripe: false, label: "Available" },
};

// ── Types ──────────────────────────────────────────────────────────────────────
interface ListingItem {
  id: string;
  name: string | null;
  category: "hotel" | "apartment" | "car";
  status: string;
  town: string | null;
  country: string | null;
}

interface IcalFeed {
  id: string;
  platform: string;
  feedUrl: string;
  isActive: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
  createdAt: string;
}

interface BlockedDateItem {
  id: string;
  type: "blocked" | "confirmed" | "held";
  startDate: string | null;
  endDate: string | null;
  summary: string;
  platform: string;
}

// ── Stripe pattern overlay (for external-block cells) ─────────────────────────
function StripePattern({ size }: { size: number }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute", left: 0, right: 0, top: 0, bottom: 0,
        overflow: "hidden",
        borderRadius: K.radius.sm - 2,
      }}
    >
      {[0.25, 0.5, 0.75].map((frac, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            left: size * frac - 1,
            top: -(size * 0.6),
            width: 1.5,
            height: size * 2.5,
            backgroundColor: "rgba(100,116,139,0.35)",
            transform: [{ rotate: "45deg" }],
          }}
        />
      ))}
    </View>
  );
}

// ── Single calendar date cell ──────────────────────────────────────────────────
function CalendarCell({ day, status, isToday }: { day: number; status: DateStatus; isToday: boolean }) {
  const cfg = DATE_CFG[status];
  return (
    <View
      style={[
        cs.cell,
        { backgroundColor: cfg.bg, width: CELL_SIZE, height: CELL_SIZE },
        isToday && cs.cellToday,
      ]}
    >
      {cfg.stripe && <StripePattern size={CELL_SIZE} />}
      <Text style={[cs.cellTxt, { color: isToday ? K.colors.accent : cfg.text }]}>
        {day}
      </Text>
    </View>
  );
}

// ── Monthly availability calendar ─────────────────────────────────────────────
function AvailabilityCalendar({ blockedDates }: { blockedDates: BlockedDateItem[] }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed

  const todayKey = now.toISOString().slice(0, 10);
  const pad2 = (n: number) => String(n).padStart(2, "0");

  // Expand all date ranges into a per-day lookup map
  const dateMap = useMemo(() => {
    const map: Record<string, "blocked" | "confirmed" | "held"> = {};
    for (const b of blockedDates) {
      if (!b.startDate) continue;
      const start = new Date(b.startDate + "T00:00:00");
      const end = b.endDate ? new Date(b.endDate + "T00:00:00") : new Date(start);
      const cursor = new Date(start);
      while (cursor <= end) {
        const key = cursor.toISOString().slice(0, 10);
        const existing = map[key];
        // Priority: confirmed > held > blocked
        if (!existing || b.type === "confirmed" || (b.type === "held" && existing === "blocked")) {
          map[key] = b.type;
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    return map;
  }, [blockedDates]);

  // Build week rows for the displayed month
  const weeks = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let offset = firstDay.getDay(); // 0 = Sun
    offset = offset === 0 ? 6 : offset - 1; // convert to Mon = 0
    const flat: (number | null)[] = Array(offset).fill(null);
    for (let d = 1; d <= daysInMonth; d++) flat.push(d);
    while (flat.length % 7 !== 0) flat.push(null);
    const rows: (number | null)[][] = [];
    for (let i = 0; i < flat.length; i += 7) rows.push(flat.slice(i, i + 7));
    return rows;
  }, [year, month]);

  const goPrev = () => {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  };
  const goNext = () => {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  };

  return (
    <View>
      {/* Month navigation */}
      <View style={cs.calNav}>
        <TouchableOpacity onPress={goPrev} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="chevron-left" size={20} color={K.colors.textMid} />
        </TouchableOpacity>
        <Text style={cs.calNavLabel}>{MONTH_NAMES[month]} {year}</Text>
        <TouchableOpacity onPress={goNext} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="chevron-right" size={20} color={K.colors.textMid} />
        </TouchableOpacity>
      </View>

      {/* Day-of-week headers */}
      <View style={cs.calRow}>
        {DAY_LABELS.map((label, i) => (
          <View key={i} style={{ width: CELL_SIZE, alignItems: "center" }}>
            <Text style={cs.calDayHdr}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Week rows */}
      {weeks.map((week, wi) => (
        <View key={wi} style={cs.calRow}>
          {week.map((day, di) => {
            if (day === null) {
              return <View key={`pad-${di}`} style={{ width: CELL_SIZE, height: CELL_SIZE }} />;
            }
            const dateKey = `${year}-${pad2(month + 1)}-${pad2(day)}`;
            const status: DateStatus = dateMap[dateKey] ?? "available";
            return (
              <CalendarCell key={dateKey} day={day} status={status} isToday={dateKey === todayKey} />
            );
          })}
        </View>
      ))}

      {/* Legend */}
      <View style={cs.legend}>
        {(["confirmed", "held", "blocked"] as const).map((t) => (
          <View key={t} style={cs.legendItem}>
            <View style={[cs.legendSwatch, { backgroundColor: DATE_CFG[t].bg }]}>
              {t === "blocked" && <StripePattern size={12} />}
            </View>
            <Text style={cs.legendLabel}>{DATE_CFG[t].label}</Text>
          </View>
        ))}
        <View style={cs.legendItem}>
          <View style={[cs.legendSwatch, cs.legendToday]} />
          <Text style={cs.legendLabel}>Today</Text>
        </View>
      </View>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function CalendarSyncScreen() {
  const queryClient = useQueryClient();

  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<"Airbnb" | "Booking.com">("Airbnb");
  const [externalUrl, setExternalUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [syncingFeedId, setSyncingFeedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // ── Queries ────────────────────────────────────────────────────────────────
  const listingsQ = useQuery<{ listings: ListingItem[]; total: number }>({
    queryKey: ["myListingsForChannels"],
    queryFn: async () => {
      const res = await listingApi.get<{ data: { listings: ListingItem[]; total: number } }>("/listings", {
        params: { limit: "50" },
      });
      return res.data.data;
    },
  });

  const feedsQ = useQuery<{ feeds: IcalFeed[] }>({
    queryKey: ["providerFeeds", selectedListingId],
    queryFn: async () => {
      if (!selectedListingId) return { feeds: [] };
      const res = await listingApi.get<{ data: { feeds: IcalFeed[] } }>(`/listings/${selectedListingId}/ical-feeds`);
      return res.data.data;
    },
    enabled: !!selectedListingId,
  });

  const blockedDatesQ = useQuery<{ blockedDates: BlockedDateItem[] }>({
    queryKey: ["providerBlockedDates", selectedListingId],
    queryFn: async () => {
      if (!selectedListingId) return { blockedDates: [] };
      const res = await listingApi.get<{ data: { blockedDates: BlockedDateItem[] } }>(
        `/listings/${selectedListingId}/blocked-dates`
      );
      return res.data.data;
    },
    enabled: !!selectedListingId,
  });

  // Default to first listing on load
  useEffect(() => {
    if (listingsQ.data?.listings && listingsQ.data.listings.length > 0 && !selectedListingId) {
      setSelectedListingId(listingsQ.data.listings[0].id);
    }
  }, [listingsQ.data, selectedListingId]);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const connectMutation = useMutation({
    mutationFn: async (args: { platform: string; feedUrl: string }) => {
      if (!selectedListingId) throw new Error("No property selected");
      const res = await listingApi.post(`/listings/${selectedListingId}/ical-feeds`, {
        platform: args.platform,
        feedUrl: args.feedUrl,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["providerFeeds", selectedListingId] });
      queryClient.invalidateQueries({ queryKey: ["providerBlockedDates", selectedListingId] });
      queryClient.invalidateQueries({ queryKey: ["providerListingsForSync"] });
      setExternalUrl("");
      Alert.alert("Channel Connected", "External calendar synchronization feed has been successfully linked!");
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error?.message ?? "Unable to connect feed.";
      Alert.alert("Link Failed", msg);
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (feedId: string) => {
      if (!selectedListingId) throw new Error("No property selected");
      const res = await listingApi.delete(`/listings/${selectedListingId}/ical-feeds/${feedId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["providerFeeds", selectedListingId] });
      queryClient.invalidateQueries({ queryKey: ["providerBlockedDates", selectedListingId] });
      queryClient.invalidateQueries({ queryKey: ["providerListingsForSync"] });
      Alert.alert("Channel Removed", "The calendar synchronization feed has been disconnected.");
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error?.message ?? "Unable to disconnect channel.";
      Alert.alert("Error", msg);
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (feedId: string) => {
      if (!selectedListingId) throw new Error("No property selected");
      const res = await listingApi.post(`/listings/${selectedListingId}/ical-feeds/${feedId}/sync`);
      return res.data;
    },
    onMutate: (feedId) => {
      setSyncingFeedId(feedId);
    },
    onSuccess: (res: any) => {
      setSyncingFeedId(null);
      queryClient.invalidateQueries({ queryKey: ["providerFeeds", selectedListingId] });
      queryClient.invalidateQueries({ queryKey: ["providerBlockedDates", selectedListingId] });
      queryClient.invalidateQueries({ queryKey: ["providerListingsForSync"] });
      if (res.data?.error) {
        Alert.alert("Sync Issues", `Sync finished with error: ${res.data.error}`);
      } else {
        const count = res.data?.synced ?? 0;
        Alert.alert("Sync Complete", `Successfully imported ${count} date blocks from your external channel.`);
      }
    },
    onError: (err: any) => {
      setSyncingFeedId(null);
      const msg = err.response?.data?.error?.message ?? "Synchronization failed.";
      Alert.alert("Sync Error", msg);
    },
  });

  // ── Handlers ───────────────────────────────────────────────────────────────
  const outboundUrl = selectedListingId
    ? `${listingApi.defaults.baseURL}/listings/${selectedListingId}/ical`
    : "";

  const handleCopy = () => {
    if (!outboundUrl) return;
    Clipboard.setString(outboundUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!outboundUrl) return;
    try {
      await Share.share({
        message: `Kainook Outbound Calendar Feed URL for ${activeListing?.name ?? "Listing"}: ${outboundUrl}`,
        url: outboundUrl,
      });
    } catch (e) {
      console.warn(e);
    }
  };

  const handleConnect = () => {
    if (!externalUrl.trim()) {
      Alert.alert("Input Required", "Please enter a valid external iCal calendar URL.");
      return;
    }
    if (!externalUrl.startsWith("http://") && !externalUrl.startsWith("https://")) {
      Alert.alert("Invalid URL", "Calendar link must begin with http:// or https://");
      return;
    }
    connectMutation.mutate({ platform: selectedPlatform, feedUrl: externalUrl.trim() });
  };

  const handleDisconnect = (feedId: string, platformName: string) => {
    Alert.alert(
      "Confirm Disconnect",
      `Are you sure you want to stop calendar synchronization with ${platformName}? All imported blocked dates from this feed will be unblocked.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Disconnect", style: "destructive", onPress: () => disconnectMutation.mutate(feedId) },
      ]
    );
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([
      listingsQ.refetch(),
      feedsQ.refetch(),
      blockedDatesQ.refetch(),
    ]);
    setRefreshing(false);
  };

  const formatLastSync = (iso: string | null) => {
    if (!iso) return "Never";
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // ── Derived data ───────────────────────────────────────────────────────────
  const feeds = feedsQ.data?.feeds ?? [];
  const activeListing = listingsQ.data?.listings.find((l) => l.id === selectedListingId);
  const airbnbFeed = feeds.find((f) => f.platform.toLowerCase() === "airbnb");
  const bookingFeed = feeds.find(
    (f) => f.platform.toLowerCase() === "booking.com" || f.platform.toLowerCase() === "booking"
  );
  const blockedDates = blockedDatesQ.data?.blockedDates ?? [];

  // Per-platform external block counts (type = "blocked" means from external feed)
  const airbnbBlockCount = blockedDates.filter(
    (d) => d.type === "blocked" && d.platform?.toLowerCase() === "airbnb"
  ).length;
  const bookingBlockCount = blockedDates.filter(
    (d) =>
      d.type === "blocked" &&
      (d.platform?.toLowerCase() === "booking.com" || d.platform?.toLowerCase() === "booking")
  ).length;

  const canGoBack = router.canGoBack();
  const isLoading = listingsQ.isLoading || feedsQ.isLoading;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <View style={st.container}>
        {/* ── Header ───────────────────────────────────────────────────────── */}
        <SafeAreaView edges={["top"]} style={st.header}>
          <View style={st.headerRow}>
            {canGoBack ? (
              <TouchableOpacity onPress={() => router.back()} style={st.backBtn}>
                <Feather name="chevron-left" size={24} color="#fff" />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 40 }} />
            )}
            <Text style={st.headerTitle}>Calendar Sync</Text>
            <View style={{ width: 40 }} />
          </View>
        </SafeAreaView>

        {isLoading ? (
          <View style={st.center}>
            <ActivityIndicator size="large" color={K.colors.accent} />
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={st.scroll}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={K.colors.accent}
                colors={[K.colors.accent]}
              />
            }
          >
            {/* ── Property Selector ──────────────────────────────────────── */}
            <View style={st.section}>
              <Text style={st.sectionLabel}>Select Property</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={st.listingScroll}
                contentContainerStyle={{ gap: 10, paddingRight: 20 }}
              >
                {listingsQ.data?.listings.map((l) => {
                  const isSelected = selectedListingId === l.id;
                  return (
                    <TouchableOpacity
                      key={l.id}
                      style={[st.listingCard, isSelected && st.listingCardActive]}
                      onPress={() => setSelectedListingId(l.id)}
                    >
                      <Feather
                        name={l.category === "car" ? "truck" : "home"}
                        size={14}
                        color={isSelected ? "#fff" : K.colors.textMid}
                      />
                      <Text style={[st.listingName, isSelected && st.listingNameActive]}>
                        {l.name ?? "Untitled Listing"}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {selectedListingId ? (
              <>
                {/* ── Availability Calendar ─────────────────────────────── */}
                <Text style={st.sectionLabel}>Availability Overview</Text>
                <View style={st.calCard}>
                  <View style={st.cardHead}>
                    <Ionicons name="calendar-outline" size={20} color={K.colors.accent} />
                    <Text style={st.cardTitle}>Monthly Calendar</Text>
                    {blockedDatesQ.isFetching && !refreshing && (
                      <ActivityIndicator
                        size="small"
                        color={K.colors.accent}
                        style={{ marginLeft: "auto" }}
                      />
                    )}
                  </View>
                  <AvailabilityCalendar blockedDates={blockedDates} />
                </View>

                {/* ── Kainook Outbound iCal Feed ────────────────────────── */}
                <View style={st.card}>
                  <View style={st.cardHead}>
                    <Ionicons name="link-outline" size={20} color={K.colors.accent} />
                    <Text style={st.cardTitle}>My Kainook Calendar Feed</Text>
                  </View>
                  <Text style={st.cardDesc}>
                    Use this URL in external platforms (Airbnb, Booking.com, Google) to sync confirmed Kainook bookings into their calendars.
                  </Text>
                  <View style={st.urlInputWrap}>
                    <Text style={st.urlText} numberOfLines={1} ellipsizeMode="middle">
                      {outboundUrl}
                    </Text>
                  </View>
                  <View style={st.actionRow}>
                    <TouchableOpacity
                      style={[st.actionBtn, copied && st.actionBtnSuccess]}
                      onPress={handleCopy}
                    >
                      <Feather name={copied ? "check" : "copy"} size={14} color="#fff" />
                      <Text style={st.actionBtnTxt}>{copied ? "Copied!" : "Copy URL"}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={st.shareBtn} onPress={handleShare}>
                      <Feather name="share-2" size={14} color={K.colors.accent} />
                      <Text style={st.shareBtnTxt}>Share Feed</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* ── Connected Sync Channels ───────────────────────────── */}
                <Text style={st.sectionLabel}>Connected Sync Channels</Text>

                {/* No-feeds empty state */}
                {feeds.length === 0 && (
                  <View style={st.noFeedsEmpty}>
                    <Feather name="link-2" size={32} color={K.colors.textMuted} />
                    <Text style={st.noFeedsTitle}>No Channels Connected</Text>
                    <Text style={st.noFeedsSub}>
                      Connect your Airbnb or Booking.com calendar below to automatically import blocked dates.
                    </Text>
                  </View>
                )}

                {/* Airbnb channel card */}
                <View style={st.channelCard}>
                  <View style={st.channelHead}>
                    <View style={st.channelInfo}>
                      <View style={[st.platformIcon, { backgroundColor: "#FF5A5F" }]}>
                        <Text style={st.platformIconTxt}>A</Text>
                      </View>
                      <View>
                        <Text style={st.channelName}>Airbnb Integration</Text>
                        <Text style={st.channelSub}>iCal Calendar Connection</Text>
                      </View>
                    </View>
                    <View
                      style={[
                        st.statusBadge,
                        { backgroundColor: airbnbFeed ? "#D1FAE5" : "#E2E8F0" },
                      ]}
                    >
                      <Text
                        style={[
                          st.statusBadgeTxt,
                          { color: airbnbFeed ? "#065F46" : "#64748B" },
                        ]}
                      >
                        {airbnbFeed ? "Connected" : "Disconnected"}
                      </Text>
                    </View>
                  </View>

                  {airbnbFeed ? (
                    <View style={st.channelBody}>
                      <View style={st.syncDetails}>
                        <View style={st.syncDetailRow}>
                          <Text style={st.syncDetailLbl}>Last Synchronization</Text>
                          <Text style={st.syncDetailVal}>{formatLastSync(airbnbFeed.lastSyncedAt)}</Text>
                        </View>
                        <View style={st.syncDetailRow}>
                          <Text style={st.syncDetailLbl}>Imported Blocks</Text>
                          <Text style={st.syncDetailVal}>{airbnbBlockCount} dates</Text>
                        </View>
                        <View style={st.syncDetailRow}>
                          <Text style={st.syncDetailLbl}>Sync Health</Text>
                          <Text
                            style={[
                              st.syncDetailVal,
                              {
                                color: airbnbFeed.lastError ? K.colors.error : K.colors.success,
                                fontWeight: "700",
                              },
                            ]}
                          >
                            {airbnbFeed.lastError ? "Action Required" : "Healthy ✓"}
                          </Text>
                        </View>
                        {airbnbFeed.lastError && (
                          <View style={st.errorBox}>
                            <Feather name="alert-triangle" size={12} color="#DC2626" />
                            <Text style={st.errorTxt}>{airbnbFeed.lastError}</Text>
                          </View>
                        )}
                      </View>
                      <View style={st.channelActions}>
                        <TouchableOpacity
                          style={[st.syncBtn, syncingFeedId !== null && { opacity: 0.7 }]}
                          onPress={() => syncMutation.mutate(airbnbFeed.id)}
                          disabled={syncingFeedId !== null}
                        >
                          {syncingFeedId === airbnbFeed.id ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <Feather name="refresh-cw" size={12} color="#fff" />
                              <Text style={st.syncBtnTxt}>Sync Now</Text>
                            </>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={st.disconnectBtn}
                          onPress={() => handleDisconnect(airbnbFeed.id, "Airbnb")}
                          disabled={syncingFeedId !== null}
                        >
                          <Feather name="trash-2" size={12} color="#EF4444" />
                          <Text style={st.disconnectBtnTxt}>Disconnect</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={st.channelEmpty}>
                      <Text style={st.channelEmptyTxt}>
                        Airbnb is not currently synced with this listing.
                      </Text>
                    </View>
                  )}
                </View>

                {/* Booking.com channel card */}
                <View style={st.channelCard}>
                  <View style={st.channelHead}>
                    <View style={st.channelInfo}>
                      <View style={[st.platformIcon, { backgroundColor: "#003580" }]}>
                        <Text style={st.platformIconTxt}>B</Text>
                      </View>
                      <View>
                        <Text style={st.channelName}>Booking.com Integration</Text>
                        <Text style={st.channelSub}>iCal Calendar Connection</Text>
                      </View>
                    </View>
                    <View
                      style={[
                        st.statusBadge,
                        { backgroundColor: bookingFeed ? "#D1FAE5" : "#E2E8F0" },
                      ]}
                    >
                      <Text
                        style={[
                          st.statusBadgeTxt,
                          { color: bookingFeed ? "#065F46" : "#64748B" },
                        ]}
                      >
                        {bookingFeed ? "Connected" : "Disconnected"}
                      </Text>
                    </View>
                  </View>

                  {bookingFeed ? (
                    <View style={st.channelBody}>
                      <View style={st.syncDetails}>
                        <View style={st.syncDetailRow}>
                          <Text style={st.syncDetailLbl}>Last Synchronization</Text>
                          <Text style={st.syncDetailVal}>{formatLastSync(bookingFeed.lastSyncedAt)}</Text>
                        </View>
                        <View style={st.syncDetailRow}>
                          <Text style={st.syncDetailLbl}>Imported Blocks</Text>
                          <Text style={st.syncDetailVal}>{bookingBlockCount} dates</Text>
                        </View>
                        <View style={st.syncDetailRow}>
                          <Text style={st.syncDetailLbl}>Sync Health</Text>
                          <Text
                            style={[
                              st.syncDetailVal,
                              {
                                color: bookingFeed.lastError ? K.colors.error : K.colors.success,
                                fontWeight: "700",
                              },
                            ]}
                          >
                            {bookingFeed.lastError ? "Action Required" : "Healthy ✓"}
                          </Text>
                        </View>
                        {bookingFeed.lastError && (
                          <View style={st.errorBox}>
                            <Feather name="alert-triangle" size={12} color="#DC2626" />
                            <Text style={st.errorTxt}>{bookingFeed.lastError}</Text>
                          </View>
                        )}
                      </View>
                      <View style={st.channelActions}>
                        <TouchableOpacity
                          style={[st.syncBtn, syncingFeedId !== null && { opacity: 0.7 }]}
                          onPress={() => syncMutation.mutate(bookingFeed.id)}
                          disabled={syncingFeedId !== null}
                        >
                          {syncingFeedId === bookingFeed.id ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <Feather name="refresh-cw" size={12} color="#fff" />
                              <Text style={st.syncBtnTxt}>Sync Now</Text>
                            </>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={st.disconnectBtn}
                          onPress={() => handleDisconnect(bookingFeed.id, "Booking.com")}
                          disabled={syncingFeedId !== null}
                        >
                          <Feather name="trash-2" size={12} color="#EF4444" />
                          <Text style={st.disconnectBtnTxt}>Disconnect</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={st.channelEmpty}>
                      <Text style={st.channelEmptyTxt}>
                        Booking.com is not currently synced with this listing.
                      </Text>
                    </View>
                  )}
                </View>

                {/* ── Add New Sync Channel ──────────────────────────────── */}
                <View style={st.card}>
                  <View style={st.cardHead}>
                    <Ionicons name="add-circle-outline" size={20} color={K.colors.accent} />
                    <Text style={st.cardTitle}>Add Sync Channel</Text>
                  </View>
                  <Text style={st.cardDesc}>
                    Import calendar blocks from Airbnb or Booking.com by connecting their export feed URL.
                  </Text>

                  {/* Platform selector */}
                  <View style={st.formGroup}>
                    <Text style={st.inputLabel}>Channel Type</Text>
                    <View style={st.selectorRow}>
                      <TouchableOpacity
                        style={[st.selectorItem, selectedPlatform === "Airbnb" && st.selectorItemActive]}
                        onPress={() => setSelectedPlatform("Airbnb")}
                      >
                        <Text style={[st.selectorTxt, selectedPlatform === "Airbnb" && st.selectorTxtActive]}>
                          Airbnb
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          st.selectorItem,
                          selectedPlatform === "Booking.com" && st.selectorItemActive,
                        ]}
                        onPress={() => setSelectedPlatform("Booking.com")}
                      >
                        <Text
                          style={[
                            st.selectorTxt,
                            selectedPlatform === "Booking.com" && st.selectorTxtActive,
                          ]}
                        >
                          Booking.com
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* iCal URL input */}
                  <View style={st.formGroup}>
                    <Text style={st.inputLabel}>External iCal Calendar URL</Text>
                    <TextInput
                      style={st.textInput}
                      placeholder="https://www.airbnb.com/calendar/export/..."
                      placeholderTextColor="#94A3B8"
                      value={externalUrl}
                      onChangeText={setExternalUrl}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>

                  <TouchableOpacity
                    style={[st.connectBtn, connectMutation.isPending && { opacity: 0.7 }]}
                    onPress={handleConnect}
                    disabled={connectMutation.isPending}
                  >
                    {connectMutation.isPending ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Feather name="plus" size={16} color="#fff" />
                        <Text style={st.connectBtnTxt}>Link Channel</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {/* ── Sync History & Error Logs ─────────────────────────── */}
                <View style={st.card}>
                  <View style={st.cardHead}>
                    <Feather name="activity" size={18} color={K.colors.accent} />
                    <Text style={st.cardTitle}>Sync History & Logs</Text>
                  </View>

                  {feeds.length === 0 ? (
                    <Text style={st.logsEmpty}>No calendar feeds linked to this listing yet.</Text>
                  ) : (
                    feeds.map((feed) => (
                      <View key={feed.id} style={st.logRow}>
                        <View style={st.logMeta}>
                          <View style={st.logMetaLeft}>
                            <View
                              style={[
                                st.logDot,
                                { backgroundColor: feed.lastError ? K.colors.error : K.colors.success },
                              ]}
                            />
                            <Text style={st.logPlatform}>{feed.platform}</Text>
                          </View>
                          <Text style={st.logTime}>
                            {feed.lastSyncedAt
                              ? new Date(feed.lastSyncedAt).toLocaleTimeString()
                              : "Never synced"}
                          </Text>
                        </View>
                        {feed.lastError ? (
                          <View style={st.logErrorBox}>
                            <Text style={st.logErrorTitle}>Sync Issue Detected:</Text>
                            <Text style={st.logErrorText}>{feed.lastError}</Text>
                            <Text style={st.logErrorHint}>
                              Verify the iCal URL matches exactly and try syncing again.
                            </Text>
                          </View>
                        ) : (
                          <Text style={st.logSuccessText}>
                            Synchronization successful. Imported dates are locked.
                          </Text>
                        )}
                      </View>
                    ))
                  )}
                </View>
              </>
            ) : (
              /* No listing selected */
              <View style={st.emptyState}>
                <Feather name="alert-circle" size={48} color={K.colors.textMuted} />
                <Text style={st.emptyStateTitle}>No Property Selected</Text>
                <Text style={st.emptyStateSub}>
                  Please create a listing first to manage calendar sync settings.
                </Text>
              </View>
            )}
            <View style={{ height: 100 }} />
          </ScrollView>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Calendar-specific styles (separate object to avoid naming conflicts) ────────
const cs = StyleSheet.create({
  cell: {
    borderRadius: K.radius.sm,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  cellToday: {
    borderWidth: 2,
    borderColor: K.colors.accent,
  },
  cellTxt: {
    fontSize: 11,
    fontWeight: "600",
    zIndex: 1,
  },
  calNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  calNavLabel: {
    fontSize: K.font.base,
    fontWeight: "700",
    color: K.colors.textDark,
  },
  calRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  calDayHdr: {
    fontSize: 10,
    fontWeight: "700",
    color: K.colors.textMuted,
    textAlign: "center",
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: K.colors.border,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
    overflow: "hidden",
  },
  legendToday: {
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: K.colors.accent,
  },
  legendLabel: {
    fontSize: 10,
    color: K.colors.textMuted,
    fontWeight: "600",
  },
});

// ── Main stylesheet ────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAF9",
  },
  header: {
    backgroundColor: K.colors.darkGreen,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: K.font.lg,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.3,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    padding: 16,
    gap: 16,
  },
  section: {
    marginBottom: 4,
  },
  sectionLabel: {
    fontSize: K.font.sm,
    fontWeight: "700",
    color: K.colors.textDark,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 4,
  },
  listingScroll: {
    flexDirection: "row",
  },
  listingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff",
    borderRadius: K.radius.full,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  listingCardActive: {
    backgroundColor: K.colors.darkGreenMid,
    borderColor: K.colors.darkGreenMid,
  },
  listingName: {
    fontSize: K.font.sm,
    fontWeight: "600",
    color: K.colors.textMid,
  },
  listingNameActive: {
    color: "#fff",
    fontWeight: "700",
  },
  // Calendar card (slightly different padding than generic card)
  calCard: {
    backgroundColor: "#fff",
    borderRadius: K.radius.xl,
    padding: 16,
    borderWidth: 1.5,
    borderColor: K.colors.border,
    gap: 12,
    ...K.shadow.sm,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: K.radius.xl,
    padding: 20,
    borderWidth: 1.5,
    borderColor: K.colors.border,
    gap: 14,
    ...K.shadow.sm,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cardTitle: {
    fontSize: K.font.base,
    fontWeight: "700",
    color: K.colors.textDark,
  },
  cardDesc: {
    fontSize: 12,
    color: K.colors.textMuted,
    lineHeight: 18,
  },
  urlInputWrap: {
    backgroundColor: "#F1F5F9",
    borderRadius: K.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  urlText: {
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    color: K.colors.textMid,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: K.colors.accent,
    borderRadius: K.radius.md,
    paddingVertical: 11,
  },
  actionBtnSuccess: {
    backgroundColor: "#10B981",
  },
  actionBtnTxt: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
  shareBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1.5,
    borderColor: K.colors.accent,
    borderRadius: K.radius.md,
    paddingVertical: 10,
  },
  shareBtnTxt: {
    fontSize: 12,
    fontWeight: "700",
    color: K.colors.accent,
  },
  // No-feeds empty state
  noFeedsEmpty: {
    backgroundColor: "#F8FAF9",
    borderRadius: K.radius.xl,
    padding: 28,
    alignItems: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderStyle: "dashed",
  },
  noFeedsTitle: {
    fontSize: K.font.base,
    fontWeight: "700",
    color: K.colors.textDark,
    marginTop: 4,
  },
  noFeedsSub: {
    fontSize: 12,
    color: K.colors.textMuted,
    textAlign: "center",
    lineHeight: 18,
  },
  channelCard: {
    backgroundColor: "#fff",
    borderRadius: K.radius.xl,
    padding: 20,
    borderWidth: 1.5,
    borderColor: K.colors.border,
    ...K.shadow.sm,
  },
  channelHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  channelInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  platformIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  platformIconTxt: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
  channelName: {
    fontSize: K.font.base,
    fontWeight: "700",
    color: K.colors.textDark,
  },
  channelSub: {
    fontSize: 11,
    color: K.colors.textMuted,
    marginTop: 1,
  },
  statusBadge: {
    borderRadius: K.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusBadgeTxt: {
    fontSize: 10,
    fontWeight: "700",
  },
  channelBody: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: K.colors.border,
    paddingTop: 16,
    gap: 14,
  },
  syncDetails: {
    backgroundColor: "#F8FAF9",
    borderRadius: K.radius.md,
    padding: 12,
    gap: 8,
  },
  syncDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  syncDetailLbl: {
    fontSize: 11,
    color: K.colors.textMuted,
  },
  syncDetailVal: {
    fontSize: 11,
    fontWeight: "600",
    color: K.colors.textDark,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: "#FEF2F2",
    borderRadius: K.radius.sm,
    padding: 8,
    borderWidth: 1,
    borderColor: "#FEE2E2",
    marginTop: 2,
  },
  errorTxt: {
    flex: 1,
    fontSize: 11,
    color: "#B91C1C",
    lineHeight: 16,
  },
  channelActions: {
    flexDirection: "row",
    gap: 10,
  },
  syncBtn: {
    flex: 1.2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: K.colors.accent,
    borderRadius: K.radius.md,
    paddingVertical: 10,
  },
  syncBtnTxt: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  disconnectBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1.5,
    borderColor: "#FEE2E2",
    borderRadius: K.radius.md,
    paddingVertical: 9,
  },
  disconnectBtnTxt: {
    color: "#EF4444",
    fontSize: 12,
    fontWeight: "700",
  },
  channelEmpty: {
    marginTop: 12,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#F8FAF9",
    borderRadius: K.radius.md,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderStyle: "dashed",
  },
  channelEmptyTxt: {
    fontSize: 12,
    color: K.colors.textMuted,
  },
  formGroup: {
    gap: 6,
    width: "100%",
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: K.colors.textMid,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  selectorRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 2,
  },
  selectorItem: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    borderRadius: K.radius.md,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  selectorItemActive: {
    backgroundColor: "#fff",
    borderColor: K.colors.accent,
  },
  selectorTxt: {
    fontSize: 13,
    fontWeight: "600",
    color: K.colors.textMid,
  },
  selectorTxtActive: {
    color: K.colors.accent,
    fontWeight: "700",
  },
  textInput: {
    backgroundColor: "#F8FAF9",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: K.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: K.colors.textDark,
  },
  connectBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: K.colors.darkGreenMid,
    borderRadius: K.radius.md,
    paddingVertical: 12,
    marginTop: 4,
  },
  connectBtnTxt: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  logsEmpty: {
    fontSize: 12,
    color: K.colors.textMuted,
    textAlign: "center",
    paddingVertical: 12,
  },
  logRow: {
    borderBottomWidth: 1,
    borderBottomColor: K.colors.border,
    paddingVertical: 12,
    gap: 8,
  },
  logMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logMetaLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  logPlatform: {
    fontSize: 12,
    fontWeight: "700",
    color: K.colors.textDark,
  },
  logTime: {
    fontSize: 11,
    color: K.colors.textMuted,
  },
  logSuccessText: {
    fontSize: 11,
    color: "#10B981",
    lineHeight: 16,
  },
  logErrorBox: {
    backgroundColor: "#FEF2F2",
    borderRadius: K.radius.md,
    padding: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: "#FEE2E2",
  },
  logErrorTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#DC2626",
  },
  logErrorText: {
    fontSize: 11,
    color: "#B91C1C",
    lineHeight: 16,
  },
  logErrorHint: {
    fontSize: 10,
    color: "#991B1B",
    fontStyle: "italic",
    marginTop: 2,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 8,
  },
  emptyStateTitle: {
    fontSize: K.font.base,
    fontWeight: "700",
    color: K.colors.textDark,
  },
  emptyStateSub: {
    fontSize: 12,
    color: K.colors.textMuted,
    textAlign: "center",
  },
});
