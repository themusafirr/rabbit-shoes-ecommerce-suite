// Rabbit Shoes - Comprehensive Automated End-to-End Loop Test
// Validates:
// 1. Mandatory login enforcement on orders (401 when unauthenticated)
// 2. Customer Registration, Login & JWT verification
// 3. Forgot Password Account Recovery & Re-login
// 4. Placing Orders with authentic Multi-Color & UK Size choices
// 5. Initial Courier state: 'Waiting for Pickup Delivery Partner', 'Pending Dispatch'
// 6. Public Tracking Endpoint validation
// 7. Admin Authentication (PIN 2026)
// 8. Admin Real Courier Dispatch (Ekart Logistics / Delhivery) + Real AWB assignment
// 9. Customer Real-Time Tracking confirmation of dispatched courier & AWB
// 10. Multi-Loop Iteration Stress Test

const BASE_URL = 'http://localhost:3000';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  let data = null;
  try {
    data = await res.json();
  } catch(e) {
    data = null;
  }
  return { status: res.status, ok: res.ok, data };
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ PASSED: ${message}`);
}

async function runSingleLoop(iteration) {
  console.log(`\n===============================================================`);
  console.log(`🔄 RUNNING LOOP ITERATION #${iteration}`);
  console.log(`===============================================================`);

  const randomDigits = Math.floor(10000 + Math.random() * 90000);
  const testPhone = `98200${randomDigits}`;
  const testPassword = `Pass#${randomDigits}`;
  const newPassword = `NewPass#${randomDigits}`;

  // STEP 1: Test Unauthenticated Order Placement (MUST BE BLOCKED)
  console.log('\n[TEST 1] Verifying Mandatory Login on /api/orders (Without Token)...');
  const unauthOrder = await request('/api/orders', {
    method: 'POST',
    body: JSON.stringify({
      customerName: 'Anonymous Buyer',
      phone: testPhone,
      items: [{ id: 'campus-ath-001', name: 'Campus ATHERO', price: 1499, size: 8, quantity: 1 }],
      totalAmount: 1499
    })
  });
  assert(unauthOrder.status === 401, 'Unauthenticated order was blocked with HTTP 401');

  // STEP 2: Customer Registration
  console.log('\n[TEST 2] Registering New Customer Account...');
  const regRes = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: `Tester ${randomDigits}`,
      phone: testPhone,
      password: testPassword,
      address: 'Plot 42, Green Avenue, Sector 18',
      city: 'Gurugram',
      pincode: '122001'
    })
  });
  assert(regRes.status === 201 && regRes.data.token, `Customer registered successfully with phone: ${testPhone}`);
  let token = regRes.data.token;

  // STEP 3: Customer Login Verification
  console.log('\n[TEST 3] Verifying Customer Login (/api/auth/login)...');
  const loginRes = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      identifier: testPhone,
      password: testPassword
    })
  });
  assert(loginRes.status === 200 && loginRes.data.token, 'Customer login succeeded with valid JWT');

  // STEP 4: Forgot Password Flow
  console.log('\n[TEST 4] Testing Forgot Password Account Recovery (/api/auth/forgot-password)...');
  const forgotRes = await request('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({
      identifier: testPhone,
      newPassword: newPassword
    })
  });
  assert(forgotRes.status === 200 && forgotRes.data.success, 'Password successfully reset via forgot-password API');

  // Verify old password fails
  const oldLoginRes = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      identifier: testPhone,
      password: testPassword
    })
  });
  assert(oldLoginRes.status === 401, 'Login with old password correctly rejected');

  // Verify new password succeeds
  const newLoginRes = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      identifier: testPhone,
      password: newPassword
    })
  });
  assert(newLoginRes.status === 200 && newLoginRes.data.token, 'Login with new password succeeded');
  token = newLoginRes.data.token;

  // STEP 5: Place Order as Authenticated User with Color & Size Selection
  console.log('\n[TEST 5] Placing Authenticated Footwear Order with Color Swatch & UK Size...');
  const orderPayload = {
    customerName: `Tester ${randomDigits}`,
    phone: testPhone,
    address: 'Plot 42, Green Avenue, Sector 18',
    city: 'Gurugram',
    pincode: '122001',
    paymentMethod: 'COD',
    items: [
      {
        id: 'neeman-crv-002',
        name: "Neeman's Curve Knit Slip-Ons",
        price: 1699,
        size: 9,
        color: { name: 'Pure White', hex: '#ffffff' },
        quantity: 1,
        image: 'https://cdn.shopify.com/s/files/1/2428/5565/files/Curve_Knit_Slip_Ons_Men_Ivory-Brown_21.jpg?v=1789382174'
      }
    ],
    totalAmount: 1699
  };

  const orderRes = await request('/api/orders', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(orderPayload)
  });
  assert(orderRes.status === 201 && orderRes.data.orderId, `Order placed successfully! ID: ${orderRes.data?.orderId}`);
  const order = orderRes.data;

  // STEP 6: Verify Initial Courier State (NO DEMO BLUEDART, WAITING FOR PICKUP)
  console.log('\n[TEST 6] Verifying Initial Order Courier State...');
  assert(order.courierPartner === 'Waiting for Pickup Delivery Partner', `Courier partner is correctly: "${order.courierPartner}"`);
  assert(order.trackingNumber === 'Pending Dispatch', `Tracking number is correctly: "${order.trackingNumber}"`);
  assert(order.orderStatus === 'Pending', `Order status is correctly: "Pending"`);

  // STEP 7: Customer Public Order Tracking
  console.log('\n[TEST 7] Testing Public Order Tracking (/api/track-order)...');
  const trackRes = await request(`/api/track-order?orderId=${order.orderId}&phone=${testPhone}`);
  assert(trackRes.status === 200 && trackRes.data.orderId === order.orderId, 'Order found via public tracking endpoint');
  assert(trackRes.data.courierPartner === 'Waiting for Pickup Delivery Partner', 'Tracking reports Waiting for Pickup Delivery Partner');

  // STEP 8: Admin Authentication with PIN 2026
  console.log('\n[TEST 8] Testing Admin Login (PIN: 2026)...');
  const adminLoginRes = await request('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ pin: '2026' })
  });
  assert(adminLoginRes.status === 200 && adminLoginRes.data.token, 'Admin login succeeded with owner PIN 2026');
  const adminToken = adminLoginRes.data.token;

  // STEP 9: Admin Assigns Real Courier (e.g. Ekart Logistics) & AWB
  console.log('\n[TEST 9] Admin Dispatches Order via Real Transport (Ekart Logistics + AWB)...');
  const assignedCourier = 'Ekart Logistics';
  const assignedAwb = `EKART-${Math.floor(10000000 + Math.random() * 90000000)}`;
  const dispatchRes = await request(`/api/orders/${order.orderId}`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify({
      orderStatus: 'Shipped',
      courierPartner: assignedCourier,
      trackingNumber: assignedAwb,
      estimatedDeliveryDate: '2-3 Business Days'
    })
  });
  assert(dispatchRes.status === 200, 'Admin successfully updated order dispatch details');
  assert(dispatchRes.data.courierPartner === assignedCourier, `Courier updated to ${assignedCourier}`);
  assert(dispatchRes.data.trackingNumber === assignedAwb, `AWB updated to ${assignedAwb}`);
  assert(dispatchRes.data.orderStatus === 'Shipped', 'Order status updated to Shipped');

  // STEP 10: Customer Re-Tracking Verifies Real Courier & AWB
  console.log('\n[TEST 10] Customer Re-Tracks Order to Verify Live Courier & AWB...');
  const reTrackRes = await request(`/api/track-order?orderId=${order.orderId}&phone=${testPhone}`);
  assert(reTrackRes.status === 200, 'Customer re-track succeeded');
  assert(reTrackRes.data.courierPartner === assignedCourier, `Customer sees courier: ${assignedCourier}`);
  assert(reTrackRes.data.trackingNumber === assignedAwb, `Customer sees AWB: ${assignedAwb}`);
  assert(reTrackRes.data.orderStatus === 'Shipped', 'Customer sees live status: Shipped');

  console.log(`\n🎉 LOOP ITERATION #${iteration} COMPLETED 100% SUCCESSFULLY!`);
}

