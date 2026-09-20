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
  Flame: (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><path d="M12 2s5 4.5 5 9a5 5 0 0 1-10 0c0-1.5.6-2.8 1.3-3.8C9 8.6 10.5 7 12 2z" /></svg>,
  Share: (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" /><path d="M12 15V3M7 8l5-5 5 5" /></svg>,
  Grid: (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18M15 3v18M3 9h18M3 15h18" /></svg>,
  Crown: (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><path d="M4 18h16M4 18L3 8l5 3.5L12 5l4 6.5L21 8l-1 10" /></svg>,
  Eclipse: (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><circle cx="7.5" cy="12" r="3.4" /><path d="M7.5 5.6v1.3M7.5 17.1v1.3M1.4 12h1.3M12.3 12h-1.3M3.2 7.7l.9.9M10.9 15.4l.9.9M3.2 16.3l.9-.9M10.9 8.6l.9-.9" /><path d="M21.4 14.6A5.2 5.2 0 0 1 16.8 6a5.6 5.6 0 1 0 4.6 8.6z" /></svg>,
  Thread: (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><path d="M5 5h9a3 3 0 0 1 0 6H8a3 3 0 0 0 0 6h11" /><circle cx="5" cy="5" r="1.6" fill="currentColor" /><circle cx="19" cy="17" r="1.6" fill="currentColor" /></svg>,
  Quilt: (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><rect x="3" y="3" width="8" height="5" rx="1" /><rect x="13" y="3" width="8" height="9" rx="1" /><rect x="3" y="10" width="8" height="11" rx="1" /><rect x="13" y="14" width="8" height="7" rx="1" /></svg>,
};
