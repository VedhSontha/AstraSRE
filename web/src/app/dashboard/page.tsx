'use client';
import React, { useEffect, useRef, useState, useCallback, Suspense, lazy } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { FluidMenu } from '@/components/ui/fluid-menu';
import { Activity, Zap, Shield, Clock as ClockIcon, Cpu, BarChart2, Radio, WifiOff, X, ArrowLeft } from 'lucide-react';

const MarsColonyGraph = lazy(() => import('@/components/ui/mars-colony-graph'));

// ── Global CSS ────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;600;700&display=swap');

* { box-sizing: border-box; }

.hud-font { font-family: 'Chakra Petch', 'Courier New', monospace !important; }

/* Animated starfield */
@keyframes twinkle { 0%,100%{opacity:.6} 50%{opacity:.1} }

/* Scanline overlay */
.scan-lines {
  background: repeating-linear-gradient(
    0deg,
    transparent 0px, transparent 2px,
    rgba(0,230,255,.013) 2px, rgba(0,230,255,.013) 3px
  );
  pointer-events: none;
}

/* Breach border flash */
@keyframes breachBorder { 0%,100%{opacity:.35} 50%{opacity:1} }
.breach-aura {
  border: 2px solid rgba(255,30,30,.8);
  box-shadow: inset 0 0 60px rgba(255,0,0,.14), 0 0 40px rgba(255,0,0,.25);
  animation: breachBorder .7s ease-in-out infinite;
  pointer-events: none;
}

/* Screen shake */
@keyframes shake {
  0%,100%{transform:translate(0)}
  15%{transform:translate(-4px,-2px)}
  30%{transform:translate(4px,2px)}
  45%{transform:translate(-3px,3px)}
  60%{transform:translate(3px,-1px)}
  75%{transform:translate(-1px,2px)}
}
.shaking { animation: shake .45s ease-out 1 }

/* HUD panel */
.hud-panel {
  background: rgba(0,10,28,.82);
  backdrop-filter: blur(18px);
  border: 1px solid rgba(0,200,255,.13);
  position: relative;
}
/* Corner brackets */
.hud-panel::before,.hud-panel::after,
.hud-bracket::before,.hud-bracket::after { content:''; position:absolute; width:14px; height:14px; }
.hud-panel::before { top:-1px;left:-1px;border-top:2px solid rgba(0,200,255,.5);border-left:2px solid rgba(0,200,255,.5); }
.hud-panel::after  { top:-1px;right:-1px;border-top:2px solid rgba(0,200,255,.5);border-right:2px solid rgba(0,200,255,.5); }
.hud-bracket::before { bottom:-1px;left:-1px;border-bottom:2px solid rgba(0,200,255,.5);border-left:2px solid rgba(0,200,255,.5); }
.hud-bracket::after  { bottom:-1px;right:-1px;border-bottom:2px solid rgba(0,200,255,.5);border-right:2px solid rgba(0,200,255,.5); }

.breach-panel::before,.breach-panel::after,
.breach-panel .hud-bracket::before,.breach-panel .hud-bracket::after {
  border-color: rgba(255,30,30,.7) !important;
}

/* Chronicle teletype */
@keyframes teletype { from{opacity:0;transform:translateX(-6px)} to{opacity:1;transform:none} }
.teletype-line { animation: teletype .2s ease-out forwards; }

/* Pulse badge */
@keyframes badgePulse { 0%,100%{opacity:1} 50%{opacity:.3} }

/* Repair wave */
@keyframes repairPulse { from{transform:scale(.5);opacity:.9} to{transform:scale(2.5);opacity:0} }

/* Data ticker */
.ticker-track { animation: ticker 18s linear infinite; }
@keyframes ticker { from{transform:translateX(0)} to{transform:translateX(-50%)} }
`;

// ── Config ────────────────────────────────────────────────────────────────────
const API = 'http://localhost:5010';
const SERVICES = ['payment','order','inventory','frontend','notification'];
const SVC_LABEL: Record<string,string> = {
  payment:'Oxygen System', order:'Resource Allocator',
  inventory:'Storage Bay', frontend:'Command Center', notification:'Earth Comms',
};
const SVC_MOD: Record<string,string> = {
  payment:'oxygen', order:'resources', inventory:'storage', frontend:'command', notification:'comms',
};
const MOD_SVC: Record<string,string> = Object.fromEntries(Object.entries(SVC_MOD).map(([k,v])=>[v,k]));
const MOD_ICONS: Record<string,string> = { oxygen:'💨', resources:'⚙️', storage:'🏗', command:'🖥', comms:'📡' };
const MOD_LABELS: Record<string,string> = { oxygen:'Oxygen System', resources:'Resource Allocator', storage:'Storage Bay', command:'Command Center', comms:'Earth Comms' };
const MODULES = ['command','oxygen','comms','resources','storage'];
const SEV_COL: Record<string,string> = { NORMAL:'#00ff88', WARNING:'#ff8c00', CRITICAL:'#ff2222' };
const CHAOS_LABELS: Record<string,string> = { db_timeout:'Life Support Failure', latency:'Signal Degradation', crash:'Catastrophic Breach', random:'Unknown System Breach' };

// What-if analysis data
const PROPAGATION: Record<string,string[]> = {
  payment:      ['payment','order','inventory','frontend','notification'],
  order:        ['order','inventory','frontend','notification'],
  inventory:    ['inventory','frontend','notification'],
  frontend:     ['frontend','notification'],
  notification: ['notification'],
};
const BLAST_LABEL: Record<number,{text:string;col:string}> = {
  100: {text:'Catastrophic — Full system degradation expected', col:'#ff2222'},
   80: {text:'Critical — Major service disruption',            col:'#ff4444'},
   60: {text:'High — Multiple modules impacted',               col:'#ff8c00'},
   40: {text:'Moderate — Limited cascade expected',            col:'#fbbf24'},
   20: {text:'Low — Contained to single module',               col:'#00ff88'},
};
const REMEDIATION: Record<string,string> = {
  db_timeout: 'rollout-restart + db-connection-pool flush',
  latency:    'circuit-breaker-enable + rate-limit-inject',
  crash:      'emergency-replica-scale + health-check-force',
  random:     'isolation-forest-scan + adaptive-remediation',
};

type Act = 'DORMANT'|'BREACH'|'ANALYZING'|'PROTOCOL'|'RESTORED';
const ACTS: {id:Act;label:string;color:string;icon:string;desc:string}[] = [
  {id:'DORMANT',  label:'DORMANT',   color:'#00ff88',icon:'🟢',desc:'Colony nominal'},
  {id:'BREACH',   label:'BREACH',    color:'#ff2222',icon:'🔴',desc:'System breach detected'},
  {id:'ANALYZING',label:'ANALYZING', color:'#ff8c00',icon:'🟡',desc:'Failure Analysis AI active'},
  {id:'PROTOCOL', label:'PROTOCOL',  color:'#818cf8',icon:'⚡',desc:'Survival Protocol active'},
  {id:'RESTORED', label:'RESTORED',  color:'#22d3ee',icon:'✅',desc:'Colony restored'},
];

interface SvcInfo { score:number; severity:string; is_anomaly:boolean; confidence:number; }
interface DashData {
  anomaly_scores: Record<string,SvcInfo>;
  metrics_raw: Record<string,{cpu:number;latency_ms:number;error_rate:number}>;
  root_cause?: {service:string;severity:string;score:number;affected:string[]}|null;
  last_action?: {action:string;service:string;recovered:boolean;recovery_time:number;ts:string};
  report?: string;
  mttr_history?: {service:string;action:string;recovery_time:number;recovered:boolean}[];
  host_metrics?: {cpu:number;mem:number};
}

function getAct(d: DashData|null): Act {
  if (!d) return 'DORMANT';
  const hasCrit = Object.values(d.anomaly_scores||{}).some(s=>s.severity==='CRITICAL');
  const hasWarn = Object.values(d.anomaly_scores||{}).some(s=>s.severity==='WARNING');
  const recovered = d.last_action?.recovered;
  if (recovered && !hasCrit) return 'RESTORED';
  if (d.last_action?.action && !recovered) return 'PROTOCOL';
  if (d.root_cause) return 'ANALYZING';
  if (hasCrit||hasWarn) return 'BREACH';
  return 'DORMANT';
}

function buildNarrative(d: DashData|null, act: Act): string {
  const ts = new Date().toLocaleTimeString();
  if (!d) return `[${ts}] COLONY-AI BOOT SEQUENCE — awaiting telemetry...`;
  switch(act){
    case 'DORMANT': return `[${ts}] ◉ ALL SYSTEMS NOMINAL — Isolation Forest idle. 5 modules green. Passive watch mode.`;
    case 'BREACH':{
      const mods = Object.entries(d.anomaly_scores||{}).filter(([,v])=>v.severity!=='NORMAL').map(([k])=>SVC_LABEL[k]||k);
      return `[${ts}] ⚠ SYSTEM BREACH — ${mods.join(' / ')} COMPROMISED. Cascade risk: HIGH. No human intervention. AI engaging.`;
    }
    case 'ANALYZING': return `[${ts}] 🔍 FAILURE ANALYSIS AI ACTIVE — Root cause isolated: ${SVC_LABEL[d.root_cause?.service||'']||d.root_cause?.service}. ${(d.root_cause?.score||0)*100|0}% confidence. Calculating survival protocol...`;
    case 'PROTOCOL':{
      const p = d.last_action?.action==='restart'?'AUTO-REPAIR DRONES DEPLOYED':d.last_action?.action==='scale'?'EMERGENCY REPLICAS SPUN UP':'CACHE RECOVERY INITIATED';
      return `[${ts}] ⚡ ${p} — ${SVC_LABEL[d.last_action?.service||'']||d.last_action?.service}. FULLY AUTONOMOUS. No crew action required.`;
    }
    case 'RESTORED': return `[${ts}] ✅ ${SVC_LABEL[d.last_action?.service||'']||d.last_action?.service} RESTORED in ${d.last_action?.recovery_time?.toFixed(1)}s. Drones returned. Colony status: NOMINAL.`;
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Sparkline({ data, color, h=24, id=0 }:{data:number[];color:string;h?:number;id?:number}) {
  if (!data.length) return null;
  const d = data.every(v=>Math.abs(v)<.5)?data.map((_,i)=>.8+Math.sin(i*.5+id)*.4):data;
  const mx=Math.max(...d,.1),mn=Math.min(...d);const rng=mx-mn||.1;
  const w=100/(d.length-1);
  const pts=d.map((v,i)=>`${i*w},${h-((v-mn)/rng)*(h-4)-2}`).join(' ');
  const gid=`sp${color.replace('#','')}${id}`;
  return (
    <svg viewBox={`0 0 100 ${h}`} className="w-full" preserveAspectRatio="none" style={{height:h}}>
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity=".35"/>
        <stop offset="100%" stopColor={color} stopOpacity=".02"/>
      </linearGradient></defs>
      <polygon points={`0,${h} ${pts} 100,${h}`} fill={`url(#${gid})`}/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8"/>
    </svg>
  );
}

