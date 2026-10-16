# iOS 0.21 (1)
Bundle identifier: com.krazel.voleysimple. UIKit / WKWebView, iOS 16+, iPhone portrait and iPad. The complete offline game is bundled locally; no server, account, analytics, advertising, purchases or network requests.
Native audio: eight recorded WAV effects played through AVAudioPlayer under AVAudioSession playback. Internal mute stops active voices and blocks new effects; browser keeps Web Audio. No music currently exists. Device listening with silent mode, interruption/background, Continue and mute remains required.
Text policy: enabled at initialization; reconciled after DOM ready and while editable fields are visible. Game surface disables selection and callout. Real-device gesture QA remains required.
Build: node scripts/build-standalone.mjs; node scripts/prepare-ios.mjs; cd ios; xcodegen generate. CI compiles and launches an unsigned simulator app; this is not an installable IPA or TestFlight delivery.
App Store Connect record must be created before upload. Signing requires a distribution certificate/private key and an App Store provisioning profile for this exact bundle. Signing/upload are separate from untrusted PR builds. Do not commit credentials. TestFlight upload requires the owner's explicit authorization; external testers require separate configuration/review.
Provisional icon: code-drawn volleyball; pending visual review. Privacy: settings/mute remain on device; no data collected. Store support/privacy URLs and beta contact need the existing public Krazel support channel before external testing/App Review.

App Store Connect record verified: 6822062720; Spanish (Spain); SKU KRAZEL-VOLEY-SIMPLE-IOS. Version 0.17 is in PREPARE_FOR_SUBMISSION; Build 0.17 (1) remains internally available. Build 0.18 (1), floating controls and saved handedness, uploaded on 2026-10-12; processed VALID and owner-only IN_BETA_TESTING verified through Apple API. No external testing or App Store submission. Bundle resource 7QC46XVHP8.

0.19 (1) verified 2026-10-13: tap target, teammate pass, three tap power levels and flatter arc; Apple VALID / owner-only IN_BETA_TESTING. CI 38324645417. Physical QA pending.

0.20 (1) verified 2026-10-13: charged directional TIRO, release PASE, forgiving 900 ms reception; Apple VALID / owner-only IN_BETA_TESTING. CI 38448491881. Explicit owner exception keeps this repository public for CI. Physical QA pending.

0.21 (1) candidate prepared 2026-10-16: editable action button positions, PASE only in 2v2, assisted opponent-court shots and 1.25-second contact window. Upload authorized; processing not yet verified.
