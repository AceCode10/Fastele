# App images

Drop the following PNG files in this folder:

- `splash-icon.png` — splash screen logo. Recommended **1024x1024**, transparent background, centered logo. Referenced by `expo-splash-screen` plugin in `app.config.ts`.
- `icon.png` — app icon (optional but recommended). Recommended **1024x1024**, opaque.
- `adaptive-icon.png` — Android adaptive icon foreground (optional). Recommended **1024x1024** transparent.

After placing the files, run:

```powershell
npx expo prebuild --platform android --clean
```

Then build in Android Studio (or `npx expo run:android`).
