// One bounded, disposable Ubuntu QA boot. Never attach project data or a NIC.
// A one-way virtio console is the ONLY guest-to-host result channel.
import CryptoKit
import Darwin
import Foundation
import Virtualization

private let root = "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/.qa-offline-vz-zbBWgKws"
private let rawSHA = "70c4b0a60310b3a995a359b2a85258590608057f90b81567bbe27ac650aa00f4"
private let isoSHA = "c3bc6ba91070169e485df78b3e2ec56f581eafcc007f31888f58a7297d193edb"
private let rawBytes: Int64 = 3_758_096_384
private let isoBytes: Int64 = 1_947_686_912
private let nonce = "doqa-no-nic-20261030-02"
private let maxSerialBytes: Int64 = 16 * 1024 * 1024
private let maxSeconds: TimeInterval = 300
private let datalessFlag: UInt32 = 0x40000000
private let resultBytes: Int64 = 1_048_576

private enum Gate: Error {
    case unsafe(String)
}

private func require(_ condition: Bool, _ code: String) throws {
    if !condition { throw Gate.unsafe(code) }
}

private func checkDirectory(_ url: URL, prefix: String? = nil) throws {
    let path = url.path
    if let prefix { try require(path.hasPrefix(prefix), "QA_SCRATCH_PATH") }
    try require(url.resolvingSymlinksInPath().path == path, "QA_SCRATCH_SYMLINK")
    var metadata = stat()
    try require(lstat(path, &metadata) == 0, "QA_SCRATCH_MISSING")
    try require(metadata.st_mode & S_IFMT == S_IFDIR && metadata.st_uid == geteuid() &&
                metadata.st_mode & 0o777 == 0o700, "QA_SCRATCH_NOT_PRIVATE")
}

private func checkFile(_ url: URL, bytes: Int64, mode: mode_t,
                       expectedSHA: String) throws {
    var before = stat()
    try require(lstat(url.path, &before) == 0, "QA_FILE_MISSING")
    try require(before.st_mode & S_IFMT == S_IFREG && before.st_nlink == 1 &&
                before.st_uid == geteuid() && before.st_mode & 0o777 == mode &&
                before.st_size == bytes && before.st_blocks > 0 &&
                before.st_flags & datalessFlag == 0, "QA_FILE_METADATA")
    let descriptor = open(url.path, O_RDONLY | O_NOFOLLOW)
    try require(descriptor >= 0, "QA_FILE_NOFOLLOW")
    defer { close(descriptor) }
    var opened = stat()
    try require(fstat(descriptor, &opened) == 0 && opened.st_ino == before.st_ino &&
                opened.st_size == before.st_size, "QA_FILE_RACE")
    var sha = SHA256()
    var buffer = [UInt8](repeating: 0, count: 1024 * 1024)
    while true {
        let n = read(descriptor, &buffer, buffer.count)
        try require(n >= 0, "QA_FILE_READ")
        if n == 0 { break }
        sha.update(data: Data(buffer[0..<n]))
    }
    let digest = sha.finalize().map { String(format: "%02x", $0) }.joined()
    var after = stat()
    try require(fstat(descriptor, &after) == 0 && after.st_ino == before.st_ino &&
                after.st_size == before.st_size &&
                after.st_mtimespec.tv_sec == before.st_mtimespec.tv_sec &&
                after.st_mtimespec.tv_nsec == before.st_mtimespec.tv_nsec,
                "QA_FILE_CHANGED_DURING_HASH")
    try require(digest == expectedSHA, "QA_FILE_DIGEST")
}

private func checkBlankResult(_ url: URL) throws {
    var metadata = stat()
    try require(lstat(url.path, &metadata) == 0 &&
                metadata.st_mode & S_IFMT == S_IFREG && metadata.st_nlink == 1 &&
                metadata.st_uid == geteuid() && metadata.st_mode & 0o777 == 0o600 &&
                metadata.st_size == resultBytes && metadata.st_blocks > 0 &&
                metadata.st_flags & datalessFlag == 0,
                "QA_RESULT_DISK_METADATA")
    let fd = open(url.path, O_RDONLY | O_NOFOLLOW)
    try require(fd >= 0, "QA_RESULT_DISK_NOFOLLOW")
    defer { close(fd) }
    var buffer = [UInt8](repeating: 0, count: 64 * 1024)
    var total: Int64 = 0
    while true {
        let n = read(fd, &buffer, buffer.count)
        try require(n >= 0, "QA_RESULT_DISK_READ")
        if n == 0 { break }
        try require(buffer[0..<n].allSatisfy { $0 == 0 },
                    "QA_RESULT_DISK_NOT_BLANK")
        total += Int64(n)
    }
    try require(total == resultBytes, "QA_RESULT_DISK_SIZE_CHANGED")
}

