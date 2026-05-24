import type { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const googleMapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY;

  if (!googleMapsKey) {
    console.warn(
      "[app.config] EXPO_PUBLIC_GOOGLE_MAPS_KEY is not set. Android maps will render blank."
    );
  }

  return {
    ...config,
    name: "Fastele",
    slug: "fastele",
    version: "0.1.0",
    orientation: "portrait",
    userInterfaceStyle: "automatic",
    // Disabled: Fabric/new-arch + react-native-screens@4 + nested Tabs has known
    // `addViewAt: specified child already has a parent` crashes. The legacy
    // (paper) renderer is rock-solid with this nav structure. Re-enable once
    // the underlying RN/screens combo stabilises.
    newArchEnabled: false,
    jsEngine: "hermes",
    scheme: "fastele",
    icon: "./assets/images/icon.png",
    android: {
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: "zm.fastele.app",
      permissions: [
        "android.permission.CAMERA",
        "android.permission.READ_MEDIA_IMAGES",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.CALL_PHONE",
        "android.permission.RECORD_AUDIO",
      ],
      config: {
        googleMaps: {
          apiKey: googleMapsKey ?? "",
        },
      },
      versionCode: 1,
    },
    ios: {
      bundleIdentifier: "zm.fastele.app",
      supportsTablet: false,
    },
    web: {
      bundler: "metro",
      output: "single",
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          backgroundColor: "#E8711A",
          resizeMode: "contain",
          imageWidth: 200,
        },
      ],
      "expo-secure-store",
      "expo-font",
      [
        "expo-notifications",
        {
          color: "#E8711A",
        },
      ],
      [
        "expo-image-picker",
        {
          photosPermission:
            "Fastele needs your photos for item and handoff proof.",
          cameraPermission:
            "Fastele needs your camera for item and handoff proof.",
        },
      ],
      [
        "expo-camera",
        {
          cameraPermission:
            "Fastele uses your camera to capture purchase receipts and driver handoff proof.",
        },
      ],
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission:
            "Fastele uses location to show nearby errands.",
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: "cd9b4e7d-4db7-474f-b705-e6347ca94d6e",
      },
    },
    owner: "denny-32",
  };
};
