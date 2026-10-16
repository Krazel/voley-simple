export const actionIds=['pass-button','hit-button','dash-button','jump-button'];
export function cleanLayouts(value){
 const result={right:{},left:{}};
 for(const hand of ['right','left'])for(const id of actionIds){
  const p=value?.[hand]?.[id];
  if(Number.isFinite(p?.x)&&Number.isFinite(p?.y))result[hand][id]={x:Math.max(0,Math.min(1,p.x)),y:Math.max(0,Math.min(1,p.y))};
 }
 return result;
}
export function boundButton(p,width,height,top=100,size=76,safe={}){
 const half=size/2+12;
 return {x:Math.max(half+(safe.left||0),Math.min(width-half-(safe.right||0),p.x)),y:Math.max(Math.min(top+size/2,height-half-(safe.bottom||0)),Math.min(height-half-(safe.bottom||0),p.y))};
}
export function buttonsOverlap(a,b,size=76){return Math.abs(a.x-b.x)<size+8&&Math.abs(a.y-b.y)<size+8}
export function resolveButtons(saved,hand,width,height,top=100,safe={},visible=actionIds){
 const result={};
 for(const id of [...visible].sort((a,b)=>Number(!!saved?.[b])-Number(!!saved?.[a]))){
  const i=actionIds.indexOf(id);
  const col=i%2,row=Math.floor(i/2),offset=col?54:146;
  const initial=saved?.[id]?{x:saved[id].x*width,y:saved[id].y*height}:{x:hand==='left'?offset:width-offset,y:height-(row?56:150)};
  let p=boundButton(initial,width,height,top,76,safe);
  if(Object.values(result).some(q=>buttonsOverlap(p,q))){
   const options=[];
   for(let y=height-50-(safe.bottom||0);y>=top+38;y-=84)for(let x=50+(safe.left||0);x<=width-50-(safe.right||0);x+=84){
    const q={x,y};if(!Object.values(result).some(r=>buttonsOverlap(q,r)))options.push(q);
   }
   options.sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y));
   if(options.length)p=options[0];
  }
  result[id]=p;
 }
 return result;
}
export function mountButtonEditor({surface,preferences,hand,menu,save,onOpen,onClose}){
 let layouts=cleanLayouts(preferences),draft=null,drag=null,positions={};
 const panel=document.getElementById('control-editor'),note=document.getElementById('editor-note');
 const buttons=actionIds.map(id=>document.getElementById(id));
 const dimensions=()=>surface.getBoundingClientRect();
 const safeInsets=()=>{const s=getComputedStyle(surface.querySelector('.bottom-controls'));return {left:parseFloat(s.paddingLeft)||0,right:parseFloat(s.paddingRight)||0,bottom:parseFloat(s.paddingBottom)||0}};
 function paint(){
  const {width,height}=dimensions();
  const top=Math.max(100,panel.hidden?100:panel.offsetTop+panel.offsetHeight+8);
  positions=resolveButtons((draft||layouts)[hand()],hand(),width,height,top,safeInsets(),buttons.filter(b=>!b.hidden).map(b=>b.id));
  buttons.forEach(b=>{if(positions[b.id]){b.style.left=positions[b.id].x+'px';b.style.top=positions[b.id].y+'px'}});
 }
 function place(id,p){
  const rect=dimensions(),top=panel.offsetTop+panel.offsetHeight+8;
  p=boundButton(p,rect.width,rect.height,top,76,safeInsets());
  if(buttons.some(b=>b.id!==id&&!b.hidden&&buttonsOverlap(p,positions[b.id]))){note.textContent='Deja un poco de espacio entre los botones.';return false}
  positions[id]=p;draft[hand()][id]={x:p.x/rect.width,y:p.y/rect.height};
  const b=document.getElementById(id);b.style.left=p.x+'px';b.style.top=p.y+'px';
  note.textContent='Arrastra los botones. También puedes usar Tab y las flechas.';return true;
 }
 function close(commit){
  if(commit){layouts=draft;save(layouts)}
  draft=null;drag=null;surface.classList.remove('editing-controls');panel.hidden=true;menu.hidden=false;paint();onClose();document.getElementById('edit-controls').focus();
 }
 document.getElementById('edit-controls').addEventListener('click',()=>{
  onOpen();draft=cleanLayouts(layouts);menu.hidden=true;panel.hidden=false;surface.classList.add('editing-controls');paint();
  note.textContent='Arrastra los botones. También puedes usar Tab y las flechas.';
  document.getElementById('editor-save').focus();
 });
 document.getElementById('editor-save').addEventListener('click',()=>close(true));
 document.getElementById('editor-cancel').addEventListener('click',()=>close(false));
 document.getElementById('editor-reset').addEventListener('click',()=>{draft[hand()]={};paint();note.textContent='Posiciones originales. Pulsa Guardar para conservarlas.'});
 for(const b of buttons){
  for(const type of ['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture','click'])b.addEventListener(type,e=>{
   if(!draft)return;e.preventDefault();e.stopImmediatePropagation();
   if(type==='pointerdown'&&!drag){const rect=dimensions();drag={id:e.pointerId,button:b.id,dx:e.clientX-rect.left-positions[b.id].x,dy:e.clientY-rect.top-positions[b.id].y};b.setPointerCapture(e.pointerId);b.focus()}
   if(!drag||drag.id!==e.pointerId||drag.button!==b.id)return;
   if(type==='pointermove'){const rect=dimensions();place(b.id,{x:e.clientX-rect.left-drag.dx,y:e.clientY-rect.top-drag.dy})}
   if(['pointerup','pointercancel','lostpointercapture'].includes(type))drag=null;
  },true);
  b.addEventListener('keydown',e=>{
   if(!draft||!e.key.startsWith('Arrow'))return;e.preventDefault();e.stopImmediatePropagation();
   const p=positions[b.id],step=e.shiftKey?20:8;
   place(b.id,{x:p.x+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0),y:p.y+(e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0)});
  });
 }
 window.addEventListener('keydown',e=>{if(draft&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close(false)}},true);
 new ResizeObserver(()=>{drag=null;paint()}).observe(surface);paint();
 return {refresh:paint,get editing(){return !!draft},get layouts(){return layouts}};
}
