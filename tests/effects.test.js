import test from 'node:test';
import assert from 'node:assert/strict';
import {Effects} from '../demo/effects.js';
import {GameAudio} from '../demo/audio.js';
test('effect pools stay bounded during repeated rallies and fully expire',()=>{
 const fx=new Effects();for(let i=0;i<1000;i++)fx.emit('hit',{x:4,y:10,z:2});
 assert.ok(fx.particles.length<=160);assert.ok(fx.impacts.length<=16);
 fx.point(0,'Suelo');fx.emit('net',{x:4,y:8,z:1});fx.update(3);
 assert.equal(fx.particles.length,0);assert.equal(fx.impacts.length,0);assert.equal(fx.banner,null);assert.equal(fx.net,0);assert.equal(fx.ballKick,0);
});
test('reduced motion retains point information without particle bursts',()=>{
 const fx=new Effects({reduced:true});fx.emit('hit',{x:4,y:10,z:2});fx.point(0,'Suelo');
 assert.equal(fx.particles.length,0);assert.equal(fx.impacts.length,0);assert.equal(fx.flash,0);assert.equal(fx.banner.team,0);
});
test('pause freezes effects; reset clears the previous point',()=>{
 const fx=new Effects();fx.emit('pass',{x:2,y:10,z:1});fx.point(1,'Fuera');const before=JSON.stringify(fx);fx.update(0);assert.equal(JSON.stringify(fx),before);fx.clear();assert.equal(fx.particles.length,0);assert.equal(fx.banner,null);
});

test('spike sparks follow outgoing velocity and obey reduced-motion settings',()=>{
 const point={x:4,y:8,z:2.8,vx:0,vy:12,vz:-2},fx=new Effects({random:()=>.5});fx.emit('spike',point,'#ffbd66',.9);
 assert.ok(fx.particles.every(p=>p.vy>0));assert.equal(fx.tint,'#ffbd66');assert.ok(fx.impacts[0].vy>0);
 const reduced=new Effects({reduced:true});reduced.emit('spike',point);assert.equal(reduced.particles.length,0);
});
test('audio never starts before unlock; mute and pause stop existing voices',()=>{
 const audio=new GameAudio();audio.play('attack');assert.equal(audio.voices.length,0);
 let starts=0,stops=0;
 const param={setValueAtTime(){},exponentialRampToValueAtTime(){},linearRampToValueAtTime(){}};
 audio.context={state:'running',currentTime:0,destination:{},createOscillator:()=>({frequency:param,connect(){},disconnect(){},start(){starts++},stop(){stops++}}),createGain:()=>({gain:param,connect(){},disconnect(){}})};
 for(let i=0;i<20;i++)audio.play('attack');assert.equal(starts,12);assert.equal(audio.voices.length,12);
 audio.toggle();assert.equal(audio.enabled,false);assert.equal(audio.voices.length,0);const before=starts;audio.play('point');assert.equal(starts,before);assert.equal(stops,24);
});


test('native audio uses only the AVAudioPlayer bridge and internal mute stops voices',()=>{
 const prior=globalThis.window;const messages=[];
 globalThis.window={webkit:{messageHandlers:{voleyAudio:{postMessage:m=>messages.push(m)}}}};
 try{const audio=new GameAudio();audio.enabled=true;audio.unlock();assert.equal(audio.context,null);audio.play('point',0);audio.toggle();audio.play('attack');assert.deepEqual(messages.map(m=>m.kind),['point-blue','stop']);audio.toggle();audio.play('jump');assert.equal(messages.at(-1).kind,'jump')}finally{if(prior===undefined)delete globalThis.window;else globalThis.window=prior}
});
