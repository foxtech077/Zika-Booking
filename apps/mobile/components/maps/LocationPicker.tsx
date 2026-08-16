import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import MapView, { Marker, type Region, type MapPressEvent, type MarkerDragStartEndEvent } from "react-native-maps";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { K } from "../../constants/theme";
import { PlaceAutocomplete } from "./PlaceAutocomplete";
import {
  reverseGeocode,
  isGoogleMapsConfigured,
  type ResolvedPlace,
} from "../../lib/google-maps";

export interface PickedLocation {
  lat: number;
  lng: number;
  address: string;
  town: string;
  neighborhood: string;
  country: string;
}

interface Props {
  /** Current pin, or nulls when the listing has never been located. */
  value: { lat: number | null; lng: number | null; address: string };
  onChange: (next: PickedLocation) => void;
  /** Called when only the pin moved, leaving the typed address alone. */
  onCoordinatesChange?: (lat: number, lng: number) => void;
  /**
   * Fallback country for a GPS fix that reverse-geocoding could not resolve.
   * Deliberately NOT used to filter search: results stay worldwide.
   */
  countryHint?: string;
  label?: string;
  error?: string;
}

/** Zoom span for a located property — roughly a city block. */
const PIN_DELTA = 0.004;
/** Zoom span before anything is located — roughly a city. */
const WIDE_DELTA = 0.4;
const FALLBACK = { latitude: -1.2921, longitude: 36.8219 }; // Nairobi

/**
 * Search for a property, then fine-tune its pin.
 *
 * Search alone is not enough: a geocoder returns its best interpretation of a
 * string with no way to signal doubt, which is how a Douala hotel ended up
 * pinned 6.5 km from its front door. Showing the pin and letting the provider
 * drag it turns a silent error into an obvious one.
 */
