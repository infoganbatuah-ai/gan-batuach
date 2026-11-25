import UIKit
import Capacitor
import Security
#if PERSONAL_TEAM_QA
import AuthenticationServices
#endif

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?
    private var captureShieldView: UIView?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(screenCaptureStateChanged),
            name: UIScreen.capturedDidChangeNotification,
            object: nil
        )
        updateCaptureShield()
        return true
    }

    @objc private func screenCaptureStateChanged() {
        updateCaptureShield()
    }

    private func updateCaptureShield() {
        guard let window = window else { return }
        if UIScreen.main.isCaptured {
            if captureShieldView == nil {
                let shield = UIView(frame: window.bounds)
                shield.backgroundColor = UIColor.black
                shield.autoresizingMask = [.flexibleWidth, .flexibleHeight]
                window.addSubview(shield)
                captureShieldView = shield
            }
            captureShieldView?.isHidden = false
        } else {
            captureShieldView?.isHidden = true
        }
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        #if PERSONAL_TEAM_QA
        if QaAccessReturnGate.enabled,
           userActivity.activityType == NSUserActivityTypeBrowsingWeb,
           let url = userActivity.webpageURL,
           QaAccessReturnGate.consume(url) {
            NotificationCenter.default.post(name: .qaAccessReturnValidated, object: nil)
            return true
        }
        #endif
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

    #if !PERSONAL_TEAM_QA && !OBSERVER_PRODUCT_PILOT
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }
    #endif

}

#if PERSONAL_TEAM_QA
extension Notification.Name {
    static let qaAccessReturnValidated = Notification.Name("qaAccessReturnValidated")
}

// The two QA products share an Xcode target, not an installation identity.
// Only these exact bundle IDs may create a device-proof key or accept a return.
private struct QaBundleIdentity: Equatable {
    let audience: String
    let callbackScheme: String

    var keyTag: Data { Data("\(audience).device-proof.v1".utf8) }

    static func resolve(_ bundleId: String?) -> QaBundleIdentity? {
        switch bundleId {
        case "com.ganbatuach.app.qa":
            return QaBundleIdentity(audience: "com.ganbatuach.app.qa", callbackScheme: "observerqa")
        case "com.digitalobserver.app.qa":
            return QaBundleIdentity(audience: "com.digitalobserver.app.qa", callbackScheme: "observerqaapp")
        default:
            return nil
        }
    }

    static func current() -> QaBundleIdentity? { resolve(Bundle.main.bundleIdentifier) }
}

// Local, default-off primitive. No entitlement, pending-state producer, network
// exchange, or QA-flow subscriber is installed by this change. This host/path
// is Gan-only; Observer has no approved return origin and fails closed.
enum QaAccessReturnGate {
    static let enabled = false
    private static let expectedHost = "qa-iphone-device-proof.ganbatuach.com"
    private static let expectedPath = "/qa/device-proof/return"
    private static let maxAge: TimeInterval = 120
    private static var pending: (state: String, account: String, installation: String,
                                 audience: String, expires: Date)?

    static func begin(account: String, installation: String, now: Date = Date()) -> String? {
        guard enabled, let bundle = QaBundleIdentity.current(), pending == nil,
              bundle.audience == "com.ganbatuach.app.qa",
              !account.isEmpty, !installation.isEmpty else { return nil }
        var bytes = [UInt8](repeating: 0, count: 32)
        guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else { return nil }
        let state = bytes.map { String(format: "%02x", $0) }.joined()
        pending = (state, account, installation, bundle.audience,
                   now.addingTimeInterval(maxAge))
        return state
    }

    static func consume(_ url: URL, account: String? = nil, installation: String? = nil,
                        now: Date = Date()) -> Bool {
        guard enabled, let bundle = QaBundleIdentity.current(), let expected = pending else { return false }
        pending = nil // A callback attempt cannot be replayed, including after rejection.
        guard now < expected.expires, account == expected.account,
              bundle.audience == "com.ganbatuach.app.qa",
              installation == expected.installation, bundle.audience == expected.audience,
              url.absoluteString.utf8.count <= 1024,
              let parts = URLComponents(url: url, resolvingAgainstBaseURL: false),
              parts.scheme == "https", parts.host == expectedHost,
              parts.path == expectedPath, parts.port == nil,
              parts.user == nil, parts.password == nil, parts.fragment == nil,
              let items = parts.queryItems, items.count == 1,
              items[0].name == "state", let state = items[0].value,
              state.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil,
              state == expected.state else { return false }
        return true
    }
}

