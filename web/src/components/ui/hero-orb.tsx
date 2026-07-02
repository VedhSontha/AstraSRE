'use client';
import { useEffect, useRef } from 'react';

export function HeroOrb({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf: number;
    let t = 0;

    const resize = () => {
      const rect = canvas.parentElement!.getBoundingClientRect();
      canvas.width  = rect.width  * (window.devicePixelRatio || 1);
      canvas.height = rect.height * (window.devicePixelRatio || 1);
      canvas.style.width  = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    };
    resize();
    window.addEventListener('resize', resize);

    // Particle cloud around orb
    const PART_COUNT = 320;
    const parts = Array.from({ length: PART_COUNT }, () => {
      const r     = 180 + Math.random() * 120;
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      const speed = 0.0003 + Math.random() * 0.0005;
      const col   = [
        [99, 102, 241],
        [167, 139, 250],
        [34, 211, 238],
        [16, 185, 129],
      ][Math.floor(Math.random() * 4)];
      return { r, theta, phi, speed, col, size: 1 + Math.random() * 1.5 };
    });

    // Ring definitions [radiusX, radiusY, rotation, color, alpha]
    const rings = [
      { rx: 170, ry: 55,  rot: 0.6,  col: '#6366f1', alpha: 0.35, speed: 0.004   },
      { rx: 195, ry: 38,  rot: -0.9, col: '#22d3ee', alpha: 0.2,  speed: -0.0025 },
      { rx: 145, ry: 65,  rot: 1.2,  col: '#a78bfa', alpha: 0.25, speed: 0.003   },
    ];

    const draw = () => {
      t += 0.012;
      const W = canvas.width, H = canvas.height;
      const cx = W / 2, cy = H / 2;
      ctx.clearRect(0, 0, W, H);

      // ── Outer glow ────────────────────────────────────────────────────
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 260 * (W / 1200));
      glow.addColorStop(0,   'rgba(99,102,241,0.18)');
      glow.addColorStop(0.5, 'rgba(139,92,246,0.08)');
      glow.addColorStop(1,   'transparent');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(cx, cy, 300 * (W / 1200), 0, Math.PI * 2); ctx.fill();

      // ── Rings ─────────────────────────────────────────────────────────
      rings.forEach(ring => {
        ring.rot += ring.speed;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(ring.rot);
        ctx.beginPath();
        ctx.ellipse(0, 0, ring.rx * (W / 900), ring.ry * (W / 900), 0, 0, Math.PI * 2);
        ctx.strokeStyle = ring.col;
        ctx.globalAlpha = ring.alpha;
        ctx.lineWidth   = 1.5;
        ctx.stroke();
        ctx.restore();
      });
      ctx.globalAlpha = 1;

      // ── Core sphere ───────────────────────────────────────────────────
      const R    = 115 * (W / 900);
      const wobx = Math.sin(t * 0.7) * 8, woby = Math.cos(t * 0.5) * 6;

      // Deep core
      const core = ctx.createRadialGradient(cx + wobx - R * 0.2, cy + woby - R * 0.25, R * 0.05, cx + wobx, cy + woby, R);
      core.addColorStop(0,   'rgba(200,180,255,0.95)');
      core.addColorStop(0.2, 'rgba(139,92,246,0.9)');
      core.addColorStop(0.55,'rgba(99,102,241,0.75)');
      core.addColorStop(0.8, 'rgba(67,56,202,0.5)');
      core.addColorStop(1,   'rgba(30,27,75,0)');
      ctx.beginPath();
      ctx.arc(cx + wobx, cy + woby, R, 0, Math.PI * 2);
      ctx.fillStyle = core;
      ctx.fill();

      // Specular highlight
      const spec = ctx.createRadialGradient(cx + wobx - R * 0.3, cy + woby - R * 0.3, 0, cx + wobx - R * 0.2, cy + woby - R * 0.2, R * 0.55);
      spec.addColorStop(0,   'rgba(255,255,255,0.45)');
      spec.addColorStop(0.5, 'rgba(200,180,255,0.12)');
      spec.addColorStop(1,   'transparent');
      ctx.beginPath();
      ctx.arc(cx + wobx, cy + woby, R, 0, Math.PI * 2);
      ctx.fillStyle = spec;
      ctx.fill();

      // Edge glow rim
      const rim = ctx.createRadialGradient(cx + wobx, cy + woby, R * 0.75, cx + wobx, cy + woby, R * 1.05);
      rim.addColorStop(0,   'transparent');
      rim.addColorStop(0.7, 'rgba(99,102,241,0.15)');
      rim.addColorStop(1,   'rgba(139,92,246,0.35)');
      ctx.beginPath();
      ctx.arc(cx + wobx, cy + woby, R * 1.06, 0, Math.PI * 2);
      ctx.fillStyle = rim;
      ctx.fill();

      // ── Particles ─────────────────────────────────────────────────────
      parts.forEach(p => {
        p.theta += p.speed;
        const scale = W / 900;
        const x = cx + p.r * scale * Math.sin(p.phi) * Math.cos(p.theta);
        const y = cy + p.r * 0.55 * scale * Math.sin(p.phi) * Math.sin(p.theta);
        const z = p.r * Math.cos(p.phi);           // depth
        const zNorm = (z / p.r + 1) / 2;           // 0..1
        const alpha = 0.3 + zNorm * 0.7;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle   = `rgb(${p.col[0]},${p.col[1]},${p.col[2]})`;
        ctx.beginPath();
        ctx.arc(x, y, p.size * scale * (0.5 + zNorm * 0.5), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // ── Subtle scanlines for sci-fi feel ──────────────────────────────
      for (let y = 0; y < H; y += 4) {
        ctx.fillStyle = 'rgba(0,0,0,0.015)';
        ctx.fillRect(0, y, W, 1);
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  return (
    <div className={`relative w-full h-full flex items-center justify-center ${className}`}
      style={{ pointerEvents: 'none' }}>
      {/* Extra ambient glow layers */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-80 h-80 rounded-full animate-pulse-slow"
          style={{ background: 'radial-gradient(circle,rgba(99,102,241,0.15) 0%,transparent 70%)' }} />
      </div>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-60 h-60 rounded-full animate-spin-slow"
          style={{ background: 'conic-gradient(from 0deg,rgba(99,102,241,0.08),rgba(139,92,246,0.12),rgba(34,211,238,0.06),rgba(99,102,241,0.08))', borderRadius: '50%' }} />
      </div>
      <canvas ref={canvasRef} className="relative z-10" style={{ imageRendering: 'pixelated' }} />
    </div>
  );
}
