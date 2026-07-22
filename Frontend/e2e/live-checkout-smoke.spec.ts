import { expect, test, type Page, type Route } from '@playwright/test';

const requiredEnvironment = ['LIVE_BASE_URL', 'LIVE_TEST_EMAIL', 'LIVE_TEST_PASSWORD'] as const;
const missingEnvironment = requiredEnvironment.filter((name) => !process.env[name]?.trim());

test.skip(
  missingEnvironment.length > 0,
  `Live checkout smoke requires: ${missingEnvironment.join(', ')}`,
);

interface LiveAddress {
  id: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isDefault: boolean;
}

interface LiveProfile {
  addresses: LiveAddress[];
}

function isProfileResponse(url: string, method: string, status: number) {
  return (
    method === 'GET' &&
    status === 200 &&
    new URL(url).pathname.replace(/\/+$/, '') === '/api/customers/me'
  );
}

async function installSafetyGuards(page: Page, attemptedUnsafeRequests: string[]) {
  await page.route('**/*', async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const path = url.pathname.replace(/\/+$/, '');
    const isNonRead = !['GET', 'HEAD'].includes(method);
    const isOrderMutation =
      isNonRead && (path === '/api/orders' || path.startsWith('/api/orders/'));
    const isPaymentRequest =
      /razorpay/i.test(url.hostname) || /\/api\/(?:razorpay|payments?)(?:\/|$)/i.test(path);
    const isCustomerDataMutation =
      isNonRead && /\/api\/(?:customers?|profile|addresses?)(?:\/|$)/i.test(path);
    const isCartMutation =
      isNonRead && (path === '/api/cart' || path.startsWith('/api/cart/'));

    if (isOrderMutation || isPaymentRequest || isCustomerDataMutation || isCartMutation) {
      attemptedUnsafeRequests.push(`${method} ${url.origin}${url.pathname}`);
      await route.abort('blockedbyclient');
      return;
    }

    await route.fallback();
  });
}

test('deployed checkout applies the signed-in customer default address', async ({ page }) => {
  const baseURL = process.env.LIVE_BASE_URL!;
  const email = process.env.LIVE_TEST_EMAIL!;
  const password = process.env.LIVE_TEST_PASSWORD!;
  const deployedOrigin = new URL(baseURL);
  expect(deployedOrigin.protocol, 'Live credentials must only be sent over HTTPS.').toBe('https:');
  expect(
    deployedOrigin.username || deployedOrigin.password,
    'LIVE_BASE_URL must not contain embedded credentials.',
  ).toBe('');

  const attemptedUnsafeRequests: string[] = [];
  await installSafetyGuards(page, attemptedUnsafeRequests);

  try {
    await page.goto('/login');
    await page.getByRole('tab', { name: 'Email' }).click();
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password').fill(password);

    const authenticatedProfileResponse = page.waitForResponse((response) =>
      isProfileResponse(response.url(), response.request().method(), response.status()),
    );
    await page.getByRole('button', { name: 'Sign in' }).click();
    const profileResponse = await authenticatedProfileResponse;
    await expect(page).toHaveURL(/\/account$/);

    const profile = (await profileResponse.json()) as LiveProfile;
    expect(
      profile.addresses.length,
      'The live test customer needs at least one saved address.',
    ).toBeGreaterThan(0);
    const defaultAddress = profile.addresses.find((address) => address.isDefault);
    expect(defaultAddress, 'The live test customer needs a default saved address.').toBeTruthy();

    const checkoutProfileResponse = page.waitForResponse((response) =>
      isProfileResponse(response.url(), response.request().method(), response.status()),
    );
    await page.goto('/checkout');
    await checkoutProfileResponse;
    await expect(page.getByRole('heading', { name: 'Review your order' })).toBeVisible();
    await page.getByRole('button', { name: 'Continue to shipping' }).click();
    await expect(page.getByRole('heading', { name: 'Shipping address' })).toBeVisible();

    const address = defaultAddress!;
    await expect(page.getByText(address.fullName, { exact: true }).first()).toBeVisible();
    const defaultAddressRadio = page.getByRole('radio', { name: /Default/i });
    await expect(defaultAddressRadio).toBeChecked();

    const savedFields = [
      ['Full name', address.fullName],
      ['Mobile number', address.phone],
      ['Address line 1', address.line1],
      ['Address line 2 (optional)', address.line2 ?? ''],
      ['City', address.city],
      ['State', address.state],
      ['Pincode', address.pincode],
    ] as const;

    for (const [label, value] of savedFields) {
      await expect(page.getByLabel(label, { exact: true })).toHaveValue(value);
    }

    await page.getByRole('radio', { name: 'Use a different address' }).check();
    for (const [label] of savedFields) {
      await expect(page.getByLabel(label, { exact: true })).toBeEditable();
    }
  } finally {
    expect(
      attemptedUnsafeRequests,
      'The smoke test attempted an order, payment, customer-data, or cart mutation.',
    ).toEqual([]);
  }
});
