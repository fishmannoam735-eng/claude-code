import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import type { Difficulty } from '@pb/engine';
import { PINBALL_LEVELS, pinballUrl } from './pinball';

/**
 * The pinball table, full screen. It runs in its own frame so its 3D scene,
 * sounds and touch handling stay apart from the app; it tells us when the
 * player wants to leave.
 */
export function PinballPage() {
  const { level } = useParams();
  const navigate = useNavigate();
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      const d = e.data as { source?: string; type?: string } | null;
      if (d?.source !== 'crown-quest') return;
      if (d.type === 'exit') navigate('/', { replace: false });
    };
    window.addEventListener('message', onMessage);
    // The page underneath must not scroll or bounce while the table is up.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('message', onMessage); document.body.style.overflow = prev; };
  }, [navigate]);

  if (!PINBALL_LEVELS.includes(level as Difficulty)) return <Navigate to="/arcade/pinball/normal" replace />;

  return (
    <div className="fixed inset-0 z-50" style={{ background: '#0b0604' }}>
      {!ready && (
        <div className="absolute inset-x-0 bottom-[30%] text-center text-[15px] tracking-wide" style={{ color: '#ffd98a' }}>
          Setting up the table…
        </div>
      )}
      <iframe
        ref={frame}
        title="Crown Quest pinball"
        src={pinballUrl(level as Difficulty)}
        allow="autoplay; fullscreen; screen-wake-lock"
        allowFullScreen
        onLoad={() => { setReady(true); frame.current?.focus(); }}
        className="absolute inset-0 h-full w-full border-0"
      />
    </div>
  );
}
