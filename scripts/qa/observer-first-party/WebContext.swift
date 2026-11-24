// macOS test client only. No persistent website data, visible browser or native bridge.
import AppKit
import WebKit

final class LoginProbe: NSObject, WKNavigationDelegate {
    let origin: URL
    let start: URL
    let view: WKWebView
    let anchor: SecCertificate
    var visits = 0
    var submittedApproval = false

    init?(start: URL, anchor: SecCertificate) {
        guard start.scheme == "https", start.host == "127.0.0.1", start.port != nil,
              start.path == "/digital-observer/login" else { return nil }
        self.anchor = anchor
        self.start = start
        origin = start.deletingLastPathComponent().deletingLastPathComponent()
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .nonPersistent()
        view = WKWebView(frame: CGRect(x: 0, y: 0, width: 320, height: 480), configuration: config)
        super.init()
        view.navigationDelegate = self
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url, url.scheme == origin.scheme, url.host == origin.host,
              url.port == origin.port else { decisionHandler(.cancel); exit(2) }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, didReceive challenge: URLAuthenticationChallenge,
                 completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
        guard challenge.protectionSpace.host == start.host,
              challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
              let trust = challenge.protectionSpace.serverTrust,
              SecTrustSetAnchorCertificates(trust, [anchor] as CFArray) == errSecSuccess,
              SecTrustSetAnchorCertificatesOnly(trust, true) == errSecSuccess,
              SecTrustEvaluateWithError(trust, nil) else {
            completionHandler(.cancelAuthenticationChallenge, nil); return
        }
        completionHandler(.useCredential, URLCredential(trust: trust))
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        let failure = error as NSError
        FileHandle.standardError.write(Data("WebKit navigation: \(failure.domain) \(failure.code)\n".utf8))
        exit(8)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        if view.url?.path == start.path && visits == 0 {
            let submit = submittedApproval ? "document.querySelector('input[name=email]').form.requestSubmit()" :
                "const field=document.querySelector('input[name=approval]'); field.value='12345678abcdef90'; field.form.requestSubmit()"
            submittedApproval = true
            view.evaluateJavaScript(submit) { _, error in
                if error != nil { exit(3) }
            }
            return
        }
        guard view.url?.path == "/digital-observer/dashboard" else { exit(4) }
        view.evaluateJavaScript("document.title") { title, error in
            guard error == nil else { exit(5) }
            if self.visits == 3 { exit(title as? String == "Synthetic access denied" ? 0 : 7) }
            guard title as? String == "Synthetic signed-in dashboard" else { exit(5) }
            self.visits += 1
            switch self.visits {
            case 1: self.view.reload()
            case 2: self.view.load(URLRequest(url: self.start))
            default: self.view.reload()
            }
        }
    }
}

_ = NSApplication.shared
guard CommandLine.arguments.count == 3, let url = URL(string: CommandLine.arguments[1]),
      let cert = try? Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[2])),
      let anchor = SecCertificateCreateWithData(nil, cert as CFData),
      let probe = LoginProbe(start: url, anchor: anchor) else { exit(1) }
probe.view.load(URLRequest(url: probe.start))
DispatchQueue.main.asyncAfter(deadline: .now() + 25) { exit(6) }
RunLoop.main.run()
