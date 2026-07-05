import test from 'node:test';
import assert from 'node:assert/strict';
import { integrationsStatus } from './integrations-status';

test('integrationsStatus is true only when ALL required keys for a provider are present', () => {
  const full = integrationsStatus({
    CLOUDINARY_CLOUD_NAME: 'c', CLOUDINARY_API_KEY: 'k', CLOUDINARY_API_SECRET: 's',
    R2_ACCOUNT_ID: 'a', R2_ACCESS_KEY_ID: 'k', R2_SECRET_ACCESS_KEY: 's', R2_BUCKET: 'b',
    PHONEPE_MERCHANT_ID: 'm', PHONEPE_SALT_KEY: 'salt', PHONEPE_BASE_URL: 'https://x',
    RESEND_API_KEY: 're',
  });
  assert.deepEqual(full, { cloudinary: true, r2: true, phonepe: true, email: true });

  const none = integrationsStatus({});
  assert.deepEqual(none, { cloudinary: false, r2: false, phonepe: false, email: false });
});

test('a partially-configured provider reads as NOT configured', () => {
  const partial = integrationsStatus({
    CLOUDINARY_CLOUD_NAME: 'c', CLOUDINARY_API_KEY: 'k', // missing secret
    R2_ACCOUNT_ID: 'a', R2_ACCESS_KEY_ID: 'k', R2_SECRET_ACCESS_KEY: 's', // missing bucket
    PHONEPE_MERCHANT_ID: '  ', // whitespace only
  });
  assert.equal(partial.cloudinary, false);
  assert.equal(partial.r2, false);
  assert.equal(partial.phonepe, false);
});
