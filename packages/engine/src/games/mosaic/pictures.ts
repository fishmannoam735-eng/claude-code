import type { Difficulty } from '../../types.js';

/**
 * The hand-drawn pictures behind Mosaic boards. Each is pixel art written as
 * rows of letters:
 *
 *   - an UPPER-case letter is a square of the picture: it is part of the
 *     puzzle, and the player fills it;
 *   - a lower-case letter is decoration that only appears once the picture
 *     comes to life (an eye, a bubble, a wisp of steam). It sits on a square
 *     the player leaves empty;
 *   - `.` is open background.
 *
 * `ink` gives every letter its colour. `parts` groups letters that move
 * together, and `motion` says how each part moves once the board is solved
 * (`*` is the whole picture). Pivots are in squares from the top-left corner.
 * Every picture here has exactly one answer that row-and-column logic alone
 * reaches (the tests check this), so no board ever needs a guess.
 */
export type MotionKind =
  | 'pulse' | 'twinkle' | 'blink' | 'twitch' | 'swim' | 'wag' | 'rise' | 'squash'
  | 'rock' | 'flutter' | 'bob' | 'flap' | 'flyaway' | 'sway' | 'launch' | 'flicker'
  | 'crawl' | 'wave' | 'hop' | 'spout' | 'tilt' | 'snap' | 'sidestep' | 'pant'
  | 'puff' | 'jump' | 'spin' | 'waddle' | 'float' | 'steam' | 'rattle' | 'bounce'
  | 'flapL' | 'flapR' | 'flop' | 'tentacles';

export interface Motion {
  part: string;
  kind: MotionKind;
  /** Pivot, in squares from the top-left (x across, y down). */
  at?: [number, number];
  /** Start this many ms later, so two ears don't twitch together. */
  delay?: number;
}

export interface Picture {
  id: string;
  /** What the picture is, for the solved card: "a cat". */
  name: string;
  /** What it does when it comes to life, finishing "The cat …". */
  alive: string;
  art: string[];
  ink: Record<string, string>;
  /** The scene behind the picture once it comes to life. */
  bg: string;
  parts?: Record<string, string>;
  motion: Motion[];
  /** Decorations drawn as round dots (bubbles, steam) or little stars instead of squares. */
  shape?: Record<string, 'round' | 'star'>;
}

