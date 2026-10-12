import {projectCourt} from './projection.js';
// Exact court markings are generated from metres, rather than painted into
// a background image. Orthographic camera: x=55 px/m; depth=40 px/m.
export function drawPavilion(ctx,court){
 const m=court.metresPerUnit,P=(x,y,z=0)=>projectCourt(x/m,y/m,z/m,court);
 const poly=(points,color)=>{ctx.fillStyle=color;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill()};
 const floor=(x,y,w,h,color)=>{const p=P(x,y),q=P(x+w,y+h);ctx.fillStyle=color;ctx.fillRect(p.x,p.y,q.x-p.x,q.y-p.y)};
 const bg=ctx.createLinearGradient(0,0,0,1672);bg.addColorStop(0,'#203d54');bg.addColorStop(.35,'#7495a4');bg.addColorStop(1,'#253f48');ctx.fillStyle=bg;ctx.fillRect(0,0,941,1672);
 // Roof trusses, clerestory glazing and a high wall establish the hall.
 ctx.fillStyle='#172f42';ctx.fillRect(0,0,941,110);
 for(let x=-100;x<1050;x+=175){poly([[x,0],[x+16,0],[x+140,300],[x+120,300]],'#33556a');ctx.strokeStyle='#98b2bd55';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+15,25);ctx.lineTo(x+116,245);ctx.stroke()}
 const glass=ctx.createLinearGradient(0,100,0,280);glass.addColorStop(0,'#d2f1f7');glass.addColorStop(1,'#7ba2b3');
 for(let x=26;x<920;x+=112){ctx.fillStyle='#244658';ctx.fillRect(x-6,113,102,153);ctx.fillStyle=glass;ctx.fillRect(x,119,90,141);ctx.fillStyle='#486c7c';ctx.fillRect(x+42,119,5,141);ctx.fillRect(x,180,90,5)}
 ctx.fillStyle='#d9e1d8';ctx.fillRect(0,270,941,85);ctx.fillStyle='#38716f';ctx.fillRect(0,345,941,43);
 ctx.fillStyle='#294955';ctx.fillRect(420,287,101,54);ctx.fillStyle='#c8eaeb';ctx.textAlign='center';ctx.font='bold 16px system-ui';ctx.fillText('KRAZEL',470,309);ctx.font='12px system-ui';ctx.fillText('VOLLEYBALL',470,326);
 // Floor includes three metres of clear space on every side.
 const wood=ctx.createLinearGradient(0,290,941,1410);wood.addColorStop(0,'#c49b62');wood.addColorStop(.45,'#f0d29b');wood.addColorStop(1,'#b58550');floor(-3,-3,15,24,wood);
 for(let y=-3;y<21;y+=.24){floor(-3,y,15,.012,'#694c2422');for(let x=-3+(Math.round(y/.24)%3)*.8;x<12;x+=2.4)floor(x,y,.012,.24,'#73522b22')}
 floor(-3,-3,15,24,'#e8dfc01a');
 // Playing rectangle 9 × 18; each half is 9 × 9. Attack lines 3 m away.
 floor(0,0,9,9,'#d99557e8');floor(0,9,9,9,'#db995ae8');
 const L=court.lineWidth;
 floor(0,0,9,L,'#fff9e9');floor(0,18-L,9,L,'#fff9e9');floor(0,0,L,18,'#fff9e9');floor(9-L,0,L,18,'#fff9e9');
 floor(0,9-L/2,9,L,'#fff9e9');
 floor(0,9-court.attackDistance,9,L,'#fff9e9');floor(0,9+court.attackDistance-L,9,L,'#fff9e9');
 // Window reflections stop at the playing floor; no decorative court lines.
 for(let x=-2;x<11;x+=2.2)poly([[P(x,-2).x,P(x,-2).y],[P(x+1,-2).x,P(x+1,-2).y],[P(x+2,3).x,P(x+2,3).y],[P(x+1,3).x,P(x+1,3).y]],'#fff7d913');
 ctx.fillStyle='#31545d';ctx.fillRect(0,1410,941,262);ctx.fillStyle='#173440';ctx.fillRect(0,1410,941,12);
 ctx.textAlign='center';ctx.fillStyle='#deebe8';ctx.font='bold 20px system-ui';ctx.fillText('PABELLÓN · 18 × 9 m',470,1310);ctx.fillStyle='#a9c6c8';ctx.font='17px system-ui';ctx.fillText('Personajes 1,80 m · Red 2,43 m',470,1341);
}

// Compact arcade court: same sprite scale as the hall at 100%, fitted to portrait.
export function drawMobileCourt(ctx,court){
 const P=(x,y)=>projectCourt(x,y,0,court);
 const rect=(x,y,w,h,color)=>{const a=P(x,y),b=P(x+w,y+h);ctx.fillStyle=color;ctx.fillRect(a.x,a.y,b.x-a.x,b.y-a.y)};
 ctx.fillStyle='#24485a';ctx.fillRect(0,0,941,1672);
 rect(-2,-2,12,20,'#d5b685');
 for(let y=-2;y<18;y+=.28)rect(-2,y,12,.012,'#79512a25');
 rect(0,0,8,8,'#2b93a1');rect(0,8,8,8,'#257c96');
 for(const y of [0,5.5,8,10.5,15.94])rect(0,y,8,.06,'#f5fbf5');
 rect(0,0,.06,16,'#f5fbf5');rect(7.94,0,.06,16,'#f5fbf5');
 ctx.textAlign='center';ctx.fillStyle='#ffffffb0';ctx.font='bold 14px system-ui';
 const label=P(4,3);ctx.fillText('KRAZEL',label.x,label.y);
}
