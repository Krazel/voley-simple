import test from 'node:test';
import assert from 'node:assert/strict';
import {Match,seededRandom} from '../demo/engine.js';
const step=(m,seconds,input={x:0,y:0})=>{for(let i=0;i<seconds*120;i++)m.update(1/120,input)};
test('one human and three autonomous bots, 2v2',()=>{
 const m=new Match();assert.equal(m.players.filter(p=>p.human).length,1);assert.equal(m.players.filter(p=>!p.human).length,3);assert.equal(m.players.filter(p=>p.team===0).length,2);
});
test('human responds to controls and stays in own court',()=>{
 const m=new Match({random:seededRandom(1)});m.start();step(m,1.3);const x=m.players[0].x;step(m,.3,{x:1,y:0});assert.ok(m.players[0].x>x);
 m.moveTo(100,-100);assert.equal(m.target.x,7.55);assert.equal(m.target.y,8.65);
 m.moveTo(-100,100);assert.equal(m.target.x,.45);assert.equal(m.target.y,15.45);
});
test('pause freezes ball, players, score and rally timer; resume continues',()=>{
 const m=new Match();m.start();step(m,2);m.togglePause();const state=JSON.stringify({ball:m.ball,players:m.players,score:m.score,time:m.time});step(m,5,{x:1,y:1});assert.equal(JSON.stringify({ball:m.ball,players:m.players,score:m.score,time:m.time}),state);m.togglePause();step(m,.1);assert.notEqual(m.time,JSON.parse(state).time);
});
test('net, ground and out faults award exactly one point',()=>{
 for(const fault of ['ground','out','net']){
  const m=new Match();m.start();m.serve();m.lastTeam=0;
  Object.assign(m.ball,{x:fault==='out'?9:4,y:fault==='net'?8.005:3,z:fault==='net'?.5:.001,vx:0,vy:fault==='net'?-4:0,vz:-2,cooldown:1});
  m.update(1/120);assert.equal(m.score[ fault==='ground'?0:1 ],1);step(m,.2);assert.equal(m.score[0]+m.score[1],1);
 }
});
test('finish and reset remove previous game state',()=>{
 const m=new Match({winningScore:2});m.start();m.serve();m.point(0);m.serve();m.point(0);assert.equal(m.phase,'finished');assert.equal(m.winner,0);step(m,20);assert.deepEqual(m.score,[2,0]);m.start();assert.deepEqual(m.score,[0,0]);assert.equal(m.winner,null);assert.equal(m.stats.points,0);
});
test('deterministic rally simulation exercises all 3 bots and never exits the court',()=>{
 const total=[0,0,0,0];let passes=0,attacks=0;
 for(let seed=1;seed<=8;seed++){
  const m=new Match({random:seededRandom(seed)});m.start();
  for(let i=0;i<120*100&&m.phase!=='finished';i++){
   // Test driver for the human, not shipped as an auto-play mode.
   if(m.phase==='rally'&&m.defenderId===0){const p=m.prediction();m.moveTo(p.x,p.y);if(m.canHumanHit())m.humanHit()}
   m.update(1/120);
   for(const p of m.players){assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));assert.ok(p.x>=.4&&p.x<=7.6);assert.ok(p.team===0?p.y>=8.6&&p.y<=15.55:p.y>=.45&&p.y<=7.4)}
   assert.ok(Number.isFinite(m.ball.z));
  }
  m.stats.contacts.forEach((n,i)=>total[i]+=n);passes+=m.stats.passes;attacks+=m.stats.attacks;
 }
 total.forEach((n,i)=>assert.ok(n>0,'player '+i+' must touch the ball'));assert.ok(passes>10);assert.ok(attacks>10);
 console.log(JSON.stringify({eightSeeds:{contacts:total,passes,attacks}}));
});
