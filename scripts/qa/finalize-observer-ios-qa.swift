import Foundation

// Apply the Observer-only runtime config after an unsigned PersonalTeamQA build.
// This never edits the Xcode project or the existing PersonalTeamQA source.
guard CommandLine.arguments.count == 3 else {
    fatalError("Usage: swift finalize-observer-ios-qa.swift <unsigned App.app> <Observer config.json>")
}
let app = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
let template = URL(fileURLWithPath: CommandLine.arguments[2])
let offlinePage = template.deletingLastPathComponent().appendingPathComponent("index.html")
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
let launchSource = template.deletingLastPathComponent().appendingPathComponent("ObserverQALaunch.storyboard")
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
      server["url"] == nil, server["iosScheme"] as? String == "capacitor",
      let classes = config["packageClassList"] as? [String],
      !classes.contains("PushNotificationsPlugin") else {
    fatalError("OBSERVER_QA_RUNTIME_CONFIG_INVALID")
}
let offline = try Data(contentsOf: offlinePage)
guard let page = String(data: offline, encoding: .utf8),
      page.contains("בדיקת התקנה מקומית בלבד"),
      !page.contains("http://"), !page.contains("https://"),
      !page.contains("fetch("), !page.contains("<script") else {
    fatalError("OBSERVER_QA_OFFLINE_PAGE_INVALID")
}
try offline.write(to: app.appendingPathComponent("public/index.html"), options: .atomic)
for name in ["sw.js", "firebase-messaging-sw.js"] {
    let worker = app.appendingPathComponent("public/\(name)")
    if files.fileExists(atPath: worker.path) { try files.removeItem(at: worker) }
}
try data.write(to: app.appendingPathComponent("capacitor.config.json"), options: .atomic)
print("Observer iOS QA unsigned bundle finalized with isolated identity and local offline screen")
