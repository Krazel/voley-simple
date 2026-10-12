import test from 'node:test';
import assert from 'node:assert/strict';
import {StrokeControls} from '../demo/controls.js';
import {trajectoryPlan,flightPreview,flightPoint,strokeMetrics,MAX_SHOT_SPEED} from '../demo/trajectory.js';
import {Match,seededRandom} from '../demo/engine.js';
import {projectCourt,unprojectCourt} from '../demo/projection.js';
const origin={x:4,y:12,z:1.3},player={z:0};
const request=(target,points=[])=>({target,points});
function contact(mode='2v2'){
 const m=new Match({mode,random:seededRandom(6)});m.phase='rally';m.lastTeam=1;
 Object.assign(m.players[0],{x:4,y:12});m.moveTo(4,12);
 Object.assign(m.ball,{...origin,lastHit:2,cooldown:0,alive:true,vx:0,vy:0,vz:0});return m;
}
function input(near=false){
 let time=0,canHit=near;const events=[];
 const c=new StrokeControls({now:()=>time,canHit:()=>canHit,action:s=>events.push(['hit',s]),jump:()=>events.push(['jump']),dash:()=>events.push(['dash'])});
 return {c,events,setTime:t=>time=t,setNear:n=>canHit=n};
}
test('stroke destination is the exact physical floor endpoint and gravity is constant',()=>{
 for(const target of [{x:4.2,y:12},{x:6,y:11},{x:2,y:3},{x:-1,y:5}]){
  const p=trajectoryPlan(player,origin,request(target));assert(p.reachable);
  const end=flightPoint(p,p.time);assert(Math.hypot(end.x-target.x,end.y-target.y)<1e-8);assert(end.z<1e-8);
  assert(p.actualSpeed<=MAX_SHOT_SPEED+1e-8);
  const z=t=>p.originZ+p.vz*t-4.9*t*t;
  assert(Math.abs((z(.2)-2*z(.1)+z(0))+.098)<1e-8);
 }
});
test('straight longer strokes request more speed; curved/retraced strokes cannot add power',()=>{
 const short=strokeMetrics(origin,{x:5,y:12}),long=strokeMetrics(origin,{x:7,y:12});assert(long.speed>short.speed);
 const bent=strokeMetrics(origin,{x:7,y:12},[{x:5,y:14},{x:6,y:10}]);assert(bent.speed<long.speed);
 const plan=trajectoryPlan(player,origin,request({x:7,y:12},[{x:5,y:14},{x:6,y:10}]));
 assert(plan.adjusted);assert.equal(plan.reason,'TRAZO AJUSTADO');
 assert(flightPreview(plan).points.every(p=>Math.abs(p.y-12)<1e-8));
});
test('a drawn feasible ballistic curve is fitted; arbitrary sideways loops are visibly adjusted',()=>{
 const target={x:1,y:4},T=1.35,vx=(target.x-origin.x)/T,vy=(target.y-origin.y)/T,vz=-origin.z/T+4.9*T;
 const screenPoints=Array.from({length:30},(_,i)=>{const t=T*i/29;return projectCourt(origin.x+vx*t,origin.y+vy*t,origin.z+vz*t-4.9*t*t)});
 const p=trajectoryPlan(player,origin,{target,points:screenPoints.map(q=>unprojectCourt(q.x,q.y)),screenPoints});
 assert(p.shapeError<5);assert(Math.abs(p.time-T)<.15);assert(p.actualSpeed<=18+1e-8);
 const bad=[screenPoints[0],{x:100,y:700},{x:850,y:350},{x:100,y:100},{x:850,y:600},screenPoints.at(-1)];
 const q=trajectoryPlan(player,origin,{target,points:bad.map(p=>unprojectCourt(p.x,p.y)),screenPoints:bad});assert(q.adjusted);assert(q.shapeError>24);
 const behind=projectCourt(4,15,0),r=trajectoryPlan(player,origin,{target,points:[unprojectCourt(behind.x,behind.y),...screenPoints.map(q=>unprojectCourt(q.x,q.y))],screenPoints:[behind,...screenPoints]});
 assert.equal(p.time,r.time);assert.equal(p.actualSpeed,r.actualSpeed);
});
test('release position projection is consistent on desktop and narrow mobile canvases',()=>{
 for(const width of [320,390,941])for(const target of [{x:1,y:3},{x:5,y:12},{x:7.8,y:15.8}]){
  const p=projectCourt(target.x,target.y),css={x:p.x/941*width,y:p.y/1672*(width*1672/941)};
  const q=unprojectCourt(css.x/width*941,css.y/(width*1672/941)*1672);
  assert(Math.hypot(q.x-target.x,q.y-target.y)<1e-8);
 }
});
test('starting farther behind the same contact adds no charge, time, speed or destination',()=>{
 const target={x:4,y:3},a=request(target,[{x:4,y:13},{x:4,y:12},{x:4,y:10},{x:4,y:6}]),b=request(target,[{x:4,y:30},{x:4,y:16},...a.points]);
 const p=trajectoryPlan(player,origin,a),q=trajectoryPlan(player,origin,b);
 for(const key of ['time','vx','vy','vz','actualSpeed','requestedSpeed'])assert.equal(p[key],q[key]);
 assert.deepEqual(p.target,q.target);assert.deepEqual(p.requestedTarget,target);
});
test('unreachable endpoint is retained and the capped real flight ends elsewhere visibly',()=>{
 const target={x:100,y:12},p=trajectoryPlan(player,origin,request(target));
 assert.equal(p.reachable,false);assert.equal(p.reason,'FUERA DE ALCANCE');assert.deepEqual(p.requestedTarget,target);
 assert(p.actualSpeed<=18+1e-8);assert(p.target.x<100);assert(p.target.x>20);
 const end=flightPoint(p,p.time);assert(Math.abs(end.x-p.target.x)<1e-8);assert(end.z<1e-7);
});
test('preview and simulation agree on net collision and ground/out scoring in both modes',()=>{
 for(const mode of ['1v1','2v2'])for(const type of ['net','ground','out']){
  const m=contact(mode);m.activePlayers.filter(p=>!p.human).forEach(p=>p.reaction=10);
  // A low contact almost touching the net cannot be lifted over it within
  // the speed cap, even with the new minimum-arc assistance.
  if(type==='net'){m.players[0].y=8.7;m.ball.y=8.001;m.ball.z=.3}
  const target=type==='net'?{x:4,y:4}:type==='out'?{x:9,y:12}:{x:4.5,y:12};
  const plan=trajectoryPlan(m.players[0],m.ball,request(target));
  if(type==='net'){assert(plan.blocked);assert.equal(flightPreview(plan).collision,'net')}
  let reason;m.onEvent=e=>{if(e.type==='point')reason=e.reason};
  assert.equal(m.humanTargetHit(request(target)),'hit');
  m.activePlayers.filter(p=>!p.human).forEach(p=>p.reaction=10);
  for(let i=0;i<1000&&m.phase==='rally';i++)m.update(1/120);
  assert.equal(reason,type==='net'?'Red':type==='out'?'Fuera':'Balón al suelo');assert.equal(m.score[0]+m.score[1],1);
 }
});
test('tiny own-side target permits a soft sub-metre pass; teammate receives an actual set',()=>{
 const small=trajectoryPlan(player,origin,request({x:4.3,y:12}));assert(small.actualSpeed<4);assert(small.pass);assert(small.vz>0);
 const m=contact(),mate=m.players[1];Object.assign(mate,{x:5.4,y:12,vx:0,vy:0,reaction:0});
 m.humanTargetHit(request({x:5.4,y:12}));assert.equal(m.receiver,1);
 for(let i=0;i<240&&mate.contacts===0;i++)m.update(1/120);
 assert.equal(mate.contacts,1);assert.equal(m.stats.passes,1);assert.equal(m.stats.contacts[0],1);
});
test('buffered target hit recalculates from real contact, preserves endpoint and expires on pause',()=>{
 const m=contact(),target={x:3,y:3};m.ball.z=3;m.ball.vz=-1;m.humanJump({x:0,y:0});
 assert.equal(m.humanTargetHit(request(target)),'buffered');target.x=7;
 for(let i=0;i<24&&m.stats.contacts[0]===0;i++)m.update(1/120);
 assert.equal(m.stats.contacts[0],1);assert.equal(m.lastTargetPlan.requestedTarget.x,3);assert.equal(m.pendingHit,null);
 const p=m.lastTargetPlan;assert(Math.abs(p.vx-m.ball.vx)<1e-8);
 const n=contact();n.ball.z=3;n.humanTargetHit(request({x:4,y:3}));n.togglePause();assert.equal(n.pendingHit,null);
});
test('tap always resolves only dash on release, including with ball near; long hold/deadband do nothing',()=>{
 for(const near of [false,true]){
  const {c,events,setTime}=input(near);c.down(1,'touch',{x:30,y:30});assert.equal(events.length,0);
  setTime(280);assert.equal(c.up(1,{x:40,y:30}),'dash');assert.deepEqual(events,[['dash']]);c.up(1,{x:40,y:30});assert.equal(events.length,1);
 }
 for(const [dx,time] of [[11,100],[17.99,100],[0,281]]){
  const {c,events,setTime}=input(true);c.down(1,'mouse',{x:0,y:0});setTime(time);assert.equal(c.up(1,{x:dx,y:0}),'none');assert.equal(events.length,0);
 }
});
test('upward far-ball drag jumps; close-ball drag hits; release decides and a returned drag never becomes a tap',()=>{
 const {c,events,setNear}=input();c.down(1,'touch',{x:100,y:200});c.motion(1,{x:100,y:176});assert.equal(events.length,0);
 assert.equal(c.up(1,{x:100,y:176}),'jump');assert.deepEqual(events,[['jump']]);
 c.down(2,'mouse',{x:100,y:200});c.motion(2,{x:100,y:150});setNear(true);assert.equal(c.up(2,{x:100,y:150}),'hit');
 assert.deepEqual(events[1][1].target,{x:100,y:150});assert.equal(events.length,2);
 setNear(false);c.down(3,'touch',{x:0,y:0});c.motion(3,{x:0,y:-40});assert.equal(c.up(3,{x:0,y:0}),'none');assert.equal(events.length,2);
});
test('hysteresis boundaries, side drags and cancelled/UI gestures cannot dispatch extra actions',()=>{
 for(const [x,y,expected] of [[0,-23.99,'none'],[0,-24,'jump'],[30,-24,'jump'],[30.1,-24,'none'],[40,0,'none']]){
  const {c,events}=input();c.down(1,'touch',{x:0,y:0});assert.equal(c.up(1,{x,y}),expected);assert.equal(events.length,expected==='jump'?1:0);
 }
 const {c,events}=input(true);assert.equal(c.down(1,'touch',{x:0,y:0},'ui'),false);c.up(1,{x:0,y:0});assert.equal(events.length,0);
 c.down(2,'touch',{x:0,y:0});c.up(2,{x:0,y:-50},true);assert.equal(events.length,0);
 c.down(3,'touch',{x:0,y:0});c.clear();c.up(3,{x:0,y:-50});assert.equal(events.length,0);
});
test('two fingers work in either order; movement release/cancel never consumes the stroke',()=>{
 for(const first of ['move','aim']){
  const {c,events}=input(true);
  const move=()=>c.down(1,'touch',{x:0,y:0},'move'),aim=()=>c.down(2,'touch',{x:200,y:300});
  if(first==='move'){move();aim()}else{aim();move()}
  c.motion(1,{x:40,y:0});assert(c.vector.x>0);assert.equal(c.down(3,'touch',{x:100,y:100}),false);
  c.up(1,{x:40,y:0},true);assert.equal(c.aim.id,2);assert.deepEqual(c.vector,{x:0,y:0});
  c.up(2,{x:250,y:200});assert.equal(events.length,1);assert.equal(events[0][0],'hit');
 }
});
test('tap dash has no jump or automatic ball direction, cooldown and pause are respected',()=>{
 const m=contact('1v1'),p=m.players[0];assert.equal(m.humanDash({x:0,y:0}),null);assert.equal(p.z,0);
 const before={...m.ball};assert.equal(m.humanDash({x:1,y:0}),'dash');assert.equal(m.humanDash({x:-1,y:0}),null);assert.deepEqual(m.ball,before);
 for(let i=0;i<36;i++)m.update(1/120);assert(Math.abs(p.x-5.26)<1e-8);assert.equal(p.z,0);assert.equal(p.vz,0);assert.equal(p.y,12);
 m.togglePause();const state=JSON.stringify(p);m.update(.02,{x:1,y:0});assert.equal(JSON.stringify(p),state);assert.equal(m.humanDash({x:1,y:0}),null);
});
test('mode changes restart cleanly; solo bots never involve inactive partners',()=>{
 const m=new Match({mode:'1v1',autoplay:true,random:seededRandom(8)});m.start();assert.deepEqual(m.activePlayers.map(p=>p.id),[0,2]);
 for(let i=0;i<120*180&&m.phase!=='finished';i++)m.update(1/120);
 assert.equal(m.phase,'finished');assert.equal(m.stats.passes,0);assert.equal(m.players[1].contacts+m.players[3].contacts,0);
 m.setMode('2v2');assert.equal(m.activePlayers.length,4);assert.deepEqual(m.score,[0,0]);assert.equal(m.phase,'countdown');
 m.autoplay=false;m.setMode('1v1');assert.equal(m.activePlayers.filter(p=>p.human).length,1);assert.equal(m.pendingHit,null);
});
test('practice holds the prepared ball until a deliberate stroke, then uses identical match physics',()=>{
 const m=new Match({mode:'1v1'});m.startPractice();const before={...m.ball};
 for(let i=0;i<120;i++)m.update(1/120);assert.deepEqual(m.ball,before);assert.equal(m.stats.contacts[0],0);
 const target={x:2,y:3},plan=trajectoryPlan(m.players[0],m.ball,request(target));
 assert.equal(m.humanTargetHit(request(target)),'hit');assert(m.practiceFlying);
 for(const k of ['vx','vy','vz'])assert(Math.abs(m.ball[k]-plan[k])<1e-8);
 const initial={...m.ball};m.update(1/120);assert(Math.abs(m.ball.z-(initial.z+initial.vz/120-4.9/14400))<1e-8);
 for(let i=0;i<500&&m.phase==='rally';i++)m.update(1/120);assert.equal(m.phase,'point');assert.deepEqual(m.score,[0,0]);
 for(let i=0;i<250;i++)m.update(1/120);assert.equal(m.phase,'rally');assert.equal(m.practiceFlying,false);
 m.start();assert.equal(m.practice,false);assert.equal(m.phase,'countdown');
});
test('a ball above standing reach allows jump; a nearby illegal second touch never becomes a jump',()=>{
 const m=contact('1v1'),events=[];
 const c=new StrokeControls({canHit:()=>m.nearHumanBall(),jump:()=>{events.push('jump');m.humanJump({x:0,y:0})},action:()=>{events.push('hit');m.humanTargetHit(request({x:4,y:3}))}});
 m.ball.z=3;c.down(1,'touch',{x:100,y:200});assert.equal(c.up(1,{x:100,y:150}),'jump');assert.equal(m.players[0].vz,5.7);
 m.players[0].vz=0;m.ball.z=1.3;m.ball.lastHit=0;c.down(2,'touch',{x:100,y:200});assert.equal(c.up(2,{x:100,y:150}),'hit');
 assert.deepEqual(events,['jump','hit']);assert.equal(m.players[0].vz,0);assert.equal(m.stats.contacts[0],0);
});
