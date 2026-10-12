import test from 'node:test';
import assert from 'node:assert/strict';
import {Match,seededRandom} from '../demo/engine.js';
const setup=()=>{const m=new Match({random:seededRandom(42)});m.phase='rally';m.lastTeam=1;Object.assign(m.ball,{x:4,y:12,z:2.5,vx:0,vy:0,vz:-1,lastHit:2,cooldown:0,alive:true});return m};

test('attacks target the opposite lane when both defenders crowd one side',()=>{
 for(const x of [1,7]){
  const m=setup();Object.assign(m.ball,{x:4,y:5.5,z:1.3});
  for(const p of m.players.slice(0,2))Object.assign(p,{x,y:12,vx:0,vy:0});
  const attack=m.attackPlan(1);assert.ok(x===1?attack.target.x>=5.5:attack.target.x<=2.5);
  const f=(8-m.ball.y)/(attack.target.y-m.ball.y);
  assert.ok(m.ball.z*(1-f)+4.9*attack.time**2*f*(1-f)>=2.05-1e-9);
 }
});
test('moving partner gets a bounded lead pass toward their next position',()=>{
 const m=setup(),p=m.players[0];Object.assign(p,{x:3,y:12,vx:4,vy:-3});
 const target=m.passTarget(p);assert.ok(target.x>p.x&&target.x<p.x+1.1);assert.ok(target.y<p.y);
 Object.assign(p,{x:7.5,y:8.7});const edge=m.passTarget(p);assert.ok(edge.x<=7.15&&edge.y>=9.2);
});
test('teammate rescues a ball the assigned human cannot reach',()=>{
 const m=setup();Object.assign(m.players[0],{x:.5,y:15});m.moveTo(.5,15);
 Object.assign(m.players[1],{x:6,y:11});Object.assign(m.ball,{x:6,y:11,z:1.4,vz:-2});m.receiver=0;
 m.update(1/120);assert.equal(m.stats.contacts[1],1);assert.equal(m.stats.contacts[0],0);assert.equal(m.ball.lastHit,1);assert.equal(m.phase,'rally');
});
test('teammate leaves a playable human reception to the player',()=>{
 const m=setup();Object.assign(m.players[0],{x:4,y:12});m.moveTo(4,12);
 Object.assign(m.players[1],{x:4.2,y:12});Object.assign(m.ball,{z:1.4,vz:-1});m.receiver=0;
 m.update(1/120);assert.equal(m.defenderId,0);assert.equal(m.stats.contacts[1],0);assert.equal(m.canHumanHit(),true);
});
test('last hitter cannot claim a second consecutive touch',()=>{
 const m=setup();m.lastTeam=0;m.ball.lastHit=1;m.receiver=1;
 Object.assign(m.players[1],{x:4,y:12});Object.assign(m.players[0],{x:.5,y:15});m.moveTo(.5,15);
 m.planDefense();assert.equal(m.defenderId,0);m.update(1/120);assert.equal(m.stats.contacts[1],0);
});
test('idle human is not assumed to sprint instantly while teammate can receive',()=>{
 const m=setup();Object.assign(m.ball,{x:5,y:11,z:3,vz:0});
 Object.assign(m.players[0],{x:2,y:11,vx:0,vy:0});Object.assign(m.players[1],{x:7.2,y:11,reaction:0});
 m.planDefense();assert.equal(m.defenderId,1);
});
test('interception finds a reachable point before the ball reaches the ground',()=>{
 const m=setup(),p=m.players[1];Object.assign(p,{x:6,y:12});Object.assign(m.ball,{x:4,y:12,z:3,vx:4,vy:0,vz:0});
 const intercept=m.interception(p),ground=m.prediction(0);
 assert.equal(intercept.reachable,true);assert.ok(intercept.t<ground.t);assert.ok(intercept.x<ground.x);
});
test('reception assignment stays stable when players have almost equal reach',()=>{
 const m=setup();Object.assign(m.ball,{y:4,z:3});
 Object.assign(m.players[2],{x:3,y:4});Object.assign(m.players[3],{x:5,y:4});m.ball.lastHit=0;
 m.defenderId=2;m.planDefense();assert.equal(m.defenderId,2);
 m.players[3].x-=.03;m.planDefense();assert.equal(m.defenderId,2);
});
test('second touch can set a better-positioned teammate, third touch attacks',()=>{
 const events=[],m=new Match({random:seededRandom(8),onEvent:e=>events.push(e)});m.phase='rally';m.lastTeam=1;m.touches=1;
 Object.assign(m.players[2],{x:3,y:2});Object.assign(m.players[3],{x:4,y:5.5});
 Object.assign(m.ball,{x:3,y:2,z:1.3,lastHit:3});m.contact(m.players[2]);
 assert.equal(events.at(-1).type,'pass');assert.equal(m.receiver,3);assert.equal(m.touches,2);
 Object.assign(m.ball,{x:4,y:5.5,z:1.3});m.contact(m.players[3]);
 assert.equal(events.at(-1).type,'attack');assert.equal(m.touches,3);assert.ok(m.ball.vy>0);
});
test('an obvious opening near the net permits a first-touch counterattack',()=>{
 const m=setup(),p=m.players[2];Object.assign(p,{x:4,y:6});
 for(const q of m.players.slice(0,2))Object.assign(q,{x:.5,y:15,speed:0});
 Object.assign(m.ball,{x:4,y:6,z:1.4,lastHit:0});m.lastTeam=0;m.contact(p);
 assert.equal(m.touches,1);assert.equal(m.stats.attacks,1);assert.equal(m.stats.passes,0);
});
test('bot contacts keep the ball at its real contact position',()=>{
 const m=setup();m.lastTeam=1;m.touches=1;Object.assign(m.ball,{x:3.2,y:4.9,z:.7});
 Object.assign(m.players[2],{x:3,y:4.5});m.contact(m.players[2]);
 assert.equal(m.ball.x,3.2);assert.equal(m.ball.y,4.9);assert.equal(m.ball.z,.7);
});
test('reaction time and speed still limit bot movement despite prediction',()=>{
 const m=setup(),p=m.players[1];Object.assign(p,{x:6,y:11,reaction:.2});Object.assign(m.ball,{x:7,y:11,z:3,vz:0});m.receiver=1;
 const before={x:p.x,y:p.y};m.update(1/120);assert.equal(p.x,before.x);assert.equal(p.y,before.y);
 p.reaction=0;m.aiTimer=0;m.update(1/120);assert.ok(Math.hypot(p.x-before.x,p.y-before.y)<=p.speed/120+.0001);
});
