import test from 'node:test';
import assert from 'node:assert/strict';
import {chargePower,directedTarget} from '../demo/controls.js';
import {Match} from '../demo/engine.js';
test('charge saturates and shot follows movement direction with forward fallback',()=>{
 assert.equal(chargePower(0),0);assert.equal(chargePower(425),.5);assert.equal(chargePower(3000),1);
 assert.deepEqual(directedTarget({x:4,y:12},{x:0,y:0}),{x:4,y:2});
 assert(directedTarget({x:4,y:12},{x:1,y:-1}).x>4);
 assert(directedTarget({x:4,y:12},{x:-1,y:-1}).x<4);
});
test('assisted release gives modest extra reach but still forbids consecutive human contacts',()=>{
 const m=new Match();m.startPractice();const p=m.players[0];
 Object.assign(m.ball,{x:p.x+1.8,y:p.y,z:1.2,vx:0,vy:0,vz:0,lastHit:2,cooldown:0});
 assert.equal(m.canHumanHit(),false);assert.equal(m.canHumanHit(.3),true);
 assert.equal(m.humanTargetHit({target:{x:4,y:4},strength:.5,assisted:true}),'hit');
 assert.equal(m.humanTargetHit({target:{x:4,y:4},strength:.5,assisted:true}),null);
});
