import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.qtbm.south',
  appName: 'محفظة الجنوب',
  webDir: 'out',
  server: {
    androidScheme: 'https',
    // No cleartext - use HTTPS scheme
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#E60000',
      showSpinner: false,
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#E60000',
    },
    App: {
      launchAutoHide: true,
    },
  },
  android: {
    backgroundColor: '#E60000',
    allowMixedContent: true,
    // Make WebView feel native
    useLegacyBridge: false,
  },
  // Prevent web-like behavior
  preferences: {
    ScrollEnabled: false,
  },
};

export default config;
