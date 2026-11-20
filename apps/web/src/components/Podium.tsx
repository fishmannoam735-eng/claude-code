import { useState } from 'react';
import type { RankRow } from '@pb/data';
import { Avatar } from './Avatar';
import crownUrl from '../games/crowns/assets/crown.webp';
import { fmtPoints } from '../lib/contest';

/**
 * Today's top three on a wooden podium, putting on a new eight-second sketch
 * each time round: the shove, the crown heist, the podium selfie, the
 * dance-off, the snubbed high five, the champion's nap, the acceptance speech
 * and the step swap, each with a few scripts. An empty step keeps a cheeky
 * sign up.
 *
 * Transform and opacity only, one shared clock (CSS), and everything rests
 * on a calm still picture under reduced motion.
 */

type Slot = 'a' | 'b' | 'c' | 'd';
type Triple = [first: string, second: string, third: string];
interface Scene { id: string; slots: [Slot, Slot, Slot]; lines: Triple[] }

/**
 * Little sketches, one per loop. Each says who speaks when (slots a to d run
 * through the eight seconds) and has a few scripts, so the jokes keep coming.
 * Every scene moves the champion, whose loop drives the next one.
 */
const SCENES: Scene[] = [
  { id: 'shove', slots: ['c', 'b', 'd'], lines: [
    ['mine.', 'hey!', 'nice view up there?'],
    ['gg.', 'rude.', 'bronze is a vibe.'],
    ['no autographs.', 'I was standing there.', 'happy to be here.'],
    ['I’d like to thank my brain.', 'ref?!', 'I can see my house.'],
    ['easy.', 'unbelievable.', 'not getting involved.'],
    ['personal space is for 2nd place.', 'I’m telling the moderators.', 'popcorn, anyone?'],
  ] },
  { id: 'heist', slots: ['b', 'a', 'd'], lines: [
    ['hands off.', 'just admiring it.', 'I saw nothing.'],
    ['I can hear you breathing.', 'it was like that when I got here.', 'allegedly.'],
    ['nice try.', 'dusting it. you’re welcome.', 'witness for hire.'],
    ['it’s glued on.', 'worth a shot.', 'so close.'],
  ] },
  { id: 'selfie', slots: ['a', 'c', 'd'], lines: [
    ['say cheese.', 'get my good side.', 'am I in it?'],
    ['for the fans.', 'tag me.', 'I blinked.'],
    ['one more, bad light.', 'crop me in.', 'posting it anyway.'],
    ['podium selfie.', 'main character energy.', 'thumb in frame, sorry.'],
  ] },
  { id: 'dance', slots: ['a', 'c', 'd'], lines: [
    ['drop the beat.', 'this is humiliating.', 'I live for this.'],
    ['victory dance.', 'only doing this ironically.', 'is there a bronze dance?'],
    ['feel the winning.', 'my knees disagree.', 'again! again!'],
  ] },
  { id: 'fives', slots: ['b', 'c', 'a'], lines: [
    ['I don’t do fives.', 'up here!', 'high five?'],
    ['winners don’t touch hands.', 'I’ll take it!', 'fist bump, then?'],
    ['too sweaty.', 'left hanging, classic.', 'anyone? a three?'],
  ] },
  { id: 'nap', slots: ['c', 'a', 'b'], lines: [
    ['I’m awake. still first.', 'is it my turn now?', 'shhh, greatness is napping.'],
    ['wake me when it’s close.', 'unattended crown…', 'let the champ rest.'],
    ['five more minutes.', 'can I borrow the crown?', 'don’t poke the bear.'],
  ] },
  { id: 'speech', slots: ['a', 'c', 'd'], lines: [
    ['thank you, thank you.', 'slow clap.', 'speech! speech!'],
    ['couldn’t have done it without me.', 'we get it.', 'encore!'],
    ['no questions, please.', 'can we go home?', 'best speech ever.'],
  ] },
  { id: 'swap', slots: ['c', 'a', 'd'], lines: [
    ['nope.', 'my turn!', '10/10 for effort.'],
    ['read the plate.', 'just visiting!', 'the judges say no.'],
    ['this step is taken.', 'room for two?', 'rules are rules.'],
  ] },
];

const SEATS = [
  { i: 1, place: 2, step: 54, medal: 'silver' },
  { i: 0, place: 1, step: 76, medal: 'gold' },
  { i: 2, place: 3, step: 40, medal: 'bronze' },
] as const;

