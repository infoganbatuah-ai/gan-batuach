import AuthenticationServices
import Foundation

// Compile-only, disconnected iOS 15 compatibility probe. Never added to Xcode.
enum AsWebAuthIos15Probe {
    static let enabled = false
    private static let callbackScheme = "observerqa"

    static func accepts(_ callback: URL?, expectedState: String) -> Bool {
        guard let callback = callback,
              expectedState.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil,
              callback.absoluteString.utf8.count <= 1024,
              let parts = URLComponents(url: callback, resolvingAgainstBaseURL: false),
              parts.scheme == callbackScheme, parts.host == "return",
              parts.path == "/qa/device-proof", parts.port == nil,
              parts.user == nil, parts.password == nil, parts.fragment == nil,
              let items = parts.queryItems, items.count == 1,
              items[0].name == "state", items[0].value == expectedState else { return false }
        return true
    }

    static func prepare(startURL: URL, expectedState: String,
                        onValidated: @escaping () -> Void) -> ASWebAuthenticationSession? {
        guard enabled, startURL.scheme == "https",
              startURL.host == "qa-iphone-device-proof.ganbatuach.com",
              expectedState.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil else { return nil }
        var consumed = false
        return ASWebAuthenticationSession(url: startURL, callbackURLScheme: callbackScheme) {
            callback, error in
            guard !consumed, error == nil, accepts(callback, expectedState: expectedState) else { return }
            consumed = true
            onValidated() // No callback URL, state, cookie, or bearer crosses this boundary.
        }
    }
}
