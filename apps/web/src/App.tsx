import { useEffect } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router';
import { localDateKey, makeSeed, randomToken, type Difficulty } from '@pb/engine';
import { useSession } from './lib/session';
import { Today } from './pages/Today';
import { NinePage } from './games/nine/NinePage';

const DIFFS: Difficulty[] = ['easy', 'normal', 'hard'];
const asDifficulty = (s: string | undefined): Difficulty => (DIFFS.includes(s as Difficulty) ? (s as Difficulty) : 'normal');

function DailyRedirect() {
  const { difficulty } = useParams();
  return <Navigate to={`/g/${makeSeed('nine', localDateKey(), asDifficulty(difficulty))}`} replace />;
}

function PracticeRedirect() {
  const { difficulty } = useParams();
  return <Navigate to={`/g/${makeSeed('nine', randomToken(), asDifficulty(difficulty))}`} replace />;
}

export function App() {
  const init = useSession((s) => s.init);
  useEffect(() => { void init(); }, [init]);

  return (
    <Routes>
      <Route path="/" element={<Today />} />
      <Route path="/nine" element={<DailyRedirect />} />
      <Route path="/nine/:difficulty" element={<DailyRedirect />} />
      <Route path="/practice/nine" element={<PracticeRedirect />} />
      <Route path="/practice/nine/:difficulty" element={<PracticeRedirect />} />
      <Route path="/g/:seed" element={<NinePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
