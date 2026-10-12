import test from 'node:test';
import assert from 'node:assert/strict';
import {courtConfig,courtGravity,courtNet} from '../demo/maps.js';
import {projectCourt,unprojectCourt} from '../demo/projection.js';
import {Match} from '../demo/engine.js';
import {trajectoryPlan,flightPoint,flightPreview} from '../demo/trajectory.js';
const court=courtConfig('pavilion'),m=court.metresPerUnit;
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('real court has 18 × 9 metres; person, ball, attack lines and net share one scale',()=>{
 near(8*m,9);near(16*m,18);near(courtNet(court)*m,2.43);near(courtGravity(court)*m,9.8);
 const foot=projectCourt(4,12,0,court),head=projectCourt(4,12,1.8/m,court);
 near(foot.y-head.y,155*foot.s);near(court.attackDistance,3);near(court.lineWidth,.05);near(court.ballRadius,.105);
 // Orthographic camera preserves metres, including vertical/ground basis.
 const right=projectCourt(4+1/m,12,0,court),back=projectCourt(4,12+1/m,0,court),up=projectCourt(4,12,1/m,court);
 near(Math.hypot(back.y-foot.y,up.y-foot.y),right.x-foot.x);
});
test('inverse projection hits the same ground point including free space in both maps',()=>{
 for(const map of ['rooftop','pavilion'])for(const x of [-1,0,4,8,9])for(const y of [-1,0,8,16,17]){
  const c=courtConfig(map),p=projectCourt(x,y,0,c),q=unprojectCourt(p.x,p.y,c);near(q.x,x);near(q.y,y);
 }
});
test('pavilion preview, live gravity and destination agree in metres',()=>{
 const game=new Match({map:'pavilion'});game.startPractice();
 const request={target:{x:4,y:4},points:[]},plan=trajectoryPlan(game.players[0],game.ball,request,court);
 near(plan.gravity*m,9.8);assert.ok(plan.actualSpeed<=18.00001);
 const end=flightPoint(plan,plan.time);near(end.x,4);near(end.y,4);near(end.z,0);
 game.humanTargetHit(request);const initial={...game.ball},dt=1/120;game.update(dt);
 near(game.ball.z,initial.z+initial.vz*dt-.5*courtGravity(court)*dt*dt);
 const predicted=flightPoint(plan,dt);near(predicted.z,game.ball.z);
});
test('pavilion uses the taller net for both preview and actual collision; rooftop keeps legacy height',()=>{
 const plan={origin:{x:4,y:9},originZ:2,vx:0,vy:-4,vz:0,time:1,gravity:courtGravity(court),netHeight:courtNet(court)};
 assert.equal(flightPreview(plan).collision,'net');
 for(const map of ['pavilion','rooftop']){
  const game=new Match({map});game.startPractice();game.practiceFlying=true;game.lastTeam=0;
  Object.assign(game.ball,{x:4,y:8.01,z:2,vx:0,vy:-4,vz:0});game.update(1/120);
  assert.equal(game.phase,map==='pavilion'?'point':'rally');
 }
});
test('map switching clears active play and scales movement without changing mode or ownership',()=>{
 const game=new Match({mode:'2v2'});game.startPractice();game.setMap('pavilion');
 assert.equal(game.phase,'ready');assert.equal(game.practice,false);assert.equal(game.mode,'2v2');assert.equal(game.activePlayers.length,4);
 near(game.players[0].speed*m,5.5);assert.equal(game.players[0].human,true);
 game.setMap('rooftop');near(game.players[0].speed,5.5);near(game.netHeight,1.8);
});
