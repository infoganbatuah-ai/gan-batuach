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
        let start = "https://qa-iphone-device-proof.ganbatuach.com/qa/device-proof/start?state=\(state)"
        precondition(AsWebAuthIos15Probe.acceptsStart(URL(string: start)!, expectedState: state))
        for candidate in [
            start.replacingOccurrences(of: "https:", with: "http:"),
            start.replacingOccurrences(of: "qa-iphone-device-proof", with: "other"),
            start.replacingOccurrences(of: "/start?", with: "/other?"),
            start.replacingOccurrences(of: "https://", with: "https://user@"),
            start.replacingOccurrences(of: ".com/", with: ".com:443/"),
            start + "&access_token=secret",
            start + "&state=\(state)",
            start + "#fragment",
            start.replacingOccurrences(of: state, with: String(repeating: "b", count: 64))
        ] {
            precondition(!AsWebAuthIos15Probe.acceptsStart(URL(string: candidate)!, expectedState: state))
        }
        precondition(AsWebAuthIos15Probe.prepare(startURL: URL(string: start)!,
                                                  expectedState: state, onValidated: {}) == nil)
        print("ASWebAuth iOS15 dormant start/return parser: 20/20 PASS")
    }
}
