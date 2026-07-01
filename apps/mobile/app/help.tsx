import { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { K } from "../constants/theme";
import {
  FAQ_SECTIONS,
  CONTACT_CHANNELS,
  RESPONSE_TIMES,
  FAQCategory,
  FAQItem,
  FAQSection,
} from "../constants/faqContent";

// Enable layout animation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── Category tabs ──────────────────────────────────────────────────────────────

const CATEGORIES: { id: FAQCategory | "all"; label: string; icon: string }[] = [
  { id: "all",       label: "All",       icon: "apps-outline" },
  { id: "about",     label: "About",     icon: "information-circle-outline" },
  { id: "guests",    label: "Guests",    icon: "person-outline" },
  { id: "providers", label: "Providers", icon: "home-outline" },
  { id: "general",   label: "General",   icon: "globe-outline" },
];

// ── FAQ Accordion Item ─────────────────────────────────────────────────────────

function AccordionItem({ item, isLast }: { item: FAQItem; isLast: boolean }) {
  const [open, setOpen] = useState(false);

  function toggle() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((v) => !v);
  }

  return (
    <View>
      <TouchableOpacity style={a.row} onPress={toggle} activeOpacity={0.7}>
        <View style={a.qWrap}>
          <Text style={a.q}>{item.q}</Text>
        </View>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={16}
          color={open ? K.colors.accent : K.colors.textMuted}
        />
      </TouchableOpacity>

      {open ? (
        <View style={a.answerBox}>
          <Text style={a.answer}>{item.a}</Text>
          {item.tip ? (
            <View style={a.tipBox}>
              <Ionicons name="bulb-outline" size={14} color={K.colors.accent} />
              <Text style={a.tipText}>{item.tip}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {!isLast ? <View style={a.divider} /> : null}
    </View>
  );
}

const a = StyleSheet.create({
  row:       { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  qWrap:     { flex: 1 },
  q:         { fontSize: 14, fontWeight: "600", color: K.colors.textDark, lineHeight: 20 },
  answerBox: { paddingHorizontal: 16, paddingBottom: 14, paddingTop: 2 },
  answer:    { fontSize: 13.5, color: K.colors.textMid, lineHeight: 21 },
  tipBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 10,
    backgroundColor: "#f0fdf4",
    borderRadius: 10,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: K.colors.accent,
  },
  tipText: { flex: 1, fontSize: 12.5, color: K.colors.textMid, lineHeight: 18 },
  divider: { height: 1, backgroundColor: K.colors.border, marginHorizontal: 16 },
});

// ── Section Card ───────────────────────────────────────────────────────────────

function SectionCard({ section }: { section: FAQSection }) {
  return (
    <View style={sc.wrap}>
      <View style={sc.header}>
        <View style={sc.iconWrap}>
          <Ionicons name={section.icon as any} size={17} color={K.colors.darkGreen} />
        </View>
        <Text style={sc.title}>{section.title}</Text>
        <Text style={sc.count}>{section.items.length}</Text>
      </View>
      <View style={sc.card}>
        {section.items.map((item, idx) => (
          <AccordionItem key={idx} item={item} isLast={idx === section.items.length - 1} />
        ))}
      </View>
    </View>
  );
}

const sc = StyleSheet.create({
  wrap:    { marginBottom: 20 },
  header:  { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8, paddingHorizontal: 4 },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: "#e8f5ee",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { flex: 1, fontSize: 13, fontWeight: "700", color: K.colors.textDark, textTransform: "uppercase", letterSpacing: 0.5 },
  count: {
    fontSize: 11,
    fontWeight: "700",
    color: K.colors.accent,
    backgroundColor: "#e8f5ee",
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: K.colors.border,
    overflow: "hidden",
    ...K.shadow.xs,
  },
});

// ── Contact Section ────────────────────────────────────────────────────────────

function ContactSection() {
  return (
    <View style={ct.wrap}>
      <View style={sc.header}>
        <View style={[sc.iconWrap, { backgroundColor: "#eff6ff" }]}>
          <Ionicons name="mail-outline" size={17} color="#3b82f6" />
        </View>
        <Text style={sc.title}>Contact & Support</Text>
      </View>

      <View style={ct.card}>
        <Text style={ct.email}>info@kainook.com</Text>
        <TouchableOpacity
          style={ct.emailBtn}
          onPress={() => Linking.openURL("mailto:info@kainook.com")}
          activeOpacity={0.8}
        >
          <Ionicons name="mail-outline" size={15} color="#fff" />
          <Text style={ct.emailBtnText}>Send Email</Text>
        </TouchableOpacity>

        <View style={ct.divider} />

        <Text style={ct.rtTitle}>Response Times</Text>
        {RESPONSE_TIMES.map((rt, i) => (
          <View key={i} style={ct.rtRow}>
            <View style={ct.rtDot} />
            <Text style={ct.rtText}>{rt}</Text>
          </View>
        ))}

        <View style={ct.divider} />

        <Text style={ct.companyNote}>
          Kainook Travel OÜ · Tallinn, Estonia{"\n"}
          Operating across Africa and internationally
        </Text>
      </View>
    </View>
  );
}

const ct = StyleSheet.create({
  wrap:     { marginBottom: 20 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: K.colors.border,
    overflow: "hidden",
    padding: 16,
    ...K.shadow.xs,
  },
  email:      { fontSize: 18, fontWeight: "800", color: K.colors.darkGreen, marginBottom: 12, letterSpacing: -0.2 },
  emailBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: K.colors.accent,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: "flex-start",
    marginBottom: 16,
  },
  emailBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  divider:    { height: 1, backgroundColor: K.colors.border, marginVertical: 14 },
  rtTitle:    { fontSize: 12, fontWeight: "700", color: K.colors.textMuted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 },
  rtRow:      { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 6 },
  rtDot:      { width: 6, height: 6, borderRadius: 3, backgroundColor: K.colors.accent, marginTop: 6 },
  rtText:     { flex: 1, fontSize: 13, color: K.colors.textMid, lineHeight: 19 },
  companyNote: { fontSize: 12, color: K.colors.textMuted, lineHeight: 18, textAlign: "center" },
});

// ── Screen ────────────────────────────────────────────────────────────────────

export default function HelpScreen() {
  const [activeCategory, setActiveCategory] = useState<FAQCategory | "all">("all");
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Fade in on mount
  useState(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  });

  const filteredSections = useCallback((): FAQSection[] => {
    const q = search.trim().toLowerCase();

    return FAQ_SECTIONS
      .filter((sec) => activeCategory === "all" || sec.category === activeCategory)
      .map((sec) => {
        if (!q) return sec;
        const matchedItems = sec.items.filter(
          (item) =>
            item.q.toLowerCase().includes(q) ||
            item.a.toLowerCase().includes(q)
        );
        return { ...sec, items: matchedItems };
      })
      .filter((sec) => sec.items.length > 0);
  }, [activeCategory, search]);

  const sections = filteredSections();
  const totalResults = sections.reduce((n, s) => n + s.items.length, 0);

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Help Centre</Text>
          <Text style={s.headerSub}>How can we help you?</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Search bar */}
      <View style={s.searchWrap}>
        <View style={[s.searchBox, searchFocused && s.searchBoxFocused]}>
          <Ionicons name="search-outline" size={18} color={searchFocused ? K.colors.accent : K.colors.textMuted} />
          <TextInput
            style={s.searchInput}
            placeholder="Search FAQs…"
            placeholderTextColor={K.colors.textMuted}
            value={search}
            onChangeText={setSearch}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            returnKeyType="search"
            autoCorrect={false}
          />
          {search.length > 0 ? (
            <TouchableOpacity onPress={() => setSearch("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={K.colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Category tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.tabsRow}
        contentContainerStyle={s.tabsContent}
      >
        {CATEGORIES.map((cat) => {
          const active = activeCategory === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[s.tab, active && s.tabActive]}
              onPress={() => setActiveCategory(cat.id)}
              activeOpacity={0.75}
            >
              <Ionicons
                name={cat.icon as any}
                size={14}
                color={active ? "#fff" : K.colors.textMuted}
              />
              <Text style={[s.tabLabel, active && s.tabLabelActive]}>{cat.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Results count */}
      {search.trim().length > 0 ? (
        <Text style={s.resultCount}>
          {totalResults} result{totalResults !== 1 ? "s" : ""} for "{search.trim()}"
        </Text>
      ) : null}

      {/* FAQ list */}
      <Animated.ScrollView
        style={[s.scroll, { opacity: fadeAnim }]}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {sections.length > 0 ? (
          sections.map((section) => (
            <SectionCard key={section.id} section={section} />
          ))
        ) : (
          <View style={s.emptyWrap}>
            <Ionicons name="search-outline" size={48} color={K.colors.border} />
            <Text style={s.emptyTitle}>No results found</Text>
            <Text style={s.emptySub}>
              Try different keywords or browse by category
            </Text>
          </View>
        )}

        {/* Contact section — always shown */}
        <ContactSection />

        <View style={{ height: 20 }} />
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: K.colors.darkGreen },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    backgroundColor: K.colors.darkGreen,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle:  { fontSize: 20, fontWeight: "800", color: "#fff", letterSpacing: -0.3 },
  headerSub:    { fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 2 },

  // Search
  searchWrap: {
    backgroundColor: K.colors.darkGreen,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  searchBoxFocused: {
    backgroundColor: "#fff",
    borderColor: K.colors.accent,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: K.colors.textDark,
  },

  // Category tabs
  tabsRow:    { backgroundColor: K.colors.darkGreen, maxHeight: 48 },
  tabsContent: { paddingHorizontal: 12, paddingBottom: 14, gap: 8, flexDirection: "row" },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  tabActive: {
    backgroundColor: K.colors.accent,
    borderColor: K.colors.accent,
  },
  tabLabel:       { fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.7)" },
  tabLabelActive: { color: "#fff" },

  // Content area
  scroll:        { flex: 1, backgroundColor: "#F5F4F1" },
  scrollContent: { padding: 16, paddingTop: 20 },

  resultCount: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    backgroundColor: K.colors.darkGreen,
    paddingHorizontal: 20,
    paddingBottom: 10,
    fontWeight: "600",
  },

  // Empty state
  emptyWrap:  { alignItems: "center", paddingVertical: 60 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: K.colors.textDark, marginTop: 16, marginBottom: 8 },
  emptySub:   { fontSize: 14, color: K.colors.textMuted, textAlign: "center", lineHeight: 20 },
});