private final class StopObserver: NSObject, VZVirtualMachineDelegate {
    var stopped = false
    var stoppedWithError = false
    func guestDidStop(_ virtualMachine: VZVirtualMachine) { stopped = true }
    func virtualMachine(_ virtualMachine: VZVirtualMachine,
                        didStopWithError error: Error) {
        stoppedWithError = true
        stopped = true
    }
}

@available(macOS 13.0, *)
private func run(_ guest: URL, seedSHA: String, seedBytes: Int64) throws {
    try require(VZVirtualMachine.isSupported, "QA_VZ_UNAVAILABLE")
    try require(guest.path.hasPrefix(root + "/guest-control."), "QA_GUEST_DIR_SCOPE")
    let parent = URL(fileURLWithPath: root, isDirectory: true)
    try checkDirectory(parent)
    try checkDirectory(guest, prefix: root + "/guest-control.")
    let free = try FileManager.default.attributesOfFileSystem(forPath: root)[.systemFreeSize] as? NSNumber
    try require((free?.int64Value ?? 0) >= 16 * 1024 * 1024 * 1024,
                "QA_SCRATCH_FREE_BELOW_FLOOR")
    let boot = guest.appendingPathComponent("boot.raw")
    let seed = guest.appendingPathComponent("seed.iso")
    let inputs = parent.appendingPathComponent("offline-qa-inputs.iso")
    let efi = guest.appendingPathComponent("efi.vars")
    let serial = guest.appendingPathComponent("serial.log")
    let resultDisk = guest.appendingPathComponent("result.raw")
    try require(!FileManager.default.fileExists(atPath: efi.path) &&
                !FileManager.default.fileExists(atPath: serial.path),
                "QA_OUTPUT_ALREADY_EXISTS")
    try checkFile(boot, bytes: rawBytes, mode: 0o600, expectedSHA: rawSHA)
    try checkFile(seed, bytes: seedBytes, mode: 0o400, expectedSHA: seedSHA)
    try checkFile(inputs, bytes: isoBytes, mode: 0o400, expectedSHA: isoSHA)
    try checkBlankResult(resultDisk)

    let fd = open(serial.path, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW, 0o600)
    try require(fd >= 0, "QA_SERIAL_CREATE")
    close(fd)
    let config = VZVirtualMachineConfiguration()
    config.cpuCount = 2
    config.memorySize = 2 * 1024 * 1024 * 1024
    let loader = VZEFIBootLoader()
    loader.variableStore = try VZEFIVariableStore(creatingVariableStoreAt: efi)
    config.bootLoader = loader
    config.networkDevices = []
    config.directorySharingDevices = []
    config.socketDevices = []
    config.consoleDevices = []
    config.usbControllers = []
    config.graphicsDevices = []
    config.keyboards = []
    config.pointingDevices = []
    let resultPort = VZVirtioConsoleDeviceSerialPortConfiguration()
    resultPort.attachment = try VZFileSerialPortAttachment(url: serial, append: false)
    config.serialPorts = [resultPort]
    config.storageDevices = [
        VZVirtioBlockDeviceConfiguration(attachment:
            try VZDiskImageStorageDeviceAttachment(url: boot, readOnly: false)),
        VZVirtioBlockDeviceConfiguration(attachment:
            try VZDiskImageStorageDeviceAttachment(url: inputs, readOnly: true)),
        VZVirtioBlockDeviceConfiguration(attachment:
            try VZDiskImageStorageDeviceAttachment(url: seed, readOnly: true)),
        VZVirtioBlockDeviceConfiguration(attachment:
            try VZDiskImageStorageDeviceAttachment(url: resultDisk, readOnly: false))
    ]
    try require(config.networkDevices.isEmpty && config.directorySharingDevices.isEmpty &&
                config.socketDevices.isEmpty && config.serialPorts.count == 1 &&
                config.storageDevices.count == 4, "QA_CONFIG_DEVICE_DRIFT")
    try config.validate()
    let vm = VZVirtualMachine(configuration: config)
    let observer = StopObserver()
    vm.delegate = observer
    print("QA_VM_START pid=\(getpid()) disks=4 nics=0 serials=1 nonce=\(nonce)")
    var started = false
    var startFailed = false
    vm.start { result in
        switch result {
        case .success: started = true
        case .failure: startFailed = true
        }
    }
    let deadline = Date().addingTimeInterval(maxSeconds)
    var overflow = false
    while !observer.stopped && !startFailed && Date() < deadline {
        RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.1))
        if let size = try? FileManager.default.attributesOfItem(atPath: serial.path)[.size] as? NSNumber,
           size.int64Value > maxSerialBytes { overflow = true; break }
    }
    let timedOut = !observer.stopped && !startFailed && !overflow
    var forcedStopCompleted = false
    if timedOut || overflow {
        try? vm.requestStop()
        let grace = Date().addingTimeInterval(15)
        while !observer.stopped && Date() < grace {
            RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.1))
        }
        if !observer.stopped && vm.canStop {
            vm.stop { error in
                forcedStopCompleted = error == nil
            }
            let forced = Date().addingTimeInterval(10)
            while !observer.stopped && !forcedStopCompleted && Date() < forced {
                RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.1))
            }
        }
    }
    try require(startFailed || observer.stopped || forcedStopCompleted ||
                vm.state == .stopped, "QA_VM_STOP_UNVERIFIED")
    if forcedStopCompleted { print("QA_VM_FORCE_STOP_COMPLETED") }
    let resultFile = try FileHandle(forReadingFrom: resultDisk)
    defer { try? resultFile.close() }
    let firstBlock = try resultFile.read(upToCount: 4096) ?? Data()
    let resultLine = String(decoding: firstBlock.prefix { $0 != 0 }, as: UTF8.self)
    let bootMarker = "DOQA_BOOT nonce=\(nonce) stage=cloud-init-bootcmd\n"
    if resultLine == bootMarker { print("QA_BOOTCMD_SEEN result_final=false") }
    try require(!startFailed && started, "QA_VM_START_FAILED")
    try require(!timedOut && !overflow && observer.stopped &&
                !observer.stoppedWithError, "QA_VM_DID_NOT_SHUT_DOWN_CLEANLY")
    let pass = "DOQA_RESULT nonce=\(nonce) status=PASS nic=0 ipv4_default=0 ipv6_default=0 route_get=unreachable input_ro=1 seed_ro=1 input_hashes=match\n"
    try require(resultLine == pass, "QA_GUEST_RESULT_MISSING_OR_AMBIGUOUS")
    let serialData = try Data(contentsOf: serial)
    try require(serialData.count <= maxSerialBytes, "QA_SERIAL_CAP_EXCEEDED")
    let output = String(decoding: serialData, as: UTF8.self)
    try require(!output.contains("DOQA_RESULT nonce=\(nonce) status=FAIL"),
                "QA_SERIAL_GUEST_FAILURE")
    print("QA_GUEST_PROBE_PASS pid=\(getpid()) guest_stopped=true serial_bytes=\(serialData.count)")
}

guard CommandLine.arguments.count == 4,
      let seedBytes = Int64(CommandLine.arguments[3]),
      CommandLine.arguments[2].count == 64,
      CommandLine.arguments[2].allSatisfy({ $0.isHexDigit }) else {
    fputs("QA_GUEST_BLOCKED code=ARGUMENTS\n", stderr)
    exit(2)
}
if #available(macOS 13.0, *) {
    do {
        try run(URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true),
                seedSHA: CommandLine.arguments[2], seedBytes: seedBytes)
    } catch {
        let code: String
        if case Gate.unsafe(let gate) = error { code = gate }
        else { code = "NATIVE_ERROR" }
        fputs("QA_GUEST_BLOCKED code=\(code)\n", stderr)
        exit(2)
    }
} else {
    fputs("QA_GUEST_BLOCKED code=MACOS_VERSION\n", stderr)
    exit(2)
}
