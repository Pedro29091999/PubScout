import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pubscout.app',
  appName: 'PubScout',
  webDir: 'dist',
  plugins: {
    AdMob: {
      appId: 'ca-app-pub-8748344406083155~2715385179',
    },
  },
};

export default config;
