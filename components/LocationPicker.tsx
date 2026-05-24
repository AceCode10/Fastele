import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { useTheme } from '@/lib/theme';

// Lusaka centre — used when we have no other signal.
const LUSAKA_FALLBACK = { latitude: -15.4167, longitude: 28.2833 };

const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? '';

export type PickedLocation = {
  address: string;
  latitude: number;
  longitude: number;
};

type Props = {
  label?: string;
  hint?: string;
  initial?: PickedLocation | null;
  onChange: (loc: PickedLocation) => void;
};

type Suggestion = {
  description: string;
  place_id: string;
};

/**
 * Inline Google Maps location picker.
 * - Search box uses Places Autocomplete (requires Places API enabled on key).
 * - Map has a draggable marker; drag-end reverse-geocodes via expo-location.
 * - "Use my location" button uses expo-location foreground permission.
 *
 * Emits {address, latitude, longitude} via onChange any time the value
 * settles (autocomplete pick, drag-end, or my-location).
 */
export function LocationPicker({ label, hint, initial, onChange }: Props) {
  const { c, type, spacing, radius } = useTheme();

  const [marker, setMarker] = useState<{ latitude: number; longitude: number }>(() =>
    initial
      ? { latitude: initial.latitude, longitude: initial.longitude }
      : LUSAKA_FALLBACK
  );
  const [address, setAddress] = useState<string>(initial?.address ?? '');
  const [query, setQuery] = useState<string>(initial?.address ?? '');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [busyLocate, setBusyLocate] = useState(false);
  const [reverseBusy, setReverseBusy] = useState(false);

  const mapRef = useRef<MapView | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionTokenRef = useRef<string>(makeSessionToken());

  const region: Region = useMemo(
    () => ({
      latitude: marker.latitude,
      longitude: marker.longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    }),
    [marker.latitude, marker.longitude]
  );

  // Emit upward whenever both address + coords are settled.
  useEffect(() => {
    if (!address) return;
    onChange({ address, latitude: marker.latitude, longitude: marker.longitude });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, marker.latitude, marker.longitude]);

  // Debounced Places Autocomplete.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 3 || q === address) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(() => fetchSuggestions(q), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function fetchSuggestions(q: string) {
    if (!GOOGLE_KEY) return;
    setSearching(true);
    try {
      // Bias to Zambia + ~50km around current marker.
      const url =
        `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
        `?input=${encodeURIComponent(q)}` +
        `&components=country:zm` +
        `&location=${marker.latitude},${marker.longitude}` +
        `&radius=50000` +
        `&sessiontoken=${sessionTokenRef.current}` +
        `&key=${GOOGLE_KEY}`;
      const res = await fetch(url);
      const json = (await res.json()) as {
        status: string;
        predictions?: Array<{ description: string; place_id: string }>;
      };
      if (json.status === 'OK' && json.predictions) {
        setSuggestions(
          json.predictions.slice(0, 5).map((p) => ({
            description: p.description,
            place_id: p.place_id,
          }))
        );
      } else {
        setSuggestions([]);
      }
    } catch {
      setSuggestions([]);
    } finally {
      setSearching(false);
    }
  }

  async function pickSuggestion(s: Suggestion) {
    Keyboard.dismiss();
    setSuggestions([]);
    if (!GOOGLE_KEY) {
      // Without a key we can only show the description text.
      setAddress(s.description);
      setQuery(s.description);
      return;
    }
    try {
      const url =
        `https://maps.googleapis.com/maps/api/place/details/json` +
        `?place_id=${s.place_id}` +
        `&fields=geometry,formatted_address` +
        `&sessiontoken=${sessionTokenRef.current}` +
        `&key=${GOOGLE_KEY}`;
      const res = await fetch(url);
      const json = (await res.json()) as {
        status: string;
        result?: {
          geometry?: { location?: { lat: number; lng: number } };
          formatted_address?: string;
        };
      };
      const loc = json.result?.geometry?.location;
      const formatted = json.result?.formatted_address ?? s.description;
      if (loc) {
        setMarker({ latitude: loc.lat, longitude: loc.lng });
        mapRef.current?.animateToRegion(
          { latitude: loc.lat, longitude: loc.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 },
          400
        );
        setAddress(formatted);
        setQuery(formatted);
      } else {
        setAddress(s.description);
        setQuery(s.description);
      }
    } catch {
      setAddress(s.description);
      setQuery(s.description);
    } finally {
      // New session token after a pick (per Google billing best-practice).
      sessionTokenRef.current = makeSessionToken();
    }
  }

  async function reverseGeocode(latitude: number, longitude: number) {
    setReverseBusy(true);
    try {
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (results.length > 0) {
        const r = results[0];
        const parts = [r.name, r.street, r.district, r.city, r.region]
          .filter((v): v is string => !!v && v.trim().length > 0);
        const formatted = Array.from(new Set(parts)).join(', ');
        if (formatted) {
          setAddress(formatted);
          setQuery(formatted);
        }
      }
    } catch {
      /* swallow — keep prior address */
    } finally {
      setReverseBusy(false);
    }
  }

  async function useMyLocation() {
    setBusyLocate(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const next = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setMarker(next);
      mapRef.current?.animateToRegion(
        { ...next, latitudeDelta: 0.01, longitudeDelta: 0.01 },
        400
      );
      await reverseGeocode(next.latitude, next.longitude);
    } finally {
      setBusyLocate(false);
    }
  }

  return (
    <View style={{ marginBottom: spacing.lg }}>
      {label ? (
        <Text style={[type.bodyStrong, { color: c.text, marginBottom: 6 }]}>{label}</Text>
      ) : null}

      {/* Search box */}
      <View style={{ position: 'relative', zIndex: 2 }}>
        <TextInput
          placeholder="Search address or place"
          placeholderTextColor={c.textMuted}
          value={query}
          onChangeText={setQuery}
          style={{
            backgroundColor: c.surfaceAlt,
            borderRadius: radius.md,
            paddingHorizontal: 14,
            minHeight: 48,
            color: c.text,
            fontSize: 16,
          }}
          returnKeyType="search"
        />
        {searching && (
          <ActivityIndicator
            color={c.primary}
            style={{ position: 'absolute', right: 14, top: 14 }}
          />
        )}

        {suggestions.length > 0 && (
          <View
            style={{
              position: 'absolute',
              top: 52,
              left: 0,
              right: 0,
              backgroundColor: c.surface,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: c.border,
              elevation: 6,
              shadowColor: '#000',
              shadowOpacity: 0.1,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
            }}
          >
            <FlatList
              data={suggestions}
              keyExtractor={(it) => it.place_id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => pickSuggestion(item)}
                  style={({ pressed }) => ({
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    opacity: pressed ? 0.6 : 1,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: c.border,
                  })}
                >
                  <Text style={[type.body, { color: c.text }]} numberOfLines={2}>
                    {item.description}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        )}
      </View>

      {/* Map */}
      <View
        style={{
          marginTop: 10,
          height: 200,
          borderRadius: radius.md,
          overflow: 'hidden',
          backgroundColor: c.surfaceAlt,
        }}
      >
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFillObject}
          initialRegion={region}
          showsUserLocation
        >
          <Marker
            draggable
            coordinate={marker}
            onDragEnd={(e) => {
              const { latitude, longitude } = e.nativeEvent.coordinate;
              setMarker({ latitude, longitude });
              reverseGeocode(latitude, longitude);
            }}
          />
        </MapView>
      </View>

      {/* Footer row */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 8,
        }}
      >
        <Pressable
          onPress={useMyLocation}
          disabled={busyLocate}
          style={({ pressed }) => ({
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: radius.pill,
            backgroundColor: c.surfaceAlt,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text style={[type.caption, { color: c.primary, fontWeight: '600' }]}>
            {busyLocate ? 'Locating…' : '📍 Use my location'}
          </Text>
        </Pressable>
        {reverseBusy ? (
          <ActivityIndicator color={c.primary} />
        ) : address ? (
          <Text
            style={[type.caption, { color: c.textMuted, flex: 1, textAlign: 'right', marginLeft: 8 }]}
            numberOfLines={1}
          >
            {address}
          </Text>
        ) : (
          <Text style={[type.caption, { color: c.textMuted }]}>Drag pin to set</Text>
        )}
      </View>

      {hint ? (
        <Text style={[type.caption, { color: c.textMuted, marginTop: 6 }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

function makeSessionToken() {
  // Cheap, non-crypto session token — Google just wants stable per-search-session id.
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
