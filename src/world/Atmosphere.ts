import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {localWorldBounds} from '@/geography/Projection';
import {shoreDistance,coastX} from '@/geography/CityGeography';

// A single prevailing wind drives every cloud; a small speed spread adds shear
// without letting clouds overtake each other unrealistically.
const WIND_X=6.5,WIND_Z=2.8;
const wrap=(v:number,size:number)=>((v%size)+size)%size;

export class Atmosphere {
  readonly object=new THREE.Group();
  private readonly clouds:THREE.InstancedMesh;
  private readonly cloudParams:Float32Array;
  private readonly cloudCount=48;
  private readonly sun:THREE.Mesh;
  private readonly water:THREE.ShaderMaterial;
  private time=0;
  private readonly bounds=localWorldBounds();
  constructor(){
    this.object.name='SkyAndSea';const b=this.bounds;
    const sea=new THREE.PlaneGeometry(b.maxX-b.minX+2400,b.maxZ-b.minZ+2400,160,160);sea.rotateX(-Math.PI/2);
    const size=256, shoreData=new Uint8Array(size*size*4);
    for(let z=0;z<size;z++)for(let x=0;x<size;x++){
      const wx=b.minX+x/(size-1)*(b.maxX-b.minX), wz=b.minZ+z/(size-1)*(b.maxZ-b.minZ), i=(z*size+x)*4;
      shoreData[i]=Math.round(THREE.MathUtils.clamp(-shoreDistance(wx,wz)/60,0,1)*255);
      shoreData[i+1]=Math.round(THREE.MathUtils.smoothstep(coastX(wz)-wx,15,85)*255);
      shoreData[i+3]=255;
    }
    const shoreline=new THREE.DataTexture(shoreData,size,size,THREE.RGBAFormat);
    shoreline.minFilter=shoreline.magFilter=THREE.LinearFilter;shoreline.needsUpdate=true;
    const waves=`
      uniform float time;
      uniform sampler2D shoreline; uniform vec4 mapBounds;
      float oceanStrength(vec2 p){
        vec2 uv=(p-mapBounds.xy)/mapBounds.zw;
        float mapped=texture2D(shoreline,clamp(uv,vec2(0.),vec2(1.))).g;
        vec2 outside=max(max(-uv,uv-1.),vec2(0.))*mapBounds.zw;
        return mix(mapped,1.,smoothstep(0.,65.,length(outside)));
      }
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){
        vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);
      }
      float oceanRoll(vec2 p){
        vec2 drift=p+vec2(-time*7.,time*3.);
        float bend=noise(drift*.008)*3.;
        return sin(dot(p,vec2(.026,.014))-time*.75+bend)*1.3
          +sin(dot(p,vec2(-.013,.037))-time*.58+bend*.65)*.65;
      }
      float swell(vec2 p){
        return sin(dot(p,vec2(.085,.036))-time*1.05)*.23
          +sin(dot(p,vec2(-.049,.117))-time*.83+1.7)*.14
          +sin(dot(p,vec2(.19,.16))-time*1.62+.8)*.075;
      }
      float detail(vec2 p){
        p+=vec2(sin(p.y*.093+time*.21),cos(p.x*.071-time*.19))*1.8;
        return swell(p)+sin(dot(p,vec2(.67,.29))-time*2.2)*.032
          +sin(dot(p,vec2(-.41,.93))-time*1.9)*.021
          +sin(dot(p,vec2(1.31,.77))-time*2.8)*.012;
      }
    `;
    this.water=new THREE.ShaderMaterial({
      uniforms:{time:{value:0},daylight:{value:1},shoreline:{value:shoreline},mapBounds:{value:new THREE.Vector4(b.minX,b.minZ,b.maxX-b.minX,b.maxZ-b.minZ)}},
      vertexShader:waves+`varying vec3 world; void main(){vec4 p=modelMatrix*vec4(position,1.);p.y+=oceanRoll(p.xz)*oceanStrength(p.xz)*.55+swell(p.xz)*mix(.12,1.,oceanStrength(p.xz))*(1.-smoothstep(120.,450.,distance(cameraPosition,p.xyz)));world=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`,
      fragmentShader:waves+`
        uniform float daylight;
        varying vec3 world;
        void main(){
          vec2 p=world.xz; float e=.18;
          float ocean=oceanStrength(p);
          // Average short ripples out as the camera pulls back: no distant stripes.
          float footprint=max(length(dFdx(p)),length(dFdy(p)));
          float ripple=1.-smoothstep(.8,7.,footprint);
          float dx=mix(swell(p+vec2(e,0.))-swell(p-vec2(e,0.)),detail(p+vec2(e,0.))-detail(p-vec2(e,0.)),ripple);
          float dz=mix(swell(p+vec2(0.,e))-swell(p-vec2(0.,e)),detail(p+vec2(0.,e))-detail(p-vec2(0.,e)),ripple);
          float resolved=(1.-smoothstep(3.,24.,footprint))*mix(.12,1.,ocean)*(1.-smoothstep(350.,1000.,distance(cameraPosition,world)));
          // Broad waves remain visible from overview; only fine ripples fade out.
          float rollX=(oceanRoll(p+vec2(e,0.))-oceanRoll(p-vec2(e,0.)))*ocean;
          float rollZ=(oceanRoll(p+vec2(0.,e))-oceanRoll(p-vec2(0.,e)))*ocean;
          vec3 n=normalize(vec3(-dx*resolved-rollX,2.*e,-dz*resolved-rollZ));
          vec3 v=normalize(cameraPosition-world);
          vec3 sun=normalize(vec3(-.8,.35,.25));
          vec3 reflected=reflect(-v,n);
          float fresnel=.025+.975*pow(1.-max(dot(n,v),0.),5.);
          vec3 sky=mix(vec3(.60,.81,.91),vec3(.14,.50,.78),clamp(reflected.y,0.,1.));
          vec2 uv=(p-mapBounds.xy)/mapBounds.zw;
          float depth=60.;
          if(all(greaterThanEqual(uv,vec2(0.)))&&all(lessThanEqual(uv,vec2(1.))))depth=texture2D(shoreline,uv).r*60.;
          vec3 sea=mix(vec3(.025,.37,.39),vec3(.009,.12,.23),smoothstep(0.,48.,depth));
          float rolling=oceanRoll(p)*.25+.5;
          float patches=noise(p*.009+vec2(-time*.035,time*.018));
          sea=mix(sea,mix(vec3(.009,.16,.27),vec3(.018,.28,.36),clamp(rolling*.65+patches*.35,0.,1.)),ocean*.75);
          sea+=vec3(.012,.065,.065)*(swell(p)*resolved+.45);
          vec3 color=mix(sea,sky,fresnel*.82);
          float glint=pow(max(dot(n,normalize(v+sun)),0.),180.)*.9+pow(max(dot(n,normalize(v+sun)),0.),26.)*.08;
          color+=vec3(1.,.87,.61)*glint*daylight*mix(.08,1.,ocean);
          float surf=sin(depth*1.6-time*1.3+sin(p.y*.13)*.9+sin(p.x*.21));
          float foam=smoothstep(.68,.97,surf)*(1.-smoothstep(1.,9.,depth))*smoothstep(.3,1.4,depth);
          color=mix(color,vec3(.76,.91,.90),foam*.55);
          // Broken, travelling whitecaps appear only in the larger ocean area.
          float cap=smoothstep(1.52,1.87,oceanRoll(p))*smoothstep(.53,.76,noise(p*.065+vec2(-time*.19,time*.07)));
          color=mix(color,vec3(.55,.79,.83),cap*ocean*.38);
          gl_FragColor=vec4(color*daylight,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const ocean=new THREE.Mesh(sea,this.water);ocean.position.set((b.minX+b.maxX)/2,.25,(b.minZ+b.maxZ)/2);this.object.add(ocean);
    const cloudGeo=mergeGeometries(Array.from({length:6},(_,i)=>new THREE.SphereGeometry(10,10,7).scale(1,.55+(i%3)*.15,.65).translate((i-2.5)*12,Math.sin(i)*4,Math.cos(i)*5)))!;
    this.clouds=new THREE.InstancedMesh(cloudGeo,new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.9,depthWrite:false,fog:false}),this.cloudCount);
    this.clouds.frustumCulled=false;this.object.add(this.clouds);
    this.cloudParams=new Float32Array(this.cloudCount*4);
    for(let i=0;i<this.cloudCount;i++){
      const r=(n:number)=>{const v=Math.sin(i*127.1+n*311.7)*43758.5453;return v-Math.floor(v);};
      this.cloudParams[i*4]=r(1);this.cloudParams[i*4+1]=r(2);
      this.cloudParams[i*4+2]=150+r(3)*135;this.cloudParams[i*4+3]=.85+r(4)*1.15;
    }
    this.sun=new THREE.Mesh(new THREE.SphereGeometry(52,24,16),new THREE.MeshBasicMaterial({color:0xffe58a,fog:false}));
    this.sun.position.set(b.minX-180,460,b.minZ-340);this.object.add(this.sun);
    this.update(0,false);
  }
  update(delta:number,night:boolean,focus?:THREE.Vector3,overview=true):void {
    this.time+=delta;this.water.uniforms.time!.value=this.time;this.water.uniforms.daylight!.value=night?.38:1;
    this.sun.visible=!night;
    if(focus&&!overview)this.sun.position.set(focus.x-600,focus.y+125,focus.z+120);
    else this.sun.position.set(this.bounds.minX-180,460,this.bounds.minZ-340);
    const b=this.bounds,margin=260;
    const minX=b.minX-margin,minZ=b.minZ-margin,width=b.maxX-b.minX+2*margin,depth=b.maxZ-b.minZ+2*margin;
    const m=new THREE.Matrix4(),q=new THREE.Quaternion(),pos=new THREE.Vector3(),scl=new THREE.Vector3();
    for(let i=0;i<this.cloudCount;i++) {
      const fx=this.cloudParams[i*4]!,fz=this.cloudParams[i*4+1]!,y=this.cloudParams[i*4+2]!,s=this.cloudParams[i*4+3]!;
      const speed=.82+(i*7%9)*.045;
      // Shared wind with a gentle speed spread; clouds wrap across the sky and
      // cover the whole map, so none appear only along the edges.
      const x=minX+wrap(fx*width+WIND_X*speed*this.time,width);
      const z=minZ+wrap(fz*depth+WIND_Z*speed*this.time,depth);
      pos.set(x,y+Math.sin(this.time*.16+i)*2.5,z);scl.set(s*1.3,s*.68,s);
      m.compose(pos,q,scl);this.clouds.setMatrixAt(i,m);
    }
    this.clouds.instanceMatrix.needsUpdate=true;
  }
}
