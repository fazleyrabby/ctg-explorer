/** Quiet wind and coastal wash, with short, restrained footsteps. */
export class AudioManager {
  private ctx?: AudioContext;
  private master?: GainNode;
  private noise?: AudioBuffer;
  private muted = false;
  private ambienceGain?: GainNode;
  private surfGain?: GainNode;
  private ambienceStarted = false;
  private lastStep = -Infinity;
  private lastMix = '';
  private elapsed = 0;

  ensureContext(): void {
    if (this.ctx) return;
    const Ctor = window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted || document.hidden ? 0 : .32;
    this.master.connect(this.ctx.destination);
    this.noise = this.createNoiseBuffer();
    document.addEventListener('visibilitychange', () => this.applyMaster());
  }

  resume(): void {
    this.ensureContext();
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }
  get isReady(): boolean { return this.ctx?.state === 'running'; }

  /** No crowded street recording: preparation is local and silent. */
  async loadAmbience(): Promise<void> { this.ensureContext(); }

  startAmbience(): void {
    this.ensureContext();
    const ctx=this.ctx,master=this.master;
    if(!ctx||!master||!this.noise||this.ambienceStarted)return;
    this.ambienceStarted=true;
    const noise=this.noise;
    const layer=(frequency:number,offset:number)=>{
      const source=ctx.createBufferSource();source.buffer=noise;source.loop=true;
      const high=ctx.createBiquadFilter();high.type='highpass';high.frequency.value=100;
      const low=ctx.createBiquadFilter();low.type='lowpass';low.frequency.value=frequency;low.Q.value=.35;
      const gain=ctx.createGain();gain.gain.value=0;
      source.connect(high);high.connect(low);low.connect(gain);gain.connect(master);
      source.start(0,offset);return gain;
    };
    this.ambienceGain=layer(1100,0);
    this.surfGain=layer(650,3.7);
    this.ambienceGain.gain.setTargetAtTime(.018,ctx.currentTime,3);
  }

  /** More coastal wash near the sea; overview and night remain particularly quiet. */
  updateAmbience(delta:number,isNight:boolean,coastal=0,overview=false):void {
    const ctx=this.ctx;if(!ctx||!this.ambienceGain||!this.surfGain)return;
    this.elapsed+=delta;
    const sea=Math.round(Math.max(0,Math.min(1,coastal))*10)/10;
    const mix=`${isNight}/${sea}/${overview}`;
    if(mix!==this.lastMix){
      this.lastMix=mix;
      this.ambienceGain.gain.setTargetAtTime((isNight?.010:.018)*(overview?.55:1),ctx.currentTime,2.5);
    }
    // Slow breathing surf, without voices, horns or abrupt overlapping loops.
    const surf=sea*(isNight?.026:.04)*(overview?.35:1)*(.75+.25*Math.sin(this.elapsed*.38));
    this.surfGain.gain.setTargetAtTime(surf,ctx.currentTime,1.5);
  }

  private applyMaster():void {
    if(this.ctx&&this.master)this.master.gain.setTargetAtTime(this.muted||document.hidden?0:.32,this.ctx.currentTime,.15);
  }
  setMuted(muted:boolean):void {this.muted=muted;this.applyMaster();}
  toggleMute():boolean {this.setMuted(!this.muted);return this.muted;}

  footstep(intensity=.4):void {
    const ctx=this.ctx,master=this.master,noise=this.noise;
    if(!ctx||!master||!noise||this.muted||document.hidden||ctx.state!=='running')return;
    const now=ctx.currentTime;if(now-this.lastStep<.22)return;this.lastStep=now;
    const strength=Math.max(0,Math.min(1,intensity));
    const source=ctx.createBufferSource();source.buffer=noise;source.playbackRate.value=.85+Math.random()*.2;
    const lowpass=ctx.createBiquadFilter();lowpass.type='lowpass';lowpass.frequency.value=400+strength*550;lowpass.Q.value=.5;
    const highpass=ctx.createBiquadFilter();highpass.type='highpass';highpass.frequency.value=110;
    const gain=ctx.createGain();gain.gain.setValueAtTime(.0001,now);
    gain.gain.exponentialRampToValueAtTime(.055+strength*.085,now+.008);
    gain.gain.exponentialRampToValueAtTime(.0001,now+.11);
    source.connect(highpass);highpass.connect(lowpass);lowpass.connect(gain);gain.connect(master);
    source.onended=()=>{source.disconnect();highpass.disconnect();lowpass.disconnect();gain.disconnect();};
    source.start(now,Math.random()*(noise.duration-.2),.15);source.stop(now+.16);
  }

  private createNoiseBuffer():AudioBuffer {
    const ctx=this.ctx!,length=Math.floor(ctx.sampleRate*8);
    const buffer=ctx.createBuffer(1,length,ctx.sampleRate),data=buffer.getChannelData(0);
    let previous=0;
    for(let i=0;i<length;i++){
      previous=(previous+.045*(Math.random()*2-1))/1.045;
      // A short seam fade prevents a click when the loop wraps.
      const edge=Math.min(1,i/(ctx.sampleRate*.04),(length-1-i)/(ctx.sampleRate*.04));
      data[i]=previous*4*edge;
    }
    return buffer;
  }
}
