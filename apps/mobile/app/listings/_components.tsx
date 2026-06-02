/**
 * Shared form UI components for the provider listing creation wizards.
 * All styled with the Kainook theme (K object).
 *
 * Expo Router requires every file inside app/ to have a default export.
 * This stub satisfies that requirement — the real exports are named.
 */
export default function _ListingWizardComponents() {
  return null;
}
import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Modal,
  FlatList,
  Image,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from "react-native";

const LOGO = require("../../assets/logo.png");
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { K } from "../../constants/theme";
import { ALL_COUNTRIES, CountryData } from "../../constants/countries";
import {
  AMENITY_CATEGORIES,
  AMENITY_CONFIG,
  AmenityCategory,
} from "../../constants/amenities";

const { width: W } = Dimensions.get("window");

// ── FormField ─────────────────────────────────────────────────────────────────

interface FormFieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  numberOfLines?: number;
  keyboardType?: any;
  autoCapitalize?: any;
  maxLength?: number;
  editable?: boolean;
}

export function FormField({
  label,
  required,
  hint,
  multiline,
  numberOfLines,
  ...inputProps
}: FormFieldProps) {
  const inputHeight = multiline ? (numberOfLines ? numberOfLines * 22 + 24 : 100) : undefined;
  return (
    <View style={fs.group}>
      <Text style={fs.label}>
        {label}
        {required && <Text style={fs.required}> *</Text>}
      </Text>
      {hint && <Text style={fs.hint}>{hint}</Text>}
      <TextInput
        style={[
          fs.input,
          multiline && { height: inputHeight, textAlignVertical: "top", paddingTop: 12 },
        ]}
        multiline={multiline}
        numberOfLines={numberOfLines}
        placeholderTextColor="#9CA3AF"
        {...inputProps}
      />
    </View>
  );
}

// ── SectionHeader ─────────────────────────────────────────────────────────────

