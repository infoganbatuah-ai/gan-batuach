// Native configuration construction ONLY. No VZVirtualMachine is instantiated
// and this file contains no start call. The boot URL must be a disposable,
// independently verified scratch RAW copy; the offline input disk stays read-only.
// Both URLs still need no-follow, hash, format, ownership and capacity checks.
import Foundation
import Virtualization

enum QANoNicPreflightError: Error {
    case unexpectedDevice
}

@available(macOS 13.0, *)
func buildNoNicReviewConfiguration(bootScratchRaw: URL, offlineInputsRaw: URL,
                                    scratchVariableStore: URL)
    throws -> VZVirtualMachineConfiguration {
    let config = VZVirtualMachineConfiguration()
    config.cpuCount = 2
    config.memorySize = 2 * 1024 * 1024 * 1024
    let bootLoader = VZEFIBootLoader()
    bootLoader.variableStore = try VZEFIVariableStore(
        creatingVariableStoreAt: scratchVariableStore)
    config.bootLoader = bootLoader

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

    // Linux cannot safely run on a read-only boot root. Never pass the original
    // QCOW2 file or a unique recovery copy here; writable means scratch only.
    let boot = try VZDiskImageStorageDeviceAttachment(url: bootScratchRaw, readOnly: false)
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
