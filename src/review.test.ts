import { describe, expect, it } from 'vitest';
import type { Data, Entry } from './model';
import {
  mostRecentEntry,
  saveEntry,
  selectReview,
  undoEntries,
  updateEntries,
  type UndoRecord,
} from './review';

const clients = [
  { id: 'meridian', name: 'Meridian Holdings', color: '#7460a8' },
  { id: 'northstar', name: 'Northstar Ventures', color: '#416e83' },
];
const base = (over: Partial<Entry> = {}): Entry => ({
  id: 'e1',
  date: '2026-09-28',
  minutes: 90,
  clientId: 'meridian',
  billable: true,
  description: 'Shareholder agreement review',
  employee: 'Alex Morgan',
  reviewed: true,
  ...over,
});
const dataOf = (...entries: Entry[]): Data => ({
  version: 1,
  clients,
  entries,
});

describe('updateEntries', () => {
  it('requires a fresh review after a billability correction', () => {
    const data = dataOf(base());
    const next = updateEntries(data, ['e1'], { billable: false });
    expect(next.entries[0]).toMatchObject({ billable: false, reviewed: false });
  });

  it('requires a fresh review after a client correction', () => {
    const data = dataOf(base());
    const next = updateEntries(data, ['e1'], { clientId: 'northstar' });
    expect(next.entries[0]).toMatchObject({
      clientId: 'northstar',
      reviewed: false,
    });
  });

  it('does not reopen an entry when the action changes nothing', () => {
    const data = dataOf(base());
    expect(
      updateEntries(data, ['e1'], { billable: true }).entries[0].reviewed,
    ).toBe(true);
    expect(
      updateEntries(data, ['e1'], { clientId: 'meridian' }).entries[0].reviewed,
    ).toBe(true);
  });

  it('marks reviewed without reopening, and leaves other entries alone', () => {
    const data = dataOf(
      base({ id: 'e1', reviewed: false }),
      base({ id: 'e2' }),
    );
    const next = updateEntries(data, ['e1'], { reviewed: true });
    expect(next.entries.find((e) => e.id === 'e1')?.reviewed).toBe(true);
    expect(next.entries.find((e) => e.id === 'e2')).toEqual(data.entries[1]);
  });

  it('rejects stale selections', () => {
    expect(() => updateEntries(dataOf(base()), ['missing'], {})).toThrow(
      'no longer exists',
    );
  });
});

describe('entry edits', () => {
  it('preserves billability and reopens review after a description edit', () => {
    const original = base({ reviewed: true, billable: false });
    const data = dataOf(original);
    const edited = { ...original, description: 'Updated wording' };
    const saved = saveEntry(data, edited, undefined, original);
    expect(saved.entries[0]).toMatchObject({
      billable: false,
      reviewed: false,
    });
  });

  it('keeps review status when an edit makes no change', () => {
    const original = base({ reviewed: true, billable: false });
    const data = dataOf(original);
    const saved = saveEntry(data, { ...original }, undefined, original);
    expect(saved.entries[0].reviewed).toBe(true);
  });
});

describe('undoEntries', () => {
  const action = (): { data: Data; operation: UndoRecord } => {
    const before = dataOf(
      base({ id: 'e1' }),
      base({ id: 'e2', billable: true }),
    );
    const after = updateEntries(before, ['e1'], { billable: false });
    const affected = (d: Data) => d.entries.filter((e) => e.id === 'e1');
    return {
      data: after,
      operation: { before: affected(before), after: affected(after) },
    };
  };

  it('reverses only the affected entries and keeps independent work', () => {
    const { data, operation } = action();
    const withNewerWork: Data = {
      ...data,
      entries: data.entries.map((e) =>
        e.id === 'e2' ? { ...e, description: 'Edited later' } : e,
      ),
    };
    const undone = undoEntries(withNewerWork, operation);
    expect(undone.entries.find((e) => e.id === 'e1')).toEqual(
      operation.before.find((e) => e.id === 'e1'),
    );
    expect(undone.entries.find((e) => e.id === 'e2')?.description).toBe(
      'Edited later',
    );
  });

  it('declines rather than overwriting newer work on an affected entry', () => {
    const { data, operation } = action();
    const conflicting: Data = {
      ...data,
      entries: data.entries.map((e) =>
        e.id === 'e1' ? { ...e, description: 'Changed after undo target' } : e,
      ),
    };
    expect(() => undoEntries(conflicting, operation)).toThrow('overwrite work');
  });

  it('declines when an affected entry was deleted', () => {
    const { data, operation } = action();
    expect(() =>
      undoEntries(
        { ...data, entries: data.entries.filter((e) => e.id !== 'e1') },
        operation,
      ),
    ).toThrow('overwrite work');
  });
});

describe('mostRecentEntry', () => {
  it('returns undefined when there is nothing to repeat', () => {
    expect(mostRecentEntry([])).toBeUndefined();
  });

  it('picks the latest entry for the current profile, ignoring others', () => {
    const entries = [
      base({ id: 'e1', date: '2026-09-29' }),
      base({ id: 'e2', date: '2026-10-02' }),
      base({ id: 'e3', date: '2026-10-04', employee: 'Sofia Reyes' }),
    ];
    expect(mostRecentEntry(entries)?.id).toBe('e2');
  });

  it('breaks same-day ties by the latest id', () => {
    const entries = [
      base({ id: 'e2', date: '2026-10-02' }),
      base({ id: 'e9', date: '2026-10-02' }),
    ];
    expect(mostRecentEntry(entries)?.id).toBe('e9');
  });

  it('does not mutate the input order', () => {
    const entries = [
      base({ id: 'e1', date: '2026-09-29' }),
      base({ id: 'e2', date: '2026-10-02' }),
    ];
    mostRecentEntry(entries);
    expect(entries.map((e) => e.id)).toEqual(['e1', 'e2']);
  });
});

describe('selectReview', () => {
  const entries = [
    base({ id: 'e1', clientId: 'meridian', billable: true, reviewed: true }),
    base({ id: 'e2', clientId: 'northstar', billable: false, reviewed: false }),
  ];
  const filters = {
    week: '2026-09-28',
    clientId: 'all',
    employee: 'all',
    status: 'all',
    search: '',
  };

  it('filters the week by client and status so totals match the visible rows', () => {
    expect(
      selectReview(entries, clients, { ...filters, clientId: 'meridian' }),
    ).toHaveLength(1);
    expect(
      selectReview(entries, clients, { ...filters, status: 'reviewed' }),
    ).toHaveLength(1);
    expect(selectReview(entries, clients, filters)).toHaveLength(2);
  });
});
