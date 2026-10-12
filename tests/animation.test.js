import test from 'node:test';
import assert from 'node:assert/strict';
import {animationFrame,interpolateMotion,animatePose} from '../demo/animation.js';
test('pose priorities: contact, airborne, ready to receive, alternating strides, idle',()=>{
 const p={id:0,hit:0,z:0,moving:0};assert.equal(animationFrame(p,0),0);
 p.moving=1;assert.equal(animationFrame(p,0),1);assert.equal(animationFrame(p,.12),2);
 assert.equal(animationFrame(p,0,true),3);assert.equal(animationFrame(p,0,false,true),3);
 p.z=.8;assert.equal(animationFrame(p,0),4);p.hit=.3;p.hitKind='pass';assert.equal(animationFrame(p,0),3);
 p.hitKind='attack';assert.equal(animationFrame(p,0),4);
 p.hit=.2;assert.equal(animationFrame(p,0),6);p.hit=0;p.vz=4;assert.equal(animationFrame(p,0),5);p.vz=-4;assert.equal(animationFrame(p,0),7);
 p.z=0;p.land=.2;assert.equal(animationFrame(p,0),7);
});
test('running cadence follows actual travel and does not cycle while still',()=>{
 const state={lean:0,stride:0,frame:0,previous:0,fade:1};
 animatePose(state,{id:0,vx:0,vy:0,moving:0},1,10,0);assert.equal(state.gait,0);
 animatePose(state,{id:0,vx:5.5,vy:0,moving:1},.5,10.5,1);assert.equal(state.gait,.5);
 animatePose(state,{id:0,vx:2.75,vy:0,moving:1},.5,11,1);assert.equal(state.gait,.75);
});
test('visual interpolation smooths motion without mutating physics or smearing resets',()=>{
 const current={x:2,y:4,z:1},previous={x:1,y:4,z:0};
 assert.deepEqual(interpolateMotion(current,previous,.5),{x:1.5,y:4,z:.5});assert.equal(current.x,2);
 assert.deepEqual(interpolateMotion({...current,x:7},previous,.5),{...current,x:7});
});
test('animation transitions settle consistently at 30 and 144 fps and freeze at pause',()=>{
 const p={id:0,vx:5,moving:1,hit:0,land:0};
 const run=fps=>{const s={lean:0,stride:0,frame:0,previous:0,fade:1};for(let i=0;i<fps;i++)animatePose(s,p,1/fps,(i+1)/fps,1);return s};
 const a=run(30),b=run(144);assert.ok(Math.abs(a.lean-b.lean)<1e-8);assert.equal(a.fade,1);
 const frozen={...a};animatePose(a,p,0,1,1);assert.deepEqual(a,frozen);
});

test('airborne poses do not add a running bounce to the physical jump; landing compresses the body',()=>{
 const s={lean:0,stride:1,frame:5,previous:0,fade:1};
 const air=animatePose(s,{id:0,z:1,vz:2,vx:4,moving:1},1/60,1,5);assert.equal(air.bounce,0);
 const land=animatePose(s,{id:0,z:0,vz:0,vx:0,moving:0,land:.12},1/60,1,7);assert.ok(land.scaleX>1&&land.scaleY<1);
});
