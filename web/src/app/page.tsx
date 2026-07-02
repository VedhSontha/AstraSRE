'use client';
import dynamic from 'next/dynamic';
import { useRef } from 'react';
import Link from 'next/link';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import { Waves } from '@/components/ui/wave-background';
import { FlickeringGrid } from '@/components/ui/flickering-grid';
import { GlowCard } from '@/components/ui/glow-card';
import { FluidMenu } from '@/components/ui/fluid-menu';
import {
  Zap, Shield, Activity, Brain, GitFork, Database,
  ArrowRight, ChevronDown, Terminal, BarChart3, Cpu, Clock,
} from 'lucide-react';

// Dynamically import components that use browser APIs (no SSR)
const HeroOrb = dynamic(() => import('@/components/ui/hero-orb').then(m => ({ default: m.HeroOrb })), { ssr: false, loading: () => <div className="w-full h-full" /> });
const VaporizeTextCycle = dynamic(() => import('@/components/ui/vapour-text-effect').then(m => ({ default: m.VaporizeTextCycle })), { ssr: false, loading: () => <div className="h-16" /> });

// ── Animation variants ───────────────────────────────────────────────────────
const fadeUp   = { hidden: { opacity: 0, y: 50 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.25, 0.1, 0.25, 1] } } };
const fadeLeft = { hidden: { opacity: 0, x: -60 }, show: { opacity: 1, x: 0, transition: { duration: 0.7, ease: [0.25, 0.1, 0.25, 1] } } };
const fadeRight= { hidden: { opacity: 0, x: 60  }, show: { opacity: 1, x: 0, transition: { duration: 0.7, ease: [0.25, 0.1, 0.25, 1] } } };
const stagger  = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };
const scaleIn  = { hidden: { opacity: 0, scale: 0.8 }, show: { opacity: 1, scale: 1, transition: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] } } };

// ── Section enter wrapper ────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SectionReveal({ children, className = '', variant = fadeUp }: { children: React.ReactNode; className?: string; variant?: any }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.15 });
  return (
    <motion.div ref={ref} variants={variant} initial="hidden" animate={isInView ? "show" : "hidden"} className={className}>
      {children}
    </motion.div>
  );
}

// ── Data ─────────────────────────────────────────────────────────────────────
const SERVICES = [
  { name: 'frontend',     icon: '🖥',  color: '#10b981', port: 5000, desc: 'HTTP gateway entry point' },
  { name: 'order',        icon: '📦',  color: '#6366f1', port: 5001, desc: 'Order lifecycle management' },
  { name: 'inventory',    icon: '🏭',  color: '#22d3ee', port: 5003, desc: 'Redis-cached stock service' },
  { name: 'payment',      icon: '💳',  color: '#f59e0b', port: 5002, desc: 'PostgreSQL payment processor' },
  { name: 'notification', icon: '🔔',  color: '#8b5cf6', port: 5004, desc: 'Async event broadcaster' },
];

const FEATURES = [
  { icon: <Brain size={26} />,    color: '#8b5cf6', title: 'Isolation Forest ML',     desc: 'Detects anomalies across CPU, latency, and error rates with 91% confidence using correlated multi-signal analysis.' },
  { icon: <GitFork size={26} />,  color: '#22d3ee', title: 'Topological RCA',         desc: 'Dependency graph traversal finds the true root cause — not just symptoms — and computes blast radius instantly.' },
  { icon: <Zap size={26} />,      color: '#f59e0b', title: 'Autonomous Remediation',  desc: 'Pod restarts, HPA scale-out, Redis cache flush — all triggered automatically. Average MTTR under 5 seconds.' },
  { icon: <Activity size={26} />, color: '#10b981', title: 'Full Observability Stack', desc: 'Prometheus metrics + Loki logs + Jaeger traces + OpenTelemetry. Every signal correlated in real time.' },
  { icon: <Database size={26} />, color: '#6366f1', title: 'Real PostgreSQL + Redis',  desc: 'Real SQL INSERTs, real Redis GET/SET with TTL, real connection failures and automatic recovery — nothing simulated.' },
  { icon: <Shield size={26} />,   color: '#ef4444', title: 'Chaos Engineering',        desc: 'Inject db_timeout, latency spikes, and pod crashes. Watch the cascade propagate and autonomous healing kick in.' },
];

