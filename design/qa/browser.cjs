const { chromium } = require('playwright');
const path = require('path');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://localhost:3001/login');
  await page.getByLabel('Email address').fill('qa@absoluturf.example');
  await page.getByLabel('Password', { exact: true }).fill('qa-password-123');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL('**/dashboard');
  await page.getByRole('heading', { name: 'Welcome back, Robin' }).waitFor();
  await page.getByText('₹600.00').first().waitFor();
  await page.screenshot({ path: path.join(__dirname, 'dashboard-desktop.png'), fullPage: true });
  await page.getByLabel('Search matches and groups').fill('Central');
  await page.locator('.search-results').getByRole('link', { name: /Central Sports Arena/ }).waitFor();
  await page.getByLabel('Clear search').click();

  await page.goto('http://localhost:3001/payments');
  await page.getByRole('heading', { name: 'Every share, accounted for.' }).waitFor();
  await page.getByRole('button', { name: 'Payment details' }).first().click();
  await page.getByRole('dialog').waitFor();
  await page.getByRole('button', { name: 'I have paid' }).click();
  await page.getByRole('status').filter({ hasText: 'Payment submitted' }).waitFor();
  await page.getByRole('button', { name: 'Manage squad payments' }).click();
  await page.getByRole('button', { name: 'Verify payment' }).first().click();
  await page.getByRole('button', { name: 'Confirm received' }).click();
  await page.getByRole('status').filter({ hasText: 'Payment verified' }).waitFor();
  await page.screenshot({ path: path.join(__dirname, 'payments-desktop.png'), fullPage: true });

  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (const route of ['dashboard', 'matches', 'groups', 'payments', 'profile']) {
      await page.goto(`http://localhost:3001/${route}`);
      await page.locator('.app-main').waitFor();
      await page.locator('.app-main h1').first().waitFor();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      assert.equal(overflow, false, `${route} overflows at ${viewport.width}px`);
      if (viewport.width === 390) {
        assert.equal(await page.locator('.bottom-nav a').count(), 5);
        await page.screenshot({ path: path.join(__dirname, `${route}-mobile.png`), fullPage: true });
      }
    }
  }
  await page.goto('http://localhost:3001/matches?create=true');
  await page.getByRole('button', { name: 'Submit Match' }).waitFor();
  await page.goto('http://localhost:3001/groups?create=true');
  await page.getByRole('button', { name: /Create Group/ }).last().waitFor();
  await page.goto('http://localhost:3001/profile');
  await page.getByLabel('Full name').fill('Robin Mathew');
  await page.getByLabel('Phone number').fill('8888888888');
  await page.getByLabel('UPI ID for receiving match payments').fill('robin@bank');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await page.getByRole('status').filter({ hasText: 'Profile updated successfully.' }).waitFor();
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  assert.equal(await page.locator('html.light').count(), 1);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(__dirname, 'profile-light-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await page.goto('http://localhost:3001/dashboard');
  await page.getByLabel('Search clubhouse', { exact: true }).click();
  await page.getByLabel('Search matches and groups').fill('Central');
  await page.locator('.search-results').getByRole('link', { name: /Central Sports Arena/ }).click();
  await page.getByText('Playing Team (2/10)', { exact: false }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, 'Match detail must fit mobile');
  await page.screenshot({ path: path.join(__dirname, 'matchroom-mobile.png'), fullPage: true });

  const signupPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  signupPage.on('pageerror', error => errors.push(error.message));
  await signupPage.goto('http://localhost:3001/login?mode=signup');
  await signupPage.getByLabel('Full name').fill('QA New Player');
  await signupPage.getByLabel('Phone number').fill('9999999999');
  await signupPage.getByLabel('Email address').fill('new-player@qa.example');
  await signupPage.getByLabel('Password', { exact: true }).fill('qa-password-123');
  await signupPage.getByRole('button', { name: 'Create account', exact: true }).click();
  await signupPage.waitForURL('**/dashboard');
  await signupPage.getByRole('heading', { name: 'Welcome back, QA' }).waitFor();
  await signupPage.goto('http://localhost:3001/groups?create=true');
  await signupPage.getByPlaceholder('e.g. Champions FC').fill('QA New Squad');
  await signupPage.getByRole('button', { name: 'Create', exact: true }).click();
  await signupPage.getByRole('heading', { name: 'QA New Squad' }).waitFor();
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('Browser QA passed: signup/login, group creation, desktop/mobile search, payment submit/verify, profile save, light/dark mode, 5 routes and matchroom on mobile; no overflow or runtime errors.');
})().catch(error => { console.error(error); process.exit(1); });
