export class Effects {
 constructor({random=Math.random,reduced=false}={}){this.random=random;this.reduced=reduced;this.clear()}
 clear(){this.particles=[];this.impacts=[];this.net=0;this.flash=0;this.tint='#b4e7ff';this.banner=null;this.ballKick=0}
 emit(kind,point,color='#b4e7ff',power=.5){
  if(kind==='net')this.net=1;
  if(kind==='hit'||kind==='pass'||kind==='spike'){this.ballKick=kind==='pass'?.55:1;this.tint=color}
  if(this.reduced)return;
  const count=kind==='dust'?3:kind==='point'?28:kind==='spike'?22:kind==='hit'?14:7;
  const duration=kind==='point'?1.1:kind==='dust'?.3:.45;
  for(let i=0;i<count;i++){
   const directional=(kind==='hit'||kind==='spike')&&Math.hypot(point.vx||0,point.vy||0)>.1;
   const angle=directional?Math.atan2(point.vy,point.vx)+(this.random()-.5)*1.7:this.random()*Math.PI*2,speed=(kind==='dust'?.5:kind==='point'?3:1.5+power*3)*(.35+this.random()*.65);
   this.particles.push({x:point.x,y:point.y,z:point.z||0,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,vz:kind==='dust'?.35:1+this.random()*2.4,life:duration,max:duration,color,size:kind==='dust'?5:kind==='point'?5:3,kind});
  }
  if(kind!=='dust')this.impacts.push({...point,life:.35,max:.35,color,power,kind});
  this.particles=this.particles.slice(-160);this.impacts=this.impacts.slice(-16);
 }
 point(team,reason){this.banner={team,reason,life:1.8};this.flash=this.reduced?0:.15}
 update(dt){
  this.net=Math.max(0,this.net-dt*2.3);this.flash=Math.max(0,this.flash-dt);this.ballKick=Math.max(0,this.ballKick-dt*8);
  if(this.banner){this.banner.life-=dt;if(this.banner.life<=0)this.banner=null}
  for(const p of this.particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z=Math.max(0,p.z+p.vz*dt);p.vz-=5*dt}
  this.particles=this.particles.filter(p=>p.life>0);
  for(const p of this.impacts)p.life-=dt;
  this.impacts=this.impacts.filter(p=>p.life>0);
 }
}
