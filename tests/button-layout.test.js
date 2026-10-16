import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanLayouts,resolveButtons,buttonsOverlap,boundButton,actionIds} from '../demo/button-layout.js';
import {readPreferences,writePreferences} from '../demo/preferences.js';

test('button layouts survive reload separately for each hand and reject invalid storage',()=>{
 let raw;const storage={getItem:()=>raw,setItem:(_,v)=>raw=v};
 const p=readPreferences(storage);p.buttonLayouts.right['hit-button']={x:.82,y:.65};p.buttonLayouts.left['jump-button']={x:.2,y:.8};
 writePreferences(storage,p);assert.deepEqual(readPreferences(storage).buttonLayouts,p.buttonLayouts);
 assert.deepEqual(cleanLayouts({right:{'hit-button':{x:Infinity,y:.5},'pass-button':{x:-1,y:3}},left:null}),{right:{'pass-button':{x:0,y:1}},left:{}});
});
test('all four buttons remain visible and separated after viewport changes and corrupt overlapping positions',()=>{
 for(const [width,height] of [[320,568],[390,844],[430,932],[844,390],[1024,768]])for(const hand of ['left','right']){
  for(const saved of [{},Object.fromEntries(actionIds.map(id=>[id,{x:1,y:1}]))]){
   const positions=Object.values(resolveButtons(saved,hand,width,height,160));
   for(const p of positions){assert(p.x>=50&&p.x<=width-50);assert(p.y>=198&&p.y<=height-50)}
   positions.forEach((p,i)=>positions.slice(i+1).forEach(q=>assert(!buttonsOverlap(p,q))));
  }
 }
});
test('dragging beyond the edges keeps the complete hit target on screen',()=>{
 assert.deepEqual(boundButton({x:-200,y:1000},390,844,160),{x:50,y:794});
 assert.deepEqual(boundButton({x:1000,y:1000},844,390,100,76,{left:44,right:44,bottom:21}),{x:750,y:319});
});
test('solo layouts can use the hidden pass space and keep custom shots in place when the pass returns',()=>{
 const saved={'hit-button':{x:244/390,y:694/844}},visible=actionIds.filter(id=>id!=='pass-button');
 const solo=resolveButtons(saved,'right',390,844,100,{},visible),duo=resolveButtons(saved,'right',390,844);
 assert.deepEqual(solo['hit-button'],{x:244,y:694});assert.deepEqual(duo['hit-button'],solo['hit-button']);
 assert(!buttonsOverlap(duo['hit-button'],duo['pass-button']));
});
