const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const base = 'http://localhost:3001';
  const plain = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await plain.newPage();
  await staticPage.goto(base + '/login');
  await staticPage.getByRole('link', { name: 'Create an account', exact: true }).click();
  await staticPage.getByRole('heading', { name: 'Join the clubhouse' }).waitFor();
  await staticPage.getByLabel('Full name').waitFor();
  await plain.close();

  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  let requests = 0;
  await context.route('**/api/auth/signup', async route => {
    requests++;
    const payload = route.request().postDataJSON();
    assert.equal(payload.name, 'Signup Check');
    await route.abort('failed');
  });
  await page.goto(base + '/login?redirect=%2Fgroups');
  await page.getByRole('link', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Full name').fill('Signup Check');
  await page.getByLabel('Phone number').fill('+919999999999');
  await page.getByLabel('Email address').fill('signup-check@example.com');
  await page.getByLabel('Password', { exact: true }).fill('signup-check-password');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Unable to connect to the server' }).waitFor();
  assert.equal(requests, 1);
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByRole('heading', { name: 'Welcome back' }).waitFor();
  await page.goBack();
  await page.getByRole('heading', { name: 'Join the clubhouse' }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get('redirect'), '/groups');
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('Passed: signup navigation with/without JavaScript, submission, visible network error, browser back and redirect preservation.');
})().catch(error => { console.error(error); process.exit(1); });
