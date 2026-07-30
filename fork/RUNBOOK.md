# Fork runbook

Operational procedures for this fork. See `CLAUDE.md` for the rules that govern
patches, and `fork/PATCHES.md` for what's currently carried.

Branch roles, for reference:

- `master` — mirrors upstream, never committed to.
- `personal` — patches on top of upstream `master`. All work happens here.
- `deploy` — fast-forwarded from `personal`; Railway builds it via `sync-server.Dockerfile`.

---

## 1. Rebasing onto new upstream code

Since 2026-07-30 this fork tracks upstream `master` rather than release tags — a
deliberate call that master is stable enough for this instance. The tradeoff is
real and worth restating: tags are release-tested, arbitrary master commits are
not. Prefer to sync at a moment when upstream CI is green, and always smoke-test
before deploying (§3).

The procedure below works either way. Substitute a tag for `upstream/master`
anywhere it appears if you want to go back to release-based syncing.

### 1.1 Update the upstream mirror

```bash
git fetch upstream --tags          # add the remote first if missing:
                                   # git remote add upstream https://github.com/actualbudget/actual.git
git checkout master
git merge --ff-only upstream/master
```

`--ff-only` is deliberate: if it refuses, something was committed to `master`
that shouldn't have been. Fix that before going further — don't merge.

The new base is `upstream/master`. If you're targeting a release tag instead:

```bash
git tag --list 'v26.*' --sort=-v:refname | head
```

### 1.2 Review what you're carrying before you replay it

```bash
git log --oneline <old-base>..personal
```

`<old-base>` is the `Base:` commit recorded at the top of `fork/PATCHES.md`.

Cross-check each commit against `fork/PATCHES.md` and, for anything with an
upstream PR, check whether it merged. **Drop patches that upstream fixed** — that
is the entire point of the drop-when column. Dropping is done by removing the
commit from the todo list in the next step.

### 1.3 Replay

Tag the current state of every branch you're about to rewrite — this is the
escape hatch, and it costs nothing:

```bash
git tag -a pre-sync-<date>/personal personal -m "state before syncing onto <new-base>"
git tag -a pre-sync-<date>/deploy   deploy   -m "last known-good deployed commit"
```

Then replay:

```bash
git rebase --onto upstream/master <old-base> personal
```

Tags beat backup branches here: they don't clutter `git branch`, they survive
force-pushes, and pushing them puts the escape hatch on GitHub too. Delete them
once the deploy has been healthy for a while.

On a conflict: resolve, `git add`, `git rebase --continue`. To abandon a patch
mid-rebase (upstream superseded it), `git rebase --skip`. To bail out entirely,
`git rebase --abort` — the branch is untouched.

If a patch conflicts heavily, that's a signal upstream restructured the code
underneath it. Re-derive the patch against the new code rather than forcing the
old diff through.

### 1.4 Verify

```bash
yarn install
yarn typecheck
yarn lint
yarn test
```

Then build what actually ships:

```bash
yarn build:server
```

Smoke-test locally before deploying — see §3.

### 1.5 Record

Update `fork/PATCHES.md`: new base commit, refreshed commit SHAs (the rebase
rewrote them), and move anything dropped into the Dropped table with the reason.
Also re-check anything in `CLAUDE.md` or this runbook that names the old base —
a stale base reference is the easiest way to mislead the next rebase.

Delete the escape-hatch tags once the deploy has been healthy for a while:

```bash
git tag -d pre-sync-<date>/personal pre-sync-<date>/deploy
git push origin --delete pre-sync-<date>/personal pre-sync-<date>/deploy
```

---

## 2. Deploy

Railway builds `deploy` from `sync-server.Dockerfile`. `deploy` must always be a
fast-forward of `personal` — never commit to it, never merge into it.

### Railway configuration

The service's settings, for reference — if a deploy behaves unexpectedly, check
these first, they're the whole contract between the repo and Railway:

