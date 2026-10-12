import test from 'node:test';
import assert from 'node:assert/strict';
import {touchRole,StrokeControls,simpleTarget,tapTarget} from '../demo/controls.js';
test('tap keeps exact opponent destination, rejects outside and prioritizes teammate',()=>{
 assert.deepEqual(tapTarget({x:2.37,y:4.19}),{kind:'attack',target:{x:2.37,y:4.19}});
 for(const world of [{x:-1,y:3},{x:9,y:4},{x:2,y:9}])assert.equal(tapTarget(world),null);
 assert.deepEqual(tapTarget({x:2,y:5},{id:1,x:6,y:12}),{kind:'pass',receiver:1,target:{x:6,y:12}});
});
test('simple buttons aim away from defender or at teammate; solo pass falls back to legal attack',()=>{
 const players=[{id:0,team:0,x:2,y:12},{id:1,team:0,x:6,y:11},{id:2,team:1,x:1.6,y:3.8}];
 assert.equal(simpleTarget(players,{x:2},false).x,6.4);
 assert.deepEqual(simpleTarget(players,{x:2},true),{x:6,y:11});
 assert(simpleTarget(players.filter(p=>p.id!==1),{x:2},true).y<8);
});
test('floating movement takes its origin anywhere on its side; second finger acts on either side',()=>{
 for(const hand of ['left','right'])for(const y of [100,400,700]){
  const x=hand==='right'?60:330,opposite=390-x;
  let dash=0;const c=new StrokeControls({dash:()=>dash++,now:()=>0,gestureJump:false});
  assert.equal(touchRole('touch',opposite,390,hand,c.move),'action');
  assert(c.down(1,'touch',{x,y},touchRole('touch',x,390,hand,c.move)));
  c.motion(1,{x:x+45,y});assert.equal(c.vector.x,.975);
  for(const actionX of [x,opposite]){
   assert(c.down(2,'touch',{x:actionX,y},touchRole('touch',actionX,390,hand,c.move)));
   c.up(2,{x:actionX,y});assert.equal(c.move.id,1);assert.equal(c.vector.x,.975);
  }
  assert.equal(dash,2);c.up(1,{x:x+45,y},true);assert.equal(c.vector.x,0);
  assert.equal(touchRole('mouse',x,390,hand,null),'action');
 }
});
