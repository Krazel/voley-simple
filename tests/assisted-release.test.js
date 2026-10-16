import test from 'node:test';
import assert from 'node:assert/strict';
import {AssistedRelease,directedTarget} from '../demo/controls.js';
import {Match} from '../demo/engine.js';
import {trajectoryPlan,flightPreview} from '../demo/trajectory.js';
import {courtConfig} from '../demo/maps.js';

test('all movement directions attack inside the opponent court with a safe margin in every map',()=>{
 for(const map of ['rooftop','pavilion','mobile'])for(const x of [.5,4,7.5])for(const y of [9,12,15])for(const dx of [-1,0,1])for(const dy of [-1,0,1]){
  const ball={x,y,z:1.5},target=directedTarget(ball,{x:dx,y:dy});
  assert(target.x>=1.1&&target.x<=6.9&&target.y>=1.5&&target.y<=6.2);
  for(const strength of [0,1]){
   const plan=trajectoryPlan({z:0},ball,{target,strength},courtConfig(map));
   assert.equal(plan.reachable,true);assert.equal(plan.out,false);assert.equal(flightPreview(plan).collision,'ground');
  }
 }
});
test('aim adjusts toward a nearby opening while retaining the chosen lane',()=>{
 const origin={x:4,y:12},direction={x:1,y:-1},base=directedTarget(origin,direction);
 const rivals=[{team:1,x:base.x,y:base.y}];
 const target=directedTarget(origin,direction,rivals);
 assert(target.x>4);assert(Math.hypot(target.x-base.x,target.y-base.y)>.3);
 assert(Math.abs(target.x-base.x)<=.651);
});
function scene(mode='1v1'){
 const m=new Match({mode});m.startPractice();const p=m.players[0];
 Object.assign(m.ball,{x:p.x+3,y:p.y,z:1.5,vx:0,vy:0,vz:0,lastHit:2,cooldown:0});return m;
}
test('release waits over a second, recalculates from contact and hits only once',()=>{
 const m=scene(),queue=new AssistedRelease(),p=m.players[0];
 queue.arm({kind:'attack',direction:{x:-1,y:1},strength:.8},m.time);
 m.time+=1.1;assert.equal(queue.update(m),null);
 Object.assign(m.ball,{x:p.x+2.05});assert.equal(m.canHumanHit(.3),false);
 assert.equal(queue.update(m),'hit');assert.equal(queue.request,null);assert.equal(p.contacts,1);
 assert(m.lastTargetPlan.requestedTarget.y<8);assert.equal(queue.update(m),null);assert.equal(p.contacts,1);
});
test('expired or cancelled release never fires on a later rally, and double contacts remain illegal',()=>{
 for(const phase of ['paused','point','countdown']){
  const m=scene(),q=new AssistedRelease();q.arm({kind:'attack',strength:0},m.time);m.phase=phase;q.update(m);assert.equal(q.request,null);
 }
 const m=scene(),q=new AssistedRelease();q.arm({kind:'attack',strength:0},m.time);m.time+=1.26;assert.equal(q.update(m),'expired');assert.equal(m.players[0].contacts,0);
 m.ball.x=m.players[0].x;m.ball.lastHit=0;q.arm({kind:'attack',strength:0},m.time);assert.equal(q.update(m),null);assert.equal(m.players[0].contacts,0);
});
test('pass tracks the teammate at contact, and solo play cannot manufacture a pass',()=>{
 const m=scene('2v2'),q=new AssistedRelease();m.players[1].x=2;m.players[1].y=11;
 q.arm({kind:'pass',receiver:1,strength:0},m.time);m.players[1].x=3;m.ball.x=m.players[0].x;
 assert.equal(q.update(m),'hit');assert.deepEqual(m.lastTargetPlan.requestedTarget,{x:3,y:11});
 const solo=scene();solo.ball.x=solo.players[0].x;q.arm({kind:'pass',receiver:1,strength:0},solo.time);
 assert.equal(q.update(solo),'cancelled');assert.equal(solo.players[0].contacts,0);
});
