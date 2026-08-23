"use client";

import { useEffect, useRef } from "react";
import { THEME_EVENT } from "@/lib/theme";

type Palette = {
  accent: string;
  muted: string;
  line: string;
  glow: string;
  node: string;
  isDark: boolean;
};

function readPalette(): Palette {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback;
  const isDark = document.documentElement.getAttribute("data-theme") !== "light";
  const accent = v("--accent", isDark ? "#18B981" : "#087F5B");
  return {
    accent,
    muted: v("--text-muted", isDark ? "#66736C" : "#7B8781"),
    line: v("--border", isDark ? "#25312B" : "#DDE4E0"),
    glow: isDark ? "24, 185, 129" : "8, 127, 91",
    node: v("--accent-text", isDark ? "#6EE7B7" : "#087F5B"),
    isDark,
  };
}

function curveY(x: number, phase: number): number {
  const t = x + phase;
  return (
    0.58 +
    0.14 * Math.sin(t * Math.PI * 2) +
    0.06 * Math.sin(t * Math.PI * 4 + 0.7) +
    0.03 * Math.sin(t * Math.PI * 6 + 1.3)
  );
}

type Particle = { x: number; speed: number; size: number; alpha: number };
type Node = { x: number; drift: number; r: number };

function seedParticles(n: number): Particle[] {
  return Array.from({ length: n }, (_, i) => ({
    x: (i * 0.137) % 1,
    speed: 0.012 + (i % 5) * 0.004,
    size: 1 + (i % 3) * 0.4,
    alpha: 0.18 + (i % 4) * 0.08,
  }));
}

const NODES: Node[] = [
  { x: 0.16, drift: 0.4, r: 2.4 },
  { x: 0.34, drift: 1.1, r: 2.8 },
  { x: 0.52, drift: 0.2, r: 2.2 },
  { x: 0.71, drift: 1.7, r: 3.0 },
  { x: 0.86, drift: 0.8, r: 2.5 },
];

