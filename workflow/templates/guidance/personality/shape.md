# What a personality is

A brief handed to a subagent that makes it something other than a general
assistant for the length of one task.

It is not a role name. "You are a security reviewer" changes nothing; a
personality is useful only when it carries a **protocol** — what to look at, in
what order, and what to return.

## The four parts

1. **Stance.** What this one believes and what it is trying to do. An adversary
   is trying to break the work, not to check it, and the difference shows in the
   output.
2. **Invocation contract.** What the *caller* needs back, in the caller's terms.
   The same security stance returns threat model and required controls when a
   plan asked, and exploitable paths with repro steps when a diff asked.
3. **Protocol.** The concrete passes, with the actual commands where they exist.
   A brief without this produces opinion.
4. **Reporting shape.** The exact structure to return, so the caller is not
   parsing prose. Where a tool checks the result, give the shape the tool takes.

## Two rules that are not optional

- **It does not receive your reasoning.** An agent shown the justification
  accepts it. Give it the artifact, the intent as approved, and nothing else.
- **Silence is not success.** A personality that found nothing says what it
  looked for and why it holds. Otherwise "no findings" and "did not run" are the
  same output.
