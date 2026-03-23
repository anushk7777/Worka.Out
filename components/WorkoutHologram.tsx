import React, { useEffect, useRef, useState, useMemo } from 'react';
import { PersonalizedPlan, WorkoutDay } from '../types';
import { motion } from 'framer-motion';

declare global { interface Window { THREE: any; } }

interface Props { workoutPlan: PersonalizedPlan | null; }

const FOCUS_MAP: Record<string, string[]> = {
  'chest':['chest'],'push':['chest','shoulders','arms'],'push day':['chest','shoulders','arms'],
  'chest & triceps':['chest','arms'],'chest and triceps':['chest','arms'],'chest/triceps':['chest','arms'],
  'upper body push':['chest','shoulders','arms'],'pecs':['chest'],
  'back':['back'],'pull':['back','arms'],'pull day':['back','arms'],
  'back & biceps':['back','arms'],'back and biceps':['back','arms'],'back/biceps':['back','arms'],
  'upper body pull':['back','arms'],'lats':['back'],'deadlift':['back','legs'],
  'legs':['legs'],'leg day':['legs'],'lower body':['legs'],'quads':['legs'],
  'hamstrings':['legs'],'glutes':['legs'],'squats':['legs'],'squat':['legs'],'calves':['legs'],
  'shoulders':['shoulders'],'shoulder day':['shoulders'],'delts':['shoulders'],'deltoids':['shoulders'],'overhead':['shoulders'],
  'arms':['arms'],'arm day':['arms'],'biceps':['arms'],'triceps':['arms'],'biceps & triceps':['arms'],
  'core':['core'],'abs':['core'],'abdominals':['core'],'core strength':['core'],
  'full body':['chest','back','legs','shoulders','arms','core'],
  'full-body':['chest','back','legs','shoulders','arms','core'],
  'hiit':['chest','back','legs','shoulders','arms','core'],
  'cardio':['legs','core'],'rest':[],'rest day':[],'active recovery':['core'],'mobility':['legs','core'],
};

const LABEL_MAP: Record<string,{label:string;r2:string;r3:string}> = {
  chest:    {label:'PECTORALIS MAJOR',    r2:'CHEST', r3:'4 × 12'},
  back:     {label:'LATISSIMUS DORSI',    r2:'BACK',  r3:'5 × 10'},
  legs:     {label:'QUADS · HAMS · CALVES',r2:'LEGS', r3:'4 × 15'},
  shoulders:{label:'ANTERIOR DELTOIDS',   r2:'DELTS', r3:'4 × 12'},
  arms:     {label:'BICEPS · TRICEPS',    r2:'ARMS',  r3:'3 × 15'},
  core:     {label:'RECTUS ABDOMINIS',    r2:'CORE',  r3:'4 × 20'},
  full:     {label:'FULL BODY ACTIVATION',r2:'ALL',   r3:'5 × 10'},
};

const GROUP_MAP: Record<string,string[]> = {
  chest:['chest'], shoulders:['shoulders'], arms:['arms'],
  core:['core'], back:['back','torso'], legs:['legs'],
  full:['chest','shoulders','arms','core','back','torso','legs'],
};

const BUTTONS = [
  {key:'chest',label:'CHEST'},{key:'back',label:'BACK'},{key:'legs',label:'LEGS'},
  {key:'shoulders',label:'SHLDRS'},{key:'arms',label:'ARMS'},
  {key:'core',label:'CORE'},{key:'full',label:'FULL'},
];

function getMuscles(focus: string): string[] {
  if (!focus) return [];
  const lower = focus.toLowerCase().trim();
  if (FOCUS_MAP[lower] !== undefined) return FOCUS_MAP[lower];
  for (const [k,v] of Object.entries(FOCUS_MAP)) {
    if (lower.includes(k) || k.includes(lower)) return v;
  }
  const out: string[] = [];
  if (lower.includes('chest')||lower.includes('pec')) out.push('chest');
  if (lower.includes('back')||lower.includes('lat')||lower.includes('pull')) out.push('back');
  if (lower.includes('leg')||lower.includes('quad')||lower.includes('squat')||lower.includes('ham')||lower.includes('glute')) out.push('legs');
  if (lower.includes('shoulder')||lower.includes('delt')||lower.includes('push')) out.push('shoulders');
  if (lower.includes('arm')||lower.includes('bicep')||lower.includes('tricep')) out.push('arms');
  if (lower.includes('core')||lower.includes('ab')) out.push('core');
  return [...new Set(out)];
}

