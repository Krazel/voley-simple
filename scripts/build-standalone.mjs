import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
let html=await readFile(new URL('demo/index.html',root),'utf8');
const css=await readFile(new URL('demo/style.css',root),'utf8');
const maps=(await readFile(new URL('demo/maps.js',root),'utf8')).replace(/^export /gm,'');
const pavilion=(await readFile(new URL('demo/pavilion.js',root),'utf8')).replace(/^import .*?;\r?\n/gm,'').replace(/^export /gm,'');
const projection=(await readFile(new URL('demo/projection.js',root),'utf8')).replace(/^export /gm,'');
const trajectory=(await readFile(new URL('demo/trajectory.js',root),'utf8')).replace(/^import .*?;\r?\n/gm,'').replace(/^export /gm,'');
const engine=(await readFile(new URL('demo/engine.js',root),'utf8')).replace(/^import .*?;\r?\n/gm,'').replace(/^export /gm,'');
const controls=(await readFile(new URL('demo/controls.js',root),'utf8')).replace(/^export /gm,'');
const animation=(await readFile(new URL('demo/animation.js',root),'utf8')).replace(/^export /gm,'');
const effects=(await readFile(new URL('demo/effects.js',root),'utf8')).replace(/^export /gm,'');
const audio=(await readFile(new URL('demo/audio.js',root),'utf8')).replace(/^export /gm,'');
const preferences=(await readFile(new URL('demo/preferences.js',root),'utf8')).replace(/^export /gm,'');
let game=(await readFile(new URL('demo/game.js',root),'utf8')).replace(/^import .*?;\r?\n/gm,'');
for(const name of ['court','players','players-motion','players-action']){
 const data=await readFile(new URL('demo/assets/'+name+'.png',root));
 game=game.replace("'./assets/"+name+".png'","'data:image/png;base64,"+data.toString('base64')+"'");
}
html=html.replace('<link rel="stylesheet" href="./style.css">','<style>'+css+'</style>');
const script='(()=>{\n'+maps+'\n'+projection+'\n'+pavilion+'\n'+trajectory+'\n'+engine+'\n'+controls+'\n'+animation+'\n'+effects+'\n'+audio+'\n'+preferences+'\n'+game+'\n})();';
new Function(script); // Validate the complete embedded bundle before replacing the demo.
html=html.replace('<script type="module" src="./game.js"></script>','<script>'+script+'</script>');
await writeFile(new URL('demo/voley-offline.html',root),html);
console.log('Offline demo saved: demo/voley-offline.html (all assets embedded)');