function SectionLabel({children}:{children:React.ReactNode}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="h-px flex-1" style={{background:'linear-gradient(90deg,transparent,rgba(0,200,255,.25))'}}/>
      <span className="text-[9px] hud-font tracking-[.35em] text-slate-400 uppercase">{children}</span>
      <div className="h-px flex-1" style={{background:'linear-gradient(90deg,rgba(0,200,255,.25),transparent)'}}/>
    </div>
  );
}

function HUDPanel({children,className='',breach=false,style={}}:{children:React.ReactNode;className?:string;breach?:boolean;style?:React.CSSProperties}) {
  return (
    <div className={`hud-panel hud-bracket rounded-2xl ${breach?'breach-panel':''} ${className}`}
      style={breach?{background:'rgba(20,0,0,.85)',borderColor:'rgba(255,30,30,.25)',...style}:{...style}}>
      {children}
    </div>
  );
}

function NarrativeFeed({lines}:{lines:string[]}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(()=>{ if(ref.current) ref.current.scrollTop=ref.current.scrollHeight; },[lines]);
  return (
    <div ref={ref} className="overflow-y-auto space-y-1.5 hud-font text-[13px]" style={{maxHeight:'160px'}}>
      {lines.map((l,i)=>(
        <div key={i} className="teletype-line font-semibold" style={{
          color: l.includes('✅')?'#00ff88':l.includes('⚡')?'#818cf8':l.includes('⚠')||l.includes('BREACH')?'#ff2222':l.includes('🔍')?'#ff8c00':'#9ab8c8',
        }}>{l}</div>
      ))}
    </div>
  );
}

