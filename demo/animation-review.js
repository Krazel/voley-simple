import {sequences,fixedHead,frameAt,frameStart,drawFrame,prepareFrames} from './sprite-sequences.js';
const $=id=>document.getElementById(id),ctx=$('sprite').getContext('2d');
let clip='spike',time=0,last=performance.now(),playing=!matchMedia('(prefers-reduced-motion: reduce)').matches,ready=false;
const images={},headImage=new Image();
function sync(){$('play').textContent=playing?'Pausar':'Reproducir'}
function selectFrame(i){playing=false;time=frameStart(sequences[clip],i);sync();render()}
function thumbnails(){
 $('filmstrip').replaceChildren();
 const count=sequences[clip].durations.length;$('timeline').max=count-1;
 $('filmstrip').classList.toggle('long',count>8);
 $('frame-count').textContent=count+' dibujos · cabeza única';
 for(let i=0;i<count;i++){
  const b=document.createElement('button'),c=document.createElement('canvas'),label=document.createElement('span');c.width=180;c.height=190;
  b.setAttribute('aria-label','Dibujo '+(i+1)+': '+sequences[clip].labels[i]);b.addEventListener('click',()=>selectFrame(i));
  const x=c.getContext('2d');x.scale(.25,.25);drawFrame(x,images[clip],sequences[clip],i,frameStart(sequences[clip],i),false,false,headImage);
  label.textContent=String(i+1).padStart(2,'0');b.append(c,label);$('filmstrip').append(b);
 }
}
for(const [key,s] of Object.entries(sequences)){
 const b=document.createElement('button');b.textContent=s.name;b.setAttribute('aria-pressed',String(key===clip));
 b.addEventListener('click',()=>{clip=key;time=0;document.querySelectorAll('#clips button').forEach(q=>q.setAttribute('aria-pressed',String(q===b)));if(ready){thumbnails();render()}});$('clips').append(b);
}
$('play').addEventListener('click',()=>{playing=!playing;sync()});
$('step').addEventListener('click',()=>selectFrame((frameAt(sequences[clip],time)+1)%sequences[clip].durations.length));
$('timeline').addEventListener('input',e=>selectFrame(Number(e.target.value)));
function render(){
 const s=sequences[clip],i=frameAt(s,time);ctx.clearRect(0,0,720,760);drawFrame(ctx,images[clip],s,i,time,true,$('guides').checked,headImage);
 $('phase').textContent=s.labels[i];$('counter').textContent='Dibujo '+(i+1)+' / '+s.durations.length;$('timeline').value=i;$('time').textContent=time.toFixed(2).replace('.',',')+' s';
 [...$('filmstrip').children].forEach((b,n)=>b.setAttribute('aria-pressed',String(n===i)));
}
try{
 headImage.src=fixedHead.src;await headImage.decode();
 await Promise.all(Object.entries(sequences).map(async([key,s])=>{const image=new Image();image.src=s.src;await image.decode();images[key]=image;prepareFrames(image,s)}));
 ready=true;thumbnails();$('play').disabled=$('step').disabled=false;sync();
 requestAnimationFrame(function tick(now){const dt=Math.min((now-last)/1000,.06);last=now;if(playing&&!document.hidden)time=(time+dt*Number($('speed').value))%sequences[clip].duration;render();requestAnimationFrame(tick)});
}catch(error){$('phase').textContent='No se pudieron cargar las imágenes. Recarga el visor.';console.error(error)}

