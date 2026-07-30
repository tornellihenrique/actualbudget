# Patch inventory

Every commit on `personal` that did not come from upstream gets exactly one row
here. If a patch isn't listed, it will be carried forever by accident — the
inventory is the only place the _reason_ for a patch survives a rebase.

Base tag: `v26.7.0` (update on every rebase — see `fork/RUNBOOK.md`).

## Active patches

| Commit      | What                                                                                                      | Why                                                                                                                                                                                                                                                                         | Upstream PR / issue                                                                                                          | Drop when                                                                                                                                                              |
| ----------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `83b917c0c` | `sync-server.Dockerfile`: adds `COPY packages/vite-plugin-peggy/package.json` to the deps stage (1 line). | Upstream bug. The deps stage copies workspace manifests one by one and omits `vite-plugin-peggy`, which `packages/api` and `packages/loot-core` depend on via `workspace:*`. Yarn fails resolution before install even starts, so the Railway build dies in the deps stage. | none — not yet sent upstream. Genuine upstream bug, PR-able as-is; still missing on `master` as of 2026-07-28 (`79f7860cc`). | Upstream adds the `vite-plugin-peggy` manifest COPY (or stops enumerating manifests individually) in `sync-server.Dockerfile`, and we rebase onto a tag containing it. |

## Dropped patches

Patches removed during a rebase, kept for the record so the same change doesn't
get reinvented later.

| Commit | What | Dropped on | Reason |
| ------ | ---- | ---------- | ------ |
|        |      |            |        |

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
