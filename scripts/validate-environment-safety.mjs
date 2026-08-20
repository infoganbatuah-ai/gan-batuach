const appEnvironment = String(process.env.APP_ENV || process.env.NEXT_PUBLIC_APP_ENV || "demo").toLowerCase();
const allowedEnvironments = new Set(["local", "demo", "staging", "pilot", "production"]);
const productionModes = new Set(["production", "live"]);

const liveModeChecks = [
  ["COMMUNICATIONS_SEND_MODE", process.env.COMMUNICATIONS_SEND_MODE],
  ["PAYMENT_MODE", process.env.PAYMENT_MODE],
  ["INVOICE_MODE", process.env.INVOICE_MODE],
  ["EMAIL_MODE", process.env.EMAIL_MODE],
  ["SMS_MODE", process.env.SMS_MODE],
  ["WHATSAPP_MODE", process.env.WHATSAPP_MODE],
  ["PUSH_MODE", process.env.PUSH_MODE],
  ["CAMERA_GATEWAY_MODE", process.env.CAMERA_GATEWAY_MODE],
  ["AI_PROVIDER_MODE", process.env.AI_PROVIDER_MODE]
].filter(([, value]) => productionModes.has(String(value || "").toLowerCase()));

const realSendFlags = [
  "EMAIL_REAL_SEND_ENABLED",
  "SMS_REAL_SEND_ENABLED",
  "WHATSAPP_REAL_SEND_ENABLED",
  "PUSH_REAL_SEND_ENABLED",
  "LIVE_PAYMENTS_ENABLED",
  "PRODUCTION_INVOICES_ENABLED",
  "PARENT_CAMERA_VIEWING_ENABLED",
  "LIVE_AI_ENABLED"
].filter((name) => process.env[name] === "true");

const publicSecretNames = Object.keys(process.env).filter((name) =>
  name.startsWith("NEXT_PUBLIC_") && /(SECRET|PASSWORD|SERVICE_ROLE|PRIVATE_KEY|ACCESS_TOKEN)/i.test(name)
);

const errors = [];
if (!allowedEnvironments.has(appEnvironment)) {
  errors.push(`APP_ENV/NEXT_PUBLIC_APP_ENV must be one of: ${[...allowedEnvironments].join(", ")}.`);
}
if (publicSecretNames.length) {
  errors.push(`Server-only credential names must not use NEXT_PUBLIC_: ${publicSecretNames.join(", ")}.`);
}

const liveRequested = liveModeChecks.length > 0 || realSendFlags.length > 0;
if (liveRequested) {
  if (appEnvironment !== "production") errors.push("Live provider modes are forbidden outside APP_ENV=production.");
  if (process.env.PRODUCTION_ACTIVATION_APPROVED !== "true") errors.push("Live provider modes require PRODUCTION_ACTIVATION_APPROVED=true.");
  if (process.env.LIVE_ACTIVATION_CONFIRM !== "I_APPROVE_GAN_BATUACH_LIVE_ACTIVATION") {
    errors.push("Live provider modes require the explicit LIVE_ACTIVATION_CONFIRM phrase.");
  }
}

if (errors.length) {
  console.error("Environment safety validation failed:");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

const requestedNames = [
  ...liveModeChecks.map(([name]) => name),
  ...realSendFlags
];
console.log(`Environment safety PASS (${appEnvironment}). Live activation requested: ${requestedNames.length ? requestedNames.join(", ") : "no"}.`);
