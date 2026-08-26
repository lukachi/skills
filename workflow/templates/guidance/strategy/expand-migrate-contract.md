# Expand, migrate, contract

**Use for a change wide enough that doing it in one step leaves the tree red in
the middle** — a renamed contract, a moved boundary, a changed shape with many
callers.

## The shape

1. **Expand.** Add the new thing beside the old. Both work. Nothing has moved.
2. **Migrate.** Move callers across, in as many commits as there are natural
   groups. Each one is green on its own.
3. **Contract.** Remove the old thing once nothing calls it — and prove nothing
   calls it, rather than believing it.

Size each step by blast radius rather than by file count. Twenty callers of one
private helper is one step; three callers across a published contract is three.

## The trap

Stopping after migrate. The old thing stays, half the tree uses each, and the
next reader cannot tell which is current. Contract is not cleanup — it is the
step that makes the change true.
