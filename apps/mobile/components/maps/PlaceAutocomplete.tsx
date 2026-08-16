import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { K } from "../../constants/theme";
import {
  fetchPlaceSuggestions,
  fetchPlaceDetails,
  isGoogleMapsConfigured,
  newSessionToken,
  type PlaceSuggestion,
  type ResolvedPlace,
} from "../../lib/google-maps";

interface Props {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  /** Fired once the chosen place has been resolved to coordinates. */
  onResolved: (place: ResolvedPlace) => void;
  placeholder?: string;
  error?: string;
  /**
   * Optional point to rank nearby results higher. A *bias*, never a filter:
   * a provider listing a property abroad still finds it.
   */
  biasLocation?: { lat: number; lng: number } | null;
}

const DEBOUNCE_MS = 300;
const MIN_CHARS = 3;

/**
 * Search-as-you-type over Google Places.
 *
 * Matches business names, not just street addresses — "La Detente" finds the
 * hotel without the provider knowing its street. The chosen suggestion carries
 * a place id, which resolves to the building rather than to a geocoder's
 * interpretation of a text string.
 */
export function PlaceAutocomplete({
  label,
  value,
  onChange,
  onResolved,
  placeholder = "Search your property by name or address",
  error,
  biasLocation,
}: Props) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionRef = useRef<string | null>(null);
  /** Guards against a slower earlier request overwriting a newer one. */
  const seqRef = useRef(0);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    []
  );

  const search = useCallback(
    async (input: string) => {
      const seq = ++seqRef.current;
      setLoading(true);
      try {
        sessionRef.current ??= newSessionToken();
        const results = await fetchPlaceSuggestions(input, {
          sessionToken: sessionRef.current,
          ...(biasLocation ? { biasLocation } : {}),
        });
        if (seq !== seqRef.current) return; // a newer keystroke won
        setFailed(false);
        setSuggestions(results);
      } catch {
        if (seq !== seqRef.current) return;
        setFailed(true);
        setSuggestions([]);
      } finally {
        if (seq === seqRef.current) setLoading(false);
      }
    },
    [biasLocation?.lat, biasLocation?.lng]
  );

  const handleChange = (next: string) => {
    onChange(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (next.trim().length < MIN_CHARS) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(() => void search(next), DEBOUNCE_MS);
  };

  const handleSelect = async (suggestion: PlaceSuggestion) => {
    setSuggestions([]);
    setLoading(true);
    try {
      const place = await fetchPlaceDetails(suggestion.placeId, {
        ...(sessionRef.current ? { sessionToken: sessionRef.current } : {}),
      });
      // Session is consumed by the details call; the next search starts fresh.
      sessionRef.current = null;

      if (!place) {
        setFailed(true);
        return;
      }
      onChange(place.address || suggestion.primary);
      onResolved(place);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const configured = isGoogleMapsConfigured();

  return (
    <View style={s.wrap}>
      {label ? <Text style={s.label}>{label}</Text> : null}

      <View style={[s.inputRow, !!error && s.inputRowError]}>
        <Ionicons name="search" size={17} color={K.colors.textMuted} />
        <TextInput
          style={s.input}
          value={value}
          editable={configured}
          onChangeText={handleChange}
          placeholder={configured ? placeholder : "Search unavailable"}
          placeholderTextColor={K.colors.textMuted}
          autoCapitalize="words"
          autoCorrect={false}
        />
        {loading ? <ActivityIndicator size="small" color={K.colors.accent} /> : null}
      </View>

      {suggestions.length > 0 && (
        <View style={s.dropdown}>
          {suggestions.map((item, i) => (
            <TouchableOpacity
              key={item.placeId}
              style={[s.row, i > 0 && s.rowDivider]}
              onPress={() => void handleSelect(item)}
              activeOpacity={0.7}
            >
              <Ionicons
                name="location"
                size={16}
                color={K.colors.accent}
                style={{ marginTop: 2 }}
              />
              <View style={s.rowText}>
                <Text style={s.rowPrimary} numberOfLines={1}>
                  {item.primary}
                </Text>
                {item.secondary ? (
                  <Text style={s.rowSecondary} numberOfLines={1}>
                    {item.secondary}
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {error ? <Text style={s.error}>{error}</Text> : null}
      {failed && !error ? (
        <Text style={s.warn}>
          Search is unavailable right now — you can still drop the pin manually.
        </Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginBottom: 12 },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: K.colors.textDark,
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: K.colors.border,
    borderRadius: 10,
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  inputRowError: { borderColor: "#EF4444" },
  input: { flex: 1, fontSize: 16, color: K.colors.textDark, padding: 0 },
  dropdown: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: K.colors.border,
    borderRadius: 10,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: K.colors.border },
  rowText: { flex: 1 },
  rowPrimary: { fontSize: 14, fontWeight: "700", color: K.colors.textDark },
  rowSecondary: { fontSize: 12, color: K.colors.textMuted, marginTop: 1 },
  error: { fontSize: 12, color: "#EF4444", marginTop: 4 },
  warn: { fontSize: 12, color: "#B45309", marginTop: 4 },
});
