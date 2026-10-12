import test from 'node:test';
import assert from 'node:assert/strict';
import {sequences,fixedHead,drawFrame,jumpHeight,frameStart,placement,secondaryMotion,neckHeight} from '../demo/sprite-sequences.js';
test('shared head follows the body neck with bounded tilt and invariant source pixels and size',()=>{
 const headImage={},calls=[];let pivot,angle;
 const ctx={beginPath(){},ellipse(){},fill(){},save(){},restore(){},translate(x,y){pivot=[x,y]},rotate(a){angle=a},drawImage(...args){calls.push(args)}};
 for(const s of Object.values(sequences)){
  const image={width:s.reference[0],height:s.reference[1]};s.frames=s.durations.map(()=>({x:0,y:0,w:100,h:100}));
  for(let i=0;i<s.durations.length;i++){
   calls.length=0;drawFrame(ctx,image,s,i,frameStart(s,i),true,false,headImage);
   const head=calls.at(-1);assert.equal(head[0],headImage);
   assert.deepEqual(head.slice(1,5),[fixedHead.x,fixedHead.y,fixedHead.w,fixedHead.h]);
   assert.deepEqual(head.slice(7),[fixedHead.w*fixedHead.scale,fixedHead.h*fixedHead.scale]);
   const p=placement(image,s,i,frameStart(s,i));
   assert.deepEqual(pivot,[p.neckX,p.neckY+5]);
   assert(Math.abs(angle)<=6*Math.PI/180+1e-9);
   assert.deepEqual(head.slice(5,7),[(fixedHead.x-fixedHead.neckX)*fixedHead.scale,(fixedHead.y-fixedHead.neckY)*fixedHead.scale]);
   const source=s.order?.[i]??i,k=s.scale;
   assert(Math.abs(p.x+s.necks[source][0]*k-p.neckX)<1e-8);
   assert(Math.abs(p.y+s.necks[source][1]*k-p.neckY)<1e-8);
  }
  for(const time of [...s.durations.map((_,i)=>frameStart(s,i)),s.duration]){
   const before=secondaryMotion(s,time-1e-7),after=secondaryMotion(s,time+1e-7);
   for(const key of ['x','y','angle','bodyAngle'])assert(Math.abs(before[key]-after[key])<1e-4);
  }
 }
 assert.notEqual(secondaryMotion(sequences.run,.1).angle,secondaryMotion(sequences.run,.25).angle);
});
test('neck height has no frame-boundary or loop snaps and the torso shares the head transform',()=>{
 const s=sequences.spike;
 for(const t of [...s.durations.map((_,i)=>frameStart(s,i)),s.duration]){
  assert(Math.abs(neckHeight(s,t-1e-7)-neckHeight(s,t+1e-7))<1e-4);
 }
 const events=[],ctx={beginPath(){},ellipse(){},fill(){},save(){events.push('save')},restore(){events.push('restore')},
  translate(){events.push('translate')},rotate(){events.push('rotate')},drawImage(image){events.push(image)}};
 const body={},head={};body.width=s.reference[0];body.height=s.reference[1];
 s.frames=s.durations.map(()=>({x:0,y:0,w:100,h:100}));
 drawFrame(ctx,body,s,7,frameStart(s,7),true,false,head);
 // Both raster layers sit inside the same root transform, with no independent
 // head translation or trailing offset between their attachment points.
 assert.deepEqual(events,['save','translate','rotate','translate',body,'save','translate','rotate',head,'restore','restore']);
 assert(Math.abs(secondaryMotion(s,frameStart(s,7)).bodyAngle)>.04);
});
test('spike flight has one ballistic arc, starts at toe-off and ends before absorption',()=>{
 const s=sequences.spike,start=frameStart(s,s.jump.first),end=frameStart(s,s.jump.landing),mid=(start+end)/2;
 assert.equal(jumpHeight(s,start-.01),0);assert.equal(jumpHeight(s,start),0);
 assert.equal(jumpHeight(s,end),0);assert.equal(jumpHeight(s,end+.01),0);
 assert(Math.abs(jumpHeight(s,mid)-100)<1e-8);
 const step=.01,second=t=>jumpHeight(s,t+step)-2*jumpHeight(s,t)+jumpHeight(s,t-step);
 assert(Math.abs(second(mid)-second(start+.1))<1e-8);
 assert(jumpHeight(s,frameStart(s,6))>95);
 assert.equal(jumpHeight(sequences.run,.3),0);
});
