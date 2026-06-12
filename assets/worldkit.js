/* worldkit.js — shared engine for "each project is a world" pages.
   Worldkit.motes(colors) · Worldkit.scroll() · Worldkit.sound(btnId, musicOpts) */
window.Worldkit = (function(){
  var reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;

  /* ---------- drifting fireflies / motes ---------- */
  function motes(colors){
    var c=document.getElementById('motes'); if(!c) return;
    var x=c.getContext('2d'), W,H,P;
    function sz(){W=c.width=innerWidth;H=c.height=innerHeight;}
    sz(); addEventListener('resize',sz);
    P=Array.from({length:46},function(){return{
      x:Math.random()*W,y:Math.random()*H,r:1+Math.random()*2.4,
      vy:-(.12+Math.random()*.38),vx:(Math.random()-.5)*.24,
      a:.2+Math.random()*.5,tw:Math.random()*Math.PI*2,c:colors[(Math.random()*colors.length)|0]};});
    (function loop(){
      x.clearRect(0,0,W,H);
      for(var i=0;i<P.length;i++){var p=P[i];
        if(!reduce){p.y+=p.vy;p.x+=p.vx;p.tw+=.03;}
        if(p.y<-12){p.y=H+12;p.x=Math.random()*W;}
        var fl=p.a*(.6+.4*Math.sin(p.tw));
        x.beginPath();x.arc(p.x,p.y,p.r,0,7);x.fillStyle=p.c+fl+')';
        x.shadowBlur=10;x.shadowColor=p.c+'.7)';x.fill();}
      x.shadowBlur=0;requestAnimationFrame(loop);
    })();
  }

  /* ---------- scroll: reveal + progress bar + parallax ---------- */
  function scroll(){
    var io=new IntersectionObserver(function(es){es.forEach(function(e){
      if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{threshold:.16});
    document.querySelectorAll('[data-reveal]').forEach(function(el){io.observe(el);});
    var prog=document.getElementById('prog'), px=document.querySelectorAll('[data-px]'), raf=0;
    function f(){raf=0;var m=document.body.scrollHeight-innerHeight;var p=m>0?scrollY/m:0;
      if(prog)prog.style.width=(p*100)+'%';
      px.forEach(function(el){el.style.transform='translateX(-50%) translateY('+(scrollY*parseFloat(el.dataset.px))+'px)';});}
    addEventListener('scroll',function(){if(!raf)raf=requestAnimationFrame(f);},{passive:true});f();
  }

  /* ---------- generative score (melody random-walk + warm pad + bass + echo) ---------- */
  function makeScore(ac, o){
    var master=ac.createGain(); master.gain.value=0; master.connect(ac.destination);
    // spatial echo so it never sounds dry / boring
    var delay=ac.createDelay(1.0); delay.delayTime.value=o.delay||0.32;
    var fb=ac.createGain(); fb.gain.value=o.fb||0.32;
    var wet=ac.createGain(); wet.gain.value=o.wet||0.5;
    delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(master);
    function note(freq,dur,vol,type,echo){
      var t=ac.currentTime;
      var osc=ac.createOscillator(); osc.type=type||'sine'; osc.frequency.value=freq;
      var g=ac.createGain(); g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vol,t+0.02);
      g.gain.exponentialRampToValueAtTime(0.0008,t+dur);
      osc.connect(g); g.connect(master); if(echo) g.connect(delay);
      osc.start(t); osc.stop(t+dur+0.1);
    }
    function pad(freqs){
      var t=ac.currentTime, bar=o.bar||7, g=ac.createGain(); g.connect(master);
      g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(o.pad||0.06,t+2.4);
      g.gain.linearRampToValueAtTime(o.pad*0.8||0.05,t+bar*0.65); g.gain.linearRampToValueAtTime(0,t+bar+0.4);
      freqs.forEach(function(fr,i){
        var osc=ac.createOscillator(); osc.type='triangle'; osc.frequency.value=fr;
        var d=ac.createGain(); d.gain.value=i?0.45:0.7; osc.connect(d); d.connect(g);
        osc.start(t); osc.stop(t+bar+0.5);
        var s=ac.createOscillator(); s.type='sine'; s.frequency.value=fr*2.002; s.connect(d); s.start(t); s.stop(t+bar+0.5);
      });
    }
    var ci=0, li=Math.floor((o.scale.length)/2), chordT, stepT;
    function chord(){ pad(o.chords[ci]); if(o.bass!==false) note(o.chords[ci][0]/2, 2.6, o.bassVol||0.11, 'sine', false); }
    function step(){
      if(Math.random() < (o.density||0.58)){
        li += (Math.random()<0.5?-1:1)*(Math.random()<0.28?2:1);     // melodic random walk
        if(li<0) li=1; if(li>=o.scale.length) li=o.scale.length-2;
        var f=o.scale[li]*(Math.random()<0.18?2:1);
        note(f, o.noteDur||1.4, (o.lead||0.085)*(0.7+Math.random()*0.5), o.leadType||'sine', true);
      }
    }
    return {
      start:function(){
        master.gain.linearRampToValueAtTime(o.vol||0.55, ac.currentTime+2);
        chord(); ci=(ci+1)%o.chords.length;
        chordT=setInterval(function(){ chord(); ci=(ci+1)%o.chords.length; }, (o.bar||7)*1000);
        stepT=setInterval(step, o.step||430);
      },
      setOn:function(v){ master.gain.cancelScheduledValues(ac.currentTime);
        master.gain.linearRampToValueAtTime(v?(o.vol||0.55):0, ac.currentTime+0.5); }
    };
  }

  /* ---------- sound button + first-gesture autostart ---------- */
  function sound(btnId, opts){
    var btn=document.getElementById(btnId); if(!btn) return;
    var ac, score, started=false, wantOn=true;
    function start(){ if(started) return; started=true;
      ac=new (window.AudioContext||window.webkitAudioContext)();
      score=makeScore(ac, opts); score.start(); btn.classList.add('on'); }
    function setOn(v){ wantOn=v; if(!started){ if(v) start(); return; }
      score.setOn(v); btn.classList.toggle('on',v); }
    function kick(){ if(!started && wantOn) start();
      removeEventListener('pointerdown',kick); removeEventListener('keydown',kick); removeEventListener('scroll',kick); }
    if(!reduce){ addEventListener('pointerdown',kick); addEventListener('keydown',kick); addEventListener('scroll',kick,{passive:true}); }
    btn.addEventListener('click',function(e){ e.stopPropagation(); setOn(!btn.classList.contains('on')); });
  }

  /* ---------- Lottie loader (lazy-loads lottie-web on first use) ----------
     Usage: Worldkit.lottie('elId','assets/anim/whatever.json',{loop:true})
     Drop a LottieFiles .json into assets/ and point here — that's it. */
  function lottie(elId, path, opts){
    var el=document.getElementById(elId); if(!el) return;
    function go(){ if(!window.lottie) return;
      window.lottie.loadAnimation(Object.assign({container:el,renderer:'svg',loop:true,autoplay:!reduce,path:path},opts||{})); }
    if(window.lottie) return go();
    var s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/lottie-web@5.12.2/build/player/lottie_light.min.js';
    s.onload=go; document.head.appendChild(s);
  }

  return { motes:motes, scroll:scroll, sound:sound, lottie:lottie };
})();
