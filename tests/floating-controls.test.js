import test from 'node:test';
import assert from 'node:assert/strict';
import {touchRole,StrokeControls} from '../demo/controls.js';
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
