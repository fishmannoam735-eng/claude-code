export * from './types.js';
export * from './seed.js';
export { createRng, type Rng } from './rng.js';

export * as nineGame from './games/nine/index.js';
export { nine } from './games/nine/index.js';
export type { NinePuzzle } from './games/nine/index.js';

export * as eclipseGame from './games/eclipse/index.js';
export { eclipse } from './games/eclipse/index.js';
export type { EclipsePuzzle } from './games/eclipse/index.js';

export * as crownsGame from './games/crowns/index.js';
export { crowns } from './games/crowns/index.js';
export type { CrownsPuzzle } from './games/crowns/index.js';

export * as threadGame from './games/thread/index.js';
export { thread } from './games/thread/index.js';
export type { ThreadPuzzle } from './games/thread/index.js';

/** Both games use a plain number[] board; import the game namespace for its own helpers. */
export type Grid = number[];
