import type { SVGProps } from 'react';

const base: SVGProps<SVGSVGElement> = {
  width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
};

export const Icon = {
  Back: (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><path d="M15 18l-6-6 6-6" /></svg>,
  Pause: (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><path d="M9 5v14M15 5v14" /></svg>,
  Play: (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><path d="M6 4l14 8-14 8V4z" /></svg>,
  Undo: (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><path d="M3 7v6h6" /><path d="M3 13a9 9 0 1 0 3-7.7L3 8" /></svg>,
  Erase: (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><path d="M18 13l-6.5 6.5a2 2 0 0 1-2.8 0L4 15l9-9 5.5 5.5a2 2 0 0 1 0 2.8z" /><path d="M8 21h12" /></svg>,
  Pencil: (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><path d="M12 20h8" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z" /></svg>,
  Check: (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><path d="M20 6 9 17l-5-5" /></svg>,
  // A teardrop outline reads as water, not fire. The kink on the left edge and
  // the inner tongue are what make it a flame at 14px.
  Flame: (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><path d="M13 2.5c.3 2.6-1 4-2.4 5.3C9 9.2 7.5 10.6 7.5 13a4.5 4.5 0 0 0 9 0c0-2.4-1.1-4-2.2-5.4-.3 1-.9 1.7-1.7 2.2.2-2.6-.7-5.5-3.6-7.3" /><path d="M12 14.2c.6.5.9 1.1.9 1.8a1.9 1.9 0 0 1-3.8 0c0-1 .7-1.6 1.4-2.2" strokeWidth="1.3" opacity="0.7" /></svg>,
  Sweep: (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><path d="M3 21h6M6 21v-5l7-7 5 5-7 7" /><path d="M13 6l3-3 5 5-3 3" /></svg>,
  Share: (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" /><path d="M12 15V3M7 8l5-5 5 5" /></svg>,
};
