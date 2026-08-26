# Tracer bullet

**Use when splitting work into units.**

A unit cuts a **narrow but complete** path through every layer it needs —
vertical, never a horizontal slice of one layer. A completed unit is
demonstrable or verifiable on its own.

The failure it prevents: three units that each build a layer, none of which does
anything, and an integration nobody scheduled that turns out to be the actual
work.

## Rules

- One user-visible or contract-visible outcome per unit.
- If it cannot be verified alone, it is not a unit — it is half of one.
- Prefer the unit that proves a seam over the unit that is easiest.
- The first unit through a new seam is worth more than the next five, because it
  is the one that finds out whether the seam is real.

Do not split a route further than you can see. A unit list produced before the
work is a prediction, and predictions rot: append as you learn, rather than
predicting harder.
