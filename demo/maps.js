// Tactical coordinates remain 8 × 16 in both arenas. One unit has an explicit
// metre conversion, used by projection, gravity, speeds and net collision.
export const COURTS=Object.freeze({
 rooftop:Object.freeze({id:'rooftop',name:'Azotea',metresPerUnit:1,width:8,length:16,netHeight:1.8,referenceHeight:null}),
 mobile:Object.freeze({id:'mobile',name:'Cancha móvil',metresPerUnit:.8,width:6.4,length:12.8,netHeight:2.43,referenceHeight:1.8,freeZone:.8,lineWidth:.05,attackDistance:2,ballRadius:.105}),
 pavilion:Object.freeze({id:'pavilion',name:'Pabellón',metresPerUnit:1.125,width:9,length:18,netHeight:2.43,referenceHeight:1.8,freeZone:3,lineWidth:.05,attackDistance:3,ballRadius:.105})
});
export function courtConfig(id='rooftop'){return COURTS[id]||COURTS.rooftop}
export function courtNet(court){return court.netHeight/court.metresPerUnit}
export function courtGravity(court){return 9.8/court.metresPerUnit}
