/** Quiet wind and coastal wash, with short, restrained footsteps. */
export class AudioManager {
  private ctx?: AudioContext;
  private master?: GainNode;
  private noise?: AudioBuffer;
  private muted = false;
  private ambienceGain?: GainNode;
  private surfGain?: GainNode;
  private cityGain?: GainNode;
  private ambienceStarted = false;
  private lastStep = -Infinity;
  private lastMix = '';
  private elapsed = 0;
  private carTimer = 1.5;
  private birdTimer = 2;

  ensureContext(): void {
    if (this.ctx) return;
    const Ctor = window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted || document.hidden ? 0 : .75;
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
    const layer=(frequency:number,offset:number,highpass=100)=>{
      const source=ctx.createBufferSource();source.buffer=noise;source.loop=true;
      const high=ctx.createBiquadFilter();high.type='highpass';high.frequency.value=highpass;
      const low=ctx.createBiquadFilter();low.type='lowpass';low.frequency.value=frequency;low.Q.value=.35;
      const gain=ctx.createGain();gain.gain.value=0;
      source.connect(high);high.connect(low);low.connect(gain);gain.connect(master);
      source.start(0,offset);return gain;
    };
    this.ambienceGain=layer(1100,0);
    this.surfGain=layer(650,3.7);
    // Slow low rumble stands in for distant traffic; sparse pass-bys mark the cars.
    this.cityGain=layer(200,1.3,40);
    this.ambienceGain.gain.setTargetAtTime(.12,ctx.currentTime,3);
  }

  /** Sea wash near water; a subtle traffic-and-birds bed inside the city. */
  updateAmbience(delta:number,isNight:boolean,coastal=0,overview=false):void {
    const ctx=this.ctx;if(!ctx||!this.ambienceGain||!this.surfGain||!this.cityGain)return;
    this.elapsed+=delta;
    const sea=Math.round(Math.max(0,Math.min(1,coastal))*10)/10;
    const city=1-sea;
    const mix=`${isNight}/${sea}/${overview}`;
    if(mix!==this.lastMix){
      this.lastMix=mix;
      this.ambienceGain.gain.setTargetAtTime((isNight?.07:.12)*(overview?.55:1),ctx.currentTime,2.5);
      this.cityGain.gain.setTargetAtTime(city*(isNight?.02:.045)*(overview?.4:1),ctx.currentTime,2);
    }
    // Slow breathing surf, without voices, horns or abrupt overlapping loops.
    const surf=sea*(isNight?.065:.10)*(overview?.35:1)*(.75+.25*Math.sin(this.elapsed*.38));
    this.surfGain.gain.setTargetAtTime(surf,ctx.currentTime,1.5);

    // Sparse events keep the city alive without a busy, looping recording.
    this.carTimer-=delta;
    if(this.carTimer<=0){
      this.carTimer=(isNight?6:2.5)+Math.random()*(isNight?9:6);
      if(city>.35&&!overview)this.passBy(city);
    }
    this.birdTimer-=delta;
    if(this.birdTimer<=0){
      this.birdTimer=3+Math.random()*6;
      if(!isNight&&city>.3&&!overview)this.chirp(city);
    }
  }

  /** One distant car passing: band-passed noise with a soft stereo sweep. */
  private passBy(strength:number):void {
    const ctx=this.ctx,master=this.master,noise=this.noise;
    if(!ctx||!master||!noise||this.muted||document.hidden||ctx.state!=='running')return;
    const now=ctx.currentTime;
    const source=ctx.createBufferSource();source.buffer=noise;source.loop=true;
    source.playbackRate.value=.9+Math.random()*.3;
    const band=ctx.createBiquadFilter();band.type='bandpass';band.Q.value=1.1;
    band.frequency.setValueAtTime(320+Math.random()*220,now);
    band.frequency.exponentialRampToValueAtTime(150+Math.random()*120,now+1);
    const pan=ctx.createStereoPanner();pan.pan.value=Math.random()*2-1;
    const gain=ctx.createGain();const peak=.04+strength*.09;
    gain.gain.setValueAtTime(.0001,now);
    gain.gain.exponentialRampToValueAtTime(peak,now+.2);
    gain.gain.exponentialRampToValueAtTime(.0001,now+1.05);
    source.connect(band);band.connect(pan);pan.connect(gain);gain.connect(master);
    source.onended=()=>{source.disconnect();band.disconnect();pan.disconnect();gain.disconnect();};
    source.start(now,Math.random()*(noise.duration-1.2),1.1);source.stop(now+1.1);
  }

  /** A short birdsong phrase: a few quick sine chirps on the master bus. */
  private chirp(strength:number):void {
    const ctx=this.ctx,master=this.master;
    if(!ctx||!master||this.muted||document.hidden||ctx.state!=='running')return;
    const now=ctx.currentTime,notes=2+Math.floor(Math.random()*3),base=2100+Math.random()*900;
    const peak=.014+strength*.02;
    for(let i=0;i<notes;i++){
      const t=now+i*(.07+Math.random()*.05);
      const osc=ctx.createOscillator();osc.type='sine';
      const f0=base*(.95+Math.random()*.12);
      osc.frequency.setValueAtTime(f0,t);
      osc.frequency.exponentialRampToValueAtTime(f0*(1.2+Math.random()*.35),t+.05);
      const gain=ctx.createGain();gain.gain.setValueAtTime(.0001,t);
      gain.gain.exponentialRampToValueAtTime(peak,t+.012);
      gain.gain.exponentialRampToValueAtTime(.0001,t+.08);
      osc.connect(gain);gain.connect(master);
      osc.onended=()=>{osc.disconnect();gain.disconnect();};
      osc.start(t);osc.stop(t+.09);
    }
  }

  private applyMaster():void {
    if(this.ctx&&this.master)this.master.gain.setTargetAtTime(this.muted||document.hidden?0:.75,this.ctx.currentTime,.15);
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
    gain.gain.exponentialRampToValueAtTime(.12+strength*.16,now+.008);
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
