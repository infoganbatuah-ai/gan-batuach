import Cocoa
import Security

let secretService = "com.digitalobserver.connector.commercial.v1"
let label = "com.digitalobserver.connector.commercial"
let fm = FileManager.default
let home = fm.homeDirectoryForCurrentUser
let state = home.appendingPathComponent("Library/Application Support/Digital Observer")
let installedApp = home.appendingPathComponent("Applications/Digital Observer.app")
let agent = home.appendingPathComponent("Library/LaunchAgents/\(label).plist")

// Secrets travel on pipes, never command-line arguments or plaintext config.
if CommandLine.arguments.count == 5 && CommandLine.arguments[1] == "--secret" {
    let op = CommandLine.arguments[2], service = CommandLine.arguments[3], account = CommandLine.arguments[4]
    guard service == secretService, account.range(of: "^[a-z0-9_]{2,80}$", options: .regularExpression) != nil else { exit(65) }
    let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account]
    var code: OSStatus = errSecParam
    if op == "read" {
        var read = query; read[kSecReturnData as String] = true; read[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?; code = SecItemCopyMatching(read as CFDictionary, &result)
        if code == errSecSuccess, let data = result as? Data { FileHandle.standardOutput.write(data) }
    } else if op == "write" {
        let data = FileHandle.standardInput.readDataToEndOfFile()
        guard data.count <= 65536 else { exit(65) }
        code = SecItemUpdate(query as CFDictionary, [kSecValueData as String: data] as CFDictionary)
        if code == errSecItemNotFound { var add = query; add[kSecValueData as String] = data; add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly; code = SecItemAdd(add as CFDictionary, nil) }
    } else if op == "remove" { code = SecItemDelete(query as CFDictionary) }
    exit(code == errSecSuccess ? 0 : code == errSecItemNotFound ? 44 : 70)
}

