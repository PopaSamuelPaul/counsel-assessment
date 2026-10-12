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
