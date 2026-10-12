export function projectCourt(x,y,z=0,court=null){
 let point;
 if(court?.id==='mobile'){
  const vertical=1.125*Math.sqrt(55**2-40**2);
  point={x:294.5+x*44,y:496+y*42-z*vertical,s:1.8*Math.sqrt(55**2-40**2)/155};
 }else if(court?.id==='pavilion'){
  const m=court.metresPerUnit;
  point={x:223+x*m*55,y:410+y*m*40-z*m*Math.sqrt(55**2-40**2),s:court.referenceHeight*Math.sqrt(55**2-40**2)/155};
 }else{
  const t=y/16;
  point={x:167-55*t+x/8*(609+107*t),y:220+1175*(.78*t+.22*t*t)-z*(61+18*t),s:.84+.2*t};
 }
 const zoom=court?.zoom??1;
 return {x:470.5+(point.x-470.5)*zoom+(court?.panX??0),y:836+(point.y-836)*zoom+(court?.panY??0),s:point.s*zoom};
}
export function unprojectCourt(px,py,court=null){
 const zoom=court?.zoom??1;px=470.5+(px-470.5-(court?.panX??0))/zoom;py=836+(py-836-(court?.panY??0))/zoom;
 if(court?.id==='mobile')return {x:(px-294.5)/44,y:(py-496)/42};
 if(court?.id==='pavilion')return {x:(px-223)/(55*court.metresPerUnit),y:(py-410)/(40*court.metresPerUnit)};
 const u=(py-220)/1175,t=(-.78+Math.sqrt(Math.max(0,.78*.78+.88*u)))/.44;
 return {x:(px-(167-55*t))/(609+107*t)*8,y:t*16};
}
