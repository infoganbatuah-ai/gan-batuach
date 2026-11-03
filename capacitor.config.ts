const mobileAppUrl = process.env.CAPACITOR_SERVER_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const isLocalMobileUrl = (() => {
  try {
    // Require an explicit non-empty authority; URL normalizes hostnames and IPv4.
    const authority = /^http:\/\/([^/?#\\]+)/i.exec(mobileAppUrl)?.[1];
    if (!authority || authority.includes("@") || /\s/.test(authority)) return false;
    const url = new URL(mobileAppUrl);
    return url.protocol === "http:" && !url.username && !url.password &&
      ["localhost", "127.0.0.1", "10.0.2.2"].includes(url.hostname);
  } catch {
    return false;
  }
})();

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
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    },
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