| Setting                   | Value                    | Notes                                                         |
| ------------------------- | ------------------------ | ------------------------------------------------------------- |
| Source branch             | `deploy`                 | Pushing to `deploy` is what triggers a build.                 |
| `RAILWAY_DOCKERFILE_PATH` | `sync-server.Dockerfile` | Without it Railway guesses the build and gets it wrong.       |
| `ACTUAL_DATA_DIR`         | `/data`                  | Where the server keeps budget files and its SQLite DBs.       |
| Volume mount path         | `/data`                  | Must match `ACTUAL_DATA_DIR` or data is lost on redeploy.     |
| `PORT`                    | injected by Railway      | Don't set it. The server reads it; hardcoding breaks routing. |

The volume is the only stateful part of the deploy. Everything else is rebuilt
from the image, so a bad deploy is recoverable by redeploying — a wrong mount path
is not.

### Pushing a deploy

```bash
# 1. personal is green: typecheck, lint, tests, and a local smoke test all pass.
git checkout personal
yarn typecheck

# 2. Fast-forward deploy.
git checkout deploy
git merge --ff-only personal

# 3. Push. This is what triggers the Railway build.
git push origin deploy

# 4. Back to the working branch.
git checkout personal
```

If step 2 refuses to fast-forward, `deploy` has commits `personal` doesn't. Don't
force-push past it — find out what landed there and replay it onto `personal`
first, then fast-forward.

Push `personal` too so the patch set is backed up:

```bash
git push origin personal
```

### Watching the deploy

Railway builds on push to `deploy`. Watch the build log for the Docker stage
failing on workspace manifests — the sync-server image copies a pruned set of
`package.json` files, so a newly added workspace dependency needs its manifest
copied in `sync-server.Dockerfile` or the install stage fails.

After it goes live, check the server responds and that an existing client can
still sync before considering the deploy done.

### Rolling back

Railway can redeploy a previous build from its dashboard — do that first, it's
the fastest path. To roll back in git, reset `deploy` to the last good commit and
force-push with lease:

```bash
git checkout deploy
git reset --hard <last-good-sha>
git push --force-with-lease origin deploy
```

Force-pushing `deploy` is acceptable because nothing branches from it. Never
force-push `personal` or `master`.

---

## 3. Testing an upstream PR locally

Useful before adopting a fix as a patch, or to check whether an upstream PR
actually solves the problem a local patch works around.

### Mind the version gap

`personal` now sits directly on upstream `master`, so PRs written against `master`
generally cherry-pick cleanly — that was the main practical win of the 2026-07-30
sync. The gap reopens as `master` moves on, so the further `personal` drifts from
the `Base:` commit in `fork/PATCHES.md`, the more a failed cherry-pick just means
"resync first, then try again."

### Fetch the PR

```bash
git fetch upstream pull/<PR-number>/head:pr-<PR-number>
git checkout pr-<PR-number>
yarn install
```

This gives you the PR branch as upstream authored it, on top of upstream's base —
not your patches.

### Test it against the fork

To see how it behaves with your patches, replay the PR onto `personal` in a
throwaway branch:

```bash
git checkout -b try-pr-<PR-number> personal
git cherry-pick personal..pr-<PR-number>
```

Conflicts here are informative: they show exactly which local patches the PR
collides with, which usually means the PR supersedes one of them.

### Run it

```bash
yarn typecheck
yarn test
yarn start              # browser client on :3001
yarn start:server-dev   # sync server on :5006 + client
```

Use **"View demo"** on the setup screen (after "Don't use a server") for a budget
with realistic sample data — far more useful than an empty one. Never test
against the production budget file.

### Clean up

```bash
git checkout personal
git branch -D pr-<PR-number> try-pr-<PR-number>
```

If the PR works and you want it now rather than at the next release, cherry-pick
it onto `personal` as a patch — and add a `fork/PATCHES.md` row whose drop
condition is "upstream PR #N ships in a release we've rebased onto."