func process(_ executable: URL, _ args: [String], env: [String: String]? = nil, cwd: URL? = nil) throws -> Int32 {
    let task = Process(); task.executableURL = executable; task.arguments = args
    if let env = env { task.environment = env }; task.currentDirectoryURL = cwd
    task.standardOutput = FileHandle.nullDevice; task.standardError = FileHandle.nullDevice
    try task.run(); task.waitUntilExit(); return task.terminationStatus
}
func runtimeEnvironment(_ bundle: Bundle) -> [String: String] {
    let resources = bundle.resourceURL!
    return ["HOME": home.path, "PATH": resources.appendingPathComponent("bin").path + ":/usr/bin:/bin", "NODE_ENV": "production",
        "OBSERVER_CONNECTOR_DATA_DIR": state.path, "OBSERVER_CONNECTOR_KEYCHAIN_SERVICE": secretService,
        "OBSERVER_KEYCHAIN_HELPER": bundle.executableURL!.path,
        "OBSERVER_EDGE_VERSION": "connector-desktop-v1", "OBSERVER_EDGE_BUILD_SHA": bundle.object(forInfoDictionaryKey: "ObserverBuildSHA") as? String ?? "development",
        "VIDEO_GATEWAY_PORT": "18084", "VIDEO_GATEWAY_OBJECT_MODEL_PATH": resources.appendingPathComponent("models/ssd_mobilenet_v1_10.onnx").path,
        "VIDEO_GATEWAY_OBJECT_WORKER_PATH": resources.appendingPathComponent("runtime/services/video-gateway/onnx-object-worker.mjs").path]
}
if CommandLine.arguments.contains("--service") {
    try? fm.createDirectory(at: state, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
    let bundle = Bundle.main, resources = bundle.resourceURL!
    let code = try? process(resources.appendingPathComponent("bin/node"), ["scripts/connector-desktop-service.mjs", "--service"], env: runtimeEnvironment(bundle), cwd: resources.appendingPathComponent("runtime"))
    exit(code ?? 70)
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    var window: NSWindow!
    var message: NSTextField!
    var busy = false
    func applicationDidFinishLaunching(_ notification: Notification) {
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 560, height: 300), styleMask: [.titled, .closable, .miniaturizable], backing: .buffered, defer: false)
        window.title = "Digital Observer"; window.center()
        let title = NSTextField(labelWithString: "Digital Observer — חיבור המצלמות"); title.font = .boldSystemFont(ofSize: 23); title.frame = NSRect(x: 24, y: 236, width: 510, height: 40)
        message = NSTextField(wrappingLabelWithString: "התקינו את רכיב החיבור ואז פתחו את קובץ הקישור שהורדתם מתוך הבית שלכם. לא נדרשת הזנת סיסמה כאן.")
        message.frame = NSRect(x: 24, y: 120, width: 510, height: 105)
        let install = NSButton(title: "התקן והמשך", target: self, action: #selector(install)); install.frame = NSRect(x: 345, y: 55, width: 170, height: 40)
        let open = NSButton(title: "חזרה לתצפיתן", target: self, action: #selector(dashboard)); open.frame = NSRect(x: 170, y: 55, width: 160, height: 40)
        let remove = NSButton(title: "הסר רכיב חיבור", target: self, action: #selector(uninstall)); remove.frame = NSRect(x: 24, y: 55, width: 140, height: 40)
        for view in [title, message!, install, open, remove] { window.contentView?.addSubview(view) }
        window.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true)
    }
    func ensureInstalledAndRunning() throws -> Bundle {
        if Bundle.main.bundleURL.standardizedFileURL != installedApp.standardizedFileURL {
            if fm.fileExists(atPath: installedApp.path) { try fm.removeItem(at: installedApp) }
            try fm.createDirectory(at: installedApp.deletingLastPathComponent(), withIntermediateDirectories: true)
            try fm.copyItem(at: Bundle.main.bundleURL, to: installedApp)
        }
        try fm.createDirectory(at: agent.deletingLastPathComponent(), withIntermediateDirectories: true)
        let plist: [String: Any] = ["Label": label, "ProgramArguments": [installedApp.appendingPathComponent("Contents/MacOS/DigitalObserver").path, "--service"], "RunAtLoad": true, "KeepAlive": true, "ThrottleInterval": 30, "ProcessType": "Background"]
        try PropertyListSerialization.data(fromPropertyList: plist, format: .xml, options: 0).write(to: agent, options: .atomic)
        let boot = try process(URL(fileURLWithPath: "/bin/launchctl"), ["bootstrap", "gui/\(getuid())", agent.path])
        if boot != 0 {
            let running = try process(URL(fileURLWithPath: "/bin/launchctl"), ["print", "gui/\(getuid())/\(label)"])
            guard running == 0 else { throw NSError(domain: "DigitalObserverInstall", code: 1) }
        }
        guard let installed = Bundle(url: installedApp) else { throw NSError(domain: "DigitalObserverInstall", code: 2) }
        return installed
    }
    @objc func dashboard() { NSWorkspace.shared.open(URL(string: "https://ganbatuach.com/digital-observer/cameras/add")!) }
    @objc func install() {
        guard !busy else { return }; busy = true
        do {
            _ = try ensureInstalledAndRunning()
            message.stringValue = "הרכיב מותקן ויפעל ברקע לאחר כניסה למחשב. פתחו את קובץ הקישור ואשרו את המחשב באשף התצפיתן."
        } catch { message.stringValue = "לא ניתן להשלים התקנה. בדקו שיש הרשאת התקנה ונסו שוב." }
        busy = false
    }
    func application(_ sender: NSApplication, openFile filename: String) -> Bool {
        guard filename.hasSuffix(".observer-connect"), !busy else { return false }
        busy = true
        DispatchQueue.global().async {
            let bundle = try? self.ensureInstalledAndRunning(), resources = bundle?.resourceURL
            let code = resources.flatMap { path in try? process(path.appendingPathComponent("bin/node"), ["scripts/connector-desktop-service.mjs", "--document", filename], env: runtimeEnvironment(bundle!), cwd: path.appendingPathComponent("runtime")) }
            DispatchQueue.main.async { self.busy = false; self.message?.stringValue = code == 0 ? "המחשב נמצא. חזרו לאשף ואשרו את החיבור לבית שלכם." : "הקישור לא הושלם. ייתכן שתוקף הבקשה פג או שקיימת התקנה קודמת. חזרו לאשף לבדיקה." }
        }
        return true
    }
    @objc func uninstall() {
        let alert = NSAlert(); alert.messageText = "להסיר את רכיב החיבור מהמחשב?"; alert.informativeText = "הניטור דרך מחשב זה ייפסק. היסטוריית המצלמות לא תימחק. בטלו גם את הרשאת המכשיר בתצפיתן."; alert.addButton(withTitle: "ביטול"); alert.addButton(withTitle: "הסר")
        guard alert.runModal() == .alertSecondButtonReturn else { return }
        _ = try? process(URL(fileURLWithPath: "/bin/launchctl"), ["bootout", "gui/\(getuid())/\(label)"])
        try? fm.removeItem(at: agent)
        SecItemDelete([kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: secretService] as CFDictionary)
        if fm.fileExists(atPath: installedApp.path) { try? fm.trashItem(at: installedApp, resultingItemURL: nil) }
        message.stringValue = "הרכיב הוסר והסודות המקומיים נמחקו. בטלו את הרשאת המכשיר בתצפיתן; ההיסטוריה נשמרה."
    }
}
let app = NSApplication.shared
let delegate = AppDelegate(); app.delegate = delegate
app.setActivationPolicy(.regular); app.run()
