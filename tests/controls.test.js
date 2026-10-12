import test from 'node:test';
import assert from 'node:assert/strict';
import {Match,seededRandom,shotPlan} from '../demo/engine.js';
import {GestureControls,dragPower,containsPoint} from '../demo/controls.js';
function nearBall(m,z=1.1){
 const p=m.players[0];m.phase='rally';m.lastTeam=1;m.receiver=0;
 Object.assign(m.ball,{x:p.x,y:p.y-.25,z,vx:0,vy:0,vz:-.2,lastHit:2,cooldown:0,alive:true});
}
test('tiny drag allows a sub-metre pass instead of the old four-metre minimum',()=>{
 const m=new Match();nearBall(m);const dir={x:6,y:0},power=dragPower(dir,130);
 const plan=shotPlan(m.players[0],m.ball,dir,power);
 assert.ok(plan.target.x-m.ball.x<1);assert.ok(plan.target.x>m.ball.x);
 const c=new GestureControls();c.down(1,'mouse',{x:0,y:0});c.motion(1,dir);assert.deepEqual(c.direction(),dir);
});
test('a manual soft pass is received by teammate, who can choose to attack on touch two',()=>{
 const m=new Match({random:seededRandom(7)});nearBall(m);
 const mate=m.players[1],dir={x:mate.x-m.ball.x,y:mate.y-m.ball.y};
 const power=(Math.hypot(dir.x,dir.y)-.35)/13.65;
 assert.equal(m.humanHit(dir,power),'hit');assert.equal(m.receiver,1);assert.equal(m.stats.passes,1);
 for(let i=0;i<240&&mate.contacts===0;i++)m.update(1/120);
 assert.equal(mate.contacts,1);assert.equal(m.ball.lastHit,1);assert.equal(m.receiver,null);assert.equal(m.touches,2);assert.equal(m.stats.attacks,1);assert.equal(m.stats.passes,1);assert.equal(m.phase,'rally');
});
test('human never hits automatically, even directly under the ball',()=>{
 const m=new Match();nearBall(m);m.update(1/120);assert.equal(m.players[0].contacts,0);assert.equal(m.ball.lastHit,2);
});
test('tap near the ball hits forwards exactly once',()=>{
 const m=new Match();nearBall(m);assert.equal(m.humanHit(),'hit');assert.equal(m.ball.vx,0);assert.ok(m.ball.vy<0);assert.equal(m.ball.lastHit,0);assert.equal(m.stats.contacts[0],1);
 m.humanHit();assert.equal(m.stats.contacts[0],1);
 const t=(8-m.ball.y)/m.ball.vy;assert.ok(m.ball.z+m.ball.vz*t-4.9*t*t>=2);
});
test('drag determines direction, including left, right and backwards',()=>{
 for(const dir of [{x:1,y:-1},{x:-1,y:-1},{x:1,y:0},{x:0,y:1}]){
  const m=new Match();nearBall(m);m.humanHit(dir);
  assert.equal(Math.sign(m.ball.vx),Math.sign(dir.x));assert.equal(Math.sign(m.ball.vy),Math.sign(dir.y));
  assert.equal(m.stats.contacts[0],1);
 }
});
test('jump does not alter a nearby ball, no double jump, then lands',()=>{
 const m=new Match();nearBall(m);
 const before={...m.ball};assert.equal(m.humanJump(),'jump');assert.deepEqual(m.ball,before);
 m.update(1/120);const vz=m.players[0].vz;assert.ok(m.players[0].z>0);
 assert.equal(m.humanJump(),null);assert.equal(m.players[0].vz,vz);
 for(let i=0;i<120;i++)m.update(1/120);assert.equal(m.players[0].z,0);
});
test('jump genuinely extends vertical reach and a later action hits',()=>{
 const m=new Match();nearBall(m,3);assert.equal(m.canHumanHit(),false);assert.equal(m.humanJump(),'jump');
 for(let i=0;i<30;i++)m.update(1/120);
 nearBall(m,2.7);assert.ok(m.players[0].z>.8);assert.equal(m.canHumanHit(),true);assert.equal(m.humanHit(),'hit');
});
test('pause and point phases cannot jump or hit',()=>{
 const m=new Match();nearBall(m);for(const phase of ['paused','point','finished','ready']){m.phase=phase;assert.equal(m.humanHit(),null);assert.equal(m.humanJump(),null);assert.equal(m.players[0].contacts,0);assert.equal(m.players[0].vz,0)}
});