function ActBar({current}:{current:Act}) {
  const idx=ACTS.findIndex(a=>a.id===current);
  return (
    <div className="flex items-center justify-center gap-0 flex-wrap">
      {ACTS.map((a,i)=>{
        const active=a.id===current, past=i<idx;
        return (
          <React.Fragment key={a.id}>
            <motion.div className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl"
              animate={{background:active?`${a.color}12`:'transparent'}}>
              <span className="text-xs">{a.icon}</span>
              <span className="hud-font text-[9px] tracking-widest uppercase" style={{color:active?a.color:past?'#7ab8cc':'#5a8a9a'}}>{a.label}</span>
              {active&&<motion.div className="w-1 h-1 rounded-full mt-0.5" style={{background:a.color}}
                animate={{scale:[1,1.5,1],opacity:[1,.4,1]}} transition={{repeat:Infinity,duration:.9}}/>}
            </motion.div>
            {i<ACTS.length-1&&<div className="w-4 h-px" style={{background:i<idx?'#7ab8cc':'#060f1a'}}/>}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function ModuleCard({mod,info,metrics,isRoot}:{mod:string;info:SvcInfo;metrics?:{cpu:number;latency_ms:number;error_rate:number};isRoot:boolean}) {
  const s=info?.severity||'NORMAL', col=SEV_COL[s];
  const crit=s==='CRITICAL', warn=s==='WARNING';
  return (
    <HUDPanel breach={crit} className="p-4 relative overflow-hidden" >
      {/* Animated threat bar */}
      {crit&&<motion.div className="absolute inset-0 rounded-2xl opacity-10"
        style={{background:'#ff2222'}} animate={{opacity:[.07,.15,.07]}} transition={{repeat:Infinity,duration:.8}}/>}
      
      <div className="flex items-start justify-between mb-2 relative z-10">
        <div className="flex items-center gap-2">
          <span className="text-lg">{MOD_ICONS[mod]}</span>
          <div>
            <div className="hud-font text-xs uppercase tracking-wider text-white font-bold">{MOD_LABELS[mod]}</div>
            {isRoot&&<div className="hud-font text-[9px] tracking-wider" style={{color:'#ff2222'}}>◉ BREACH ORIGIN</div>}
          </div>
        </div>
        {crit&&<motion.div animate={{opacity:[1,.2,1]}} transition={{repeat:Infinity,duration:.6}}
          className="hud-font text-[9px] px-2 py-0.5 rounded-full"
          style={{background:'rgba(255,34,34,.15)',color:'#ff2222',border:'1px solid rgba(255,34,34,.4)'}}>⚠ CRITICAL</motion.div>}
        {warn&&<span className="hud-font text-[9px] px-2 py-0.5 rounded-full"
          style={{background:'rgba(255,140,0,.12)',color:'#ff8c00',border:'1px solid rgba(255,140,0,.3)'}}>⚡ WARNING</span>}
      </div>

      <div className="relative z-10 mb-2">
        <div className="flex justify-between hud-font text-[10px] mb-1">
          <span style={{color:'#7ab8cc'}}>THREAT LVL</span>
          <span style={{color:col}}>{((info?.score||0)*100).toFixed(1)}%</span>
        </div>
        <div className="h-1 rounded-full overflow-hidden" style={{background:'rgba(255,255,255,.05)'}}>
          <motion.div className="h-full rounded-full" style={{background:`linear-gradient(90deg,${col}80,${col})`}}
            animate={{width:`${Math.min(100,(info?.score||0)*100)}%`}} transition={{duration:.5}}/>
        </div>
      </div>

      {metrics&&(
        <div className="grid grid-cols-3 gap-1 relative z-10">
          {[{l:'POWER',v:`${(metrics.cpu||0).toFixed(1)}%`},{l:'DELAY',v:`${(metrics.latency_ms||0).toFixed(0)}ms`},{l:'ERR%',v:`${(metrics.error_rate||0).toFixed(1)}%`}].map(m=>(
            <div key={m.l} className="text-center py-1.5 rounded-lg border border-white/5" style={{background:'rgba(255,255,255,.02)'}}>
              <div className="hud-font text-[9px] font-bold tracking-widest" style={{color:'#7ab8cc'}}>{m.l}</div>
              <div className="hud-font text-sm font-bold" style={{color:'#ffffff'}}>{m.v}</div>
            </div>
          ))}
        </div>
      )}
    </HUDPanel>
  );
}

function BreachBanner({service,act}:{service?:string;act:Act}) {
  const isCrit = act==='BREACH'||act==='ANALYZING'||act==='PROTOCOL';
  return (
    <AnimatePresence>
      {isCrit&&(
        <motion.div key="breach-banner"
          initial={{y:-80,opacity:0}} animate={{y:0,opacity:1}} exit={{y:-80,opacity:0}}
          className="sticky top-16 left-0 right-0 z-40 mx-6 my-2 rounded-2xl overflow-hidden"
          style={{background:'rgba(20,0,0,.9)',border:'1px solid rgba(255,30,30,.5)'}}>
          <div className="flex items-center justify-center gap-4 py-2.5">
            <motion.span className="text-lg" animate={{scale:[1,1.3,1]}} transition={{repeat:Infinity,duration:.6}}>⚠️</motion.span>
            <span className="hud-font text-sm tracking-[.25em] uppercase" style={{color:'#ff2222'}}>
              {act==='PROTOCOL'?'AUTO-REPAIR PROTOCOL ACTIVE':act==='ANALYZING'?'FAILURE ANALYSIS AI — ISOLATING ROOT CAUSE':'SYSTEM BREACH — COLONY AT RISK'}
            </span>
            {service&&<span className="hud-font text-sm" style={{color:'#ff6666'}}>[{SVC_LABEL[service]?.toUpperCase()||service.toUpperCase()}]</span>}
            <motion.span className="text-lg" animate={{scale:[1,1.3,1]}} transition={{repeat:Infinity,duration:.6,delay:.3}}>⚠️</motion.span>
          </div>
          <motion.div className="absolute bottom-0 left-0 h-0.5 bg-red-500"
            animate={{width:['0%','100%','0%']}} transition={{repeat:Infinity,duration:1.5,ease:'easeInOut'}}/>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function AiReport({text}:{text:string}) {
  const html = text
    .replace(/\b(payment|order|inventory|frontend|notification|Oxygen System|Resource Allocator|Storage Bay|Command Center|Earth Comms)\b/gi,'<span style="color:#818cf8;font-weight:700">$1</span>')
    .replace(/\b(\d+\.?\d*)(ms|s|%|MB|GB)\b/g,'<span style="color:#22d3ee;font-family:monospace">$1$2</span>')
    .replace(/\b(CRITICAL|WARNING|NORMAL)\b/g,m=>{const c=m==='CRITICAL'?'#ff2222':m==='WARNING'?'#ff8c00':'#00ff88';return `<span style="color:${c};font-weight:700">${m}</span>`;})
    .replace(/\b(restart|scale|cache.recovery|Survival Protocol|Auto-Repair)\b/gi,'<span style="color:#ff8c00;font-weight:700">$1</span>');
  return <div className="text-slate-400 leading-relaxed text-sm" dangerouslySetInnerHTML={{__html:html}}/>;
}

function MetricRow({label,value,max,color,unit}:{label:string;value:number;max:number;color:string;unit:string}) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-[4.5rem] hud-font text-[10px] uppercase tracking-wider text-slate-400 truncate">{label}</div>
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{background:'rgba(255,255,255,.04)'}}>
        <motion.div className="h-full rounded-full" style={{background:`linear-gradient(90deg,${color}70,${color})`}}
          animate={{width:`${Math.min(100,(value/max)*100)}%`}} transition={{duration:.5}}/>
      </div>
      <div className="w-12 hud-font text-[10px] text-right" style={{color}}>{value.toFixed(1)}{unit}</div>
    </div>
  );
}

// ── Real-time clock ───────────────────────────────────────────────────────────
function Clock() {
  const [t,setT]=useState('');
  useEffect(()=>{ const id=setInterval(()=>setT(new Date().toUTCString().slice(17,25)+' UTC'),1000); return()=>clearInterval(id); },[]);
  return <span className="hud-font text-[10px] text-slate-400">{t}</span>;
}

// ── GPU / AI-Load simulator ────────────────────────────────────────────────────
function useGpuSim(active: boolean) {
  const [val,setVal]=useState(14);
  const [hist,setHist]=useState<number[]>(Array.from({length:30},(_,i)=>14+Math.sin(i*.45)*6));
  const base=useRef(14);
  useEffect(()=>{
    base.current=active?72:14;
    const id=setInterval(()=>{
      const noise=(Math.random()-.5)*10;
      const drift=active?Math.sin(Date.now()/1600)*14:Math.sin(Date.now()/3200)*5;
      const v=Math.max(3,Math.min(98,base.current+noise+drift));
      base.current=base.current*.92+v*.08;
      const rounded=Math.round(base.current);
      setVal(rounded);
      setHist(p=>[...p.slice(1),rounded]);
    },400);
    return()=>clearInterval(id);
  },[active]);
  return {val,hist};
}

// ── What-If Impact Analysis Modal ─────────────────────────────────────────────
// Match screenshot: blast radius bar, propagation chain, metrics, remediation plan, execute button
interface WhatIfCfg { service: string; chaosType: string; isOxygen?: boolean; }

function WhatIfModal({ cfg, mttr, onExecute, onCancel }:
  { cfg: WhatIfCfg; mttr: number; onExecute: ()=>void; onCancel: ()=>void; }) {
  const chain = PROPAGATION[cfg.service] || [cfg.service];
  const blastPct = Math.round((chain.length / 5) * 100);
  const blastInfo = BLAST_LABEL[blastPct] || BLAST_LABEL[100];
  const resolved = cfg.chaosType === 'random'
    ? ['db_timeout','latency','crash'][Math.floor(Math.random()*3)]
    : cfg.chaosType;
  const chaosLabel = CHAOS_LABELS[resolved] || resolved;
  const remedy = cfg.isOxygen
    ? 'rollout-restart + db-connection-pool flush + emergency-replica-scale'
    : (REMEDIATION[resolved] || REMEDIATION.random);

  return (
    <motion.div className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      style={{background:'rgba(0,0,0,.75)',backdropFilter:'blur(8px)'}}>
      <motion.div className="w-full max-w-lg rounded-3xl overflow-hidden"
        initial={{scale:.9,y:30}} animate={{scale:1,y:0}} exit={{scale:.9,y:30}}
        transition={{type:'spring',damping:22,stiffness:280}}
        style={{background:'rgba(4,8,28,.97)',border:'1px solid rgba(0,200,255,.15)',boxShadow:'0 0 60px rgba(0,0,0,.8),0 0 30px rgba(255,30,30,.1)'}}>

        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="hud-font text-[10px] tracking-widest px-2 py-0.5 rounded-full" style={{background:'rgba(255,255,255,.06)',color:'#94a3b8'}}>SIMULATION</span>
            </div>
            <h2 className="hud-font text-2xl font-black text-white tracking-wider">What-If Impact Analysis</h2>
            <p className="text-sm mt-1" style={{color:'#94a3b8'}}>
              Simulating{' '}
              <span style={{color:'#818cf8',fontWeight:700}}>{chaosLabel}</span>
              {' '}on{' '}
              <span className="hud-font font-bold text-white">{MOD_ICONS[SVC_MOD[cfg.service]]} {SVC_LABEL[cfg.service]}</span>
            </p>
          </div>
          <button onClick={onCancel} className="p-2 rounded-xl transition-colors hover:bg-white/5">
            <X size={18} style={{color:'#475569'}}/>
          </button>
        </div>

        <div className="px-6 pb-6 space-y-5">
          {/* Blast radius */}
          <div className="rounded-2xl p-4" style={{background:'rgba(255,30,30,.07)',border:'1px solid rgba(255,30,30,.18)'}}>
            <div className="flex items-center justify-between mb-3">
              <span className="hud-font text-sm tracking-wider text-white">Estimated Blast Radius</span>
              <motion.span className="hud-font text-2xl font-black" style={{color:blastInfo.col}}
                animate={blastPct>=80?{opacity:[1,.5,1]}:{}} transition={{repeat:Infinity,duration:.8}}>
                {blastPct}%
              </motion.span>
            </div>
            <div className="h-3 rounded-full overflow-hidden mb-2" style={{background:'rgba(255,255,255,.06)'}}>
              <motion.div className="h-full rounded-full"
                style={{background:`linear-gradient(90deg,${blastInfo.col}aa,${blastInfo.col})`}}
                initial={{width:0}} animate={{width:`${blastPct}%`}} transition={{duration:.7,ease:'easeOut'}}/>
            </div>
            <p className="hud-font text-[11px]" style={{color:blastInfo.col}}>🚨 {blastInfo.text}</p>
          </div>

          {/* Propagation chain */}
          <div>
            <div className="hud-font text-[9px] tracking-[.35em] uppercase mb-3" style={{color:'#7ab8cc'}}>Predicted Failure Propagation Chain</div>
            <div className="flex items-center flex-wrap gap-2">
              {chain.map((svc, i) => (
                <React.Fragment key={svc}>
                  <motion.div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hud-font text-sm font-bold"
                    initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} transition={{delay:i*.1}}
                    style={i===0
                      ? {background:'rgba(255,30,30,.15)',border:'1px solid rgba(255,30,30,.5)',color:'#ff6666'}
                      : {background:'rgba(0,200,255,.07)',border:'1px solid rgba(0,200,255,.18)',color:'#94a3b8'}}>
                    <span>{MOD_ICONS[SVC_MOD[svc]]||'⚙'}</span>
                    <span>{SVC_LABEL[svc]}</span>
                    {i===0&&<span className="text-[8px] tracking-widest ml-1 px-1.5 py-0.5 rounded" style={{background:'rgba(255,30,30,.25)',color:'#ff4444'}}>ORIGIN</span>}
                  </motion.div>
                  {i<chain.length-1&&<span style={{color:'#7ab8cc',fontSize:'14px'}}>→</span>}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* 3 metric boxes */}
          <div className="grid grid-cols-3 gap-3">
            {[
              {icon:'⏱',val:`${(mttr||1.5).toFixed(1)}s`, sub:'Avg AI recovery time', sub2:'Historical MTTR', col:'#22d3ee'},
              {icon:'🎯',val:`${chain.length} / 5`,         sub:'Direct + cascaded',   sub2:'Services at Risk',  col:'#ff2222'},
              {icon:'🤖',val:'100%',                        sub:'Runbooks loaded',     sub2:'AI Readiness',      col:'#00ff88'},
            ].map(m=>(
              <div key={m.sub} className="rounded-2xl p-4 text-center" style={{background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.06)'}}>
                <div className="text-2xl mb-2">{m.icon}</div>
                <div className="hud-font text-xl font-black" style={{color:m.col}}>{m.val}</div>
                <div className="hud-font text-[10px] mt-1" style={{color:'#475569'}}>{m.sub}</div>
                <div className="hud-font text-[9px]" style={{color:'#7ab8cc'}}>{m.sub2}</div>
              </div>
            ))}
          </div>

          {/* Remediation plan */}
          <div className="rounded-2xl p-4" style={{background:'rgba(0,0,0,.4)',border:'1px solid rgba(255,255,255,.05)'}}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm">🤖</span>
              <span className="hud-font text-[10px] tracking-widest uppercase" style={{color:'#ff8c00'}}>AI Remediation Plan</span>
            </div>
            <code className="hud-font text-sm" style={{color:'#e2e8f0'}}>{remedy}</code>
          </div>

          {/* Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <motion.button onClick={onCancel} whileHover={{scale:1.02}} whileTap={{scale:.98}}
              className="hud-font py-3 rounded-2xl text-sm font-bold"
              style={{background:'rgba(255,255,255,.06)',color:'#94a3b8',border:'1px solid rgba(255,255,255,.08)'}}>
              Cancel Simulation
            </motion.button>
            <motion.button onClick={onExecute} whileHover={{scale:1.02}} whileTap={{scale:.98}}
              className="hud-font py-3 rounded-2xl text-sm font-black text-white flex items-center justify-center gap-2"
              style={{background:'linear-gradient(135deg,#6d28d9,#9333ea,#ec4899)',boxShadow:'0 0 20px rgba(147,51,234,.4)'}}>
              <Zap size={14}/> Execute Chaos in Production
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function DashboardPage() {
  const [data,setData]=useState<DashData|null>(null);
  const [connected,setConnected]=useState(false);
  const [actionHistory,setActionHistory]=useState<NonNullable<DashData['last_action']>[]>([]);
  const [injectSvc,setInjectSvc]=useState('payment');
  const [injectType,setInjectType]=useState('random');
  const [toast,setToast]=useState('');
  const [healing,setHealing]=useState(false);
  const [selectedMod,setSelectedMod]=useState<string|null>(null);
  const [shaking,setShaking]=useState(false);
  const [whatIfModal,setWhatIfModal]=useState<WhatIfCfg|null>(null);
  const [narrative,setNarrativeLines]=useState<string[]>([
    '[00:00:00] COLONY-AI BOOT — Autonomous Survival System v2.0',
    '[00:00:01] Isolation Forest model loaded. Threat matrix: CLEAN.',
    '[00:00:02] 5 life-support modules connected. Telemetry live.',
    '[00:00:03] Auto-repair drones: STANDBY. Colony status: NOMINAL.',
  ]);
  const [cpuH,setCpuH]=useState<Record<string,number[]>>(Object.fromEntries(SERVICES.map(s=>[s,Array.from({length:22},()=>0.5)])));
  const [latH,setLatH]=useState<Record<string,number[]>>(Object.fromEntries(SERVICES.map(s=>[s,Array.from({length:22},()=>1)])));
  const lastAct=useRef<Act>('DORMANT');
  const toastRef=useRef<ReturnType<typeof setTimeout>>();

  const act=getAct(data);
  const actObj=ACTS.find(a=>a.id===act)!;
  const scores=data?.anomaly_scores||{};
  const metrics=data?.metrics_raw||{};
  const rootSvc=data?.root_cause?.service;
  const hasCrit=Object.values(scores).some(s=>s.severity==='CRITICAL');
  const critMod=rootSvc?SVC_MOD[rootSvc]:Object.entries(scores).find(([,v])=>v.severity==='CRITICAL')?.[0];

  // Screen shake on new breach
  useEffect(()=>{
    if(act==='BREACH'&&lastAct.current!=='BREACH'){setShaking(true);setTimeout(()=>setShaking(false),500);}
    if(act!==lastAct.current){setNarrativeLines(p=>[...p.slice(-22),buildNarrative(data,act)]);}
    lastAct.current=act;
  },[act]); // eslint-disable-line

  const showToast=(m:string)=>{ setToast(m); if(toastRef.current)clearTimeout(toastRef.current); toastRef.current=setTimeout(()=>setToast(''),3500); };

  const poll = useCallback(async()=>{
    try{
      const r=await fetch(`${API}/status`,{signal:AbortSignal.timeout(3000)});
      if(!r.ok)throw new Error();
      const d=await r.json(); setData(d); setConnected(true);
      if(d.metrics_raw){
        setCpuH(p=>{const n={...p};SERVICES.forEach(s=>{n[s]=[...(p[s]||[]).slice(1),d.metrics_raw[s]?.cpu??0];});return n;});
        setLatH(p=>{const n={...p};SERVICES.forEach(s=>{n[s]=[...(p[s]||[]).slice(1),d.metrics_raw[s]?.latency_ms??0];});return n;});
      }
      if(d.last_action?.action){
        setActionHistory(prev=>{
          const key=`${d.last_action.ts}-${d.last_action.service}`;
          if(prev.find(a=>`${a.ts}-${a.service}`===key))return prev;
          return [d.last_action,...prev].slice(0,10);
        });
      }
    }catch{setConnected(false);}
  },[]);

  useEffect(()=>{ poll(); const id=setInterval(poll,3000); return()=>clearInterval(id); },[poll]);

  const inject=async(svc=injectSvc,type=injectType)=>{
    const resolved=type==='random'?['db_timeout','latency','crash'][Math.floor(Math.random()*3)]:type;
    try{
      await fetch(`${API}/inject`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({service:svc,type:resolved})});
      const col=CHAOS_LABELS[resolved]||resolved;
      setNarrativeLines(p=>[...p.slice(-22),`[${new Date().toLocaleTimeString()}] 💥 ${(SVC_LABEL[svc]||svc).toUpperCase()}: ${col.toUpperCase()} — SENTINEL ENGAGED.`]);
      showToast(`💥 ${col} — ${SVC_LABEL[svc]||svc}`);
    }catch{showToast('❌ Colony AI offline');}
  };

  const oxygenFail=async()=>{
    const seq=[
      {svc:'payment',  type:'db_timeout', delay:0,    label:'💨 OXYGEN SYSTEM — LIFE SUPPORT FAILURE'},
      {svc:'order',    type:'latency',    delay:1200,  label:'⚙️  RESOURCE ALLOCATOR — SUPPLY CHAIN DEGRADED'},
      {svc:'inventory',type:'latency',   delay:2400,  label:'🏗  STORAGE BAY — INVENTORY LOSS DETECTED'},
      {svc:'frontend', type:'crash',     delay:3800,  label:'🖥  COMMAND CENTER — EMERGENCY SHUTDOWN'},
      {svc:'notification',type:'crash',  delay:5200,  label:'📡 EARTH COMMS — SIGNAL LOST'},
    ];
    setNarrativeLines(p=>[...p.slice(-22),
      `[${new Date().toLocaleTimeString()}] ☠️  OXYGEN SYSTEM FAILURE — CASCADE BREACH INITIATED`,
      `[${new Date().toLocaleTimeString()}] ⚠  In space, failure is death. No human intervention possible.`,
    ]);
    setShaking(true); setTimeout(()=>setShaking(false),500);
    for (const s of seq) {
      await new Promise(r=>setTimeout(r,s.delay));
      try {
        await fetch(`${API}/inject`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({service:s.svc,type:s.type})});
      } catch {}
      setNarrativeLines(p=>[...p.slice(-22),`[${new Date().toLocaleTimeString()}] 🔴 ${s.label}`]);
      showToast(`🔴 ${s.label}`);
    }
    setNarrativeLines(p=>[...p.slice(-22),`[${new Date().toLocaleTimeString()}] ⚡ COLONY AI ENGAGED — AUTONOMOUS SURVIVAL PROTOCOL RUNNING...`]);
  };

  const healAll=async()=>{
    setHealing(true);
    try{
      await fetch(`${API}/heal`,{method:'POST'});
      setNarrativeLines(p=>[...p.slice(-22),`[${new Date().toLocaleTimeString()}] 🛡 EMERGENCY RESTORATION — ALL MODULES.`]);
      showToast('🛡 Colony-wide restoration initiated...');
      setTimeout(poll,800); setTimeout(poll,2200);
    }catch{showToast('❌ Colony AI offline');}
    finally{setTimeout(()=>setHealing(false),2500);}
  };

  const critCount=Object.values(scores).filter(s=>s.severity==='CRITICAL').length;
  const lastMttr=data?.mttr_history?.at(-1)?.recovery_time;

  // ── Real host CPU from psutil via /status ──────────────────────────────
  const [gpuHist,setGpuHist]=useState<number[]>(Array.from({length:30},()=>5));
  const gpuVal = data?.host_metrics?.cpu ?? 5;
  useEffect(()=>{
    setGpuHist(p=>[...p.slice(1), gpuVal]);
  },[gpuVal]);
  // ──────────────────────────────────────────────────────────────────────

  return (
    <div className={shaking?'shaking':''} style={{position:'relative',minHeight:'100vh',background:'#000814',overflowX:'hidden'}}>
      <style dangerouslySetInnerHTML={{__html:CSS}}/>

      {/* Scan lines (whole page) */}
      <div className="scan-lines fixed inset-0 z-[9999]"/>

      {/* Breach aura border */}
      {hasCrit&&<div className="breach-aura fixed inset-0 z-[9998] rounded-none pointer-events-none"/>}

      {/* Animated stars background via pseudo-CSS */}
      <div style={{position:'fixed',inset:0,zIndex:0,
        backgroundImage:`radial-gradient(1px 1px at 8% 12%,rgba(255,255,255,.7) 0%,transparent 100%),
          radial-gradient(1px 1px at 22% 45%,rgba(255,255,255,.5) 0%,transparent 100%),
          radial-gradient(1px 1px at 38% 8%,rgba(255,255,255,.8) 0%,transparent 100%),
          radial-gradient(1px 1px at 55% 72%,rgba(255,255,255,.6) 0%,transparent 100%),
          radial-gradient(1px 1px at 70% 28%,rgba(255,255,255,.7) 0%,transparent 100%),
          radial-gradient(1px 1px at 85% 55%,rgba(255,255,255,.5) 0%,transparent 100%),
          radial-gradient(1px 1px at 92% 88%,rgba(255,255,255,.6) 0%,transparent 100%),
          radial-gradient(1px 1px at 15% 78%,rgba(255,255,255,.4) 0%,transparent 100%),
          radial-gradient(1px 1px at 48% 35%,rgba(255,255,255,.65) 0%,transparent 100%),
          radial-gradient(1px 1px at 63% 90%,rgba(255,255,255,.55) 0%,transparent 100%)`,
        background:'#000814',
      }}/>

      {/* Breach glow from below */}
      {hasCrit&&<div style={{position:'fixed',bottom:0,left:0,right:0,height:'35%',zIndex:1,
        background:'radial-gradient(ellipse 100% 80% at 50% 110%,rgba(255,30,30,.09) 0%,transparent 70%)',
        transition:'opacity .8s',pointerEvents:'none'}}/>}

      {/* Nominal colony glow */}
      {!hasCrit&&<div style={{position:'fixed',top:0,left:'20%',right:'20%',height:'30%',zIndex:1,
        background:'radial-gradient(ellipse at 50% 0%,rgba(0,200,255,.05) 0%,transparent 70%)',
        transition:'opacity .8s',pointerEvents:'none'}}/>}

      <div style={{position:'relative',zIndex:2}}>
        {/* ── HEADER ─────────────────────────────────────────────────── */}
        <header style={{position:'sticky',top:0,zIndex:50,background:'rgba(0,8,20,.95)',backdropFilter:'blur(24px)',borderBottom:'1px solid rgba(0,200,255,.08)'}}>
          <div className="max-w-screen-2xl mx-auto px-6 py-3">
            <div className="flex items-center gap-4 flex-wrap">
              <Link href="/" className="flex items-center gap-2 mr-2 flex-shrink-0">
                <ArrowLeft size={14} style={{color:'#7ab8cc'}}/>
                <motion.div animate={{color:actObj.color}} className="flex items-center gap-2">
                  <motion.div className="w-2.5 h-2.5 rounded-full" style={{background:actObj.color}}
                    animate={{scale:[1,1.4,1],opacity:[1,.5,1]}} transition={{repeat:Infinity,duration:1.2}}/>
                  <span className="hud-font text-xl tracking-widest font-bold text-white">SENTINEL<span style={{color:'rgba(0,200,255,.5)'}}>://</span>MARS</span>
                </motion.div>
              </Link>

              <div className="h-5 w-px bg-white/5"/>
              <span className="hud-font text-[9px] tracking-widest uppercase" style={{color:actObj.color}}>{actObj.desc}</span>

              <div className="flex items-center gap-1.5">
                {connected
                  ?<><div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"/><span className="hud-font text-[10px] text-green-400">TELEMETRY LIVE</span></>
                  :<><WifiOff size={11} style={{color:'#ff2222'}}/><span className="hud-font text-[10px]" style={{color:'#ff2222'}}>LINK LOST</span></>}
              </div>

              <div className="flex gap-2 flex-wrap">
                {[
                  {l:'BREACHES',v:String(critCount),c:critCount>0?'#ff2222':'#00ff88'},
                  {l:'MTTR',v:lastMttr?`${lastMttr.toFixed(1)}s`:'–',c:'#22d3ee'},
                  {l:'MODULES',v:'5 ONLINE',c:'#818cf8'},
                  {l:'AI LOAD',v:`${gpuVal}%`,c:gpuVal>75?'#ff2222':gpuVal>45?'#ff8c00':'#00ff88'},
                ].map(s=>(
                  <div key={s.l} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/5" style={{background:'rgba(255,255,255,.02)'}}>
                    <span className="hud-font text-[9px] tracking-widest" style={{color:'#7ab8cc'}}>{s.l}</span>
                    <motion.span className="hud-font text-xs font-bold" style={{color:s.c}}
                      animate={s.l==='AI LOAD'&&gpuVal>75?{opacity:[1,.5,1]}:{}} transition={{repeat:Infinity,duration:.6}}>
                      {s.v}
                    </motion.span>
                  </div>
                ))}
              </div>

              <div className="ml-auto flex items-center gap-2 flex-wrap">
                <Clock/>
                <div className="h-4 w-px bg-white/5"/>
                <select value={injectSvc} onChange={e=>setInjectSvc(e.target.value)}
                  className="hud-font text-xs rounded-lg px-3 py-2 focus:outline-none"
                  style={{background:'rgba(0,200,255,.04)',border:'1px solid rgba(0,200,255,.12)',color:'#9ab8c8'}}>
                  {SERVICES.map(s=><option key={s} value={s}>{MOD_ICONS[SVC_MOD[s]]} {SVC_LABEL[s]}</option>)}
                </select>
                <select value={injectType} onChange={e=>setInjectType(e.target.value)}
                  className="hud-font text-xs rounded-lg px-3 py-2 focus:outline-none"
                  style={{background:'rgba(0,200,255,.04)',border:'1px solid rgba(0,200,255,.12)',color:'#9ab8c8'}}>
                  <option value="random">🎲 Random</option>
                  <option value="db_timeout">💾 Life Support Fail</option>
                  <option value="latency">📡 Signal Degrade</option>
                  <option value="crash">💥 Module Collapse</option>
                </select>
                <motion.button onClick={()=>setWhatIfModal({service:injectSvc,chaosType:injectType})} whileHover={{scale:1.04}} whileTap={{scale:.97}}
                  className="hud-font px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-2"
                  style={{background:'linear-gradient(135deg,#6d28d9,#9333ea)',boxShadow:'0 0 16px rgba(147,51,234,.35)'}}>
                  <Zap size={12}/>SIMULATE BREACH
                </motion.button>
                <motion.button onClick={healAll} disabled={healing} whileHover={{scale:1.04}} whileTap={{scale:.97}}
                  className="hud-font px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-2 disabled:opacity-50"
                  style={{background:'linear-gradient(135deg,#065f46,#10b981)',boxShadow:'0 0 14px rgba(16,185,129,.25)'}}>
                  {healing?<><motion.span animate={{rotate:360}} transition={{repeat:Infinity,duration:.7,ease:'linear'}}><Shield size={12}/></motion.span>RESTORING...</>:<><Shield size={12}/>RESTORE COLONY</>}
                </motion.button>
              </div>
            </div>
          </div>

          {/* Act pipeline */}
          <div className="border-t max-w-screen-2xl mx-auto px-6 py-2" style={{borderColor:'rgba(0,200,255,.06)'}}>
            <ActBar current={act}/>
          </div>
        </header>

        {/* Breach banner */}
        <BreachBanner service={rootSvc} act={act}/>

        <main className="max-w-screen-2xl mx-auto px-6 py-5 space-y-5">

          {/* ── HERO: 3D + narrative ──────────────────────────── */}
          <section className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            {/* 3D Colony */}
            <HUDPanel className="lg:col-span-3 overflow-hidden" style={{height:'510px'} as React.CSSProperties}>
              {hasCrit&&<div className="hud-bracket"/>}
              <div className="absolute top-4 left-5 z-10 flex items-center gap-2">
                <Radio size={10} style={{color:'rgba(0,200,255,.5)'}}/>
                <span className="hud-font text-[9px] tracking-[.3em] uppercase" style={{color:'rgba(0,200,255,.4)'}}>Mars Colony — Module Network</span>
              </div>
              <div className="absolute top-4 right-5 z-10">
                <AnimatePresence mode="wait">
                  {hasCrit?(
                    <motion.div key="b" initial={{opacity:0,scale:.8}} animate={{opacity:1,scale:1}} exit={{opacity:0}}
                      className="hud-font text-[10px] px-2.5 py-1 rounded-full font-bold"
                      style={{background:'rgba(255,30,30,.15)',border:'1px solid rgba(255,30,30,.5)',color:'#ff2222',animation:'badgePulse .7s ease-in-out infinite'}}>
                      ⚠ SYSTEM BREACH
                    </motion.div>
                  ):(
                    <motion.div key="n" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
                      className="hud-font text-[10px] px-2.5 py-1 rounded-full"
                      style={{background:'rgba(0,255,136,.08)',border:'1px solid rgba(0,255,136,.3)',color:'#00ff88'}}>
                      ◉ COLONY NOMINAL
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <Suspense fallback={
                <div className="w-full h-full flex items-center justify-center flex-col gap-3">
                  <motion.div animate={{rotate:360}} transition={{repeat:Infinity,duration:2.5,ease:'linear'}} className="text-4xl">🪐</motion.div>
                  <span className="hud-font text-[10px] tracking-widest" style={{color:'rgba(0,200,255,.4)'}}>INITIALIZING COLONY RENDERER...</span>
                </div>
              }>
                <MarsColonyGraph anomalyScores={scores} rootCause={data?.root_cause}
                  onModuleClick={mod=>setSelectedMod(prev=>prev===mod?null:mod)}/>
              </Suspense>

              <div className="absolute bottom-4 left-0 right-0 text-center">
                <span className="hud-font text-[9px] tracking-widest" style={{color:'rgba(0,200,255,.2)'}}>DRAG TO ROTATE · CLICK MODULE TO INSPECT</span>
              </div>

              {/* Module popup */}
              <AnimatePresence>
                {selectedMod&&(
                  <motion.div key="popup" initial={{opacity:0,scale:.9}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:.9}}
                    className="absolute bottom-12 left-1/2 -translate-x-1/2 z-20 w-72 rounded-2xl p-4"
                    style={{background:'rgba(0,8,28,.97)',border:`1px solid ${SEV_COL[scores[MOD_SVC[selectedMod]]?.severity||'NORMAL']}40`,backdropFilter:'blur(20px)'}}>
                    <div className="flex justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{MOD_ICONS[selectedMod]}</span>
                        <div>
                          <div className="hud-font text-xs uppercase font-bold text-white">{MOD_LABELS[selectedMod]}</div>
                          <div className="hud-font text-[10px]" style={{color:SEV_COL[scores[MOD_SVC[selectedMod]]?.severity||'NORMAL']}}>{scores[MOD_SVC[selectedMod]]?.severity||'NORMAL'}</div>
                        </div>
                      </div>
                      <button onClick={()=>setSelectedMod(null)}><X size={14} style={{color:'#7ab8cc'}}/></button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[{l:'POWER',v:`${(metrics[MOD_SVC[selectedMod]]?.cpu||0).toFixed(1)}%`},{l:'DELAY',v:`${(metrics[MOD_SVC[selectedMod]]?.latency_ms||0).toFixed(0)}ms`},{l:'ERRORS',v:`${(metrics[MOD_SVC[selectedMod]]?.error_rate||0).toFixed(1)}%`}].map(m=>(
                        <div key={m.l} className="text-center p-2 rounded-xl border border-white/5" style={{background:'rgba(255,255,255,.02)'}}>
                          <div className="hud-font text-[8px] tracking-widest text-slate-400">{m.l}</div>
                          <div className="hud-font text-sm font-bold text-white">{m.v}</div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </HUDPanel>

            {/* Right column */}
            <div className="lg:col-span-2 flex flex-col gap-4">


              {/* Chronicle */}
              <HUDPanel className="flex-1 p-5 flex flex-col min-h-0">
                {/* needed for bottom brackets */}
                <div className="hud-bracket" style={{position:'absolute',inset:-1,borderRadius:'1rem',pointerEvents:'none'}}/>
                <div className="flex items-center gap-2 mb-3">
                  <motion.div className="w-2 h-2 rounded-full bg-green-400" animate={{opacity:[1,.3,1]}} transition={{repeat:Infinity,duration:1.4}}/>
                  <span className="hud-font text-[9px] tracking-[.3em] uppercase" style={{color:'rgba(0,200,255,.4)'}}>Live Colony Chronicle</span>
                </div>
                <NarrativeFeed lines={narrative}/>
              </HUDPanel>

              {/* Failure Analysis AI */}
              <HUDPanel breach={!!data?.root_cause} className="p-5">
                <div className="hud-bracket" style={{position:'absolute',inset:-1,borderRadius:'1rem',pointerEvents:'none'}}/>
                <div className="flex items-center gap-2 mb-3">
                  <Activity size={13} style={{color:'#ff8c00'}}/>
                  <span className="hud-font text-[9px] tracking-[.2em] uppercase" style={{color:'rgba(255,140,0,.6)'}}>Failure Analysis AI</span>
                </div>
                <AnimatePresence mode="wait">
                  {data?.root_cause?(
                    <motion.div key="rca" initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0}}>
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-2xl">{MOD_ICONS[SVC_MOD[data.root_cause.service]]||'⚠'}</span>
                        <div>
                          <div className="hud-font text-sm uppercase tracking-wider font-black text-white">{SVC_LABEL[data.root_cause.service]}</div>
                          <div className="hud-font text-[10px]" style={{color:'#ff2222'}}>◉ BREACH ORIGIN</div>
                        </div>
                        <div className="ml-auto text-right">
                          <div className="hud-font text-2xl font-bold" style={{color:SEV_COL[data.root_cause.severity]}}>{((data.root_cause.score||0)*100).toFixed(0)}%</div>
                          <div className="hud-font text-[8px] tracking-widest text-slate-400">CONFIDENCE</div>
                        </div>
                      </div>
                      {(data.root_cause.affected||[]).length>0&&(
                        <div className="flex flex-wrap gap-1">
                          {data.root_cause.affected.map(s=>(
                            <span key={s} className="hud-font text-[10px] px-2 py-0.5 rounded"
                              style={{background:'rgba(255,34,34,.1)',color:'#ff6666',border:'1px solid rgba(255,34,34,.25)'}}>
                              {SVC_LABEL[s]||s}
                            </span>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  ):(
                    <motion.div key="nominal" className="text-center py-3">
                      <div className="text-lg mb-1">🛡</div>
                      <div className="hud-font text-[10px] tracking-widest text-slate-300">ALL MODULES NOMINAL</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </HUDPanel>
            </div>
          </section>

          {/* ── MODULE STATUS MATRIX ──────────────────────────── */}
          <section>
            <SectionLabel>Colony Module Status</SectionLabel>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {MODULES.map(mod=>(
                <ModuleCard key={mod} mod={mod}
                  info={scores[MOD_SVC[mod]]||{score:0,severity:'NORMAL',is_anomaly:false,confidence:0}}
                  metrics={metrics[MOD_SVC[mod]]} isRoot={rootSvc===MOD_SVC[mod]}/>
              ))}
            </div>
          </section>

          {/* ── TELEMETRY ─────────────────────────────────────── */}
          <section className="grid grid-cols-1 lg:grid-cols-4 gap-5">
            <HUDPanel className="p-5">
              <div className="hud-bracket" style={{position:'absolute',inset:-1,borderRadius:'1rem',pointerEvents:'none'}}/>
              <div className="flex items-center gap-2 mb-4"><Cpu size={12} style={{color:'#ff8c00'}}/><span className="hud-font text-xs uppercase tracking-widest text-white">Power Consumption</span></div>
              <div className="space-y-3">
                {MODULES.map((mod,i)=>{
                  const svc=MOD_SVC[mod]; const col=SEV_COL[scores[svc]?.severity||'NORMAL'];
                  return (<div key={mod}>
                    <MetricRow label={MOD_LABELS[mod].split(' ')[0]} value={metrics[svc]?.cpu??0} max={100} color={col} unit="%"/>
                    <div className="mt-1 opacity-50"><Sparkline data={cpuH[svc]||[]} color={col} h={16} id={i*7}/></div>
                  </div>);
                })}
              </div>
            </HUDPanel>

            <HUDPanel className="p-5">
              <div className="hud-bracket" style={{position:'absolute',inset:-1,borderRadius:'1rem',pointerEvents:'none'}}/>
              <div className="flex items-center gap-2 mb-4"><ClockIcon size={12} style={{color:'#22d3ee'}}/><span className="hud-font text-xs uppercase tracking-widest text-white">Signal Delay</span></div>
              <div className="space-y-3">
                {MODULES.map((mod,i)=>{
                  const svc=MOD_SVC[mod];
                  return (<div key={mod}>
                    <MetricRow label={MOD_LABELS[mod].split(' ')[0]} value={metrics[svc]?.latency_ms??0} max={1000} color="#22d3ee" unit="ms"/>
                    <div className="mt-1 opacity-50"><Sparkline data={latH[svc]||[]} color="#22d3ee" h={16} id={i*7+70}/></div>
                  </div>);
                })}
              </div>
            </HUDPanel>

            {/* ── GPU / AI Compute Load ───────────────────────── */}
            <HUDPanel breach={gpuVal>75} className="p-5 flex flex-col">
              <div className="hud-bracket" style={{position:'absolute',inset:-1,borderRadius:'1rem',pointerEvents:'none'}}/>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BarChart2 size={12} style={{color:gpuVal>75?'#ff2222':gpuVal>45?'#ff8c00':'#00e5ff'}}/>
                  <span className="hud-font text-xs uppercase tracking-widest text-white">AI Compute</span>
                </div>
                <span className="hud-font text-[9px] tracking-widest" style={{color:'rgba(0,200,255,.3)'}}>GPU</span>
              </div>

              {/* Arc gauge */}
              <div className="flex items-center justify-center my-2">
                <svg viewBox="0 0 120 72" style={{width:'100%',maxWidth:'170px'}}>
                  <path d="M12,66 A52,52 0 0,1 108,66" fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="10" strokeLinecap="round"/>
                  <motion.path d="M12,66 A52,52 0 0,1 108,66" fill="none"
                    stroke={gpuVal>75?'#ff2222':gpuVal>45?'#ff8c00':'#00e5ff'} strokeWidth="10" strokeLinecap="round"
                    strokeDasharray="164" animate={{strokeDashoffset:164-(164*(gpuVal/100))}}
                    transition={{duration:.35}}/>
                  <text x="60" y="60" textAnchor="middle" fontSize="24" fill={gpuVal>75?'#ff2222':gpuVal>45?'#ff8c00':'#00e5ff'}
                    fontFamily="'Share Tech Mono',monospace" fontWeight="bold">{gpuVal}%</text>
                  <text x="60" y="70" textAnchor="middle" fontSize="7" fill="rgba(255,255,255,.18)"
                    fontFamily="'Share Tech Mono',monospace">UTILISATION</text>
                </svg>
              </div>

              <motion.div className="text-center mb-3 hud-font text-[10px] tracking-widest uppercase"
                style={{color:gpuVal>75?'#ff2222':gpuVal>45?'#ff8c00':'#00ff88'}}
                animate={gpuVal>75?{opacity:[1,.35,1]}:{}} transition={{repeat:Infinity,duration:.7}}>
                {gpuVal>75?'⚠ HIGH — THREAT ANALYSIS ACTIVE':gpuVal>45?'⚡ ELEVATED — ANOMALY SCAN':'◉ NOMINAL — PASSIVE WATCH'}
              </motion.div>
              <div className="hud-font text-[9px] text-center mb-3" style={{color:'#5a8a9a'}}>
                {hasCrit?'Processing cascade breach data...':'Isolation Forest: idle'}
              </div>

              <div className="mt-auto">
                <div className="hud-font text-[8px] tracking-widest mb-1" style={{color:'#5a8a9a'}}>30s HISTORY</div>
                <Sparkline data={gpuHist} color={gpuVal>75?'#ff2222':gpuVal>45?'#ff8c00':'#00e5ff'} h={38}/>
              </div>
            </HUDPanel>

            <HUDPanel className="p-5">
              <div className="hud-bracket" style={{position:'absolute',inset:-1,borderRadius:'1rem',pointerEvents:'none'}}/>
              <div className="flex items-center gap-2 mb-4"><Zap size={12} style={{color:'#818cf8'}}/><span className="hud-font text-xs uppercase tracking-widest text-white">Survival Protocol Log</span></div>
              <div className="space-y-2 max-h-44 overflow-y-auto mb-4">
                {actionHistory.length===0&&<div className="text-center py-5 hud-font text-[10px] tracking-widest" style={{color:'#5a8a9a'}}>NO PROTOCOLS ACTIVATED</div>}
                {actionHistory.map((a,i)=>{
                  const p=a.action==='restart'?'🔄 Auto-Repair Drone':a.action==='scale'?'📈 Emergency Upscale':'⚡ Cache Recovery';
                  return (<motion.div key={i} initial={{opacity:0,x:-12}} animate={{opacity:1,x:0}} className="flex items-center gap-2 p-2.5 rounded-xl border border-white/4" style={{background:'rgba(255,255,255,.02)'}}>
                    <div className="flex-1 min-w-0">
                      <div className="hud-font text-[11px] text-slate-300">{p}</div>
                      <div className="hud-font text-[9px] tracking-wider" style={{color:'#7ab8cc'}}>{SVC_LABEL[a.service]||a.service} · {(a.recovery_time||0).toFixed(1)}s</div>
                    </div>
                    <span className="text-sm">{a.recovered?'✅':'❌'}</span>
                  </motion.div>);
                })}
              </div>
              <SectionLabel>Error Signals</SectionLabel>
              {MODULES.map(mod=><MetricRow key={mod} label={MOD_LABELS[mod].split(' ')[0]} value={metrics[MOD_SVC[mod]]?.error_rate??0} max={50} color="#ff2222" unit="%"/>)}
            </HUDPanel>
          </section>


          {/* ── AI Report ─────────────────────────────────────── */}
          <HUDPanel className="p-6">
              <div className="hud-bracket" style={{position:'absolute',inset:-1,borderRadius:'1rem',pointerEvents:'none'}}/>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-xl">🤖</span>
                  <div>
                    <div className="hud-font text-xs uppercase tracking-widest font-bold text-white">AI Incident Analysis</div>
                    <div className="hud-font text-[9px] tracking-widest" style={{color:'rgba(0,200,255,.4)'}}>Auto-generated · Failure Analysis AI</div>
                  </div>
                  {data?.root_cause&&<span className="hud-font text-[9px] px-2 py-0.5 rounded-full animate-pulse ml-2" style={{background:'rgba(255,34,34,.1)',color:'#ff2222',border:'1px solid rgba(255,34,34,.3)'}}>LIVE</span>}
                </div>
                {data?.root_cause&&(
                  <a href={`http://localhost:16686/search?service=${data.root_cause.service}`} target="_blank" rel="noopener noreferrer"
                    className="hud-font text-[10px] tracking-widest flex items-center gap-1 px-3 py-1.5 rounded-lg border" style={{color:'#22d3ee',borderColor:'rgba(34,211,238,.2)'}}>
                    <Activity size={10}/> VIEW TELEMETRY →
                  </a>
                )}
              </div>
              <div className="rounded-xl p-5 border border-indigo-500/10" style={{background:'rgba(0,0,0,.4)'}}>
                {data?.report && data.report !== 'System starting up...'
                  ? <AiReport text={data.report}/>
                  : <div className="text-center py-4">
                      <div className="text-2xl mb-2">🛡</div>
                      <div className="hud-font text-[11px] tracking-widest text-slate-400">NO INCIDENTS DETECTED</div>
                      <div className="hud-font text-[10px] mt-1" style={{color:'rgba(0,200,255,.3)'}}>Colony operating nominally — Isolation Forest idle</div>
                    </div>
                }
              </div>
            </HUDPanel>

          {/* ── MTTR ─────────────────────────────────────────── */}
          <HUDPanel className="p-6">
              <div className="hud-bracket" style={{position:'absolute',inset:-1,borderRadius:'1rem',pointerEvents:'none'}}/>
              <div className="flex items-center gap-2 mb-4"><span>⏱</span><span className="hud-font text-xs uppercase tracking-widest text-white">Recovery Timeline</span></div>
              {data?.mttr_history && data.mttr_history.length > 0
                ? <div className="space-y-2">
                    {data.mttr_history.slice(-6).map((m,i)=>(
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-32 hud-font text-[10px] uppercase tracking-wider text-slate-400 truncate">{SVC_LABEL[m.service]||m.service}</div>
                        <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{background:'rgba(255,255,255,.04)'}}>
                          <motion.div className="h-full rounded-full" style={{background:m.recovered?'#00ff88':'#ff2222'}}
                            initial={{width:0}} animate={{width:`${Math.min(100,(m.recovery_time/25)*100)}%`}} transition={{duration:.7,delay:i*.09}}/>
                        </div>
                        <div className="hud-font text-xs text-slate-500 w-14 text-right">{m.recovery_time.toFixed(1)}s</div>
                        <span className="text-sm">{m.recovered?'✅':'❌'}</span>
                      </div>
                    ))}
                  </div>
                : <div className="text-center py-4">
                    <div className="text-2xl mb-2">⏳</div>
                    <div className="hud-font text-[11px] tracking-widest text-slate-400">NO RECOVERY EVENTS YET</div>
                    <div className="hud-font text-[10px] mt-1" style={{color:'rgba(0,200,255,.3)'}}>Timeline populates after first autonomous heal cycle</div>
                  </div>
              }
            </HUDPanel>
        </main>
      </div>

      <FluidMenu onNavigate={(s)=>{ if(s==='dashboard') window.scrollTo(0,0); }}/>

      {/* Toast */}
      <AnimatePresence>
        {toast&&(
          <motion.div initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} exit={{opacity:0,y:14}}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 hud-font text-sm px-6 py-3 rounded-xl"
            style={{background:'rgba(0,8,20,.97)',border:'1px solid rgba(255,69,0,.4)',backdropFilter:'blur(16px)',color:'#94a3b8'}}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* What-If Impact Analysis Modal */}
      <AnimatePresence>
        {whatIfModal&&(
          <WhatIfModal
            cfg={whatIfModal}
            mttr={data?.mttr_history?.at(-1)?.recovery_time||1.5}
            onCancel={()=>setWhatIfModal(null)}
            onExecute={()=>{
              setWhatIfModal(null);
              if(whatIfModal.isOxygen) {
                oxygenFail();
              } else {
                inject(whatIfModal.service, whatIfModal.chaosType);
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
