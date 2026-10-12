// Body frames are painted sprites. One immutable raster head is reused for
// every action: never regenerate, mirror, deform or rescale per frame.
// Small rigid neck-pivot rotations let the same drawing follow the torso.
export const fixedHead=Object.freeze({
 src:'./assets/player-blue-run-v3.png',x:145,y:8,w:96,h:91,
 neckX:191,neckY:96,scale:.82
});
export const sequences={
 run:{name:'Carrera',src:'./assets/player-blue-run-body-v4.png',reference:[1448,1086],rows:[0,538,1086],scale:.73,
 durations:[.08,.07,.08,.07,.08,.07,.08,.07],order:[0,3,5,2,4,7,1,6],
 labels:['Apoyo derecho','Recogida izquierda','Rodilla izquierda flexionada','Extensión izquierda','Apoyo izquierdo','Recogida derecha','Rodilla derecha flexionada','Extensión derecha'],
 necks:[[213,28],[546,27],[904,27],[1239,26],[216,554],[549,555],[905,554],[1240,553]],rootNeckY:310},
 spike:{name:'Remate',src:'./assets/player-blue-spike-body-v4.png',reference:[1125,1398],rows:[0,450,985,1398],scale:1.12,
 durations:[.22,.12,.10,.08,.14,.13,.07,.14,.16,.10,.13,.35],
 labels:['Preparación','Flexión','Carga del salto','Despegue','Ascenso','Armado del brazo','Golpe en el punto alto','Continuación','Descenso','Contacto con el suelo','Amortiguación','Recuperación'],
 necks:[[141,116],[428,132],[704,157],[984,116],[141,602],[430,590],[701,593],[980,609],[150,1035],[429,1051],[699,1080],[974,1035]],
 ground:[431,431,431,431,952,952,952,952,1358,1358,1358,1358],rootNeckY:316.2,jump:{first:3,landing:9,apex:100}}
};
for(const s of Object.values(sequences))s.duration=s.durations.reduce((a,b)=>a+b,0);
export function frameStart(s,i){return s.durations.slice(0,i).reduce((a,b)=>a+b,0)}
export function frameAt(s,t){t=((t%s.duration)+s.duration)%s.duration;let end=0;for(let i=0;i<s.durations.length;i++){end+=s.durations[i];if(t<end-1e-9)return i}return s.durations.length-1}
export function jumpHeight(s,t){
 if(!s.jump)return 0;
 const launch=frameStart(s,s.jump.first),land=frameStart(s,s.jump.landing);
 if(t<=launch||t>=land)return 0;
 const u=(t-launch)/(land-launch);
 // h = v0*t - g*t²/2: constant gravity, one takeoff and one landing.
 return 4*s.jump.apex*u*(1-u);
}
export function secondaryMotion(s,t){
 const time=((t%s.duration)+s.duration)%s.duration;
 if(!s.jump){
  const phase=time/s.duration*Math.PI*2;
  return {x:2.5*Math.sin(phase),y:2*(1-Math.cos(phase*2)),
   bodyAngle:1.6*Math.sin(phase)*Math.PI/180,
   angle:-.8*Math.sin(phase-.35)*Math.PI/180};
 }
 // Move the torso and head together. The head has only a small relative tilt;
 // its neck pivot never drifts away from the body's attachment.
 const body=[0,-.5,-1,0,1,2,1,-3,-1,0,-.5,0];
 const tilt=[0,.5,1,-.5,.5,1,.5,-1.5,-.5,0,.5,0];
 const i=frameAt(s,time),u=(time-frameStart(s,i))/s.durations[i],ease=(1-Math.cos(u*Math.PI))/2;
 const blend=a=>(a[i]+(a[(i+1)%a.length]-a[i])*ease)*Math.PI/180;
 return {x:0,y:0,bodyAngle:blend(body),angle:blend(tilt)};
}
export function neckHeight(s,t){
 if(!s.ground)return s.rootNeckY;
 const time=((t%s.duration)+s.duration)%s.duration,i=frameAt(s,time),next=(i+1)%s.durations.length;
 const at=n=>n>=s.jump.first&&n<s.jump.landing?s.rootNeckY:665-(s.ground[n]-s.necks[n][1])*s.scale;
 const u=(time-frameStart(s,i))/s.durations[i],ease=(1-Math.cos(u*Math.PI))/2;
 return at(i)+(at(next)-at(i))*ease;
}
export function prepareFrames(image,s){
 const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(image,0,0);
 s.frames=findFrames(x.getImageData(0,0,c.width,c.height).data,c.width,c.height,s);
}
export function findFrames(data,width,height,s){
 return Array.from({length:s.durations.length},(_,i)=>{
  i=s.order?.[i]??i;
  const row=Math.floor(i/4),l=Math.floor(i%4*width/4),r=Math.floor((i%4+1)*width/4),t=Math.floor(s.rows[row]*height/s.reference[1]),b=Math.floor(s.rows[row+1]*height/s.reference[1]);
  let x0=r,y0=b,x1=l,y1=t;
  for(let yy=t;yy<b;yy++)for(let xx=l;xx<r;xx++)if(data[(yy*width+xx)*4+3]>110){x0=Math.min(x0,xx);x1=Math.max(x1,xx);y0=Math.min(y0,yy);y1=Math.max(y1,yy)}
  return {x:x0,y:y0,w:x1-x0+1,h:y1-y0+1};
 });
}
export function placement(image,s,i,time,animated=true){
 const r=s.frames[i],k=s.scale*s.reference[0]/image.width;
 const sourceIndex=s.order?.[i]??i;
 const nx=s.necks[sourceIndex][0]*image.width/s.reference[0],ny=s.necks[sourceIndex][1]*image.height/s.reference[1];
 const height=animated?jumpHeight(s,time):0;
 let neckY=neckHeight(s,time)-height;
 const motion=secondaryMotion(s,time),neckX=360+motion.x;
 neckY+=motion.y;
 const head=fixedHead;
 return {x:neckX+(r.x-nx)*k,y:neckY+(r.y-ny)*k,w:r.w*k,h:r.h*k,
  rootX:neckX,rootY:665-height,height,neckX,neckY,bodyAngle:motion.bodyAngle,headAngle:motion.angle,
  headX:(head.x-head.neckX)*head.scale,headY:(head.y-head.neckY)*head.scale,
  headW:head.w*head.scale,headH:head.h*head.scale};
}
export function drawFrame(ctx,image,s,i,time,animated=true,guides=false,headImage){
 const r=s.frames[i],p=placement(image,s,i,time,animated);
 ctx.fillStyle='#173b602c';ctx.beginPath();ctx.ellipse(360,669,67-p.height*.16,11-p.height*.015,0,0,Math.PI*2);ctx.fill();
 ctx.save();ctx.translate(p.rootX,p.rootY);ctx.rotate(p.bodyAngle);ctx.translate(-p.rootX,-p.rootY);
 ctx.drawImage(image,r.x,r.y,r.w,r.h,p.x,p.y,p.w,p.h);
 if(headImage){
  const h=fixedHead;ctx.save();
  // Pivot at the same neck used to register the body, with 5px overlap. Never
  // orbit around the image centre or delay the attachment behind the body.
  ctx.translate(p.neckX,p.neckY+5);ctx.rotate(p.headAngle);
  ctx.drawImage(headImage,h.x,h.y,h.w,h.h,p.headX,p.headY,p.headW,p.headH);ctx.restore();
 }
 ctx.restore();
 if(guides){
  ctx.save();ctx.strokeStyle='#c57626';ctx.lineWidth=1.5;ctx.setLineDash([5,7]);ctx.beginPath();ctx.moveTo(360,70);ctx.lineTo(360,700);ctx.moveTo(250,665);ctx.lineTo(470,665);ctx.stroke();ctx.setLineDash([]);
  const dx=p.neckX-p.rootX,dy=p.neckY-p.rootY,c=Math.cos(p.bodyAngle),sn=Math.sin(p.bodyAngle);
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(p.rootX+dx*c-dy*sn,p.rootY+dx*sn+dy*c,4,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();
 }
}