test('mouse without a reachable ball never jumps',()=>{
 const m=new Match();m.start();m.serve();m.ball.y=3;
 const c=new GestureControls({action:d=>m.humanHit(d),jump:()=>m.humanJump()});
 c.down(1,'mouse',{x:20,y:20},'jump');c.up(1,{x:100,y:100});
 assert.equal(m.players[0].vz,0);assert.equal(m.stats.contacts[0],0);
});
test('longer drags give greater launch speed and range, with a capped maximum',()=>{
 const speeds=[],ranges=[];
 for(const distance of [15,60,130,260]){
  const m=new Match();nearBall(m);const d={x:0,y:-distance};m.humanHit(d,dragPower(d));
  speeds.push(Math.abs(m.ball.vy));const b=m.ball,t=(b.vz+Math.sqrt(b.vz*b.vz+19.6*b.z))/9.8;ranges.push(Math.abs(b.vy)*t);
 }
 assert.ok(speeds[0]<speeds[1]&&speeds[1]<speeds[2]);assert.equal(speeds[2],speeds[3]);
 assert.ok(ranges[0]<ranges[1]&&ranges[1]<ranges[2]);assert.equal(dragPower(null),.55);
 assert.equal(dragPower({x:0,y:-65},130),dragPower({x:0,y:-130},260));
});
test('touch on visible player aims; outside jumps once on press, role stays fixed while dragging',()=>{
 const bounds={x:100,y:200,width:50,height:90};let jumps=0;const shots=[];
 const c=new GestureControls({action:d=>shots.push(d),jump:()=>jumps++});
 const down=(id,p)=>c.down(id,'touch',p,containsPoint(p,bounds,6)?'action':'jump');
 down(1,{x:120,y:210});c.up(1,{x:250,y:50});assert.deepEqual(shots,[{x:130,y:-160}]);assert.equal(jumps,0);
 down(2,{x:70,y:210});assert.equal(jumps,1);assert.equal(down(2,{x:70,y:210}),false);
 c.up(2,{x:120,y:250});assert.equal(jumps,1);assert.equal(shots.length,1);
 assert.equal(containsPoint({x:120,y:210},{...bounds,y:100},6),false);
});
test('movement and action have different owners and can run simultaneously',()=>{
 const actions=[];let stops=0;const c=new GestureControls({action:d=>actions.push(d),stopMove:()=>stops++});
 c.down(11,'touch',{x:50,y:700},'move');c.motion(11,{x:85,y:680});assert.ok(c.vector.x>0);
 c.down(22,'touch',{x:330,y:700},'action');c.motion(22,{x:290,y:620});
 const movement={...c.vector};c.up(22,{x:290,y:620});
 assert.deepEqual(c.vector,movement);assert.equal(c.move.id,11);assert.deepEqual(actions,[{x:-40,y:-80}]);
 c.up(11,{x:85,y:680});assert.deepEqual(c.vector,{x:0,y:0});assert.equal(actions.length,1);
});
test('action first, movement second, and third finger jump are independent',()=>{
 let jumps=0;const c=new GestureControls({jump:()=>jumps++});c.down(2,'touch',{x:300,y:700},'action');c.down(1,'touch',{x:50,y:700},'move');
 assert.equal(c.aim.id,2);assert.equal(c.move.id,1);c.clear();
 c.down(10,'touch',{x:50,y:500},'move');c.down(20,'touch',{x:250,y:450},'action');assert.equal(c.move.id,10);assert.equal(c.aim.id,20);
 c.down(30,'touch',{x:100,y:450},'jump');assert.equal(jumps,1);assert.equal(c.move.id,10);assert.equal(c.aim.id,20);
});
test('mouse never becomes a movement pointer and tap tolerance preserves forward hit',()=>{
 const actions=[];const c=new GestureControls({action:d=>actions.push(d)});
 c.down(1,'mouse',{x:140,y:300});c.up(1,{x:143,y:302});
 assert.equal(c.move,null);assert.deepEqual(actions,[null]);
 c.down(1,'mouse',{x:140,y:300});c.up(1,{x:190,y:200});
 assert.deepEqual(actions[1],{x:50,y:-100});
});
test('cancel/lost capture never fires a shot or leaves stuck movement',()=>{
 const actions=[];const c=new GestureControls({action:d=>actions.push(d)});
 c.down(1,'touch',{x:0,y:0},'move');c.motion(1,{x:50,y:0});
 c.down(2,'touch',{x:100,y:100},'action');c.up(2,{x:90,y:80},true);assert.equal(actions.length,0);assert.ok(c.vector.x>0);
 c.clear();assert.equal(c.move,null);assert.equal(c.aim,null);assert.deepEqual(c.vector,{x:0,y:0});
 c.up(2,{x:90,y:80});assert.equal(actions.length,0);
});
test('same input router simultaneously moves human and aims a real engine hit',()=>{
 const m=new Match({random:seededRandom(4)});nearBall(m);
 const c=new GestureControls({action:d=>m.humanHit(d),stopMove:()=>m.moveTo(m.players[0].x,m.players[0].y)});
 const x=m.players[0].x;c.down(5,'touch',{x:0,y:0},'move');c.motion(5,{x:50,y:0});
 c.down(8,'touch',{x:300,y:700},'action');m.update(1/120,c.vector);
 assert.ok(m.players[0].x>x);c.up(8,{x:250,y:600});assert.ok(m.ball.vx<0&&m.ball.vy<0);assert.equal(m.players[0].contacts,1);assert.equal(c.move.id,5);
});
