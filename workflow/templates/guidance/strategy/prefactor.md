# Prefactor

**Make the change easy, then make the easy change.**

When a change is hard because the code is shaped wrong, doing it anyway produces
a change shaped by the resistance rather than by the intent — and the resistance
is still there for the next one.

## The shape

1. **Name the resistance.** What specifically makes this hard?
2. **Change the shape, alone, with the behaviour held still.** No new behaviour
   in this step. Its whole claim is that nothing changed, which is a claim tests
   can check.
3. **Then make the change**, which is now small.

Two commits, always. A single commit mixing a reshape with new behaviour cannot
be reviewed: every reviewer has to decide, line by line, which half they are
looking at, and a behaviour change hidden inside a large reshape is the thing
review most reliably misses.

## When not to

- The reshape is bigger than the change and nothing else will use it.
- You cannot state what makes the change hard. Then the resistance is not in the
  code yet, and reshaping is guessing.
