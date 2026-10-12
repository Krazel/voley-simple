import UIKit
import WebKit
import AVFoundation

final class WeakHandler: NSObject, WKScriptMessageHandler {
 weak var controller: GameController?
 init(_ controller: GameController) { self.controller = controller }
 func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
  guard message.frameInfo.isMainFrame else { return }
  controller?.receive(message)
 }
}

final class GameController: UIViewController, WKNavigationDelegate {
 private var web: WKWebView!
 private var voices: [AVAudioPlayer] = []
 private let effects = Set(["pass", "attack", "jump", "land", "serve", "point-blue", "point-orange", "finish"])
 override func viewDidLoad() {
  super.viewDidLoad()
  view.backgroundColor = UIColor(red: 0.14, green: 0.28, blue: 0.35, alpha: 1)
  let config = WKWebViewConfiguration()
  config.preferences.isTextInteractionEnabled = true
  let handler = WeakHandler(self)
  config.userContentController.add(handler, name: "voleyAudio")
  config.userContentController.add(handler, name: "voleyText")
  let policy = """
  (()=>{try{if(!localStorage.getItem('voley-preferences-v1'))localStorage.setItem('voley-preferences-v1',JSON.stringify({map:'mobile',mode:'1v1',zoom:{mobile:1,pavilion:1,rooftop:1}}))}catch{}let previous;function sync(){const enabled=[...document.querySelectorAll('textarea,input,[contenteditable="true"]')].some(e=>!e.disabled&&e.getClientRects().length&&(!e.matches('input')||!['button','checkbox','radio','range','submit','hidden'].includes(e.type)));if(enabled!==previous){previous=enabled;window.webkit.messageHandlers.voleyText.postMessage(enabled)}}document.addEventListener('DOMContentLoaded',()=>{sync();new MutationObserver(sync).observe(document.body,{subtree:true,attributes:true,childList:true});window.addEventListener('resize',sync)})})();
  """
  config.userContentController.addUserScript(WKUserScript(source: policy, injectionTime: .atDocumentStart, forMainFrameOnly: true))
  web = WKWebView(frame: .zero, configuration: config)
  web.navigationDelegate = self
  web.allowsLinkPreview = false
  web.scrollView.isScrollEnabled = false
  web.scrollView.contentInsetAdjustmentBehavior = .never
  web.isOpaque = false
  web.translatesAutoresizingMaskIntoConstraints = false
  view.addSubview(web)
  NSLayoutConstraint.activate([web.leadingAnchor.constraint(equalTo: view.leadingAnchor),web.trailingAnchor.constraint(equalTo: view.trailingAnchor),web.topAnchor.constraint(equalTo: view.topAnchor),web.bottomAnchor.constraint(equalTo: view.bottomAnchor)])
  if let root = Bundle.main.url(forResource: "Web", withExtension: nil) {
   web.loadFileURL(root.appendingPathComponent("voley-offline.html"), allowingReadAccessTo: root)
  }
  NotificationCenter.default.addObserver(self, selector: #selector(stopAudio), name: UIApplication.willResignActiveNotification, object: nil)
  NotificationCenter.default.addObserver(self, selector: #selector(stopAudio), name: AVAudioSession.interruptionNotification, object: nil)
  try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [.mixWithOthers])
 }
 func receive(_ message: WKScriptMessage) {
  if message.name == "voleyText", let enabled = message.body as? Bool {
   if web.configuration.preferences.isTextInteractionEnabled != enabled { web.configuration.preferences.isTextInteractionEnabled = enabled }
   return
  }
  guard message.name == "voleyAudio", let body = message.body as? [String: Any], let kind = body["kind"] as? String else { return }
  if kind == "stop" { stopAudio(); return }
  guard effects.contains(kind), UIApplication.shared.applicationState == .active,
   let url = Bundle.main.url(forResource: kind, withExtension: "wav", subdirectory: "Audio") else { return }
  voices.removeAll { !$0.isPlaying }
  if voices.count >= 12 { voices.removeFirst().stop() }
  do {
   try AVAudioSession.sharedInstance().setActive(true)
   let voice = try AVAudioPlayer(contentsOf: url)
   voice.prepareToPlay(); voice.play(); voices.append(voice)
  } catch { NSLog("Voley audio could not play a bundled effect") }
 }
 @objc private func stopAudio() { voices.forEach { $0.stop() }; voices.removeAll() }
 func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
  decisionHandler(navigationAction.request.url?.isFileURL == true ? .allow : .cancel)
 }
 deinit { NotificationCenter.default.removeObserver(self) }
 override var prefersStatusBarHidden: Bool { true }
}
