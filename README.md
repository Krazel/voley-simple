# Vóley simple



Anime volleyball: 1v1 or 2v2 with bots, manual traced shots and three selectable courts.



Run locally: node demo/server.mjs then http://127.0.0.1:4328/voley-offline.html. Node 22+; no dependencies. Tests: node --test tests/*.test.js. Build standalone: node scripts/build-standalone.mjs.



Mobile: touch anywhere on the movement half to move (left for right-handed, right for left-handed); a second finger acts on either half; tap screen to dash while moving; SALTO on the action side jumps; trace near the ball and release at your target. PC: WASD/arrows move, Space/Shift dash, mouse traces shots.



Cancha móvil fits portrait phones at the same sprite scale as Pabellón. Pabellón is the real 18 by 9 metre map; the mobile court is compact arcade geometry.



iOS 0.19 (1): UIKit WKWebView, native AVAudioPlayer effects. CI validates an unsigned simulator build; TestFlight signing and upload are separate. See ios/TESTFLIGHT.md.



Copyright Krazel Studio. Public source does not grant an additional license to redistribute game art.