function getTodayWorkout(plan: PersonalizedPlan | null): WorkoutDay | null {
  if (!plan?.workout?.length) return null;
  const day = new Date().toLocaleDateString('en-US', {weekday:'long'});
  const found = plan.workout.find(d =>
    d.day.toLowerCase().includes(day.toLowerCase()) ||
    day.toLowerCase().includes(d.day.toLowerCase().split(' ')[0])
  );
  if (found) return found;
  const idx = new Date().getDay();
  return plan.workout[Math.min(idx===0?6:idx-1, plan.workout.length-1)] || null;
}

const WorkoutHologram: React.FC<Props> = ({ workoutPlan }) => {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const threeRef     = useRef<{renderer:any; setTarget:(k:string)=>void} | null>(null);
  const [activeKey, setActiveKey]     = useState('chest');
  const [focusLabel, setFocusLabel]   = useState('PECTORALIS MAJOR');
  const [hr, setHr]                   = useState(72);

  const todayWorkout = useMemo(() => getTodayWorkout(workoutPlan), [workoutPlan]);
  const isRest = todayWorkout ? getMuscles(todayWorkout.focus||'').length === 0 : false;

  useEffect(() => {
    const t = setInterval(() => setHr(Math.floor(68+Math.random()*14)), 2800);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const cont   = containerRef.current;
    if (!canvas || !cont) return;
    const THREE = window.THREE;
    if (!THREE) { console.error('Three.js not loaded'); return; }

    let W = cont.clientWidth, H = cont.clientHeight;
    const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true});
    renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    renderer.setSize(W,H);
    renderer.setClearColor(0x050810,1);

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, W/H, 0.01, 100);
    camera.position.set(0,1.05,4.6);
    camera.lookAt(0,0.85,0);

    function lathe(pts:[number,number][], segs=28) {
      return new THREE.LatheGeometry(pts.map(([x,y])=>new THREE.Vector2(x,y)), segs);
    }

    const allParts: any[] = [];
    function mkPart(geo:any, gn:string, pos:[number,number,number], rot?:[number,number,number]) {
      const g = new THREE.Group();
      const fm = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({color:0x001a2a,transparent:true,opacity:0.14,side:THREE.FrontSide,depthWrite:false}));
      const wm = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({color:0x00e5ff,wireframe:true,transparent:true,opacity:0.52}));
      g.add(fm); g.add(wm);
      g.userData = {gn,fm,wm};
      g.position.set(...pos);
      if (rot) g.rotation.set(...rot);
      allParts.push(g);
      return g;
    }

    const body = new THREE.Group();
    scene.add(body);

    // HEAD — lathe profile
    const hg = lathe([[0,0.28],[0.06,0.27],[0.13,0.24],[0.18,0.19],[0.21,0.12],[0.22,0.04],[0.21,-0.04],[0.19,-0.10],[0.16,-0.16],[0.12,-0.22],[0.09,-0.27],[0.04,-0.31],[0.0,-0.26]],28);
    hg.scale(1,1,0.86); hg.computeVertexNormals();
    body.add(mkPart(hg,'head',[0,2.42,0]));

    // NECK
    body.add(mkPart(lathe([[0.085,0.12],[0.09,0.06],[0.095,0],[0.098,-0.06],[0.10,-0.12]],16),'neck',[0,2.14,0]));

    // TORSO — organic taper chest→waist→hip
    const tg = lathe([[0.0,0.38],[0.10,0.36],[0.22,0.32],[0.28,0.22],[0.30,0.10],[0.28,0.00],[0.24,-0.10],[0.20,-0.20],[0.19,-0.28],[0.21,-0.34],[0.26,-0.40],[0.0,-0.42]],32);
    tg.scale(1,1,0.72); tg.computeVertexNormals();
    body.add(mkPart(tg,'torso',[0,1.64,0]));

    // PECS — sphere blobs
    ([-0.145,0.145] as number[]).forEach(sx=>{
      const pg = new THREE.SphereGeometry(0.135,14,10);
      pg.scale(1.05,0.75,0.55); pg.computeVertexNormals();
      body.add(mkPart(pg,'chest',[sx,1.82,0.10]));
    });

    // ABS — stacked ellipsoids
    for (let r=0;r<3;r++) {
      ([-0.062,0.062] as number[]).forEach(sx=>{
        const ag = new THREE.SphereGeometry(0.07,10,8);
        ag.scale(0.9,0.65,0.48); ag.computeVertexNormals();
        body.add(mkPart(ag,'core',[sx,1.55-r*0.11,0.14]));
      });
    }
    ([-0.21,0.21] as number[]).forEach(sx=>{
      const og = new THREE.SphereGeometry(0.10,10,8);
      og.scale(0.7,1.4,0.55); og.computeVertexNormals();
      body.add(mkPart(og,'core',[sx,1.52,0.06]));
    });

    // SHOULDERS
    ([-1,1] as number[]).forEach(s=>{
      const sg = new THREE.SphereGeometry(0.155,16,12);
      sg.scale(0.9,1.1,0.95);
      const p = sg.attributes.position;
      for (let i=0;i<p.count;i++) { const y=p.getY(i); if(y<-0.05){const t=1+Math.abs(y)*0.4;p.setX(i,p.getX(i)*t);} }
      sg.computeVertexNormals();
      body.add(mkPart(sg,'shoulders',[s*0.385,1.94,0]));
    });

    // UPPER ARMS — lathe bicep profile
    ([-1,1] as number[]).forEach(s=>{
      const ug = lathe([[0.0,0.24],[0.055,0.23],[0.085,0.18],[0.105,0.10],[0.112,0.02],[0.108,-0.06],[0.100,-0.14],[0.090,-0.20],[0.082,-0.24],[0.0,-0.26]],16);
      ug.scale(1,1,0.88); ug.computeVertexNormals();
      body.add(mkPart(ug,'arms',[s*0.565,1.65,0],[0,0,s*0.10]));
    });

    // ELBOWS
    ([-1,1] as number[]).forEach(s=>{
      const eg = new THREE.SphereGeometry(0.085,12,8);
      eg.scale(1,0.8,1.05); eg.computeVertexNormals();
      body.add(mkPart(eg,'arms',[s*0.588,1.19,0.01]));
    });

    // FOREARMS
    ([-1,1] as number[]).forEach(s=>{
      const fg = lathe([[0.0,0.22],[0.065,0.21],[0.082,0.16],[0.088,0.08],[0.085,0.00],[0.076,-0.10],[0.065,-0.18],[0.052,-0.22],[0.0,-0.24]],14);
      fg.scale(1,1,0.82); fg.computeVertexNormals();
      body.add(mkPart(fg,'arms',[s*0.598,0.90,0.01],[0,0,s*0.06]));
    });

    // HANDS
    ([-1,1] as number[]).forEach(s=>{
      const hng = new THREE.SphereGeometry(0.075,10,8);
      hng.scale(0.75,1.2,0.42); hng.computeVertexNormals();
      body.add(mkPart(hng,'arms',[s*0.608,0.60,0.01]));
    });

    // PELVIS
    const hpg = lathe([[0.0,0.12],[0.12,0.11],[0.22,0.08],[0.27,0.02],[0.26,-0.06],[0.22,-0.12],[0.14,-0.14],[0.0,-0.14]],28);
    hpg.scale(1,1,0.75); hpg.computeVertexNormals();
    body.add(mkPart(hpg,'core',[0,1.10,0]));

    // TRAPS / BACK
    ([-1,1] as number[]).forEach(s=>{
      const btg = new THREE.SphereGeometry(0.10,10,8);
      btg.scale(1.1,0.6,0.7); btg.computeVertexNormals();
      body.add(mkPart(btg,'back',[s*0.18,2.02,-0.04]));
    });

    // THIGHS — lathe with VMO bulge
    ([-1,1] as number[]).forEach(s=>{
      const thg = lathe([[0.0,0.30],[0.08,0.29],[0.13,0.24],[0.148,0.16],[0.152,0.06],[0.145,-0.04],[0.135,-0.14],[0.120,-0.22],[0.105,-0.28],[0.0,-0.30]],18);
      thg.scale(1,1,0.90);
      const p = thg.attributes.position;
      for(let i=0;i<p.count;i++){
        const y=p.getY(i),x=p.getX(i),z=p.getZ(i);
        if(y<-0.05&&y>-0.22){
          const inner=s>0?x<-0.02:x>0.02;
          if(inner){const b=0.014*Math.max(0,1-Math.abs(y+0.13)*8);const len=Math.sqrt(x*x+z*z);if(len>0.001){p.setX(i,x/len*(len+b));p.setZ(i,z/len*(len+b*0.3));}}
        }
      }
      thg.computeVertexNormals();
      body.add(mkPart(thg,'legs',[s*0.148,0.72,0]));
    });

    // KNEECAPS
    ([-1,1] as number[]).forEach(s=>{
      const kg = new THREE.SphereGeometry(0.088,12,9);
      kg.scale(0.95,0.78,1.12); kg.computeVertexNormals();
      body.add(mkPart(kg,'legs',[s*0.148,0.38,0.026]));
    });

    // CALVES — gastroc bulge
    ([-1,1] as number[]).forEach(s=>{
      const cg = lathe([[0.0,0.24],[0.06,0.23],[0.082,0.18],[0.092,0.10],[0.088,0.02],[0.078,-0.07],[0.065,-0.15],[0.052,-0.20],[0.040,-0.24],[0.0,-0.26]],14);
      cg.scale(1,1,0.84);
      const p=cg.attributes.position;
      for(let i=0;i<p.count;i++){const y=p.getY(i),z=p.getZ(i);if(y>-0.05&&y<0.16&&z<0){const b=Math.max(0,1-Math.abs(y-0.06)*8)*0.018;const bk=Math.max(0,-z/0.08);p.setZ(i,z-b*bk*0.5);}}
      cg.computeVertexNormals();
      body.add(mkPart(cg,'legs',[s*0.145,0.07,-0.008]));
    });

    // ANKLES
    ([-1,1] as number[]).forEach(s=>{
      const ag2 = new THREE.SphereGeometry(0.055,10,7);
      ag2.scale(1,0.7,1); ag2.computeVertexNormals();
      body.add(mkPart(ag2,'legs',[s*0.145,-0.21,0]));
    });

    // FEET
    ([-1,1] as number[]).forEach(s=>{
      const ftg = lathe([[0.0,0.06],[0.04,0.055],[0.068,0.04],[0.072,0.01],[0.068,-0.02],[0.056,-0.04],[0.038,-0.055],[0.0,-0.06]],12);
      ftg.scale(1,0.7,2.1); ftg.computeVertexNormals();
      const ft = mkPart(ftg,'legs',[s*0.145,-0.30,0.07]);
      ft.rotation.x = Math.PI*0.05;
      body.add(ft);
    });

    allParts.forEach(p=>body.add(p));

    // Platform rings
    const outerRing = new THREE.Mesh(new THREE.RingGeometry(0.55,0.58,64), new THREE.MeshBasicMaterial({color:0x00e5ff,side:THREE.DoubleSide,transparent:true,opacity:0.75}));
    outerRing.rotation.x=-Math.PI/2; outerRing.position.y=-0.38; scene.add(outerRing);
    [{r1:0.42,r2:0.445,op:0.4},{r1:0.30,r2:0.32,op:0.25}].forEach(({r1,r2,op})=>{
      const rm=new THREE.Mesh(new THREE.RingGeometry(r1,r2,64),new THREE.MeshBasicMaterial({color:0x00e5ff,side:THREE.DoubleSide,transparent:true,opacity:op}));
      rm.rotation.x=-Math.PI/2; rm.position.y=-0.38; scene.add(rm);
    });
    const fd=new THREE.Mesh(new THREE.CircleGeometry(0.65,48),new THREE.MeshBasicMaterial({color:0x00e5ff,transparent:true,opacity:0.05,side:THREE.DoubleSide}));
    fd.rotation.x=-Math.PI/2; fd.position.y=-0.39; scene.add(fd);

    function setTarget(key: string) {
      const active = new Set(GROUP_MAP[key]||[]);
      allParts.forEach(p=>{
        const on = active.has(p.userData.gn);
        p.userData.fm.material.color.setHex(on?0x220008:0x001a2a);
        p.userData.fm.material.opacity = on?0.28:0.14;
        p.userData.wm.material.color.setHex(on?0xff3366:0x00e5ff);
        p.userData.wm.material.opacity = on?0.92:0.52;
      });
      const info = LABEL_MAP[key];
      if (info) setFocusLabel(info.label);
      setActiveKey(key);
    }
    threeRef.current = {renderer, setTarget};

    // Auto-set from workout
    if (todayWorkout) {
      const muscles = getMuscles(todayWorkout.focus||'');
      if (muscles.length>0) {
        const mk = Object.entries(GROUP_MAP).find(([,v])=>JSON.stringify([...v].sort())===JSON.stringify([...muscles].sort()))?.[0];
        setTarget(mk||'chest');
      } else setTarget('chest');
    } else setTarget('chest');

    // Drag
    let rotY=0.3, autoR=true, drag=false, lastX=0;
    const onMD=(e:MouseEvent)=>{drag=true;lastX=e.clientX;autoR=false;};
    const onMU=()=>{drag=false;setTimeout(()=>autoR=true,2500);};
    const onMM=(e:MouseEvent)=>{if(drag){rotY+=(e.clientX-lastX)*0.01;lastX=e.clientX;}};
    const onTD=(e:TouchEvent)=>{drag=true;lastX=e.touches[0].clientX;autoR=false;};
    const onTE=()=>{drag=false;setTimeout(()=>autoR=true,2500);};
    const onTM=(e:TouchEvent)=>{if(drag){rotY+=(e.touches[0].clientX-lastX)*0.01;lastX=e.touches[0].clientX;}};
    canvas.addEventListener('mousedown',onMD); window.addEventListener('mouseup',onMU); window.addEventListener('mousemove',onMM);
    canvas.addEventListener('touchstart',onTD); canvas.addEventListener('touchend',onTE); canvas.addEventListener('touchmove',onTM);

    // Render
    let t2=0, rafId=0;
    function animate(){
      rafId=requestAnimationFrame(animate);
      t2+=0.008;
      if(autoR) rotY+=0.005;
      body.rotation.y=rotY;
      body.position.y=Math.sin(t2)*0.038;
      outerRing.rotation.z+=0.003;
      renderer.render(scene,camera);
    }
    animate();

    const onResize=()=>{W=cont.clientWidth;H=cont.clientHeight;camera.aspect=W/H;camera.updateProjectionMatrix();renderer.setSize(W,H);};
    window.addEventListener('resize',onResize);

    return ()=>{
      cancelAnimationFrame(rafId);
      canvas.removeEventListener('mousedown',onMD); window.removeEventListener('mouseup',onMU); window.removeEventListener('mousemove',onMM);
      canvas.removeEventListener('touchstart',onTD); canvas.removeEventListener('touchend',onTE); canvas.removeEventListener('touchmove',onTM);
      window.removeEventListener('resize',onResize);
      renderer.dispose();
    };
  }, []);

  const handleBtn = (key:string) => threeRef.current?.setTarget(key);

  if (!workoutPlan) return (
    <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} className="glass-premium rounded-[28px] border border-white/10 p-6 mb-6 text-center">
      <i className="fas fa-dumbbell text-3xl text-gray-600 mb-3 block animate-pulse"></i>
      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Generate a plan first</p>
    </motion.div>
  );

  if (isRest) return (
    <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} className="glass-premium rounded-[28px] border border-white/10 p-8 mb-6 text-center">
      <div className="text-5xl mb-4">🌙</div>
      <p className="text-white font-black text-xl">Rest Day</p>
      <p className="text-gray-400 text-xs mt-2 font-medium">Recovery is where growth happens.</p>
    </motion.div>
  );

  return (
    <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{duration:0.5}}
      className="glass-premium rounded-[28px] border border-white/10 mb-6 overflow-hidden relative">

      {/* Header */}
      <div className="flex justify-between items-center px-5 pt-5 pb-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.3em] flex items-center gap-2" style={{color:'#00E5FF'}}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse inline-block" style={{background:'#00E5FF'}}></span>
            TODAY'S PROTOCOL
          </p>
          {todayWorkout && <p className="text-white font-black text-lg tracking-tight mt-0.5">{todayWorkout.day}</p>}
        </div>
        {todayWorkout && (
          <span className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border"
            style={{background:'rgba(255,51,102,0.1)',borderColor:'rgba(255,51,102,0.4)',color:'#FF3366'}}>
            {todayWorkout.focus}
          </span>
        )}
      </div>

      <div className="flex gap-3 px-3 pb-4">
        {/* HOLOGRAM CANVAS */}
        <div ref={containerRef} style={{width:200,minWidth:200,height:420,background:'#050810',borderRadius:16,position:'relative',overflow:'hidden',flexShrink:0}}>
          <canvas ref={canvasRef} style={{width:'100%',height:'100%',display:'block'}}/>

          {/* Scanline */}
          <div style={{position:'absolute',left:0,right:0,height:2,background:'linear-gradient(90deg,transparent,rgba(0,229,255,.3) 30%,rgba(0,229,255,.6) 50%,rgba(0,229,255,.3) 70%,transparent)',pointerEvents:'none',zIndex:10,animation:'scanAnim 3.2s linear infinite'}}/>

          {/* Left data */}
          <div style={{position:'absolute',top:10,left:8,display:'flex',flexDirection:'column',gap:4,zIndex:20,pointerEvents:'none'}}>
            {['BF%: 17.8','LBM: 72kg',`HR: ${hr}bpm`].map((t,i)=>(
              <span key={i} style={{fontFamily:'Courier New,monospace',fontSize:7,fontWeight:700,color:'rgba(0,229,255,.68)',letterSpacing:'0.1em'}}>{t}</span>
            ))}
          </div>

          {/* Right data */}
          <div style={{position:'absolute',top:10,right:8,display:'flex',flexDirection:'column',gap:4,zIndex:20,pointerEvents:'none',textAlign:'right'}}>
            <span style={{fontFamily:'Courier New,monospace',fontSize:7,fontWeight:700,color:'rgba(255,51,102,.75)',letterSpacing:'0.1em'}}>TARGET</span>
            <span style={{fontFamily:'Courier New,monospace',fontSize:7,fontWeight:700,color:'rgba(255,51,102,.75)',letterSpacing:'0.1em'}}>{activeKey.toUpperCase()}</span>
            <span style={{fontFamily:'Courier New,monospace',fontSize:7,fontWeight:700,color:'rgba(255,51,102,.75)',letterSpacing:'0.1em'}}>{todayWorkout?.exercises?.length||0} EX</span>
          </div>

          {/* Focus label */}
          <div style={{position:'absolute',bottom:44,left:0,right:0,textAlign:'center',zIndex:20,pointerEvents:'none'}}>
            <span style={{fontFamily:'Courier New,monospace',fontSize:7,fontWeight:800,color:'#00E5FF',letterSpacing:'0.18em',textTransform:'uppercase',textShadow:'0 0 8px rgba(0,229,255,.55)'}}>{focusLabel}</span>
          </div>

          {/* Floor glow */}
          <div style={{position:'absolute',bottom:76,left:'50%',transform:'translateX(-50%)',width:100,height:10,background:'radial-gradient(ellipse,rgba(0,229,255,.5) 0%,transparent 70%)',borderRadius:'50%',filter:'blur(3px)',pointerEvents:'none',zIndex:4}}/>

          {/* Buttons */}
          <div style={{position:'absolute',bottom:6,left:0,right:0,display:'flex',flexWrap:'wrap',gap:3,justifyContent:'center',zIndex:20,padding:'0 4px'}}>
            {BUTTONS.map(b=>(
              <button key={b.key} onClick={()=>handleBtn(b.key)} style={{
                fontFamily:'Courier New,monospace',fontSize:6.5,fontWeight:800,letterSpacing:'0.1em',
                textTransform:'uppercase',padding:'3px 7px',borderRadius:12,cursor:'pointer',transition:'all .2s',
                border:activeKey===b.key?'1px solid rgba(255,51,102,.55)':'1px solid rgba(0,229,255,.2)',
                background:activeKey===b.key?'rgba(255,51,102,.14)':'rgba(0,229,255,.04)',
                color:activeKey===b.key?'#FF3366':'rgba(0,229,255,.72)',
              }}>{b.label}</button>
            ))}
          </div>
        </div>

        {/* EXERCISE LIST */}
        <div className="flex-1 flex flex-col gap-2 overflow-y-auto no-scrollbar" style={{maxHeight:420}}>
          {todayWorkout?.exercises?.map((ex,i)=>(
            <motion.div key={i} initial={{opacity:0,x:10}} animate={{opacity:1,x:0}} transition={{delay:i*0.06}}
              className="glass-premium rounded-2xl px-4 py-3 border border-white/5 hover:border-white/15 transition-all">
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{background:'#FF3366',boxShadow:'0 0 5px rgba(255,51,102,.6)'}}/>
                    <p className="text-white font-black text-sm leading-tight">{ex.name}</p>
                  </div>
                  {ex.notes&&<p className="text-gray-500 text-[10px] font-medium pl-3.5 italic leading-relaxed">{ex.notes}</p>}
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="font-black text-sm tabular-nums" style={{color:'#00E5FF'}}>{ex.sets}<span className="text-gray-600 mx-0.5 text-xs">×</span>{ex.reps}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <style>{`@keyframes scanAnim{0%{top:0;opacity:.22}100%{top:100%;opacity:.04}}`}</style>
    </motion.div>
  );
};

export default WorkoutHologram;
