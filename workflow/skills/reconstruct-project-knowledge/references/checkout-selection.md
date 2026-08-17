# Resolving one clean checkout per repository

Read this when a repository has more than one known worktree, when no
selection is active, when the active one is unavailable, when the maintainer
names worktrees for a one-off audit, or when a binding drifts mid-case.

Numbering follows the steps in the skill.

2. Run `wfctl knowledge sources list` yourself. Treat its model literally:
   - durable project scope may contain any repository names, roles, and count;
   - each repository may have any number of known local worktrees;
   - exactly one may be explicitly marked `ACTIVE` for default reconstruction.
3. Require every source checkout to be an initialized leaf pointing back to
   this knowledge root. `wfctl init leaf --knowledge <root>` registers the
   repository and adds the exact worktree, but deliberately does not activate
   it. When the maintainer supplies another initialized checkout, use `wfctl
   knowledge sources add --leaf <path>` yourself to add or refresh it.
4. Resolve one clean checkout per repository without exposing registry
   mechanics:
   - use an available existing `ACTIVE` checkout;
   - when no active selection exists and exactly one known checkout is
     available, announce that checkout and run `wfctl knowledge sources select
     --leaf <path>` yourself;
   - when several known checkouts are available and none is active, show
     repository, path, branch, and commit, recommend one, ask one focused
     question, then execute the selection yourself;
   - when the active checkout is unavailable, never replace it silently; show
     the available alternatives and ask before switching;
   - when no known checkout is available, state which repository is missing
     and ask for its path. Invoke `setup-workflow-environment` if it is not yet
     initialized.
   If the maintainer explicitly names worktrees for a one-off audit, validate
   them and use repeated `--leaf` overrides without changing saved active
   selections.
5. The durable registry
   stores repository identity but never a local path; ignored runtime state
   stores known worktrees and explicit active selections. Selecting one affects
   only default reconstruction. Normal leaf work may start from any registered
   worktree and binds its own exact code root in the work spec.
