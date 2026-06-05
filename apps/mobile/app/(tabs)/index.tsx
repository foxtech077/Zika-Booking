import { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/auth";
import { listingApi } from "../../lib/listing-api";

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIMARY = "#1a73e8";
const TEXT = "#111827";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";
const BG = "#f9fafb";

const DAYS_OF_WEEK = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Category = "hotels" | "apartments" | "cars";

interface SearchForm {
  location: string;
  // hotels / apartments
  checkIn: Date | null;
  checkOut: Date | null;
  guests: number;
  // cars
  pickupDate: Date | null;
  pickupHour: number;
  pickupMinute: number;
  returnDate: Date | null;
  returnHour: number;
  returnMinute: number;
}

interface RecentListing {
  listingId: string;
  listing: {
    id: string;
    title: string;
    category: string;
    city: string;
    nightlyRate: number;
    currency: string;
    primaryPhotoUrl: string | null;
  };
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function formatDisplayDate(d: Date): string {
  return `${DAY_ABBR[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
}

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toLocalISOString(d: Date, hour: number, minute: number): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(hour).padStart(2, "0");
  const min = String(minute).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}:00.000Z`;
}

// ─── DatePickerModal ──────────────────────────────────────────────────────────

interface DatePickerModalProps {
  visible: boolean;
  title: string;
  selectedDate: Date | null;
  minDate?: Date | null;
  onSelect: (d: Date) => void;
  onClose: () => void;
  /** cars mode: show time picker after date selection */
  showTime?: boolean;
  selectedHour?: number;
  selectedMinute?: number;
  onTimeChange?: (hour: number, minute: number) => void;
}

const HOUR_OPTIONS = [0, 6, 9, 12, 15, 18, 21];
const MINUTE_OPTIONS = [0, 30];

function DatePickerModal({
  visible,
  title,
  selectedDate,
  minDate,
  onSelect,
  onClose,
  showTime = false,
  selectedHour = 0,
  selectedMinute = 0,
  onTimeChange,
}: DatePickerModalProps) {
  const today = new Date();
  const initialMonth = selectedDate ?? minDate ?? today;
  const [viewYear, setViewYear] = useState(initialMonth.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialMonth.getMonth());
  const [pickedDate, setPickedDate] = useState<Date | null>(selectedDate);
  const [localHour, setLocalHour] = useState(selectedHour);
  const [localMinute, setLocalMinute] = useState(selectedMinute);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }

  function buildCalendarDays(): (number | null)[] {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    // pad to 42 cells (6 rows)
    while (cells.length < 42) cells.push(null);
    return cells;
  }

  function isDayDisabled(day: number): boolean {
    if (!minDate) return false;
    const d = new Date(viewYear, viewMonth, day);
    const min = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
    return d < min;
  }

  function isSelected(day: number): boolean {
    if (!pickedDate) return false;
    return pickedDate.getFullYear() === viewYear &&
      pickedDate.getMonth() === viewMonth &&
      pickedDate.getDate() === day;
  }

  function handleDayPress(day: number) {
    if (isDayDisabled(day)) return;
    const d = new Date(viewYear, viewMonth, day);
    setPickedDate(d);
  }

  function handleConfirm() {
    if (!pickedDate) return;
    onSelect(pickedDate);
    if (showTime && onTimeChange) onTimeChange(localHour, localMinute);
    onClose();
  }

  const days = buildCalendarDays();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={dpStyles.overlay}>
        <View style={dpStyles.sheet}>
          {/* Header */}
          <View style={dpStyles.header}>
            <Text style={dpStyles.headerTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={TEXT} />
            </TouchableOpacity>
          </View>

          {/* Month navigation */}
          <View style={dpStyles.monthNav}>
            <TouchableOpacity onPress={prevMonth} style={dpStyles.navArrow}>
              <Ionicons name="chevron-back" size={20} color={TEXT} />
            </TouchableOpacity>
            <Text style={dpStyles.monthLabel}>{MONTH_NAMES[viewMonth]} {viewYear}</Text>
            <TouchableOpacity onPress={nextMonth} style={dpStyles.navArrow}>
              <Ionicons name="chevron-forward" size={20} color={TEXT} />
            </TouchableOpacity>
          </View>

          {/* Day-of-week labels */}
          <View style={dpStyles.dowRow}>
            {DAYS_OF_WEEK.map((d) => (
              <Text key={d} style={dpStyles.dowLabel}>{d}</Text>
            ))}
          </View>

          {/* Calendar grid — 6 rows × 7 cols */}
          <View style={dpStyles.grid}>
            {days.map((day, idx) => {
              if (!day) return <View key={`empty-${idx}`} style={dpStyles.dayCell} />;
              const disabled = isDayDisabled(day);
              const selected = isSelected(day);
              return (
                <TouchableOpacity
                  key={`day-${day}`}
                  style={[dpStyles.dayCell, selected && dpStyles.dayCellSelected, disabled && dpStyles.dayCellDisabled]}
                  onPress={() => handleDayPress(day)}
                  disabled={disabled}
                >
                  <Text style={[dpStyles.dayText, selected && dpStyles.dayTextSelected, disabled && dpStyles.dayTextDisabled]}>
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Time picker (cars only) */}
          {showTime && pickedDate && (
            <View style={dpStyles.timeSection}>
              <Text style={dpStyles.timeLabel}>Time</Text>
              <View style={dpStyles.timeRow}>
                <Text style={dpStyles.timeUnit}>Hour:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={dpStyles.timeScroll}>
                  {HOUR_OPTIONS.map((h) => (
                    <TouchableOpacity
                      key={h}
                      style={[dpStyles.timeChip, localHour === h && dpStyles.timeChipSelected]}
                      onPress={() => setLocalHour(h)}
                    >
                      <Text style={[dpStyles.timeChipText, localHour === h && dpStyles.timeChipTextSelected]}>
                        {String(h).padStart(2, "0")}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={dpStyles.timeRow}>
                <Text style={dpStyles.timeUnit}>Min:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={dpStyles.timeScroll}>
                  {MINUTE_OPTIONS.map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[dpStyles.timeChip, localMinute === m && dpStyles.timeChipSelected]}
                      onPress={() => setLocalMinute(m)}
                    >
                      <Text style={[dpStyles.timeChipText, localMinute === m && dpStyles.timeChipTextSelected]}>
                        {String(m).padStart(2, "0")}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          )}

          {/* Confirm */}
          <TouchableOpacity
            style={[dpStyles.confirmBtn, !pickedDate && dpStyles.confirmBtnDisabled]}
            onPress={handleConfirm}
            disabled={!pickedDate}
          >
            <Text style={dpStyles.confirmBtnText}>Confirm</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const { width: SCREEN_W } = Dimensions.get("window");
const CELL_SIZE = Math.floor((SCREEN_W - 48) / 7);

const dpStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingBottom: 32, paddingTop: 20 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  headerTitle: { fontSize: 17, fontWeight: "700", color: TEXT },
  monthNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  navArrow: { padding: 8 },
  monthLabel: { fontSize: 16, fontWeight: "600", color: TEXT },
  dowRow: { flexDirection: "row", marginBottom: 4 },
  dowLabel: { width: CELL_SIZE, textAlign: "center", fontSize: 12, fontWeight: "600", color: MUTED },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: { width: CELL_SIZE, height: CELL_SIZE, alignItems: "center", justifyContent: "center", borderRadius: CELL_SIZE / 2 },
  dayCellSelected: { backgroundColor: PRIMARY },
  dayCellDisabled: { opacity: 0.3 },
  dayText: { fontSize: 14, color: TEXT },
  dayTextSelected: { color: "#fff", fontWeight: "700" },
  dayTextDisabled: { color: MUTED },
  timeSection: { marginTop: 16, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 12 },
  timeLabel: { fontSize: 14, fontWeight: "600", color: TEXT, marginBottom: 8 },
  timeRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  timeUnit: { fontSize: 13, color: MUTED, width: 36 },
  timeScroll: { flex: 1 },
  timeChip: { borderWidth: 1, borderColor: BORDER, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7, marginRight: 8 },
  timeChipSelected: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  timeChipText: { fontSize: 14, color: TEXT },
  timeChipTextSelected: { color: "#fff", fontWeight: "600" },
  confirmBtn: { marginTop: 20, backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  confirmBtnDisabled: { opacity: 0.45 },
  confirmBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const firstName = user?.firstName ?? "there";

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const [category, setCategory] = useState<Category>("hotels");
  const [form, setForm] = useState<SearchForm>({
    location: "",
    checkIn: null,
    checkOut: null,
    guests: 2,
    pickupDate: null,
    pickupHour: 9,
    pickupMinute: 0,
    returnDate: null,
    returnHour: 9,
    returnMinute: 0,
  });

  type ActivePicker =
    | "checkIn" | "checkOut"
    | "pickupDate" | "returnDate"
    | null;
  const [activePicker, setActivePicker] = useState<ActivePicker>(null);

  // ── Recently viewed ──
  const { data: recentData, isLoading: recentLoading } = useQuery({
    queryKey: ["recently-viewed"],
    queryFn: async () => {
      const res = await listingApi.get<{ data: { recentlyViewed: RecentListing[] } }>("/guests/me/recently-viewed");
      return res.data.data.recentlyViewed ?? [];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  // ── Validation & search ──
  const handleSearch = useCallback(() => {
    const loc = form.location.trim();
    if (!loc) {
      Alert.alert("Location required", "Please enter a city or destination.");
      return;
    }

    if (category === "hotels" || category === "apartments") {
      if (!form.checkIn || !form.checkOut) {
        Alert.alert("Dates required", "Please select check-in and check-out dates.");
        return;
      }
      if (form.checkOut <= form.checkIn) {
        Alert.alert("Invalid dates", "Check-out must be after check-in.");
        return;
      }
      router.push({
        pathname: "/search",
        params: {
          category: category === "hotels" ? "hotel" : "apartment",
          placeName: loc,
          checkIn: toYMD(form.checkIn),
          checkOut: toYMD(form.checkOut),
          guests: String(form.guests),
        },
      });
    } else {
      // cars
      if (!form.pickupDate || !form.returnDate) {
        Alert.alert("Dates required", "Please select pickup and return dates.");
        return;
      }
      const pickupDt = toLocalISOString(form.pickupDate, form.pickupHour, form.pickupMinute);
      const returnDt = toLocalISOString(form.returnDate, form.returnHour, form.returnMinute);
      if (returnDt <= pickupDt) {
        Alert.alert("Invalid dates", "Return must be after pickup.");
        return;
      }
      router.push({
        pathname: "/search",
        params: {
          category: "car",
          placeName: loc,
          pickupDatetime: pickupDt,
          returnDatetime: returnDt,
        },
      });
    }
  }, [form, category, router]);

  // ── Date picker helpers ──
  function openPicker(field: ActivePicker) {
    setActivePicker(field);
  }

  function getPickerProps(): DatePickerModalProps {
    const base = {
      visible: activePicker !== null,
      onClose: () => setActivePicker(null),
      onSelect: (_d: Date) => {},
      title: "",
      selectedDate: null as Date | null,
    };

    if (activePicker === "checkIn") {
      return {
        ...base,
        title: "Select check-in",
        selectedDate: form.checkIn,
        minDate: new Date(),
        onSelect: (d) => setForm((f) => ({ ...f, checkIn: d, checkOut: f.checkOut && f.checkOut <= d ? null : f.checkOut })),
      };
    }
    if (activePicker === "checkOut") {
      return {
        ...base,
        title: "Select check-out",
        selectedDate: form.checkOut,
        minDate: form.checkIn ? new Date(form.checkIn.getTime() + 86400000) : new Date(),
        onSelect: (d) => setForm((f) => ({ ...f, checkOut: d })),
      };
    }
    if (activePicker === "pickupDate") {
      return {
        ...base,
        title: "Select pickup date & time",
        selectedDate: form.pickupDate,
        minDate: new Date(),
        showTime: true,
        selectedHour: form.pickupHour,
        selectedMinute: form.pickupMinute,
        onSelect: (d) => setForm((f) => ({
          ...f,
          pickupDate: d,
          returnDate: f.returnDate && toYMD(f.returnDate) <= toYMD(d) ? null : f.returnDate,
        })),
        onTimeChange: (h, m) => setForm((f) => ({ ...f, pickupHour: h, pickupMinute: m })),
      };
    }
    if (activePicker === "returnDate") {
      const minReturn = form.pickupDate ? new Date(form.pickupDate.getTime() + 86400000) : new Date();
      return {
        ...base,
        title: "Select return date & time",
        selectedDate: form.returnDate,
        minDate: minReturn,
        showTime: true,
        selectedHour: form.returnHour,
        selectedMinute: form.returnMinute,
        onSelect: (d) => setForm((f) => ({ ...f, returnDate: d })),
        onTimeChange: (h, m) => setForm((f) => ({ ...f, returnHour: h, returnMinute: m })),
      };
    }
    return base;
  }

  const pickerProps = getPickerProps();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── App bar ── */}
        <View style={styles.appBar}>
          <View>
            <Text style={styles.brand}>ZikaBooking</Text>
            <Text style={styles.greeting}>{greeting}, {firstName}</Text>
          </View>
          <Ionicons name="person-circle-outline" size={36} color={PRIMARY} />
        </View>

        {/* ── Category selector ── */}
        <View style={styles.categoryRow}>
          {(["hotels", "apartments", "cars"] as Category[]).map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.categoryChip, category === cat && styles.categoryChipActive]}
              onPress={() => setCategory(cat)}
            >
              <Ionicons
                name={cat === "hotels" ? "business-outline" : cat === "apartments" ? "home-outline" : "car-outline"}
                size={15}
                color={category === cat ? PRIMARY : MUTED}
                style={styles.categoryIcon}
              />
              <Text style={[styles.categoryChipText, category === cat && styles.categoryChipTextActive]}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Search form card ── */}
        <View style={styles.formCard}>
          {/* Location */}
          <View style={styles.fieldRow}>
            <Ionicons name="location-outline" size={18} color={MUTED} style={styles.fieldIcon} />
            <TextInput
              style={styles.locationInput}
              placeholder={category === "cars" ? "Pickup location" : "Where are you going?"}
              placeholderTextColor={MUTED}
              value={form.location}
              onChangeText={(t) => setForm((f) => ({ ...f, location: t }))}
              returnKeyType="done"
            />
          </View>

          <View style={styles.divider} />

          {/* Hotels / Apartments form */}
          {(category === "hotels" || category === "apartments") && (
            <>
              <View style={styles.dateRow}>
                <TouchableOpacity style={styles.datePicker} onPress={() => openPicker("checkIn")}>
                  <Ionicons name="calendar-outline" size={16} color={MUTED} />
                  <View style={styles.dateTexts}>
                    <Text style={styles.datePickerLabel}>Check-in</Text>
                    <Text style={[styles.datePickerValue, !form.checkIn && styles.datePickerPlaceholder]}>
                      {form.checkIn ? formatDisplayDate(form.checkIn) : "Select date"}
                    </Text>
                  </View>
                </TouchableOpacity>

                <View style={styles.dateSep} />

                <TouchableOpacity style={styles.datePicker} onPress={() => openPicker("checkOut")}>
                  <Ionicons name="calendar-outline" size={16} color={MUTED} />
                  <View style={styles.dateTexts}>
                    <Text style={styles.datePickerLabel}>Check-out</Text>
                    <Text style={[styles.datePickerValue, !form.checkOut && styles.datePickerPlaceholder]}>
                      {form.checkOut ? formatDisplayDate(form.checkOut) : "Select date"}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              <View style={styles.divider} />

              {/* Guests stepper */}
              <View style={styles.guestRow}>
                <Ionicons name="people-outline" size={18} color={MUTED} />
                <Text style={styles.guestLabel}>Guests</Text>
                <View style={styles.stepper}>
                  <TouchableOpacity
                    style={[styles.stepperBtn, form.guests <= 1 && styles.stepperBtnDisabled]}
                    onPress={() => setForm((f) => ({ ...f, guests: Math.max(1, f.guests - 1) }))}
                    disabled={form.guests <= 1}
                  >
                    <Text style={styles.stepperBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.stepperValue}>{form.guests}</Text>
                  <TouchableOpacity
                    style={[styles.stepperBtn, form.guests >= 16 && styles.stepperBtnDisabled]}
                    onPress={() => setForm((f) => ({ ...f, guests: Math.min(16, f.guests + 1) }))}
                    disabled={form.guests >= 16}
                  >
                    <Text style={styles.stepperBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}

          {/* Cars form */}
          {category === "cars" && (
            <>
              <TouchableOpacity style={styles.dateRowSingle} onPress={() => openPicker("pickupDate")}>
                <Ionicons name="calendar-outline" size={16} color={MUTED} />
                <View style={styles.dateTexts}>
                  <Text style={styles.datePickerLabel}>Pickup date & time</Text>
                  <Text style={[styles.datePickerValue, !form.pickupDate && styles.datePickerPlaceholder]}>
                    {form.pickupDate
                      ? `${formatDisplayDate(form.pickupDate)} at ${String(form.pickupHour).padStart(2, "0")}:${String(form.pickupMinute).padStart(2, "0")}`
                      : "Select date & time"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={MUTED} />
              </TouchableOpacity>

              <View style={styles.divider} />

              <TouchableOpacity style={styles.dateRowSingle} onPress={() => openPicker("returnDate")}>
                <Ionicons name="calendar-outline" size={16} color={MUTED} />
                <View style={styles.dateTexts}>
                  <Text style={styles.datePickerLabel}>Return date & time</Text>
                  <Text style={[styles.datePickerValue, !form.returnDate && styles.datePickerPlaceholder]}>
                    {form.returnDate
                      ? `${formatDisplayDate(form.returnDate)} at ${String(form.returnHour).padStart(2, "0")}:${String(form.returnMinute).padStart(2, "0")}`
                      : "Select date & time"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={MUTED} />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* ── Search button ── */}
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} activeOpacity={0.85}>
          <Ionicons name="search" size={18} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.searchBtnText}>Search</Text>
        </TouchableOpacity>

        {/* ── Recently viewed ── */}
        {user && (
          <View style={styles.recentSection}>
            <Text style={styles.sectionTitle}>Recently viewed</Text>
            {recentLoading ? (
              <ActivityIndicator size="small" color={PRIMARY} style={{ marginTop: 12 }} />
            ) : !recentData || recentData.length === 0 ? (
              <View style={styles.emptyRecent}>
                <Ionicons name="time-outline" size={32} color={BORDER} />
                <Text style={styles.emptyRecentText}>No recent searches</Text>
                <Text style={styles.emptyRecentSub}>Listings you view will appear here.</Text>
              </View>
            ) : (
              <FlatList
                data={recentData}
                keyExtractor={(item) => item.listingId}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.recentList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.recentCard}
                    onPress={() => router.push(`/listing/${item.listing.id}`)}
                    activeOpacity={0.82}
                  >
                    {item.listing.primaryPhotoUrl ? (
                      <Image
                        source={{ uri: item.listing.primaryPhotoUrl }}
                        style={styles.recentCardPhoto}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={[styles.recentCardPhoto, styles.recentCardPhotoPlaceholder]} />
                    )}
                    <View style={styles.recentCardBody}>
                      <Text style={styles.recentCardTitle} numberOfLines={1}>{item.listing.title}</Text>
                      <Text style={styles.recentCardCity} numberOfLines={1}>{item.listing.city}</Text>
                      <Text style={styles.recentCardPrice}>
                        {item.listing.currency} {item.listing.nightlyRate?.toLocaleString()}/night
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        )}
      </ScrollView>

      {/* ── Date picker modal ── */}
      {activePicker && (
        <DatePickerModal
          {...pickerProps}
          visible={activePicker !== null}
          onClose={() => setActivePicker(null)}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },

  // App bar
  appBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  brand: { fontSize: 22, fontWeight: "800", color: PRIMARY, letterSpacing: -0.5 },
  greeting: { fontSize: 13, color: MUTED, marginTop: 2 },

  // Category chips
  categoryRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  categoryChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: BORDER,
    backgroundColor: "#fff",
  },
  categoryChipActive: { borderColor: PRIMARY, backgroundColor: "#eff6ff" },
  categoryIcon: { marginRight: 5 },
  categoryChipText: { fontSize: 13, fontWeight: "500", color: MUTED },
  categoryChipTextActive: { color: PRIMARY, fontWeight: "600" },

  // Form card
  formCard: {
    margin: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  fieldIcon: { marginRight: 10 },
  locationInput: { flex: 1, fontSize: 15, color: TEXT },
  divider: { height: 1, backgroundColor: BORDER, marginHorizontal: 16 },

  // Date row (hotels/apartments)
  dateRow: { flexDirection: "row", alignItems: "stretch" },
  datePicker: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  dateSep: { width: 1, backgroundColor: BORDER, marginVertical: 10 },
  dateTexts: { flex: 1 },
  datePickerLabel: { fontSize: 11, color: MUTED, fontWeight: "500", marginBottom: 2 },
  datePickerValue: { fontSize: 14, color: TEXT, fontWeight: "500" },
  datePickerPlaceholder: { color: MUTED, fontWeight: "400" },

  // Date row (cars — full width)
  dateRowSingle: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },

  // Guest stepper
  guestRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  guestLabel: { flex: 1, fontSize: 15, color: TEXT, fontWeight: "500" },
  stepper: { flexDirection: "row", alignItems: "center", gap: 14 },
  stepperBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperBtnDisabled: { backgroundColor: BORDER },
  stepperBtnText: { color: "#fff", fontSize: 20, fontWeight: "700", lineHeight: 24 },
  stepperValue: { fontSize: 18, fontWeight: "700", color: TEXT, minWidth: 28, textAlign: "center" },

  // Search button
  searchBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 16,
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 16,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  searchBtnText: { color: "#fff", fontSize: 17, fontWeight: "700" },

  // Recently viewed
  recentSection: { marginTop: 28, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: TEXT, marginBottom: 12 },
  recentList: { paddingRight: 16 },

  recentCard: {
    width: 160,
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    marginRight: 12,
    overflow: "hidden",
  },
  recentCardPhoto: { width: "100%", height: 110 },
  recentCardPhotoPlaceholder: { backgroundColor: "#e5e7eb" },
  recentCardBody: { padding: 10 },
  recentCardTitle: { fontSize: 13, fontWeight: "600", color: TEXT, marginBottom: 2 },
  recentCardCity: { fontSize: 12, color: MUTED, marginBottom: 4 },
  recentCardPrice: { fontSize: 12, color: PRIMARY, fontWeight: "600" },

  // Empty state
  emptyRecent: { alignItems: "center", paddingVertical: 28 },
  emptyRecentText: { fontSize: 15, fontWeight: "600", color: MUTED, marginTop: 10 },
  emptyRecentSub: { fontSize: 13, color: BORDER, marginTop: 4 },
});
