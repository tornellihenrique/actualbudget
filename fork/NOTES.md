# Instance notes

Context about this particular Actual instance — the things that aren't derivable
from the code. Day-to-day finance conventions (what categories mean, people,
rule style) live in the connector's notebook, inside the budget itself, so every
Claude client reads the same copy; this file covers the instance.

## Instance

- Sync server: Railway service `actualbudget`, project `remarkable-empathy`,
  region `sfo`, `https://actualbudget-production-c3bf.up.railway.app`. Password
  login, single user.
- Budget: one file, "Duarte Finances". Not end-to-end encrypted. Budget type is
  **tracking**, and no budgeted amounts are set: the budget is used to track
  and categorize, not for envelopes.
- MCP connector: Railway service `actual-mcp`,
  `https://actual-mcp-production-fff5.up.railway.app/mcp` (`fork/RUNBOOK.md` §4).

## Accounts

All on-budget, all synced through Actual's built-in Pluggy.ai provider:

- **Inter Checking**: the main account. Its Pluggy consent has to be renewed on
  meu.pluggy.ai by scanning a QR code from the Inter app, so it stops syncing
  whenever nobody does that.
- **Inter Credit Card**: Pluggy reports future installments, so Actual's
  balance only matches the bank's when future-dated transactions are included.
- **Itaú Card 1**, **Itaú Card 2**: credit cards.

Card bill payments are transfers from Inter Checking. The card side also
imports a "Pagamento recebido" credit, which duplicates the transfer unless
it is merged into it.

## Categories

Portuguese names, grouped by area (Moradia, Saúde, Alimentação, …). The
non-obvious ones (the `A receber` receivable, `Família e repasses`, `Outros >
Não faço ideia` as the explicit unknown bucket) are explained in the notebook.

## Rules and automation

- Rules match on `notes contains <bank description fragment>`. Pluggy puts the
  bank description in notes and rarely sets a payee, which is why the
  notes/contains default patch exists. One rule per category, with an OR list
  of merchants.
- Schedules are manual bills (rent, health plan, energy, internet, phone,
  accountant, taxes, car financing) plus monthly income. None auto-post. They
  only link a payment within two days of the expected date, so bills paid
  early or late show as missed until they are linked by hand.
- The MCP connector talks to the API. Its daily job (06:00 BRT) exports a
  backup and runs bank sync.

## Known issues

- The server password is very short and the sync server is public. Change it to
  a strong one (Settings → Change server password), then update
  `ACTUAL_PASSWORD` on the `actual-mcp` service.
- `api/transaction-update` does not await its write (`loot-core/src/server/api.ts`).
  The connector works around it, and the one-line fix is worth sending upstream.

## History

- 2026-10-09: catch-up after the user's vacation (bank sync last ran 2026-09-11).
  Synced 79 transactions; merged two duplicated card payments and linked a third
  as a transfer; linked seven paid-but-unlinked schedule payments (Algar, car
  financing, Cyta, DARF/DAS) and advanced their next dates; fixed the Santander
  and Trucks rules after the bank changed its descriptions; filed 33 UK-trip
  transactions under Viagem em família. Backups and an audit log of each change
  are in `~/.local/share/actual-claude/` on the dev machine.
