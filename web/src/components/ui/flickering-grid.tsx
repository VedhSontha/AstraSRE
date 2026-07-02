"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface FlickeringGridProps extends React.HTMLAttributes<HTMLDivElement> {
  squareSize?: number;
  gridGap?: number;
  flickerChance?: number;
  color?: string;
  width?: number;
  height?: number;
  className?: string;
  maxOpacity?: number;
}

export const FlickeringGrid: React.FC<FlickeringGridProps> = ({
  squareSize = 4, gridGap = 6, flickerChance = 0.3,
  color = "rgb(99, 102, 241)", width, height,
  className, maxOpacity = 0.3, ...props
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  const memoizedColor = useMemo(() => {
    if (typeof window === "undefined") return "rgba(99,102,241,";
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d"); if (!ctx) return "rgba(99,102,241,";
    ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = Array.from(ctx.getImageData(0, 0, 1, 1).data);
    return `rgba(${r}, ${g}, ${b},`;
  }, [color]);

  const setupCanvas = useCallback((canvas: HTMLCanvasElement, w: number, h: number) => {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    const cols = Math.floor(w / (squareSize + gridGap));
    const rows = Math.floor(h / (squareSize + gridGap));
    const squares = new Float32Array(cols * rows);
    for (let i = 0; i < squares.length; i++) squares[i] = Math.random() * maxOpacity;
    return { cols, rows, squares, dpr };
  }, [squareSize, gridGap, maxOpacity]);

  const updateSquares = useCallback((squares: Float32Array, deltaTime: number) => {
    for (let i = 0; i < squares.length; i++) {
      if (Math.random() < flickerChance * deltaTime) squares[i] = Math.random() * maxOpacity;
    }
  }, [flickerChance, maxOpacity]);

  const drawGrid = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number, cols: number, rows: number, squares: Float32Array, dpr: number) => {
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      ctx.fillStyle = `${memoizedColor}${squares[i * rows + j]})`;
      ctx.fillRect(i * (squareSize + gridGap) * dpr, j * (squareSize + gridGap) * dpr, squareSize * dpr, squareSize * dpr);
    }
  }, [memoizedColor, squareSize, gridGap]);

  useEffect(() => {
    const canvas = canvasRef.current, container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    let animId: number, gridParams: ReturnType<typeof setupCanvas>;
    const updateSize = () => {
      const nw = width || container.clientWidth, nh = height || container.clientHeight;
      setCanvasSize({ width: nw, height: nh }); gridParams = setupCanvas(canvas, nw, nh);
    };
    updateSize();
    let lastTime = 0;
    const animate = (time: number) => {
      if (!isInView) return;
      const dt = (time - lastTime) / 1000; lastTime = time;
      updateSquares(gridParams.squares, dt);
      drawGrid(ctx, canvas.width, canvas.height, gridParams.cols, gridParams.rows, gridParams.squares, gridParams.dpr);
      animId = requestAnimationFrame(animate);
    };
    const ro = new ResizeObserver(updateSize); ro.observe(container);
    const io = new IntersectionObserver(([e]) => setIsInView(e!.isIntersecting), { threshold: 0 });
    io.observe(canvas);
    if (isInView) animId = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(animId); ro.disconnect(); io.disconnect(); };
  }, [setupCanvas, updateSquares, drawGrid, width, height, isInView]);

  return (
    <div ref={containerRef} className={`h-full w-full ${className || ''}`} {...props}>
      <canvas ref={canvasRef} className="pointer-events-none" style={{ width: canvasSize.width, height: canvasSize.height }} />
    </div>
  );
};
