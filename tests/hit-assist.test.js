import test from 'node:test';
import assert from 'node:assert/strict';
import {Match} from '../demo/engine.js';
function setup(){const m=new Match();m.phase='rally';m.lastTeam=1;m.receiver=0;const p=m.players[0];Object.assign(m.ball,{x:p.x,y:p.y,z:1.2,vx:0,vy:0,vz:0,lastHit:2,cooldown:0,alive:true});return m}
const step=(m,t)=>{for(let i=0;i<Math.ceil(t*120);i++)m.update(1/120)};
test('airborne contact reaches sideways, above head and below feet without remote hits',()=>{
 for(const z of [.25,3.3]){const m=setup(),p=m.players[0];p.z=1;m.ball.x+=1.7;m.ball.z=z;assert.equal(m.humanHit(),'hit')}
 const m=setup();m.players[0].z=1;m.ball.x+=3;assert.equal(m.humanHit(),null);assert.equal(m.stats.contacts[0],0);
});
test('early release during jump is buffered and hits once on entering reach, preserving aim and power',()=>{
 const m=setup(),p=m.players[0];m.humanJump();m.ball.z=3;m.ball.vz=-1;
 const direction={x:1,y:0};assert.equal(m.humanHit(direction,.12),'buffered');direction.x=-1;
 step(m,.15);assert.equal(m.stats.contacts[0],1);assert.ok(m.ball.vx>0);assert.equal(m.pendingHit,null);
 step(m,.25);assert.equal(m.stats.contacts[0],1);
});
test('late release has a small reach grace window without allowing repeated contacts',()=>{
 const m=setup();m.update(1/120);m.ball.x=m.players[0].x+1.75;
 assert.equal(m.canHumanHit(),false);assert.equal(m.humanHit(),'hit');assert.equal(m.humanHit(),null);
});
test('expired input cannot hit a later ball',()=>{
 const m=setup();m.ball.z=3.3;assert.equal(m.humanHit(),'buffered');step(m,.23);assert.equal(m.pendingHit,null);
 m.ball.z=1.2;step(m,.03);assert.equal(m.stats.contacts[0],0);
});
test('pause, point, new launch and restart clear buffered hits and recent reach',()=>{
 for(const clear of [m=>m.togglePause(),m=>m.point(1),m=>m.launch({x:2,y:12,z:2},{x:4,y:3},1),m=>m.start()]){
  const m=setup();m.ball.z=3.3;m.humanHit();m.lastReach=m.time;clear(m);assert.equal(m.pendingHit,null);assert.equal(m.lastReach,-Infinity);
 }
});
test('assist cannot reach through the net, revive a grounded ball, or play by itself',()=>{
 for(const change of [b=>b.y=7.99,b=>b.z=0]){const m=setup();change(m.ball);assert.equal(m.humanHit(),null)}
 const m=setup();m.humanJump();step(m,.2);assert.equal(m.stats.contacts[0],0);
});
