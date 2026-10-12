import {drawPavilion,drawMobileCourt} from './pavilion.js';
import {courtConfig} from './maps.js';
import {Match,clamp} from './engine.js';
import {StrokeControls} from './controls.js';
import {trajectoryPlan,flightPreview} from './trajectory.js';
import {projectCourt,unprojectCourt} from './projection.js';
import {animationFrame,captureMotion,interpolateMotion,animatePose} from './animation.js';
import {Effects} from './effects.js';
import {GameAudio} from './audio.js';
import {readPreferences,writePreferences} from './preferences.js';
const canvas=document.querySelector('#game'),ctx=canvas.getContext('2d');
const ui=Object.fromEntries(['overlay','play','watch','restart','pause','sound','rally','action','callout','modal-tag','modal-title','modal-copy','modal-foot','score-blue','score-orange','match-status','mode','practice','map','map-note','zoom-out','zoom-in','zoom-label'].map(id=>[id,document.getElementById(id)]));
const actionLabel=ui.action.querySelector('strong'),powerBar=ui.action.querySelector('i');
let ready=false,calloutUntil=0,trail=[],last=performance.now(),accumulator=0,previousMotion=null,renderPlayers=[],renderBall=null,visualTime=0;
const keys=new Set(),assets={},frames=[],animationFrames=[],actionFrames=[];
const poseHeights=[155,169,169,155,195,185,170,142];
const animations=Array.from({length:4},()=>({frame:0,previous:0,fade:1,lean:0,stride:0,pose:{lean:0,bounce:0,scaleX:1,scaleY:1}}));
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const fx=new Effects({reduced:reducedMotion}),sound=new GameAudio(),footsteps=[0,0,0,0];
let canvasRect=canvas.getBoundingClientRect();
let frameSamples=[],renderSamples=[],lastMetrics=0;
let previewCache=null;
let viewWidth=941,viewHeight=1672,viewX=0,viewY=0;
new ResizeObserver(()=>{
 canvasRect=canvas.getBoundingClientRect();
 const scale=Math.min(canvasRect.width/941,canvasRect.height/1672);
 if(!scale)return;
 const width=Math.round(canvasRect.width/scale),height=Math.round(canvasRect.height/scale);
 if(width!==viewWidth||height!==viewHeight){
  controls.clear();previewCache=null;
  viewWidth=canvas.width=width;viewHeight=canvas.height=height;
  viewX=(width-941)/2;viewY=(height-1672)/2;
 }
}).observe(canvas);
window.addEventListener('scroll',()=>canvasRect=canvas.getBoundingClientRect(),{passive:true});
let preferenceStorage;try{preferenceStorage=localStorage}catch{}
const preferences=readPreferences(preferenceStorage);
ui.map.value=preferences.map;ui.mode.value=preferences.mode;
const match=new Match({onEvent:handleEvent,mode:preferences.mode,map:preferences.map});
// 2.25 restores the former on-screen character height while the metric court
// remains larger. The camera follows play instead of squeezing the whole court.
const cameraBases={rooftop:1,pavilion:2.25,mobile:2.25},cameraZooms=Object.fromEntries(Object.entries(cameraBases).map(([id,base])=>[id,base*preferences.zoom[id]]));
match.map={...match.map,zoom:cameraZooms[match.map.id],panX:0,panY:match.map.id==='pavilion'?100:0};
const pavilionBackground=document.createElement('canvas');pavilionBackground.width=941;pavilionBackground.height=1672;
drawPavilion(pavilionBackground.getContext('2d'),{...courtConfig('pavilion'),zoom:1,panX:0,panY:0});
const mobileBackground=document.createElement('canvas');mobileBackground.width=941;mobileBackground.height=1672;drawMobileCourt(mobileBackground.getContext('2d'),{...courtConfig('mobile'),zoom:1});
const controls=new StrokeControls({
 action:stroke=>{
  const request=worldStroke(stroke),plan=trajectoryPlan(match.players[0],match.ball,request,match.map);
  const result=match.humanTargetHit(request);
  if(result==='buffered')message('GOLPE PREPARADO · 0,2 s',.5);
  else if(result==='hit'&&(plan.blocked||!plan.reachable||plan.out))message(plan.reason,.9);
  else if(!result&&match.ball.lastHit===0)message('NO PUEDES DAR DOS TOQUES SEGUIDOS',.9);
  else if(!result)message('BALÓN FUERA DE ALCANCE',.9);
 },
 canHit:()=>match.nearHumanBall(),
 gestureJump:false,
 jump:()=>match.humanJump({x:0,y:0}),
 dash:()=>{if(!match.humanDash(movementInput()))message('DASH · MUÉVETE PRIMERO',.7)},
 stopMove:()=>match.moveTo(match.players[0].x,match.players[0].y)
});
const surface=document.querySelector('.game-shell');
function movementInput(){return {
 x:clamp((keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0)+controls.vector.x,-1,1),
 y:clamp((keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0)+controls.vector.y,-1,1)
}}
function message(text,duration=2.2){ui.callout.textContent=text;calloutUntil=performance.now()+duration*1000}
function modal(tag,title,copy,button,restart=false){
 ui['modal-tag'].textContent=tag;ui['modal-title'].innerHTML=title;ui['modal-copy'].textContent=copy;ui.play.textContent=button;ui.restart.hidden=!restart;ui.overlay.hidden=false;ui.pause.disabled=true;
}
function hideModal(){ui.overlay.hidden=true;ui.pause.disabled=false;canvas.focus({preventScroll:true})}
function syncMode(){
 syncCameraLabel();
 const solo=match.mode==='1v1',count=solo?2:4;
 document.querySelector('.team-card strong').textContent=solo?'Tú contra un bot':'Tú + una compañera bot';
 document.querySelector('.team-card small').textContent=solo?'Toda tu mitad de la cancha':'Contra dos rivales bot';
 document.querySelector('.team-card b').innerHTML=solo?'1<span>vs</span>1':'2<span>vs</span>2';
 document.querySelector('.team-score small').textContent=match.autoplay?'AZUL':solo?'TÚ':'TÚ + BOT';
 document.querySelector('.team-score.orange small').textContent=match.autoplay?'NARANJA':solo?'BOT':'RIVALES';
 canvas.dataset.map=surface.dataset.map=match.map.id;ui['map-note'].textContent=match.map.id==='mobile'?'Campo compacto · 6,4 × 12,8 m · zoom y personajes del pabellón':match.map.id==='pavilion'?'18 × 9 m · personajes 1,80 m · red 2,43 m':'La cancha original de la azotea';
 document.querySelector('h1 em').textContent=match.map.id==='pavilion'?'cancha.':'azotea.';
 canvas.dataset.mode=match.mode;canvas.dataset.activePlayers=String(count);
 if(match.phase==='ready')message(solo?'1 CONTRA 1 · UN BOT':'2 CONTRA 2 · TRES BOTS',999);
 ui.watch.textContent=match.autoplay?'Jugar tú':'Ver partido de bots';
 canvas.setAttribute('aria-label',match.autoplay?`Partido ${match.mode} entre ${count} bots. Escape pausa.`:`Cancha ${match.mode}. WASD o flechas mueve. Espacio o Shift hace dash al moverte. Arrastra y suelta cerca del balón para apuntar a ese destino. Botón SALTO para saltar. Escape pausa.`);
}
function handleEvent(e){
 if(e.type==='hitmiss')message('BALÓN FUERA DE ALCANCE · ACÉRCATE',1.1);
 if(e.type==='start'){
  surface.classList.toggle('watching',match.autoplay);
  syncMode();
 }
 if(e.type==='start'){controls.clear();keys.clear();previewCache=null;hideModal();message('PREPARADOS…',1.2);trail=[];fx.clear();footsteps.fill(0);animations.forEach(s=>{s.frame=0;s.previous=0;s.gait=0;s.lean=0;s.stride=0;s.fade=1});previousMotion=null;renderPlayers=[];renderBall=null;ui['score-blue'].textContent=ui['score-orange'].textContent='0';ui['match-status'].textContent='Marcador: 0 a 0';ui['modal-foot'].textContent='Primero a 7 · Pases + remates manuales'}
 if(['serve','pass','attack','jump','land','point','finish'].includes(e.type))sound.play(e.type,e.team??0,e.power??.6);
 if(e.type==='serve')message(e.team===0?(match.mode==='1v1'?'TU SAQUE':'VUESTRO SAQUE'):'SAQUE RIVAL');
 if(e.type==='pass')message(e.team===0?(e.receiver===0?(e.touch===2?'2/3 · ¡TE LA COLOCA: REMATA!':'1/3 · ¡RECIBE Y COLÓCASELA!'):(e.touch===2?'2/3 · ¡TU COMPAÑERA VA A REMATAR!':'1/3 · ¡PASE A TU COMPAÑERA!')):e.touch===2?'RIVALES · 2/3 · COLOCACIÓN':'RIVALES · 1/3 · RECEPCIÓN');
 if(e.type==='attack')message(e.team===0?(e.player===0?(e.spike?'¡REMATE!':'¡BUEN GOLPE!'):'¡TU COMPAÑERA REMATA!'):'¡PREPARA LA RECEPCIÓN!');
 if(e.type==='pass'&&e.touch===3)message('3/3 · NO QUEDAN TOQUES');
 if(e.type==='jump'&&e.player===0){message(e.dash?'¡DASH!':'¡SALTO!',.7);if(e.dash)fx.emit('land',match.players[e.player],'#a5edff')}
 if(e.type==='dash'){message('¡DASH!',.6);fx.emit('land',match.players[e.player],'#a5edff');sound.play('jump')}
 if(e.type==='land')fx.emit('land',match.players[e.player],'#d7f4ff');
 if(e.type==='pass'||e.type==='attack'){fx.emit(e.type==='pass'?'pass':e.spike?'spike':'hit',match.ball,e.type==='pass'?'#9bffe0':e.spike?'#ffbd66':e.team===0?'#91d8ff':'#ffd290',e.power??.7);trail=[]}
 if(e.type==='point'){
  controls.clear();
  if(!match.practice)fx.point(e.team,e.reason);fx.emit(e.reason==='Red'?'net':'point',match.ball,e.team===0?'#93d6ff':'#ffc591');
  ui['score-blue'].textContent=e.score[0];ui['score-orange'].textContent=e.score[1];
  const score=ui[e.team===0?'score-blue':'score-orange'];score.animate([{transform:'scale(1)'},{transform:'scale(1.28)'},{transform:'scale(1)'}],{duration:reducedMotion?0:360});
  message((e.team===0?(match.mode==='1v1'?'¡PUNTO PARA TI!':'¡PUNTO PARA VOSOTROS!'):'PUNTO RIVAL')+' · '+e.reason.toUpperCase(),2);
  ui['match-status'].textContent='Marcador: '+e.score[0]+' a '+e.score[1];
 }
 if(e.type==='finish'){
  modal('FIN DEL PARTIDO',e.team===0?(match.mode==='1v1'?'¡La cancha<br>es tuya!':'¡La cancha<br>es vuestra!'):'La revancha<br>te espera.',e.score[0]+' — '+e.score[1]+'. '+(e.team===0?'¿Jugamos otro?':match.mode==='1v1'?'Sigue la marca de caída y prepara el gesto antes de recibir.':'Sigue la marca de caída y deja que tu compañera cubra su lado.'),'Jugar otra vez');
  ui['modal-foot'].textContent='Racha más larga: '+match.stats.longestRally+' golpes';
 }
 if(e.type==='pause'){sound.stop();keys.clear();controls.clear();modal('TIEMPO MUERTO','Un respiro.','Tu partido se queda aquí.','Continuar',true)}
 if(e.type==='resume'){hideModal();message('¡SEGUIMOS!')}
 if(match.autoplay){
  const team=e.team===0?'AZUL':'NARANJA';
  if(e.type==='start')ui['modal-foot'].textContent=(match.mode==='1v1'?'Dos bots':'Cuatro bots')+' · Primero a 7';
  if(e.type==='serve')message(team+' · SAQUE');
  if(e.type==='pass')message(team+' · '+(e.touch===2?'COLOCACIÓN':'PASE'));
  if(e.type==='attack')message(team+' · '+(e.spike?'¡REMATE EN SALTO!':'ATAQUE'));
  if(e.type==='point')message('PUNTO '+team+' · '+e.reason.toUpperCase(),2);
  if(e.type==='finish')modal('FIN DEL PARTIDO','Gana el equipo<br>'+team.toLowerCase()+'.',e.score[0]+' — '+e.score[1]+'. Racha más larga: '+match.stats.longestRally+' golpes.','Ver otro partido');
 }
 if(match.practice){
  if(e.type==='start'){message('PRÁCTICA · BALÓN PREPARADO',999);ui['modal-foot'].textContent='Práctica · Física real al soltar';document.querySelector('.team-score.orange small').textContent='DIANA'}
  if(e.type==='point')message('PRÁCTICA · '+e.reason.toUpperCase()+' · REPITE',2);
 }
}
const project=(x,y,z=0)=>{const p=projectCourt(x,y,z,match.map);return {...p,x:p.x+viewX,y:p.y+viewY}},unproject=(x,y)=>unprojectCourt(x-viewX,y-viewY,match.map);
function eventPoint(e){return {x:e.clientX-canvasRect.left,y:e.clientY-canvasRect.top}}
function worldStroke(stroke){
 const toWorld=p=>unproject(p.x/canvasRect.width*viewWidth,p.y/canvasRect.height*viewHeight);
 return {target:toWorld(stroke.target||stroke.last),points:stroke.points.map(toWorld),screenPoints:stroke.points.map(p=>({x:p.x/canvasRect.width*viewWidth-viewX,y:p.y/canvasRect.height*viewHeight-viewY}))};
}
function aimPlan(){
 if(!controls.aim||controls.intent()!=='hit')return null;
 const a=controls.aim,now=performance.now();
 if(previewCache?.aim===a&&previewCache.count===a.points.length&&previewCache.x===a.last.x&&previewCache.y===a.last.y&&now-previewCache.time<50)return previewCache.plan;
 const plan=trajectoryPlan(match.players[0],match.ball,worldStroke(a),match.map);
 previewCache={aim:a,count:a.points.length,x:a.last.x,y:a.last.y,time:now,plan};return plan;
}
surface.addEventListener('pointerdown',e=>{
 if(match.autoplay||!ui.overlay.hidden||!['rally','countdown'].includes(match.phase)||e.button>0)return;
 if(e.target.closest('button,select,input,a'))return;
 canvasRect=canvas.getBoundingClientRect();
 const point=eventPoint(e);
 const role=e.target.closest('#move-pad')?'move':'action';
 e.preventDefault();canvas.focus({preventScroll:true});
 if(controls.down(e.pointerId,e.pointerType,point,role))surface.setPointerCapture(e.pointerId);
});
surface.addEventListener('pointermove',e=>{
 if(controls.move?.id!==e.pointerId&&controls.aim?.id!==e.pointerId)return;
 e.preventDefault();controls.motion(e.pointerId,eventPoint(e));
});
for(const type of ['pointerup','pointercancel','lostpointercapture'])surface.addEventListener(type,e=>{
 controls.up(e.pointerId,eventPoint(e),type!=='pointerup');
});
surface.addEventListener('contextmenu',e=>e.preventDefault());
window.addEventListener('keydown',e=>{
 if(e.target instanceof HTMLButtonElement&&(e.key==='Enter'||(e.key===' '&&!ui.overlay.hidden)))return;
 if(e.target.closest('select,input'))return;
 if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','Shift','Escape','w','a','s','d','W','A','S','D'].includes(e.key)){
  if(!ui.overlay.hidden&&e.key!=='Escape')return;e.preventDefault();
  keys.add(e.key.toLowerCase());
  if(e.code==='Space'&&!e.repeat)match.humanDash(movementInput());
  if(e.key==='Shift'&&!e.repeat)match.humanDash(movementInput());
  if(e.key==='Escape'&&!e.repeat)match.togglePause();
 }
});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>{keys.clear();if(['rally','countdown','point'].includes(match.phase))match.togglePause()});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&['rally','countdown','point'].includes(match.phase))match.togglePause()});
ui.play.addEventListener('click',()=>{
 if(!ready)return;
 sound.unlock();
 if(match.phase==='paused')match.togglePause();
 else{match.start();ui['score-blue'].textContent='0';ui['score-orange'].textContent='0'}
});
ui.restart.addEventListener('click',()=>{sound.unlock();match.start();ui['score-blue'].textContent='0';ui['score-orange'].textContent='0'});
ui.watch.addEventListener('click',()=>{if(!ready)return;sound.unlock();match.autoplay=!match.autoplay;match.start();ui['score-blue'].textContent='0';ui['score-orange'].textContent='0'});
ui.pause.addEventListener('click',()=>match.togglePause());
ui.practice.addEventListener('click',()=>{if(!ready)return;sound.unlock();match.mode=ui.mode.value;match.startPractice()});
function changeArena(){
 keys.clear();controls.clear();previewCache=null;trail=[];fx.clear();previousMotion=null;renderPlayers=[];renderBall=null;
 animations.forEach(s=>{s.frame=0;s.previous=0;s.fade=1});
 match.setMap(ui.map.value);
 applyCamera();

 match.mode=ui.mode.value;match.reset();syncMode();
 savePreferences();
 ui['score-blue'].textContent=ui['score-orange'].textContent='0';
 ui['modal-foot'].textContent='Primero a 7 · '+match.map.name;
 modal('ELIGE TU PARTIDO','Tu cancha.<br>Tu siguiente punto.','Toque breve: dash al moverte. Pulsa SALTO para saltar. Cerca, traza y suelta en el destino; el golpe añade el arco sobre la red.',(match.autoplay?'Ver':'Jugar')+' · '+match.mode.replace('v',' vs '));
}
ui.mode.addEventListener('change',changeArena);ui.map.addEventListener('change',changeArena);
function savePreferences(){
 writePreferences(preferenceStorage,{map:match.map.id,mode:match.mode,zoom:Object.fromEntries(Object.entries(cameraZooms).map(([id,zoom])=>[id,zoom/cameraBases[id]]))});
}
function syncCameraLabel(){
 const zoom=match.map.zoom??1,relative=zoom/cameraBases[match.map.id];ui['zoom-label'].textContent=Math.round(relative*100)+'%';
 ui['zoom-out'].disabled=relative<=.80001;ui['zoom-in'].disabled=relative>=1.19999;canvas.dataset.zoom=String(zoom);
}
function applyCamera(preserveCenter=false){
 const ratio=cameraZooms[match.map.id]/(match.map.zoom??1);
 match.map={...match.map,zoom:cameraZooms[match.map.id],panX:preserveCenter?(match.map.panX??0)*ratio:0,panY:preserveCenter?(match.map.panY??0)*ratio:match.map.id==='pavilion'?100:0};
 controls.clear();previewCache=null;trail=[];previousMotion=null;renderPlayers=[];renderBall=null;
 syncCameraLabel();
}
for(const [id,delta] of [['zoom-out',-.1],['zoom-in',.1]])ui[id].addEventListener('click',()=>{
 const base=cameraBases[match.map.id];cameraZooms[match.map.id]=Math.round(clamp((match.map.zoom??base)/base+delta,.8,1.2)*10)/10*base;applyCamera(true);savePreferences();
});
function updateCamera(dt){
 if(match.map.id!=='pavilion'||match.phase==='paused'||controls.aim||match.pendingHit)return;
 const base={...match.map,panX:0,panY:0},p=match.players[0],b=match.ball;
 const human=projectCourt(p.x,p.y,0,base),ball=projectCourt(b.x,b.y,b.z*.5,base);
 const following=match.phase==='rally'&&(!match.practice||match.practiceFlying);
 const focusX=following?(match.autoplay?ball.x:human.x*.6+ball.x*.4):human.x;
 const targetX=clamp(focusX<260?260-focusX:focusX>681?681-focusX:0,-280,280);
 const targetY=clamp(following?(match.autoplay?850-ball.y:(1260-human.y)*.55+(800-ball.y)*.45):1260-human.y,-580,580);
 const blend=1-Math.exp(-dt*4);
 match.map.panX+=(targetX-match.map.panX)*blend;match.map.panY+=(targetY-match.map.panY)*blend;
 canvas.dataset.cameraX=match.map.panX.toFixed(1);canvas.dataset.cameraY=match.map.panY.toFixed(1);
}
function syncSound(){ui.sound.textContent=sound.enabled?'♪':'♪̸';ui.sound.setAttribute('aria-label',sound.enabled?'Silenciar efectos':'Activar efectos');ui.sound.setAttribute('aria-pressed',String(sound.enabled))}
ui.sound.addEventListener('click',()=>{sound.toggle();syncSound()});syncSound();
async function loadImage(name,url){const image=new Image();image.src=url;await image.decode();assets[name]=image}
function prepareSprites(){
 const image=assets.players,scratch=document.createElement('canvas');scratch.width=image.width;scratch.height=image.height;
 const sx=scratch.getContext('2d',{willReadFrequently:true});sx.drawImage(image,0,0);
 const pixels=sx.getImageData(0,0,image.width,image.height).data;
 const w=image.width/2,h=image.height/2;
 for(let i=0;i<4;i++){
  const ox=(i%2)*w,oy=Math.floor(i/2)*h;let x1=ox+w,y1=oy+h,x2=ox,y2=oy;
  for(let y=oy;y<oy+h;y++)for(let x=ox;x<ox+w;x++){
   if(pixels[(y*image.width+x)*4+3]>100){x1=Math.min(x1,x);x2=Math.max(x2,x);y1=Math.min(y1,y);y2=Math.max(y2,y)}
  }
  frames.push({x:x1,y:y1,w:x2-x1+1,h:y2-y1+1});
 }
 const atlas=assets['players-motion'];scratch.width=atlas.width;scratch.height=atlas.height;sx.drawImage(atlas,0,0);
 const rgba=sx.getImageData(0,0,atlas.width,atlas.height).data;
 for(let row=0;row<4;row++){
  animationFrames[row]=[];
  for(let col=0;col<4;col++){
   // Measured atlas row boundaries: overhead hands extend above the running rows.
   const rows=col===3?[0,366,690,967,1254]:[60,390,710,1000,1254];
   const left=Math.floor(col*atlas.width/4),right=Math.floor((col+1)*atlas.width/4),top=Math.floor(rows[row]/1254*atlas.height),bottom=Math.floor(rows[row+1]/1254*atlas.height);
   let x1=right,y1=bottom,x2=left,y2=top;
   for(let y=top;y<bottom;y++)for(let x=left;x<right;x++)if(rgba[(y*atlas.width+x)*4+3]>100){x1=Math.min(x1,x);x2=Math.max(x2,x);y1=Math.min(y1,y);y2=Math.max(y2,y)}
   animationFrames[row].push({x:x1,y:y1,w:x2-x1+1,h:y2-y1+1});
  }
 }
 const action=assets['players-action'];scratch.width=action.width;scratch.height=action.height;sx.drawImage(action,0,0);
 const actionPixels=sx.getImageData(0,0,action.width,action.height).data;
 for(let row=0;row<4;row++){
  actionFrames[row]=[];
  for(let col=0;col<3;col++){
   const rowEdges=[0,375,746,1068,1448];
   const left=Math.floor(col*action.width/3),right=Math.floor((col+1)*action.width/3),top=Math.floor(rowEdges[row]/1448*action.height),bottom=Math.floor(rowEdges[row+1]/1448*action.height);
   let x1=right,y1=bottom,x2=left,y2=top;
   for(let y=top;y<bottom;y++)for(let x=left;x<right;x++)if(actionPixels[(y*action.width+x)*4+3]>100){x1=Math.min(x1,x);x2=Math.max(x2,x);y1=Math.min(y1,y);y2=Math.max(y2,y)}
   actionFrames[row].push({x:x1,y:y1,w:x2-x1+1,h:y2-y1+1});
  }
 }
}
function spriteFrame(id,index){return index>=5?actionFrames[id]?.[index-5]:index?animationFrames[id]?.[index-1]:frames[id]}
function ellipse(x,y,rx,ry,color){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill()}
function line(x1,y1,x2,y2,color,width=2){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke()}
function pill(text,x,y,color='#153653',textColor='#fff',size=15){
 ctx.font='800 '+size+'px system-ui';const width=ctx.measureText(text).width+22;
 ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x-width/2,y-14,width,28,12);ctx.fill();ctx.fillStyle=textColor;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,x,y);
}
function playerPose(p){
 const displayed=renderPlayers[p.id]||p,foot=project(displayed.x,displayed.y),state=animations[p.id];
 const f=spriteFrame(p.id,state.frame);
 const height=poseHeights[state.frame]*foot.s;
 const width=f?height*f.w/f.h:height*.8;
 const celebrating=match.phase==='point'&&p.team===match.servingTeam&&match.timer>1.1;
 const visualScale=match.map.referenceHeight?foot.s:1;
 const hop=celebrating?Math.sin((2-match.timer)/.9*Math.PI)*36*visualScale:0;
 return {foot,height,width,bottom:project(displayed.x,displayed.y,displayed.z||0).y-hop-state.pose.bounce*visualScale};
}
function drawPlayer(p){
 const {foot,height,width,bottom}=playerPose(p),active=p.id===match.defenderId&&match.phase==='rally',state=animations[p.id];
 const shadowScale=1-Math.min(p.z,1.5)*.22;
 if(p.dashTime>0&&!reducedMotion){
  const tip=project(p.x,p.y,p.z+.9),tail=project(p.x-p.dashX*.9,p.y-p.dashY*.9,p.z+.9);
  ctx.globalAlpha=Math.min(1,p.dashTime/.12)*.65;
  for(let i=-1;i<=1;i++)line(tail.x+i*13,tail.y+i*8,tip.x+i*13,tip.y+i*8,'#c8f6ff',3);
  ctx.globalAlpha=1;
 }
 ellipse(foot.x+9,foot.y+9,44*foot.s*shadowScale,14*foot.s*shadowScale,'#0926464a');
 if(p.human){
  const contact=match.canHumanHit();ctx.lineWidth=contact?6:4;ctx.strokeStyle=contact?'#fff5a8':'#b8f2ff';ctx.beginPath();ctx.ellipse(foot.x,foot.y+3,51*foot.s,18*foot.s,0,0,Math.PI*2);ctx.stroke();
  ellipse(foot.x,foot.y+3,47*foot.s,15*foot.s,'#74d6ff33');
 }
 const f=frames[p.id];if(!f)return;
 ctx.save();ctx.translate(foot.x,bottom);ctx.rotate(state.pose.lean);ctx.scale(state.pose.scaleX,state.pose.scaleY);
 const crop=spriteFrame(p.id,state.frame),h=poseHeights[state.frame]*foot.s,w=h*crop.w/crop.h;
 // One opaque silhouette: pose continuity comes from motion, never ghosted double bodies.
 const settle=reducedMotion?1:1-Math.sin(state.fade*Math.PI)*.025;ctx.scale(1/settle,settle);
 ctx.drawImage(state.frame>=5?assets['players-action']:state.frame?assets['players-motion']:assets.players,crop.x,crop.y,crop.w,crop.h,-w/2,-h,w,h);ctx.restore();
 if(p.human)pill('TÚ',foot.x,foot.y+38,'#ecfaff','#1b5cad',17);
 else if(active&&(p.id===1||match.autoplay))pill('¡VOY YO!',foot.x,foot.y+30,p.team===0?'#e0fff2':'#fff0cf',p.team===0?'#176657':'#7a4b19',13);
 else if(match.phase==='ready')pill(p.team===0?'COMPAÑERA · BOT':'BOT',foot.x,foot.y+30,p.team===0?'#1f5fbccf':'#b75b24d9','#fff',13);
 if(active&&p.human){ctx.fillStyle='#d6ffff';ctx.beginPath();ctx.moveTo(foot.x-9,foot.y-height-21);ctx.lineTo(foot.x+9,foot.y-height-21);ctx.lineTo(foot.x,foot.y-height-9);ctx.fill()}
}
function drawNet(){
 if(match.map.referenceHeight){
  const m=match.map.metresPerUnit,top=match.netHeight,bottom=top-1/m;
  const segment=(x1,z1,x2,z2,color,width)=>{const a=project(x1,8,z1),b=project(x2,8,z2);line(a.x,a.y,b.x,b.y,color,width*(match.map.zoom??1))};
  const a=project(-.3/m,8,top),b=project(8+.3/m,8,bottom);
  ctx.fillStyle='#193c4933';ctx.fillRect(a.x,a.y,b.x-a.x,b.y-a.y);
  for(let x=-.3/m;x<=8+.3/m;x+=.1/m)segment(x,top,x,bottom,'#1a353da8',.85);
  for(let z=bottom;z<=top;z+=.1/m)segment(-.3/m,z,8+.3/m,z,'#1a353da8',.85);
  segment(-.3/m,top,8+.3/m,top,'#fffbea',3);segment(-.3/m,bottom,8+.3/m,bottom,'#ecefe2',1.8);
  for(const x of [-.65/m,8+.65/m]){
   segment(x,0,x,2.55/m,'#19494f',7);segment(x,.05/m,x,1.8/m,'#207c83',11);
   segment(x,top,x<0?-.3/m:8+.3/m,top,'#203e47',1.2);
  }
  for(const x of [0,8])for(let i=0;i<8;i++)segment(x,top+i*.1/m,x,top+(i+1)*.1/m,i%2?'#ffede4':'#d54c36',2.4);
  return;
 }
 const zoom=match.map.zoom??1,l=project(-.22,8),r=project(8.22,8),height=132*zoom,bottom=22*zoom,meshHeight=110*zoom;
 // Net only occupies its physical vertical plane; draw-order lets near players pass in front.
 line(l.x,l.y+5,r.x,r.y+5,'#27405b35',8);
 ctx.fillStyle='#122c4438';ctx.fillRect(l.x,l.y-height,r.x-l.x,meshHeight);
 const wave=reducedMotion?0:Math.sin(visualTime*38)*fx.net*9*zoom;
 for(let x=l.x;x<=r.x;x+=19*zoom){ctx.strokeStyle='#183754cb';ctx.lineWidth=2.2*zoom;ctx.beginPath();ctx.moveTo(x,l.y-height);ctx.quadraticCurveTo(x+wave,l.y-height/2,x,l.y-bottom);ctx.stroke()}
 for(let y=l.y-height;y<=l.y-bottom;y+=15*zoom){ctx.strokeStyle='#183754b8';ctx.lineWidth=2*zoom;ctx.beginPath();ctx.moveTo(l.x,y);ctx.quadraticCurveTo((l.x+r.x)/2,y+wave,r.x,y);ctx.stroke()}
 line(l.x,l.y-height,r.x,r.y-height,'#fffdf1',8*zoom);
 line(l.x,l.y-bottom,r.x,r.y-bottom,'#eaeee9',4*zoom);
 for(const x of [l.x,r.x]){
  ctx.fillStyle='#145ab9';ctx.beginPath();ctx.roundRect(x-10*zoom,l.y-height-20*zoom,20*zoom,height+35*zoom,8*zoom);ctx.fill();
  line(x-3*zoom,l.y-height-15*zoom,x-3*zoom,l.y+6*zoom,'#529cff',4*zoom);
  ellipse(x,l.y-height-18*zoom,10*zoom,5*zoom,'#122a42');
 }
}
function drawBall(){
 const b=renderBall||match.ball,shadow=project(b.x,b.y),point=project(b.x,b.y,b.z);
 const radius=match.map.referenceHeight?match.map.ballRadius*55*(match.map.zoom??1):(14.5+Math.min(3,b.z)*1.7)*point.s;
 ellipse(shadow.x,shadow.y+4,match.map.referenceHeight?radius+Math.min(b.z,4):14+Math.min(b.z,4)*3,match.map.referenceHeight?radius*.4:7,'#122d4660');
 if(trail.length>1&&b.alive){
  ctx.lineCap='round';
  for(let i=1;i<trail.length;i++){const a=project(trail[i-1].x,trail[i-1].y,trail[i-1].z),b=project(trail[i].x,trail[i].y,trail[i].z);ctx.globalAlpha=i/trail.length*.45;line(a.x,a.y,b.x,b.y,fx.tint,i/trail.length*12)}ctx.globalAlpha=1;
 }
 ctx.save();ctx.translate(point.x,point.y);const kick=reducedMotion?0:fx.ballKick;ctx.scale(1+kick*.16,1-kick*.12);ctx.rotate(visualTime*(b.alive?7:0));ctx.shadowColor='#092c494d';ctx.shadowBlur=8;ctx.shadowOffsetY=3;
 ellipse(0,0,radius,radius,'#fffcec');ctx.shadowColor='transparent';ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.clip();
 for(let i=0;i<3;i++){ctx.save();ctx.rotate(i*Math.PI*2/3);ctx.fillStyle=i===1?'#f5c33c':'#1966c7';ctx.beginPath();ctx.moveTo(-radius*.25,-radius);ctx.bezierCurveTo(radius*.65,-radius*.65,radius*.65,radius*.2,0,radius);ctx.lineTo(radius*.6,radius);ctx.bezierCurveTo(radius*1.15,0,radius*.8,-radius*.9,radius*.2,-radius);ctx.closePath();ctx.fill();ctx.restore()}
 ctx.restore();ctx.strokeStyle='#154b7466';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(point.x,point.y,radius,0,Math.PI*2);ctx.stroke();
}
function drawPrediction(){
 if(match.phase!=='rally')return;const pred=match.prediction(.05);
 if(pred.y<(match.autoplay?0:8)||pred.y>16||pred.x<0||pred.x>8)return;
 const p=project(pred.x,pred.y),human=!!match.players[match.defenderId]?.human;
 const pulse=1+Math.sin(match.time*7)*.12;
 ctx.strokeStyle=human?'#d4ffff':'#ffffff9c';ctx.lineWidth=human?4:2;
 ctx.setLineDash([10,8]);ctx.beginPath();ctx.ellipse(p.x,p.y,34*pulse,14*pulse,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
 ellipse(p.x,p.y,6,3,'#fffbd0');
 if(human)pill('AQUÍ',p.x,p.y+31,'#153a638a','#fff',12);
}
function drawShotPlan(plan,alpha=1){
 const preview=flightPreview(plan),warning=plan.blocked||!plan.reachable||plan.out;
 const color=warning?'#ffae79':plan.pass?'#9affdc':'#fff7b9';
 ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle=color;ctx.lineWidth=5;ctx.beginPath();
 preview.points.forEach((q,i)=>{const s=project(q.x,q.y,q.z);if(i===0)ctx.moveTo(s.x,s.y);else ctx.lineTo(s.x,s.y)});ctx.stroke();
 const target=project(plan.requestedTarget.x,plan.requestedTarget.y),end=preview.points.at(-1),actual=project(end.x,end.y,end.z);
 ctx.setLineDash([8,6]);ctx.beginPath();ctx.ellipse(target.x,target.y,24,11,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
 ellipse(actual.x,actual.y,8,8,color);
 if(warning){line(target.x-12,target.y-12,target.x+12,target.y+12,color,4);line(target.x+12,target.y-12,target.x-12,target.y+12,color,4)}
 pill(plan.reason+' · '+plan.actualSpeed.toFixed(1)+' m/s',actual.x,actual.y+33,'#163654ef',color,14);
 ctx.restore();
}
function drawGestures(){
 const r=canvasRect,scaleX=viewWidth/r.width,scaleY=viewHeight/r.height;
 if(controls.move){
  const a=controls.move.start,v=controls.vector;
  ellipse(a.x*scaleX,a.y*scaleY,45*scaleX,45*scaleY,'#16364c55');
  ellipse((a.x+v.x*30)*scaleX,(a.y+v.y*30)*scaleY,18*scaleX,18*scaleY,'#e7faffaa');
 }
 if(controls.aim){
  const a=controls.aim,intent=controls.intent(),plan=aimPlan();
  ctx.setLineDash([5,8]);ctx.strokeStyle='#f4fcffaa';ctx.lineWidth=3;ctx.beginPath();
  a.points.forEach((p,i)=>{if(i===0)ctx.moveTo(p.x*scaleX,p.y*scaleY);else ctx.lineTo(p.x*scaleX,p.y*scaleY)});ctx.stroke();ctx.setLineDash([]);
  if(plan){
   drawShotPlan(plan);
  }else{
   const p=match.players[0],s=project(p.x,p.y,p.z+1.2);
   pill(intent==='dash'?'TOQUE · DASH':'ACÉRCATE AL BALÓN',s.x,s.y-30,'#163654ef','#fff7b9',14);
  }
 }
}
function drawEffects(){
 for(const p of fx.particles){
  const s=project(p.x,p.y,p.z);ctx.globalAlpha=Math.min(1,p.life/p.max*1.5);
  if(p.kind==='dust')ellipse(s.x,s.y,p.size*(1+p.max-p.life),p.size*.45,p.color);
  else if(p.kind==='point'){ctx.save();ctx.translate(s.x,s.y);ctx.rotate((p.max-p.life)*7+p.vx);ctx.fillStyle=p.color;ctx.fillRect(-p.size/2,-p.size,p.size,p.size*2);ctx.restore()}
  else{const tail=project(p.x-p.vx*.035,p.y-p.vy*.035,p.z-p.vz*.025);line(tail.x,tail.y,s.x,s.y,p.color,p.size)}
 }
 ctx.globalAlpha=1;
 for(const p of fx.impacts){
  const s=project(p.x,p.y,p.z||0),t=1-p.life/p.max,ground=['land','point','net'].includes(p.kind),radius=15+t*(p.kind==='spike'?95:p.kind==='hit'?65:42);
  ctx.globalAlpha=(1-t)*(1-t);ctx.strokeStyle=p.color;ctx.lineWidth=2+(1-t)*4;
  ctx.beginPath();ctx.ellipse(s.x,s.y,radius,ground?radius*.3:radius,0,0,Math.PI*2);ctx.stroke();
  if(p.kind==='hit'||p.kind==='spike')for(let i=0;i<8;i++){const a=i*Math.PI/4+.2;line(s.x+Math.cos(a)*radius*.55,s.y+Math.sin(a)*radius*.55,s.x+Math.cos(a)*radius*1.35,s.y+Math.sin(a)*radius*1.35,p.color,3)}
  if(p.kind==='spike'){
   const end=project(p.x+(p.vx||0)*.11,p.y+(p.vy||0)*.11,(p.z||0)+(p.vz||0)*.05);
   ctx.lineCap='round';line(s.x,s.y,end.x,end.y,p.color,10*(1-t));line(s.x,s.y,end.x,end.y,'#fffbea',4*(1-t));
  }
 }
 ctx.globalAlpha=1;
 if(fx.banner&&match.phase!=='finished'){
  const b=fx.banner,age=1.8-b.life,fade=Math.min(1,age/.15,b.life/.25);
  ctx.save();ctx.globalAlpha=fade;ctx.translate(viewWidth/2,viewY+865+(reducedMotion?0:Math.max(0,1-age/.22)*25));
  ctx.fillStyle=b.team===0?'#123969ee':'#6b3919ee';ctx.beginPath();ctx.roundRect(-295,-65,590,130,22);ctx.fill();
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=b.team===0?'#b6e6ff':'#ffe1ad';ctx.font='900 31px system-ui';ctx.fillText(match.autoplay?(b.team===0?'¡PUNTO AZUL!':'¡PUNTO NARANJA!'):b.team===0?(match.mode==='1v1'?'¡PUNTO PARA TI!':'¡PUNTO PARA VOSOTROS!'):'PUNTO RIVAL',0,-19);
  ctx.fillStyle='#fff';ctx.font='600 19px system-ui';ctx.fillText(b.reason+' · '+match.score[0]+' — '+match.score[1],0,25);ctx.restore();
 }
}
function setText(element,value){if(element.textContent!==value)element.textContent=value}
function render(){
 ctx.clearRect(0,0,viewWidth,viewHeight);
 const zoom=match.map.zoom??1,background=match.map.id==='mobile'?mobileBackground:match.map.id==='pavilion'?pavilionBackground:assets.court;
 ctx.fillStyle=match.map.id==='pavilion'?'#c99763':'#193753';ctx.fillRect(0,0,viewWidth,viewHeight);
 if(background)ctx.drawImage(background,viewX+470.5*(1-zoom)+(match.map.panX??0),viewY+836*(1-zoom)+(match.map.panY??0),941*zoom,1672*zoom);
 if(!ready)return;
 drawPrediction();
 const far=match.activePlayers.filter(p=>p.team===1).sort((a,b)=>a.y-b.y);
 const near=match.activePlayers.filter(p=>p.team===0).sort((a,b)=>a.y-b.y);
 far.forEach(drawPlayer);
 if(match.ball.y<=8&&match.ball.z<match.netHeight)drawBall();
 drawNet();near.forEach(drawPlayer);
 if(match.ball.y>8||match.ball.z>=match.netHeight)drawBall();
 drawEffects();
 if(!controls.aim&&['rally','point'].includes(match.phase)&&match.lastTargetPlan&&match.time-match.lastTargetAt<1.8)drawShotPlan(match.lastTargetPlan,Math.min(.8,(1.8-match.time+match.lastTargetAt)*1.5));
 drawGestures();
 const canHit=match.canHumanHit();
 ui.action.classList.toggle('near',canHit);
 ui.action.classList.toggle('aiming',!!controls.aim);
 const plan=aimPlan();
 setText(actionLabel,plan?plan.actualSpeed.toFixed(1)+' m/s':controls.aim&&controls.intent()==='jump'?'SALTO':match.pendingHit?'PREPARADO':canHit?'TRAZA':'DASH');
 const power=plan?Math.round(plan.power*100)+'%':'0%';if(powerBar.style.width!==power)powerBar.style.width=power;
 canvas.dataset.aim=plan?plan.reason:controls.intent()||'';
 canvas.dataset.phase=match.phase;canvas.dataset.playerZ=match.players[0].z.toFixed(3);
 canvas.dataset.practice=String(match.practice);
 canvas.dataset.lastTarget=match.lastTargetPlan?JSON.stringify(match.lastTargetPlan.requestedTarget):'';
 setText(ui.rally,match.phase==='rally'?(match.rally===0?'SAQUE':(match.autoplay?(match.lastTeam===0?'AZUL':'NARANJA'):match.lastTeam===0?'VUESTRO EQUIPO':'RIVALES')+' · TOQUE '+match.touches+'/3'):match.phase==='point'?'SIGUIENTE SAQUE EN '+Math.ceil(match.timer):match.phase==='countdown'?'SAQUE EN '+Math.ceil(match.timer):match.phase==='finished'?'PARTIDO TERMINADO':'PRIMERO A 7');
 if(match.practice)setText(ui.rally,match.phase==='point'?'OTRO BALÓN EN '+Math.ceil(match.timer):match.practiceFlying?'PRÁCTICA · VUELO REAL':'PRÁCTICA · DIBUJA Y SUELTA');
 ui.callout.style.opacity=performance.now()<calloutUntil||match.phase==='ready'?'1':'.3';
}
function loop(now){
 const frameMs=now-last,elapsed=Math.min(frameMs/1000,.1);last=now;accumulator+=elapsed;
 while(accumulator>=1/120){
  const {x,y}=movementInput();
  previousMotion=captureMotion(match);
  match.update(1/120,{x,y});
  if(match.phase!=='paused')fx.update(1/120);
  if(['rally','point','countdown'].includes(match.phase)){
   if(match.phase==='rally')for(const p of match.activePlayers){
    footsteps[p.id]+=Math.hypot(p.vx,p.vy)/120;
    if(footsteps[p.id]>.8&&p.z<.04){footsteps[p.id]=0;fx.emit('dust',p,'#e4f2e9')}
   }
   if(match.phase==='rally'){trail.push({x:match.ball.x,y:match.ball.y,z:match.ball.z});if(trail.length>14)trail.shift()}
  }
  accumulator-=1/120;
 }
 const alpha=accumulator*120,dt=match.phase==='paused'?0:elapsed;
 updateCamera(dt);
 visualTime+=dt;
 renderPlayers=match.players.map((p,i)=>interpolateMotion(p,previousMotion?.players[i],alpha));
 renderBall=interpolateMotion(match.ball,previousMotion?.ball,alpha);
 match.players.forEach(p=>{
  const receiving=p.id===match.defenderId&&match.ball.vz<0&&Math.hypot(p.x-match.ball.x,p.y-match.ball.y)<1.4;
  const animated=match.phase==='rally'||match.phase==='paused'?p:{...p,moving:0,vx:0,vy:0};
  const celebrating=match.phase==='point'&&p.team===match.servingTeam&&match.timer>1.1;
  const frame=celebrating?5:animationFrame(animated,animations[p.id].gait||0,p.human&&!!controls.aim,receiving&&match.phase==='rally');
  animations[p.id].pose=animatePose(animations[p.id],animated,reducedMotion?0:dt,visualTime,frame);
  if(reducedMotion){animations[p.id].fade=1;animations[p.id].pose={lean:0,bounce:0,scaleX:1,scaleY:1}}
 });
 if(match.phase!=='rally'&&match.phase!=='paused')trail=[];
 const renderStart=performance.now();render();
 if(!document.hidden&&match.phase==='rally'){frameSamples.push(frameMs);renderSamples.push(performance.now()-renderStart)}
 if(now-lastMetrics>2000&&frameSamples.length){
  const percentile=a=>a.sort((a,b)=>a-b)[Math.floor((a.length-1)*.95)].toFixed(2);
  canvas.dataset.frameP95=percentile(frameSamples);canvas.dataset.renderP95=percentile(renderSamples);canvas.dataset.samples=String(frameSamples.length);
  frameSamples=[];renderSamples=[];lastMetrics=now;
 }
 requestAnimationFrame(loop);
}
Promise.all([loadImage('court','./assets/court.png'),loadImage('players','./assets/players.png'),loadImage('players-motion','./assets/players-motion.png'),loadImage('players-action','./assets/players-action.png')]).then(()=>{
 prepareSprites();ready=true;ui.play.disabled=false;ui.watch.disabled=false;ui.practice.disabled=false;syncMode();ui.play.textContent='Jugar · '+match.mode.replace('v',' vs ');message(match.mode==='1v1'?'1 CONTRA 1 · UN BOT':'2 CONTRA 2 · TRES BOTS',999);
}).catch(error=>{ui.play.textContent='No se pudo cargar';ui['modal-copy'].textContent='No se han podido cargar los gráficos. Recarga la demo con el servidor local abierto.';console.error(error)});
requestAnimationFrame(loop);
// Read-only diagnostics for local QA; game controls remain the normal UI.
Object.defineProperty(window,'volleyDebug',{value:()=>JSON.parse(JSON.stringify({phase:match.phase,score:match.score,players:match.players.map(({id,human,team,x,y,contacts})=>({id,human,team,x,y,contacts})),ball:match.ball,stats:match.stats,defenderId:match.defenderId,ready,frames}))});

const jumpButton=document.getElementById('jump-button');
jumpButton.addEventListener('pointerdown',e=>{
 e.preventDefault();e.stopPropagation();
 if(!match.autoplay&&ui.overlay.hidden&&['rally','countdown'].includes(match.phase))match.humanJump({x:0,y:0});
});
jumpButton.addEventListener('click',e=>{if(e.detail===0&&!match.autoplay&&ui.overlay.hidden)match.humanJump({x:0,y:0})});
