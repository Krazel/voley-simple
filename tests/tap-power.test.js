import test from 'node:test';
import assert from 'node:assert/strict';
import {groupTap} from '../demo/controls.js';
import {trajectoryPlan} from '../demo/trajectory.js';
test('near quick taps raise strength without moving first target; distant or late taps restart',()=>{
 const request={kind:'attack',target:{x:2,y:4}};
 let a=groupTap(null,request,{x:100,y:100},0);
 a=groupTap(a,{...request,target:{x:2.1,y:4.1}},{x:112,y:101},100);
 assert.equal(a.level,2);assert.deepEqual(a.target,request.target);
 a=groupTap(a,request,{x:99,y:105},200);assert.equal(a.level,3);
 assert.equal(groupTap(a,request,{x:100,y:100},250).level,3);
 assert.equal(groupTap(a,request,{x:180,y:100},250).level,1);
 assert.equal(groupTap(a,request,{x:100,y:100},700).level,1);
});
test('tap powers increase forward velocity, preserve exact landing and clear net',()=>{
 const p={x:4,y:12,z:0},ball={x:4,y:12,z:1.5},target={x:3,y:4};
 const plans=[1,2,3].map(tapLevel=>trajectoryPlan(p,ball,{target,points:[],tapLevel}));
 for(const plan of plans){assert.deepEqual(plan.target,target);assert.equal(plan.blocked,false)}
 assert(plans[0].time>plans[1].time&&plans[1].time>plans[2].time);
 assert(Math.abs(plans[0].vy)<Math.abs(plans[1].vy)&&Math.abs(plans[1].vy)<Math.abs(plans[2].vy));
});
