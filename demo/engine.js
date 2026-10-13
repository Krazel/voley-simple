import {courtConfig,courtGravity,courtNet} from './maps.js';
import {trajectoryPlan} from './trajectory.js';
export const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function seededRandom(seed=9){return()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296}}
const DASH_DURATION=.28,DASH_SPEED=9;
export function shotPlan(player,ball,direction,power=.55,court=null){
 const GRAVITY=court?courtGravity(court):9.8;
 power=clamp(Number.isFinite(power)?power:.55,.02,1);
 const n=direction?Math.hypot(direction.x,direction.y):0;
 const dx=n>.001?direction.x/n:0,dy=n>.001?direction.y/n:-1;
 const travel=.35+13.65*power;
 const target={x:ball.x+dx*travel,y:ball.y+dy*travel};
 const pass=target.y>8&&target.y<16&&target.x>0&&target.x<8;
 const originZ=Math.max(.3,ball.z),lobTime=(1.1+.45*power)*(player.z>.35?.9:1);
 const lobVz=(.85-originZ+.5*GRAVITY*lobTime*lobTime)/lobTime;
 // A high airborne contact can drive down; low balls and gentle sets still lift.
 // Direction/range stay manual, and the real net can stop a poorly placed spike.
 const strength=pass||dy>=0?0:clamp((player.z-.12)/.83,0,1)*clamp((ball.z-1.65),0,1)*clamp((power-.16)/.3,0,1);
 const vz=lobVz+(-(.6+3.8*power)-lobVz)*strength;
 const targetZ=.85*(1-strength);
 const time=strength===0?lobTime:(vz+Math.sqrt(vz*vz+2*GRAVITY*(originZ-targetZ)))/GRAVITY;
 return {target,time,power,pass,originZ,vz,targetZ,spike:strength>0&&vz<0,strength};
}
export class Match {
 constructor({random=Math.random,winningScore=7,onEvent=()=>{},autoplay=false,mode='2v2',map='rooftop'}={}){this.map=courtConfig(map);this.gravity=courtGravity(this.map);this.netHeight=courtNet(this.map);this.random=random;this.winningScore=winningScore;this.onEvent=onEvent;this.autoplay=autoplay;this.mode=mode==='1v1'?'1v1':'2v2';this.reset();}
 setMap(id){this.map=courtConfig(id);this.gravity=courtGravity(this.map);this.netHeight=courtNet(this.map);this.reset()}
 get activePlayers(){return this.players.filter(p=>p.active)}
 setMode(mode){this.mode=mode==='1v1'?'1v1':'2v2';this.start()}
 reset(){
  this.practice=false;this.practiceFlying=false;
  this.players=[
   {id:0,team:0,human:true,x:2.35,y:12.7,homeX:2.35,homeY:12.7,speed:5.5},
   {id:1,team:0,human:false,x:5.7,y:11.8,homeX:5.7,homeY:11.8,speed:4.5},
   {id:2,team:1,human:false,x:2.3,y:4.6,homeX:2.3,homeY:4.6,speed:3.45},
   {id:3,team:1,human:false,x:5.7,y:3.4,homeX:5.7,homeY:3.4,speed:3.65}
  ].map(p=>({...p,active:this.mode==='2v2'||p.id===0||p.id===2,tx:p.x,ty:p.y,hit:0,hitKind:'pass',land:0,moving:0,vx:0,vy:0,contacts:0,reaction:0,errorX:0,errorY:0,z:0,vz:0,dashTime:0,dashX:0,dashY:0,dashCooldown:0}));
  if(this.autoplay)this.players.forEach(p=>{p.human=false;p.speed=4.2;p.homeX=p.id%2?5.7:2.3;p.homeY=p.team===0?12:4;p.x=p.tx=p.homeX;p.y=p.ty=p.homeY});
  if(this.mode==='1v1')this.activePlayers.forEach(p=>{p.x=p.tx=p.homeX=4;p.y=p.ty=p.homeY=p.team===0?12.7:3.3;p.speed=p.human?5.5:4.2});
  this.players.forEach(p=>{p.speed/=this.map.metresPerUnit});
  this.score=[0,0];this.phase='ready';this.timer=0;this.time=0;this.servingTeam=0;this.lastTeam=null;this.touches=0;this.rally=0;this.receiver=null;this.winner=null;this.target={x:this.players[0].x,y:this.players[0].y};
  this.stats={contacts:[0,0,0,0],passes:0,attacks:0,points:0,netFaults:0,longestRally:0};
  this.ball={x:this.players[0].x,y:this.players[0].y,z:1.1,vx:0,vy:0,vz:0,lastHit:-1,cooldown:0,alive:false};
  this.pendingHit=null;this.lastReach=-Infinity;
  this.aiTimer=0;this.defenderId=null;this.intercepts=[];this.setReceiver=null;this.lastTargetPlan=null;this.lastTargetAt=-Infinity;
  this.tactics=[{shots:[],pending:null},{shots:[],pending:null}];this.mobility=[.6,.6,.6,.6];
 }
 event(type,data={}){this.onEvent({type,...data})}
 start(){this.reset();this.phase='countdown';this.timer=1.2;this.event('start')}
 startPractice(){this.autoplay=false;this.reset();this.practice=true;this.preparePracticeBall();this.event('start')}
 preparePracticeBall(){
  const p=this.players[0];this.phase='rally';this.practiceFlying=false;this.lastTeam=1;this.touches=0;this.defenderId=0;
  this.pendingHit=null;this.lastReach=-Infinity;
  Object.assign(this.ball,{x:p.x,y:p.y-.2,z:p.z+1.3,vx:0,vy:0,vz:0,alive:true,lastHit:2,cooldown:0});
 }
 togglePause(){if(this.phase==='paused'){this.phase=this.beforePause;this.event('resume')}else if(['rally','point','countdown'].includes(this.phase)){this.pendingHit=null;this.lastReach=-Infinity;this.beforePause=this.phase;this.phase='paused';this.event('pause')}}
 moveTo(x,y){this.target={x:clamp(x,.45,7.55),y:clamp(y,8.65,15.45)}}
 canHumanHit(margin=0){
  const p=this.players[0],b=this.ball;
  const airborne=p.z>.05||p.vz>0;
  return p.human&&this.phase==='rally'&&b.alive&&b.cooldown<=0&&b.lastHit!==0&&b.y>8&&b.z>0&&distance(p,b)<=(airborne?1.85:1.6)+margin&&b.z>=Math.max(.04,p.z-.9-margin)&&b.z<=p.z+(airborne?2.55:2.15)+margin;
 }
 humanJump(direction=null){
  if(this.phase!=='rally'||!this.players[0].human)return null;
  const p=this.players[0];
  if(p.z<=.001&&p.vz<=0){
   const d=direction||{x:p.vx,y:p.vy},n=Math.hypot(d.x,d.y),dash=n>.2;
   p.vz=5.7/this.map.metresPerUnit;p.dashTime=dash?DASH_DURATION:0;p.dashX=dash?d.x/n:0;p.dashY=dash?d.y/n:0;
   this.event('jump',{player:0,dash});return 'jump';
  }
  return null;
 }
 humanDash(direction={x:0,y:0}){
  const p=this.players[0],n=Math.hypot(direction.x,direction.y);
  if(this.phase!=='rally'||!p.human||p.dashCooldown>0||n<=.2)return null;
  p.dashTime=DASH_DURATION;p.dashX=direction.x/n;p.dashY=direction.y/n;p.dashCooldown=.65;
  this.event('dash',{player:0});return 'dash';
 }
 canHumanAim(){
  const p=this.players[0],b=this.ball;
  return p.human&&this.phase==='rally'&&b.alive&&b.lastHit!==0&&b.y>8&&b.z>0&&distance(p,b)<=2.6&&b.z<=p.z+3.4;
 }
 nearHumanBall(){
  const p=this.players[0],b=this.ball,airborne=p.z>.05||p.vz>0;
  // Proximity and legality are separate: a nearby ball just hit by the player
  // still means a hit gesture (rejected legally), never an unexpected jump.
  return p.human&&this.phase==='rally'&&b.alive&&b.y>8&&b.z>0&&distance(p,b)<=2.6&&b.z>=Math.max(.04,p.z-1.2)&&b.z<=p.z+(airborne?3.4:2.45);
 }
 humanTargetHit(request){
  if(!request||!Number.isFinite(request.target?.x+request.target?.y))return null;
  const copy={target:{...request.target},strength:request.strength,tapLevel:request.tapLevel,points:(request.points||[]).map(p=>({...p})),screenPoints:request.screenPoints?.map(p=>({...p}))};
  if(this.canHumanHit(request.assisted?.3:0)||(this.time-this.lastReach<=.12&&this.canHumanHit(.3))){this.humanTargetShot(copy);return 'hit'}
  if(!this.canHumanAim())return null;
  this.pendingHit={request:copy,expires:this.time+.2};return 'buffered';
 }
 humanTargetShot(request){
  const plan=trajectoryPlan(this.players[0],this.ball,request,this.map);
  this.humanShot(null,plan.power,plan);this.lastTargetPlan=plan;this.lastTargetAt=this.time;if(this.practice)this.practiceFlying=true;
 }
 humanHit(direction=null,power=.55){
  if(this.canHumanHit()||(this.time-this.lastReach<=.12&&this.canHumanHit(.3))){this.humanShot(direction,power);return 'hit'}
  const p=this.players[0],b=this.ball;
  if(!p.human||this.phase!=='rally'||!b.alive||b.lastHit===0||b.y<=8||b.z<=0||distance(p,b)>2.6||b.z>p.z+3.4)return null;
  // A deliberate release can wait briefly for contact; holding/standing nearby never hits.
  this.pendingHit={direction:direction?{...direction}:null,power,expires:this.time+.2};
  return 'buffered';
 }
 humanShot(direction,power=.55,customPlan=null){
  this.resolveShot(0,-.6);
  this.pendingHit=null;this.lastReach=-Infinity;
  const p=this.players[0],b=this.ball;
  this.touches=this.lastTeam===0?this.touches+1:1;this.lastTeam=0;b.lastHit=0;
  p.hit=.42;p.contacts++;this.rally++;this.stats.contacts[0]++;
  this.stats.longestRally=Math.max(this.stats.longestRally,this.rally);
  if(this.touches>3){this.point(1,'Cuatro toques');return}
  const plan=customPlan||shotPlan(p,b,direction,power,this.map),{target}=plan;
  const from={x:b.x,y:b.y,z:plan.originZ};
  p.hitX=(target.x-b.x)/Math.max(.1,distance(b,target));
  // Own-side shots remain fully manual; the teammate claims reception, never the last hitter.
  const partner=this.activePlayers.find(q=>q.team===0&&q.id!==0),pass=plan.pass&&!!partner;
  p.hitKind=pass?'pass':'attack';
  this.launch(from,target,plan.time,pass?partner.id:null,plan.targetZ);
  if(pass){this.stats.passes++;this.event('pass',{player:0,receiver:1,team:0,touch:this.touches,power:plan.power})}
  else{this.stats.attacks++;this.event('attack',{player:0,team:0,touch:this.touches,aimed:!!direction,power:plan.power,spike:plan.spike})}
 }
 prediction(height=.95){
  const b=this.ball;const disc=b.vz*b.vz+2*this.gravity*(b.z-height);
  const t=disc<0?0:Math.max(0,(b.vz+Math.sqrt(disc))/this.gravity);
  return {x:b.x+b.vx*t,y:b.y+b.vy*t,t};
 }
 launch(from,target,T,receiver=null,targetZ=.85){
  this.pendingHit=null;this.lastReach=-Infinity;
  const b=this.ball; b.x=from.x;b.y=from.y;b.z=from.z??1.05;
  b.vx=(target.x-b.x)/T;b.vy=(target.y-b.y)/T;b.vz=(targetZ-b.z+.5*this.gravity*T*T)/T;b.alive=true;b.cooldown=.19;
  this.receiver=receiver;
  this.setReceiver=null;
  this.aiTimer=0;this.defenderId=null;this.intercepts=[];
  this.activePlayers.forEach(p=>{
   if(p.human)return;
   // Bots react and occasionally misread an attacking ball; no perfect teleporting returns.
   const receiveTeam=target.y>=8?0:1;
   const underAttack=receiveTeam!==this.lastTeam&&p.team===receiveTeam;
   const realCourt=this.map.id==='pavilion';
   const misread=underAttack&&this.random()<(realCourt?.18:this.autoplay?.09:p.team===1?.16:.055);
   p.reaction=receiver!==null?.06:.13+this.random()*.14+(misread?.13:0);
   p.errorX=misread?(this.random()<.5?-1:1)*(realCourt?2.2:1.65):(this.random()-.5)*.22;
   p.errorY=misread?(this.random()-.5)*.7:0;
  });
 }
 serve(){
  this.players.forEach(p=>{p.x=p.homeX;p.y=p.homeY;p.tx=p.x;p.ty=p.y;p.z=0;p.vz=0;p.hit=0;p.land=0;p.vx=0;p.vy=0;p.moving=0;p.dashTime=0;p.dashX=0;p.dashY=0;p.dashCooldown=0});
  this.target={x:this.players[0].x,y:this.players[0].y};
  const server=this.players[this.servingTeam===0?0:2];
  server.hit=.42;server.hitKind='attack';
  this.lastTeam=server.team;this.touches=1;this.rally=0;this.ball.lastHit=server.id;
  if(server.human)this.launch(server,{x:3+this.random()*2,y:4.5},1.65);
  else{
   const from={x:server.x,y:server.y,z:1.6},plan=this.chooseAttack(server.team,from,1.55);
   this.launch(from,plan.target,plan.time,null,0);this.rememberShot(server.team,plan,'serve');
  }
  this.phase='rally';this.event('serve',{team:server.team});
 }
 interception(p){
  const b=this.ball;let best=null,earliest=null;
  // Search the descending contact window, not just one predicted floor point.
  for(let height=p.human?1.5:2.85;height>=.24;height-=.14){
   if(b.vz<0&&b.z<height)continue;
   const q=this.prediction(height);
   if(q.x<.05||q.x>7.95||q.y<(p.team===0?8.05:.05)||q.y>(p.team===0?15.95:7.95))continue;
   const reach=p.human?1.45:.78;
   const gap=distance(p,q),approach=gap>.01?((q.x-p.x)*p.vx+(q.y-p.y)*p.vy)/gap:0;
   // Do not assume an idle human will instantly sprint at full speed to every ball.
   const hesitation=p.human&&gap>reach+.5&&approach<.3?.24:0;
   const arrival=Math.max(height>1.55?.25:0,p.reaction+hesitation+Math.max(0,gap-reach)/Math.max(.01,p.speed)+.06);
   const option={...q,height,margin:arrival-q.t,reachable:arrival<=q.t};
   if(option.reachable&&!earliest)earliest=option;
   if(!best||option.margin<best.margin)best=option;
  }
  const q=this.prediction(.2);
  return earliest?{...earliest,margin:best.margin}:best||{...q,margin:10,reachable:false};
 }
 planDefense(){
  const b=this.ball,landing=this.prediction(.2),side=landing.y>=8?0:1;
  this.intercepts=this.players.map(p=>p.active?this.interception(p):null);
  const eligible=this.activePlayers.filter(p=>p.team===side&&p.id!==b.lastHit);
  if(!eligible.length){this.defenderId=null;return}
  const cost=p=>this.intercepts[p.id].margin-(p.human?.015:0)-(p.id===this.defenderId?.16:0);
  let chosen=eligible.reduce((a,p)=>cost(p)<cost(a)?p:a);
  const assigned=eligible.find(p=>p.id===this.receiver);
  // Keep a set for its receiver while it remains playable; rescue only if needed.
  if(assigned&&this.intercepts[assigned.id].reachable)chosen=assigned;
  this.defenderId=chosen.id;
 }
 passTarget(partner,setting=false){
  const lead=partner.human?.24:.18;
  const advance=setting&&!partner.human?clamp((partner.team===0?9.6:6.4)-partner.y,-partner.speed*.65,partner.speed*.65):partner.team===0?-.35:.35;
  return {x:clamp(partner.x+partner.vx*lead,.85,7.15),y:clamp(partner.y+partner.vy*lead+advance,partner.team===0?9.2:.9,partner.team===0?15.1:6.8)};
 }
 resolveShot(defendingTeam,outcome){
  const memory=this.tactics[1-defendingTeam];
  if(memory.pending){memory.pending.outcome=outcome;memory.pending=null}
 }
 rememberShot(team,plan,kind='attack'){
  const memory=this.tactics[team],shot={target:{...plan.target},style:plan.style,kind,outcome:null};
  memory.shots.push(shot);if(memory.shots.length>10)memory.shots.shift();memory.pending=shot;
 }
 attackOptions(team,from=this.ball,minTime=0){
  const opponents=this.activePlayers.filter(p=>p.team!==team);
  const targets=[];
  for(const x of [1,2.5,4,5.5,7])for(const depth of [1.5,3.7,6.1])targets.push({x,y:team===0?depth:16-depth});
  // The seam moves with the defenders instead of always belonging to the same grid cell.
  if(opponents.length>1)targets.push({x:clamp((opponents[0].x+opponents[1].x)/2,1,7),y:clamp((opponents[0].y+opponents[1].y)/2,team===0?1.5:9.5,team===0?6.5:14.5)});
  const options=[];
  for(const target of targets)for(const style of ['drive','lob']){
   const f=clamp((8-from.y)/(target.y-from.y),.03,.97),z=Math.max(.3,from.z);
   const clearance=Math.sqrt(Math.max(0,2*(this.netHeight+.25-z*(1-f))/(this.gravity*f*(1-f))));
   const time=Math.max(minTime,z>2.2?.58+distance(from,target)*.017:1.02+distance(from,target)*.025,clearance)+(style==='lob'?.24:0);
   // Aim where neither defender can comfortably arrive; lead their current motion.
   const vz=(.5*this.gravity*time*time-z)/time;
   const safety=Math.min(...opponents.flatMap(p=>{
    const pos={x:clamp(p.x+p.vx*.2,.4,7.6),y:clamp(p.y+p.vy*.2,p.team===0?8.6:.45,p.team===0?15.55:7.4)};
    const observedSpeed=p.speed*(p.human?.5+.5*this.mobility[p.id]:1);
    // Score the descending path, since a defender can cut off a shot before its landing spot.
    return [1.5,.85,.2].map(height=>{
     const disc=vz*vz+2*this.gravity*(z-height);if(disc<0)return 10;
     const t=(vz+Math.sqrt(disc))/this.gravity,q={x:from.x+(target.x-from.x)*t/time,y:from.y+(target.y-from.y)*t/time};
     if(q.y<(p.team===0?8.05:.05)||q.y>(p.team===0?15.95:7.95))return 10;
     return Math.max(0,distance(pos,q)-(p.human?1.45:.85))/Math.max(.1,observedSpeed)+.18-t;
    });
   }));
   const baseScore=safety,history=this.tactics[team].shots;
   let repetition=0,learning=0;
   history.forEach((shot,i)=>{
    const recency=Math.pow(.62,history.length-1-i),near=Math.exp(-(distance(shot.target,target)**2)/5);
    repetition+=recency*(near*(shot.style===style?.23:.12)+(distance(shot.target,target)<.6?.22:0));
    if(shot.outcome!==null)learning+=recency*near*shot.outcome*.09;
   });
   options.push({target,time,style,baseScore,score:baseScore-repetition+learning});
  }
  // Variety is limited to genuinely competitive placements, not random bad shots.
  const strongest=Math.max(...options.map(p=>p.baseScore));
  return options.filter(p=>p.baseScore>=strongest-.5).sort((a,b)=>b.score-a.score);
 }
 attackPlan(team,from=this.ball){return this.attackOptions(team,from)[0]}
 chooseAttack(team,from=this.ball,minTime=0){
  const options=this.attackOptions(team,from,minTime),best=options[0];
  const viable=options.filter(p=>p.score>=best.score-.3);
  const weights=viable.map(p=>Math.exp((p.score-best.score)/.13));
  let pick=this.random()*weights.reduce((a,b)=>a+b,0);
  for(let i=0;i<viable.length;i++){pick-=weights[i];if(pick<=0)return viable[i]}
  return best;
 }
 botDecision(p){
  const attack=this.attackPlan(p.team);
  if(this.touches>=3)return {kind:'attack',attack};
  const partner=this.activePlayers.find(q=>q.team===p.team&&q.id!==p.id);
  if(!partner)return {kind:'attack',attack};
  const setting=this.touches===2,pass=this.passTarget(partner,setting);
  const time=setting?clamp(1.4+distance(this.ball,pass)*.04,1.45,1.75):clamp(1.15+distance(this.ball,pass)*.035,1.2,1.6);
  const passVz=(.85-this.ball.z+.5*this.gravity*time*time)/time;
  const contactHeight=clamp(this.ball.z+Math.max(0,passVz)**2/(2*this.gravity)-.15,1.4,2.75);
  const future=this.attackPlan(p.team,{...pass,z:contactHeight});
  // Compare this actual contact with the shot the partner could play after a pass.
  // Wide/low/running receptions are less controlled; another pass costs time and risk.
  const pressure=.35*clamp(distance(p,this.ball)/.86,0,1)+.25*clamp(1-this.ball.z,0,1)+.14*clamp(Math.hypot(p.vx,p.vy)/Math.max(.1,p.speed),0,1);
  const arrival=partner.reaction+distance(partner,pass)/Math.max(.1,partner.speed);
  const passRisk=Math.max(0,arrival-time)*.6+distance(this.ball,pass)**2*.012;
  const jumpTimingRisk=setting?.1+distance(partner,pass)*.03:0;
  const attackValue=clamp(attack.score,-1.5,.25)-pressure,passValue=clamp(future.score,-1.5,.25)-time*.12-passRisk-jumpTimingRisk-.04;
  return {kind:passValue>attackValue?'pass':'attack',attack,pass,time,partner,attackValue,passValue};
 }
 contact(p){
  if(p.human)return; // Human contacts only happen through an explicit input action.
  this.resolveShot(p.team,-.6);
  const same=this.lastTeam===p.team;
  this.touches=same?this.touches+1:1;this.lastTeam=p.team;this.ball.lastHit=p.id;
  p.hit=.42;p.contacts++;this.rally++;this.stats.contacts[p.id]++;
  this.stats.longestRally=Math.max(this.stats.longestRally,this.rally);
  if(this.touches>3){this.point(1-p.team,'Cuatro toques');return}
  const decision=this.botDecision(p);
  if(decision.kind==='pass'){
   p.hitKind='pass';
   const {pass,time,partner}=decision;
   p.hitX=(pass.x-this.ball.x)/Math.max(.1,distance(this.ball,pass));
   this.launch({x:this.ball.x,y:this.ball.y,z:Math.max(.3,this.ball.z)},pass,time,partner.id);
   if(this.touches===2)this.setReceiver=partner.id;
   this.stats.passes++;this.event('pass',{player:p.id,receiver:partner.id,team:p.team,touch:this.touches});
  }else{
   p.hitKind='attack';
   const chosen=this.chooseAttack(p.team);
   p.hitX=(chosen.target.x-this.ball.x)/Math.max(.1,distance(this.ball,chosen.target));
   const spike=p.z>.2&&this.ball.z>2.2;
   this.launch({x:this.ball.x,y:this.ball.y,z:Math.max(.3,this.ball.z)},chosen.target,chosen.time,null,0);
   this.rememberShot(p.team,chosen);
   this.stats.attacks++;this.event('attack',{player:p.id,team:p.team,touch:this.touches,spike,power:spike?.9:.55});
  }
 }
 point(team,reason='Balón al suelo'){
  if(this.phase!=='rally')return;
  this.tactics.forEach((memory,i)=>{if(memory.pending){memory.pending.outcome=i===team?1:-1;memory.pending=null}});
  if(!this.practice)this.score[team]++;
  this.stats.points++;this.phase='point';this.timer=2.0;this.servingTeam=team;this.ball.alive=false;this.receiver=null;
  this.pendingHit=null;this.lastReach=-Infinity;
  this.players.forEach(p=>{p.dashTime=0;p.dashX=0;p.dashY=0;p.dashCooldown=0});
  this.setReceiver=null;
  this.event('point',{team,reason,score:[...this.score]});
  if(!this.practice&&this.score[team]>=this.winningScore){this.winner=team;this.phase='finished';this.event('finish',{team,score:[...this.score]})}
 }
 update(dt,input={x:0,y:0}){
  if(!['rally','point','countdown'].includes(this.phase))return;
  dt=clamp(dt,0,1/30);this.time+=dt;
  this.activePlayers.forEach(p=>{
   p.hit=Math.max(0,p.hit-dt);p.land=Math.max(0,p.land-dt);
   p.dashCooldown=Math.max(0,p.dashCooldown-dt);
   if(p.z>0||p.vz>0){p.z=Math.max(0,p.z+p.vz*dt-.5*(14/this.map.metresPerUnit)*dt*dt);p.vz-=14/this.map.metresPerUnit*dt;if(p.z===0){p.vz=0;p.dashTime=0;p.land=.24;this.event('land',{player:p.id})}}
  });
  if(this.phase==='countdown'||this.phase==='point'){this.timer-=dt;if(this.timer<=0){if(this.practice)this.preparePracticeBall();else this.serve()}return}
  const b=this.ball;b.cooldown=Math.max(0,b.cooldown-dt);
  if(this.canHumanHit())this.lastReach=this.time;
  this.aiTimer-=dt;
  if(this.aiTimer<=0&&!this.practice){this.planDefense();this.aiTimer=.09}
  const defender=this.players[this.defenderId];
  this.activePlayers.forEach(p=>{
   if(this.practice&&!p.human)return;
   const previousX=p.x,previousY=p.y;
   p.reaction=Math.max(0,p.reaction-dt);
   if(p.human){
    if(input.x||input.y){
     const len=Math.max(1,Math.hypot(input.x,input.y));
     this.moveTo(p.x+input.x/len*p.speed*dt,p.y+input.y/len*p.speed*dt);
    }
    p.tx=this.target.x;p.ty=this.target.y;
   }else if(defender?.id===p.id){
    const pred=this.intercepts[p.id]||this.prediction();
    if(pred.height>2.1&&p.z===0&&p.vz===0&&pred.t>.04&&pred.t<.3&&distance(p,pred)<1){p.vz=5.7/this.map.metresPerUnit;this.event('jump',{player:p.id})}
    // Correct an initial misread gradually; reaction time and running speed still count.
    if(p.reaction===0){const recovery=this.map.id==='pavilion'?.65:2;p.errorX*=Math.exp(-dt*recovery);p.errorY*=Math.exp(-dt*recovery)}
    p.tx=clamp(pred.x+p.errorX,.4,7.6);p.ty=clamp(pred.y+p.errorY,p.team===0?8.65:.5,p.team===0?15.5:7.35);
   }else{
    const teammate=this.activePlayers.find(q=>q.team===p.team&&q.id!==p.id);
    const receiving=defender?.team===p.team;
    const lane=teammate?(receiving?(this.intercepts[teammate.id]?.x??teammate.x):teammate.x):4;
    p.tx=Math.abs(lane-4)<.65?p.homeX:lane<4?5.7:2.3;
    p.ty=receiving?(p.team===0?10.5:5.5):(p.team===0?12.1:3.9);
   }
   const dx=p.tx-p.x,dy=p.ty-p.y,len=Math.hypot(dx,dy),speed=p.speed;
   const desired=p.reaction>0&&!p.human?0:speed;
   const easing=1-Math.exp(-(p.human?38:16)*dt);
   const desiredX=len>.001?dx/len*desired:0,desiredY=len>.001?dy/len*desired:0;
   const velocityX=p.vx+(desiredX-p.vx)*easing,velocityY=p.vy+(desiredY-p.vy)*easing;
   const step=p.reaction>0&&!p.human?0:Math.min(len,Math.hypot(velocityX,velocityY)*dt);
   p.moving=step/dt>.1?1:0;
   p.vx=len>.001?dx/len*step/dt:0;p.vy=len>.001?dy/len*step/dt:0;
   if(len>.001){p.x+=dx/len*step;p.y+=dy/len*step}
   if(p.human&&p.dashTime>0){
    const remaining=Math.max(0,p.dashTime-dt);
    // Integrate the fading impulse exactly; releasing movement does not cancel it.
    const impulse=DASH_SPEED/this.map.metresPerUnit*(p.dashTime*p.dashTime-remaining*remaining)/(2*DASH_DURATION);
    const pushX=p.dashX*impulse,pushY=p.dashY*impulse;
    p.x+=pushX;p.y+=pushY;p.dashTime=remaining;
    this.moveTo(this.target.x+pushX,this.target.y+pushY);
   }
   p.x=clamp(p.x,.4,7.6);p.y=clamp(p.y,p.team===0?8.6:.45,p.team===0?15.55:7.4);
   if(p.human&&dt>0){p.vx=(p.x-previousX)/dt;p.vy=(p.y-previousY)/dt;p.moving=Math.hypot(p.vx,p.vy)>.1?1:0}
   const activity=clamp(Math.hypot(p.vx,p.vy)/Math.max(.1,p.speed),0,1);
   this.mobility[p.id]+=(activity-this.mobility[p.id])*(1-Math.exp(-dt*.9));
  });
  if(this.practice&&!this.practiceFlying){
   const p=this.players[0];Object.assign(b,{x:p.x,y:p.y-.2,z:p.z+1.3,vx:0,vy:0,vz:0});return;
  }
  const previous={x:b.x,y:b.y,z:b.z,vz:b.vz};
  b.x+=b.vx*dt;b.y+=b.vy*dt;b.z+=b.vz*dt-.5*this.gravity*dt*dt;b.vz-=this.gravity*dt;
  if((previous.y>8&&b.y<=8)||(previous.y<8&&b.y>=8)){
   const t=(8-previous.y)/b.vy,x=previous.x+b.vx*t,z=previous.z+previous.vz*t-.5*this.gravity*t*t;
   if(z<this.netHeight&&x>=0&&x<=8){this.stats.netFaults++;this.point(1-this.lastTeam,'Red');return}
  }
  if(this.canHumanHit())this.lastReach=this.time;
  if(this.pendingHit){
   if(this.time>this.pendingHit.expires){this.pendingHit=null;this.event('hitmiss',{player:0})}
   else if(this.canHumanHit()){const {direction,power,request}=this.pendingHit;if(request)this.humanTargetShot(request);else this.humanShot(direction,power);return}
  }
  if(!this.practice&&b.vz<0&&b.z>.1&&b.cooldown<=0){
   const side=b.y>8?0:1;
   const candidates=this.activePlayers.filter(p=>!p.human&&p.team===side&&p.id!==b.lastHit&&distance(p,b)<.86/this.map.metresPerUnit&&b.z<(p.z>.05?p.z+2.1:1.55));
   candidates.sort((a,c)=>distance(a,b)-distance(c,b));
   const player=candidates.find(p=>p.id===this.defenderId);
   if(player){this.contact(player);return}
  }
  if(b.z<=0){
   b.z=0;
   const out=b.x<0||b.x>8||b.y<0||b.y>16;
   this.point(out?1-this.lastTeam:(b.y>8?1:0),out?'Fuera':'Balón al suelo');
  }
 }
}
