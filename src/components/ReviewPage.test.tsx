import { useState } from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Data } from '../model';
import { decodeData } from '../model';
import pilot from '../fixtures/pilot-workspace.json';
import { ReviewPage } from './ReviewPage';

const data = decodeData(JSON.stringify(pilot));
const rows = () => document.querySelectorAll('.review-row').length;
const total = () => screen.getByTestId('review-total').textContent;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

function Harness({ initial }: { initial: Data }) {
  const [state, setState] = useState(initial);
  return (
    <ReviewPage
      data={state}
      save={setState}
      onEdit={() => {}}
      readOnly={false}
    />
  );
}

describe('ReviewPage scope', () => {
  it('reports time and row counts for the active filters, not the whole week', () => {
    render(<Harness initial={data} />);
    expect(total()).toBe('22h 30m');
    expect(rows()).toBe(18);

    fireEvent.change(screen.getByLabelText('Review client'), {
      target: { value: 'meridian' },
    });
    expect(total()).toBe('6h 30m');
    expect(rows()).toBe(5);

    fireEvent.change(screen.getByLabelText('Review status'), {
      target: { value: 'reviewed' },
    });
    expect(rows()).toBe(2);
  });

  it('exports only the rows in the current view', async () => {
    let captured: Blob | undefined;
    const createObjectURL = vi.fn((blob: Blob) => {
      captured = blob;
      return 'blob:mock';
    });
    URL.createObjectURL = createObjectURL as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn();

    render(<Harness initial={data} />);
    fireEvent.change(screen.getByLabelText('Review client'), {
      target: { value: 'meridian' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Export view' }));

    expect(createObjectURL).toHaveBeenCalled();
    const csvText = await captured!.text();
    expect(csvText).toContain('"Meridian Holdings"');
    expect(csvText).not.toContain('Northstar Ventures');
    expect(csvText.match(/"Meridian Holdings"/g)).toHaveLength(5);
  });

  it('reopens a reviewed entry after a client correction', () => {
    render(<Harness initial={data} />);
    const row = document.querySelector('[data-entry-id="entry-001"]')!;
    expect(
      within(row as HTMLElement).getByRole('button', {
        name: /Reopen Shareholder agreement review/,
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      within(row as HTMLElement).getByLabelText(
        'Select Shareholder agreement review',
      ),
    );
    fireEvent.change(screen.getByLabelText('Bulk action'), {
      target: { value: 'client' },
    });
    fireEvent.change(screen.getByLabelText('Destination client'), {
      target: { value: 'northstar' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /Apply to 1 selected/ }),
    );

    const updated = document.querySelector('[data-entry-id="entry-001"]')!;
    expect(
      within(updated as HTMLElement).getByRole('button', {
        name: /Review Shareholder agreement review/,
      }),
    ).toBeInTheDocument();
  });
});

beforeEach(() => {
  vi.restoreAllMocks();
});
afterEach(() => {
  cleanup();
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
  vi.restoreAllMocks();
});
