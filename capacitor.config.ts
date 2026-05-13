import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'kr.raonisis.boa',
  appName: 'BOA 지점관리 CRM',
  webDir: 'dist/public',
  server: {
    url: 'https://raonisis.kr',
    cleartext: false,
  },
};

export default config;
