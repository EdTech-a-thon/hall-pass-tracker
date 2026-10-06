import { expect, test } from '@playwright/test';
import { circle, createClass, snap } from './helpers.ts';

/** Pictures for the guide at /guides/separate-bathroom-lines. */
const guide = 'separate-bathroom-lines';

test('separate lines for the girls’ and boys’ bathrooms', async ({ page }) => {
  await createClass(page, 'Period 3', ['Ava Johnson', 'Mia Rodriguez', 'Liam Chen', 'Noah Patel']);

  // 1. Open the Bathroom that every class starts with.
  await page.getByRole('link', { name: 'Destinations' }).click();
  const bathroom = page.getByRole('button', { name: /^Bathroom/ });
  await circle(bathroom);
  await snap(page, guide, '1-open-bathroom', page.getByRole('link', { name: 'Destinations' }));

  // 2. Rename it to the girls' bathroom, one student at a time.
  await bathroom.click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name').fill('Girls’ Bathroom');
  await circle(dialog.getByLabel('Name'));
  await circle(dialog.getByLabel('Students here at once'));
  await snap(page, guide, '2-rename-girls');
  await dialog.getByRole('button', { name: 'Save' }).click();

  // 3. Add a second destination for the boys' bathroom.
  const add = page.getByRole('button', { name: 'Add destination' }).first();
  await circle(add);
  await snap(page, guide, '3-add-destination', page.getByRole('heading', { name: 'Where students can go' }));
  await add.click();
  await dialog.getByLabel('Name').fill('Boys’ Bathroom');
  await dialog.getByLabel(/Minutes the trip should take/).fill('5');
  await dialog.getByLabel('Students here at once').selectOption({ label: '1 at a time' });
  await dialog.getByRole('button', { name: 'teal' }).click();
  await dialog.getByLabel('Search icons').fill('toilet');
  await dialog.getByRole('button', { name: 'toilet' }).click();
  await dialog.getByLabel('Search icons').fill('');
  await circle(dialog.getByLabel('Name'));
  await circle(dialog.getByLabel('Students here at once'));
  await snap(page, guide, '4-name-boys');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();

  // 4. Both bathrooms now take one student at a time, each on its own.
  await circle(page.getByRole('button', { name: /^Girls’ Bathroom/ }));
  await circle(page.getByRole('button', { name: /^Boys’ Bathroom/ }));
  await snap(page, guide, '5-both-bathrooms');

  // 5. Turn on lines.
  await page.getByRole('link', { name: 'Pass Options' }).click();
  const lines = page.getByRole('switch', { name: 'Let students line up' });
  await lines.check();
  const row = page.locator('.option-row').filter({ has: lines });
  await circle(row.locator('.switch'));
  await snap(page, guide, '6-turn-on-lines', row);

  // At the kiosk: Ava is in the girls' bathroom, so Mia can line up for it while Liam goes straight to the boys'.
  await page.getByRole('link', { name: /Kiosk/ }).click();
  await page.getByLabel('PIN (4 to 8 digits)').fill('2468');
  await page.getByRole('button', { name: 'Save PIN' }).click();
  await page.getByRole('button', { name: 'Use this computer' }).click();
  await page.getByRole('button', { name: 'Open kiosk screen' }).click();
  await page.getByRole('button', { name: /^Ava/ }).click();
  await page.getByRole('button', { name: /^Girls’ Bathroom/ }).click();
  await page.getByRole('button', { name: 'Done' }).click();

  await page.getByRole('button', { name: /^Mia/ }).click();
  await circle(page.getByRole('button', { name: /^Girls’ Bathroom/ }));
  await circle(page.getByRole('button', { name: /^Boys’ Bathroom/ }));
  await snap(page, guide, '7-kiosk-one-full');
  await page.getByRole('button', { name: /^Girls’ Bathroom/ }).click();
  await page.getByRole('button', { name: 'Join the line' }).click();
  await expect(page.getByText('You’re 1st in line for Girls’ Bathroom').or(page.getByText("You're 1st in line for Girls’ Bathroom"))).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();

  await page.getByRole('button', { name: /^Liam/ }).click();
  await page.getByRole('button', { name: /^Boys’ Bathroom/ }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await snap(page, guide, '8-kiosk-line');
});