const EASY: Picture[] = [
  {
    id: 'heart', name: 'a heart', alive: 'The heart beats',
    art: [
      '.RR..RR.',
      'RWRRRRRR',
      'RRRRRRRR',
      'RRRRRRRR',
      '.RRRRRR.',
      '..RRRR..',
      '...RR...',
      '.s....s.',
    ],
    ink: { R: '#E8505B', W: '#FFD6DA', s: '#FFFFFF' },
    bg: '#FBE3E6',
    parts: { shine: 'W', sparkle: 's' },
    shape: { s: 'star' },
    motion: [{ part: '*', kind: 'pulse', at: [4, 3.5] }, { part: 'shine', kind: 'twinkle' }, { part: 'sparkle', kind: 'twinkle', delay: 600 }],
  },
  {
    id: 'catface', name: 'a kitten', alive: 'The kitten blinks and twitches its ears',
    art: [
      'LL....QQ',
      'LPL..QOQ',
      'KKKKKKKK',
      'KeeKKeeK',
      'KKKKKKKK',
      'KKKnnKKK',
      '.KKKKKK.',
      '..KKKK..',
    ],
    ink: { L: '#F0A04B', Q: '#F0A04B', P: '#F7B6C0', O: '#F7B6C0', K: '#F0A04B', e: '#3B7A3A', n: '#E86F86' },
    bg: '#F6E7C8',
    parts: { earL: 'LP', earR: 'QO', eyes: 'e' },
    motion: [
      { part: 'eyes', kind: 'blink', at: [4, 3.5] },
      { part: 'earL', kind: 'twitch', at: [1.5, 2] },
      { part: 'earR', kind: 'twitch', at: [6.5, 2], delay: 900 },
      { part: '*', kind: 'tilt', at: [4, 8] },
    ],
  },
  {
    id: 'fish', name: 'a goldfish', alive: 'The goldfish swims',
    art: [
      '.....o..',
      '....FF..',
      'T..FFFFo',
      'TTFFFeFF',
      'TTFFFFFF',
      'TTFFFFFF',
      'T..FFFF.',
      '....FF..',
    ],
    ink: { T: '#E8743B', F: '#F4A23C', e: '#2A2A2A', o: '#FFFFFF' },
    bg: '#BFE3EE',
    parts: { tail: 'T', bubbles: 'o' },
    shape: { o: 'round' },
    motion: [{ part: '*', kind: 'swim', at: [4, 4] }, { part: 'tail', kind: 'wag', at: [2, 4.5] }, { part: 'bubbles', kind: 'rise' }],
  },
  {
    id: 'mushroom', name: 'a toadstool', alive: 'The toadstool bounces',
    art: [
      '..RRRR..',
      '.RRWWRR.',
      'RWRRRRWR',
      'RRRRRRRR',
      '...SS...',
      '..SSSS..',
      '..SSSS..',
      'GGGGGGGG',
    ],
    ink: { R: '#D9483B', W: '#FFF6EA', S: '#F3E3C3', G: '#6DB85A' },
    bg: '#DCEFD2',
    parts: { shroom: 'RWS' },
    motion: [{ part: 'shroom', kind: 'squash', at: [4, 7] }],
  },
  {
    id: 'sailboat', name: 'a sailboat', alive: 'The sailboat rocks on the waves',
    art: [
      '...MFF..',
      '..SM....',
      '.SSMS...',
      '.SSMSS..',
      'SSSMSSS.',
      '...M....',
      'HHHHHHHH',
      '.HHHHHH.',
    ],
    ink: { M: '#8A5A2B', F: '#E8505B', S: '#FFFFFF', H: '#C0733A' },
    bg: '#CFE9F5',
    parts: { flag: 'F' },
    motion: [{ part: '*', kind: 'rock', at: [4, 8] }, { part: 'flag', kind: 'flutter', at: [4, 0.5] }],
  },
  {
    id: 'duck', name: 'a duckling', alive: 'The duckling paddles and flaps',
    art: [
      '..YYY...',
      '.YYeY...',
      'BBYYY...',
      '...YY...',
      '.YYWWYYY',
      '.YYWWWYY',
      '..YYYYY.',
      'w..w..w.',
    ],
    ink: { Y: '#F6CF3E', B: '#F08A2C', W: '#FBE38A', e: '#2A2A2A', w: '#FFFFFF' },
    bg: '#CBE7F0',
    parts: { wing: 'W', eye: 'e', ripples: 'w' },
    shape: { w: 'round' },
    motion: [
      { part: '*', kind: 'bob', at: [4, 7] },
      { part: 'wing', kind: 'flap', at: [3, 4.5] },
      { part: 'eye', kind: 'blink', at: [3.5, 1.5] },
      { part: 'ripples', kind: 'twinkle' },
    ],
  },
  {
    id: 'flower', name: 'a flower', alive: 'The flower sways in the breeze',
    art: [
      '..P.P...',
      '.PPPPP..',
      'PPPYPPP.',
      '.PPPPP..',
      '..PGP...',
      '...G.LL.',
      '.LLGLL..',
      '...G....',
    ],
    ink: { P: '#F28CB8', Y: '#F6C744', G: '#4E9A3E', L: '#6DB85A' },
    bg: '#E4F2DC',
    parts: { bloom: 'PY', leaves: 'L' },
    motion: [{ part: '*', kind: 'sway', at: [3.5, 8] }, { part: 'bloom', kind: 'pulse', at: [3.5, 2.5] }, { part: 'leaves', kind: 'sway', at: [3.5, 6.5], delay: 400 }],
  },
  {
    id: 'ghost', name: 'a friendly ghost', alive: 'The ghost floats and blinks',
    art: [
      '..GGGG..',
      '.GGGGGG.',
      'GGeGGeGG',
      'GGeGGeGG',
      'GGGGGGGG',
      'GGGmmGGG',
      'GGGGGGGG',
      'GG.GG.GG',
    ],
    ink: { G: '#FFFFFF', e: '#2D2A4A', m: '#E57A9A' },
    bg: '#D9D2EE',
    parts: { eyes: 'e' },
    motion: [{ part: '*', kind: 'float', at: [4, 4] }, { part: 'eyes', kind: 'blink', at: [4, 3] }],
  },
];

