import Foundation
import Security

// Source-only contract. No Xcode target, AppDelegate, bridge, or network route
// imports this type. A future trusted caller must supply the currently verified
// Development account and installation; caller-provided labels are not proof.
struct ObserverQaReturnIdentity: Equatable {
    let accountId: String
    let installationId: String
}

final class ObserverQaReturnContract {
    private struct Pending {
        let state: String
        let identity: ObserverQaReturnIdentity
        let expiresAt: Date
    }

    private let enabled: Bool
    private var pending: Pending?

    init(enabled: Bool = false) {
        self.enabled = enabled
    }

    func begin(identity: ObserverQaReturnIdentity, now: Date = Date()) -> String? {
        guard enabled, pending == nil,
              !identity.accountId.isEmpty, !identity.installationId.isEmpty else { return nil }
        var bytes = [UInt8](repeating: 0, count: 32)
        guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else { return nil }
        let state = bytes.map { String(format: "%02x", $0) }.joined()
        pending = Pending(state: state, identity: identity, expiresAt: now.addingTimeInterval(120))
        return state
    }

    func consume(_ url: URL, identity: ObserverQaReturnIdentity, now: Date = Date()) -> Bool {
        guard enabled, let expected = pending else { return false }
        pending = nil // Every callback attempt burns the pending state, including failures.
        guard identity == expected.identity, now < expected.expiresAt,
              url.absoluteString.utf8.count <= 1024,
              let parts = URLComponents(url: url, resolvingAgainstBaseURL: false),
              parts.scheme == "observerqaapp", parts.host == "return",
              parts.path == "/qa/device-proof", parts.port == nil,
              parts.user == nil, parts.password == nil, parts.fragment == nil,
              let items = parts.queryItems, items.count == 1,
              items[0].name == "state", let state = items[0].value,
              state.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil,
              state == expected.state else { return false }
        return true
    }
}
