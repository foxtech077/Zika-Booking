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

// ── Constants ─────────────────────────────────────────────────────────────────

const { width: W } = Dimensions.get("window");
const GREEN = "#1B5E20";
const GREEN_MED = "#2E7D32";
const GREEN_LIGHT = "#F0FFF4";
const GREEN_BORDER = "#BBF7D0";
const TEXT = "#111827";
const MUTED = "#6B7280";
const BORDER = "#E5E7EB";
const BG = "#F9FAFB";

const DAYS_OF_WEEK = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_ABBR = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

type Category = "hotels" | "apartments" | "cars";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SearchResult {
  id: string;
  listingType: string;
  title: string;
  city: string;
  countryCode: string;
  distanceKm: number;
  primaryPhotoUrl: string | null;
  nightlyRate: number | null;
  dailyRate: number | null;
  currency: string;
  cancellationPolicy: string;
  starRating: number | null;
  isAccredited: boolean;
  roomType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  maxGuests: number | null;
  longStayDiscountEnabled?: boolean;
  carMake: string | null;
  carModel: string | null;
  carYear: number | null;
  transmission: string | null;
  seats: number | null;
  isFavourited: boolean;
}

interface SearchResponse {
  data: { totalCount: number; nextCursor: string | null; results: SearchResult[] };
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function toISO(d: Date, h: number, m: number): string {
  return `${toYMD(d)}T${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:00.000Z`;
}
function fmt(d: Date): string {
  return `${DAY_ABBR[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
}
function fmtPrice(n: number | null, currency: string): string {
  if (!n) return "";
  return `${currency} ${n.toLocaleString()}`;
}

// ── DatePicker Modal ──────────────────────────────────────────────────────────

const HOURS = [0,6,9,12,15,18,21];
const MINS = [0,30];

function DatePickerModal({
  visible, title, selectedDate, minDate, onSelect, onClose, showTime=false,
  selectedHour=0, selectedMinute=0, onTimeChange,
}: {
  visible: boolean; title: string; selectedDate: Date|null; minDate?: Date|null;
  onSelect: (d: Date) => void; onClose: () => void; showTime?: boolean;
  selectedHour?: number; selectedMinute?: number; onTimeChange?: (h:number,m:number) => void;
}) {
  const init = selectedDate ?? minDate ?? new Date();
  const [viewYear, setViewYear] = useState(init.getFullYear());
  const [viewMonth, setViewMonth] = useState(init.getMonth());
  const [picked, setPicked] = useState<Date|null>(selectedDate);
  const [lh, setLh] = useState(selectedHour);
  const [lm, setLm] = useState(selectedMinute);

  function prevMonth() { if (viewMonth===0){setViewMonth(11);setViewYear(y=>y-1);}else setViewMonth(m=>m-1); }
  function nextMonth() { if (viewMonth===11){setViewMonth(0);setViewYear(y=>y+1);}else setViewMonth(m=>m+1); }

  const firstDay = new Date(viewYear,viewMonth,1).getDay();
  const daysInMonth = new Date(viewYear,viewMonth+1,0).getDate();
  const cells: (number|null)[] = [];
  for (let i=0;i<firstDay;i++) cells.push(null);
  for (let d=1;d<=daysInMonth;d++) cells.push(d);
  while (cells.length<42) cells.push(null);

  function disabled(day: number) {
    if (!minDate) return false;
    return new Date(viewYear,viewMonth,day) < new Date(minDate.getFullYear(),minDate.getMonth(),minDate.getDate());
  }
  function selected(day: number) {
    return !!picked && picked.getFullYear()===viewYear && picked.getMonth()===viewMonth && picked.getDate()===day;
  }

  const CELL = Math.floor((W - 64) / 7);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={dp.overlay}>
        <View style={dp.sheet}>
          <View style={dp.header}>
            <Text style={dp.headerTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={TEXT} /></TouchableOpacity>
          </View>
          <View style={dp.monthNav}>
            <TouchableOpacity onPress={prevMonth} style={dp.navArrow}><Ionicons name="chevron-back" size={20} color={TEXT} /></TouchableOpacity>
            <Text style={dp.monthLabel}>{MONTH_NAMES[viewMonth]} {viewYear}</Text>
            <TouchableOpacity onPress={nextMonth} style={dp.navArrow}><Ionicons name="chevron-forward" size={20} color={TEXT} /></TouchableOpacity>
          </View>
          <View style={dp.dowRow}>
            {DAYS_OF_WEEK.map(d=><Text key={d} style={[dp.dowLabel,{width:CELL}]}>{d}</Text>)}
          </View>
          <View style={dp.grid}>
            {cells.map((day,idx)=>{
              if (!day) return <View key={`e${idx}`} style={{width:CELL,height:CELL}} />;
              const dis=disabled(day), sel=selected(day);
              return (
                <TouchableOpacity key={`d${day}`} style={[{width:CELL,height:CELL,alignItems:"center",justifyContent:"center",borderRadius:CELL/2}, sel&&{backgroundColor:GREEN}, dis&&{opacity:0.3}]}
                  onPress={()=>{ if(!dis) setPicked(new Date(viewYear,viewMonth,day)); }} disabled={dis}>
                  <Text style={{fontSize:14,color:sel?"#fff":TEXT,fontWeight:sel?"700":"400"}}>{day}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {showTime && picked && (
            <View style={dp.timeSection}>
              <Text style={dp.timeLabel}>Time</Text>
              <View style={dp.timeRow}>
                <Text style={dp.timeUnit}>Hour:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {HOURS.map(h=>(
                    <TouchableOpacity key={h} style={[dp.chip, lh===h&&dp.chipActive]} onPress={()=>setLh(h)}>
                      <Text style={[dp.chipText, lh===h&&dp.chipTextActive]}>{String(h).padStart(2,"0")}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={dp.timeRow}>
                <Text style={dp.timeUnit}>Min:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {MINS.map(m=>(
                    <TouchableOpacity key={m} style={[dp.chip, lm===m&&dp.chipActive]} onPress={()=>setLm(m)}>
                      <Text style={[dp.chipText, lm===m&&dp.chipTextActive]}>{String(m).padStart(2,"0")}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          )}
          <TouchableOpacity style={[dp.confirm, !picked&&dp.confirmDisabled]} disabled={!picked}
            onPress={()=>{ if(!picked) return; onSelect(picked); if(showTime&&onTimeChange) onTimeChange(lh,lm); onClose(); }}>
            <Text style={dp.confirmText}>Confirm</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const dp = StyleSheet.create({
  overlay:{flex:1,backgroundColor:"rgba(0,0,0,0.45)",justifyContent:"flex-end"},
  sheet:{backgroundColor:"#fff",borderTopLeftRadius:24,borderTopRightRadius:24,paddingHorizontal:16,paddingBottom:32,paddingTop:20},
  header:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:16},
  headerTitle:{fontSize:17,fontWeight:"700",color:TEXT},
  monthNav:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:12},
  navArrow:{padding:8},
  monthLabel:{fontSize:16,fontWeight:"600",color:TEXT},
  dowRow:{flexDirection:"row",marginBottom:4},
  dowLabel:{textAlign:"center",fontSize:12,fontWeight:"600",color:MUTED},
  grid:{flexDirection:"row",flexWrap:"wrap"},
  timeSection:{marginTop:14,borderTopWidth:1,borderTopColor:BORDER,paddingTop:12},
  timeLabel:{fontSize:14,fontWeight:"600",color:TEXT,marginBottom:8},
  timeRow:{flexDirection:"row",alignItems:"center",marginBottom:8},
  timeUnit:{fontSize:13,color:MUTED,width:36},
  chip:{borderWidth:1,borderColor:BORDER,borderRadius:8,paddingHorizontal:14,paddingVertical:7,marginRight:8},
  chipActive:{backgroundColor:GREEN,borderColor:GREEN},
  chipText:{fontSize:14,color:TEXT},
  chipTextActive:{color:"#fff",fontWeight:"600"},
  confirm:{marginTop:18,backgroundColor:GREEN,borderRadius:12,paddingVertical:14,alignItems:"center"},
  confirmDisabled:{opacity:0.4},
  confirmText:{color:"#fff",fontWeight:"700",fontSize:16},
});

// ── Listing Card (Horizontal) ─────────────────────────────────────────────────

function ListingCard({ item, onPress, width=200, badgeLabel, badgeColor }: {
  item: SearchResult; onPress: () => void; width?: number;
  badgeLabel?: string; badgeColor?: string;
}) {
  const isCar = item.listingType === "car";
  const rate = isCar ? item.dailyRate : item.nightlyRate;
  const unit = isCar ? "day" : "night";
  return (
    <TouchableOpacity style={[cards.card, { width }]} onPress={onPress} activeOpacity={0.85}>
      <View style={cards.photoWrap}>
        {item.primaryPhotoUrl
          ? <Image source={{ uri: item.primaryPhotoUrl }} style={cards.photo} resizeMode="cover" />
          : <View style={[cards.photo, { backgroundColor: "#D1FAE5" }]} />}
        {badgeLabel && (
          <View style={[cards.badge, { backgroundColor: badgeColor ?? GREEN }]}>
            <Text style={cards.badgeText}>{badgeLabel}</Text>
          </View>
        )}
        {item.starRating != null && item.starRating > 0 && (
          <View style={cards.ratingBadge}>
            <Ionicons name="star" size={10} color="#F59E0B" />
            <Text style={cards.ratingText}>{item.starRating}</Text>
          </View>
        )}
      </View>
      <View style={cards.body}>
        <Text style={cards.title} numberOfLines={1}>{item.title}</Text>
        <View style={cards.locationRow}>
          <Ionicons name="location-outline" size={11} color={MUTED} />
          <Text style={cards.location} numberOfLines={1}>
            {item.city}
            {item.distanceKm != null ? ` · ${item.distanceKm.toFixed(1)}km` : ""}
          </Text>
        </View>
        <Text style={cards.price}>
          {fmtPrice(rate, item.currency)}
          <Text style={cards.priceUnit}>/{unit}</Text>
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const cards = StyleSheet.create({
  card:{backgroundColor:"#fff",borderRadius:16,overflow:"hidden",borderWidth:1,borderColor:BORDER,
    shadowColor:"#000",shadowOffset:{width:0,height:2},shadowOpacity:0.06,shadowRadius:6,elevation:2},
  photoWrap:{position:"relative"},
  photo:{width:"100%",height:130},
  badge:{position:"absolute",top:10,left:10,borderRadius:20,paddingHorizontal:8,paddingVertical:4},
  badgeText:{color:"#fff",fontSize:10,fontWeight:"700"},
  ratingBadge:{position:"absolute",top:10,right:10,backgroundColor:"rgba(0,0,0,0.55)",
    borderRadius:10,paddingHorizontal:6,paddingVertical:3,flexDirection:"row",alignItems:"center",gap:3},
  ratingText:{color:"#fff",fontSize:11,fontWeight:"700"},
  body:{padding:10},
  title:{fontSize:13,fontWeight:"700",color:TEXT,marginBottom:3},
  locationRow:{flexDirection:"row",alignItems:"center",gap:3,marginBottom:5},
  location:{fontSize:11,color:MUTED,flex:1},
  price:{fontSize:14,fontWeight:"800",color:GREEN},
  priceUnit:{fontSize:10,fontWeight:"400",color:MUTED},
});

// ── Nearby Row Card ───────────────────────────────────────────────────────────

function NearbyCard({ item, onPress }: { item: SearchResult; onPress: () => void }) {
  const isCar = item.listingType === "car";
  const rate = isCar ? item.dailyRate : item.nightlyRate;
  return (
    <TouchableOpacity style={nearby.card} onPress={onPress} activeOpacity={0.85}>
      {item.primaryPhotoUrl
        ? <Image source={{ uri: item.primaryPhotoUrl }} style={nearby.photo} resizeMode="cover" />
        : <View style={[nearby.photo, { backgroundColor: "#D1FAE5" }]} />}
      <View style={nearby.info}>
        <Text style={nearby.title} numberOfLines={1}>{item.title}</Text>
        <View style={nearby.row}>
          <Ionicons name="location-outline" size={12} color={MUTED} />
          <Text style={nearby.loc}>{item.city} · {item.distanceKm?.toFixed(1)}km away</Text>
        </View>
        <Text style={nearby.price}>{fmtPrice(rate, item.currency)}<Text style={nearby.unit}>/{isCar?"day":"night"}</Text></Text>
      </View>
      {item.starRating != null && item.starRating > 0 && (
        <View style={nearby.star}>
          <Ionicons name="star" size={12} color="#F59E0B" />
          <Text style={nearby.starText}>{item.starRating}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const nearby = StyleSheet.create({
  card:{flexDirection:"row",backgroundColor:"#fff",borderRadius:14,overflow:"hidden",borderWidth:1,borderColor:BORDER,marginBottom:10,
    shadowColor:"#000",shadowOffset:{width:0,height:1},shadowOpacity:0.05,shadowRadius:4,elevation:1},
  photo:{width:80,height:80},
  info:{flex:1,padding:10,justifyContent:"center"},
  title:{fontSize:14,fontWeight:"700",color:TEXT,marginBottom:3},
  row:{flexDirection:"row",alignItems:"center",gap:3,marginBottom:4},
  loc:{fontSize:11,color:MUTED},
  price:{fontSize:13,fontWeight:"800",color:GREEN},
  unit:{fontSize:10,fontWeight:"400",color:MUTED},
  star:{paddingRight:12,alignItems:"center",justifyContent:"center",gap:2},
  starText:{fontSize:12,fontWeight:"700",color:TEXT},
});

// ── Trending Grid Card ────────────────────────────────────────────────────────

function TrendingCard({ item, onPress }: { item: SearchResult; onPress: () => void }) {
  const isCar = item.listingType === "car";
  const rate = isCar ? item.dailyRate : item.nightlyRate;
  return (
    <TouchableOpacity style={trend.card} onPress={onPress} activeOpacity={0.85}>
      {item.primaryPhotoUrl
        ? <Image source={{ uri: item.primaryPhotoUrl }} style={trend.photo} resizeMode="cover" />
        : <View style={[trend.photo, { backgroundColor: "#D1FAE5" }]} />}
      <View style={trend.overlay}>
        <Text style={trend.title} numberOfLines={1}>{item.title}</Text>
        <Text style={trend.price}>{fmtPrice(rate, item.currency)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const trend = StyleSheet.create({
  card:{width:(W-48)/2,borderRadius:14,overflow:"hidden",marginBottom:10},
  photo:{width:"100%",height:140},
  overlay:{position:"absolute",bottom:0,left:0,right:0,backgroundColor:"rgba(0,0,0,0.45)",padding:10},
  title:{color:"#fff",fontWeight:"700",fontSize:12},
  price:{color:"#BBF7D0",fontWeight:"700",fontSize:12,marginTop:2},
});

// ── Section Header ────────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle, onMore }: { title: string; subtitle?: string; onMore?: () => void }) {
  return (
    <View style={sh.row}>
      <View style={{ flex: 1 }}>
        <Text style={sh.title}>{title}</Text>
        {subtitle ? <Text style={sh.sub}>{subtitle}</Text> : null}
      </View>
      {onMore && (
        <TouchableOpacity onPress={onMore}>
          <Text style={sh.more}>View More</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const sh = StyleSheet.create({
  row:{flexDirection:"row",alignItems:"flex-start",marginBottom:14,paddingHorizontal:16},
  title:{fontSize:17,fontWeight:"800",color:TEXT},
  sub:{fontSize:12,color:MUTED,marginTop:2},
  more:{fontSize:13,color:GREEN,fontWeight:"700"},
});

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonCard({ width=200 }: { width?: number }) {
  return (
    <View style={[cards.card, { width, marginRight: 12 }]}>
      <View style={[cards.photo, { backgroundColor: "#E5E7EB" }]} />
      <View style={{ padding: 10, gap: 6 }}>
        <View style={{ height: 12, width: "80%", backgroundColor: "#E5E7EB", borderRadius: 4 }} />
        <View style={{ height: 10, width: "50%", backgroundColor: "#E5E7EB", borderRadius: 4 }} />
      </View>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = user?.firstName ?? "Explorer";
  const loyaltyPoints = user?.loyaltyPoints ?? 0;
  const currentTier = user?.currentTier ?? "bronze";

  const [category, setCategory] = useState<Category>("hotels");
  const [location, setLocation] = useState("Nairobi");
  const [checkIn, setCheckIn] = useState<Date | null>(null);
  const [checkOut, setCheckOut] = useState<Date | null>(null);
  const [guests, setGuests] = useState(2);
  const [pickupDate, setPickupDate] = useState<Date | null>(null);
  const [pickupH, setPickupH] = useState(9);
  const [pickupM, setPickupM] = useState(0);
  const [returnDate, setReturnDate] = useState<Date | null>(null);
  const [returnH, setReturnH] = useState(9);
  const [returnM, setReturnM] = useState(0);

  type Picker = "checkIn"|"checkOut"|"pickupDate"|"returnDate"|null;
  const [activePicker, setActivePicker] = useState<Picker>(null);

  // ── API Queries — all hitting https://kainook.duckdns.org/api/listings ──────
  const { data: hotelsData, isLoading: hotelsLoading } = useQuery<SearchResult[]>({
    queryKey: ["home-hotels"],
    queryFn: async () => {
      const res = await listingApi.get<SearchResponse>(
        "/search?category=hotel&lat=-1.2921&lng=36.8219&radius_km=50&limit=30"
      );
      return res.data.data.results ?? [];
    },
    staleTime: 60_000,
  });

  const { data: apartmentsData, isLoading: aptsLoading } = useQuery<SearchResult[]>({
    queryKey: ["home-apartments"],
    queryFn: async () => {
      const res = await listingApi.get<SearchResponse>(
        "/search?category=apartment&lat=-1.2921&lng=36.8219&radius_km=50&limit=30"
      );
      return res.data.data.results ?? [];
    },
    staleTime: 60_000,
  });

  const { data: carsData, isLoading: carsLoading } = useQuery<SearchResult[]>({
    queryKey: ["home-cars"],
    queryFn: async () => {
      const res = await listingApi.get<SearchResponse>(
        "/search?category=car&lat=-1.2921&lng=36.8219&radius_km=50&limit=30"
      );
      return res.data.data.results ?? [];
    },
    staleTime: 60_000,
  });

  // ── Curated segments from API data ────────────────────────────────────────
  const bestOffers = [
    ...(hotelsData ?? []).filter(h => h.nightlyRate && h.nightlyRate <= 15000),
    ...(apartmentsData ?? []).filter(a => a.longStayDiscountEnabled),
  ].slice(0, 8);

  const recommended = [
    ...(hotelsData ?? []).filter(h => (h.starRating ?? 0) >= 4 || h.isAccredited),
    ...(apartmentsData ?? []).filter(a => a.isAccredited),
  ].slice(0, 8);

  const featured = (hotelsData ?? []).filter(h => h.isAccredited || (h.starRating ?? 0) >= 5).slice(0, 3);

  const nearbyAll = [
    ...(hotelsData ?? []),
    ...(apartmentsData ?? []),
  ].sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 5);

  const trending = [
    ...(hotelsData ?? []).slice(0, 2),
    ...(apartmentsData ?? []).slice(0, 2),
  ].slice(0, 4);

  const signatureDestinations = [
    ...(apartmentsData ?? []).filter(a => a.longStayDiscountEnabled),
    ...(hotelsData ?? []).filter(h => (h.starRating ?? 0) >= 5),
  ].slice(0, 6);

  const premiumCars = (carsData ?? []).slice(0, 6);

  const allLoading = hotelsLoading || aptsLoading || carsLoading;

  // ── Search handler ────────────────────────────────────────────────────────
  const handleSearch = useCallback(() => {
    if (!location.trim()) { Alert.alert("Location required", "Please enter a city."); return; }
    if (category === "hotels" || category === "apartments") {
      if (!checkIn || !checkOut) { Alert.alert("Dates required", "Please select check-in and check-out dates."); return; }
      router.push({ pathname: "/search", params: {
        category: category === "hotels" ? "hotel" : "apartment",
        placeName: location, checkIn: toYMD(checkIn), checkOut: toYMD(checkOut), guests: String(guests),
      }});
    } else {
      if (!pickupDate || !returnDate) { Alert.alert("Dates required", "Please select pickup and return dates."); return; }
      router.push({ pathname: "/search", params: {
        category: "car", placeName: location,
        pickupDatetime: toISO(pickupDate, pickupH, pickupM),
        returnDatetime: toISO(returnDate, returnH, returnM),
      }});
    }
  }, [category, location, checkIn, checkOut, guests, pickupDate, pickupH, pickupM, returnDate, returnH, returnM]);

  function navToListing(id: string, isCar: boolean) {
    const params: Record<string, string> = {};
    if (!isCar) {
      if (checkIn) params.checkIn = toYMD(checkIn);
      if (checkOut) params.checkOut = toYMD(checkOut);
      params.guests = String(guests);
    } else {
      if (pickupDate) params.pickupDatetime = toISO(pickupDate, pickupH, pickupM);
      if (returnDate) params.returnDatetime = toISO(returnDate, returnH, returnM);
    }
    router.push({ pathname: `/listing/${id}` as any, params });
  }

  function tierLabel() {
    const map: Record<string, string> = { bronze:"Bronze Member", silver:"Silver Member", gold:"Gold Member", diamond:"Diamond Elite" };
    return map[currentTier] ?? "Member";
  }
  function tierColor() {
    const map: Record<string, string> = { bronze:"#CD7F32", silver:"#9CA3AF", gold:"#F59E0B", diamond:"#60A5FA" };
    return map[currentTier] ?? "#9CA3AF";
  }

  function pickerProps() {
    const base = { visible: activePicker !== null, onClose: () => setActivePicker(null), selectedDate: null as Date|null, title: "" };
    if (activePicker === "checkIn") return { ...base, title:"Select check-in", selectedDate:checkIn, minDate:new Date(),
      onSelect:(d:Date)=>setCheckIn(d) };
    if (activePicker === "checkOut") return { ...base, title:"Select check-out", selectedDate:checkOut,
      minDate: checkIn ? new Date(checkIn.getTime()+86400000) : new Date(), onSelect:(d:Date)=>setCheckOut(d) };
    if (activePicker === "pickupDate") return { ...base, title:"Pickup date & time", selectedDate:pickupDate, minDate:new Date(),
      showTime:true, selectedHour:pickupH, selectedMinute:pickupM, onSelect:(d:Date)=>setPickupDate(d),
      onTimeChange:(h:number,m:number)=>{ setPickupH(h); setPickupM(m); } };
    if (activePicker === "returnDate") return { ...base, title:"Return date & time", selectedDate:returnDate,
      minDate: pickupDate ? new Date(pickupDate.getTime()+86400000) : new Date(),
      showTime:true, selectedHour:returnH, selectedMinute:returnM, onSelect:(d:Date)=>setReturnDate(d),
      onTimeChange:(h:number,m:number)=>{ setReturnH(h); setReturnM(m); } };
    return { ...base, onSelect:()=>{} };
  }

  return (
    <SafeAreaView style={s.container}>
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={s.header}>
          <View>
            <Text style={s.headerBrand}>KAINOOK</Text>
            <Text style={s.headerGreeting}>{greeting}, {firstName} 👋</Text>
          </View>
          <View style={s.headerActions}>
            <TouchableOpacity style={s.iconBtn}>
              <Ionicons name="notifications-outline" size={20} color={TEXT} />
              <View style={s.notifDot} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Category Tabs ────────────────────────────────────────────────── */}
        <View style={s.tabsRow}>
          {(["hotels","apartments","cars"] as Category[]).map(cat => (
            <TouchableOpacity
              key={cat}
              style={[s.tab, category === cat && s.tabActive]}
              onPress={() => setCategory(cat)}
            >
              <Text style={[s.tabText, category === cat && s.tabTextActive]}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Search Card ──────────────────────────────────────────────────── */}
        <View style={s.searchCard}>
          {/* Location */}
          <View style={s.searchRow}>
            <Ionicons name="location-outline" size={18} color={GREEN} style={{ marginRight: 10 }} />
            <TextInput
              style={s.locationInput}
              value={location}
              onChangeText={setLocation}
              placeholder="Where to?"
              placeholderTextColor={MUTED}
            />
          </View>
          <View style={s.searchDivider} />

          {/* Dates */}
          {(category === "hotels" || category === "apartments") ? (
            <View style={s.datesRow}>
              <TouchableOpacity style={s.dateField} onPress={() => setActivePicker("checkIn")}>
                <Ionicons name="calendar-outline" size={15} color={MUTED} />
                <View style={{ marginLeft: 6 }}>
                  <Text style={s.dateLabel}>Check-in</Text>
                  <Text style={[s.dateVal, !checkIn && s.datePlaceholder]}>
                    {checkIn ? fmt(checkIn) : "Select date"}
                  </Text>
                </View>
              </TouchableOpacity>
              <View style={s.dateSep} />
              <TouchableOpacity style={s.dateField} onPress={() => setActivePicker("checkOut")}>
                <Ionicons name="calendar-outline" size={15} color={MUTED} />
                <View style={{ marginLeft: 6 }}>
                  <Text style={s.dateLabel}>Check-out</Text>
                  <Text style={[s.dateVal, !checkOut && s.datePlaceholder]}>
                    {checkOut ? fmt(checkOut) : "Select date"}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.datesRow}>
              <TouchableOpacity style={s.dateField} onPress={() => setActivePicker("pickupDate")}>
                <Ionicons name="calendar-outline" size={15} color={MUTED} />
                <View style={{ marginLeft: 6 }}>
                  <Text style={s.dateLabel}>Pickup</Text>
                  <Text style={[s.dateVal, !pickupDate && s.datePlaceholder]}>
                    {pickupDate ? `${fmt(pickupDate)} ${String(pickupH).padStart(2,"0")}:${String(pickupM).padStart(2,"0")}` : "Select date"}
                  </Text>
                </View>
              </TouchableOpacity>
              <View style={s.dateSep} />
              <TouchableOpacity style={s.dateField} onPress={() => setActivePicker("returnDate")}>
                <Ionicons name="calendar-outline" size={15} color={MUTED} />
                <View style={{ marginLeft: 6 }}>
                  <Text style={s.dateLabel}>Return</Text>
                  <Text style={[s.dateVal, !returnDate && s.datePlaceholder]}>
                    {returnDate ? `${fmt(returnDate)} ${String(returnH).padStart(2,"0")}:${String(returnM).padStart(2,"0")}` : "Select date"}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* Guests (hotels/apartments only) */}
          {category !== "cars" && (
            <>
              <View style={s.searchDivider} />
              <View style={s.guestsRow}>
                <Ionicons name="people-outline" size={17} color={MUTED} style={{ marginRight: 10 }} />
                <Text style={s.guestsLabel}>Guests</Text>
                <View style={s.stepper}>
                  <TouchableOpacity style={[s.stepBtn, guests<=1&&s.stepBtnDis]} onPress={() => setGuests(g=>Math.max(1,g-1))} disabled={guests<=1}>
                    <Text style={s.stepBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={s.stepVal}>{guests}</Text>
                  <TouchableOpacity style={[s.stepBtn, guests>=16&&s.stepBtnDis]} onPress={() => setGuests(g=>Math.min(16,g+1))} disabled={guests>=16}>
                    <Text style={s.stepBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}
        </View>

        {/* ── Search Button ────────────────────────────────────────────────── */}
        <TouchableOpacity style={s.searchBtn} onPress={handleSearch} activeOpacity={0.85}>
          <Ionicons name="search" size={18} color="#fff" style={{ marginRight: 8 }} />
          <Text style={s.searchBtnText}>Search Stays & Cars</Text>
        </TouchableOpacity>

        {/* ── KAI-Points Loyalty Card ──────────────────────────────────────── */}
        {user && (
          <View style={s.loyaltyCard}>
            <View style={s.loyaltyLeft}>
              <Text style={s.loyaltyLabel}>KAI-Points Balance</Text>
              <Text style={s.loyaltyPoints}>{loyaltyPoints.toLocaleString()} <Text style={s.loyaltyPtSuffix}>KAI-Points</Text></Text>
              <View style={s.loyaltyTierRow}>
                <View style={[s.tierDot, { backgroundColor: tierColor() }]} />
                <Text style={s.tierLabel}>{tierLabel()}</Text>
              </View>
            </View>
            <View style={s.loyaltyRight}>
              <Ionicons name="diamond-outline" size={32} color="rgba(255,255,255,0.3)" />
            </View>
          </View>
        )}

        {/* ── Promo Banner ─────────────────────────────────────────────────── */}
        <View style={s.promoBanner}>
          <View style={s.promoBannerBadge}>
            <Text style={s.promoBannerBadgeText}>Exclusive Reward</Text>
          </View>
          <Text style={s.promoPercent}>15% Off Your Next Stay</Text>
          <View style={s.promoCodeRow}>
            <Text style={s.promoCodeLabel}>Use Code: </Text>
            <TouchableOpacity onPress={() => Alert.alert("Voucher Copied!", 'Use code "EXPLORER24" at checkout.')}>
              <Text style={s.promoCode}>EXPLORER24</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Best Offers & Deals ──────────────────────────────────────────── */}
        <View style={s.section}>
          <SectionHeader
            title="Best Offers & Deals"
            onMore={() => router.push({ pathname:"/search", params:{ category:"hotel", placeName:"Nairobi" }})}
          />
          {allLoading ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.carousel}>
              {[1,2,3].map(i=><SkeletonCard key={i} width={200} />)}
            </ScrollView>
          ) : bestOffers.length > 0 ? (
            <FlatList
              data={bestOffers}
              keyExtractor={i=>i.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.carousel}
              renderItem={({ item }) => (
                <ListingCard
                  item={item} width={200}
                  badgeLabel={item.listingType==="apartment"&&item.longStayDiscountEnabled ? "LONG STAY" : "BEST DEAL"}
                  badgeColor={item.longStayDiscountEnabled ? "#8B5CF6" : "#DC2626"}
                  onPress={() => navToListing(item.id, false)}
                />
              )}
              ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
            />
          ) : null}
        </View>

        {/* ── Recommended Stays ────────────────────────────────────────────── */}
        <View style={s.section}>
          <SectionHeader
            title="Recommended Stays"
            subtitle="Top-rated gems selected just for you"
            onMore={() => router.push({ pathname:"/search", params:{ category:"hotel", placeName:"Nairobi" }})}
          />
          {hotelsLoading ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.carousel}>
              {[1,2,3].map(i=><SkeletonCard key={i} width={210} />)}
            </ScrollView>
          ) : recommended.length > 0 ? (
            <FlatList
              data={recommended}
              keyExtractor={i=>i.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.carousel}
              renderItem={({ item }) => (
                <ListingCard item={item} width={210} badgeLabel="TOP RATED" badgeColor="#F59E0B"
                  onPress={() => navToListing(item.id, false)} />
              )}
              ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
            />
          ) : null}
        </View>

        {/* ── Featured Stays ───────────────────────────────────────────────── */}
        {featured.length > 0 && (
          <View style={s.section}>
            <SectionHeader title="Featured Stays" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.carousel}>
              {featured.map(item => (
                <TouchableOpacity key={item.id} style={s.featuredCard} onPress={() => navToListing(item.id, false)} activeOpacity={0.88}>
                  {item.primaryPhotoUrl
                    ? <Image source={{ uri: item.primaryPhotoUrl }} style={s.featuredPhoto} resizeMode="cover" />
                    : <View style={[s.featuredPhoto, { backgroundColor: "#D1FAE5" }]} />}
                  <View style={s.featuredOverlay}>
                    <View style={s.featuredBadge}>
                      <Text style={s.featuredBadgeText}>FEATURED & EXCLUSIVE</Text>
                    </View>
                    <Text style={s.featuredTitle} numberOfLines={2}>{item.title}</Text>
                    <Text style={s.featuredLocation}>{item.city}, {item.countryCode}</Text>
                    <View style={s.featuredPriceRow}>
                      <Text style={s.featuredPrice}>{fmtPrice(item.nightlyRate, item.currency)}<Text style={s.featuredPriceUnit}>/night</Text></Text>
                      <TouchableOpacity style={s.featuredBtn} onPress={() => navToListing(item.id, false)}>
                        <Text style={s.featuredBtnText}>Book Experience</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Stays Nearby ─────────────────────────────────────────────────── */}
        <View style={s.section}>
          <SectionHeader
            title="Stays Nearby"
            subtitle="Based on your location"
            onMore={() => router.push({ pathname:"/search", params:{ category:"hotel", placeName:location }})}
          />
          {hotelsLoading || aptsLoading ? (
            <ActivityIndicator color={GREEN} style={{ marginLeft: 16 }} />
          ) : nearbyAll.length > 0 ? (
            <View style={{ paddingHorizontal: 16 }}>
              {nearbyAll.map(item => (
                <NearbyCard key={item.id} item={item} onPress={() => navToListing(item.id, item.listingType==="car")} />
              ))}
            </View>
          ) : null}
        </View>

        {/* ── Premium Rental Cars ───────────────────────────────────────────── */}
        {premiumCars.length > 0 && (
          <View style={s.section}>
            <SectionHeader
              title="Premium Rental Cars"
              subtitle="Arrive in style with our luxury fleet"
              onMore={() => router.push({ pathname:"/search", params:{ category:"car", placeName:location }})}
            />
            {carsLoading ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.carousel}>
                {[1,2].map(i=><SkeletonCard key={i} width={220} />)}
              </ScrollView>
            ) : (
              <FlatList
                data={premiumCars}
                keyExtractor={i=>i.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.carousel}
                renderItem={({ item }) => (
                  <TouchableOpacity style={[cards.card,{width:220}]} onPress={() => navToListing(item.id, true)} activeOpacity={0.85}>
                    {item.primaryPhotoUrl
                      ? <Image source={{ uri: item.primaryPhotoUrl }} style={[cards.photo,{height:140}]} resizeMode="cover" />
                      : <View style={[cards.photo,{height:140,backgroundColor:"#D1FAE5"}]} />}
                    <View style={cards.body}>
                      <View style={s.carBadge}><Text style={s.carBadgeText}>LUXURY</Text></View>
                      <Text style={cards.title} numberOfLines={1}>
                        {item.carMake} {item.carModel} {item.carYear}
                      </Text>
                      <Text style={{fontSize:11,color:MUTED,marginBottom:4}}>
                        {item.transmission} · {item.seats} seats
                      </Text>
                      <Text style={cards.price}>{fmtPrice(item.dailyRate, item.currency)}<Text style={cards.priceUnit}>/day</Text></Text>
                      <TouchableOpacity style={s.reserveBtn} onPress={() => navToListing(item.id, true)}>
                        <Text style={s.reserveBtnText}>Reserve Now</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                )}
                ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
              />
            )}
          </View>
        )}

        {/* ── Trending Now (2×2 Grid) ───────────────────────────────────────── */}
        {trending.length > 0 && (
          <View style={s.section}>
            <SectionHeader
              title="Trending Now"
              onMore={() => router.push({ pathname:"/search", params:{ category:"hotel", placeName:location }})}
            />
            <View style={s.trendGrid}>
              {trending.map(item => (
                <TrendingCard key={item.id} item={item} onPress={() => navToListing(item.id, item.listingType==="car")} />
              ))}
            </View>
          </View>
        )}

        {/* ── Signature Destinations ───────────────────────────────────────── */}
        {signatureDestinations.length > 0 && (
          <View style={s.section}>
            <SectionHeader
              title="Signature Destinations"
              subtitle="Curated escapes for the modern traveler"
              onMore={() => router.push({ pathname:"/search", params:{ category:"apartment", placeName:location }})}
            />
            <FlatList
              data={signatureDestinations}
              keyExtractor={i=>i.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.carousel}
              renderItem={({ item }) => (
                <TouchableOpacity style={s.destCard} onPress={() => navToListing(item.id, false)} activeOpacity={0.88}>
                  {item.primaryPhotoUrl
                    ? <Image source={{ uri: item.primaryPhotoUrl }} style={s.destPhoto} resizeMode="cover" />
                    : <View style={[s.destPhoto, { backgroundColor: "#D1FAE5" }]} />}
                  <View style={s.destOverlay}>
                    <Text style={s.destCity}>{item.city}, {item.countryCode}</Text>
                    <Text style={s.destTitle} numberOfLines={1}>{item.title}</Text>
                    {item.longStayDiscountEnabled && (
                      <Text style={s.destStay}>Long-stay discount available</Text>
                    )}
                    <Text style={s.destPrice}>{fmtPrice(item.nightlyRate, item.currency)}/night</Text>
                  </View>
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
            />
          </View>
        )}

        {/* ── Unlock the Extraordinary CTA ─────────────────────────────────── */}
        <View style={s.ctaBanner}>
          <View style={s.ctaContent}>
            <Text style={s.ctaTitle}>Unlock the{"\n"}Extraordinary</Text>
            <Text style={s.ctaSub}>
              Kainook members enjoy exclusive stay credits and access to over 1,000 properties worldwide.
            </Text>
            <TouchableOpacity style={s.ctaBtn}>
              <Text style={s.ctaBtnText}>Explore Member Perks</Text>
              <Ionicons name="arrow-forward" size={14} color="#1B5E20" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </View>
          <View style={s.ctaIconWrap}>
            <Ionicons name="globe-outline" size={80} color="rgba(255,255,255,0.08)" />
          </View>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Date picker modal */}
      {activePicker && (
        <DatePickerModal {...(pickerProps() as any)} visible={!!activePicker} onClose={() => setActivePicker(null)} />
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  // Header
  header: { flexDirection:"row", alignItems:"center", justifyContent:"space-between",
    paddingHorizontal:16, paddingTop:12, paddingBottom:14, backgroundColor:"#fff" },
  headerBrand: { fontSize:22, fontWeight:"900", color:GREEN, letterSpacing:1 },
  headerGreeting: { fontSize:13, color:MUTED, marginTop:2 },
  headerActions: { flexDirection:"row", gap:8 },
  iconBtn: { width:40, height:40, borderRadius:20, backgroundColor:BG, alignItems:"center",
    justifyContent:"center", borderWidth:1, borderColor:BORDER, position:"relative" },
  notifDot: { position:"absolute", top:8, right:8, width:8, height:8, borderRadius:4,
    backgroundColor:"#DC2626", borderWidth:1.5, borderColor:"#fff" },

  // Category tabs
  tabsRow: { flexDirection:"row", paddingHorizontal:16, paddingBottom:14, gap:8 },
  tab: { paddingHorizontal:18, paddingVertical:8, borderRadius:20, borderWidth:1.5,
    borderColor:BORDER, backgroundColor:"#fff" },
  tabActive: { backgroundColor:GREEN, borderColor:GREEN },
  tabText: { fontSize:13, fontWeight:"600", color:MUTED },
  tabTextActive: { color:"#fff" },

  // Search card
  searchCard: { marginHorizontal:16, backgroundColor:"#fff", borderRadius:18, borderWidth:1.5,
    borderColor:BORDER, overflow:"hidden", shadowColor:"#000", shadowOffset:{width:0,height:2},
    shadowOpacity:0.07, shadowRadius:8, elevation:3 },
  searchRow: { flexDirection:"row", alignItems:"center", paddingHorizontal:16, paddingVertical:13 },
  locationInput: { flex:1, fontSize:15, color:TEXT, fontWeight:"500" },
  searchDivider: { height:1, backgroundColor:BORDER, marginHorizontal:16 },
  datesRow: { flexDirection:"row" },
  dateField: { flex:1, flexDirection:"row", alignItems:"center", paddingHorizontal:16, paddingVertical:12 },
  dateSep: { width:1, backgroundColor:BORDER, marginVertical:10 },
  dateLabel: { fontSize:11, color:MUTED, fontWeight:"500", marginBottom:2 },
  dateVal: { fontSize:13, color:TEXT, fontWeight:"600" },
  datePlaceholder: { color:MUTED, fontWeight:"400" },
  guestsRow: { flexDirection:"row", alignItems:"center", paddingHorizontal:16, paddingVertical:11 },
  guestsLabel: { flex:1, fontSize:15, color:TEXT, fontWeight:"500" },
  stepper: { flexDirection:"row", alignItems:"center", gap:14 },
  stepBtn: { width:32, height:32, borderRadius:16, backgroundColor:GREEN, alignItems:"center", justifyContent:"center" },
  stepBtnDis: { backgroundColor:BORDER },
  stepBtnText: { color:"#fff", fontSize:20, fontWeight:"700", lineHeight:24 },
  stepVal: { fontSize:17, fontWeight:"700", color:TEXT, minWidth:28, textAlign:"center" },

  // Search button
  searchBtn: { flexDirection:"row", alignItems:"center", justifyContent:"center", marginHorizontal:16,
    marginTop:12, backgroundColor:GREEN, borderRadius:14, paddingVertical:15,
    shadowColor:GREEN, shadowOffset:{width:0,height:4}, shadowOpacity:0.3, shadowRadius:8, elevation:4 },
  searchBtnText: { color:"#fff", fontSize:16, fontWeight:"700" },

  // Loyalty card
  loyaltyCard: { flexDirection:"row", alignItems:"center", marginHorizontal:16, marginTop:16,
    backgroundColor:"#0D3B1E", borderRadius:18, padding:18, overflow:"hidden" },
  loyaltyLeft: { flex:1 },
  loyaltyLabel: { fontSize:11, color:"rgba(255,255,255,0.6)", fontWeight:"600", letterSpacing:0.5, marginBottom:4 },
  loyaltyPoints: { fontSize:24, fontWeight:"900", color:"#fff" },
  loyaltyPtSuffix: { fontSize:13, fontWeight:"500", color:"rgba(255,255,255,0.7)" },
  loyaltyTierRow: { flexDirection:"row", alignItems:"center", gap:6, marginTop:6 },
  tierDot: { width:8, height:8, borderRadius:4 },
  tierLabel: { fontSize:12, color:"rgba(255,255,255,0.8)", fontWeight:"600" },
  loyaltyRight: { paddingLeft:12 },

  // Promo banner
  promoBanner: { marginHorizontal:16, marginTop:12, backgroundColor:GREEN_LIGHT, borderRadius:14,
    padding:16, borderWidth:1, borderColor:GREEN_BORDER },
  promoBannerBadge: { backgroundColor:"#D1FAE5", borderRadius:20, alignSelf:"flex-start",
    paddingHorizontal:10, paddingVertical:4, marginBottom:8 },
  promoBannerBadgeText: { fontSize:10, fontWeight:"700", color:GREEN_MED, letterSpacing:0.5 },
  promoPercent: { fontSize:20, fontWeight:"800", color:GREEN, marginBottom:8 },
  promoCodeRow: { flexDirection:"row", alignItems:"center" },
  promoCodeLabel: { fontSize:14, color:MUTED },
  promoCode: { fontSize:14, fontWeight:"700", color:GREEN, backgroundColor:"#D1FAE5",
    paddingHorizontal:10, paddingVertical:4, borderRadius:8, overflow:"hidden" },

  // Section
  section: { marginTop:24 },
  carousel: { paddingHorizontal:16, paddingBottom:4 },

  // Featured card
  featuredCard: { width: W-56, borderRadius:20, overflow:"hidden", marginRight:12,
    shadowColor:"#000", shadowOffset:{width:0,height:4}, shadowOpacity:0.12, shadowRadius:10, elevation:5 },
  featuredPhoto: { width:"100%", height:240 },
  featuredOverlay: { position:"absolute", bottom:0, left:0, right:0,
    backgroundColor:"rgba(0,0,0,0.55)", padding:16 },
  featuredBadge: { backgroundColor:"rgba(255,255,255,0.2)", alignSelf:"flex-start",
    borderRadius:20, paddingHorizontal:10, paddingVertical:4, marginBottom:8, borderWidth:1, borderColor:"rgba(255,255,255,0.4)" },
  featuredBadgeText: { fontSize:10, fontWeight:"700", color:"#fff", letterSpacing:1 },
  featuredTitle: { fontSize:18, fontWeight:"800", color:"#fff", marginBottom:4 },
  featuredLocation: { fontSize:12, color:"rgba(255,255,255,0.8)", marginBottom:12 },
  featuredPriceRow: { flexDirection:"row", alignItems:"center", justifyContent:"space-between" },
  featuredPrice: { fontSize:20, fontWeight:"800", color:"#fff" },
  featuredPriceUnit: { fontSize:12, fontWeight:"400", color:"rgba(255,255,255,0.7)" },
  featuredBtn: { backgroundColor:"#fff", borderRadius:10, paddingHorizontal:14, paddingVertical:8 },
  featuredBtnText: { fontSize:12, fontWeight:"700", color:GREEN },

  // Trending grid
  trendGrid: { flexDirection:"row", flexWrap:"wrap", paddingHorizontal:16, gap:10 },

  // Signature destinations
  destCard: { width:200, borderRadius:16, overflow:"hidden", shadowColor:"#000",
    shadowOffset:{width:0,height:2}, shadowOpacity:0.08, shadowRadius:6, elevation:3 },
  destPhoto: { width:"100%", height:180 },
  destOverlay: { position:"absolute", bottom:0, left:0, right:0,
    backgroundColor:"rgba(0,0,0,0.5)", padding:12 },
  destCity: { fontSize:10, color:"rgba(255,255,255,0.75)", fontWeight:"600", letterSpacing:0.5 },
  destTitle: { fontSize:14, fontWeight:"700", color:"#fff", marginTop:2 },
  destStay: { fontSize:10, color:"#BBF7D0", marginTop:3 },
  destPrice: { fontSize:13, fontWeight:"700", color:"#fff", marginTop:4 },

  // Car section
  carBadge: { backgroundColor:GREEN_LIGHT, borderRadius:6, alignSelf:"flex-start",
    paddingHorizontal:7, paddingVertical:3, marginBottom:6, borderWidth:1, borderColor:GREEN_BORDER },
  carBadgeText: { fontSize:9, fontWeight:"800", color:GREEN_MED, letterSpacing:0.8 },
  reserveBtn: { marginTop:10, backgroundColor:GREEN_LIGHT, borderRadius:8, paddingVertical:8,
    alignItems:"center", borderWidth:1, borderColor:GREEN_BORDER },
  reserveBtnText: { fontSize:12, fontWeight:"700", color:GREEN },

  // CTA banner
  ctaBanner: { marginHorizontal:16, marginTop:24, backgroundColor:"#0D3B1E", borderRadius:20,
    padding:24, overflow:"hidden", position:"relative" },
  ctaContent: { flex:1, zIndex:1 },
  ctaTitle: { fontSize:26, fontWeight:"900", color:"#fff", lineHeight:32, marginBottom:10 },
  ctaSub: { fontSize:13, color:"rgba(255,255,255,0.75)", lineHeight:19, marginBottom:20 },
  ctaBtn: { flexDirection:"row", alignItems:"center", backgroundColor:"#fff",
    alignSelf:"flex-start", borderRadius:20, paddingHorizontal:16, paddingVertical:10 },
  ctaBtnText: { fontSize:13, fontWeight:"700", color:GREEN },
  ctaIconWrap: { position:"absolute", right:-10, bottom:-10 },
});
