import test from 'node:test';
import assert from 'node:assert/strict';
import {Match,seededRandom} from '../demo/engine.js';

test('live tactical decisions produce one, two and three-touch attacks without a quota',()=>{
 const counts={1:0,2:0,3:0};let aerial=0;
 for(let seed=1;seed<=16;seed++){
  const m=new Match({random:seededRandom(seed),onEvent:e=>{
   if(e.type==='attack'&&e.player!==0){assert.ok(e.touch>=1&&e.touch<=3);counts[e.touch]++;if(e.touch===3&&m.ball.z>2)aerial++}
  }});m.start();
  for(let i=0;i<12000&&m.phase!=='finished';i++){
   if(m.phase==='rally'&&m.defenderId===0){const q=m.prediction();m.moveTo(q.x,q.y);if(m.canHumanHit())m.humanHit()}
   m.update(1/120);
  }
 }
 for(const value of Object.values(counts))assert.ok(value>0);assert.ok(aerial>0);
 console.log(JSON.stringify({tacticalAttackTouches:counts,aerialThirdTouches:aerial}));
});
test('teammate second touch sets a playable third ball for the human, who must hit manually',()=>{
 const events=[],m=new Match({random:seededRandom(7),onEvent:e=>events.push(e)});m.phase='rally';m.lastTeam=0;m.touches=1;
 const p=m.players[0],mate=m.players[1];Object.assign(p,{x:3,y:10.5});m.moveTo(3,10.5);
 Object.assign(mate,{x:5,y:13.5,vx:3});
 Object.assign(m.ball,{x:5.7,y:13.5,z:.7,vx:0,vy:0,vz:-.2,cooldown:0,lastHit:0,alive:true});
 m.contact(mate);
 assert.equal(m.receiver,0);assert.equal(events.at(-1).touch,2);
 assert.equal(m.stats.contacts[0],0);assert.equal(m.stats.attacks,0);
 for(let i=0;i<360&&!m.canHumanHit();i++)m.update(1/120);
 assert.equal(m.canHumanHit(),true);assert.equal(m.stats.contacts[0],0);
 assert.equal(m.humanHit(),'hit');assert.equal(events.at(-1).type,'attack');assert.equal(events.at(-1).touch,3);
});
test('bot third touch attacks instead of adding a fourth pass',()=>{
 const m=new Match({random:seededRandom(4)});m.phase='rally';m.lastTeam=0;m.touches=2;
 const p=m.players[1];Object.assign(m.ball,{x:p.x,y:p.y,z:1.3,lastHit:0});m.contact(p);
 assert.equal(m.touches,3);assert.equal(m.stats.attacks,1);assert.equal(m.stats.passes,0);assert.equal(m.receiver,null);
});
test('second touch attacks an exposed court instead of forcing an extra pass',()=>{
 const m=new Match({random:seededRandom(4)});m.phase='rally';m.lastTeam=0;m.touches=1;
 const p=m.players[1];Object.assign(p,{x:4,y:9.5});
 m.players.filter(q=>q.team===1).forEach(q=>Object.assign(q,{x:.5,y:.5,speed:.5}));
 Object.assign(m.ball,{x:p.x,y:p.y,z:1.3,lastHit:0});m.contact(p);
 assert.equal(m.touches,2);assert.equal(m.stats.attacks,1);assert.equal(m.stats.passes,0);
});
test('a low isolated emergency save can return on the first touch',()=>{
 const m=new Match();m.phase='rally';m.lastTeam=0;
 Object.assign(m.players[2],{x:.5,y:3});Object.assign(m.players[3],{x:7,y:5});
 Object.assign(m.ball,{x:.5,y:3,z:.3,lastHit:0});m.contact(m.players[2]);
 assert.equal(m.touches,1);assert.equal(m.stats.attacks,1);
});
test('human remains free to attack early, and a fourth team contact is still a fault',()=>{
 const m=new Match();m.phase='rally';m.lastTeam=1;const p=m.players[0];
 Object.assign(m.ball,{x:p.x,y:p.y,z:1.2,cooldown:0,lastHit:2,alive:true});assert.equal(m.humanHit(),'hit');assert.equal(m.touches,1);assert.equal(m.stats.attacks,1);
 m.lastTeam=0;m.touches=3;Object.assign(m.ball,{x:p.x,y:p.y,z:1.2,cooldown:0,lastHit:1});m.humanHit();
 assert.equal(m.phase,'point');assert.deepEqual(m.score,[0,1]);
});
