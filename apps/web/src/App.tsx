import { useEffect } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router';
import { localDateKey, makeSeed, parseSeed, randomToken, type Difficulty, type GameId } from '@pb/engine';
import { useSession } from './lib/session';
import { Today } from './pages/Today';
import { NinePage } from './games/nine/NinePage';
import { EclipsePage } from './games/eclipse/EclipsePage';
import { CrownsPage } from './games/crowns/CrownsPage';

const DIFFS: Difficulty[] = ['easy', 'normal', 'hard'];
const PLAYABLE: GameId[] = ['nine', 'eclipse', 'crowns'];
const asDifficulty = (s: string | undefined): Difficulty => (DIFFS.includes(s as Difficulty) ? (s as Difficulty) : 'normal');
const asGame = (s: string | undefined): GameId => (PLAYABLE.includes(s as GameId) ? (s as GameId) : 'nine');

/** `/nine`, `/eclipse/hard` → today's board. An unknown game falls back home. */
function DailyRedirect() {
  const { game, difficulty } = useParams();
  if (!PLAYABLE.includes(game as GameId)) return <Navigate to="/" replace />;
  return <Navigate to={`/g/${makeSeed(asGame(game), localDateKey(), asDifficulty(difficulty))}`} replace />;
}

function PracticeRedirect() {
  const { game, difficulty } = useParams();
  if (!PLAYABLE.includes(game as GameId)) return <Navigate to="/" replace />;
  return <Navigate to={`/g/${makeSeed(asGame(game), randomToken(), asDifficulty(difficulty))}`} replace />;
}

/** One route for every board: the seed says which game to mount. */
function Board() {
  const { seed = '' } = useParams();
  const parsed = parseSeed(seed);
  if (!parsed) return <Navigate to="/" replace />;
  switch (parsed.game) {
    case 'eclipse': return <EclipsePage />;
    case 'crowns': return <CrownsPage />;
    case 'nine': return <NinePage />;
    default: return <Navigate to="/" replace />;
  }
}

export function App() {
  const init = useSession((s) => s.init);
  useEffect(() => { void init(); }, [init]);

  return (
    <Routes>
      <Route path="/" element={<Today />} />
      <Route path="/:game" element={<DailyRedirect />} />
      <Route path="/:game/:difficulty" element={<DailyRedirect />} />
      <Route path="/practice/:game" element={<PracticeRedirect />} />
      <Route path="/practice/:game/:difficulty" element={<PracticeRedirect />} />
      <Route path="/g/:seed" element={<Board />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
