@AGENTS.md
@.github/agents/pr-and-commit-rules.md

# Fork rules

This checkout is a **maintained fork** of [actualbudget/actual](https://github.com/actualbudget/actual),
not the upstream repo. Everything in `AGENTS.md` still applies for build, test,
lint, and style conventions — read it first. The rules below are additional and
specific to this fork.

## Branches

| Branch     | Role                                                                       |
| ---------- | -------------------------------------------------------------------------- |
| `master`   | Mirrors upstream. **Never commit to it.** Only ever fast-forwarded from upstream. |
| `personal` | Branched from an upstream tag; holds all local patches. Work happens here.  |
| `deploy`   | Fast-forwarded from `personal`. Railway builds this via `sync-server.Dockerfile`. |

Never commit directly to `master` or `deploy`.

## Patch rules

Every commit on `personal` that is not from upstream is a **patch**, and carries
ongoing rebase cost. Before writing one:

1. **Prefer configuration over code.** An env var, a server setting, or an
   existing feature flag beats a code change every time. Only patch source when
   no configuration path exists.
2. **Minimal.** Touch the fewest files and lines that solve the problem. Don't
   bundle refactors, formatting, renames, or drive-by cleanups into a patch —
   they turn a trivial rebase into a conflicted one.
3. **Single-purpose.** One commit per patch, one concern per commit. Two
   unrelated fixes are two commits, never one, so that either can be dropped
   independently when upstream fixes it.
4. **Rebasable onto upstream tags.** Assume the patch will be replayed onto
   every future release tag. Avoid depending on incidental upstream details, and
   prefer additive changes over rewrites of upstream code.
5. **PR-able upstream where possible.** If a patch is a genuine bug fix or a
   generally useful feature, send it upstream — an accepted PR is a patch that
   eventually disappears. Patches that are irreducibly local (instance-specific
   config, deploy plumbing) stay in the fork; say so explicitly in the inventory.
6. **Record it.** Every patch gets a row in `fork/PATCHES.md`, including the
   condition under which it gets dropped. A patch with no drop condition is a
   patch that will be carried forever by accident.

## Before committing

- Run `yarn typecheck` from the repo root. Always, before every commit.
- Run `yarn lint:fix` and the relevant tests for what you touched.
- Follow the commit rules in `.github/agents/pr-and-commit-rules.md` — including
  the `[AI]` prefix, which the pre-commit guard enforces.

## Fork documentation

- `fork/PATCHES.md` — inventory of every patch on `personal`.
- `fork/RUNBOOK.md` — rebasing onto a new upstream tag, deploying, testing upstream PRs.
- `fork/NOTES.md` — context about this instance.

Keep these current as part of the change, not afterwards: a patch that lands
without a `fork/PATCHES.md` row is incomplete.
