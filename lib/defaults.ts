import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  pickup: 'fastele.default_pickup',
  delivery: 'fastele.default_delivery',
  airtelMsisdn: 'fastele.airtel_msisdn',
};

export async function getDefaults() {
  const [pickup, delivery, airtelMsisdn] = await Promise.all([
    AsyncStorage.getItem(KEYS.pickup),
    AsyncStorage.getItem(KEYS.delivery),
    AsyncStorage.getItem(KEYS.airtelMsisdn),
  ]);
  return {
    pickup: pickup ?? 'Soweto Market',
    delivery: delivery ?? '',
    airtelMsisdn: airtelMsisdn ?? '',
  };
}

export async function saveDefaults(partial: {
  pickup?: string;
  delivery?: string;
  airtelMsisdn?: string;
}) {
  const pairs: [string, string][] = [];
  if (partial.pickup) pairs.push([KEYS.pickup, partial.pickup]);
  if (partial.delivery) pairs.push([KEYS.delivery, partial.delivery]);
  if (partial.airtelMsisdn) pairs.push([KEYS.airtelMsisdn, partial.airtelMsisdn]);
  await AsyncStorage.multiSet(pairs);
}
