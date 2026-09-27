import * as THREE from 'three';
/** Shared uniforms make thousands of baked/instanced windows glow without lights or clones. */
export class NightLights {
 private readonly strength={value:0};
 constructor(roots:THREE.Object3D[]){
  const seen=new Set<THREE.Material>();
  for(const root of roots)root.traverse(object=>{
   if(!(object instanceof THREE.Mesh))return;
   for(const material of Array.isArray(object.material)?object.material:[object.material]){
    if(!(material instanceof THREE.MeshStandardMaterial)||(!material.vertexColors&&!(object instanceof THREE.InstancedMesh&&object.instanceColor))||seen.has(material))continue;
    seen.add(material);
    material.onBeforeCompile=shader=>{
     shader.uniforms.cityNight=this.strength;
     shader.fragmentShader='uniform float cityNight;\n'+shader.fragmentShader;
     shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
      #if defined(USE_COLOR) || defined(USE_INSTANCING_COLOR)
       float glass=step(vColor.r*1.35,vColor.g)*step(vColor.r*1.45,vColor.b)*step(vColor.g*1.03,vColor.b)*(1.-step(.32,max(vColor.g,vColor.b)));
       totalEmissiveRadiance += vec3(1.,.64,.24)*glass*cityNight*1.65;
      #endif`);
    };
    material.customProgramCacheKey=()=> 'city-night-windows-v1';material.needsUpdate=true;
   }
  });
 }
 update(delta:number,night:boolean):void{this.strength.value=THREE.MathUtils.damp(this.strength.value,night?1:0,2,delta);}
}
