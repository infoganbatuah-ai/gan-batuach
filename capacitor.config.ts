const profile = process.env.CAPACITOR_BUILD_PROFILE || "development";
if (!["development", "qa", "release"].includes(profile)) throw new Error("CAPACITOR_BUILD_PROFILE_INVALID");

// Mobile builds must not inherit a web deployment URL or silently fall back to
// localhost. An explicit approved origin is required for every remote build.
const mobileAppUrl = process.env.CAPACITOR_SERVER_URL;
if (!mobileAppUrl || mobileAppUrl.trim() !== mobileAppUrl || /\s/.test(mobileAppUrl))
  throw new Error("CAPACITOR_SERVER_URL_REQUIRED");
const authority = /^https?:\/\/([^/?#]+)/i.exec(mobileAppUrl)?.[1];
if (!authority || authority.includes("@") || authority.endsWith("."))
  throw new Error("CAPACITOR_SERVER_URL_INVALID");
let parsedUrl: URL;
try { parsedUrl = new URL(mobileAppUrl); }
catch { throw new Error("CAPACITOR_SERVER_URL_INVALID"); }
if (!(["http:", "https:"].includes(parsedUrl.protocol)) || authority.toLowerCase() !== parsedUrl.host.toLowerCase() ||
  parsedUrl.username || parsedUrl.password ||
  parsedUrl.hash || parsedUrl.search || parsedUrl.pathname !== "/")
  throw new Error("CAPACITOR_SERVER_URL_INVALID");
const isLocalMobileUrl = parsedUrl.protocol === "http:" &&
  ["localhost", "127.0.0.1"].includes(parsedUrl.hostname);
if (parsedUrl.protocol === "http:" && (profile !== "development" || !isLocalMobileUrl))
  throw new Error("CAPACITOR_HTTPS_REQUIRED");
if (parsedUrl.protocol === "https:" &&
  (!process.env.CAPACITOR_ALLOWED_SERVER_ORIGIN ||
   parsedUrl.origin !== process.env.CAPACITOR_ALLOWED_SERVER_ORIGIN))
  throw new Error("CAPACITOR_SERVER_ORIGIN_NOT_APPROVED");
if (profile !== "development" && parsedUrl.protocol !== "https:")
  throw new Error("CAPACITOR_HTTPS_REQUIRED");

const config = {
  appId: profile === "release" ? "com.ganbatuach.app" : "com.ganbatuach.app.qa",
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
