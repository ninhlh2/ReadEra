import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.readera.app',
  appName: 'ReadEra',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
