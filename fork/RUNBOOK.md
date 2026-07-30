# Fork runbook

Operational procedures for this fork. See `CLAUDE.md` for the rules that govern
patches, and `fork/PATCHES.md` for what's currently carried.

Branch roles, for reference:

- `master` — mirrors upstream, never committed to.
- `personal` — patches on top of an upstream tag. All work happens here.
- `deploy` — fast-forwarded from `personal`; Railway builds it via `sync-server.Dockerfile`.

---

## 1. Rebasing onto a new upstream tag

Do this per upstream release, not continuously — tags are tested, `master` between
tags isn't.

### 1.1 Update the upstream mirror

```bash
git fetch upstream --tags          # add the remote first if missing:
                                   # git remote add upstream https://github.com/actualbudget/actual.git
git checkout master
git merge --ff-only upstream/master
```

`--ff-only` is deliberate: if it refuses, something was committed to `master`
that shouldn't have been. Fix that before going further — don't merge.

Pick the target tag (e.g. `v26.8.0`):

```bash
git tag --list 'v26.*' --sort=-v:refname | head
```

### 1.2 Review what you're carrying before you replay it

```bash
git log --oneline <old-tag>..personal
```

Cross-check each commit against `fork/PATCHES.md` and, for anything with an
upstream PR, check whether it merged. **Drop patches that upstream fixed** — that
is the entire point of the drop-when column. Dropping is done by removing the
commit from the todo list in the next step.

### 1.3 Replay

```bash
git checkout personal
git checkout -b personal-backup-<old-tag>   # cheap escape hatch; delete once happy
git checkout personal
git rebase --onto <new-tag> <old-tag> personal
```

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

Update `fork/PATCHES.md`: new base tag, refreshed commit SHAs (the rebase
rewrote them), and move anything dropped into the Dropped table with the reason.
Commit that as its own change.

Delete the backup branch once the deploy is healthy:

```bash
git branch -D personal-backup-<old-tag>
```

---

## 2. Deploy

Railway builds `deploy` from `sync-server.Dockerfile`. `deploy` must always be a
fast-forward of `personal` — never commit to it, never merge into it.

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
