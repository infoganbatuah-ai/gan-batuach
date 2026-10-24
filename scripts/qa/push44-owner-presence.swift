import Foundation
import LocalAuthentication

// Host-local helper. The authenticated Product principal is checked separately
// by the operator; this prompt proves fresh local owner presence only.
let args = CommandLine.arguments
guard args.count == 3,
      ["AUTHORIZE_ENROLLMENT", "REVOKE_APPROVAL", "REVOKE"].contains(args[1]),
      args[2].range(of: "^[A-Za-z0-9_-]{1,43}$", options: .regularExpression) != nil else {
    exit(1)
}
let context = LAContext()
context.touchIDAuthenticationAllowableReuseDuration = 0
guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: nil) else { exit(1) }
let semaphore = DispatchSemaphore(value: 0)
var accepted = false
let reason = "Digital Observer QA: \(args[1]) for key \(args[2])"
context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason) { success, _ in
    accepted = success
    semaphore.signal()
}
guard semaphore.wait(timeout: .now() + 30) == .success, accepted else { exit(1) }
print("PRESENT")
