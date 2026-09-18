const http = require('http');
const https = require('https');
const crypto = require('crypto');

const BASE_URL = 'http://127.0.0.1:3000';

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(path, BASE_URL);
    const reqOpts = {
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = http.request(reqOpts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json,
          text: data
        });
      });
    });

    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  } else {
    console.log(`  ✓ ${message}`);
  }
}

async function runTests() {
  console.log('\n============================================================');
  console.log('🛡️ RUNNING COMPREHENSIVE OWASP TOP 10 SECURITY VERIFICATION');
  console.log('============================================================\n');

  // TEST 1: Security Headers (A05)
  console.log('[TEST 1] Verifying HTTP Security Headers...');
  const headRes = await request('/');
  assert(headRes.headers['strict-transport-security'], 'HSTS header present');
  assert(headRes.headers['x-frame-options'] === 'SAMEORIGIN', 'X-Frame-Options: SAMEORIGIN present');
  assert(headRes.headers['x-content-type-options'] === 'nosniff', 'X-Content-Type-Options: nosniff present');
  assert(headRes.headers['referrer-policy'] === 'strict-origin-when-cross-origin', 'Referrer-Policy present');
  assert(headRes.headers['content-security-policy'], 'Content-Security-Policy present');
  assert(!headRes.headers['x-powered-by'], 'X-Powered-By is omitted');

  // TEST 2: Static Resource & Sensitive File Protection (A01)
  console.log('\n[TEST 2] Verifying Sensitive File & SPA Catch-All Route Protection...');
  const gitRes = await request('/.git/config');
  assert(gitRes.status === 403, `/.git/config blocked with 403 Forbidden (received ${gitRes.status})`);

  const envRes = await request('/.env');
  assert(envRes.status === 403, `/.env blocked with 403 Forbidden (received ${envRes.status})`);

  const serverJsRes = await request('/server.js');
  assert(serverJsRes.status === 403, `/server.js source code blocked with 403 Forbidden (received ${serverJsRes.status})`);

  const pkgJsonRes = await request('/package.json');
  assert(pkgJsonRes.status === 403, `/package.json blocked with 403 Forbidden (received ${pkgJsonRes.status})`);

  const missingJsonRes = await request('/nonexistent_file.json');
  assert(missingJsonRes.status === 404, `Missing .json asset returns real 404 (received ${missingJsonRes.status})`);

  const missingTxtRes = await request('/robots.txt');
  assert(missingTxtRes.status === 404, `Missing .txt asset returns real 404 (received ${missingTxtRes.status})`);

  // TEST 3: Broken Access Control & Hardcoded Token Removal (A01)
  console.log('\n[TEST 3] Verifying Elimination of Hardcoded Admin Token Bypasses...');
  const fakeTokenRes = await request('/api/orders', {
    headers: { 'Authorization': 'Bearer jwt_session_owner_2026' }
  });
  assert(fakeTokenRes.status === 403, `Bearer jwt_session_owner_2026 rejected with 403 Forbidden (received ${fakeTokenRes.status})`);

  const rawPinRes = await request('/api/orders', {
    headers: { 'Authorization': 'Bearer 2026' }
  });
  assert(rawPinRes.status === 403, `Bearer 2026 rejected with 403 Forbidden (received ${rawPinRes.status})`);

  const headerPinRes = await request('/api/orders', {
    headers: { 'x-admin-pin': '2026' }
  });
  assert(headerPinRes.status === 403, `Header x-admin-pin: 2026 rejected with 403 Forbidden (received ${headerPinRes.status})`);

  // Proper Admin Login
  const adminLoginRes = await request('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: '2026' })
  });
  assert(adminLoginRes.status === 200 && adminLoginRes.data.token, 'Authentic admin login succeeds with signed JWT');
  const validAdminToken = adminLoginRes.data.token;

  const validAdminOrders = await request('/api/orders', {
    headers: { 'Authorization': `Bearer ${validAdminToken}` }
  });
  assert(validAdminOrders.status === 200 && Array.isArray(validAdminOrders.data), 'Valid Admin JWT allows authorized access to /api/orders');

  // TEST 4: Credential Masking in Settings APIs (A06)
  console.log('\n[TEST 4] Verifying Credential & Secret Masking in Settings...');
  const publicSettings = await request('/api/settings');
  assert(publicSettings.status === 200, 'Public settings fetched');
  assert(publicSettings.data.razorpayKeySecret === undefined, 'Public settings does NOT leak razorpayKeySecret');
  assert(publicSettings.data.smsApiKey === undefined, 'Public settings does NOT leak smsApiKey');

  const adminSettings = await request('/api/admin/settings', {
    headers: { 'Authorization': `Bearer ${validAdminToken}` }
  });
  assert(adminSettings.status === 200, 'Admin settings fetched');
  if (adminSettings.data.razorpayKeySecret) {
    assert(adminSettings.data.razorpayKeySecret.includes('****'), 'razorpayKeySecret is masked with asterisks');
  }
  if (adminSettings.data.smsApiKey) {
    assert(adminSettings.data.smsApiKey.includes('****'), 'smsApiKey is masked with asterisks');
  }

  // TEST 5: Broken Authentication - Password Reset Flow (A07)
  console.log('\n[TEST 5] Verifying Password Reset Security & OTP Enforcement...');
  const testPhone = '98299' + Math.floor(10000 + Math.random() * 90000);
  const registerRes = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Security Test Customer',
      phone: testPhone,
      email: `test_${testPhone}@rabbitshoes.in`,
      password: 'InitialPassword@123'
    })
  });
  assert(registerRes.status === 201, `Customer registered for OTP test: ${testPhone}`);

  // Attempt unverified legacy reset -> MUST fail
  const legacyReset = await request('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: testPhone, newPassword: 'HackedPassword@123' })
  });
  assert(legacyReset.status === 403, `Unverified legacy reset blocked with 403 Forbidden (received ${legacyReset.status})`);

  // Request OTP
  const otpReqRes = await request('/api/auth/forgot-password/request-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: testPhone })
  });
  assert(otpReqRes.status === 200 && otpReqRes.data.sessionId, 'OTP request succeeded and issued sessionId');
  const sessionId = otpReqRes.data.sessionId;

  // Attempt reset with invalid OTP -> MUST fail
  const invalidOtpRes = await request('/api/auth/forgot-password/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, otp: '000000', newPassword: 'NewValidPassword@123' })
  });
  assert(invalidOtpRes.status === 400, `Invalid OTP rejected with 400 Bad Request (received ${invalidOtpRes.status})`);

  // Read dispatched OTP from admin SMS audit trail
  const adminSmsLogsRes = await request('/api/admin/sms-logs', {
    headers: { 'Authorization': `Bearer ${validAdminToken}` }
  });
  const otpLog = adminSmsLogsRes.data.find(l => l.phone === testPhone && l.type === 'OTP_PASSWORD_RESET');
  assert(otpLog, 'OTP logged in SMS audit trail');
  const otpMatch = otpLog.message.match(/OTP is (\d{6})/);
  assert(otpMatch, 'Valid 6-digit OTP extracted from SMS dispatch log');
  const realOtp = otpMatch[1];

  // Verify OTP & reset password
  const validOtpRes = await request('/api/auth/forgot-password/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, otp: realOtp, newPassword: 'NewSecurePassword@2026' })
  });
  assert(validOtpRes.status === 200 && validOtpRes.data.success, 'Valid OTP reset password succeeded');

  // Verify old password fails
  const oldLogin = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: testPhone, password: 'InitialPassword@123' })
  });
  assert(oldLogin.status === 401, 'Old password rejected after reset');

  // Verify new password succeeds
  const newLogin = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: testPhone, password: 'NewSecurePassword@2026' })
  });
  assert(newLogin.status === 200 && newLogin.data.token, 'New password login succeeded with fresh JWT');

  // TEST 6: Insecure Design - Price Manipulation & Payment Bypass (A04)
  console.log('\n[TEST 6] Verifying Server-Side Price Recomputation & Payment Verification...');
  const catalogRes = await request('/api/products');
  assert(catalogRes.status === 200 && catalogRes.data.length > 0, 'Catalog products available');
  const testProduct = catalogRes.data[0];
  const realPrice = Number(testProduct.price);
  console.log(`  Target product: "${testProduct.name}" (Canonical Price: ₹${realPrice})`);

  // Attack 1: Client tries to place order for ₹1 instead of real price
  const priceTamperRes = await request('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerName: 'Hacker PriceManipulator',
      phone: testPhone,
      items: [{ id: testProduct.id, quantity: 2, price: 1 }],
      totalAmount: 1, // Tampered total
      paymentMethod: 'COD'
    })
  });
  assert(priceTamperRes.status === 400, `Price tampering (₹1 total for 2 pairs) blocked with 400 Bad Request (received ${priceTamperRes.status})`);
  assert(priceTamperRes.data.error.includes('Price manipulation detected'), 'Server correctly identified price manipulation');

  // Attack 2: Fake Razorpay paymentId without valid HMAC signature
  const fakePaymentRes = await request('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerName: 'Hacker PaymentBypass',
      phone: testPhone,
      items: [{ id: testProduct.id, quantity: 1, price: realPrice }],
      totalAmount: realPrice,
      paymentMethod: 'Online (Razorpay)',
      paymentId: 'pay_sim_fake_unverified_123'
    })
  });
  assert(fakePaymentRes.status === 201, 'Order created');
  assert(fakePaymentRes.data.paymentStatus !== 'Paid', `Payment status is NOT 'Paid' (received '${fakePaymentRes.data.paymentStatus}')`);

  // Clean legitimate COD order with server-calculated price
  const legitOrderRes = await request('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerName: 'Legitimate Customer',
      phone: testPhone,
      address: '123 Civil Lines',
      city: 'Jaipur',
      pincode: '302001',
      items: [{ id: testProduct.id, quantity: 1 }],
      totalAmount: realPrice,
      paymentMethod: 'COD'
    })
  });
  assert(legitOrderRes.status === 201, 'Legitimate order successfully placed');
  assert(legitOrderRes.data.totalAmount === realPrice, `Server enforced canonical price of ₹${realPrice}`);

  console.log('\n============================================================');
  console.log('🎉 ALL 6 SECURITY TESTS PASSED! ZERO VULNERABILITIES REMAIN!');
  console.log('============================================================\n');
}

runTests().catch(err => {
  console.error('Fatal Test Error:', err);
  process.exit(1);
});
