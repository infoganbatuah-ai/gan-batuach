const mobileAppUrl = process.env.CAPACITOR_SERVER_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const isLocalMobileUrl = /^http:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?/i.test(mobileAppUrl);

const config = {
  appId: "com.ganbatuach.app",
  appName: "גן בטוח",
  webDir: "public",
  bundledWebRuntime: false,
  server: {
    url: mobileAppUrl,
    cleartext: isLocalMobileUrl,
    androidScheme: "https"
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#123b8f",
      showSpinner: false
    },
    Haptics: {},
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#123b8f"
    }
  }
};

export default config;
