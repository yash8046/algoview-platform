import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.algo.insight',
  appName: 'Algo Insight',
  webDir: 'dist',
  server: {
    // For dev: uncomment below line and replace with your sandbox URL
    // url: 'https://a7e49e9c-df92-462b-b2eb-f8503170d316.lovableproject.com?forceHideBadge=true',
    // For production: comment out the url above
    androidScheme: 'https',
  },
  plugins: {},
};

export default config;
