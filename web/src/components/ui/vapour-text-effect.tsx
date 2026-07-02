"use client";

import React, { useRef, useEffect, useState, createElement, useMemo, useCallback, memo } from "react";

export enum Tag {
  H1 = "h1",
  H2 = "h2",
  H3 = "h3",
  P = "p",
}

type VaporizeTextCycleProps = {
  texts: string[];
  font?: { fontFamily?: string; fontSize?: string; fontWeight?: number };
  color?: string;
  spread?: number;
  density?: number;
  animation?: { vaporizeDuration?: number; fadeInDuration?: number; waitDuration?: number };
  direction?: "left-to-right" | "right-to-left";
  alignment?: "left" | "center" | "right";
  tag?: Tag;
};

type Particle = {
  x: number; y: number; originalX: number; originalY: number;
  color: string; opacity: number; originalAlpha: number;
  velocityX: number; velocityY: number; angle: number; speed: number;
  shouldFadeQuickly?: boolean;
};

type TextBoundaries = { left: number; right: number; width: number };

declare global {
  interface HTMLCanvasElement { textBoundaries?: TextBoundaries; }
}

function useIsInView(ref: React.RefObject<HTMLElement>) {
  const [isInView, setIsInView] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(([e]) => setIsInView(e.isIntersecting), { threshold: 0, rootMargin: '50px' });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);
  return isInView;
}

function transformValue(input: number, inputRange: number[], outputRange: number[], clamp = false): number {
  const [imin, imax] = inputRange, [omin, omax] = outputRange;
  let result = omin + ((input - imin) / (imax - imin)) * (omax - omin);
  if (clamp) result = omax > omin ? Math.min(Math.max(result, omin), omax) : Math.min(Math.max(result, omax), omin);
  return result;
}

