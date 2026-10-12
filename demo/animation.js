// Rendering state is separate from simulation: frame rate never changes ball physics.
export function animationFrame(p,time,aiming=false,receiving=false){
 if(p.hit>0){if(p.hitKind!=='attack')return 3;return p.hit>.29?4:6}
 if(p.dashTime>0)return 5;
 if(p.z>.08)return p.vz>2?5:p.vz< -2?7:4;
 if(p.land>.05)return 7;
 if(aiming||receiving)return 3;
 if(p.moving)return 1+(Math.floor(time*9+p.id*.5)%2);
 return 0;
}
export function captureMotion(match){
 return {players:match.players.map(p=>({x:p.x,y:p.y,z:p.z})),ball:{x:match.ball.x,y:match.ball.y,z:match.ball.z}};
}
export function interpolateMotion(current,previous,alpha){
 if(!previous||Math.hypot(current.x-previous.x,current.y-previous.y)>2)return {...current};
 const a=Math.max(0,Math.min(1,alpha));
 return {...current,x:previous.x+(current.x-previous.x)*a,y:previous.y+(current.y-previous.y)*a,z:previous.z+(current.z-previous.z)*a};
}
export function animatePose(state,p,dt,time,frame){
 const blend=1-Math.exp(-18*dt);
 state.gait=(state.gait||0)+Math.hypot(p.vx||0,p.vy||0)/5.5*dt;
 state.lean+=((p.vx||0)*.025-state.lean)*blend;
 state.stride+=((p.moving?1:0)-state.stride)*blend;
 if(state.frame!==frame){state.previous=state.frame;state.frame=frame;state.fade=0}
 state.fade=Math.min(1,state.fade+dt/.075);
 const grounded=!(p.z>.04||p.vz>0),step=Math.sin(state.gait*9*Math.PI+p.id);
 const landing=Math.sin((p.land||0)/.24*Math.PI)*.12;
 const hit=Math.sin((p.hit||0)/.42*Math.PI);
 const ready=grounded&&frame===3&&!(p.hit>0)?.035:0;
 const follow=hit*(p.hitX||0)*.065;
 return {lean:state.lean+follow,bounce:grounded?Math.abs(step)*4*state.stride+Math.sin(time*2.5+p.id)*1.2:0,
  scaleX:1+landing-hit*.025+ready,scaleY:1-landing+hit*.045-ready};
}
