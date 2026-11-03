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
export type { CrownsPuzzle, CrownsHint, CrownsHintStep } from './games/crowns/index.js';

export * as threadGame from './games/thread/index.js';
export { thread } from './games/thread/index.js';
export type { ThreadPuzzle, ThreadHint, ThreadHintStep } from './games/thread/index.js';

export * as quiltGame from './games/quilt/index.js';
export { quilt } from './games/quilt/index.js';
export type { QuiltPuzzle, QuiltHint, QuiltHintStep } from './games/quilt/index.js';

/** Both games use a plain number[] board; import the game namespace for its own helpers. */
export type Grid = number[];
