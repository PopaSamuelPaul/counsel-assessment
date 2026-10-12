import type { Client, Data, Entry } from './model';
import { addDays, EMPLOYEE, validateEntry } from './model';

export type ReviewFilters = {
  week: string;
  clientId: string;
  employee: string;
  status: string;
  search: string;
};
export type EntryPatch = Partial<
  Pick<Entry, 'clientId' | 'billable' | 'reviewed'>
>;
export type UndoRecord = { before: Entry[]; after: Entry[] };

export function selectWeek(entries: Entry[], week: string) {
  return entries.filter(
    (entry) => entry.date >= week && entry.date <= addDays(week, 6),
  );
}
export function mostRecentEntry(
  entries: Entry[],
  employee = EMPLOYEE,
): Entry | undefined {
  return entries
    .filter((entry) => entry.employee === employee)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
    .at(0);
}
export function selectReview(
  entries: Entry[],
  clients: Client[],
  filters: ReviewFilters,
) {
  return selectWeek(entries, filters.week)
    .filter(
      (entry) =>
        (filters.clientId === 'all' || entry.clientId === filters.clientId) &&
        (filters.employee === 'all' || entry.employee === filters.employee) &&
        (filters.status === 'all' ||
          !!entry.reviewed === (filters.status === 'reviewed')) &&
        `${entry.description} ${clients.find((c) => c.id === entry.clientId)?.name ?? ''} ${entry.employee}`
          .toLowerCase()
          .includes(filters.search.toLowerCase()),
    )
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.employee.localeCompare(b.employee) ||
        a.id.localeCompare(b.id),
    );
}
export function applyEntryUpdate(previous: Entry, next: Entry): Entry {
  const changed =
    previous.date !== next.date ||
    previous.minutes !== next.minutes ||
    previous.clientId !== next.clientId ||
    previous.billable !== next.billable ||
    previous.description !== next.description ||
    previous.employee !== next.employee;
  return { ...next, reviewed: changed ? false : previous.reviewed };
}
export function saveEntry(
  data: Data,
  entry: Entry,
  client?: Client,
  original?: Entry,
): Data {
  const previous = data.entries.find((e) => e.id === entry.id);
  if (
    original &&
    (!previous || JSON.stringify(previous) !== JSON.stringify(original))
  )
    throw new Error(
      'This entry changed while you were editing. Close and reopen it to use the latest version.',
    );
  const clients = client ? [...data.clients, client] : data.clients;
  validateEntry(entry, clients);
  return {
    ...data,
    clients,
    entries: [
      ...data.entries.filter((e) => e.id !== entry.id),
      previous
        ? applyEntryUpdate(previous, entry)
        : { ...entry, reviewed: false },
    ],
  };
}
export function updateEntries(
  data: Data,
  ids: string[],
  patch: EntryPatch,
): Data {
  const selected = new Set(ids);
  if (ids.some((id) => !data.entries.some((e) => e.id === id)))
    throw new Error('An entry no longer exists. Refresh your selection.');
  return {
    ...data,
    entries: data.entries.map((entry) => {
      if (!selected.has(entry.id)) return entry;
      const merged = { ...entry, ...patch };
      const meaningful =
        (patch.clientId !== undefined && patch.clientId !== entry.clientId) ||
        (patch.billable !== undefined && patch.billable !== entry.billable);
      if (meaningful && patch.reviewed === undefined) merged.reviewed = false;
      validateEntry(merged, data.clients);
      return merged;
    }),
  };
}
export function undoEntries(current: Data, operation: UndoRecord): Data {
  const changed = operation.after.some((after) => {
    const now = current.entries.find((e) => e.id === after.id);
    return !now || JSON.stringify(now) !== JSON.stringify(after);
  });
  if (changed)
    throw new Error(
      'Undo would overwrite work done after the last review action, so it was not applied.',
    );
  const before = new Map(operation.before.map((e) => [e.id, e]));
  return {
    ...current,
    entries: current.entries.map((entry) => before.get(entry.id) ?? entry),
  };
}
