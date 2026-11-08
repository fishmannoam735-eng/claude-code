import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { GameId } from '@pb/engine';
import crownUrl from '../games/crowns/assets/crown.webp';
import { fmtTime } from '../lib/format';

/**
 * The win moment, shared by every game. When a board is solved (the sound
 * hook fires `pb:win` at that instant) it plays, in order:
 *
 *  - the tray dips and jumps, and a wave of light runs across the tiles from
 *    the top-left corner, each tile lifting as it passes;
 *  - two confetti cannons fire from the bottom corners, then it rains a little.
 *    The confetti is the game's own pieces: crowns, suns and moons, numbered
 *    tiles, pipe bends or quilt patches, mixed with gold coins and pastel tiles;
 *  - once the board has had its moment, a gold "Solved!" plaque with the time rises in front of turning rays,
 *    then settles away and the page scrolls to the solved card.
 *
 * Reduced motion keeps the plaque, still, and drops everything that moves.
 */

const PASTELS = ['#C4B2EC', '#F7C4A8', '#AAE0C6', '#A0C8F0', '#F8E496', '#F0A094', '#ECA6D4'];

const LINE: Record<GameId, string> = {
  nine: 'Every row, column and box complete',
  eclipse: 'Every sun and moon in balance',
  crowns: 'Every crown in its place',
  thread: 'One pipe through every square',
  quilt: 'Every patch stitched in',
};

