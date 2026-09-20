# Art direction

## The rule that governs everything

**Boards are drawn in code. Art is everything around them.**

It is tempting to answer "make the graphics beautiful" by generating beautiful
images. For a puzzle game that is the wrong instinct, and getting it wrong is
expensive to undo. A board is not a picture — it is an interactive, stateful,
responsive, themeable, accessible control surface. It must:

- stay pixel-crisp from a 320px phone to a 4K monitor,
- re-colour instantly for dark mode and for colour-blind-safe palettes,
- animate per cell (place, conflict, solve, undo),
- expose every cell to a screen reader and to keyboard navigation,
- render 81 cells with nine pencil marks each without a blurry edge anywhere.

A raster image does none of that. So every board, every piece, every region
fill, every path and every icon is **SVG or CSS, generated from the puzzle
state**. This is also what makes the emoji share card and the board thumbnails
trivial: they're the same renderer at a different size.

Generated art has a real job, just not that one:

| Surface | Medium | Why |
|---|---|---|
| Puzzle boards, pieces, regions, paths | **SVG / CSS** | Interactive, themeable, accessible, sharp at any size |
| Game icons on the home tiles | **SVG** | Must sit in a 44px tile and stay legible |
| Home tile backdrops | **Generated raster** | Atmosphere, depth, material — where AI art excels |
| App icon / logo mark | SVG, drafted from generated concepts | Needs to survive at 16px |
| Win / streak celebration art | **Generated raster** | Big, emotional, seen once — ideal fit |
| Section and empty-state illustration | **Generated raster** | Non-interactive decoration |
| Marketing, App Store, OG images | **Generated raster** | Highest-value use of the tool |

---

## The look

**Tactile minimalism.** Physical materials under soft studio light, arranged
with a lot of restraint. Think ceramic game pieces on felt, not neon gradients
and glassmorphism. The reference points are a well-made board game and a
premium calculator app — objects that feel good to touch.

Why this direction: the puzzles are austere by nature (grids, symbols, lines).
Austere layout plus warm material is a combination that reads as *crafted*.
Austere layout plus flat colour reads as *unfinished*, and austere plus
maximalist reads as noisy and makes 81 cells unreadable.

### Palette

Two themes, one set of semantic tokens. Every colour below is a token, never a
literal in a component.

| Token | Light | Dark | Use |
|---|---|---|---|
| `surface` | `#FAF7F2` bone | `#16161A` near-black | Page background |
| `board` | `#FFFFFF` | `#1E1E24` | Board field |
| `line-minor` | `#E3DDD3` | `#2C2C34` | Cell borders |
| `line-major` | `#C2B8A8` | `#43434E` | Box/region borders |
| `ink` | `#1A1814` | `#F2EFE9` | Given digits, primary text |
| `ink-entered` | `#2C5F8A` blue | `#7FB2E5` | Player-entered digits |
| `ink-note` | `#6E6A5E` | `#9A9AA6` | Pencil marks |
| `accent` | `#C88A2E` amber | `#E0A54A` | Selection, primary action |
| `success` | `#4A7C59` | `#6FA67E` | Solved |
| `danger` | `#B4503C` | `#D9705C` | Conflict |

**Entered digits are visibly a different colour from givens.** This is not
decoration; without it a 9×9 grid is unreadable mid-solve.

The `ink-note` values are deliberately lighter/darker than they look like they
should be. Pencil marks render at 9px, which is small text, so they need the
full 4.5:1 against `board` — the obvious mid-greys (`#8A8578` on white,
`#6E6E7A` on near-black) both land near 3.2:1 and fail. Contrast-check every
token pair against its actual background before using it, not after.

Two more that failed the same check and are already corrected: `accent` is a
fill and border colour only — as *text* on `surface` it manages 2.7:1, so
accent-coloured text uses `#8A5E18` in light theme. And a button filled with
`accent` takes `ink` for its label, never white (white on `#C88A2E` is 2.9:1;
near-black on it is 5.8:1).

### Colour-blind safety

Crowns and Quilt identify regions *by colour*, which excludes roughly 1 in 12
men at default settings. Both games therefore need colour to be a redundant
channel, not the only one:

- Region palettes drawn from a colour-blind-safe set (Okabe–Ito based),
  verified for deuteranopia and protanopia.
- A toggle that adds a subtle per-region pattern (dots, hatching, texture) on
  top of the fill.
- Region borders always drawn, never implied by a colour change alone.

Nine avoids this entirely — digits carry the information.

### Type

- **UI and digits:** a geometric humanist sans with true tabular figures —
  Inter, or Söhne if we're buying. Tabular is non-negotiable: timers and grids
  must not shift width as digits change.
- **Numerals on the board:** slightly heavier weight and generous tracking.
  A `1` and a `7` must never be confusable at 40px on a phone.
- **Pencil marks:** same family, ~9px, `ink-note`, laid out in a fixed 3×3
  sub-grid so a digit is always in the same corner — position becomes a second
  channel for reading candidates at a glance.

### Motion

Motion confirms input; it never entertains. Budget: 120–180ms, ease-out.

- Digit placement: a small scale pop, 120ms.
- Conflict: a 2-cycle shake plus `danger` tint, 200ms.
- Region/path completion: a light sweep along the completed run.
- Solve: a single wave of colour across the board from the last-placed cell,
  ~700ms. One celebratory moment, not confetti.
- Everything respects `prefers-reduced-motion` — under it, state changes are
  instant colour swaps with no transform.

---

## Using generated imagery well

Nano Banana (and the gpt-image models for anything containing text) produce the
raster layer. Practical notes from this project's constraints:

1. **Never put text in a generated image.** Nano Banana garbles glyphs. Titles,
   labels and numbers are live DOM text over the image — which is also what
   makes them translatable and accessible.
2. **Generate a style key first, then generate everything against it** as a
   reference image. Five tiles produced from five independent prompts will not
   look like one set, however good each one is on its own.
3. **Tiles are backdrops, not illustrations.** The game's SVG icon sits on top;
   the generated layer supplies material, light and depth behind it. So prompts
   should ask for atmosphere and surface, and leave the centre quiet.
4. **Export at 3× and compress.** These are decorative; they must never delay
   a board becoming interactive. Lazy-load everything below the fold.
5. **Budget a dark and a light variant** of every backdrop, or tint a single
   neutral one in CSS. Deciding this per asset after the fact is how a set
   stops matching.

### Environment limitation, worth recording

In this sandbox, image generation succeeds but the returned asset URL is
blocked by the network egress policy. Images can be produced here, but they
cannot be fetched, reviewed, iterated on, or committed to the repository.
Until that policy changes, raster art should be generated in an environment
that can read the results back — generating art we cannot look at is not a
workflow, it's a lottery.

The SVG/CSS layer, which by the rule at the top of this document is the part
that actually matters, has no such constraint.


---

## Seeing it

The design system and all five boards are built and published as a design
canvas: **https://claude.ai/artifact/G7qXazcshj9zxUJTyBgcE6**

Seven artboards — the Today screen and Nine at 390×844 (the real phone size),
the four quick boards mid-solve, and the token sheet. Everything there is
SVG/CSS rendered from puzzle state, which is the point: the boards in that
canvas are the same technique the app ships.

The puzzles on the boards are real and internally consistent, not decoration —
the Nine grid is a genuine sudoku mid-solve with a deliberate conflict in
column 1, and the Crowns board has one crown per row, column and region.
