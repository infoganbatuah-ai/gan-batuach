import Foundation
import Security
import Capacitor
import CryptoKit

@objc(DigitalObserverQaBridgeViewController)
class DigitalObserverQaBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        #if PERSONAL_TEAM_QA
        bridge?.registerPluginType(Push44QaDeviceProofPlugin.self)
        #endif
    }
}

#if PERSONAL_TEAM_QA
// Available only in the isolated Personal Team QA binary. It never returns a
// private-key representation; a new key is generated on this device only.
@objc(Push44QaDeviceProofPlugin)
public class Push44QaDeviceProofPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "Push44QaDeviceProofPlugin"
    public let jsName = "Push44QaDeviceProof"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "publicKey", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signChallenge", returnType: CAPPluginReturnPromise)
    ]

    private let tag = Data("com.ganbatuach.app.qa.push44.device-proof.v1".utf8)
    private let installationMarker = "com.ganbatuach.app.qa.push44.device-proof.created.v1"
    private let syntheticTenant = "00000000-0000-4000-8000-000000000b44"
    private let syntheticSite = "00000000-0000-4000-8000-000000000a44"
    private let syntheticSource = "00000000-0000-4000-8000-000000000c44"
    private let qaViewer = "00000000-0000-4000-8000-000000000f44"

    private func approvedOrigin() -> Bool {
        guard Bundle.main.bundleIdentifier == "com.ganbatuach.app.qa",
              let configured = bridge?.config.serverURL,
              let current = bridge?.webView?.url,
              configured.scheme == "https", current.scheme == "https",
              let host = configured.host, current.host == host,
              host == "qa-iphone-device-proof.ganbatuach.com",
              configured.port == nil, current.port == nil else { return false }
        return true
    }

    private func key(createIfMissing: Bool) -> SecKey? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassKey,
            kSecAttrApplicationTag as String: tag,
            kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
            kSecReturnRef as String: true
        ]
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        let marker = UserDefaults.standard.bool(forKey: installationMarker)
        // UserDefaults normally disappears on reinstall while Keychain may not.
        // A mismatched marker/key state requires explicit owner recovery; never
        // silently reuse or replace a key after reinstall or Keychain reset.
        if status == errSecSuccess {
            guard marker, let result, CFGetTypeID(result) == SecKeyGetTypeID() else { return nil }
            return (result as! SecKey)
        }
        if status != errSecItemNotFound || marker || !createIfMissing { return nil }
        var accessError: Unmanaged<CFError>?
        guard let access = SecAccessControlCreateWithFlags(nil, kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
                                                           .privateKeyUsage, &accessError) else { return nil }
        let attributes: [String: Any] = [
            kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
            kSecAttrKeySizeInBits as String: 256,
            kSecAttrTokenID as String: kSecAttrTokenIDSecureEnclave,
            kSecPrivateKeyAttrs as String: [
                kSecAttrIsPermanent as String: true,
                kSecAttrApplicationTag as String: tag,
                kSecAttrAccessControl as String: access
            ]
        ]
        var keyError: Unmanaged<CFError>?
        guard let created = SecKeyCreateRandomKey(attributes as CFDictionary, &keyError) else { return nil }
        UserDefaults.standard.set(true, forKey: installationMarker)
        return created
    }

    private func encode(_ data: Data) -> String {
        data.base64EncodedString().replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }

    private func decode(_ value: String) -> Data? {
        guard value.range(of: "^[A-Za-z0-9_-]+$", options: .regularExpression) != nil else { return nil }
        let standard = value.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        return Data(base64Encoded: standard + String(repeating: "=", count: (4 - standard.count % 4) % 4))
    }

    @objc func publicKey(_ call: CAPPluginCall) {
        guard approvedOrigin(), let privateKey = key(createIfMissing: true), let key = SecKeyCopyPublicKey(privateKey) else {
            call.reject("QA_DEVICE_KEY_UNAVAILABLE"); return
        }
        var error: Unmanaged<CFError>?
        guard let publicBytes = SecKeyCopyExternalRepresentation(key, &error) as Data?,
              publicBytes.count == 65, publicBytes.first == 4 else {
            call.reject("QA_DEVICE_KEY_UNAVAILABLE"); return
        }
        call.resolve(["publicKey": encode(publicBytes)])
    }

    @objc func signChallenge(_ call: CAPPluginCall) {
        guard approvedOrigin(), let encoded = call.getString("payload"), encoded.count < 1400,
              let payload = decode(encoded), payload.count < 1024,
              let message = String(data: payload, encoding: .utf8) else {
            call.reject("QA_DEVICE_CHALLENGE_DENIED"); return
        }
        let fields = message.components(separatedBy: "\n")
        guard fields.count == 13, fields[0] == "DO-P44-QA-POP-V1",
              ["ENROLL", "ACCESS"].contains(fields[1]), fields[2] == "LOCAL_SUPABASE",
              fields[3] == qaViewer, fields[4] == syntheticTenant, fields[5] == syntheticSite,
              fields[6] == syntheticSource, let privateKey = key(createIfMissing: false),
              let publicKey = SecKeyCopyPublicKey(privateKey),
              let publicBytes = SecKeyCopyExternalRepresentation(publicKey, nil) as Data?,
              fields[8] == encode(Data(SHA256.hash(data: publicBytes))),
              let expiry = Double(fields[12]), expiry > Date().timeIntervalSince1970 * 1000,
              expiry <= Date().timeIntervalSince1970 * 1000 + 30_000 else {
            call.reject("QA_DEVICE_CHALLENGE_DENIED"); return
        }
        let accessPath = fields[9] == "POST" && ["/ch1/claim", "/ch1/renew"].contains(fields[10]) ||
            fields[9] == "GET" && (fields[10] == "/ch1/index.m3u8" ||
                fields[10].range(of: "^/ch1/segment-[0-9]{1,16}\\.ts$", options: .regularExpression) != nil)
        guard (fields[1] == "ENROLL" && fields[9] == "POST" && fields[10] == "/qa-device/enroll") ||
              (fields[1] == "ACCESS" && accessPath) else {
            call.reject("QA_DEVICE_CHALLENGE_DENIED"); return
        }
        var error: Unmanaged<CFError>?
        guard let signature = SecKeyCreateSignature(privateKey, .ecdsaSignatureMessageX962SHA256,
                                                    payload as CFData, &error) as Data? else {
            call.reject("QA_DEVICE_CHALLENGE_DENIED"); return
        }
        call.resolve(["signature": encode(signature)])
    }
}
#endif
