# Loop until dry

**Use for discovery of unknown size** — bugs, edge cases, gaps, contradictions.

"Find ten problems" finds ten. It stops at ten whether there were three or
forty, and the tail is where the interesting ones live.

## The shape

Keep searching until **K consecutive rounds find nothing new** — two is usually
enough. Each round:

1. Search, ideally several different ways at once.
2. Drop what has been seen before. **Deduplicate against everything seen, not
   against what survived judging** — otherwise a rejected finding reappears
   every round and the loop never converges.
3. Judge what is left.
4. If the round was empty, increment the dry counter; otherwise reset it.

## Say what you stopped for

A bounded sweep that reports its findings and not its bound reads exactly like
an exhaustive one. If you capped rounds, sampled, or skipped a mode of search,
write that down beside the result.
