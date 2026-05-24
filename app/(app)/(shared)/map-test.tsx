import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Button } from '@/components/ui';
import { useTheme } from '@/lib/theme';

// Smoke test for Google Maps + expo-location.
// Route: /(app)/(shared)/map-test
// Verifies: API key wiring (Android), location permission, native module link.
export default function MapTest() {
  const { c, type, spacing } = useTheme();
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function locate() {
    setLoading(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission denied. Enable it in system settings.');
        setLoading(false);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    } catch (e: any) {
      setError(e?.message ?? 'Failed to get location');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    locate();
  }, []);

  // Lusaka fallback so the map still renders if permission denied.
  const region = {
    latitude: coords?.latitude ?? -15.4167,
    longitude: coords?.longitude ?? 28.2833,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ padding: spacing.lg, paddingBottom: spacing.sm }}>
        <Text style={[type.h1, { color: c.text }]}>Map smoke test</Text>
        <Text style={[type.caption, { color: c.textMuted, marginTop: spacing.xs }]}>
          Provider: {Platform.OS === 'android' ? 'Google (PROVIDER_GOOGLE)' : 'Apple Maps'}
        </Text>
        {error && (
          <Text style={[type.caption, { color: c.danger, marginTop: spacing.sm }]}>{error}</Text>
        )}
        {coords && (
          <Text style={[type.caption, { color: c.textMuted, marginTop: spacing.xs }]}>
            {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
          </Text>
        )}
      </View>

      <View style={{ flex: 1, marginHorizontal: spacing.lg, borderRadius: 16, overflow: 'hidden', backgroundColor: c.surfaceAlt }}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={c.primary} />
          </View>
        ) : (
          <MapView
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            style={StyleSheet.absoluteFillObject}
            region={region}
            showsUserLocation
            showsMyLocationButton
          >
            {coords && (
              <Marker
                coordinate={coords}
                title="You are here"
                description="Smoke test marker"
              />
            )}
          </MapView>
        )}
      </View>

      <View style={{ padding: spacing.lg }}>
        <Button label="Re-locate me" onPress={locate} loading={loading} />
        <Text style={[type.caption, { color: c.textMuted, marginTop: spacing.sm, textAlign: 'center' }]}>
          Blank gray map = API key not whitelisted for this build's SHA-1.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