export function HeroCanvas() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const root = wrap;
    const surface = canvas;
    const g = ctx;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const particles = seedParticles(28);
    let pal = readPalette();
    let raf = 0;
    let running = true;
    const t0 = performance.now();

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = root.clientWidth;
      const h = root.clientHeight;
      surface.width = Math.max(1, Math.floor(w * dpr));
      surface.height = Math.max(1, Math.floor(h * dpr));
      surface.style.width = `${w}px`;
      surface.style.height = `${h}px`;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw(now: number) {
      const w = root.clientWidth;
      const h = root.clientHeight;
      if (w < 2 || h < 2) return;

      const period = 22000;
      const phase = reduce.matches ? 0.08 : ((now - t0) / period) % 1;
      const gridAlpha = pal.isDark ? 0.22 : 0.35;
      const curveAlpha = pal.isDark ? 0.55 : 0.42;
      const padX = w * 0.04;
      const padY = h * 0.18;
      const innerW = w - padX * 2;
      const innerH = h - padY * 2;

      g.clearRect(0, 0, w, h);

      g.strokeStyle = pal.line;
      g.lineWidth = 1;
      g.globalAlpha = gridAlpha;
      const gx = 14;
      const gy = 8;
      for (let i = 0; i <= gx; i++) {
        const x = padX + (i / gx) * innerW;
        g.beginPath();
        g.moveTo(x, padY);
        g.lineTo(x, padY + innerH);
        g.stroke();
      }
      for (let j = 0; j <= gy; j++) {
        const y = padY + (j / gy) * innerH;
        g.beginPath();
        g.moveTo(padX, y);
        g.lineTo(padX + innerW, y);
        g.stroke();
      }

      const pts: { x: number; y: number }[] = [];
      const steps = Math.max(80, Math.floor(innerW / 6));
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        pts.push({
          x: padX + u * innerW,
          y: padY + curveY(u, phase) * innerH,
        });
      }

      g.globalAlpha = pal.isDark ? 0.18 : 0.1;
      const mid = pts[Math.floor(pts.length * 0.62)];
      const glow = g.createRadialGradient(mid.x, mid.y, 8, mid.x, mid.y, Math.max(innerW, innerH) * 0.45);
      glow.addColorStop(0, `rgba(${pal.glow}, 0.55)`);
      glow.addColorStop(1, `rgba(${pal.glow}, 0)`);
      g.fillStyle = glow;
      g.fillRect(0, 0, w, h);

      g.globalAlpha = pal.isDark ? 0.12 : 0.08;
      g.beginPath();
      g.moveTo(pts[0].x, padY + innerH);
      for (const p of pts) g.lineTo(p.x, p.y);
      g.lineTo(pts[pts.length - 1].x, padY + innerH);
      g.closePath();
      g.fillStyle = `rgba(${pal.glow}, 1)`;
      g.fill();

      g.globalAlpha = curveAlpha;
      g.strokeStyle = pal.accent;
      g.lineWidth = 1.35;
      g.beginPath();
      g.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
      g.stroke();

      const nodePos = NODES.map((n) => {
        const nx = padX + n.x * innerW;
        const ny = padY + (curveY(n.x, phase) - 0.08 - 0.02 * Math.sin(phase * Math.PI * 2 + n.drift)) * innerH;
        return { x: nx, y: ny, r: n.r };
      });

      g.globalAlpha = pal.isDark ? 0.28 : 0.22;
      g.strokeStyle = pal.node;
      g.lineWidth = 0.8;
      g.beginPath();
      g.moveTo(nodePos[0].x, nodePos[0].y);
      for (let i = 1; i < nodePos.length; i++) g.lineTo(nodePos[i].x, nodePos[i].y);
      g.stroke();

      for (const n of nodePos) {
        g.globalAlpha = pal.isDark ? 0.16 : 0.12;
        g.beginPath();
        g.arc(n.x, n.y, n.r * 4.5, 0, Math.PI * 2);
        g.fillStyle = `rgba(${pal.glow}, 1)`;
        g.fill();
        g.globalAlpha = pal.isDark ? 0.85 : 0.7;
        g.beginPath();
        g.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        g.fillStyle = pal.node;
        g.fill();
      }

      if (!reduce.matches) {
        for (const p of particles) {
          p.x = (p.x + p.speed * 0.016) % 1;
          const x = padX + p.x * innerW;
          const y = padY + curveY(p.x, phase) * innerH;
          g.globalAlpha = p.alpha * (pal.isDark ? 0.9 : 0.55);
          g.beginPath();
          g.arc(x, y, p.size, 0, Math.PI * 2);
          g.fillStyle = pal.accent;
          g.fill();
        }
      }

      g.globalAlpha = 1;
    }

    function loop(now: number) {
      if (!running) return;
      draw(now);
      if (!reduce.matches) raf = requestAnimationFrame(loop);
    }

    function onTheme() {
      pal = readPalette();
      if (reduce.matches) draw(performance.now());
    }

    function onVis() {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!reduce.matches) {
        running = true;
        raf = requestAnimationFrame(loop);
      } else {
        draw(performance.now());
      }
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          running = false;
          cancelAnimationFrame(raf);
        } else if (!document.hidden) {
          running = true;
          if (reduce.matches) draw(performance.now());
          else raf = requestAnimationFrame(loop);
        }
      },
      { threshold: 0.05 },
    );

    resize();
    draw(performance.now());
    if (!reduce.matches) raf = requestAnimationFrame(loop);

    const ro = new ResizeObserver(() => {
      resize();
      if (reduce.matches) draw(performance.now());
    });
    ro.observe(root);
    io.observe(root);
    window.addEventListener(THEME_EVENT, onTheme);
    document.addEventListener("visibilitychange", onVis);
    reduce.addEventListener("change", onTheme);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener(THEME_EVENT, onTheme);
      document.removeEventListener("visibilitychange", onVis);
      reduce.removeEventListener("change", onTheme);
    };
  }, []);

  return (
    <div ref={wrapRef} className="hero-canvas" aria-hidden>
      <canvas ref={canvasRef} />
    </div>
  );
}
