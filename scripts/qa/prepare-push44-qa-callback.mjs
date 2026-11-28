// The PersonalTeamQA Info.plist source is selected by the validated build
// setting, never by mutating a generated app bundle after signing.
const mode = process.env.PUSH44_QA_CALLBACK_SCHEME;
if (mode !== "off" && mode !== "observerqa")
  throw new Error("QA_CALLBACK_SCHEME_NOT_ALLOWED");
console.log(`QA callback build mode: ${mode}`);
