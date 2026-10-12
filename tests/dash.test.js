import test from 'node:test';
import assert from 'node:assert/strict';
import {Match} from '../demo/engine.js';
import {GestureControls} from '../demo/controls.js';
const setup=()=>{const m=new Match();m.phase='rally';m.lastTeam=1;Object.assign(m.players[0],{x:4,y:12});m.moveTo(4,12);Object.assign(m.ball,{x:1,y:2,z:12,vx:0,vy:0,vz:0,alive:true,lastHit:2,cooldown:10});return m};
const step=(m,t,input={x:0,y:0},fps=120)=>{for(let i=0;i<Math.round(t*fps);i++)m.update(1/fps,input)};

test('moving jump gains distance over running with the same input',()=>{
 const run=setup(),dash=setup();dash.humanJump({x:1,y:0});
 step(run,.25,{x:1,y:0});step(dash,.25,{x:1,y:0});
 assert.ok(dash.players[0].x-run.players[0].x>1.1);assert.ok(dash.players[0].z>0);
});
test('stationary jump stays vertical and cannot retrigger before the first tick',()=>{
 const m=setup(),p=m.players[0];m.humanJump({x:0,y:0});assert.equal(m.humanJump({x:1,y:0}),null);
 step(m,.4);assert.equal(p.x,4);assert.equal(p.y,12);assert.equal(p.dashTime,0);assert.ok(p.z>1);
});
test('dash direction is manual, diagonals are normalized, and releasing keeps the impulse',()=>{
 for(const dir of [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1},{x:1,y:-1}]){
  const m=setup(),p=m.players[0];m.humanJump(dir);step(m,.4);
  const dx=p.x-4,dy=p.y-12,n=Math.hypot(dir.x,dir.y);
  assert.ok(Math.abs(dx-1.26*dir.x/n)<1e-9);assert.ok(Math.abs(dy-1.26*dir.y/n)<1e-9);
  const x=p.x,y=p.y;step(m,.2);assert.equal(p.x,x);assert.equal(p.y,y);
 }
});
test('dash cannot cross the net or the edges',()=>{
 for(const [x,y,dir] of [[7.5,12,{x:1,y:0}],[.5,12,{x:-1,y:0}],[4,8.7,{x:0,y:-1}],[4,15.5,{x:0,y:1}]]){
  const m=setup(),p=m.players[0];Object.assign(p,{x,y});m.moveTo(x,y);m.humanJump(dir);step(m,.4,dir);
  assert.ok(p.x>=.4&&p.x<=7.6&&p.y>=8.6&&p.y<=15.55);
 }
});
test('pause freezes the dash; point, serve and restart clear it',()=>{
 const m=setup();m.humanJump({x:1,y:0});step(m,.05);m.togglePause();
 const before={...m.players[0]};step(m,.3);assert.deepEqual(m.players[0],before);
 m.togglePause();step(m,.05);assert.ok(m.players[0].x>before.x);
 for(const clear of [m=>m.point(0),m=>m.serve(),m=>m.start()]){
  const n=setup();n.humanJump({x:1,y:0});clear(n);assert.equal(n.players[0].dashTime,0);
 }
});
test('dash reaches a ball running cannot, but hitting remains explicit',()=>{
 const run=setup(),dash=setup();
 for(const m of [run,dash])Object.assign(m.ball,{x:6.6,y:12,z:2,cooldown:0});
 dash.humanJump({x:1,y:0});step(run,.15,{x:1,y:0});step(dash,.15,{x:1,y:0});
 assert.equal(run.canHumanHit(),false);assert.equal(dash.canHumanHit(),true);assert.equal(dash.stats.contacts[0],0);
 assert.equal(dash.humanHit({x:0,y:-1}),'hit');assert.equal(dash.stats.contacts[0],1);
});
test('touch movement plus outside jump dashes without consuming movement or firing a shot',()=>{
 const m=setup();let c;c=new GestureControls({jump:()=>m.humanJump(c.vector),action:()=>m.humanHit()});
 c.down(1,'touch',{x:0,y:0},'move');c.motion(1,{x:-40,y:-40});
 c.down(2,'touch',{x:250,y:200},'jump');assert.equal(c.move.id,1);assert.equal(c.aim,null);
 step(m,.15,c.vector);assert.ok(m.players[0].x<3&&m.players[0].y<11);assert.equal(m.stats.contacts[0],0);
});
test('dash impulse distance is the same at 30 and 120 simulation steps per second',()=>{
 const positions=[30,120].map(fps=>{const m=setup();m.humanJump({x:1,y:0});step(m,.4,undefined,fps);return m.players[0].x});
 assert.ok(Math.abs(positions[0]-positions[1])<1e-9);
});
