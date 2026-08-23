# A bundle written before the current schema

Read this when `wfctl work context` reports a bundle with no structured
checkpoint, or a bundle whose spec has no `Discovery ledger`. A bundle created
by a current `wfctl work start` has both.

If an upgraded legacy bundle has no structured checkpoint, read its current
record and former Progress/Handoff sections completely, then run `wfctl work
checkpoint` once to adopt the new model. Preserve the old prose as lineage, but
do not maintain a second resume state afterward.

If a pre-ledger bundle has no `Discovery ledger`, do not fabricate past
discoveries. Add the section when material work next changes that owner and
preserve new discoveries from that point forward; old bundle versions remain
readable for compatibility.
