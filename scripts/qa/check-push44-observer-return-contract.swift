import Foundation

@main
struct ObserverQaReturnContractCheck {
    static func main() {
        let now = Date(timeIntervalSince1970: 1_000)
        let owner = ObserverQaReturnIdentity(accountId: "development-owner", installationId: "approved-iphone")
        let otherAccount = ObserverQaReturnIdentity(accountId: "other-account", installationId: "approved-iphone")
        let otherDevice = ObserverQaReturnIdentity(accountId: "development-owner", installationId: "other-iphone")
        let disabled = ObserverQaReturnContract()
        precondition(disabled.begin(identity: owner, now: now) == nil)
        precondition(!disabled.consume(URL(string: "observerqaapp://return/qa/device-proof?state=abc")!, identity: owner, now: now))
        precondition(ObserverQaReturnContract(enabled: true).begin(
            identity: ObserverQaReturnIdentity(accountId: "", installationId: owner.installationId), now: now) == nil)

        func returnUrl(_ state: String) -> URL {
            URL(string: "observerqaapp://return/qa/device-proof?state=\(state)")!
        }

        let valid = ObserverQaReturnContract(enabled: true)
        let state = valid.begin(identity: owner, now: now)!
        precondition(state.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil)
        precondition(valid.begin(identity: owner, now: now) == nil)
        precondition(valid.consume(returnUrl(state), identity: owner, now: now.addingTimeInterval(1)))
        precondition(!valid.consume(returnUrl(state), identity: owner, now: now.addingTimeInterval(2)))

        let rejectedUrls = [
            "observerqa://return/qa/device-proof?state=", // Gan scheme
            "digitalobserver://return/qa/device-proof?state=",
            "observerqaapp://evil.test/qa/device-proof?state=",
            "https://observer-qa.ganbatuach.com/auth/callback?state=", // browser return is not native proof
            "observerqaapp://return/qa/device-proof/extra?state=",
            "observerqaapp://return/qa/device-proof?state=", // replaced below with duplicate
            "observerqaapp://return/qa/device-proof?token=",
            "observerqaapp://return/qa/device-proof?code=",
            "observerqaapp://return/qa/device-proof?state="
        ]
        for (index, prefix) in rejectedUrls.enumerated() {
            let gate = ObserverQaReturnContract(enabled: true)
            let attempt = gate.begin(identity: owner, now: now)!
            let url: URL
            switch index {
            case 5: url = URL(string: "\(prefix)\(attempt)&state=\(attempt)")!
            case 8: url = URL(string: "\(prefix)\(attempt)#fragment")!
            default: url = URL(string: "\(prefix)\(attempt)")!
            }
            precondition(!gate.consume(url, identity: owner, now: now))
            precondition(!gate.consume(returnUrl(attempt), identity: owner, now: now))
        }

        for identity in [otherAccount, otherDevice] {
            let gate = ObserverQaReturnContract(enabled: true)
            let attempt = gate.begin(identity: owner, now: now)!
            precondition(!gate.consume(returnUrl(attempt), identity: identity, now: now))
            precondition(!gate.consume(returnUrl(attempt), identity: owner, now: now))
        }
        let expired = ObserverQaReturnContract(enabled: true)
        let expiredState = expired.begin(identity: owner, now: now)!
        precondition(!expired.consume(returnUrl(expiredState), identity: owner, now: now.addingTimeInterval(120)))
        precondition(!expired.consume(returnUrl(expiredState), identity: owner, now: now))
        print("Observer QA return contract: local synthetic PASS")
    }
}
