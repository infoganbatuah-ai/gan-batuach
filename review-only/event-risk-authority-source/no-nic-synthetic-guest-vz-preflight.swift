// Native configuration construction ONLY. No VZVirtualMachine is instantiated
// and this file contains no start call. The two URLs must first pass independent
// no-follow, exact-hash, format, scratch-ownership and capacity checks.
import Foundation
import Virtualization

enum QANoNicPreflightError: Error {
    case unexpectedDevice
}

@available(macOS 13.0, *)
func buildReadOnlyNoNicReviewConfiguration(bootRaw: URL, offlineInputsRaw: URL)
    throws -> VZVirtualMachineConfiguration {
    let config = VZVirtualMachineConfiguration()
    config.cpuCount = 2
    config.memorySize = 2 * 1024 * 1024 * 1024
    config.bootLoader = VZEFIBootLoader()

    // Apple's API exposes only the devices explicitly placed in these arrays.
    // Lima's `networks: []` is not equivalent: it retains a default NIC.
    config.networkDevices = []
    config.directorySharingDevices = []
    config.socketDevices = []
    config.serialPorts = []
    config.consoleDevices = []
    config.usbControllers = []
    config.graphicsDevices = []
    config.keyboards = []
    config.pointingDevices = []

    let boot = try VZDiskImageStorageDeviceAttachment(url: bootRaw, readOnly: true)
    let inputs = try VZDiskImageStorageDeviceAttachment(url: offlineInputsRaw, readOnly: true)
    config.storageDevices = [
        VZVirtioBlockDeviceConfiguration(attachment: boot),
        VZVirtioBlockDeviceConfiguration(attachment: inputs)
    ]
    guard config.networkDevices.isEmpty && config.directorySharingDevices.isEmpty &&
          config.socketDevices.isEmpty && config.serialPorts.isEmpty &&
          config.consoleDevices.isEmpty && config.storageDevices.count == 2 else {
        throw QANoNicPreflightError.unexpectedDevice
    }
    try config.validate()
    return config
}