const DEMO_STEPS = [
  { n:'01', icon:<Terminal size={15}/>,    col:'#ef4444', title:'Inject Chaos',        code:'POST /inject { "service":"payment","type":"db_timeout" }', desc:'PostgreSQL connection timeout injected into payment.' },
  { n:'02', icon:<GitFork size={15}/>,    col:'#f59e0b', title:'Cascade Propagates',   code:'payment → inventory → order → frontend (3.2s)',          desc:'Four services degrade from one root cause.' },
  { n:'03', icon:<Brain size={15}/>,      col:'#8b5cf6', title:'ML Detects Anomaly',   code:'IsolationForest.score(payment) = 0.912 [CRITICAL]',       desc:'91.2% confidence. Root cause identified via graph.' },
  { n:'04', icon:<Zap size={15}/>,        col:'#10b981', title:'Autonomous Recovery',  code:'action=restart  recovery_time=4.2s  recovered=true',      desc:'Zero human intervention. System self-heals.' },
];

const STACK = [
  { n:'Kubernetes', c:'#326CE5' }, { n:'Prometheus', c:'#E6522C' }, { n:'Loki', c:'#F46800' },
  { n:'Jaeger', c:'#60D8FA' }, { n:'PostgreSQL', c:'#336791' }, { n:'Redis', c:'#DC382D' },
  { n:'Isolation Forest', c:'#8b5cf6' }, { n:'OpenTelemetry', c:'#F5A800' },
];

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function HomePage() {
  const heroRef   = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const orbY      = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const orbOpacity= useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const titleY    = useTransform(scrollYProgress, [0, 1], ["0%", "-15%"]);
  const titleOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  return (
    <div className="relative min-h-screen bg-[#04040a] text-slate-100 overflow-x-hidden">

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section ref={heroRef} className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">

        {/* Wave bg */}
        <Waves strokeColor="rgba(99,102,241,0.28)" opacity={0.8} />

        {/* Flickering grid overlay */}
        <div className="absolute inset-0 z-0 pointer-events-none [mask-image:radial-gradient(ellipse_70%_60%_at_50%_50%,black,transparent)]">
          <FlickeringGrid color="rgb(99,102,241)" maxOpacity={0.07} flickerChance={0.08} squareSize={4} gridGap={7} />
        </div>

        {/* 3D Orb — parallax on scroll */}
        <motion.div style={{ y: orbY, opacity: orbOpacity }}
          className="absolute inset-0 z-0 pointer-events-none flex items-center justify-center">
          <div className="w-[700px] h-[700px] max-w-[90vw] max-h-[90vmin]">
            <HeroOrb />
          </div>
        </motion.div>

        {/* Radial glow behind orb */}
        <div className="absolute inset-0 z-0 pointer-events-none flex items-center justify-center">
          <div className="w-[500px] h-[500px] rounded-full" style={{ background:'radial-gradient(ellipse,rgba(99,102,241,0.12) 0%,transparent 70%)' }} />
        </div>

        {/* Text content — parallax on scroll */}
        <motion.div style={{ y: titleY, opacity: titleOpacity }}
          className="relative z-10 flex flex-col items-center text-center max-w-5xl mx-auto px-6">

          {/* Badge */}
          <motion.div initial={{ opacity:0, y:30 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.2, duration:0.6 }}>
            <div className="glass rounded-full px-5 py-2 border border-indigo-500/25 text-sm text-indigo-300 font-medium mb-8">
              <span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-2 animate-pulse" />
              Autonomous SRE Platform — Live on Docker + Kubernetes
            </div>
          </motion.div>

          {/* Main title */}
          <motion.h1
            initial={{ opacity:0, scale:0.85, y:20 }} animate={{ opacity:1, scale:1, y:0 }}
            transition={{ delay:0.3, duration:0.8, ease:[0.25,0.1,0.25,1] }}
            className="text-8xl md:text-[10rem] font-black tracking-tighter leading-none mb-4 select-none">
            <span className="bg-gradient-to-br from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">Sentinel</span>
            <span className="glow-text bg-gradient-to-br from-indigo-400 via-purple-400 to-violet-500 bg-clip-text text-transparent">AI</span>
          </motion.h1>

          {/* Vaporize cycling taglines */}
          <motion.div
            initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.9, duration:0.6 }}
            className="w-full max-w-2xl h-20 flex items-center justify-center mb-4">
            <VaporizeTextCycle
              texts={["Predict. Detect. Heal.", "100% Autonomous Recovery", "ML-Powered Chaos Engineering", "Self-Healing Infrastructure"]}
              font={{ fontFamily: "Inter, sans-serif", fontSize: "42px", fontWeight: 600 }}
              color="rgb(167,139,250)"
              spread={6} density={6}
              animation={{ vaporizeDuration: 2.5, fadeInDuration: 0.8, waitDuration: 1.5 }}
              direction="left-to-right" alignment="center"
            />
          </motion.div>

          <motion.p
            initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:1.1, duration:0.6 }}
            className="text-base text-slate-500 mb-10 font-mono">
            Isolation Forest · Topological RCA · Autonomous Remediation · Multi-Signal Observability
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:1.2, duration:0.6 }}
            className="flex flex-wrap gap-4 justify-center">
            <Link href="/dashboard"
              className="group inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-white transition-all duration-300 hover:scale-105"
              style={{ background:'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow:'0 0 30px rgba(99,102,241,0.5)' }}>
              <Activity size={18} /> Live Dashboard
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            </Link>
            <Link href="#demo"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold glass border border-indigo-500/25 text-slate-300 hover:text-white hover:border-indigo-400/50 hover:scale-105 transition-all duration-300">
              <Zap size={18} /> See the Demo
            </Link>
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:1.8, duration:0.6 }}
            className="mt-20 flex flex-col items-center text-slate-700 text-xs gap-2">
            <span>Scroll to explore</span>
            <ChevronDown size={20} className="animate-bounce" />
          </motion.div>
        </motion.div>
      </section>

      {/* ── SERVICES ─────────────────────────────────────────────────────── */}
      <section className="relative py-28 px-6">
        <div className="max-w-7xl mx-auto">
          <SectionReveal className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">5 Microservices. One Brain.</span>
            </h2>
            <p className="text-slate-500 text-lg max-w-2xl mx-auto">Every service has real DB integrations, Prometheus metrics, Loki logs, and OpenTelemetry traces.</p>
          </SectionReveal>

          <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4"
            variants={stagger} initial="hidden"
            whileInView="show" viewport={{ once:true, amount:0.15 }}>
            {SERVICES.map((svc, i) => (
              <motion.div key={svc.name} variants={scaleIn}>
                <GlowCard glowColor={(['purple','cyan','blue','orange','purple'] as const)[i]}
                  className="p-5 flex flex-col gap-3 h-full hover:-translate-y-2 transition-transform duration-300 cursor-default">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{svc.icon}</span>
                    <div>
                      <div className="font-bold text-white text-sm">{svc.name}</div>
                      <div className="text-xs font-mono" style={{ color:svc.color }}>:{svc.port}</div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{svc.desc}</p>
                  <div className="flex items-center gap-1 mt-auto">
                    <span className="w-2 h-2 rounded-full animate-pulse" style={{ background:svc.color }} />
                    <span className="text-xs text-slate-600">running</span>
                  </div>
                </GlowCard>
              </motion.div>
            ))}
          </motion.div>

          {/* Dependency chain */}
          <SectionReveal className="mt-10 text-center" variant={fadeUp}>
            <div className="glass rounded-2xl p-4 inline-flex items-center gap-3 text-sm font-mono text-slate-400 border border-indigo-500/15">
              {SERVICES.slice(0,4).map((s,i) => (
                <span key={s.name} className="flex items-center gap-3">
                  <span style={{ color:s.color }}>{s.name}</span>
                  {i<3 && <ArrowRight size={13} className="text-slate-700" />}
                </span>
              ))}
            </div>
          </SectionReveal>
        </div>
      </section>

      {/* ── DEMO STEPS ───────────────────────────────────────────────────── */}
      <section id="demo" className="relative py-28 px-6 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-0 w-[600px] h-[600px] rounded-full blur-3xl" style={{ background:'radial-gradient(circle,rgba(99,102,241,0.06),transparent)' }} />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full blur-3xl" style={{ background:'radial-gradient(circle,rgba(34,211,238,0.05),transparent)' }} />
        </div>
        <div className="max-w-5xl mx-auto relative z-10">
          <SectionReveal className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">The Demo in Real Time</span>
            </h2>
          </SectionReveal>

          <div className="space-y-4">
            {DEMO_STEPS.map((s, i) => (
              <SectionReveal key={s.n} variant={i%2===0 ? fadeLeft : fadeRight}>
                <GlowCard glowColor={i%2===0 ? 'purple' : 'blue'}
                  className="p-5 flex gap-5 items-start group hover:scale-[1.015] transition-transform">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center font-black text-xs font-mono"
                    style={{ background:`linear-gradient(135deg,${s.col}22,${s.col}11)`, border:`1px solid ${s.col}40`, color:s.col }}>
                    {s.n}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span style={{ color:s.col }}>{s.icon}</span>
                      <span className="font-bold text-white">{s.title}</span>
                    </div>
                    <div className="font-mono text-xs mb-2 p-3 rounded-lg overflow-x-auto"
                      style={{ background:'rgba(0,0,0,0.45)', color:s.col, border:`1px solid ${s.col}20` }}>
                      {s.code}
                    </div>
                    <p className="text-sm text-slate-500">{s.desc}</p>
                  </div>
                </GlowCard>
              </SectionReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────────────── */}
      <section className="py-28 px-6">
        <div className="max-w-7xl mx-auto">
          <SectionReveal className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">Built for Real Chaos</span>
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto text-lg">Every layer is production-grade. Nothing is mocked.</p>
          </SectionReveal>

          <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
            variants={stagger} initial="hidden" whileInView="show" viewport={{ once:true, amount:0.1 }}>
            {FEATURES.map((f, i) => (
              <motion.div key={f.title} variants={scaleIn}>
                <GlowCard glowColor={(['purple','cyan','blue','green','purple','red'] as const)[i]}
                  className="p-6 flex flex-col gap-4 h-full hover:-translate-y-1 transition-transform duration-300">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background:`${f.color}15`, border:`1px solid ${f.color}40`, color:f.color }}>
                    {f.icon}
                  </div>
                  <h3 className="font-bold text-white text-lg">{f.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
                </GlowCard>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── STATS ROW ────────────────────────────────────────────────────── */}
      <section className="py-16 px-6 border-y border-indigo-500/10">
        <div className="max-w-5xl mx-auto">
          <motion.div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center"
            variants={stagger} initial="hidden" whileInView="show" viewport={{ once:true }}>
            {[
              { label:'Avg MTTR', value:'< 5s',   color:'#10b981', icon:<Zap size={22}/> },
              { label:'ML Confidence', value:'91%', color:'#8b5cf6', icon:<Brain size={22}/> },
              { label:'Services Monitored', value:'5',   color:'#22d3ee', icon:<Activity size={22}/> },
              { label:'Detection Latency', value:'3s',    color:'#f59e0b', icon:<Clock size={22}/> },
            ].map(stat => (
              <motion.div key={stat.label} variants={scaleIn}>
                <GlowCard glowColor="purple" className="p-6 flex flex-col items-center gap-2">
                  <span style={{ color:stat.color }}>{stat.icon}</span>
                  <div className="text-4xl font-black text-white" style={{ textShadow:`0 0 20px ${stat.color}80` }}>{stat.value}</div>
                  <div className="text-xs text-slate-500 font-medium">{stat.label}</div>
                </GlowCard>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── STACK ────────────────────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-slate-700 text-xs font-mono mb-8 uppercase tracking-widest">Tech Stack</p>
          <motion.div className="flex flex-wrap gap-3 justify-center"
            variants={stagger} initial="hidden" whileInView="show" viewport={{ once:true }}>
            {STACK.map(t => (
              <motion.div key={t.n} variants={scaleIn}
                className="px-4 py-2 rounded-full text-sm font-medium glass border transition-all duration-300 hover:scale-110 cursor-default"
                style={{ borderColor:`${t.c}30`, color:t.c, background:`${t.c}08` }}>
                {t.n}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="py-36 px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none [mask-image:radial-gradient(ellipse_at_center,black,transparent)]">
          <FlickeringGrid color="rgb(99,102,241)" maxOpacity={0.06} flickerChance={0.07} />
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full pointer-events-none"
          style={{ background:'radial-gradient(ellipse,rgba(99,102,241,0.1) 0%,transparent 70%)' }} />

        <SectionReveal className="max-w-3xl mx-auto text-center relative z-10">
          <div className="w-full max-w-xl h-20 mx-auto mb-6">
            <VaporizeTextCycle
              texts={["Watch it heal itself.", "Zero Human Intervention.", "Chaos → Recovery.", "SentinelAI."]}
              font={{ fontFamily:"Inter, sans-serif", fontSize:"48px", fontWeight:800 }}
              color="rgb(167,139,250)"
              spread={7} density={7}
              animation={{ vaporizeDuration:2.2, fadeInDuration:0.7, waitDuration:1.2 }}
              direction="left-to-right" alignment="center"
            />
          </div>
          <p className="text-slate-500 text-lg mb-10">
            Launch the stack, inject a failure, and watch SentinelAI detect, diagnose,<br className="hidden md:block" /> and recover — in under 10 seconds.
          </p>
          <Link href="/dashboard"
            className="group inline-flex items-center gap-3 px-10 py-5 rounded-2xl font-bold text-white text-lg transition-all duration-300 hover:scale-105"
            style={{ background:'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow:'0 0 50px rgba(99,102,241,0.5)' }}>
            <BarChart3 size={22} /> Open Live Dashboard
            <ArrowRight size={20} className="transition-transform group-hover:translate-x-2" />
          </Link>
          <p className="mt-6 text-xs text-slate-700 font-mono">Requires: docker-compose up --build -d (from hack_antig/)</p>
        </SectionReveal>
      </section>

      <FluidMenu onNavigate={(s) => { if (s === 'dashboard') window.location.href = '/dashboard'; }} />
    </div>
  );
}