export function LocationPicker({
  value,
  onChange,
  onCoordinatesChange,
  countryHint,
  label = "Find your property",
  error,
}: Props) {
  const [search, setSearch] = useState(value.address ?? "");
  const [locating, setLocating] = useState(false);
  const [gpsError, setGpsError] = useState("");
  const [justMoved, setJustMoved] = useState(false);

  const mapRef = useRef<MapView>(null);
  const hasPin = value.lat != null && value.lng != null;

  /**
   * Last address this component pushed upward. Lets the sync effect below tell
   * "the parent changed the address" from "we just set it ourselves" — without
   * it, the sync would fight the provider mid-keystroke.
   */
  const emittedRef = useRef(value.address ?? "");

  useEffect(() => {
    const incoming = value.address ?? "";
    if (incoming !== emittedRef.current) {
      emittedRef.current = incoming;
      setSearch(incoming);
    }
  }, [value.address]);

  /** Recentre when the pin moves from outside — search or GPS, not a drag. */
  const recenter = useCallback((lat: number, lng: number) => {
    mapRef.current?.animateToRegion(
      {
        latitude: lat,
        longitude: lng,
        latitudeDelta: PIN_DELTA,
        longitudeDelta: PIN_DELTA,
      },
      350
    );
  }, []);

  const adopt = useCallback(
    (place: ResolvedPlace) => {
      setGpsError("");
      emittedRef.current = place.address;
      setSearch(place.address);
      onChange(place);
      recenter(place.lat, place.lng);
    },
    [onChange, recenter]
  );

  /**
   * A drag is a deliberate correction, so the coordinates are authoritative and
   * applied immediately. The reverse lookup that follows only refreshes the
   * descriptive fields; if it fails, the pin still stands. The map is not
   * recentred here — yanking the view out from under the finger that just
   * placed the pin is disorienting.
   */
  const handlePinMoved = useCallback(
    async (lat: number, lng: number) => {
      onCoordinatesChange?.(lat, lng);
      setJustMoved(true);
      const resolved = await reverseGeocode(lat, lng);
      if (resolved) {
        emittedRef.current = resolved.address;
        setSearch(resolved.address);
        onChange(resolved);
      }
    },
    [onChange, onCoordinatesChange]
  );

  const useMyLocation = async () => {
    setLocating(true);
    setGpsError("");
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setGpsError("Location permission denied. Search for the address instead.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude } = pos.coords;

      const resolved = await reverseGeocode(latitude, longitude);
      if (resolved) {
        adopt(resolved);
      } else {
        // Coordinates are the valuable part — keep them even with no address.
        onCoordinatesChange?.(latitude, longitude);
        onChange({
          lat: latitude,
          lng: longitude,
          address: value.address,
          town: "",
          neighborhood: "",
          country: countryHint ?? "",
        });
        recenter(latitude, longitude);
      }
      setJustMoved(true);
    } catch {
      setGpsError("Could not read your location. Search for the address instead.");
    } finally {
      setLocating(false);
    }
  };

  const initialRegion: Region = {
    latitude: value.lat ?? FALLBACK.latitude,
    longitude: value.lng ?? FALLBACK.longitude,
    latitudeDelta: hasPin ? PIN_DELTA : WIDE_DELTA,
    longitudeDelta: hasPin ? PIN_DELTA : WIDE_DELTA,
  };

  return (
    <View style={s.wrap}>
      <PlaceAutocomplete
        label={label}
        value={search}
        onChange={setSearch}
        onResolved={adopt}
        {...(hasPin ? { biasLocation: { lat: value.lat!, lng: value.lng! } } : {})}
        {...(error ? { error } : {})}
      />

      <View style={s.gpsRow}>
        <TouchableOpacity
          style={s.gpsBtn}
          onPress={() => void useMyLocation()}
          disabled={locating}
          activeOpacity={0.8}
        >
          {locating ? (
            <ActivityIndicator size="small" color={K.colors.darkGreen} />
          ) : (
            <Ionicons name="locate" size={15} color={K.colors.darkGreen} />
          )}
          <Text style={s.gpsBtnText}>Use my current location</Text>
        </TouchableOpacity>
        <Text style={s.gpsHint}>Most accurate at the property.</Text>
      </View>

      <View style={s.mapWrap}>
        <MapView
          ref={mapRef}
          style={s.map}
          initialRegion={initialRegion}
          onPress={(e: MapPressEvent) => {
            const { latitude, longitude } = e.nativeEvent.coordinate;
            void handlePinMoved(latitude, longitude);
          }}
        >
          {hasPin && (
            <Marker
              draggable
              coordinate={{ latitude: value.lat!, longitude: value.lng! }}
              onDragEnd={(e: MarkerDragStartEndEvent) => {
                const { latitude, longitude } = e.nativeEvent.coordinate;
                void handlePinMoved(latitude, longitude);
              }}
              pinColor={K.colors.accent}
            />
          )}
        </MapView>

        {!hasPin && (
          <View style={s.mapHint} pointerEvents="none">
            <Text style={s.mapHintText}>
              Search above, use your current location, or tap the map to drop a pin.
            </Text>
          </View>
        )}

        {!isGoogleMapsConfigured() && (
          <View style={s.mapHint} pointerEvents="none">
            <Text style={s.mapHintText}>
              Search is unavailable — tap the map to place the pin manually.
            </Text>
          </View>
        )}
      </View>

      {hasPin && (
        <View style={s.coordRow}>
          <Ionicons name="location" size={14} color={K.colors.accent} />
          <Text style={s.coordText}>
            Drag the pin to the exact entrance — {value.lat!.toFixed(6)},{" "}
            {value.lng!.toFixed(6)}
          </Text>
          {justMoved && (
            <Text style={s.coordSaved}>
              <Ionicons name="checkmark-circle" size={13} /> Pin updated
            </Text>
          )}
        </View>
      )}

      {gpsError ? <Text style={s.warn}>{gpsError}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginBottom: 4 },
  gpsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  gpsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: K.colors.border,
    borderRadius: 10,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  gpsBtnText: { fontSize: 12, fontWeight: "700", color: K.colors.darkGreen },
  gpsHint: { fontSize: 11, color: K.colors.textMuted, flexShrink: 1 },
  mapWrap: {
    height: 260,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: K.colors.border,
    backgroundColor: K.colors.bgSubtle,
  },
  map: { flex: 1 },
  mapHint: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(2,18,9,0.72)",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  mapHintText: { fontSize: 11, fontWeight: "600", color: "#fff" },
  coordRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    backgroundColor: K.colors.bgSubtle,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 8,
  },
  coordText: { fontSize: 11, color: K.colors.textMuted, flexShrink: 1 },
  coordSaved: { fontSize: 11, fontWeight: "700", color: K.colors.accent },
  warn: { fontSize: 12, color: "#B45309", marginTop: 6 },
});
