// Plans use court units and seconds, with an explicit metres/unit conversion.
// Displayed speeds are metres/s; simulation and preview share gravity/velocity.
import {courtConfig,courtGravity,courtNet} from './maps.js';
import {projectCourt} from './projection.js';
export const BALL_GRAVITY=9.8,MAX_SHOT_SPEED=18;
const limit=(n,a,b)=>Math.max(a,Math.min(b,n));
function segmentDistance(p,a,b){
 const dx=b.x-a.x,dy=b.y-a.y,n=dx*dx+dy*dy,u=n?limit(((p.x-a.x)*dx+(p.y-a.y)*dy)/n,0,1):0;
 return Math.hypot(p.x-a.x-u*dx,p.y-a.y-u*dy);
}
function polylineError(a,b){
 const one=(points,line)=>points.reduce((sum,p)=>sum+Math.min(...line.slice(1).map((q,i)=>segmentDistance(p,line[i],q))),0)/points.length;
 return (one(a,b)+one(b,a))/2;
}
function fitFlight(origin,target,speed,baseTime,screenPoints,court,minTime=0){
 const BALL_GRAVITY=courtGravity(court),MAX_SHOT_SPEED=18/court.metresPerUnit;
 if(!screenPoints||screenPoints.length<4)return {time:baseTime,error:null};
 const start=projectCourt(origin.x,origin.y,origin.z,court);
 // Prefixes behind the player are not part of the requested flight. Begin
 // at the stroke point nearest the real projected contact, then fit gravity.
 let first=0,best=Infinity;
 screenPoints.forEach((p,i)=>{const d=Math.hypot(p.x-start.x,p.y-start.y);if(d<best){best=d;first=i}});
 const source=screenPoints.slice(first),count=Math.min(25,source.length);
 const drawn=[start,...Array.from({length:count},(_,i)=>source[Math.round(i*(source.length-1)/Math.max(1,count-1))])];
 if(drawn.length<4)return {time:baseTime,error:null};
 const R=Math.hypot(target.x-origin.x,target.y-origin.y),h=origin.z,g=BALL_GRAVITY,q=MAX_SHOT_SPEED**2+g*h,D=q*q-g*g*(R*R+h*h);
 if(D<0)return {time:baseTime,error:null};
 const root=Math.sqrt(D),lo=Math.sqrt(2*(R*R+h*h)/(q+root)),hi=Math.sqrt(2*(q+root)/(g*g));
 const candidates=[baseTime,minTime,...Array.from({length:65},(_,i)=>lo+(hi-lo)*i/64)].filter(time=>time>=Math.max(lo,minTime)-1e-8&&time<=hi+1e-8).map(time=>{
  const vx=(target.x-origin.x)/time,vy=(target.y-origin.y)/time,vz=-h/time+.5*g*time;
  const flight=Array.from({length:19},(_,i)=>{const t=time*i/18;return projectCourt(origin.x+vx*t,origin.y+vy*t,Math.max(0,h+vz*t-.5*g*t*t),court)});
  return {time,error:polylineError(flight,drawn),speed:Math.hypot(vx,vy,vz)};
 });
 if(!candidates.length)return {time:baseTime,error:null};
 const minError=Math.min(...candidates.map(p=>p.error));
 const chosen=candidates.filter(p=>p.error<=minError+2).sort((a,b)=>Math.abs(a.speed-speed)-Math.abs(b.speed-speed))[0];
 return chosen;
}
// A finger stroke supplies direction/destination, not an exact height drawing.
// Keep a small net margin when a legal ballistic arc exists; high contacts can
// still take a fast descending path. Never change the requested landing point.
export function netClearanceTime(origin,target,court=courtConfig()){
 if((origin.y-8)*(target.y-8)>=0)return 0;
 const f=(8-origin.y)/(target.y-origin.y),x=origin.x+(target.x-origin.x)*f;
 if(x<0||x>8)return 0;
 return Math.sqrt(Math.max(0,2*(courtNet(court)+.24/court.metresPerUnit-origin.z*(1-f))/(courtGravity(court)*f*(1-f))));
}
export function strokeMetrics(origin,target,points=[]){
 const dx=target.x-origin.x,dy=target.y-origin.y,distance=Math.hypot(dx,dy);
 if(distance<1e-5)return {distance:0,length:0,straightness:1,speed:4};
 const ux=dx/distance,uy=dy/distance;
 const useful=[origin];
 // Ignore charging behind the contact plane. Starting farther behind cannot
 // increase power. Backtracking and bends in the useful stroke reduce it.
 for(const p of points){
  const progress=(p.x-origin.x)*ux+(p.y-origin.y)*uy;
  if(progress>0&&progress<distance)useful.push(p);
 }
 useful.push(target);
 let length=0;
 for(let i=1;i<useful.length;i++)length+=Math.hypot(useful[i].x-useful[i-1].x,useful[i].y-useful[i-1].y);
 const straightness=limit(distance/Math.max(distance,length),.05,1);
 return {distance,length,straightness,speed:Math.min(MAX_SHOT_SPEED,4+distance*straightness)};
}
export function trajectoryPlan(player,ball,request,court=courtConfig()){
 const BALL_GRAVITY=courtGravity(court),MAX_SHOT_SPEED=18/court.metresPerUnit;
 const origin={x:ball.x,y:ball.y,z:Math.max(.04,ball.z)},target={x:request.target.x,y:request.target.y};
 const metrics=strokeMetrics(origin,target,request.points),g=BALL_GRAVITY,h=origin.z,R=metrics.distance;
 metrics.speed=Math.min(MAX_SHOT_SPEED,(4+metrics.distance*court.metresPerUnit*metrics.straightness)/court.metresPerUnit);
 const minSpeed=Math.sqrt(g*(Math.hypot(R,h)-h));
 const requestedSpeed=metrics.speed,speed=Math.min(MAX_SHOT_SPEED,Math.max(requestedSpeed,minSpeed*1.001));
 const q=speed*speed+g*h,C=R*R+h*h,disc=q*q-g*g*C;
 let time,actualTarget={...target},reachable=disc>=0;
 if(reachable){
  const root=Math.sqrt(disc),low=Math.sqrt(2*C/(q+root)),high=Math.sqrt(2*(q+root)/(g*g));
  time=low;
  const crosses=(origin.y-8)*(target.y-8)<0;
  if(crosses){
   const f=(8-origin.y)/(target.y-origin.y),x=origin.x+(target.x-origin.x)*f;
   if(x>=0&&x<=8){
    const clear=Math.sqrt(Math.max(0,2*(courtNet(court)+.15/court.metresPerUnit-h*(1-f))/(g*f*(1-f))));
    time=Math.min(high,Math.max(time,clear));
   }
  }else{
   // Short own-side passes remain catchable instead of falling at the feet.
   time=Math.min(high,Math.max(time,.85+Math.min(.4,R*.06)));
  }
 }else{
  // Maximum range at the speed cap; retain the requested marker separately.
  time=Math.sqrt(2*q/(g*g));
  const vz=.5*g*time-h/time,range=Math.sqrt(Math.max(0,speed*speed-vz*vz))*time;
  const factor=R?range/R:0;actualTarget={x:origin.x+(target.x-origin.x)*factor,y:origin.y+(target.y-origin.y)*factor};
 }
 const clearanceTime=netClearanceTime(origin,actualTarget,court);
 const maxQ=MAX_SHOT_SPEED**2+g*h,maxD=maxQ*maxQ-g*g*(R*R+h*h);
 const maxTime=maxD>=0?Math.sqrt(2*(maxQ+Math.sqrt(maxD))/(g*g)):0;
 const assist=reachable&&clearanceTime>0&&clearanceTime<=maxTime;
 // Apply the same envelope before and after shape fitting; the old fitter
 // could undo the safe initial arc simply because the user drew a straight line.
 if(assist)time=Math.max(time,clearanceTime);
 const fitted=reachable?fitFlight(origin,target,requestedSpeed,time,request.screenPoints,court,assist?clearanceTime:0):{time,error:null};
 time=Math.max(.05,fitted.time);
 // Tap strength controls forward pace while keeping the chosen landing point
 // and the legal net arc. Soft shots take a higher, longer flight.
 if([1,2,3].includes(request.tapLevel)&&reachable){
  time=Math.min(maxTime||Infinity,time*[0,1.15,1.07,1][request.tapLevel]);
 }
 if(Number.isFinite(request.strength)&&reachable)time=Math.min(maxTime||Infinity,time*(1.15-.15*limit(request.strength,0,1)));
 const vx=(actualTarget.x-origin.x)/time,vy=(actualTarget.y-origin.y)/time,vz=-h/time+.5*g*time;
 const actualSpeed=Math.hypot(vx,vy,vz),pass=target.y>8&&target.y<16&&target.x>0&&target.x<8;
 const out=target.x<0||target.x>8||target.y<0||target.y>16;
 const plan={origin,target:actualTarget,requestedTarget:target,time,vx,vy,vz,originZ:h,targetZ:0,pass,
  power:limit(actualSpeed/MAX_SHOT_SPEED,.02,1),spike:player.z>.2&&vz<0,requestedSpeed,actualSpeed,reachable,out,metrics,shapeError:fitted.error,gravity:BALL_GRAVITY,netHeight:courtNet(court),metresPerUnit:court.metresPerUnit,netAssisted:assist&&time<=clearanceTime+.02};
 const preview=flightPreview(plan);
 plan.blocked=preview.collision==='net';
 plan.adjusted=(fitted.error===null?metrics.straightness<.9:fitted.error>24)||!reachable||Math.abs(actualSpeed-requestedSpeed)>.35;
 plan.reason=plan.blocked?'RED':!reachable?'FUERA DE ALCANCE':out?'FUERA':plan.netAssisted&&plan.adjusted?'ARCO SUAVE':plan.adjusted?'TRAZO AJUSTADO':pass?'PASE':'ATAQUE';
 plan.actualSpeed*=court.metresPerUnit;plan.requestedSpeed*=court.metresPerUnit;
 return plan;
}
export function flightPoint(plan,t){return {x:plan.origin.x+plan.vx*t,y:plan.origin.y+plan.vy*t,z:Math.max(0,plan.originZ+plan.vz*t-.5*(plan.gravity??BALL_GRAVITY)*t*t)}}
export function flightPreview(plan,steps=48){
 let end=plan.time,collision='ground';
 if(Math.abs(plan.vy)>.00001){
  const t=(8-plan.origin.y)/plan.vy;
  if(t>0&&t<end){const p=flightPoint(plan,t);if(p.x>=0&&p.x<=8&&p.z<(plan.netHeight??1.8)){end=t;collision='net'}}
 }
 return {points:Array.from({length:steps+1},(_,i)=>flightPoint(plan,end*i/steps)),end,collision};
}
