import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { claimTransferCode, makeTransferCode, updateProfile } from '@pb/data';
import { Icon } from '../components/Icon';
import { Avatar, AVATAR_COLOURS } from '../components/Avatar';
import { GameTile } from '../components/GameMark';
import { BarChart, StatTile } from '../components/Charts';
import { fmtTime } from '../lib/format';
import { supabase, useSession } from '../lib/session';
import { GAME_NAME, fmtPoints, useMe } from '../lib/contest';

const shortDay = (key: string): string => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y!, m! - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

const redirectHere = (): string => `${window.location.origin}${window.location.pathname}`;

export function Profile() {
  const userId = useSession((s) => s.userId);
  const sessionStatus = useSession((s) => s.status);
  const stats = useMe((s) => s.stats);
  const refresh = useMe((s) => s.refresh);

  useEffect(() => { if (userId) void refresh(); }, [userId, refresh]);

  return (
    <div className="relative min-h-dvh overflow-x-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[380px]"
        style={{ background: 'radial-gradient(120% 70% at 50% -10%, color-mix(in srgb, var(--color-accent) 22%, transparent) 0%, transparent 70%)' }}
      />
      <div className="relative mx-auto flex w-full max-w-[440px] flex-col px-4 pb-14">
        <header className="pb-rise flex items-center gap-3 pb-4 pt-5">
          <Link to="/" aria-label="Back to today" className="flex h-10 w-10 items-center justify-center rounded-xl border border-line-minor bg-raised text-ink">
            <Icon.Back />
          </Link>
          <h1 className="flex-grow text-[26px] font-bold leading-tight tracking-[-0.02em]">Your profile</h1>
          <Link to="/rankings" className="pb-key flex h-10 items-center gap-1.5 rounded-xl bg-raised px-3 text-[13px] font-bold text-accent-text">
            <Icon.Trophy width={16} height={16} /> Rankings
          </Link>
        </header>

        {sessionStatus === 'offline' || !supabase ? (
          <div className="rounded-xl bg-raised-2/70 px-3 py-2.5 text-[13px] text-ink-2">Your profile needs an internet connection. Your games still save on this phone.</div>
        ) : !stats ? (
          <div className="mt-8 text-center text-[13px] text-ink-2">Loading…</div>
        ) : (
          <>
            <NameCard nickname={stats.nickname} avatar={stats.avatar} userId={userId!} onSaved={refresh} />

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <StatTile value={fmtPoints(stats.personalScore)} label="Personal score" delay={60} />
              <StatTile value={fmtPoints(stats.contestScore)} label="Contest points" delay={110} />
              <StatTile value={stats.wins} label="Daily wins" icon={<Icon.Trophy width={18} height={18} />} delay={160} />
              <StatTile value={stats.streak} label="Day streak" icon={<Icon.Flame width={18} height={18} className="text-[#E07A1F]" />} delay={210} />
              <StatTile value={stats.solves} label="Boards solved" delay={260} />
              <StatTile value={stats.hintFree} label="Without hints" delay={310} />
            </div>

            <section className="pb-rise mt-3 rounded-[18px] border border-line-minor bg-raised p-3.5 shadow-[0_8px_24px_-14px_rgb(60_40_20/0.35)]" style={{ ['--d' as string]: '200ms' }}>
              <BarChart
                title="Your points, last 14 days"
                ariaLabel="Your contest and other points per day over the last 14 days"
                legend={[{ name: 'Contest', colour: 'var(--color-accent)' }, { name: 'Play again & practice', colour: '#E8CF9C' }]}
                data={stats.trend.map((d) => ({
                  key: d.date,
                  label: shortDay(d.date),
                  segments: [
                    { value: d.contest, colour: 'var(--color-accent)', name: 'contest' },
                    { value: Math.max(0, d.score - d.contest), colour: '#E8CF9C', name: 'other' },
                  ],
                }))}
              />
            </section>

            <section className="pb-rise mt-3 rounded-[18px] border border-line-minor bg-raised p-3.5 shadow-[0_8px_24px_-14px_rgb(60_40_20/0.35)]" style={{ ['--d' as string]: '260ms' }}>
              <h2 className="mb-2.5 text-[13px] font-semibold">By game</h2>
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.05em] text-ink-2">
                    <th className="pb-1.5 font-semibold">Game</th>
                    <th className="pb-1.5 text-right font-semibold">Solved</th>
                    <th className="pb-1.5 text-right font-semibold">Best</th>
                    <th className="pb-1.5 text-right font-semibold">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {(['nine', 'eclipse', 'crowns', 'thread', 'quilt'] as const).map((g) => {
                    const s = stats.games.find((x) => x.game === g);
                    return (
                      <tr key={g} className="border-t border-line-minor">
                        <td className="py-1.5"><span className="flex items-center gap-2 font-semibold"><GameTile game={g} className="h-6 w-6 rounded-[7px]" />{GAME_NAME[g]}</span></td>
                        <td className="py-1.5 text-right tabular-nums">{s?.solves ?? 0}</td>
                        <td className="py-1.5 text-right tabular-nums">{s?.bestMs != null ? fmtTime(s.bestMs) : '–'}</td>
                        <td className="py-1.5 text-right font-semibold tabular-nums">{fmtPoints(s?.score ?? 0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>

            <MovePhones hasEmail={stats.hasEmail} onMoved={refresh} />
          </>
        )}
      </div>
    </div>
  );
}

function NameCard({ nickname, avatar, userId, onSaved }: { nickname: string; avatar: number; userId: string; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(nickname);
  const [colour, setColour] = useState(avatar);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setName(nickname); setColour(avatar); }, [nickname, avatar]);

  const dirty = name.trim() !== nickname || colour !== avatar;
  const save = async (): Promise<void> => {
    const clean = name.trim().replace(/\s+/g, ' ');
    if (clean.length < 2 || clean.length > 20) { setMsg('Pick a name of 2 to 20 letters.'); return; }
    setBusy(true);
    try {
      await updateProfile(supabase!, userId, { nickname: clean, avatar: colour });
      await onSaved();
      setMsg('Saved. This is how you appear in the rankings.');
    } catch (e) {
      const code = (e as { code?: string }).code;
      setMsg(code === '23505' ? 'Someone already has that name. Try another.' : 'Could not save. Try again.');
    }
    setBusy(false);
  };

  return (
    <section className="pb-rise pb-wood rounded-[20px] p-3.5" style={{ ['--d' as string]: '40ms' }}>
      <div className="flex items-center gap-3.5">
        <Avatar name={name || nickname} colour={colour} size={64} />
        <div className="min-w-0 flex-grow">
          <label htmlFor="nick" className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-[#FBE9CC] [text-shadow:0_1px_1px_rgb(60_30_5/0.5)]">Your name in the rankings</label>
          <input
            id="nick"
            value={name}
            maxLength={20}
            onChange={(e) => { setName(e.target.value); setMsg(null); }}
            className="mt-1 h-11 w-full rounded-[10px] border-0 bg-[#FFF8EA] px-3 text-[16px] font-bold text-[#3B2A14] shadow-[inset_0_2px_4px_rgb(60_30_5/0.3)] outline-none focus:ring-2 focus:ring-[#F6D98A]"
          />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-6 gap-2 rounded-[12px] p-2" style={{ background: '#5C4028', boxShadow: 'inset 0 2px 6px rgb(30 18 8 / 0.65)' }} role="radiogroup" aria-label="Tile colour">
        {AVATAR_COLOURS.map(([r, g, b], i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={colour === i}
            aria-label={`Colour ${i + 1}`}
            onClick={() => { setColour(i); setMsg(null); }}
            className="aspect-square rounded-[8px] transition-transform active:scale-90"
            style={{
              background: `linear-gradient(135deg, rgb(${Math.min(255, r * 1.08)} ${Math.min(255, g * 1.08)} ${Math.min(255, b * 1.08)}), rgb(${r * 0.9} ${g * 0.9} ${b * 0.9}))`,
              boxShadow: colour === i ? '0 0 0 3px #F6D98A, 0 2px 0 rgb(0 0 0 / 0.3)' : '0 2px 0 rgb(0 0 0 / 0.3)',
              transform: colour === i ? 'scale(1.08)' : undefined,
            }}
          />
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          disabled={!dirty || busy}
          onClick={() => { void save(); }}
          className="pb-key h-10 rounded-xl px-5 text-[14px] font-bold disabled:opacity-50"
          style={{ background: 'linear-gradient(160deg, #FFF3CF 0%, #F6D98A 45%, #E8B44A 100%)', color: '#4E2E04', ['--key-side' as string]: '#9A6410' }}
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
        <span className="text-[12px] font-medium text-[#FBE9CC] [text-shadow:0_1px_1px_rgb(60_30_5/0.5)]" aria-live="polite">{msg ?? 'No sign-up needed. Change it any time.'}</span>
      </div>
    </section>
  );
}

/**
 * Two ways to take your score to another phone, both optional: a one-time
 * move code (works for everyone), or an email address.
 */
function MovePhones({ hasEmail, onMoved }: { hasEmail: boolean; onMoved: () => Promise<void> }) {
  const [code, setCode] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);

  const showCode = async (): Promise<void> => {
    try { setCode(await makeTransferCode(supabase!)); } catch { setMsg('Could not make a code. Try again.'); }
  };
  const claim = async (): Promise<void> => {
    try {
      const name = await claimTransferCode(supabase!, typed);
      await onMoved();
      setMsg(`Welcome back, ${name}. Your score is on this phone now.`);
      setTyped('');
    } catch {
      setMsg('That code did not work. Check it on your other phone.');
    }
  };
  const addEmail = async (): Promise<void> => {
    const { error } = await supabase!.auth.updateUser({ email: email.trim() }, { emailRedirectTo: redirectHere() });
    setEmailMsg(error ? `Could not add it: ${error.message}` : 'Check your inbox and tap the link to confirm.');
  };
  const signIn = async (): Promise<void> => {
    const { error } = await supabase!.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false, emailRedirectTo: redirectHere() } });
    setEmailMsg(error ? `Could not send it: ${error.message}` : 'Check your inbox and open the link on this phone.');
  };

  return (
    <section className="pb-rise mt-6" style={{ ['--d' as string]: '320ms' }}>
      <h2 className="px-1 text-[17px] font-bold tracking-tight">Keep your score on another phone</h2>
      <p className="mt-1 px-1 text-[12.5px] text-ink-2">Optional. Your score lives on this phone until you do one of these.</p>

      <div className="mt-3 rounded-[18px] border border-line-minor bg-raised p-3.5">
        <h3 className="text-[13.5px] font-bold">Move code</h3>
        <p className="mt-0.5 text-[12px] text-ink-2">Show a code here, then type it on the new phone. Everything moves across.</p>
        {code ? (
          <div className="mt-2.5 rounded-[12px] bg-raised-2 py-3 text-center text-[24px] font-extrabold tracking-[0.12em] tabular-nums">{code}</div>
        ) : (
          <button type="button" onClick={() => { void showCode(); }} className="pb-key mt-2.5 h-10 w-full rounded-xl bg-raised-2 text-[13.5px] font-semibold">Show my move code</button>
        )}
        <div className="mt-3 flex gap-2">
          <input
            value={typed}
            onChange={(e) => { setTyped(e.target.value); setMsg(null); }}
            placeholder="Code from your other phone"
            className="h-10 min-w-0 flex-grow rounded-xl border border-line-minor bg-board px-3 text-[14px] uppercase tracking-[0.08em] outline-none focus:border-accent"
          />
          <button type="button" disabled={typed.replace(/[^a-z0-9]/gi, '').length < 10} onClick={() => { void claim(); }} className="pb-key h-10 rounded-xl bg-accent px-4 text-[13.5px] font-bold text-ink disabled:opacity-50" style={{ ['--key-side' as string]: '#94621C' }}>Move here</button>
        </div>
        {msg && <p className="mt-2 text-[12.5px] font-medium text-accent-text" aria-live="polite">{msg}</p>}
      </div>

      <div className="mt-3 rounded-[18px] border border-line-minor bg-raised p-3.5">
        <h3 className="text-[13.5px] font-bold">Email {hasEmail && <span className="ml-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] text-success">added</span>}</h3>
        <p className="mt-0.5 text-[12px] text-ink-2">
          {hasEmail ? 'On a new phone, type the same email and tap Sign in.' : 'Add an email to sign in on any phone. No password, no Google account.'}
        </p>
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setEmailMsg(null); }}
          placeholder="you@example.com"
          className="mt-2.5 h-10 w-full rounded-xl border border-line-minor bg-board px-3 text-[14px] outline-none focus:border-accent"
        />
        <div className="mt-2 flex gap-2">
          {!hasEmail && <button type="button" disabled={!email.includes('@')} onClick={() => { void addEmail(); }} className="pb-key h-10 flex-grow basis-0 rounded-xl bg-accent text-[13.5px] font-bold text-ink disabled:opacity-50" style={{ ['--key-side' as string]: '#94621C' }}>Add email</button>}
          <button type="button" disabled={!email.includes('@')} onClick={() => { void signIn(); }} className="pb-key h-10 flex-grow basis-0 rounded-xl bg-raised-2 text-[13.5px] font-semibold disabled:opacity-50">Sign in</button>
        </div>
        {emailMsg && <p className="mt-2 text-[12.5px] font-medium text-accent-text" aria-live="polite">{emailMsg}</p>}
      </div>
    </section>
  );
}
