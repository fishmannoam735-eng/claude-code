# Research: LinkedIn Games (as of Sept 2026)

Seven daily puzzles, all resetting at midnight Pacific. One puzzle per game per
day, no subscription, playable as a guest. Each is designed for a 1–5 minute
solve — the whole lineup is a coffee-break, not a session.

Sources are listed at the bottom. `linkedin.com` itself is blocked by this
environment's egress proxy, so rules below come from third-party guides and
should be spot-checked against the real games before we lock specs.

---

## The seven games

### 1. Queens — constraint placement
Place exactly one queen in every row, every column, and every **colored region**
of the grid. No two queens may touch, even diagonally.

- Board: square grid, ~8×8–11×11, overlaid with N irregular colored regions
  (N = grid size).
- Interaction: tap once to mark X (a "definitely not"), twice to place a queen.
- Why it works: the coloring is what makes it a *logic* puzzle rather than the
  classic N-queens search. Regions carry most of the deductive force.

### 2. Tango — binary/Takuzu grid
Fill a 6×6 grid with suns and moons.

- Equal count of each symbol in every row and column (3 and 3).
- No three identical symbols adjacent — horizontally or vertically.
- Some cells are pre-filled; edges between cells carry `=` (same) or `×`
  (different) constraints.
- Classic Binairo/Takuzu with pairwise edge constraints layered on.

### 3. Zip — Hamiltonian path
Draw one continuous path that enters every cell exactly once, visiting the
numbered cells in ascending order.

- Board: rotates daily across 5×5, 6×6, 7×7, 8×8.
- Walls (`|`, `—`) sit between cells and block the path.
- Orthogonal moves only; path must start on `1` and end on the highest number.
- Mechanically the deepest of the set: generation is a constrained Hamiltonian
  path problem.

### 4. Mini Sudoku — 6×6 sudoku
Fill so every row, column, and 2×3 box contains 1–6 exactly once. The lineup's
comfort food; no surprises.

### 5. Patches — rectangle tiling
Tile the whole grid with rectangles. No gaps, no overlaps.

- Every rectangle must contain **exactly one clue cell**.
- A numeric clue states the rectangle's total area (cell count).
- Icon clues constrain shape instead: *square*, *wide*, *tall*, or *any*.
- Interaction: drag to draw a rectangle, tap an existing one to remove it.
- This is the Shikaku family, with shape-clues as the twist.

### 6. Pinpoint — category guessing
Five clues revealed one at a time; name the category that links them. Scoring is
inverted — guessing after one clue beats guessing after five.

- Not a logic puzzle. It's a **content** game: every day needs a hand-authored
  or curated category with five ordered, progressively-easier members.

### 7. Crossclimb — trivia word ladder, three phases
1. Solve five clues to get five 4-letter words.
2. Drag them into an order where each word differs from its neighbour by
   exactly one letter.
3. Solve the top and bottom rungs from a single shared clue — those two words
   also differ by one letter from the ends of the ladder, and relate to each
   other (compound halves, synonyms, opposites, rhymes).

- Also content-hungry, and the hardest to author: needs a valid 7-rung ladder
  *and* a clue per rung *and* a thematic pair at the ends.

---

## The split that drives the whole plan

| | Games | Daily content cost |
|---|---|---|
| **Generatable** | Queens, Tango, Zip, Mini Sudoku, Patches | Zero — a seeded generator produces a fresh, verified-unique puzzle forever |
| **Authored** | Pinpoint, Crossclimb | A human or an LLM pipeline must produce and QA content every single day |

Five of seven need no content operation at all. That is the cheap, durable core
of the product, and it should ship first. The two word games are a separate
business problem wearing the same UI.

---

## Sources

- [LinkedIn Games (official, blocked here)](https://www.linkedin.com/games)
- [Complete Guide to All 7 LinkedIn Games (2026)](https://pinpointdaily.org/linkedin-games/)
- [How to Play LinkedIn Patches — TechWiser](https://techwiser.com/linkedin-patches-play-tips-tricks/)
- [How to Play Patches — Complete Rules & Strategy](https://www.patchesgame.com/how-to-play.html)
- [How to Play Zip — Path Puzzle Rules](https://www.zipgameunlimited.com/how-to-play)
- [Play Zip game on LinkedIn — LinkedIn Help](https://www.linkedin.com/help/linkedin/answer/a7445030)
- [How to Play the LinkedIn Puzzle Game "Crossclimb"](https://www.askdavetaylor.com/how-to-play-the-linkedin-puzzle-game-crossclimb/)
- [How to Play LinkedIn Crossclimb and Pinpoint](https://www.crossclimbtoday.com/how-to-play)
- [LinkedIn Games: How to Play Pinpoint, Tango & Queens](https://connectsafely.ai/articles/linkedin-games)
