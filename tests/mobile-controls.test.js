import test from 'node:test';
import assert from 'node:assert/strict';
import {StrokeControls} from '../demo/controls.js';
import {courtConfig} from '../demo/maps.js';
import {projectCourt,unprojectCourt} from '../demo/projection.js';
test('mobile: screen taps dash; upward strokes never jump; nearby strokes still hit',()=>{
 const events=[];let near=false;
 const c=new StrokeControls({gestureJump:false,now:()=>0,canHit:()=>near,jump:()=>events.push('jump'),dash:()=>events.push('dash'),action:()=>events.push('hit')});
 c.down(1,'touch',{x:100,y:200});assert.equal(c.up(1,{x:100,y:200}),'dash');
 c.down(2,'touch',{x:100,y:200});assert.equal(c.up(2,{x:100,y:100}),'none');
 near=true;c.down(3,'touch',{x:100,y:200});assert.equal(c.up(3,{x:150,y:100}),'hit');
 assert.deepEqual(events,['dash','hit']);
});
test('mobile court fits 390 by 844 at current zoom and preserves pavilion sprite height',()=>{
 const court={...courtConfig('mobile'),zoom:2.25},hall={...courtConfig('pavilion'),zoom:2.25};
 const a=projectCourt(0,0,0,court),b=projectCourt(8,16,0,court);
 assert.ok(a.x>0&&b.x<941);assert.ok(a.y>0&&b.y<1672);
 assert.equal(a.s,projectCourt(0,0,0,hall).s);
 for(const [x,y] of [[0,0],[8,16],[4,8],[3,12]]){const p=projectCourt(x,y,0,court),q=unprojectCourt(p.x,p.y,court);assert.ok(Math.abs(q.x-x)<1e-9&&Math.abs(q.y-y)<1e-9)}
});

test('mobile net and physical jump retain pavilion height in pixels per metre',()=>{
 const a={...courtConfig('mobile'),zoom:2.25},b={...courtConfig('pavilion'),zoom:2.25};
 const height=c=>projectCourt(4,8,0,c).y-projectCourt(4,8,c.netHeight/c.metresPerUnit,c).y;
 assert.ok(Math.abs(height(a)-height(b))<1e-9);
});