const NORMAL: Picture[] = [
  {
    id: 'cat', name: 'a cat', alive: 'The cat blinks and wags its tail',
    art: [
      '..K...K...',
      '..KK.KK...',
      '..KKKKK...',
      '..KeKeK...',
      '..KKnKK...',
      '...KKK....',
      '..KKKKK.TT',
      '.KKKKKKK.T',
      '.KKKKKKK.T',
      '.KKWKWKKTT',
    ],
    ink: { K: '#7A7F8C', T: '#7A7F8C', W: '#F2F2F2', e: '#8BD06A', n: '#E86F86' },
    bg: '#F6E7C8',
    parts: { tail: 'T', eyes: 'e' },
    motion: [{ part: 'eyes', kind: 'blink', at: [4.5, 3.5] }, { part: 'tail', kind: 'wag', at: [8, 9.5] }],
  },
  {
    id: 'bird', name: 'a robin', alive: 'The robin flaps its wings and flies away',
    art: [
      '......BBB.',
      '.....BBeBY',
      '.....BBBB.',
      '.BB.BBBBB.',
      '..BBRRRBB.',
      '...BRRRRB.',
      '...WWWRRB.',
      '....WWWB..',
      '.....L.L..',
      '..........',
    ],
    ink: { B: '#6A5240', Y: '#F0A030', R: '#E26A3C', W: '#4E3B2D', L: '#8A6A4A', e: '#111111' },
    bg: '#CFE9F5',
    parts: { wing: 'W' },
    motion: [{ part: '*', kind: 'flyaway', at: [5, 5] }, { part: 'wing', kind: 'flap', at: [5, 6] }],
  },
  {
    id: 'rocket', name: 'a rocket', alive: 'The rocket blasts off',
    art: [
      '....RR....',
      '...RWWR...',
      '...WWWW...',
      '...WbbW...',
      '...WbbW...',
      '...WWWW...',
      '..RWWWWR..',
      '.RRWWWWRR.',
      '.R.FFFF.R.',
      's...FF...s',
    ],
    ink: { R: '#E8505B', W: '#F2F2F2', F: '#F6A33C', b: '#6FC3E8', s: '#FFF3B0' },
    bg: '#20304F',
    parts: { flame: 'F', stars: 's' },
    shape: { s: 'star' },
    motion: [{ part: '*', kind: 'launch', at: [5, 5] }, { part: 'flame', kind: 'flicker', at: [5, 8] }, { part: 'stars', kind: 'twinkle' }],
  },
  {
    id: 'snail', name: 'a snail', alive: 'The snail creeps along',
    art: [
      '.A..A.....',
      '..A.A.SSS.',
      '..HHHSSSSS',
      '..HeHSsSSS',
      '..HHHSSsSS',
      '..HHHSSSSS',
      '..HHHHSSS.',
      'HHHHHHHHHH',
      '..........',
      'gggggggggg',
    ],
    ink: { A: '#B88A5A', H: '#D9B98C', S: '#C0733A', s: '#8A4F22', e: '#2A2A2A', g: '#6DB85A' },
    bg: '#E4F2DC',
    parts: { feelers: 'A', snail: 'AHSse', grass: 'g' },
    motion: [{ part: 'snail', kind: 'crawl' }, { part: 'feelers', kind: 'wave', at: [3, 2] }],
  },
  {
    id: 'tree', name: 'an apple tree', alive: 'The apple tree sways',
    art: [
      '...GGGG...',
      '..GGGGGG..',
      '.GGRGGGGG.',
      '.GGGGGRGG.',
      'GGGGGGGGGG',
      '.GRGGGGGG.',
      '..GGGGGG..',
      '....TT....',
      '....TT....',
      '..TTTTTT..',
    ],
    ink: { G: '#5BAA4A', R: '#E2453A', T: '#8A5A2B' },
    bg: '#DDEFF7',
    parts: { crown: 'GR' },
    motion: [{ part: 'crown', kind: 'sway', at: [5, 7.5] }],
  },
  {
    id: 'teapot', name: 'a teapot', alive: 'The teapot steams',
    art: [
      '....s.s...',
      '...s.s....',
      '....LL....',
      '..LLLLLL..',
      'H.PPPPPP.S',
      'HHPPPPPPSS',
      'H.PPPPPPS.',
      'HHPPPPPP..',
      '..PPPPPP..',
      '.BBBBBBBB.',
    ],
    ink: { L: '#5C8FB8', P: '#7FB3D9', H: '#5C8FB8', S: '#5C8FB8', B: '#5C8FB8', s: '#FFFFFF' },
    bg: '#E6CFAF',
    parts: { lid: 'L', steam: 's' },
    shape: { s: 'round' },
    motion: [{ part: 'steam', kind: 'steam' }, { part: 'lid', kind: 'rattle', at: [5, 4] }],
  },
  {
    id: 'bunny', name: 'a bunny', alive: 'The bunny hops',
    art: [
      '..EE..EE..',
      '..EP..PE..',
      '..EE..EE..',
      '..EE..EE..',
      '..BBBBBB..',
      '.BBeBBeBB.',
      '.BBBnnBBB.',
      '..BBBBBB..',
      '.BBBBBBBB.',
      '.BB.BB.BB.',
    ],
    ink: { E: '#F8F5F0', P: '#F7B6C0', B: '#F8F5F0', e: '#2A2A2A', n: '#E86F86' },
    bg: '#A9D48F',
    parts: { ears: 'EP', eyes: 'e', nose: 'n' },
    motion: [
      { part: '*', kind: 'hop', at: [5, 10] },
      { part: 'ears', kind: 'twitch', at: [5, 4] },
      { part: 'eyes', kind: 'blink', at: [5, 5.5] },
      { part: 'nose', kind: 'twitch', at: [5, 6.5], delay: 300 },
    ],
  },
  {
    id: 'whale', name: 'a whale', alive: 'The whale bobs and spouts',
    art: [
      '...S.S....',
      '....S.....',
      '....S.....',
      '..WWWWW...',
      '.WWWWWWW.T',
      '.WeWWWWWTT',
      'WWWWWWWWWT',
      'WBBBBBWW..',
      '.WBBBBW...',
      'w...w...w.',
    ],
    ink: { S: '#E9F7FC', W: '#3F7FB5', T: '#3F7FB5', B: '#A9D3EE', e: '#0E2236', w: '#FFFFFF' },
    bg: '#BFE3EE',
    parts: { spout: 'S', tail: 'T', eye: 'e', whale: 'SWTBe', waves: 'w' },
    shape: { w: 'round' },
    motion: [
      { part: 'whale', kind: 'bob', at: [5, 6] },
      { part: 'spout', kind: 'spout', at: [4.5, 3] },
      { part: 'tail', kind: 'wag', at: [8.5, 6] },
      { part: 'eye', kind: 'blink', at: [2.5, 5.5] },
      { part: 'waves', kind: 'twinkle' },
    ],
  },
];