export function SectionHeader({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ComponentProps<typeof Feather>["name"];
}) {
  return (
    <View style={fs.sectionHeader}>
      {icon && (
        <View style={fs.sectionIconWrap}>
          <Feather name={icon} size={18} color={K.colors.accent} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={fs.sectionTitle}>{title}</Text>
        {subtitle && <Text style={fs.sectionSubtitle}>{subtitle}</Text>}
      </View>
    </View>
  );
}

// ── InfoBanner ────────────────────────────────────────────────────────────────

export function InfoBanner({ message, variant = "info" }: { message: string; variant?: "info" | "warning" | "success" }) {
  const colors = {
    info: { bg: "#EFF6FF", border: "#BFDBFE", text: "#1D4ED8", icon: "info" as const },
    warning: { bg: "#FFFBEB", border: "#FDE68A", text: "#92400E", icon: "alert-triangle" as const },
    success: { bg: "#F0FDF4", border: "#6EE7B7", text: "#065F46", icon: "check-circle" as const },
  }[variant];
  return (
    <View style={[fs.infoBanner, { backgroundColor: colors.bg, borderColor: colors.border }]}>
      <Feather name={colors.icon} size={15} color={colors.text} style={{ marginTop: 1 }} />
      <Text style={[fs.infoBannerText, { color: colors.text }]}>{message}</Text>
    </View>
  );
}

// ── Stepper ───────────────────────────────────────────────────────────────────

export function Stepper({
  label,
  value,
  min = 0,
  max,
  onChange,
  hint,
  required,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  hint?: string;
  required?: boolean;
}) {
  return (
    <View style={fs.stepperGroup}>
      <Text style={fs.label}>
        {label}
        {required && <Text style={fs.required}> *</Text>}
      </Text>
      {hint && <Text style={fs.hint}>{hint}</Text>}
      <View style={fs.stepperRow}>
        <TouchableOpacity
          style={[fs.stepperBtn, value <= min && fs.stepperBtnDisabled]}
          onPress={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
        >
          <Feather name="minus" size={18} color={value <= min ? "#CBD5E1" : "#fff"} />
        </TouchableOpacity>
        <Text style={fs.stepperValue}>{value}</Text>
        <TouchableOpacity
          style={[fs.stepperBtn, max !== undefined && value >= max && fs.stepperBtnDisabled]}
          onPress={() => onChange(max !== undefined ? Math.min(max, value + 1) : value + 1)}
          disabled={max !== undefined && value >= max}
        >
          <Feather name="plus" size={18} color={max !== undefined && value >= max ? "#CBD5E1" : "#fff"} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── ChipSelector ──────────────────────────────────────────────────────────────

export function ChipSelector({
  label,
  required,
  hint,
  options,
  selected,
  onSelect,
  horizontal,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  options: Array<{ key: string; label: string }>;
  selected: string;
  onSelect: (key: string) => void;
  horizontal?: boolean;
}) {
  const chips = options.map((opt) => (
    <TouchableOpacity
      key={opt.key}
      style={[fs.chip, selected === opt.key && fs.chipActive]}
      onPress={() => onSelect(opt.key)}
      activeOpacity={0.75}
    >
      <Text style={[fs.chipText, selected === opt.key && fs.chipTextActive]}>{opt.label}</Text>
    </TouchableOpacity>
  ));

  return (
    <View style={fs.group}>
      <Text style={fs.label}>
        {label}
        {required && <Text style={fs.required}> *</Text>}
      </Text>
      {hint && <Text style={fs.hint}>{hint}</Text>}
      {horizontal ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={fs.chipRow}>
          {chips}
        </ScrollView>
      ) : (
        <View style={fs.chipWrap}>{chips}</View>
      )}
    </View>
  );
}

// ── SwitchRow ─────────────────────────────────────────────────────────────────

export function SwitchRow({
  label,
  hint,
  value,
  onValueChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={fs.switchRow}>
      <View style={{ flex: 1 }}>
        <Text style={fs.label}>{label}</Text>
        {hint && <Text style={fs.hint}>{hint}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: "#E2E8F0", true: K.colors.accentDim }}
        thumbColor={value ? K.colors.accent : "#fff"}
      />
    </View>
  );
}

// ── RadioGroup ────────────────────────────────────────────────────────────────

export function RadioGroup({
  label,
  required,
  options,
  selected,
  onSelect,
}: {
  label: string;
  required?: boolean;
  options: Array<{ key: string; label: string; desc?: string }>;
  selected: string;
  onSelect: (key: string) => void;
}) {
  return (
    <View style={fs.group}>
      <Text style={fs.label}>
        {label}
        {required && <Text style={fs.required}> *</Text>}
      </Text>
      {options.map((opt) => {
        const active = selected === opt.key;
        return (
          <TouchableOpacity
            key={opt.key}
            style={[fs.radioRow, active && fs.radioRowActive]}
            onPress={() => onSelect(opt.key)}
            activeOpacity={0.8}
          >
            <View style={[fs.radioDot, active && fs.radioDotActive]}>
              {active && <View style={fs.radioDotInner} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[fs.radioLabel, active && fs.radioLabelActive]}>{opt.label}</Text>
              {opt.desc && <Text style={fs.radioDesc}>{opt.desc}</Text>}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── CurrencyDisplay ───────────────────────────────────────────────────────────

export function CurrencyDisplay({ code, symbol }: { code: string; symbol: string }) {
  return (
    <View style={fs.currencyPill}>
      <Text style={fs.currencyPillText}>{code}</Text>
      <Text style={fs.currencyPillSymbol}>{symbol}</Text>
    </View>
  );
}

// ── CountryPickerButton ───────────────────────────────────────────────────────

export function CountryPickerButton({
  selectedCountry,
  onPress,
  label,
  required,
}: {
  selectedCountry: CountryData | null;
  onPress: () => void;
  label?: string;
  required?: boolean;
}) {
  return (
    <View style={fs.group}>
      <Text style={fs.label}>
        {label ?? "Country"}
        {required && <Text style={fs.required}> *</Text>}
      </Text>
      <TouchableOpacity style={fs.countryBtn} onPress={onPress} activeOpacity={0.8}>
        {selectedCountry ? (
          <>
            <Text style={fs.countryFlag}>{selectedCountry.flag}</Text>
            <View style={{ flex: 1 }}>
              <Text style={fs.countryBtnName}>{selectedCountry.name}</Text>
              <Text style={fs.countryBtnCurrency}>
                {selectedCountry.currency} · {selectedCountry.symbol}
              </Text>
            </View>
          </>
        ) : (
          <Text style={fs.countryBtnPlaceholder}>Select a country…</Text>
        )}
        <Feather name="chevron-down" size={18} color="#9CA3AF" />
      </TouchableOpacity>
    </View>
  );
}

// ── CountryPickerModal ────────────────────────────────────────────────────────

export function CountryPickerModal({
  visible,
  selectedCode,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selectedCode?: string;
  onSelect: (c: CountryData) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = search.trim()
    ? ALL_COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.code.toLowerCase().includes(search.toLowerCase()) ||
          c.currency.toLowerCase().includes(search.toLowerCase())
      )
    : ALL_COUNTRIES;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={fs.modalContainer}>
        <View style={fs.modalHeader}>
          <Text style={fs.modalTitle}>Select Country</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="x" size={24} color={K.colors.textDark} />
          </TouchableOpacity>
        </View>
        <View style={fs.modalSearchWrap}>
          <Feather name="search" size={16} color="#9CA3AF" />
          <TextInput
            style={fs.modalSearchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search countries or currency…"
            placeholderTextColor="#9CA3AF"
            autoFocus
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x-circle" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.code}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[fs.countryItem, selectedCode === item.code && fs.countryItemSelected]}
              onPress={() => {
                onSelect(item);
                onClose();
                setSearch("");
              }}
            >
              <Text style={fs.countryItemFlag}>{item.flag}</Text>
              <View style={{ flex: 1 }}>
                <Text style={fs.countryItemName}>{item.name}</Text>
                <Text style={fs.countryItemCurrency}>
                  {item.currency} · {item.symbol}
                </Text>
              </View>
              {selectedCode === item.code && (
                <Feather name="check" size={18} color={K.colors.accent} />
              )}
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: K.colors.border }} />}
        />
      </SafeAreaView>
    </Modal>
  );
}

// ── AmenitiesSection ──────────────────────────────────────────────────────────

export function AmenitiesSection({
  amenities,
  customAmenities,
  customInput,
  onToggle,
  onCustomAdd,
  onCustomRemove,
  onCustomInputChange,
}: {
  amenities: Record<AmenityCategory, string[]>;
  customAmenities: string[];
  customInput: string;
  onToggle: (cat: AmenityCategory, key: string) => void;
  onCustomAdd: (label: string) => void;
  onCustomRemove: (label: string) => void;
  onCustomInputChange: (text: string) => void;
}) {
  const total = AMENITY_CATEGORIES.reduce((sum, cat) => sum + (amenities[cat]?.length ?? 0), 0);

  return (
    <View>
      <SectionHeader
        title="Amenities"
        subtitle={`${total} selected · tap to toggle`}
        icon="check-square"
      />

      {AMENITY_CATEGORIES.map((cat) => (
        <View key={cat} style={fs.amenityCategory}>
          <Text style={fs.amenityCatLabel}>{cat}</Text>
          <View style={fs.chipWrap}>
            {AMENITY_CONFIG[cat].map((item) => {
              const selected = amenities[cat]?.includes(item.key) ?? false;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[fs.amenityChip, selected && fs.amenityChipActive]}
                  onPress={() => onToggle(cat, item.key)}
                  activeOpacity={0.75}
                >
                  <Text style={fs.amenityEmoji}>{item.emoji}</Text>
                  <Text style={[fs.amenityChipText, selected && fs.amenityChipTextActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}

      {/* Custom amenities */}
      <View style={fs.group}>
        <Text style={fs.label}>Custom Amenity</Text>
        <Text style={fs.hint}>Add anything not listed above</Text>
        <View style={fs.customRow}>
          <TextInput
            style={[fs.input, { flex: 1 }]}
            value={customInput}
            onChangeText={onCustomInputChange}
            placeholder="e.g. Rooftop bar"
            placeholderTextColor="#9CA3AF"
            maxLength={60}
            returnKeyType="done"
            onSubmitEditing={() => onCustomAdd(customInput.trim())}
          />
          <TouchableOpacity
            style={[fs.addBtn, !customInput.trim() && { opacity: 0.4 }]}
            onPress={() => onCustomAdd(customInput.trim())}
            disabled={!customInput.trim()}
          >
            <Text style={fs.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
        {customAmenities.length > 0 && (
          <View style={[fs.chipWrap, { marginTop: 10 }]}>
            {customAmenities.map((a) => (
              <View key={a} style={fs.customChip}>
                <Text style={fs.customChipText}>{a}</Text>
                <TouchableOpacity onPress={() => onCustomRemove(a)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Feather name="x" size={13} color={K.colors.darkGreen} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

// ── PhotosSection ─────────────────────────────────────────────────────────────

export function PhotosSection({
  photos,
  uploading,
  onAdd,
  onDelete,
  minPhotos = 1,
  maxPhotos = 30,
}: {
  photos: Array<{ id: string; cdnUrl: string; position: number }>;
  uploading: boolean;
  onAdd: () => void;
  onDelete: (id: string) => void;
  minPhotos?: number;
  maxPhotos?: number;
}) {
  const meetsMin = photos.length >= minPhotos;

  return (
    <View>
      <SectionHeader
        title="Photos"
        subtitle={`Up to ${maxPhotos} photos. First photo is the cover image.`}
        icon="camera"
      />

      {minPhotos > 1 && (
        <View style={[fs.counterBadge, meetsMin && fs.counterBadgeDone]}>
          <Feather
            name={meetsMin ? "check-circle" : "camera"}
            size={15}
            color={meetsMin ? "#059669" : "#92400E"}
          />
          <Text style={[fs.counterText, meetsMin && fs.counterTextDone]}>
            {photos.length} / {minPhotos} minimum required{meetsMin ? " ✓" : ""}
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[fs.uploadArea, (photos.length >= maxPhotos || uploading) && { opacity: 0.5 }]}
        onPress={onAdd}
        disabled={uploading || photos.length >= maxPhotos}
        activeOpacity={0.7}
      >
        {uploading ? (
          <>
            <ActivityIndicator color={K.colors.accent} size="small" />
            <Text style={fs.uploadAreaText}>Uploading…</Text>
          </>
        ) : (
          <>
            <Feather name="image" size={30} color={K.colors.accent} />
            <Text style={fs.uploadAreaText}>
              {photos.length >= maxPhotos
                ? "Maximum photos reached"
                : `Add Photos  (${photos.length} / ${maxPhotos})`}
            </Text>
            <Text style={fs.uploadAreaSub}>JPEG · PNG · WEBP · Max 5 MB each</Text>
          </>
        )}
      </TouchableOpacity>

      {photos.length > 0 && (
        <View style={fs.photoGrid}>
          {photos.map((p, i) => (
            <View key={p.id} style={fs.photoItem}>
              <Image source={{ uri: p.cdnUrl }} style={fs.photoThumb} resizeMode="cover" />
              {i === 0 && (
                <View style={fs.coverBadge}>
                  <Text style={fs.coverBadgeText}>COVER</Text>
                </View>
              )}
              <TouchableOpacity
                style={fs.photoDeleteBtn}
                onPress={() => onDelete(p.id)}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              >
                <Feather name="trash-2" size={13} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ── DocumentsSection ──────────────────────────────────────────────────────────

export function DocumentsSection({
  docTypes,
  documents,
  uploadingDoc,
  onUpload,
  note,
}: {
  docTypes: Array<{ key: string; label: string; icon: React.ComponentProps<typeof Feather>["name"] }>;
  documents: Array<{ id: string; documentType: string }>;
  uploadingDoc: string | null;
  onUpload: (docType: string, docLabel: string) => void;
  note?: string;
}) {
  return (
    <View>
      <SectionHeader
        title="Documents"
        subtitle="PDF, JPEG, or PNG · Max 10 MB each"
        icon="file-text"
      />
      {note && <InfoBanner message={note} variant="info" />}
      <View style={{ height: 12 }} />
      {docTypes.map((doc) => {
        const uploaded = documents.some((d) => d.documentType === doc.key);
        const isUploading = uploadingDoc === doc.key;
        return (
          <View key={doc.key} style={[fs.docCard, uploaded && fs.docCardDone]}>
            <View style={[fs.docIconWrap, { backgroundColor: uploaded ? "#DCFCE7" : "#F1F5F9" }]}>
              <Feather name={doc.icon} size={20} color={uploaded ? "#059669" : "#64748B"} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={fs.docLabel}>{doc.label}</Text>
              <Text style={[fs.docStatus, { color: uploaded ? "#059669" : "#94A3B8" }]}>
                {uploaded ? "Uploaded ✓" : "Not yet uploaded"}
              </Text>
            </View>
            <TouchableOpacity
              style={[fs.docUploadBtn, uploaded && fs.docUploadBtnReplace]}
              onPress={() => onUpload(doc.key, doc.label)}
              disabled={isUploading}
              activeOpacity={0.8}
            >
              {isUploading ? (
                <ActivityIndicator size="small" color={uploaded ? K.colors.accent : "#fff"} />
              ) : (
                <Text style={[fs.docUploadBtnText, uploaded && { color: K.colors.accent }]}>
                  {uploaded ? "Replace" : "Upload"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

// ── StepProgressBar ───────────────────────────────────────────────────────────

export function StepProgressBar({
  steps,
  currentStep,
}: {
  steps: readonly string[];
  currentStep: number;
}) {
  return (
    <View style={fs.progressWrap}>
      {steps.map((st, i) => (
        <View key={st} style={fs.progressItem}>
          <View
            style={[
              fs.progressDot,
              i < currentStep && fs.progressDotDone,
              i === currentStep && fs.progressDotActive,
            ]}
          >
            {i < currentStep ? (
              <Feather name="check" size={9} color="#fff" />
            ) : (
              <Text style={fs.progressDotNum}>{i + 1}</Text>
            )}
          </View>
          <Text
            style={[fs.progressLabel, i === currentStep && fs.progressLabelActive]}
            numberOfLines={1}
          >
            {st}
          </Text>
          {i < steps.length - 1 && (
            <View style={[fs.progressLine, i < currentStep && fs.progressLineDone]} />
          )}
        </View>
      ))}
    </View>
  );
}

// ── WizardHeader ──────────────────────────────────────────────────────────────

export function WizardHeader({
  title,
  step,
  steps,
  onBack,
}: {
  title: string;
  step: number;
  steps: readonly string[];
  onBack: () => void;
}) {
  return (
    <SafeAreaView edges={["top"]} style={fs.wizardHeader}>
      <View style={fs.wizardHeaderRow}>
        <TouchableOpacity style={fs.backBtn} onPress={onBack} activeOpacity={0.8}>
          <Feather name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={fs.wizardHeaderCenter}>
          <Image source={LOGO} style={fs.wizardLogo} resizeMode="contain" />
          <Text style={fs.wizardHeaderTitle}>{title}</Text>
          <Text style={fs.wizardHeaderSub}>
            Step {step + 1} of {steps.length} · {steps[step]}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>
      <StepProgressBar steps={steps} currentStep={step} />
    </SafeAreaView>
  );
}

// ── WizardFooter ──────────────────────────────────────────────────────────────

export function WizardFooter({
  onNext,
  onBack,
  isFirst,
  isLast,
  lastLabel,
  loading,
  disabled,
  disabledHint,
}: {
  onNext: () => void;
  onBack: () => void;
  isFirst: boolean;
  isLast: boolean;
  lastLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  disabledHint?: string;
}) {
  return (
    <SafeAreaView edges={["bottom"]} style={fs.wizardFooter}>
      {disabled && disabledHint && (
        <View style={fs.disabledHint}>
          <Feather name="alert-circle" size={13} color="#92400E" />
          <Text style={fs.disabledHintText}>{disabledHint}</Text>
        </View>
      )}
      <View style={fs.wizardFooterRow}>
        {!isFirst && (
          <TouchableOpacity style={fs.footerBackBtn} onPress={onBack} activeOpacity={0.8}>
            <Feather name="arrow-left" size={16} color={K.colors.textMuted} />
            <Text style={fs.footerBackText}>Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[fs.footerNextBtn, (loading || disabled) && fs.footerNextBtnDisabled, isFirst && { flex: 1 }]}
          onPress={onNext}
          disabled={loading || disabled}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <View style={fs.footerNextInner}>
              <Text style={fs.footerNextText}>
                {isLast ? (lastLabel ?? "Submit") : "Save & Continue"}
              </Text>
              {!isLast && <Feather name="arrow-right" size={16} color="#fff" />}
              {isLast && <Feather name="send" size={16} color="#fff" />}
            </View>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────

export const fs = StyleSheet.create({
  // groups
  group: { marginBottom: 20 },
  sectionHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 20 },
  sectionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: K.radius.md,
    backgroundColor: K.colors.accentDim,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  sectionTitle: { fontSize: K.font.xl, fontWeight: "800", color: K.colors.textDark, marginBottom: 2 },
  sectionSubtitle: { fontSize: K.font.xs, color: K.colors.textMuted, lineHeight: 16 },

  // labels
  label: { fontSize: K.font.sm, fontWeight: "600", color: K.colors.textDark, marginBottom: 6 },
  required: { color: K.colors.error },
  hint: { fontSize: K.font.xs, color: K.colors.textMuted, marginBottom: 6, lineHeight: 16 },

  // input
  input: {
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: K.colors.border,
    borderRadius: K.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: K.font.base,
    color: K.colors.textDark,
  },

  // info banner
  infoBanner: {
    flexDirection: "row",
    gap: 8,
    borderWidth: 1,
    borderRadius: K.radius.md,
    padding: 12,
    alignItems: "flex-start",
  },
  infoBannerText: { flex: 1, fontSize: K.font.sm, lineHeight: 18 },

  // stepper
  stepperGroup: { marginBottom: 20 },
  stepperRow: { flexDirection: "row", alignItems: "center", gap: 20, marginTop: 4 },
  stepperBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: K.colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperBtnDisabled: { backgroundColor: "#E2E8F0" },
  stepperValue: {
    fontSize: K.font.xxl,
    fontWeight: "800",
    color: K.colors.textDark,
    minWidth: 52,
    textAlign: "center",
  },

  // chips
  chipRow: { flexDirection: "row", gap: 8, paddingBottom: 4 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: K.radius.full,
    borderWidth: 1.5,
    borderColor: K.colors.border,
    backgroundColor: "#fff",
  },
  chipActive: { backgroundColor: K.colors.accentDim, borderColor: K.colors.accent },
  chipText: { fontSize: K.font.sm, fontWeight: "600", color: "#64748B" },
  chipTextActive: { color: K.colors.darkGreen, fontWeight: "700" },

  // switch row
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: K.colors.border,
  },

  // radio
  radioRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: K.radius.md,
    borderWidth: 1.5,
    borderColor: K.colors.border,
    backgroundColor: "#fff",
    marginBottom: 8,
  },
  radioRowActive: { borderColor: K.colors.accent, backgroundColor: "#F0FFF8" },
  radioDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: K.colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    flexShrink: 0,
  },
  radioDotActive: { borderColor: K.colors.accent },
  radioDotInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: K.colors.accent },
  radioLabel: { fontSize: K.font.sm, fontWeight: "600", color: K.colors.textDark },
  radioLabelActive: { color: K.colors.darkGreen },
  radioDesc: { fontSize: K.font.xs, color: K.colors.textMuted, marginTop: 2, lineHeight: 16 },

  // currency pill
  currencyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: K.colors.accentDim,
    borderRadius: K.radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: K.colors.accent + "40",
    alignSelf: "flex-start",
  },
  currencyPillText: { fontSize: K.font.sm, fontWeight: "700", color: K.colors.darkGreen },
  currencyPillSymbol: { fontSize: K.font.sm, color: K.colors.accent, fontWeight: "800" },

  // country button
  countryBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: K.colors.border,
    borderRadius: K.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  countryFlag: { fontSize: 22 },
  countryBtnName: { fontSize: K.font.base, fontWeight: "600", color: K.colors.textDark },
  countryBtnCurrency: { fontSize: K.font.xs, color: K.colors.textMuted, marginTop: 1 },
  countryBtnPlaceholder: { flex: 1, fontSize: K.font.base, color: "#9CA3AF" },

  // country modal
  modalContainer: { flex: 1, backgroundColor: "#fff" },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: K.colors.border,
  },
  modalTitle: { fontSize: K.font.xl, fontWeight: "800", color: K.colors.textDark },
  modalSearchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#F8FAF9",
    borderBottomWidth: 1,
    borderBottomColor: K.colors.border,
  },
  modalSearchInput: { flex: 1, fontSize: K.font.base, color: K.colors.textDark, paddingVertical: 4 },
  countryItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
  },
  countryItemSelected: { backgroundColor: K.colors.accentDim },
  countryItemFlag: { fontSize: 22 },
  countryItemName: { fontSize: K.font.base, fontWeight: "600", color: K.colors.textDark },
  countryItemCurrency: { fontSize: K.font.xs, color: K.colors.textMuted, marginTop: 2 },

  // amenities
  amenityCategory: { marginBottom: 20 },
  amenityCatLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: K.colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
  },
  amenityChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: K.radius.full,
    borderWidth: 1.5,
    borderColor: K.colors.border,
    backgroundColor: "#fff",
  },
  amenityChipActive: { backgroundColor: K.colors.accentDim, borderColor: K.colors.accent },
  amenityEmoji: { fontSize: 13 },
  amenityChipText: { fontSize: 12, color: "#64748B", fontWeight: "500" },
  amenityChipTextActive: { color: K.colors.darkGreen, fontWeight: "700" },

  // custom amenity
  customRow: { flexDirection: "row", gap: 8 },
  addBtn: {
    backgroundColor: K.colors.accent,
    borderRadius: K.radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: "center",
  },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: K.font.sm },
  customChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: K.colors.accentDim,
    borderRadius: K.radius.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: K.colors.accent + "50",
  },
  customChipText: { fontSize: K.font.sm, color: K.colors.darkGreen, fontWeight: "600" },

  // photo counter
  counterBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF3C7",
    borderRadius: K.radius.md,
    padding: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  counterBadgeDone: { backgroundColor: "#DCFCE7", borderColor: "#6EE7B7" },
  counterText: { fontSize: K.font.sm, fontWeight: "600", color: "#92400E" },
  counterTextDone: { color: "#065F46" },

  // upload area
  uploadArea: {
    borderWidth: 2,
    borderColor: K.colors.accent,
    borderStyle: "dashed",
    borderRadius: K.radius.xl,
    paddingVertical: 30,
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    backgroundColor: K.colors.accentDim,
  },
  uploadAreaText: { fontSize: K.font.base, fontWeight: "700", color: K.colors.darkGreen },
  uploadAreaSub: { fontSize: K.font.xs, color: K.colors.textMuted },

  // photo grid
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 8 },
  photoItem: { position: "relative", borderRadius: K.radius.md, overflow: "hidden" },
  photoThumb: { width: (W - 64) / 3, height: (W - 64) / 3 },
  coverBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: K.colors.darkGreen,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  coverBadgeText: { fontSize: 8, fontWeight: "800", color: "#fff", letterSpacing: 0.6 },
  photoDeleteBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },

  // documents
  docCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: K.radius.lg,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: K.colors.border,
    ...K.shadow.sm,
  },
  docCardDone: { borderColor: "#6EE7B7", backgroundColor: "#F0FDF4" },
  docIconWrap: {
    width: 44,
    height: 44,
    borderRadius: K.radius.md,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  docLabel: { fontSize: K.font.sm, fontWeight: "700", color: K.colors.textDark, marginBottom: 2 },
  docStatus: { fontSize: K.font.xs, fontWeight: "600" },
  docUploadBtn: {
    backgroundColor: K.colors.darkGreen,
    borderRadius: K.radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 70,
    alignItems: "center",
  },
  docUploadBtnReplace: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: K.colors.accent,
  },
  docUploadBtnText: { fontSize: K.font.xs, fontWeight: "700", color: "#fff" },

  // step progress bar
  progressWrap: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 6,
    alignItems: "flex-start",
  },
  progressItem: { flex: 1, alignItems: "center", position: "relative" },
  progressDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  progressDotActive: { backgroundColor: "#fff" },
  progressDotDone: { backgroundColor: K.colors.accent },
  progressDotNum: { fontSize: 10, fontWeight: "700", color: "rgba(255,255,255,0.6)" },
  progressLabel: { fontSize: 8, color: "rgba(255,255,255,0.5)", fontWeight: "600", textAlign: "center" },
  progressLabelActive: { color: "#fff", fontWeight: "700" },
  progressLine: {
    position: "absolute",
    top: 11,
    left: "60%",
    right: "-40%",
    height: 2,
    backgroundColor: "rgba(255,255,255,0.15)",
    zIndex: -1,
  },
  progressLineDone: { backgroundColor: K.colors.accent },

  // wizard header
  wizardHeader: { backgroundColor: K.colors.darkGreen },
  wizardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: K.colors.glassBg,
    borderWidth: 1,
    borderColor: K.colors.glassBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  wizardHeaderCenter: { flex: 1, alignItems: "center" },
  wizardLogo: { width: 56, height: 20, marginBottom: 4 },
  wizardHeaderTitle: { fontSize: K.font.lg, fontWeight: "800", color: "#fff" },
  wizardHeaderSub: { fontSize: K.font.xs, color: K.colors.textLightMuted, marginTop: 2 },

  // wizard footer
  wizardFooter: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: K.colors.border,
    ...K.shadow.md,
  },
  disabledHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF3C7",
    borderRadius: K.radius.sm,
    padding: 8,
    marginBottom: 10,
  },
  disabledHintText: { fontSize: K.font.xs, color: "#92400E", fontWeight: "600", flex: 1 },
  wizardFooterRow: { flexDirection: "row", gap: 10, marginBottom: 4 },
  footerBackBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1.5,
    borderColor: K.colors.border,
    borderRadius: K.radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  footerBackText: { fontSize: K.font.sm, fontWeight: "600", color: K.colors.textMuted },
  footerNextBtn: {
    flex: 2,
    backgroundColor: K.colors.accent,
    borderRadius: K.radius.lg,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  footerNextBtnDisabled: { opacity: 0.45 },
  footerNextInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  footerNextText: { color: "#fff", fontWeight: "700", fontSize: K.font.base },
});
