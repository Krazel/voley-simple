// Two independent pointer owners: lifting/cancelling one never consumes the other.
export function chargePower(milliseconds){return Math.max(0,Math.min(1,milliseconds/850))}
export function directedTarget(origin,direction){
 const n=Math.hypot(direction.x,direction.y),d=n>.1?{x:direction.x/n,y:direction.y/n}:{x:0,y:-1};
 return {x:Math.max(.4,Math.min(7.6,origin.x+d.x*10)),y:Math.max(.6,Math.min(15.4,origin.y+d.y*10))};
}
export function touchRole(type,x,width,handedness,move){
 if(type==='mouse'||move)return 'action';
 const movementSide=handedness==='left'?x>=width/2:x<width/2;
 return movementSide?'move':'action';
}
export function simpleTarget(players,ball,pass=false){
 const partner=players.find(p=>p.team===0&&p.id!==0);
 if(pass&&partner)return {x:Math.max(.8,Math.min(7.2,partner.x)),y:Math.max(9.2,Math.min(14.5,partner.y))};
 const rivals=players.filter(p=>p.team===1);
 const targets=[{x:1.6,y:3.8},{x:4,y:3.8},{x:6.4,y:3.8}];
 return targets.sort((a,b)=>{
  const space=t=>Math.min(...rivals.map(p=>Math.hypot(p.x-t.x,p.y-t.y)),10)-Math.abs(t.x-ball.x)*.12;
  return space(b)-space(a);
 })[0];
}
export function tapTarget(world,partnerHit){
 if(partnerHit)return {kind:'pass',receiver:partnerHit.id,target:{x:partnerHit.x,y:partnerHit.y}};
 if(world.x>=0&&world.x<=8&&world.y>=0&&world.y<8)return {kind:'attack',target:{...world}};
 return null;
}
export function groupTap(previous,request,point,now){
 const same=previous&&now-previous.lastTap<=240&&now-previous.firstTap<=480&&previous.kind===request.kind&&previous.receiver===request.receiver&&Math.hypot(point.x-previous.screen.x,point.y-previous.screen.y)<=36;
 return same?{...previous,level:Math.min(3,previous.level+1),lastTap:now,until:now+600,commitAt:now+220}:{...request,screen:{...point},level:1,firstTap:now,lastTap:now,until:now+600,commitAt:now+220};
}
export function dragPower(direction,span=130){
 if(!direction)return .55;
 return Math.max(.02,Math.min(1,Math.hypot(direction.x,direction.y)/Math.max(40,span)));
}
export function containsPoint(point,bounds,padding=0){
 return point.x>=bounds.x-padding&&point.x<=bounds.x+bounds.width+padding&&point.y>=bounds.y-padding&&point.y<=bounds.y+bounds.height+padding;
}
export class GestureControls {
 constructor({action=()=>{},jump=()=>{},stopMove=()=>{}}={}){this.action=action;this.jump=jump;this.stopMove=stopMove;this.clear()}
 clear(){this.move=null;this.aim=null;this.jumpPointers=new Set();this.vector={x:0,y:0};this.stopMove()}
 down(id,type,point,role=null){
  if(this.move?.id===id||this.aim?.id===id)return false;
  if(this.jumpPointers.has(id))return false;
  const action=type==='mouse'||role==='action';
  if(!action&&role!=='move'){this.jumpPointers.add(id);this.jump();return true}
  if(action){if(this.aim)return false;this.aim={id,start:{...point},last:{...point}}}
  else{if(this.move)return false;this.move={id,start:{...point},last:{...point}};this.vector={x:0,y:0}}
  return true;
 }
 motion(id,point){
  if(this.move?.id===id){
   this.move.last={...point};const dx=point.x-this.move.start.x,dy=point.y-this.move.start.y,n=Math.hypot(dx,dy);
   const strength=Math.min(1,Math.max(0,(n-6)/40));
   this.vector=n?{x:dx/n*strength,y:dy/n*strength}:{x:0,y:0};
  }
  if(this.aim?.id===id)this.aim.last={...point};
 }
 direction(){
  if(!this.aim)return null;
  const dx=this.aim.last.x-this.aim.start.x,dy=this.aim.last.y-this.aim.start.y;
  return Math.hypot(dx,dy)>=6?{x:dx,y:dy}:null;
 }
 up(id,point,cancel=false){
  this.motion(id,point);
  this.jumpPointers.delete(id);
  if(this.move?.id===id){this.move=null;this.vector={x:0,y:0};this.stopMove()}
  if(this.aim?.id===id){const direction=this.direction();this.aim=null;if(!cancel)this.action(direction)}
 }
}

// Current controls. The legacy class above is retained for 0.11 regression
// checks; the playable 0.12 uses one release-resolved stroke owner.
export class StrokeControls {
 constructor({action=()=>{},jump=()=>{},dash=()=>{},stopMove=()=>{},canHit=()=>false,gestureJump=true,now=()=>performance.now()}={}){
  Object.assign(this,{action,jump,dash,stopMove,canHit,gestureJump,now});this.clear();
 }
 clear(){this.move=null;this.aim=null;this.vector={x:0,y:0};this.stopMove()}
 down(id,type,point,role='action'){
  if(role==='ui'||this.move?.id===id||this.aim?.id===id)return false;
  if(role==='move'&&type!=='mouse'){
   if(this.move)return false;this.move={id,start:{...point},last:{...point}};this.vector={x:0,y:0};return true;
  }
  if(this.aim)return false;
  this.aim={id,start:{...point},last:{...point},points:[{...point}],started:this.now(),dragged:false,maxDistance:0,hitIntent:this.canHit()};return true;
 }
 motion(id,point){
  if(this.move?.id===id){
   this.move.last={...point};const dx=point.x-this.move.start.x,dy=point.y-this.move.start.y,n=Math.hypot(dx,dy),strength=Math.min(1,Math.max(0,(n-6)/40));
   this.vector=n?{x:dx/n*strength,y:dy/n*strength}:{x:0,y:0};
  }
  if(this.aim?.id===id){
   const a=this.aim;
   if(Math.hypot(point.x-a.last.x,point.y-a.last.y)>=2){a.points.push({...point});if(a.points.length>256)a.points.splice(1,1)}
   a.last={...point};a.maxDistance=Math.max(a.maxDistance,Math.hypot(point.x-a.start.x,point.y-a.start.y));
   if(a.maxDistance>=18)a.dragged=true;
   if(a.dragged&&this.canHit())a.hitIntent=true;
  }
 }
 intent(){
  const a=this.aim;if(!a)return null;
  const dx=a.last.x-a.start.x,dy=a.last.y-a.start.y;
  if(a.dragged){if(this.canHit())a.hitIntent=true;if(a.hitIntent)return 'hit';return this.gestureJump&&dy<=-24&&-dy>=Math.abs(dx)*.8?'jump':'none'}
  return a.maxDistance<=10&&this.now()-a.started<=280?'dash':'none';
 }
 up(id,point,cancel=false){
  this.motion(id,point);
  if(this.move?.id===id){this.move=null;this.vector={x:0,y:0};this.stopMove();return null}
  if(this.aim?.id!==id)return null;
  const a=this.aim,intent=cancel?null:this.intent();this.aim=null;
  if(intent==='hit')this.action({points:a.points.map(p=>({...p})),target:{...a.last}});
  else if(intent==='jump')this.jump();else if(intent==='dash')this.dash();
  return intent;
 }
}
