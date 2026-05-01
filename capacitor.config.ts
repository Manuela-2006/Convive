import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl =
  process.env.CAPACITOR_SERVER_URL?.trim() ||
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  "http://10.0.2.2:3000";

const config: CapacitorConfig = {
  appId: "com.convive.app",
  appName: "Convive",
  webDir: "public/capacitor",
  server: {
    // Convive depends on Next.js server features, so Android loads a real web server.
    // Use CAPACITOR_SERVER_URL for a deployed HTTPS URL or keep the default for Android emulator + local Next.
    url: serverUrl,
    cleartext: serverUrl.startsWith("http://"),
  },
  android: {
    path: "android",
  },
};

export default config;