const HARD: Picture[] = [
  {
    id: 'owl', name: 'an owl', alive: 'The owl blinks and tilts its head',
    art: [
      '.T........T.',
      '.TT......TT.',
      '..OOOOOOOO..',
      '.OWWWOOWWWO.',
      '.OWeWOOWeWO.',
      '.OWWWYYWWWO.',
      '.OOOOOOOOOO.',
      '.OOBBBBBBOO.',
      '.OBCBBBBCBO.',
      '.OBBBCCBBBO.',
      '..OOBBBBOO..',
      'KKKFFKKFFKKK',
    ],
    ink: { T: '#8A5A3B', O: '#A86F45', W: '#F6EBD0', e: '#1E1E1E', Y: '#F0A030', B: '#E9CFA5', C: '#B98A5A', F: '#F0A030', K: '#6B4426' },
    bg: '#2E3F5C',
    parts: { owl: 'TOWeYBCF', eyes: 'e', tufts: 'T' },
    motion: [
      { part: 'owl', kind: 'tilt', at: [6, 11] },
      { part: 'eyes', kind: 'blink', at: [6, 4.5] },
      { part: 'tufts', kind: 'twitch', at: [6, 2], delay: 700 },
    ],
  },
  {
    id: 'butterfly', name: 'a butterfly', alive: 'The butterfly flutters',
    art: [
      '...A....A...',
      '....A..A....',
      '.PPP.BB.QQQ.',
      'PPOPPBBQQUQQ',
      'POOOPBBQUUUQ',
      'PPOPPBBQQUQQ',
      '.PPPPBBQQQQ.',
      '..PPPBBQQQ..',
      '.PPYPBBQVQQ.',
      '.PYYPBBQVVQ.',
      '.PPPP..QQQQ.',
      '..PP....QQ..',
    ],
    ink: { A: '#3A2E3E', B: '#3A2E3E', P: '#7A6FE0', Q: '#7A6FE0', O: '#F6A33C', U: '#F6A33C', Y: '#F6D44C', V: '#F6D44C' },
    bg: '#DDF0E2',
    parts: { wingL: 'POY', wingR: 'QUV' },
    motion: [
      { part: '*', kind: 'float', at: [6, 6] },
      { part: 'wingL', kind: 'flapL', at: [5.5, 6] },
      { part: 'wingR', kind: 'flapR', at: [6.5, 6] },
    ],
  },
  {
    id: 'crab', name: 'a crab', alive: 'The crab snaps its claws and scuttles',
    art: [
      'CC........DD',
      'C.C......D.D',
      'CCC.E..E.DDD',
      '.C..S..S..D.',
      '.C.RRRRRR.D.',
      '..RRRRRRRR..',
      '.RRRRRRRRRR.',
      'RRRRRRRRRRRR',
      '.RRRRRRRRRR.',
      'R.RRRRRRRR.R',
      'R.R.R..R.R.R',
      '.R........R.',
    ],
    ink: { C: '#E24E3A', D: '#E24E3A', R: '#E8643F', E: '#1E1E1E', S: '#E8643F' },
    bg: '#F6E3C2',
    parts: { clawL: 'C', clawR: 'D', eyes: 'E' },
    motion: [
      { part: '*', kind: 'sidestep' },
      { part: 'clawL', kind: 'snap', at: [1.5, 4] },
      { part: 'clawR', kind: 'snap', at: [10.5, 4], delay: 350 },
      { part: 'eyes', kind: 'blink', at: [6, 2.5] },
    ],
  },
  {
    id: 'dog', name: 'a puppy', alive: 'The puppy pants and flops its ears',
    art: [
      '.EE......FF.',
      'EEEDDDDDDFFF',
      'EEDDDDDDDDFF',
      'EEDeDDDDeDFF',
      'EEDDDDDDDDFF',
      'EEDDDNNDDDFF',
      '.EDDDNNDDDF.',
      '..DDWWWWDD..',
      '..DWWWWWWD..',
      '...WWTTWW...',
      '....WTTW....',
      '.....TT.....',
    ],
    ink: { E: '#7A4A2A', F: '#7A4A2A', D: '#D9A066', e: '#1E1E1E', N: '#2A2020', W: '#F6EBD8', T: '#E86F86' },
    bg: '#DCEBF6',
    parts: { earL: 'E', earR: 'F', tongue: 'T', eyes: 'e' },
    motion: [
      { part: 'tongue', kind: 'pant', at: [6, 9] },
      { part: 'earL', kind: 'flop', at: [2, 1] },
      { part: 'earR', kind: 'flop', at: [10, 1], delay: 250 },
      { part: 'eyes', kind: 'blink', at: [6, 3.5] },
    ],
  },
  {
    id: 'frog', name: 'a frog', alive: 'The frog puffs up and jumps',
    art: [
      '.GGG....GGG.',
      'GWWWG..GWWWG',
      'GWeWGGGGWeWG',
      'GGGGGGGGGGGG',
      'GGmmmmmmmmGG',
      '.GGGGGGGGGG.',
      '..GGLLLLGG..',
      '.GGLLLLLLGG.',
      'GGGLLLLLLGGG',
      'GG.GLLLLG.GG',
      'G..GG..GG..G',
      'FF.FF..FF.FF',
    ],
    ink: { G: '#5BB04A', W: '#FFFFFF', e: '#1E1E1E', m: '#B83A3A', L: '#BFE39A', F: '#5BB04A' },
    bg: '#CFE9F5',
    parts: { belly: 'L', eyes: 'e' },
    motion: [
      { part: '*', kind: 'jump', at: [6, 12] },
      { part: 'belly', kind: 'puff', at: [6, 7.5] },
      { part: 'eyes', kind: 'blink', at: [6, 2.5] },
    ],
  },
  {
    id: 'car', name: 'a little car', alive: 'The car drives off',
    art: [
      '............',
      'p...........',
      '.p..RRRRR...',
      '...RWWRWWR..',
      '..RRWWRWWRR.',
      'RRRRRRRRRRRR',
      'RRRRRRRRRRRY',
      'RRRRRRRRRRRR',
      'RRKKKRRRJJJR',
      '..KHK...JIJ.',
      '..KKK...JJJ.',
      'gggggggggggg',
    ],
    ink: { R: '#E2453A', W: '#BFE6F5', Y: '#F6D44C', K: '#2A2A2A', H: '#B0B0B0', J: '#2A2A2A', I: '#B0B0B0', g: '#8A8A8A', p: '#FFFFFF' },
    bg: '#DDEFF7',
    parts: { body: 'RWY', wheelL: 'KH', wheelR: 'JI', puff: 'p', road: 'g' },
    shape: { p: 'round' },
    motion: [
      { part: 'body', kind: 'bounce', at: [6, 8] },
      { part: 'wheelL', kind: 'spin', at: [3.5, 9.5] },
      { part: 'wheelR', kind: 'spin', at: [9.5, 9.5] },
      { part: 'puff', kind: 'steam' },
    ],
  },
  {
    id: 'penguin', name: 'a penguin', alive: 'The penguin waddles and flaps',
    art: [
      '....KKKK....',
      '...KKKKKK...',
      '..KWeWWeWK..',
      '..KWWYYWWK..',
      '..KKWWWWKK..',
      '.LKWWWWWWKR.',
      'LLKWWWWWWKRR',
      'L.KWWWWWWK.R',
      '..KWWWWWWK..',
      '..KKWWWWKK..',
      '...KKKKKK...',
      '..FFF..FFF..',
    ],
    ink: { K: '#26303C', L: '#26303C', R: '#26303C', W: '#FFFFFF', e: '#26303C', Y: '#F0A030', F: '#F0A030' },
    bg: '#D6ECF6',
    parts: { flipL: 'L', flipR: 'R', eyes: 'e' },
    motion: [
      { part: '*', kind: 'waddle', at: [6, 12] },
      { part: 'flipL', kind: 'flapL', at: [2, 5] },
      { part: 'flipR', kind: 'flapR', at: [10, 5] },
      { part: 'eyes', kind: 'blink', at: [6, 2.5] },
    ],
  },
  {
    id: 'octopus', name: 'an octopus', alive: 'The octopus waves its arms',
    art: [
      '....PPPP....',
      '..PPPPPPPP..',
      '.PPPPPPPPPP.',
      '.PWWPPPPWWP.',
      '.PWePPPPWeP.',
      '.PPPPPPPPPP.',
      'PPPPPPPPPPPP',
      'TT.TT..TT.TT',
      'T..T.TT.T..T',
      'T.T..TT..T.T',
      '.T..T..T..T.',
      '..o.....o...',
    ],
    ink: { P: '#E37BB0', T: '#E37BB0', W: '#FFFFFF', e: '#2A1E2E', o: '#FFFFFF' },
    bg: '#BFE3EE',
    parts: { arms: 'T', eyes: 'e', bubbles: 'o' },
    shape: { o: 'round' },
    motion: [
      { part: '*', kind: 'float', at: [6, 6] },
      { part: 'arms', kind: 'tentacles', at: [6, 7] },
      { part: 'eyes', kind: 'blink', at: [6, 4] },
      { part: 'bubbles', kind: 'rise' },
    ],
  },
];

export const PICTURES: Record<Difficulty, readonly Picture[]> = { easy: EASY, normal: NORMAL, hard: HARD };

const BY_ID = new Map<string, Picture>([...EASY, ...NORMAL, ...HARD].map((p) => [p.id, p]));
export const pictureById = (id: string): Picture | undefined => BY_ID.get(id);

/** Board side for each difficulty. */
export const SIDES: Record<Difficulty, number> = { easy: 8, normal: 10, hard: 12 };

/** Which part a letter moves with (`body` when it isn't in any part). Inner parts win over outer ones. */
export function partOf(p: Picture, ch: string): string {
  let best = 'body', size = Infinity;
  for (const [name, letters] of Object.entries(p.parts ?? {})) {
    if (letters.includes(ch) && letters.length < size) { best = name; size = letters.length; }
  }
  return best;
}
