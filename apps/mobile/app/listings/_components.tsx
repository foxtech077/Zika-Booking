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
  Alert,
} from "react-native";

const LOGO = require("../../assets/logo.png");
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { ListingImage } from "../../components/ListingImage";
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
  error?: string;
}

export function FormField({
  label,
  required,
  hint,
  multiline,
  numberOfLines,
  error,
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
          multiline && { height: inputHeight, textAlignVertical: "top", paddingTop: 14 },
          !!error && fs.inputError,
        ]}
        multiline={multiline}
        numberOfLines={numberOfLines}
        placeholderTextColor="#A3A39C"
        {...inputProps}
      />
      {!!error && <Text style={fs.errorText}>{error}</Text>}
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
          <Feather name={icon} size={18} color={K.colors.darkGreen} />
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
    success: { bg: K.colors.bgTint, border: "#9be3bf", text: K.colors.darkGreen, icon: "check-circle" as const },
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
  error,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  options: Array<{ key: string; label: string }>;
  selected: string;
  onSelect: (key: string) => void;
  horizontal?: boolean;
  error?: string;
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
      {!!error && <Text style={fs.errorText}>{error}</Text>}
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
  error,
}: {
  selectedCountry: CountryData | null;
  onPress: () => void;
  label?: string;
  required?: boolean;
  error?: string;
}) {
  return (
    <View style={fs.group}>
      <Text style={fs.label}>
        {label ?? "Country"}
        {required && <Text style={fs.required}> *</Text>}
      </Text>
      <TouchableOpacity
        style={[fs.countryBtn, !!error && { borderColor: K.colors.error }]}
        onPress={onPress}
        activeOpacity={0.8}
      >
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
        <Feather name="chevron-down" size={18} color="#A3A39C" />
      </TouchableOpacity>
      {!!error && <Text style={fs.errorText}>{error}</Text>}
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
          <Feather name="search" size={16} color="#A3A39C" />
          <TextInput
            style={fs.modalSearchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search countries or currency…"
            placeholderTextColor="#A3A39C"
            autoFocus
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x-circle" size={16} color="#A3A39C" />
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
            placeholderTextColor="#A3A39C"
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
  uploadProgress,
  onAdd,
  onCapture,
  onDelete,
  onReorder,
  minPhotos = 1,
  maxPhotos = 30,
  error,
}: {
  photos: Array<{ id: string; cdnUrl: string; position: number }>;
  uploading: boolean;
  uploadProgress?: { current: number; total: number };
  onAdd: () => void;
  /** Optional camera-capture handler. When provided, a second "Camera" button is shown next to "Upload". */
  onCapture?: () => void;
  onDelete: (id: string) => void;
  onReorder?: (id: string, direction: "up" | "down") => void;
  minPhotos?: number;
  maxPhotos?: number;
  error?: string;
}) {
  const meetsMin = photos.length >= minPhotos;
  const atMax = photos.length >= maxPhotos;

  const uploadLabel = uploadProgress
    ? `Uploading ${uploadProgress.current} of ${uploadProgress.total}…`
    : "Uploading…";
  const uploadPct = uploadProgress ? Math.round((uploadProgress.current / uploadProgress.total) * 100) : 0;

  return (
    <View>
      <SectionHeader
        title="Photos"
        subtitle={`Up to ${maxPhotos} photos. First photo is the cover image.`}
        icon="camera"
      />

      <View style={[fs.counterBadge, meetsMin && fs.counterBadgeDone]}>
        <Feather
          name={meetsMin ? "check-circle" : "camera"}
          size={15}
          color={meetsMin ? K.colors.darkGreen : "#92400E"}
        />
        <Text style={[fs.counterText, meetsMin && fs.counterTextDone]}>
          {photos.length} / {minPhotos} minimum required{meetsMin ? " ✓" : ""}
        </Text>
      </View>

      {/* Dashed drop-zone */}
      <View style={fs.dropZone}>
        <View style={fs.dropZoneIconWrap}>
          <Feather name="image" size={26} color={K.colors.accent} />
        </View>
        <Text style={fs.dropZoneTitle}>
          {atMax ? "Maximum photos reached" : "Tap a button below to add photos"}
        </Text>
        <Text style={fs.dropZoneSub}>JPEG · PNG · WEBP · Max 5 MB each</Text>

        {uploading && (
          <View style={fs.dropZoneProgressWrap}>
            <View style={fs.dropZoneProgressTrack}>
              <View style={[fs.dropZoneProgressFill, { width: `${uploadPct}%` }]} />
            </View>
            <Text style={fs.dropZoneProgressText}>{uploadLabel}</Text>
          </View>
        )}
      </View>

      <View style={fs.photoBtnRow}>
        {onCapture && (
          <TouchableOpacity
            style={[fs.photoBtnOutline, (atMax || uploading) && fs.photoBtnDisabled]}
            onPress={onCapture}
            disabled={uploading || atMax}
            activeOpacity={0.75}
          >
            {uploading ? (
              <ActivityIndicator color={K.colors.darkGreen} size="small" />
            ) : (
              <>
                <Feather name="camera" size={16} color={K.colors.darkGreen} />
                <Text style={fs.photoBtnOutlineText}>Camera</Text>
              </>
            )}
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[fs.photoBtnFill, (atMax || uploading) && fs.photoBtnDisabled]}
          onPress={onAdd}
          disabled={uploading || atMax}
          activeOpacity={0.85}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Feather name="upload" size={16} color="#fff" />
              <Text style={fs.photoBtnFillText}>
                Upload {`(${photos.length} / ${maxPhotos})`}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {!!error && (
        <View style={fs.photoError}>
          <Feather name="alert-circle" size={13} color={K.colors.error} />
          <Text style={fs.photoErrorText}>{error}</Text>
        </View>
      )}

      {photos.length > 0 && (
        <View style={fs.photoGrid}>
          {photos.map((p, i) => (
            <View key={p.id} style={fs.photoItem}>
              <ListingImage uri={p.cdnUrl} style={fs.photoThumb} resizeMode="cover" />
              {i === 0 && (
                <View style={fs.coverBadge}>
                  <Text style={fs.coverBadgeText}>COVER</Text>
                </View>
              )}
              <TouchableOpacity
                style={fs.photoDeleteBtn}
                onPress={() =>
                  Alert.alert("Delete Photo", "Remove this photo from your listing?", [
                    { text: "Cancel", style: "cancel" },
                    { text: "Delete", style: "destructive", onPress: () => onDelete(p.id) },
                  ])
                }
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              >
                <Feather name="trash-2" size={13} color="#fff" />
              </TouchableOpacity>
              {onReorder && photos.length > 1 && (
                <View style={fs.reorderBtns}>
                  {i > 0 && (
                    <TouchableOpacity
                      style={fs.reorderBtn}
                      onPress={() => onReorder(p.id, "up")}
                      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                    >
                      <Feather name="chevron-left" size={12} color="#fff" />
                    </TouchableOpacity>
                  )}
                  {i < photos.length - 1 && (
                    <TouchableOpacity
                      style={fs.reorderBtn}
                      onPress={() => onReorder(p.id, "down")}
                      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                    >
                      <Feather name="chevron-right" size={12} color="#fff" />
                    </TouchableOpacity>
                  )}
                </View>
              )}
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
  onDelete,
  note,
}: {
  docTypes: Array<{ key: string; label: string; icon: React.ComponentProps<typeof Feather>["name"] }>;
  documents: Array<{ id: string; documentType: string }>;
  uploadingDoc: string | null;
  onUpload: (docType: string, docLabel: string) => void;
  onDelete?: (docId: string, docLabel: string) => void;
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
        const uploadedDoc = documents.find((d) => d.documentType === doc.key);
        const uploaded = !!uploadedDoc;
        const isUploading = uploadingDoc === doc.key;
        return (
          <View key={doc.key} style={[fs.docCard, uploaded && fs.docCardDone]}>
            <View style={[fs.docIconWrap, { backgroundColor: uploaded ? K.colors.bgTint : "#F1F0EC" }]}>
              <Feather name={doc.icon} size={20} color={uploaded ? K.colors.darkGreen : "#8f8b84"} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={fs.docLabel}>{doc.label}</Text>
              <Text style={[fs.docStatus, { color: uploaded ? K.colors.darkGreen : "#A3A39C" }]}>
                {uploaded ? "Uploaded ✓" : "Not yet uploaded"}
              </Text>
            </View>
            {uploaded && onDelete && uploadedDoc && (
              <TouchableOpacity
                style={fs.docDeleteBtn}
                onPress={() =>
                  Alert.alert("Delete Document", `Remove "${doc.label}"?`, [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: () => onDelete(uploadedDoc.id, doc.label),
                    },
                  ])
                }
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Feather name="trash-2" size={16} color={K.colors.error} />
              </TouchableOpacity>
            )}
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
      <View style={fs.progressSegmentRow}>
        {steps.map((_, i) => (
          <View
            key={i}
            style={[
              fs.progressSegment,
              i < steps.length - 1 && { marginRight: 4 },
              i <= currentStep && fs.progressSegmentDone,
            ]}
          />
        ))}
      </View>
      <Text style={fs.progressCaption}>
        Step {currentStep + 1} of {steps.length}: <Text style={fs.progressCaptionStrong}>{steps[currentStep]}</Text>
      </Text>
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
  group: { marginBottom: 22 },
  sectionHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 20 },
  sectionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: K.radius.md,
    backgroundColor: K.colors.bgTint,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  sectionTitle: { fontSize: K.font.xl, fontWeight: "800", color: K.colors.textDark, marginBottom: 2 },
  sectionSubtitle: { fontSize: K.font.xs, color: K.colors.textMuted, lineHeight: 16 },

  // labels
  label: { fontSize: K.font.sm, fontWeight: "700", color: K.colors.textDark, marginBottom: 6 },
  required: { color: K.colors.error },
  hint: { fontSize: K.font.xs, color: K.colors.textMuted, marginBottom: 6, lineHeight: 16 },

  // input
  input: {
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: K.colors.border,
    borderRadius: K.radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: K.font.base,
    color: K.colors.textDark,
  },
  inputError: { borderColor: K.colors.error },
  errorText: { fontSize: K.font.xs, color: K.colors.error, marginTop: 4, fontWeight: "600" as const },

  // info banner
  infoBanner: {
    flexDirection: "row",
    gap: 8,
    borderWidth: 1,
    borderRadius: K.radius.lg,
    padding: 14,
    alignItems: "flex-start",
    marginBottom: 8,
  },
  infoBannerText: { flex: 1, fontSize: K.font.sm, lineHeight: 18 },

  // stepper
  stepperGroup: { marginBottom: 22 },
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

  // chips — bigger, card-like touch targets matching the new visual language
  chipRow: { flexDirection: "row", gap: 8, paddingBottom: 4 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: K.radius.lg,
    borderWidth: 1.5,
    borderColor: K.colors.border,
    backgroundColor: "#fff",
  },
  chipActive: { backgroundColor: K.colors.bgTint, borderColor: K.colors.accent },
  chipText: { fontSize: K.font.sm, fontWeight: "600", color: K.colors.textMuted },
  chipTextActive: { color: K.colors.darkGreen, fontWeight: "800" },

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
    padding: 16,
    borderRadius: K.radius.lg,
    borderWidth: 1.5,
    borderColor: K.colors.border,
    backgroundColor: "#fff",
    marginBottom: 10,
  },
  radioRowActive: { borderColor: K.colors.accent, backgroundColor: K.colors.bgTint },
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
  radioLabel: { fontSize: K.font.sm, fontWeight: "700", color: K.colors.textDark },
  radioLabelActive: { color: K.colors.darkGreen },
  radioDesc: { fontSize: K.font.xs, color: K.colors.textMuted, marginTop: 2, lineHeight: 16 },

  // currency pill
  currencyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: K.colors.bgTint,
    borderRadius: K.radius.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
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
    borderRadius: K.radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 10,
  },
  countryFlag: { fontSize: 22 },
  countryBtnName: { fontSize: K.font.base, fontWeight: "700", color: K.colors.textDark },
  countryBtnCurrency: { fontSize: K.font.xs, color: K.colors.textMuted, marginTop: 1 },
  countryBtnPlaceholder: { flex: 1, fontSize: K.font.base, color: "#A3A39C" },

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
    backgroundColor: K.colors.bgApp,
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
  countryItemSelected: { backgroundColor: K.colors.bgTint },
  countryItemFlag: { fontSize: 22 },
  countryItemName: { fontSize: K.font.base, fontWeight: "700", color: K.colors.textDark },
  countryItemCurrency: { fontSize: K.font.xs, color: K.colors.textMuted, marginTop: 2 },

  // amenities
  amenityCategory: { marginBottom: 20 },
  amenityCatLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: K.colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
  },
  amenityChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: K.radius.full,
    borderWidth: 1.5,
    borderColor: K.colors.border,
    backgroundColor: "#fff",
  },
  amenityChipActive: { backgroundColor: K.colors.bgTint, borderColor: K.colors.accent },
  amenityEmoji: { fontSize: 13 },
  amenityChipText: { fontSize: 12, color: K.colors.textMuted, fontWeight: "600" },
  amenityChipTextActive: { color: K.colors.darkGreen, fontWeight: "800" },

  // custom amenity
  customRow: { flexDirection: "row", gap: 8 },
  addBtn: {
    backgroundColor: K.colors.accent,
    borderRadius: K.radius.lg,
    paddingHorizontal: 18,
    paddingVertical: 13,
    justifyContent: "center",
  },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: K.font.sm },
  customChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: K.colors.bgTint,
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
    borderRadius: K.radius.lg,
    padding: 11,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  counterBadgeDone: { backgroundColor: K.colors.bgTint, borderColor: "#9be3bf" },
  counterText: { fontSize: K.font.sm, fontWeight: "700", color: "#92400E" },
  counterTextDone: { color: K.colors.darkGreen },

  // photo drop-zone (mockup-style dashed upload area)
  dropZone: {
    borderWidth: 2,
    borderColor: K.colors.border,
    borderStyle: "dashed",
    borderRadius: K.radius.xxl,
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: "center",
    marginBottom: 14,
    backgroundColor: "#fff",
  },
  dropZoneIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: K.colors.bgTint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  dropZoneTitle: { fontSize: K.font.base, fontWeight: "700", color: K.colors.textDark, textAlign: "center" },
  dropZoneSub: { fontSize: K.font.xs, color: K.colors.textMuted, marginTop: 4, textAlign: "center" },
  dropZoneProgressWrap: { width: "100%", marginTop: 16 },
  dropZoneProgressTrack: {
    height: 6,
    borderRadius: K.radius.full,
    backgroundColor: K.colors.border,
    overflow: "hidden",
  },
  dropZoneProgressFill: { height: 6, borderRadius: K.radius.full, backgroundColor: K.colors.accent },
  dropZoneProgressText: { fontSize: K.font.xs, color: K.colors.textMuted, marginTop: 8, textAlign: "center", fontWeight: "600" },

  // photo action buttons (Camera + Upload row)
  photoBtnRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  photoBtnOutline: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderWidth: 1.5,
    borderColor: K.colors.accent,
    borderRadius: K.radius.lg,
    paddingVertical: 13,
    backgroundColor: "#fff",
  },
  photoBtnOutlineText: { fontSize: K.font.sm, fontWeight: "700", color: K.colors.darkGreen },
  photoBtnFill: {
    flex: 1.4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: K.radius.lg,
    paddingVertical: 13,
    backgroundColor: K.colors.darkGreen,
  },
  photoBtnFillText: { fontSize: K.font.sm, fontWeight: "700", color: "#fff" },
  photoBtnDisabled: { opacity: 0.45 },

  // photo grid
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 8 },
  photoItem: { position: "relative", borderRadius: K.radius.lg, overflow: "hidden" },
  photoThumb: { width: (W - 64) / 3, height: (W - 64) / 3 },
  coverBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: K.colors.darkGreen,
    borderRadius: 6,
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
  reorderBtns: {
    position: "absolute",
    bottom: 6,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 6,
  },
  reorderBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.60)",
    alignItems: "center",
    justifyContent: "center",
  },

  // documents
  docCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: K.radius.xl,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: K.colors.border,
    ...K.shadow.sm,
  },
  docCardDone: { borderColor: "#9be3bf", backgroundColor: K.colors.bgTint },
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
  docDeleteBtn: {
    width: 32,
    height: 32,
    borderRadius: K.radius.sm,
    borderWidth: 1.5,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
  },
  docUploadBtn: {
    backgroundColor: K.colors.darkGreen,
    borderRadius: K.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 9,
    minWidth: 70,
    alignItems: "center",
  },
  docUploadBtnReplace: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: K.colors.accent,
  },
  docUploadBtnText: { fontSize: K.font.xs, fontWeight: "700", color: "#fff" },
  // photo error
  photoError: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF2F2",
    borderRadius: K.radius.md,
    padding: 9,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  photoErrorText: { fontSize: K.font.xs, color: K.colors.error, fontWeight: "600" as const, flex: 1 },

  // step progress bar — thin segmented bar, matches the mockups
  progressWrap: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    paddingTop: 4,
  },
  progressSegmentRow: { flexDirection: "row" },
  progressSegment: {
    flex: 1,
    height: 5,
    borderRadius: K.radius.full,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  progressSegmentDone: { backgroundColor: K.colors.accent },
  progressCaption: { fontSize: K.font.xs, color: "rgba(255,255,255,0.65)", fontWeight: "600", marginTop: 10, textAlign: "center" },
  progressCaptionStrong: { color: "#fff", fontWeight: "800" },

  // wizard header
  wizardHeader: {
    backgroundColor: K.colors.darkGreen,
    borderBottomLeftRadius: K.radius.xxl,
    borderBottomRightRadius: K.radius.xxl,
    overflow: "hidden",
  },
  wizardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 4,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: K.radius.md,
    backgroundColor: K.colors.glassBg,
    borderWidth: 1,
    borderColor: K.colors.glassBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  wizardHeaderCenter: { flex: 1, alignItems: "center" },
  wizardLogo: { width: 56, height: 20, marginBottom: 4 },
  wizardHeaderTitle: { fontSize: K.font.lg, fontWeight: "800", color: "#fff" },

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
    borderRadius: K.radius.md,
    padding: 9,
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
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  footerNextBtnDisabled: { opacity: 0.45 },
  footerNextInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  footerNextText: { color: "#fff", fontWeight: "700", fontSize: K.font.base },
});

