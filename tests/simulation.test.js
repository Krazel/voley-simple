import test from 'node:test';
import assert from 'node:assert/strict';
import {Match,seededRandom} from '../demo/engine.js';

test('four bots complete seeded matches with legal contacts, varied tactics and no endless rallies',()=>{
 const touches={1:0,2:0,3:0};let aerial=0;
 for(let seed=1;seed<=12;seed++){
  let previous=null;const m=new Match({autoplay:true,random:seededRandom(seed),onEvent:e=>{
   if(e.type==='pass'||e.type==='attack'){
    assert.notEqual(e.player,previous,'no consecutive contacts by one player');previous=e.player;
    assert.ok(e.touch>=1&&e.touch<=3);
    if(e.type==='attack'){touches[e.touch]++;if(e.spike)aerial++}
   }
   if(e.type==='serve')previous=m.ball.lastHit;
  }});m.start();m.servingTeam=seed%2;
  for(let i=0;i<120*600&&m.phase!=='finished';i++){
   m.update(1/120);
   if(i%120===0)for(const p of m.players){assert.ok(Number.isFinite(p.x+p.y+p.z));assert.ok(p.x>=.4&&p.x<=7.6);assert.ok(p.team===0?p.y>=8.6:p.y<=7.4)}
  }
  assert.equal(m.phase,'finished','seed '+seed);assert.equal(Math.max(...m.score),7);
  assert.ok(m.stats.contacts.every(n=>n>0));assert.equal(m.stats.netFaults,0);
 }
 assert.ok(Object.values(touches).every(n=>n>0));assert.ok(aerial>0);
});

test('spectator mode ignores human hit/jump and persists across replay; normal mode restores one human',()=>{
 const m=new Match({autoplay:true,random:seededRandom(4)});m.start();m.serve();
 assert.equal(m.players.filter(p=>p.human).length,0);
 const p=m.players[0];Object.assign(m.ball,{x:p.x,y:p.y,z:1.3,lastHit:2,cooldown:0});
 const ball={...m.ball};assert.equal(m.humanJump(),null);assert.equal(m.humanHit(),null);assert.deepEqual(m.ball,ball);
 m.start();assert.equal(m.players.filter(p=>p.human).length,0);
 m.autoplay=false;m.start();assert.deepEqual(m.players.map(p=>p.human),[true,false,false,false]);
});

test('both autonomous teams serve with recorded tactical targets',()=>{
 const m=new Match({autoplay:true,random:seededRandom(9)});m.start();
 for(const team of [0,1]){m.servingTeam=team;m.serve();const plan=m.tactics[team].pending;assert.equal(plan.kind,'serve');assert.ok(team===0?plan.target.y<8:plan.target.y>8);assert.ok(m.ball.z>1)}
});
