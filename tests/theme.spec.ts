import { expect, test, type Page } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(
    results.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
  ).toEqual([]);
}

test('dark theme toggles, persists across reloads, and stays accessible', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Switch to dark theme/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.getByRole('button', { name: /Load a sample workspace/ }).click();
  await expectNoViolations(page);

  await page.getByRole('button', { name: 'Weekly review' }).click();
  await expect(page.locator('.review-row').first()).toBeVisible();
  await expectNoViolations(page);

  await page.getByRole('button', { name: 'Clients' }).click();
  await expect(page.locator('.client-card').first()).toBeVisible();
  await expectNoViolations(page);

  await page.getByRole('button', { name: 'Reports' }).click();
  await expect(page.locator('.report-row').first()).toBeVisible();
  await expectNoViolations(page);

  await page.getByRole('button', { name: 'Log time', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expectNoViolations(page);
  await page.getByRole('button', { name: 'Cancel' }).click();

  await page.getByRole('button', { name: 'Manage data' }).click();
  await page.getByRole('button', { name: /Open pilot workspace/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Replace this workspace?' }),
  ).toBeVisible();
  await expectNoViolations(page);

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
