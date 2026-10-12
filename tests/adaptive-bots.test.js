import test from 'node:test';
import assert from 'node:assert/strict';
import {Match,seededRandom} from '../demo/engine.js';

test('stationary human gets varied opponent serves and attacks in complete matches',()=>{
 const summaries=[];
 for(let seed=1;seed<=4;seed++){
  const shots=[];const m=new Match({random:seededRandom(seed),onEvent:e=>{
   if((e.type==='serve'||e.type==='attack')&&e.team===1){const q=m.prediction(0);shots.push({kind:e.type,x:q.x,y:q.y})}
  }});m.start();
  for(let i=0;i<120*180&&m.phase!=='finished';i++)m.update(1/120);
  assert.equal(m.phase,'finished');assert.equal(m.stats.contacts[0],0);
  const cells=new Set(shots.map(s=>Math.round(s.x)+':'+Math.round(s.y)));
  const serves=shots.filter(s=>s.kind==='serve');
  assert.ok(cells.size>=3,'stationary scenario seed '+seed);
  assert.ok(new Set(serves.map(s=>Math.round(s.x)+':'+Math.round(s.y))).size>=3);
  assert.ok(shots.some(s=>s.y<12)&&shots.some(s=>s.y>12));
  summaries.push({seed,shots:shots.length,distinctTargets:cells.size});
 }
 console.log(JSON.stringify({idleHumanMatches:summaries}));
});
test('repeated identical positions explore useful targets and trajectories without choosing bad coverage',()=>{
 const m=new Match({random:seededRandom(18)}),from={x:4,y:4,z:1.5};const targets=new Set(),styles=new Set();
 for(let i=0;i<40;i++){
  const options=m.attackOptions(1,from),chosen=m.chooseAttack(1,from);
  const bestBase=Math.max(...options.map(p=>p.baseScore));
  assert.ok(chosen.baseScore>=bestBase-.500001);
  const f=(8-from.y)/(chosen.target.y-from.y);
  assert.ok(from.z*(1-f)+4.9*chosen.time**2*f*(1-f)>=2.05-1e-9);
  targets.add(chosen.target.x+':'+chosen.target.y);styles.add(chosen.style);
  m.rememberShot(1,chosen);m.resolveShot(0,-.6);
 }
 assert.ok(targets.size>=5);assert.equal(styles.size,2);
});
test('recent repeated placement loses value while another open placement remains available',()=>{
 const m=new Match(),from={x:4,y:4,z:1.5},first=m.attackPlan(1,from);
 for(let i=0;i<3;i++)m.rememberShot(1,first);
 const repeated=m.attackOptions(1,from).find(p=>p.style===first.style&&p.target.x===first.target.x&&p.target.y===first.target.y);
 assert.ok(repeated.score<first.score-.5);
 assert.notDeepEqual(m.attackPlan(1,from).target,first.target);
});
test('actual reception records outcome once; later scoring cannot rewrite it',()=>{
 const m=new Match();m.phase='rally';m.lastTeam=1;const p=m.players[0];
 m.rememberShot(1,{target:{x:p.x,y:p.y},style:'drive'});const shot=m.tactics[1].pending;
 Object.assign(m.ball,{x:p.x,y:p.y,z:1.2,alive:true,lastHit:2,cooldown:0});m.humanHit();
 assert.equal(shot.outcome,-.6);assert.equal(m.tactics[1].pending,null);m.point(1);assert.equal(shot.outcome,-.6);
});
test('winning and failed shots produce different estimates for the same placement',()=>{
 const scores=[];
 for(const winner of [1,0]){
  const m=new Match();m.phase='rally';const plan=m.attackPlan(1,{x:4,y:4,z:1.5});
  m.rememberShot(1,plan);m.point(winner);
  assert.equal(m.tactics[1].shots[0].outcome,winner===1?1:-1);
  scores.push(m.attackOptions(1,{x:4,y:4,z:1.5}).find(p=>p.style===plan.style&&p.target.x===plan.target.x&&p.target.y===plan.target.y).score);
 }
 assert.ok(scores[0]>scores[1]);
});
test('mobility estimate responds to visible motion, and pause freezes observation',()=>{
 const samples=[];
 for(const moving of [false,true]){
  const m=new Match();m.phase='rally';Object.assign(m.ball,{z:100,alive:true,cooldown:10});
  for(let i=0;i<60;i++)m.update(1/120,moving?{x:1,y:0}:{x:0,y:0});
  samples.push(m.mobility[0]);m.togglePause();const before=[...m.mobility];m.update(1/30);assert.deepEqual(m.mobility,before);
 }
 assert.ok(samples[1]>samples[0]+.2);
});
test('planning does not consume randomness or history; history is bounded and resets per match',()=>{
 let rolls=0;const m=new Match({random:()=>{rolls++;return .5}});
 for(let i=0;i<30;i++)m.rememberShot(1,{target:{x:1,y:10},style:'drive'});
 assert.equal(m.tactics[1].shots.length,10);const before=JSON.stringify(m.tactics);
 m.attackPlan(1,{x:4,y:4,z:1.5});m.attackPlan(1,{x:4,y:4,z:1.5});
 assert.equal(rolls,0);assert.equal(JSON.stringify(m.tactics),before);
 m.serve();assert.equal(m.tactics[1].shots.length,10);m.start();assert.equal(m.tactics[1].shots.length,0);assert.equal(m.tactics[1].pending,null);
});
