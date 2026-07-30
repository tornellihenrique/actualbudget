# Patch inventory

Every commit on `personal` that did not come from upstream gets exactly one row
here. If a patch isn't listed, it will be carried forever by accident — the
inventory is the only place the _reason_ for a patch survives a rebase.

Base: upstream `master` @ `822fbe3f9` (2026-07-29), synced 2026-07-30. The fork
previously sat on tag `v26.7.0`; it now tracks `master` directly, so the base is a
commit rather than a tag. Update it on every rebase — see `fork/RUNBOOK.md`.

## Active patches

| Commit      | What                                                                                                                                                                                            | Why                                                                                                                                                                                                                                                                                                                                   | Upstream PR / issue                                                                                                                                        | Drop when                                                                                                                                                               |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `d1cda2431` | `sync-server.Dockerfile`: adds `COPY packages/vite-plugin-peggy/package.json` to the deps stage (1 line).                                                                                       | Upstream bug. The deps stage copies workspace manifests one by one and omits `vite-plugin-peggy`, which `packages/api` and `packages/loot-core` depend on via `workspace:*`. Yarn fails resolution before install even starts, so the Railway build dies in the deps stage. **Without this patch the Railway deploy does not build.** | none — not yet sent upstream. Genuine upstream bug, PR-able as-is; re-verified still missing on `master` at `822fbe3f9` (2026-07-29).                      | Upstream adds the `vite-plugin-peggy` manifest COPY (or stops enumerating manifests individually) in `sync-server.Dockerfile`, and we rebase onto a base containing it. |
| `a9ec9055d` | `packages/desktop-client/src/browser-preload.js`: appends `REACT_APP_BUILD_METADATA` to the client version as semver build metadata.                                                            | This fork tracks `master`, where `package.json` only changes at release. Every build between two releases reports the same `26.7.0`, so the settings screen can't say which commit an instance is running. Stamping the SHA makes a deploy identifiable.                                                                              | none yet — **PR-able as-is**, deliberately named generically rather than fork-specific, since upstream has the same gap for edge/nightly builds.           | Upstream provides its own way to report a build identity, or this fork goes back to tracking release tags (where the version alone is unambiguous).                     |
| `062ec0dc6` | `packages/sync-server/src/app.ts`: appends `ACTUAL_BUILD_METADATA` to the version reported by `/info`.                                                                                          | Server half of the above — the client's settings screen renders `/info`'s version as "Server version", so without this the server stays unidentifiable even when the client is stamped.                                                                                                                                               | none yet — **PR-able as-is**, same reasoning as the client patch.                                                                                          | Same as the client patch; drop both together.                                                                                                                           |
| `f720de2c0` | `sync-server.Dockerfile`: takes `ACTUAL_BUILD_METADATA` as a build arg, forwards it to the builder stage as `REACT_APP_BUILD_METADATA` and to the runtime stage as `ACTUAL_BUILD_METADATA`.     | Deploy plumbing that connects the two patches above to Railway. Without it the build arg never reaches either half.                                                                                                                                                                                                                   | `local-only` — this wiring is specific to how this fork deploys, even if the two code patches land upstream.                                               | The two patches above are dropped, or the deploy stops using this Dockerfile.                                                                                           |
| `616e026b0` | `sync-server.Dockerfile`: reads `RAILWAY_GIT_COMMIT_SHA` directly — as a build arg for the client, and in the entrypoint for the server — with `ACTUAL_BUILD_METADATA` still taking precedence. | Railway's git variables are deploy-scoped and absent from the service's variable set, so `${{ RAILWAY_GIT_COMMIT_SHA }}` interpolates to an empty string. Without reading it directly, the commit has to be pasted in by hand on every deploy.                                                                                        | `local-only` — extends the wiring above with a Railway-specific fallback, which is exactly why it lives in the Dockerfile and not in the two code patches. | `f720de2c0` is dropped, or the deploy leaves Railway.                                                                                                                   |

## Dropped patches

Patches removed during a rebase, kept for the record so the same change doesn't
get reinvented later.

| Commit      | What                                                                                                                                 | Dropped on                                  | Reason                                                                                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `22d8f948c` | `packages/component-library/package.json`: collapsed `test` + `test:web` into one `test` script, dropping the `npm-run-all` wrapper. | 2026-07-30, syncing onto upstream `master`. | Fixed upstream. `master` carries the identical script, so replaying the patch would have been a no-op. Its inventory row (`f80133c91`) was dropped with it. |

## Column meanings

- **Commit** — short SHA on `personal`. Rewritten by every rebase; refresh it
  when you rebase.
- **What** — one line, what the patch actually changes. Name the files if it's
  small enough to say.
- **Why** — the problem it solves for this instance. Not "fixes bug" — what
  broke, and what it looked like.
- **Upstream PR / issue** — link if one exists. `none` if the patch was never
  sent upstream; `local-only` if it's instance-specific and never will be
  (deploy plumbing, personal config) — that distinction decides whether it's
  worth re-checking upstream each release.
- **Drop when** — the concrete condition that retires the patch: an upstream PR
  merging, a release containing the fix, a setting becoming configurable, or a
  local need going away. Every row needs one. If you genuinely can't name a
  condition, write `never (permanent fork divergence)` and mean it.
