# Vóley simple



Anime volleyball: 1v1 or 2v2 with bots, charged directional shots and three selectable courts.



Run locally: node demo/server.mjs then http://127.0.0.1:4328/voley-offline.html. Node 22+; no dependencies. Tests: node --test tests/*.test.js. Build standalone: node scripts/build-standalone.mjs.



Mobile: drag on the movement half; hold TIRO to charge and release to shoot toward the opponent court. PASE follows your teammate in 2v2 and is hidden in 1v1. SALTO and DASH are separate buttons. Menu > Colocar botones repositions controls and saves each handedness layout. Shots wait up to 1.25 seconds for legal contact. PC: WASD/arrows move, Space/Shift dash; use action buttons or mouse strokes.



Cancha móvil fits portrait phones at the same sprite scale as Pabellón. Pabellón is the real 18 by 9 metre map; the mobile court is compact arcade geometry.



iOS 0.21 (1): UIKit WKWebView, native AVAudioPlayer effects. CI validates an unsigned simulator build; TestFlight signing and upload are separate. See ios/TESTFLIGHT.md.



Copyright Krazel Studio. Public source does not grant an additional license to redistribute game art.

