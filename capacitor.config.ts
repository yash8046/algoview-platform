import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.algo.insight',
  appName: 'Algo Insight',
  webDir: 'dist',
  server: {
    url: 'https://a7e49e9c-df92-462b-b2eb-f8503170d316.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
};

export default config;