const reduced = (): boolean => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function WinCelebration({ game, elapsed }: { game: GameId; elapsed: () => number }) {
  const [run, setRun] = useState<{ k: number; ms: number } | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let n = 0;
    const onWin = () => {
      n += 1;
      setLeaving(false);
      setRun({ k: n, ms: elapsed() });
      try { navigator.vibrate?.([24, 60, 24, 60, 90]); } catch { /* not every phone */ }
      if (!reduced()) animateBoard();
    };
    window.addEventListener('pb:win', onWin);
    return () => window.removeEventListener('pb:win', onWin);
  }, [elapsed]);

  useEffect(() => {
    if (!run) return;
    const a = window.setTimeout(() => setLeaving(true), 3900);
    const b = window.setTimeout(() => {
      setRun(null);
      document.querySelector('[data-solved-card]')?.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' });
    }, 4400);
    return () => { window.clearTimeout(a); window.clearTimeout(b); };
  }, [run]);

  if (!run) return null;
  const close = () => setLeaving(true);

  return createPortal(
    <div className="fixed inset-0 z-50" onClick={close} role="status" aria-live="polite">
      <div className={`pb-win-veil absolute inset-0 ${leaving ? 'pb-win-out' : ''}`} />
      {/* Confetti flies over the board but behind the plaque, so the words stay readable. */}
      {!reduced() && <Confetti key={run.k} game={game} />}
      <div className={`absolute inset-x-0 top-[30%] flex justify-center px-6 ${leaving ? 'pb-win-out' : ''}`}>
        <div className="relative">
          <div className="pb-rays pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2" />
          <div className="pb-plaque relative flex min-w-[250px] flex-col items-center rounded-[26px] px-8 pb-5 pt-9 text-center">
            <img src={crownUrl} alt="" className="pb-crown-drop absolute -top-9 left-1/2 h-[68px] w-[68px] -translate-x-1/2"
              style={{ filter: 'drop-shadow(0 6px 6px rgb(90 55 5 / 0.45))' }} />
            <div className="pb-word text-[44px] font-extrabold leading-none tracking-[-0.02em]">Solved!</div>
            <div className="mt-2 text-[13px] font-semibold text-[#6B4512]">{LINE[game]}</div>
            <div className="mt-3 rounded-full bg-[rgb(90_55_10/0.14)] px-4 py-1 text-[22px] font-bold tabular-nums text-[#4A2E08]">
              {fmtTime(run.ms)}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Lift every tile in a wave from the top-left, and bounce the tray. */
function animateBoard(): void {
  const grid = document.querySelector('[role="grid"]');
  if (!grid) return;
  const tray = (grid.closest('[data-tray]') ?? grid) as HTMLElement;
  const box = tray.getBoundingClientRect();
  tray.animate(
    [
      { transform: 'scale(1)' },
      { transform: 'scale(0.965)', offset: 0.18 },
      { transform: 'scale(1.04)', offset: 0.5 },
      { transform: 'scale(0.995)', offset: 0.78 },
      { transform: 'scale(1)' },
    ],
    { duration: 950, easing: 'cubic-bezier(.3,.7,.3,1)' },
  );

  let tiles = Array.from(tray.querySelectorAll<HTMLElement>('[data-tile]'));
  if (!tiles.length) tiles = Array.from(tray.querySelectorAll<HTMLElement>('[role="gridcell"]'));
  for (const t of tiles) {
    const r = t.getBoundingClientRect();
    const k = ((r.left + r.width / 2 - box.left) + (r.top + r.height / 2 - box.top)) / (box.width + box.height);
    t.animate(
      [
        { transform: 'translateY(0) scale(1)', filter: 'brightness(1)' },
        { transform: 'translateY(-9%) scale(1.09)', filter: 'brightness(1.28) saturate(1.15)', offset: 0.4 },
        { transform: 'translateY(0) scale(1)', filter: 'brightness(1)' },
      ],
      { duration: 620, delay: 160 + k * 760, easing: 'cubic-bezier(.3,.7,.3,1)' },
    );
  }

  // A band of light that crosses the whole board once.
  const glint = document.createElement('div');
  glint.setAttribute('aria-hidden', 'true');
  Object.assign(glint.style, {
    position: 'absolute', inset: '0', overflow: 'hidden', pointerEvents: 'none', zIndex: '30', borderRadius: 'inherit',
  });
  const band = document.createElement('div');
  Object.assign(band.style, {
    position: 'absolute', top: '-30%', bottom: '-30%', width: '40%', left: '0',
    background: 'linear-gradient(90deg, transparent, rgb(255 250 225 / 0.65), transparent)',
    mixBlendMode: 'screen',
  });
  glint.appendChild(band);
  tray.appendChild(glint);
  band.animate(
    [{ transform: 'translateX(-120%) skewX(-20deg)' }, { transform: 'translateX(320%) skewX(-20deg)' }],
    { duration: 1100, delay: 250, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'both' },
  ).finished.finally(() => glint.remove());

  // Sparkles that twinkle over the board for a moment.
  for (let i = 0; i < 14; i++) {
    const s = document.createElement('div');
    s.setAttribute('aria-hidden', 'true');
    const size = 10 + Math.random() * 14;
    Object.assign(s.style, {
      position: 'absolute', zIndex: '31', pointerEvents: 'none',
      left: `${4 + Math.random() * 88}%`, top: `${4 + Math.random() * 88}%`, width: `${size}px`, height: `${size}px`,
      background: 'radial-gradient(circle, #fff 0 18%, rgb(255 236 160 / 0.9) 30%, transparent 70%)',
      clipPath: 'polygon(50% 0, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0 50%, 39% 39%)',
    });
    tray.appendChild(s);
    s.animate(
      [
        { opacity: 0, transform: 'scale(0) rotate(0deg)' },
        { opacity: 1, transform: 'scale(1.2) rotate(45deg)', offset: 0.4 },
        { opacity: 0, transform: 'scale(0.2) rotate(120deg)' },
      ],
      { duration: 900, delay: 300 + Math.random() * 1300, easing: 'ease-out', fill: 'both' },
    ).finished.finally(() => s.remove());
  }
}

type Kind = 'tile' | 'coin' | 'crown' | 'sun' | 'moon' | 'digit' | 'pipe' | 'patch';

interface Bit {
  x: number; y: number; vx: number; vy: number;
  rot: number; vr: number; flip: number; vf: number;
  size: number; kind: Kind; colour: string; digit: number; born: number;
}

const EXTRA: Record<GameId, Kind[]> = {
  crowns: ['crown', 'crown', 'tile'],
  eclipse: ['sun', 'moon', 'sun', 'moon'],
  nine: ['digit', 'digit', 'digit'],
  thread: ['pipe', 'pipe', 'pipe'],
  quilt: ['patch', 'patch', 'patch'],
};

/** Canvas confetti made of the game's own pieces, with a little 3D tumble. */
function Confetti({ game }: { game: GameId }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const c = canvas?.getContext('2d');
    if (!canvas || !c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = window.innerWidth, H = window.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    c.scale(dpr, dpr);

    const crown = new Image();
    crown.src = crownUrl;
    const pool: Kind[] = ['tile', 'tile', 'coin', 'coin', ...EXTRA[game]];
    const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)]!;
    const bits: Bit[] = [];
    const add = (x: number, y: number, angle: number, speed: number, born: number) => {
      const kind = pick(pool);
      bits.push({
        x, y,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.3,
        flip: Math.random() * Math.PI * 2, vf: 0.08 + Math.random() * 0.14,
        size: (kind === 'crown' ? 22 : kind === 'digit' ? 18 : 13) * (0.8 + Math.random() * 0.5),
        kind, colour: pick(PASTELS), digit: 1 + Math.floor(Math.random() * 9), born,
      });
    };
    // Two cannons from the bottom corners, aimed up and in.
    for (let i = 0; i < 70; i++) {
      add(-10, H * 0.92, -Math.PI / 2.6 + (Math.random() - 0.5) * 0.5, 16 + Math.random() * 10, Math.random() * 6);
      add(W + 10, H * 0.92, -Math.PI + Math.PI / 2.6 + (Math.random() - 0.5) * 0.5, 16 + Math.random() * 10, Math.random() * 6);
    }
    // Then a short rain from the top.
    for (let i = 0; i < 50; i++) add(Math.random() * W, -30, Math.PI / 2, 1 + Math.random() * 2, 30 + Math.random() * 50);

    let frame = 0;
    let raf = 0;
    const draw = (b: Bit) => {
      const s = b.size;
      const squash = Math.cos(b.flip);
      c.save();
      c.translate(b.x, b.y);
      c.rotate(b.rot);
      c.scale(1, Math.max(0.08, Math.abs(squash)));
      const shade = squash < 0 ? 0.82 : 1;
      c.globalAlpha = 1;
      switch (b.kind) {
        case 'tile': case 'patch': {
          c.fillStyle = b.colour;
          c.filter = `brightness(${shade})`;
          roundRect(c, -s / 2, -s / 2, s, s * (b.kind === 'patch' ? 0.7 : 1), s * 0.22);
          c.fill();
          c.fillStyle = 'rgb(255 255 255 / 0.45)';
          roundRect(c, -s / 2 + 2, -s / 2 + 2, s * 0.45, s * 0.2, s * 0.1);
          c.fill();
          if (b.kind === 'patch') {
            c.strokeStyle = 'rgb(90 60 30 / 0.5)'; c.setLineDash([2, 2]); c.lineWidth = 1;
            roundRect(c, -s / 2 + 2, -s / 2 + 2, s - 4, s * 0.7 - 4, s * 0.15); c.stroke();
          }
          break;
        }
        case 'coin': {
          const g = c.createRadialGradient(-s * 0.15, -s * 0.2, 1, 0, 0, s * 0.6);
          g.addColorStop(0, '#FFF6C4'); g.addColorStop(0.45, '#F2C14A'); g.addColorStop(1, '#B87A14');
          c.fillStyle = g;
          c.beginPath(); c.arc(0, 0, s * 0.5, 0, Math.PI * 2); c.fill();
          break;
        }
        case 'sun': {
          c.strokeStyle = '#E8A01C'; c.lineWidth = 2; c.lineCap = 'round';
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2;
            c.beginPath(); c.moveTo(Math.cos(a) * s * 0.45, Math.sin(a) * s * 0.45); c.lineTo(Math.cos(a) * s * 0.68, Math.sin(a) * s * 0.68); c.stroke();
          }
          const g = c.createRadialGradient(-s * 0.1, -s * 0.12, 1, 0, 0, s * 0.4);
          g.addColorStop(0, '#FFF6C4'); g.addColorStop(0.5, '#FFC93C'); g.addColorStop(1, '#E08A12');
          c.fillStyle = g; c.beginPath(); c.arc(0, 0, s * 0.36, 0, Math.PI * 2); c.fill();
          break;
        }
        case 'moon': {
          c.fillStyle = shade < 1 ? '#5B6DC4' : '#9DB0E8';
          c.beginPath();
          c.arc(0, 0, s * 0.5, Math.PI * 0.3, Math.PI * 1.7, false);
          c.arc(s * 0.22, -s * 0.05, s * 0.4, Math.PI * 1.55, Math.PI * 0.45, true);
          c.closePath(); c.fill();
          break;
        }
        case 'digit': {
          c.fillStyle = '#FBF3E2';
          roundRect(c, -s / 2, -s / 2, s, s, s * 0.2); c.fill();
          c.fillStyle = b.digit % 3 === 0 ? '#2C5F8A' : '#3B2A18';
          c.font = `700 ${s * 0.72}px Inter, system-ui, sans-serif`;
          c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillText(String(b.digit), 0, s * 0.04);
          break;
        }
        case 'pipe': {
          c.lineCap = 'round'; c.lineWidth = s * 0.42;
          c.strokeStyle = '#14505C'; c.beginPath(); c.arc(-s * 0.4, -s * 0.4, s * 0.8, 0, Math.PI / 2); c.stroke();
          c.lineWidth = s * 0.3; c.strokeStyle = '#2A8798'; c.stroke();
          c.lineWidth = s * 0.1; c.strokeStyle = '#A6E6F0'; c.beginPath(); c.arc(-s * 0.45, -s * 0.45, s * 0.78, 0.1, Math.PI / 2 - 0.1); c.stroke();
          break;
        }
        case 'crown': {
          if (crown.complete) c.drawImage(crown, -s / 2, -s / 2, s, s);
          break;
        }
      }
      c.restore();
    };

    // Steps are measured in 60fps frames of real time, so the arc is the same
    // on a 120Hz phone and a slow one.
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(3, (now - last) / (1000 / 60));
      last = now;
      frame += dt;
      c.clearRect(0, 0, W, H);
      let alive = 0;
      const drag = Math.pow(0.985, dt);
      for (const b of bits) {
        if (frame < b.born) { alive++; continue; }
        b.vy += 0.32 * dt;
        b.vx *= drag; b.vy *= drag;
        b.vx += Math.sin((frame + b.born * 7) / 14) * 0.05 * dt;
        b.x += b.vx * dt; b.y += b.vy * dt;
        b.rot += b.vr * dt; b.flip += b.vf * dt;
        if (b.y < H + 40) { alive++; draw(b); }
      }
      if (alive && frame < 420) raf = requestAnimationFrame(tick);
      else c.clearRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [game]);

  return <canvas ref={ref} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />;
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
