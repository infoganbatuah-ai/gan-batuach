import Foundation

@main
enum AsWebAuthIos15ProbeTests {
    static func main() {
        let state = String(repeating: "a", count: 64)
        let exact = "observerqa://return/qa/device-proof?state=\(state)"
        precondition(AsWebAuthIos15Probe.accepts(URL(string: exact), expectedState: state))
        for candidate in [
            exact.replacingOccurrences(of: "observerqa:", with: "https:"),
            exact.replacingOccurrences(of: "return", with: "attacker"),
            exact.replacingOccurrences(of: "/device-proof", with: "/other"),
            exact + "&access_token=secret",
            exact + "#fragment",
            exact + "&state=\(state)",
            exact.replacingOccurrences(of: state, with: String(repeating: "b", count: 64))
        ] {
            precondition(!AsWebAuthIos15Probe.accepts(URL(string: candidate), expectedState: state))
        }
        precondition(!AsWebAuthIos15Probe.accepts(URL(string: exact), expectedState: "short"))
        precondition(AsWebAuthIos15Probe.prepare(startURL: URL(string: "https://qa-iphone-device-proof.ganbatuach.com")!,
                                                  expectedState: state, onValidated: {}) == nil)
        print("ASWebAuth iOS15 dormant callback parser: 10/10 PASS")
    }
}
