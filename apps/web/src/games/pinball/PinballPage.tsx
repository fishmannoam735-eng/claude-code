import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { localDateKey, type Difficulty } from '@pb/engine';
import { submitPinballScore } from '@pb/data';
import { supabase, useSession } from '../../lib/session';
import { PINBALL_LEVELS, PINBALL_TABLES, pinballUrl, type PinballTable } from './pinball';

/**
 * The pinball table, full screen. It runs in its own frame so its 3D scene,
 * sounds and touch handling stay apart from the app; it tells us when the
 * player wants to leave.
 */
export function PinballPage({ table = 'crown' }: { table?: PinballTable }) {
  const def = PINBALL_TABLES[table];
  const { level } = useParams();
  const navigate = useNavigate();
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      const d = e.data as { source?: string; type?: string; score?: number; level?: string } | null;
      if (d?.source !== def.source) return;
      if (d.type === 'exit') navigate('/', { replace: false });
      // Every finished game goes to the high-score board (each player's best counts).
      if (d.type === 'over' && typeof d.score === 'number' && d.score > 0) {
        const uid = useSession.getState().userId;
        const lv = PINBALL_LEVELS.find((l) => l === d.level);
        if (def.online && supabase && uid && lv) void submitPinballScore(supabase, uid, lv, d.score, localDateKey()).catch(() => { /* offline: the table still keeps its own best */ });
      }
    };
    window.addEventListener('message', onMessage);
    // The page underneath must not scroll or bounce while the table is up.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('message', onMessage); document.body.style.overflow = prev; };
  }, [navigate, def]);

  if (!PINBALL_LEVELS.includes(level as Difficulty)) return <Navigate to={`${def.route}/normal`} replace />;

  return (
    <div className="fixed inset-0 z-50" style={{ background: table === 'manor' ? '#050308' : '#0b0604' }}>
      {!ready && (
        <div className="absolute inset-x-0 bottom-[30%] text-center text-[15px] tracking-wide" style={{ color: table === 'manor' ? '#9dffc8' : '#ffd98a' }}>
          Setting up the table…
        </div>
      )}
      <iframe
        ref={frame}
        title={`${def.name} pinball`}
        src={pinballUrl(level as Difficulty, table)}
        allow="autoplay; fullscreen; screen-wake-lock"
        allowFullScreen
        onLoad={() => { setReady(true); frame.current?.focus(); }}
        className="absolute inset-0 h-full w-full border-0"
      />
    </div>
  );
}
