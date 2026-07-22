import { expect, test, type Route } from '@playwright/test';

const APP_ORIGIN = 'http://127.0.0.1:3100';

const savedAddress = {
  id: 'address-default',
  fullName: 'Priya Sharma',
  phone: '9988776655',
  line1: '12 MG Road',
  line2: null,
  city: 'Mumbai',
  state: 'Maharashtra',
  pincode: '400001',
  country: 'IN',
  isDefault: true,
};

const profile = {
  id: 'customer-e2e',
  email: 'checkout@example.test',
  fullName: 'Priya Sharma',
  phone: '9988776655',
  avatarUrl: null,
  role: 'CUSTOMER',
  emailVerified: true,
  skinType: null,
  primaryConcerns: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  addresses: [savedAddress],
  wishlistItems: [],
  hasGoogle: false,
  hasPassword: true,
};

const cart = {
  id: 'cart-e2e',
  lines: [
    {
      productId: 'product-e2e',
      slug: 'neem-face-wash',
      name: 'Neem Face Wash',
      thumbnail: '/favicon.svg',
      unitPrice: { amount: 49900, currency: 'INR' },
      quantity: 1,
      lineTotal: { amount: 49900, currency: 'INR' },
    },
  ],
  subtotal: { amount: 49900, currency: 'INR' },
  discount: { amount: 0, currency: 'INR' },
  shipping: { amount: 0, currency: 'INR' },
  total: { amount: 49900, currency: 'INR' },
  itemCount: 1,
};

const corsHeaders = {
  'access-control-allow-origin': APP_ORIGIN,
  'access-control-allow-credentials': 'true',
  'access-control-allow-headers': 'Accept, Content-Type, Idempotency-Key',
  'access-control-allow-methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
};

async function json(route: Route, status: number, body: unknown) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    headers: corsHeaders,
    body: JSON.stringify(body),
  });
}

test('restores the default saved address after entering a different address', async ({ page }) => {
  let authenticated = false;
  let orderRequests = 0;

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());

    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    if (pathname === '/api/auth/login' && request.method() === 'POST') {
      expect(request.postDataJSON()).toEqual({
        email: 'checkout@example.test',
        password: 'E2e-password-123',
      });
      authenticated = true;
      await json(route, 200, {
        user: {
          id: profile.id,
          email: profile.email,
          fullName: profile.fullName,
          role: profile.role,
          phone: profile.phone,
          avatarUrl: profile.avatarUrl,
        },
      });
      return;
    }

    if (pathname === '/api/customers/me' && request.method() === 'GET') {
      await json(
        route,
        authenticated ? 200 : 401,
        authenticated ? profile : { message: 'Unauthorized' },
      );
      return;
    }

    if (pathname === '/api/cart' && request.method() === 'GET') {
      await json(route, 200, cart);
      return;
    }

    if (pathname === '/api/orders' && request.method() === 'POST') {
      orderRequests += 1;
      await json(route, 503, { message: 'Order creation is disabled in E2E.' });
      return;
    }

    await route.abort('blockedbyclient');
  });

  await page.goto('/login');
  await page.getByRole('tab', { name: 'Email' }).click();
  await page.getByLabel('Email address').fill('checkout@example.test');
  await page.getByLabel('Password').fill('E2e-password-123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole('heading', { name: 'profile.' })).toBeVisible();

  await page.goto('/checkout');
  await expect(page.getByRole('heading', { name: 'Review your order' })).toBeVisible();
  await expect(page.getByText('Neem Face Wash')).toBeVisible();
  await page.getByRole('button', { name: 'Continue to shipping' }).click();
  await expect(page.getByRole('heading', { name: 'Shipping address' })).toBeVisible();

  const savedAddressRadio = page.getByRole('radio', { name: /Priya Sharma/ });
  await expect(savedAddressRadio).toBeChecked();

  const savedFields = [
    ['Full name', savedAddress.fullName],
    ['Mobile number', savedAddress.phone],
    ['Address line 1', savedAddress.line1],
    ['Address line 2 (optional)', ''],
    ['City', savedAddress.city],
    ['State', savedAddress.state],
    ['Pincode', savedAddress.pincode],
  ] as const;

  for (const [label, value] of savedFields) {
    await expect(page.getByLabel(label, { exact: true })).toHaveValue(value);
  }

  await page.getByRole('radio', { name: 'Use a different address' }).check();
  for (const [label] of savedFields) {
    const input = page.getByLabel(label, { exact: true });
    await expect(input).toHaveValue('');
    await expect(input).toBeEditable();
  }

  const manualAddress = {
    fullName: 'Asha Rao',
    phone: '9876543210',
    line1: '44 Lake View Road',
    line2: 'Stale manual landmark',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560001',
  };

  await page.getByLabel('Full name', { exact: true }).fill(manualAddress.fullName);
  await page.getByLabel('Mobile number', { exact: true }).fill(manualAddress.phone);
  await page.getByLabel('Address line 1', { exact: true }).fill(manualAddress.line1);
  await page.getByLabel('Address line 2 (optional)', { exact: true }).fill(manualAddress.line2);
  await page.getByLabel('City', { exact: true }).fill(manualAddress.city);
  await page.getByLabel('State', { exact: true }).fill(manualAddress.state);
  await page.getByLabel('Pincode', { exact: true }).fill(manualAddress.pincode);

  await page.getByText(savedAddress.fullName, { exact: true }).click();
  await expect(savedAddressRadio).toBeChecked();
  for (const [label, value] of savedFields) {
    await expect(page.getByLabel(label, { exact: true })).toHaveValue(value);
  }
  await expect(page.getByLabel('Address line 2 (optional)', { exact: true })).not.toHaveValue(
    manualAddress.line2,
  );
  expect(orderRequests).toBe(0);
});
