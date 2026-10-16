import test from 'node:test';
import assert from 'node:assert/strict';
import {Match,seededRandom} from '../demo/engine.js';
import {readPreferences,writePreferences} from '../demo/preferences.js';
const step=(m,n)=>{for(let i=0;i<n;i++)m.update(1/120)};

test('practice after a completed match clears score, winner and target, and resumes without losing the ball',()=>{
 for(const mode of ['1v1','2v2'])for(const map of ['rooftop','pavilion']){
  const m=new Match({mode,map,winningScore:1});m.start();m.serve();m.point(1);
  assert.equal(m.phase,'finished');m.startPractice();
  assert.deepEqual(m.score,[0,0]);assert.equal(m.winner,null);assert.equal(m.lastTargetPlan,null);
  m.humanJump({x:0,y:0});step(m,5);m.togglePause();
  const before=JSON.stringify({ball:m.ball,players:m.players,time:m.time});step(m,200);
  assert.equal(JSON.stringify({ball:m.ball,players:m.players,time:m.time}),before);
  m.togglePause();assert.equal(m.phase,'rally');assert.equal(m.practice,true);
  m.start();assert.equal(m.practice,false);assert.equal(m.phase,'countdown');assert.deepEqual(m.score,[0,0]);
 }
});

test('expired deliberate hit gives one miss event, without a jump, contact or score',()=>{
 const events=[],m=new Match({random:seededRandom(7),onEvent:e=>events.push(e)});
 m.start();m.serve();m.players.forEach(p=>p.reaction=10);
 const p=m.players[0];Object.assign(m.ball,{x:p.x+2.2,y:p.y,z:1.3,vx:0,vy:0,vz:0,lastHit:2,cooldown:0});
 assert.equal(m.humanTargetHit({target:{x:4,y:3},points:[]}),'buffered');step(m,30);
 assert.equal(m.pendingHit,null);assert.equal(events.filter(e=>e.type==='hitmiss').length,1);
 assert.equal(p.z,0);assert.equal(p.contacts,0);assert.deepEqual(m.score,[0,0]);step(m,5);
 assert.equal(events.filter(e=>e.type==='hitmiss').length,1);
});

test('pause cancels queued hit without reporting an expired gesture after resume',()=>{
 const events=[],m=new Match({onEvent:e=>events.push(e)});m.start();m.serve();
 const p=m.players[0];Object.assign(m.ball,{x:p.x+2.2,y:p.y,z:1.3,vx:0,vy:0,vz:0,lastHit:2,cooldown:0});
 m.humanTargetHit({target:{x:4,y:3}});m.togglePause();step(m,100);m.togglePause();step(m,30);
 assert.equal(events.filter(e=>e.type==='hitmiss').length,0);assert.equal(p.contacts,0);
});

test('existing preferences survive reload, reject malformed values and tolerate unavailable storage',()=>{
 let saved;const storage={setItem:(_,v)=>saved=v,getItem:()=>saved};
 const choices={handedness:'left',map:'rooftop',mode:'2v2',buttonLayouts:{right:{},left:{}},zoom:{rooftop:.9,pavilion:1.2,mobile:1}};
 assert.equal(writePreferences(storage,choices),true);assert.deepEqual(readPreferences(storage),choices);
 saved='broken';assert.deepEqual(readPreferences(storage),{handedness:'right',map:'pavilion',mode:'1v1',buttonLayouts:{right:{},left:{}},zoom:{rooftop:1,pavilion:1,mobile:1}});
 saved=JSON.stringify({map:'unknown',mode:'unknown',buttonLayouts:{right:{},left:{}},zoom:{rooftop:100,pavilion:'1.1'}});
 assert.deepEqual(readPreferences(storage),{handedness:'right',map:'pavilion',mode:'1v1',buttonLayouts:{right:{},left:{}},zoom:{rooftop:1.2,pavilion:1,mobile:1}});
 const blocked={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};
 assert.equal(writePreferences(blocked,choices),false);assert.equal(readPreferences(blocked).map,'pavilion');
});