const parseColor = (color: string) => {
  const rgba = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
  if (rgba) return `rgba(${rgba[1]}, ${rgba[2]}, ${rgba[3]}, ${rgba[4]})`;
  const rgb = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (rgb) return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, 1)`;
  return "rgba(255, 255, 255, 1)";
};

const calculateVaporizeSpread = (size: number) => {
  const pts = [{ size: 20, spread: 0.2 }, { size: 50, spread: 0.5 }, { size: 100, spread: 1.5 }];
  if (size <= pts[0].size) return pts[0].spread;
  if (size >= pts[pts.length - 1].size) return pts[pts.length - 1].spread;
  let i = 0;
  while (i < pts.length - 1 && pts[i + 1].size < size) i++;
  return pts[i].spread + (size - pts[i].size) * (pts[i + 1].spread - pts[i].spread) / (pts[i + 1].size - pts[i].size);
};

const createParticles = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, text: string, textX: number, textY: number, font: string, color: string, alignment: string) => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = color; ctx.font = font;
  ctx.textAlign = alignment as CanvasTextAlign; ctx.textBaseline = "middle";
  ctx.imageSmoothingQuality = "high"; ctx.imageSmoothingEnabled = true;
  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;
  const textLeft = alignment === "center" ? textX - textWidth / 2 : alignment === "left" ? textX : textX - textWidth;
  const textBoundaries = { left: textLeft, right: textLeft + textWidth, width: textWidth };
  ctx.fillText(text, textX, textY);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const currentDPR = canvas.width / parseInt(canvas.style.width);
  const sampleRate = Math.max(1, Math.round(currentDPR / 3));
  const particles: Particle[] = [];
  for (let y = 0; y < canvas.height; y += sampleRate) {
    for (let x = 0; x < canvas.width; x += sampleRate) {
      const idx = (y * canvas.width + x) * 4;
      if (data[idx + 3] > 0) {
        const alpha = data[idx + 3] / 255 * (sampleRate / currentDPR);
        particles.push({ x, y, originalX: x, originalY: y, color: `rgba(${data[idx]},${data[idx+1]},${data[idx+2]},${alpha})`, opacity: alpha, originalAlpha: alpha, velocityX: 0, velocityY: 0, angle: 0, speed: 0 });
      }
    }
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  return { particles, textBoundaries };
};

const updateParticles = (particles: Particle[], vaporizeX: number, deltaTime: number, spread: number, duration: number, direction: string, density: number) => {
  let allVaporized = true;
  particles.forEach(p => {
    const should = direction === "left-to-right" ? p.originalX <= vaporizeX : p.originalX >= vaporizeX;
    if (should) {
      if (p.speed === 0) {
        p.angle = Math.random() * Math.PI * 2; p.speed = (Math.random() + 0.5) * spread;
        p.velocityX = Math.cos(p.angle) * p.speed; p.velocityY = Math.sin(p.angle) * p.speed;
        p.shouldFadeQuickly = Math.random() > density;
      }
      if (p.shouldFadeQuickly) {
        p.opacity = Math.max(0, p.opacity - deltaTime);
      } else {
        const dx = p.originalX - p.x, dy = p.originalY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const damp = Math.max(0.95, 1 - dist / (100 * spread));
        const rs = spread * 3;
        p.velocityX = (p.velocityX + (Math.random() - 0.5) * rs + dx * 0.002) * damp;
        p.velocityY = (p.velocityY + (Math.random() - 0.5) * rs + dy * 0.002) * damp;
        const maxV = spread * 2, cv = Math.sqrt(p.velocityX ** 2 + p.velocityY ** 2);
        if (cv > maxV) { p.velocityX *= maxV / cv; p.velocityY *= maxV / cv; }
        p.x += p.velocityX * deltaTime * 20; p.y += p.velocityY * deltaTime * 10;
        p.opacity = Math.max(0, p.opacity - deltaTime * 0.25 * (2000 / duration));
      }
      if (p.opacity > 0.01) allVaporized = false;
    } else { allVaporized = false; }
  });
  return allVaporized;
};

const renderParticles = (ctx: CanvasRenderingContext2D, particles: Particle[], dpr: number) => {
  ctx.save(); ctx.scale(dpr, dpr);
  particles.forEach(p => {
    if (p.opacity > 0) { ctx.fillStyle = p.color.replace(/[\d.]+\)$/, `${p.opacity})`); ctx.fillRect(p.x / dpr, p.y / dpr, 1, 1); }
  });
  ctx.restore();
};

const resetParticles = (particles: Particle[]) => {
  particles.forEach(p => { p.x = p.originalX; p.y = p.originalY; p.opacity = p.originalAlpha; p.speed = 0; p.velocityX = 0; p.velocityY = 0; });
};

const SeoElement = memo(({ tag = Tag.P, texts }: { tag: Tag; texts: string[] }) => {
  const style = { position: "absolute" as const, width: "0", height: "0", overflow: "hidden", userSelect: "none" as const, pointerEvents: "none" as const };
  return createElement(Object.values(Tag).includes(tag) ? tag : "p", { style }, texts?.join(" ") ?? "");
});
SeoElement.displayName = "SeoElement";

export default function VaporizeTextCycle({
  texts = ["SentinelAI", "Self-Healing"],
  font = { fontFamily: "Inter, sans-serif", fontSize: "60px", fontWeight: 700 },
  color = "rgb(255,255,255)", spread = 5, density = 5,
  animation = { vaporizeDuration: 2, fadeInDuration: 1, waitDuration: 0.5 },
  direction = "left-to-right", alignment = "center", tag = Tag.H1,
}: VaporizeTextCycleProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isInView = useIsInView(wrapperRef as React.RefObject<HTMLElement>);
  const lastFontRef = useRef<string | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [animationState, setAnimationState] = useState<"static" | "vaporizing" | "fadingIn" | "waiting">("static");
  const vaporizeProgressRef = useRef(0);
  const fadeOpacityRef = useRef(0);
  const [wrapperSize, setWrapperSize] = useState({ width: 0, height: 0 });
  const transformedDensity = transformValue(density, [0, 10], [0.3, 1], true);
  const globalDpr = useMemo(() => typeof window !== "undefined" ? window.devicePixelRatio * 1.5 || 1 : 1, []);
  const durations = useMemo(() => ({ VD: (animation.vaporizeDuration ?? 2) * 1000, FD: (animation.fadeInDuration ?? 1) * 1000, WD: (animation.waitDuration ?? 0.5) * 1000 }), [animation.vaporizeDuration, animation.fadeInDuration, animation.waitDuration]);
  const fontConfig = useMemo(() => { const fs = parseInt(font.fontSize?.replace("px", "") || "60"); const vs = calculateVaporizeSpread(fs); return { fontSize: fs, SPREAD: vs * spread, font: `${font.fontWeight ?? 700} ${fs * globalDpr}px ${font.fontFamily}` }; }, [font, spread, globalDpr]);

  const renderC = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas || !wrapperSize.width) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    canvas.style.width = `${wrapperSize.width}px`; canvas.style.height = `${wrapperSize.height}px`;
    canvas.width = Math.floor(wrapperSize.width * globalDpr); canvas.height = Math.floor(wrapperSize.height * globalDpr);
    const textX = alignment === "center" ? canvas.width / 2 : alignment === "left" ? 0 : canvas.width;
    const { particles, textBoundaries } = createParticles(ctx, canvas, texts[currentTextIndex] || texts[0], textX, canvas.height / 2, fontConfig.font, parseColor(color), alignment);
    particlesRef.current = particles; canvas.textBoundaries = textBoundaries;
  }, [wrapperSize, globalDpr, texts, currentTextIndex, fontConfig.font, color, alignment]);

  useEffect(() => { renderC(); }, [renderC]);

  useEffect(() => {
    if (isInView) { const t = setTimeout(() => setAnimationState("vaporizing"), 0); return () => clearTimeout(t); }
    else { setAnimationState("static"); if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); }
  }, [isInView]);

  useEffect(() => {
    if (!isInView) return;
    let lastTime = performance.now(), frameId: number;
    const animate = (now: number) => {
      const dt = (now - lastTime) / 1000; lastTime = now;
      const canvas = canvasRef.current, ctx = canvas?.getContext("2d");
      if (!canvas || !ctx || !particlesRef.current.length) { frameId = requestAnimationFrame(animate); return; }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (animationState === "static" || animationState === "waiting") { renderParticles(ctx, particlesRef.current, globalDpr); }
      else if (animationState === "vaporizing") {
        vaporizeProgressRef.current += dt * 100 / (durations.VD / 1000);
        const tb = canvas.textBoundaries; if (!tb) { frameId = requestAnimationFrame(animate); return; }
        const prog = Math.min(100, vaporizeProgressRef.current);
        const vx = direction === "left-to-right" ? tb.left + tb.width * prog / 100 : tb.right - tb.width * prog / 100;
        const done = updateParticles(particlesRef.current, vx, dt, fontConfig.SPREAD, durations.VD, direction, transformedDensity);
        renderParticles(ctx, particlesRef.current, globalDpr);
        if (vaporizeProgressRef.current >= 100 && done) { setCurrentTextIndex(p => (p + 1) % texts.length); setAnimationState("fadingIn"); fadeOpacityRef.current = 0; }
      } else if (animationState === "fadingIn") {
        fadeOpacityRef.current += dt * 1000 / durations.FD;
        ctx.save(); ctx.scale(globalDpr, globalDpr);
        particlesRef.current.forEach(p => { p.x = p.originalX; p.y = p.originalY; const op = Math.min(fadeOpacityRef.current, 1) * p.originalAlpha; ctx.fillStyle = p.color.replace(/[\d.]+\)$/, `${op})`); ctx.fillRect(p.x / globalDpr, p.y / globalDpr, 1, 1); });
        ctx.restore();
        if (fadeOpacityRef.current >= 1) { setAnimationState("waiting"); setTimeout(() => { setAnimationState("vaporizing"); vaporizeProgressRef.current = 0; resetParticles(particlesRef.current); }, durations.WD); }
      }
      frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [animationState, isInView, texts.length, direction, globalDpr, fontConfig.SPREAD, durations, transformedDensity]);

  useEffect(() => {
    const el = wrapperRef.current; if (!el) return;
    const ro = new ResizeObserver(entries => { for (const e of entries) setWrapperSize({ width: e.contentRect.width, height: e.contentRect.height }); });
    ro.observe(el);
    setWrapperSize({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrapperRef} style={{ width: "100%", height: "100%", pointerEvents: "none" }}>
      <canvas ref={canvasRef} style={{ minWidth: "30px", minHeight: "20px", pointerEvents: "none" }} />
      <SeoElement tag={tag} texts={texts} />
    </div>
  );
}

export { VaporizeTextCycle };