async function runAllLoops() {
  console.log('===============================================================');
  console.log('🔥 STARTING CONTINUOUS LOOP TESTING (3 CONSECUTIVE ITERATIONS)');
  console.log('===============================================================');

  for (let i = 1; i <= 3; i++) {
    await runSingleLoop(i);
  }

  // Verify Product Catalog and Highest Discount product
  console.log('\n===============================================================');
  console.log('👟 VERIFYING PRODUCT CATALOG & HIGHEST DISCOUNT LOGIC');
  console.log('===============================================================');
  const productsRes = await request('/api/products');
  assert(productsRes.status === 200 && Array.isArray(productsRes.data), 'Products catalog loaded');
  const products = productsRes.data;
  assert(products.length >= 8, `Store has ${products.length} footwear models`);

  // Verify every product has 3 colors
  products.forEach(p => {
    assert(p.colors && p.colors.length >= 3, `Shoe "${p.name}" has ${p.colors ? p.colors.length : 0} color swatches`);
  });

  // Calculate highest discount
  const sorted = [...products].sort((a, b) => {
    const discA = a.originalPrice && a.originalPrice > a.price ? ((a.originalPrice - a.price) / a.originalPrice) : 0;
    const discB = b.originalPrice && b.originalPrice > b.price ? ((b.originalPrice - b.price) / b.originalPrice) : 0;
    return discB - discA;
  });
  const highest = sorted[0];
  const highestDiscPct = Math.round(((highest.originalPrice - highest.price) / highest.originalPrice) * 100);
  console.log(`  ✓ Top Steal Deal: "${highest.name}" with ${highestDiscPct}% OFF (₹${highest.price} vs ₹${highest.originalPrice})`);
  assert(highestDiscPct >= 50, 'Highest discount shoe has 50%+ discount');

  console.log('\n===============================================================');
  console.log('🌟 ALL 10 TEST CRITERIA PASSED ACROSS ALL LOOPS WITHOUT ERROR!');
  console.log('===============================================================\n');
}

runAllLoops().catch(err => {
  console.error('Fatal Test Error:', err);
  process.exit(1);
});
