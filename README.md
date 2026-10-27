# Clocked & Paid mobile

React Native + Expo mobile client for the Clocked & Paid monorepo.

This is a UI-first, local-first scaffold. The backend is intentionally represented by typed no-op adapters in `src/services/backend.ts` until the backend phase is implemented.

## Commands

```bash
npm install
npm run start
npm run android
npm run ios
npm run typecheck
```

See [`../docs/MOBILE_SCOPE.md`](../docs/MOBILE_SCOPE.md) for phase scope and follow-up work.

## App icon and launch screen

The native icon and splash use the client's pink C&P wordmark, recreated as sharp 1024px assets in `assets/branding/`. The iOS icon is opaque and square (the OS applies its mask). Android has a separate transparent adaptive foreground and monochrome mask, with the mark inside the safe area. The splash uses a centered logo over `#100a0d`, matching the app background.

Configuration lives in `app.json`, using `expo-splash-screen` and `expo-system-ui`. The root layout retains the native splash; bootstrap releases it after the loaded workspace or recovery screen has laid out. The privacy-loading screen uses the same artwork. There is no artificial launch delay.

After changing branding/configuration, sync the existing native projects without deleting their customizations:

```bash
npx expo prebuild --no-install --skip-dependency-update react,react-native
npx pod-install
```

Build Android for client testing:

```bash
npx expo run:android --variant release
```

The APK is `android/app/build/outputs/apk/release/app-release.apk`. Rebuild and reinstall to see native icon/splash changes; a Metro reload cannot update them. For iOS, rebuild the existing `ios/ClockedPaid.xcworkspace` in Xcode, or run `npm run ios`. Test a cold launch of the installed release app; development clients and Expo Go can display different launch screens. See [Expo's splash and icon guidance](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/).

To regenerate the source assets on macOS:

```bash
swift -module-cache-path /private/tmp/clocked-paid-swift-cache scripts/generate-branding.swift
```

Native prebuild and CocoaPods installation have been applied. The existing iOS scene delegate, Podfile safeguards and quoted bundle script were preserved. Device acceptance is still required for launch appearance, launcher masks/themed icons and privacy-locked startup.
