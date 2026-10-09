import * as api from '@actual-app/api';

type Named = { id: string; name: string };

export type Lookups = {
  accountId(ref: string): string;
  categoryId(ref: string): string;
  groupId(ref: string): string;
  payeeId(ref: string): string | undefined;
  accountName(id?: string | null): string | null;
  categoryName(id?: string | null): string | null;
  payeeName(id?: string | null): string | null;
};

function normalize(value: string) {
  return value.trim().toLocaleLowerCase();
}

function resolver(kind: string, items: Named[]) {
  return (ref: string): string | undefined => {
    const byId = items.find(item => item.id === ref);
    if (byId) return byId.id;
    const wanted = normalize(ref);
    const exact = items.filter(item => normalize(item.name) === wanted);
    if (exact.length === 1) return exact[0].id;
    if (exact.length > 1) {
      throw new Error(`More than one ${kind} is named "${ref}"; use its id.`);
    }
    const partial = items.filter(item => normalize(item.name).includes(wanted));
    if (partial.length === 1) return partial[0].id;
    if (partial.length > 1) {
      const names = partial.map(item => item.name).join(', ');
      throw new Error(`"${ref}" matches several ${kind}s: ${names}`);
    }
    return undefined;
  };
}

function required(kind: string, resolve: (ref: string) => string | undefined) {
  return (ref: string) => {
    const id = resolve(ref);
    if (!id) throw new Error(`No ${kind} matches "${ref}".`);
    return id;
  };
}

/** Name/id resolution for one tool call. Load inside a budget session. */
export async function loadLookups(): Promise<Lookups> {
  const [accounts, categories, groups, payees] = await Promise.all([
    api.getAccounts(),
    api.getCategories(),
    api.getCategoryGroups(),
    api.getPayees(),
  ]);
  const accountNames = new Map(accounts.map(a => [a.id, a.name]));
  const payeeNames = new Map(
    payees.map(p => [
      p.id,
      p.transfer_acct
        ? `Transfer: ${accountNames.get(p.transfer_acct) ?? '?'}`
        : p.name,
    ]),
  );
  const categoryNames = new Map(categories.map(c => [c.id, c.name]));
  const namedPayees = [...payeeNames].map(([id, name]) => ({ id, name }));

  return {
    accountId: required('account', resolver('account', accounts)),
    categoryId: required('category', resolver('category', categories)),
    groupId: required('category group', resolver('category group', groups)),
    payeeId: resolver('payee', namedPayees),
    accountName: id => (id ? (accountNames.get(id) ?? id) : null),
    categoryName: id => (id ? (categoryNames.get(id) ?? id) : null),
    payeeName: id => (id ? (payeeNames.get(id) ?? id) : null),
  };
}
