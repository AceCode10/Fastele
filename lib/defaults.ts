import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  pickup: 'fastele.default_pickup',
  delivery: 'fastele.default_delivery',
  deliveryLat: 'fastele.default_delivery_lat',
  deliveryLng: 'fastele.default_delivery_lng',
  airtelMsisdn: 'fastele.airtel_msisdn',
};

export async function getDefaults() {
  const [pickup, delivery, deliveryLat, deliveryLng, airtelMsisdn] = await Promise.all([
    AsyncStorage.getItem(KEYS.pickup),
    AsyncStorage.getItem(KEYS.delivery),
    AsyncStorage.getItem(KEYS.deliveryLat),
    AsyncStorage.getItem(KEYS.deliveryLng),
    AsyncStorage.getItem(KEYS.airtelMsisdn),
  ]);
  const lat = deliveryLat ? parseFloat(deliveryLat) : null;
  const lng = deliveryLng ? parseFloat(deliveryLng) : null;
  return {
    pickup: pickup ?? 'Soweto Market',
    delivery: delivery ?? '',
    deliveryLat: Number.isFinite(lat as number) ? (lat as number) : null,
    deliveryLng: Number.isFinite(lng as number) ? (lng as number) : null,
    airtelMsisdn: airtelMsisdn ?? '',
  };
}

export async function saveDefaults(partial: {
  pickup?: string;
  delivery?: string;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  airtelMsisdn?: string;
}) {
  const pairs: [string, string][] = [];
  if (partial.pickup) pairs.push([KEYS.pickup, partial.pickup]);
  if (partial.delivery) pairs.push([KEYS.delivery, partial.delivery]);
  if (typeof partial.deliveryLat === 'number') pairs.push([KEYS.deliveryLat, String(partial.deliveryLat)]);
  if (typeof partial.deliveryLng === 'number') pairs.push([KEYS.deliveryLng, String(partial.deliveryLng)]);
  if (partial.airtelMsisdn) pairs.push([KEYS.airtelMsisdn, partial.airtelMsisdn]);
  if (pairs.length) await AsyncStorage.multiSet(pairs);
}