// iOS 15-compatible system-browser adapter. Deliberately not wired to a QA
// flow: no identity provider, no caller, and no start() invocation exist.
enum QaAsWebAuthReturn {
    static let enabled = false
    struct Identity: Equatable {
        let account: String
        let installation: String
    }
    private static let identityProvider: (() -> Identity?)? = nil
    static func prepare(onValidated: @escaping () -> Void) -> ASWebAuthenticationSession? {
        guard enabled, let bundle = QaBundleIdentity.current(), let identity = identityProvider?(),
              bundle.audience == "com.ganbatuach.app.qa",
              !identity.account.isEmpty, !identity.installation.isEmpty else { return nil }
        var bytes = [UInt8](repeating: 0, count: 32)
        guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else { return nil }
        let state = bytes.map { String(format: "%02x", $0) }.joined()
        guard let startURL = URL(string:
            "https://qa-iphone-device-proof.ganbatuach.com/qa/device-proof/start?state=\(state)") else { return nil }
        var consumed = false
        return ASWebAuthenticationSession(url: startURL, callbackURLScheme: bundle.callbackScheme) {
            callback, error in
            guard !consumed else { return }
            consumed = true // A failed return also burns this local one-use attempt.
            guard error == nil, QaBundleIdentity.current() == bundle,
                  identityProvider?() == identity,
                  callback?.absoluteString == "\(bundle.callbackScheme)://return/qa/device-proof?state=\(state)" else { return }
            onValidated() // No URL, state, bearer or cookie reaches the caller.
        }
    }
}

// Dormant native primitive: no bridge or enrollment route invokes this code.
// The private key is created by the Secure Enclave and never leaves Keychain.
enum QaSecureEnclaveProof {
    enum ProofError: Error { case unavailable, invalidChallenge, invalidPublicKey, signingFailed }

    private static let spkiPrefix = Data([
        0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02,
        0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07,
        0x03, 0x42, 0x00
    ])

    private static func privateKey() throws -> SecKey {
        guard let bundle = QaBundleIdentity.current() else { throw ProofError.unavailable }
        let query: [String: Any] = [
            kSecClass as String: kSecClassKey,
            kSecAttrApplicationTag as String: bundle.keyTag,
            kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
            kSecAttrTokenID as String: kSecAttrTokenIDSecureEnclave,
            kSecReturnRef as String: true
        ]
        var existing: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &existing)
        if status == errSecSuccess {
            guard let existing = existing,
                  CFGetTypeID(existing) == SecKeyGetTypeID() else { throw ProofError.unavailable }
            return existing as! SecKey
        }
        guard status == errSecItemNotFound else { throw ProofError.unavailable }

        var accessError: Unmanaged<CFError>?
        guard let access = SecAccessControlCreateWithFlags(nil,
            kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            [.privateKeyUsage, .userPresence], &accessError) else {
            throw ProofError.unavailable
        }
        let attributes: [String: Any] = [
            kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
            kSecAttrKeySizeInBits as String: 256,
            kSecAttrTokenID as String: kSecAttrTokenIDSecureEnclave,
            kSecPrivateKeyAttrs as String: [
                kSecAttrIsPermanent as String: true,
                kSecAttrApplicationTag as String: bundle.keyTag,
                kSecAttrAccessControl as String: access
            ]
        ]
        var createError: Unmanaged<CFError>?
        guard let key = SecKeyCreateRandomKey(attributes as CFDictionary, &createError) else {
            // No software-key fallback on simulators or devices without Secure Enclave.
            throw ProofError.unavailable
        }
        return key
    }

    static func publicKeySpkiBase64() throws -> String {
        guard let publicKey = SecKeyCopyPublicKey(try privateKey()) else { throw ProofError.invalidPublicKey }
        var error: Unmanaged<CFError>?
        guard let raw = SecKeyCopyExternalRepresentation(publicKey, &error) as Data?,
              raw.count == 65, raw.first == 0x04 else { throw ProofError.invalidPublicKey }
        return (spkiPrefix + raw).base64EncodedString()
    }

    static func sign(nonce: String, accountId: String, sessionId: String,
                     installationId: String, expiresAtMs: Int64) throws -> String {
        guard let bundle = QaBundleIdentity.current() else { throw ProofError.unavailable }
        let identifiers = [accountId, sessionId, installationId]
        guard nonce.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil,
              identifiers.allSatisfy({ value in
                  !value.isEmpty && value.utf8.count <= 256
                  && value.range(of: "^[A-Za-z0-9._:-]+$", options: .regularExpression) != nil
              }), expiresAtMs > 0 else { throw ProofError.invalidChallenge }
        let message: [Any] = ["digital-observer-qa-device-proof-v1", nonce,
                              accountId, sessionId, installationId,
                              bundle.audience, expiresAtMs]
        guard let bytes = try? JSONSerialization.data(withJSONObject: message, options: []) else {
            throw ProofError.invalidChallenge
        }
        var error: Unmanaged<CFError>?
        guard let signature = SecKeyCreateSignature(try privateKey(),
            .ecdsaSignatureMessageX962SHA256, bytes as CFData, &error) as Data? else {
            throw ProofError.signingFailed
        }
        return signature.base64EncodedString()
    }
}
#endif
