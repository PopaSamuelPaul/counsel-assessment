import { readFile } from 'node:fs/promises';
import { test, expect, type Page } from '@playwright/test';

async function loadPilot(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Manage data' }).click();
  await page.getByRole('button', { name: /Open pilot workspace/ }).click();
  await page.getByRole('button', { name: 'Replace and restore' }).click();
  await page.getByRole('button', { name: 'Weekly review' }).click();
  await expect(page.locator('input[aria-label="Review week"]')).toHaveValue(
    '2026-09-28',
  );
}

test('review totals, export, selection and corrections follow the active view', async ({
  page,
}) => {
  await loadPilot(page);

  await expect(page.getByTestId('review-total')).toHaveText('22h 30m');
  await expect(page.locator('.review-row')).toHaveCount(18);

  await page.getByLabel('Review client').selectOption('meridian');
  await expect(page.getByTestId('review-total')).toHaveText('6h 30m');
  await expect(page.locator('.review-row')).toHaveCount(5);

  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export view' }).click();
  const file = await (await downloading).path();
  const csv = await readFile(file, 'utf8');
  expect(csv).toContain('Meridian Holdings');
  expect(csv).not.toContain('Northstar Ventures');

  await page.locator('.review-row input[type="checkbox"]').first().check();
  await expect(page.locator('.selection-count')).toHaveText('1 selected');
  await page.getByLabel('Review status').selectOption('reviewed');
  await expect(page.locator('.selection-count')).toHaveText('0 selected');
});

test('editing only the description preserves billability', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Manage data' }).click();
  await page.getByRole('button', { name: /Open pilot workspace/ }).click();
  await page.getByRole('button', { name: 'Replace and restore' }).click();
  await page.getByRole('button', { name: 'Time entries' }).click();

  await page
    .getByRole('button', {
      name: 'Edit Firm · Internal: Weekly team planning',
    })
    .click();
  await page.getByLabel('Description').fill('Weekly team planning (updated)');
  await page.getByRole('button', { name: 'Save changes' }).click();

  const row = page.getByRole('row', {
    name: /Weekly team planning \(updated\)/,
  });
  await expect(row).toContainText('Non-billable');
});

test('a client correction returns a reviewed entry to needs review', async ({
  page,
}) => {
  await loadPilot(page);
  const row = page.locator('[data-entry-id="entry-001"]');
  await expect(
    row.getByRole('button', { name: /Reopen Shareholder agreement review/ }),
  ).toBeVisible();

  await row.getByLabel('Select Shareholder agreement review').check();
  await page.getByLabel('Bulk action').selectOption('client');
  await page.getByLabel('Destination client').selectOption('northstar');
  await page.getByRole('button', { name: /Apply to 1 selected/ }).click();

  await expect(
    page
      .locator('[data-entry-id="entry-001"]')
      .getByRole('button', { name: /Review Shareholder agreement review/ }),
  ).toBeVisible();
});

async function moveToNorthstar(page: Page) {
  await page
    .locator('[data-entry-id="entry-001"]')
    .getByLabel('Select Shareholder agreement review')
    .check();
  await page.getByLabel('Bulk action').selectOption('client');
  await page.getByLabel('Destination client').selectOption('northstar');
  await page.getByRole('button', { name: /Apply to 1 selected/ }).click();
}

async function editDescription(page: Page, id: string, description: string) {
  await page
    .locator(`[data-entry-id="${id}"]`)
    .getByRole('button', { name: /Edit review entry/ })
    .click();
  await page.getByLabel('Description').fill(description);
  await page.getByRole('button', { name: 'Save changes' }).click();
}

test('undo declines rather than overwriting a newer edit on an affected entry', async ({
  page,
}) => {
  await loadPilot(page);
  await moveToNorthstar(page);
  await editDescription(
    page,
    'entry-001',
    'Shareholder agreement review (revised)',
  );

  await page.getByRole('button', { name: /Undo last action/ }).click();
  await expect(page.getByRole('alert')).toContainText('was not applied');
  await expect(page.locator('[data-entry-id="entry-001"]')).toContainText(
    '(revised)',
  );
});

test('undo keeps independent edits made on other entries', async ({ page }) => {
  await loadPilot(page);
  await moveToNorthstar(page);
  await editDescription(page, 'entry-002', 'Weekly team planning (revised)');

  await page.getByRole('button', { name: /Undo last action/ }).click();
  await expect(page.getByText('Last review action undone.')).toBeVisible();
  await expect(page.locator('[data-entry-id="entry-001"]')).toContainText(
    'Meridian Holdings',
  );
  await expect(page.locator('[data-entry-id="entry-002"]')).toContainText(
    '(revised)',
  );
});

test('changing the view clears the pending undo so it cannot touch hidden rows', async ({
  page,
}) => {
  await loadPilot(page);
  await moveToNorthstar(page);
  await expect(
    page.getByRole('button', { name: /Undo last action/ }),
  ).toBeVisible();

  await page.getByLabel('Review status').selectOption('reviewed');
  await expect(
    page.getByRole('button', { name: /Undo last action/ }),
  ).toHaveCount(0);
  await expect(page.getByText(/can no longer be undone/)).toBeVisible();
});
