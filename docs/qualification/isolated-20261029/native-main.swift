import Foundation
import Virtualization
let args = CommandLine.arguments
if #available(macOS 13.0, *) {
    do {
        let c = try buildNoNicReviewConfiguration(bootScratchRaw: URL(fileURLWithPath: args[1]), offlineInputsRaw: URL(fileURLWithPath: args[2]))
        print("NATIVE_CONFIGURATION_VALIDATED disks=\(c.storageDevices.count) nics=\(c.networkDevices.count) VM_NOT_CREATED")
    } catch {
        let e = error as NSError
        print("NATIVE_CONFIGURATION_REJECTED domain=\(e.domain) code=\(e.code) reason=\(e.localizedDescription)")
        exit(2)
    }
}
