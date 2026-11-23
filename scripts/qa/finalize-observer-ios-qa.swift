import Foundation

// Apply the Observer-only runtime config after an unsigned PersonalTeamQA build.
// This never edits the Xcode project or the existing PersonalTeamQA source.
guard CommandLine.arguments.count == 3 else {
    fatalError("Usage: swift finalize-observer-ios-qa.swift <unsigned App.app> <Observer config.json>")
}
let app = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
let template = URL(fileURLWithPath: CommandLine.arguments[2])
let authenticated = ProcessInfo.processInfo.environment["OBSERVER_QA_AUTH_BUILD"] == "1"
let previewReachability = ProcessInfo.processInfo.environment["OBSERVER_QA_PREVIEW_REACHABILITY"] == "1"
guard !previewReachability || authenticated else { fatalError("OBSERVER_QA_PREVIEW_REQUIRES_AUTH_OPT_IN") }
let statusPageName = authenticated ? "auth-unavailable.html" : "index.html"
let statusPage = URL(fileURLWithPath: "ios/qa-observer/\(statusPageName)", relativeTo: URL(fileURLWithPath: FileManager.default.currentDirectoryPath, isDirectory: true))
let files = FileManager.default
guard app.pathExtension == "app", files.fileExists(atPath: app.appendingPathComponent("Info.plist").path) else {
    fatalError("OBSERVER_QA_APP_REQUIRED")
}
guard !files.fileExists(atPath: app.appendingPathComponent("_CodeSignature").path),
      !files.fileExists(atPath: app.appendingPathComponent("embedded.mobileprovision").path) else {
    fatalError("OBSERVER_QA_UNSIGNED_ONLY")
}
let infoData = try Data(contentsOf: app.appendingPathComponent("Info.plist"))
guard let info = try PropertyListSerialization.propertyList(from: infoData, format: nil) as? [String: Any],
      info["CFBundleIdentifier"] as? String == "com.digitalobserver.app.qa",
      info["CFBundleDisplayName"] as? String == "תצפיתן דיגיטלי",
      info["UILaunchStoryboardName"] as? String == "ObserverQALaunch",
      let icons = info["CFBundleIcons"] as? [String: Any],
      let primaryIcon = icons["CFBundlePrimaryIcon"] as? [String: Any],
      primaryIcon["CFBundleIconName"] as? String == "ObserverQAIcon",
      let urlTypes = info["CFBundleURLTypes"] as? [[String: Any]],
      urlTypes.count == 1,
      urlTypes[0]["CFBundleURLSchemes"] as? [String] == ["observerqaapp"],
      info["aps-environment"] == nil,
      info["com.apple.developer.associated-domains"] == nil,
      files.fileExists(atPath: app.appendingPathComponent("Assets.car").path),
      !files.fileExists(atPath: app.appendingPathComponent("GoogleService-Info.plist").path) else {
    fatalError("OBSERVER_QA_IDENTITY_OR_PUSH_BOUNDARY_INVALID")
}
let launchSource = URL(fileURLWithPath: "ios/qa-observer/ObserverQALaunch.storyboard",
                       relativeTo: URL(fileURLWithPath: files.currentDirectoryPath, isDirectory: true))
let launchBundle = app.appendingPathComponent("ObserverQALaunch.storyboardc", isDirectory: true)
guard files.fileExists(atPath: launchSource.path), !files.fileExists(atPath: launchBundle.path) else {
    fatalError("OBSERVER_QA_LAUNCH_SOURCE_OR_DESTINATION_INVALID")
}
let compiler = Process()
compiler.executableURL = URL(fileURLWithPath: "/usr/bin/xcrun")
compiler.arguments = ["ibtool", "--compile", launchBundle.path, launchSource.path]
try compiler.run()
compiler.waitUntilExit()
guard compiler.terminationStatus == 0, files.fileExists(atPath: launchBundle.path) else {
    fatalError("OBSERVER_QA_LAUNCH_COMPILE_FAILED")
}
let data = try Data(contentsOf: template)
guard let config = try JSONSerialization.jsonObject(with: data) as? [String: Any],
      config["appId"] as? String == "com.digitalobserver.app.qa",
      config["appName"] as? String == "תצפיתן דיגיטלי",
      config["webDir"] as? String == "public",
      let server = config["server"] as? [String: Any],
      server["iosScheme"] as? String == "capacitor",
      let classes = config["packageClassList"] as? [String],
      !classes.contains("PushNotificationsPlugin") else {
    fatalError("OBSERVER_QA_RUNTIME_CONFIG_INVALID")
}
if authenticated {
    let expectedUrl = previewReachability
        ? "https://digital-observer-bwhfz2moe-gan-batuach-s-projects.vercel.app/digital-observer/dashboard"
        : "https://observer-qa.ganbatuach.com/digital-observer/dashboard"
    guard server["url"] as? String == expectedUrl,
          server["cleartext"] as? Bool == false,
          ProcessInfo.processInfo.environment["OBSERVER_QA_CALLBACK"] == "observerqaapp://return/qa/device-proof" else {
        fatalError("OBSERVER_QA_AUTH_BUILD_BOUNDARY_INVALID")
    }
} else {
    guard server["url"] == nil else { fatalError("OBSERVER_QA_OFFLINE_URL_FORBIDDEN") }
}
let status = try Data(contentsOf: statusPage)
guard let page = String(data: status, encoding: .utf8),
      page.contains(authenticated ? "חיבור QA טרם אומת" : "בדיקת התקנה מקומית בלבד"),
      !page.contains("http://"), !page.contains("https://"),
      !page.contains("fetch("), !page.contains("<script") else {
    fatalError("OBSERVER_QA_OFFLINE_PAGE_INVALID")
}
try status.write(to: app.appendingPathComponent("public/index.html"), options: .atomic)
for name in ["sw.js", "firebase-messaging-sw.js"] {
    let worker = app.appendingPathComponent("public/\(name)")
    if files.fileExists(atPath: worker.path) { try files.removeItem(at: worker) }
}
try data.write(to: app.appendingPathComponent("capacitor.config.json"), options: .atomic)
print(authenticated ? "Observer iOS QA unsigned authenticated-origin candidate finalized; external route not verified" :
    "Observer iOS QA unsigned bundle finalized with isolated identity and local offline screen")