export function Podium({ top }: { top: RankRow[] }) {
  // Start somewhere different each visit, then go through the scenes in turn.
  const [start] = useState(() => Math.floor(Math.random() * SCENES.length * 4));
  const [round, setRound] = useState(start);
  const scene = SCENES[round % SCENES.length]!;
  const script = scene.lines[Math.floor(round / SCENES.length) % scene.lines.length]!;

  return (
    <div className="relative mt-3" aria-label="Top three">
      {/* A soft pool of light on the floor, under the winner. */}
      <div aria-hidden="true" className="pointer-events-none absolute bottom-0 left-1/2 h-24 w-[86%] -translate-x-1/2 rounded-[50%]" style={{ background: 'radial-gradient(closest-side, rgb(255 214 140 / 0.38), transparent)' }} />

      {/* The selfie's camera flash. */}
      <div key={`f${round}`} aria-hidden="true" className={`pb-pod-flash pointer-events-none absolute inset-0 rounded-[16px] ${round !== start ? 'pb-pod-again' : ''}`} style={{ background: 'radial-gradient(closest-side, rgb(255 255 255 / 0.9), transparent)', animationName: scene.id === 'selfie' ? undefined : 'none' }} />

      <ol className={`relative grid grid-cols-3 items-end gap-1.5 px-1 pt-12 pb-scene-${scene.id} ${round !== start ? 'pb-pod-again' : ''}`}>
        {SEATS.map(({ i, place, step, medal }) => {
          const row = top[i];
          return (
            <li key={place} className="flex min-w-0 flex-col items-center">
              {row ? (
                <div className={`pb-pod-hop pb-pod-hop-${place} relative flex flex-col items-center`}>
                  <div
                    key={round}
                    className={`pb-pod-act pb-pod-act-${place} relative flex flex-col items-center`}
                    onAnimationIteration={place === 1 ? (e) => { if (e.target === e.currentTarget) setRound((r) => r + 1); } : undefined}
                  >
                    <Bubble className={`pb-pod-say-${scene.slots[place - 1]} pb-pod-side-${place}`} side={place === 2 ? 'left' : place === 3 ? 'right' : 'center'}>
                      {script[place - 1]}
                    </Bubble>
                    {place === 1 && (
                      <img src={crownUrl} alt="" className="pb-pod-crown absolute -top-[22px] z-[2] h-7 w-7" style={{ filter: 'drop-shadow(0 2px 2px rgb(0 0 0 / 0.35))' }} />
                    )}
                    <div className="relative">
                      <Avatar name={row.nickname} colour={row.avatar} photo={row.photo} size={place === 1 ? 52 : 44} ring={row.is_me ? 'var(--color-accent)' : undefined} />
                      <div className="absolute -bottom-[9px] -right-[7px] z-[2]"><Medal kind={medal} place={place} /></div>
                    </div>
                  </div>
                </div>
              ) : (
                <EmptySeat place={place} />
              )}

              {/* The step: a lit top face and a wooden front with an engraved plate. */}
              <div className="pb-pod-step relative mt-1 w-full" style={{ ['--d' as string]: `${(3 - place) * 90}ms` }}>
                <div className={`pb-pod-cap pb-pod-cap-${medal} h-[9px] w-full`} />
                <div className="pb-wood relative flex w-full flex-col items-center rounded-b-[6px] pt-1.5" style={{ height: step }}>
                  <span className={`pb-pod-plate pb-pod-plate-${medal} flex h-[22px] min-w-[22px] items-center justify-center rounded-[6px] px-1.5 text-[13px] font-black leading-none`}>{place}</span>
                </div>
              </div>
              <div className="mt-1.5 flex w-full min-w-0 flex-col items-center text-center">
                <span className="w-full truncate text-[12.5px] font-bold text-ink">{row ? (row.is_me ? 'You' : row.nickname) : 'Vacant'}</span>
                <span className="text-[12px] font-extrabold tabular-nums text-ink-2">{row ? `${fmtPoints(row.score)} pts` : 'apply within'}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Bubble({ children, className, side }: { children: React.ReactNode; className: string; side: 'left' | 'right' | 'center' }) {
  const pos = side === 'left' ? 'left-[-14px]' : side === 'right' ? 'right-[-14px]' : 'left-1/2 -translate-x-1/2';
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute -top-[46px] z-[3] ${pos}`}>
      <div className={`pb-pod-say ${className} whitespace-nowrap rounded-[10px] border border-[#E9DCC4] bg-[#FFFBF2] px-2 py-1 text-[11px] font-semibold italic text-[#2A1A08] shadow-[0_4px_12px_-4px_rgb(0_0_0/0.5)]`}>
        {children}
      </div>
    </div>
  );
}

function Medal({ kind, place }: { kind: 'gold' | 'silver' | 'bronze'; place: number }) {
  return (
    <div aria-hidden="true" className="relative h-[24px] w-[20px]">
      <div className={`pb-pod-medal pb-pod-medal-${place} h-full w-full`}>
        <span className="absolute left-[4px] top-0 block h-[9px] w-[5px] -skew-x-[18deg] bg-[#C81E2B]" />
        <span className="absolute right-[4px] top-0 block h-[9px] w-[5px] skew-x-[18deg] bg-[#1F4FA8]" />
        <span className={`pb-medal-${place} absolute bottom-0 left-[2px] block h-[16px] w-[16px] rounded-full ring-1 ring-black/10`} data-kind={kind} />
      </div>
    </div>
  );
}

/** An empty step keeps a little sign up, and it wobbles. */
function EmptySeat({ place }: { place: number }) {
  return (
    <div className="relative flex h-[70px] flex-col items-center justify-end">
      <div className="pb-pod-sign origin-bottom">
        <div className="rounded-[5px] border border-[#7A5530] bg-[#FFF6E2] px-1.5 py-1 text-center text-[10px] font-bold leading-tight text-[#5A3A1A] shadow-[0_2px_0_#7A5530]">
          {place === 3 ? <>RESERVED<br /><span className="font-semibold italic">for you, probably</span></> : <>SEAT<br /><span className="font-semibold italic">still warm</span></>}
        </div>
        <div className="mx-auto h-[14px] w-[3px] bg-[#7A5530]" />
      </div>
    </div>
  );
}