// ── SelectField ───────────────────────────────────────────────────────────────
//
// Native equivalent of the web forms' <Select>: a control showing the current
// value that opens a bottom-sheet option list. Used everywhere the web wizard
// uses a dropdown, so both clients present the same choices the same way.

export function SelectField({
  label,
  required,
  hint,
  options,
  selected,
  onSelect,
  placeholder = "Select…",
  error,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  selected: string;
  onSelect: (value: string) => void;
  placeholder?: string;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === selected);

  return (
    <View style={selStyles.wrap}>
      <Text style={selStyles.label}>
        {label}
        {required ? <Text style={selStyles.req}> *</Text> : null}
      </Text>
      {hint ? <Text style={selStyles.hint}>{hint}</Text> : null}

      <TouchableOpacity
        style={[selStyles.control, !!error && selStyles.controlError]}
        onPress={() => setOpen(true)}
        activeOpacity={0.75}
      >
        <Text style={current ? selStyles.value : selStyles.placeholder} numberOfLines={1}>
          {current?.label ?? placeholder}
        </Text>
        <Feather name="chevron-down" size={18} color={K.colors.textMuted} />
      </TouchableOpacity>

      {error ? <Text style={selStyles.error}>{error}</Text> : null}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={selStyles.overlay}>
          <View style={selStyles.sheet}>
            <View style={selStyles.sheetHeader}>
              <Text style={selStyles.sheetTitle}>{label}</Text>
              <TouchableOpacity
                onPress={() => setOpen(false)}
                hitSlop={{ top: 10, bottom: 10, left: 12, right: 12 }}
              >
                <Feather name="x" size={20} color={K.colors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              {options.map((opt) => {
                const active = opt.value === selected;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[selStyles.option, active && selStyles.optionActive]}
                    onPress={() => {
                      onSelect(opt.value);
                      setOpen(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[selStyles.optionText, active && selStyles.optionTextActive]}>
                      {opt.label}
                    </Text>
                    {active ? (
                      <Feather name="check" size={17} color={K.colors.darkGreen} />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={{ height: 20 }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const selStyles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: "600", color: K.colors.textDark, marginBottom: 4 },
  req: { color: "#DC2626" },
  hint: { fontSize: 12, color: K.colors.textMuted, marginBottom: 6 },
  control: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderWidth: 1,
    borderColor: K.colors.border,
    borderRadius: 10,
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  controlError: { borderColor: "#DC2626" },
  value: { flex: 1, fontSize: 15, color: K.colors.textDark, fontWeight: "600" },
  placeholder: { flex: 1, fontSize: 15, color: K.colors.textMuted },
  error: { fontSize: 12, color: "#DC2626", marginTop: 4 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: K.colors.bgApp,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingBottom: 8,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: K.colors.border,
  },
  sheetTitle: { fontSize: 16, fontWeight: "800", color: K.colors.textDark },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: K.colors.border,
  },
  optionActive: { backgroundColor: K.colors.bgTint },
  optionText: { fontSize: 15, color: K.colors.textDark },
  optionTextActive: { fontWeight: "700", color: K.colors.darkGreen },
});
