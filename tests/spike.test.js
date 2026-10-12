import test from 'node:test';
import assert from 'node:assert/strict';
import {Match,shotPlan,seededRandom} from '../demo/engine.js';

function contact({jump=1,z=2.8,y=9.5}={}){
 const events=[],m=new Match({random:seededRandom(19),onEvent:e=>events.push(e)});
 m.phase='rally';m.lastTeam=1;m.receiver=0;
 Object.assign(m.players[0],{x:4,y:y+.25,z:jump,vz:0});m.moveTo(4,y+.25);
 Object.assign(m.ball,{x:4,y,z,vx:0,vy:0,vz:-1,lastHit:2,cooldown:0,alive:true});
 return {m,events};
}
const flight=b=>(b.vz+Math.sqrt(b.vz*b.vz+19.6*b.z))/9.8;

test('high jumping hit drives downward and arrives sooner than a standing lob',()=>{
 const {m,events}=contact();assert.equal(m.humanHit(),'hit');
 assert.ok(m.ball.vz<-2);assert.equal(events.at(-1).spike,true);
 const ground=shotPlan({z:0},m.ball,null,.55);
 assert.ok(ground.vz>0);assert.ok(flight(m.ball)<ground.time*.6);
 assert.ok(Math.abs(m.ball.vy)>Math.abs((ground.target.y-m.ball.y)/ground.time)*1.7);
});
test('jump height progressively lowers the shot without snapping at takeoff',()=>{
 const ball={x:4,y:9.5,z:2.8};
 const plans=[.12,.3,.55,.75,1].map(z=>shotPlan({z},ball,null));
 for(let i=1;i<plans.length;i++){
  assert.ok(plans[i].vz<plans[i-1].vz);assert.ok(plans[i].time<plans[i-1].time);
 }
 assert.equal(plans[0].spike,false);assert.equal(plans.at(-1).spike,true);
});
test('jumping cannot turn a low ball into an overhead spike',()=>{
 const {m,events}=contact({z:1.4});assert.equal(m.humanHit(),'hit');
 assert.ok(m.ball.vz>0);assert.equal(events.at(-1).spike,false);
});
test('soft teammate passes keep their arc and are received even from a jump',()=>{
 const {m}=contact({y:11.5});const mate=m.players[1],dir={x:mate.x-m.ball.x,y:mate.y-m.ball.y};
 const power=(Math.hypot(dir.x,dir.y)-.35)/13.65;
 const plan=shotPlan(m.players[0],m.ball,dir,power);
 assert.equal(plan.pass,true);assert.equal(plan.strength,0);assert.ok(plan.vz>0);
 assert.equal(m.humanHit(dir,power),'hit');assert.equal(m.receiver,1);
 for(let i=0;i<240&&!mate.contacts;i++)m.update(1/120);
 assert.equal(mate.contacts,1);assert.equal(m.ball.lastHit,1);
});
test('drag direction and stronger range survive the airborne attack',()=>{
 let lastRange=0,lastSpeed=0;
 for(const power of [.48,.65,.85,1]){
  const {m}=contact();assert.equal(m.humanHit({x:-.2,y:-1},power),'hit');
  const b=m.ball,range=Math.hypot(b.vx,b.vy)*flight(b),speed=Math.hypot(b.vx,b.vy);
  assert.ok(b.vx<0&&b.vy<0&&b.vz<0);assert.ok(Math.abs(b.vx/b.vy-.2)<1e-10);
  assert.ok(range>lastRange&&speed>lastSpeed);lastRange=range;lastSpeed=speed;
 }
});
test('a well-positioned high spike clears the net and lands on the aimed spot',()=>{
 const {m}=contact();const plan=shotPlan(m.players[0],m.ball,null);
 assert.equal(m.humanHit(),'hit');m.players.slice(1).forEach(p=>{p.speed=0;p.x=.4});
 const t=(8-m.ball.y)/m.ball.vy;
 assert.ok(m.ball.z+m.ball.vz*t-4.9*t*t>1.8);
 for(let i=0;i<240&&m.phase==='rally';i++)m.update(1/120);
 assert.equal(m.stats.netFaults,0);assert.deepEqual(m.score,[1,0]);
 assert.ok(Math.abs(m.ball.y-plan.target.y)<Math.abs(m.ball.vy)/120+.001);
});
test('a spike from too far back can hit the real net',()=>{
 const {m,events}=contact({y:13});assert.equal(m.humanHit(),'hit');
 for(let i=0;i<240&&m.phase==='rally';i++)m.update(1/120);
 assert.equal(m.stats.netFaults,1);assert.equal(events.at(-1).reason,'Red');assert.deepEqual(m.score,[0,1]);
});
test('fast net crossings use height at the plane, not end-of-frame height',()=>{
 for(const height of [1.82,1.78]){
  const {m}=contact();m.lastTeam=0;
  // Cross halfway through this tick, with a rapidly descending ball.
  const t=1/240,vz=-10;
  Object.assign(m.ball,{y:8.05,z:height-vz*t+4.9*t*t,vy:-12,vz,cooldown:.2,lastHit:0});
  m.update(1/120);assert.equal(m.stats.netFaults,height<1.8?1:0);
 }
});
