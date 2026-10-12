import test from 'node:test';
import assert from 'node:assert/strict';
import {courtConfig,courtNet} from '../demo/maps.js';
import {projectCourt,unprojectCourt} from '../demo/projection.js';
import {trajectoryPlan,flightPoint,flightPreview} from '../demo/trajectory.js';
import {Match} from '../demo/engine.js';
import {StrokeControls} from '../demo/controls.js';
function straight(court,ball,target,jitter=0){
 const a=projectCourt(ball.x,ball.y,ball.z,court),b=projectCourt(target.x,target.y,0,court);
 const screenPoints=Array.from({length:22},(_,i)=>({x:a.x+(b.x-a.x)*i/21+(i&&i<21?Math.sin(i*2)*jitter:0),y:a.y+(b.y-a.y)*i/21}));
 return {target,screenPoints,points:screenPoints.map(p=>unprojectCourt(p.x,p.y,court))};
}
test('straight finger strokes clear the real net with a margin and retain the release target',()=>{
 for(const map of ['rooftop','pavilion'])for(const zoom of [.8,1,1.8,2.25,2.7])for(const jitter of [0,6]){
  const court={...courtConfig(map),zoom,panX:120,panY:-210},ball={x:3,y:12,z:1.3},target={x:6,y:3};
  const plan=trajectoryPlan({z:0},ball,straight(court,ball,target,jitter),court);
  assert.equal(plan.blocked,false);assert(plan.actualSpeed<=18+1e-7);
  const net=flightPoint(plan,(8-ball.y)/plan.vy);assert(net.z>=courtNet(court)+.23/court.metresPerUnit);
  const end=flightPoint(plan,plan.time);assert(Math.hypot(end.x-target.x,end.y-target.y)<1e-8);
 }
});
test('assisted flight agrees with live physics and crosses the net in a practice stroke',()=>{
 const match=new Match({map:'pavilion'});match.startPractice();
 match.map={...match.map,zoom:.9};const request=straight(match.map,match.ball,{x:5,y:3});
 assert.equal(match.humanTargetHit(request),'hit');const plan=match.lastTargetPlan;
 for(let i=0;i<1000&&match.phase==='rally';i++)match.update(1/120);
 assert.equal(match.phase,'point');assert.equal(match.stats.netFaults,0);
 assert.equal(flightPreview(plan).collision,'ground');
 assert(Math.hypot(match.ball.x-plan.target.x,match.ball.y-plan.target.y)<.12);
});
test('high airborne contact still permits a descending spike; soft own-side passes stay soft',()=>{
 const court=courtConfig('pavilion'),ball={x:4,y:8.8,z:3.6},target={x:4,y:4};
 const spike=trajectoryPlan({z:1},ball,straight(court,ball,target),court);
 assert.equal(spike.blocked,false);assert(spike.vz<0);assert(spike.spike);
 const pass=trajectoryPlan({z:0},{x:4,y:12,z:1.3},{target:{x:4.25,y:12}},court);
 assert(pass.pass);assert(pass.actualSpeed<4);assert.equal(pass.netAssisted,false);
});
test('zoom affects only camera; floor targets round-trip and physical dimensions remain unchanged',()=>{
 for(const map of ['rooftop','pavilion'])for(const zoom of [.8,1.8,2.25,2.7]){
  const court={...courtConfig(map),zoom,panX:-150,panY:330};
  for(const p of [{x:0,y:0},{x:8,y:16},{x:3.2,y:11.7}]){
   const screen=projectCourt(p.x,p.y,0,court),world=unprojectCourt(screen.x,screen.y,court);
   assert(Math.hypot(world.x-p.x,world.y-p.y)<1e-8);
  }
  const plan=trajectoryPlan({z:0},{x:4,y:12,z:1.3},{target:{x:5,y:3}},court);
  const base=trajectoryPlan({z:0},{x:4,y:12,z:1.3},{target:{x:5,y:3}},courtConfig(map));
  assert.equal(plan.time,base.time);assert.equal(plan.vz,base.vz);
 }
});
test('pavilion camera restores the previous character size without shrinking the court',()=>{
 const old=projectCourt(4,12.7),current=projectCourt(4,12.7,0,{...courtConfig('pavilion'),zoom:2.25});
 assert(Math.abs(current.s/old.s-1)<.03);
 const left=projectCourt(0,8,0,{...courtConfig('pavilion'),zoom:2.25}),right=projectCourt(8,8,0,{...courtConfig('pavilion'),zoom:2.25});
 const oldLeft=projectCourt(0,8),oldRight=projectCourt(8,8);assert(right.x-left.x>(oldRight.x-oldLeft.x)*1.5);
});
test('a recognized hit stroke cannot become an accidental jump when the ball moves away',()=>{
 let near=true;const events=[];
 const control=new StrokeControls({canHit:()=>near,action:()=>events.push('hit'),jump:()=>events.push('jump')});
 control.down(1,'touch',{x:150,y:300});control.motion(1,{x:150,y:260});near=false;
 assert.equal(control.up(1,{x:150,y:200}),'hit');assert.deepEqual(events,['hit']);
 control.down(2,'touch',{x:150,y:300});assert.equal(control.up(2,{x:150,y:200}),'jump');
 assert.deepEqual(events,['hit','jump']);
});
