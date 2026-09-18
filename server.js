const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const SMS_LOGS_FILE = path.join(DATA_DIR, 'sms_logs.json');

// Security Secret Key
const SECRET_KEY = process.env.JWT_SECRET || 'rabbit_shoes_ultra_secure_emerald_2026_key';
const ADMIN_PIN = process.env.ADMIN_PIN || '2026';

// Ensure data directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Ensure JSON files exist
if (!fs.existsSync(PRODUCTS_FILE)) fs.writeFileSync(PRODUCTS_FILE, JSON.stringify([]));
if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, JSON.stringify([]));
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify([]));
if (!fs.existsSync(SETTINGS_FILE)) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify({
    storeName: 'Rabbit Shoes',
    upiId: 'rabbitshoes@okhdfcbank',
    upiMerchantName: 'Rabbit Shoes Official',
    storewideDiscount: 0,
    flashSaleActive: false,
    flashSaleBanner: '🔥 FLASH SALE: Flat 15% OFF on all sneakers!',
    coupons: [
      { code: 'RABBIT20', type: 'percent', value: 20, description: '20% Flat Discount' },
      { code: 'HOP500', type: 'fixed', value: 500, description: '₹500 Flat Savings' },
      { code: 'FREESHIP', type: 'shipping', value: 0, description: 'Free Express Shipping' }
    ]
  }, null, 2));
}

// Read and Write helpers
function readJSON(filePath, fallback = []) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return fallback;
  }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function getProducts() { return readJSON(PRODUCTS_FILE, []); }
function saveProducts(p) { writeJSON(PRODUCTS_FILE, p); }
function getOrders() { return readJSON(ORDERS_FILE, []); }
function saveOrders(o) { writeJSON(ORDERS_FILE, o); }
function getUsers() { return readJSON(USERS_FILE, []); }
function saveUsers(u) { writeJSON(USERS_FILE, u); }
function getSettings() {
  return readJSON(SETTINGS_FILE, {
    storeName: 'Rabbit Shoes',
    upiId: 'rabbitshoes@okhdfcbank',
    upiMerchantName: 'Rabbit Shoes Official',
    storewideDiscount: 0,
    flashSaleActive: false,
    flashSaleBanner: '',
    coupons: []
  });
}
function saveSettings(s) { writeJSON(SETTINGS_FILE, s); }
function getSMSLogs() { return readJSON(SMS_LOGS_FILE, []); }
function saveSMSLogs(logs) { writeJSON(SMS_LOGS_FILE, logs); }

// ================= SMS & TEXT MESSAGE NOTIFICATION ENGINE =================
async function sendSMSNotification(order, type, extraData = {}) {
  const phone = (order.phone || '').replace(/\D/g, '').slice(-10);
  if (!phone || phone.length !== 10) return { success: false, reason: 'Invalid phone' };

  const settings = getSettings();
  if (!extraData.manual) {
    if (type === 'ORDER_CONFIRMED' && settings.autoSmsOnOrder === false) return { skipped: true, reason: 'autoSmsOnOrder disabled' };
    if (type === 'ORDER_DISPATCHED' && settings.autoSmsOnDispatch === false) return { skipped: true, reason: 'autoSmsOnDispatch disabled' };
  }

  let messageText = '';
  const trackingUrl = `https://shoes.137.23.47.199.sslip.io/?track=${order.orderId}&phone=${phone}`;

  if (type === 'ORDER_CONFIRMED') {
    messageText = `[Rabbit Shoes] Namaste ${order.customerName || 'Customer'}! Your order #${order.orderId} (₹${order.totalAmount}) is confirmed. Track status: ${trackingUrl}`;
  } else if (type === 'ORDER_DISPATCHED' || type === 'INVOICE_BILL') {
    const courier = extraData.courierPartner || order.courierPartner || 'Delivery Partner';
    const awb = extraData.trackingNumber || order.trackingNumber || 'Assigned';
    messageText = `[Rabbit Shoes] Namaste ${order.customerName || 'Customer'}! Your order #${order.orderId} (₹${order.totalAmount}) is dispatched via ${courier} (AWB: ${awb}). Track live & view bill: ${trackingUrl}`;
  } else if (type === 'ORDER_CANCELLED') {
    messageText = `[Rabbit Shoes] Your order #${order.orderId} has been cancelled. If any payment was deducted, it will be refunded.`;
  }

  const fast2smsKey = (settings.smsApiKey && settings.smsApiKey !== 'FAST2SMS_TEST_API_KEY_2026') ? settings.smsApiKey : process.env.FAST2SMS_API_KEY;
  const gatewayLabel = fast2smsKey ? 'Fast2SMS Production API' : `${settings.smsGateway || 'Gateway'} Ready (Simulated/Live Engine)`;

  const logEntry = {
    id: 'sms_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
    orderId: order.orderId,
    phone: phone,
    type: type,
    message: messageText,
    timestamp: new Date().toISOString(),
    status: 'Sent',
    gateway: gatewayLabel
  };

  if (fast2smsKey) {
    try {
      await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          'authorization': fast2smsKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          route: 'q',
          message: messageText,
          numbers: phone
        })
      });
      logEntry.gateway = 'Fast2SMS Delivered';
    } catch (err) {
      logEntry.gatewayError = err.message;
    }
  }

  const logs = getSMSLogs();
  logs.unshift(logEntry);
  if (logs.length > 200) logs.pop();
  saveSMSLogs(logs);

  console.log(`📱 [SMS DISPATCH to +91-${phone}]: "${messageText}"`);
  return { 
    success: true, 
    log: logEntry, 
    messageText, 
    phone, 
    smsUri: `sms:+91${phone}?&body=${encodeURIComponent(messageText)}` 
  };
}

// ================= CRYPTOGRAPHIC SIGNATURE & TOKENS =================
function signToken(payload, expiresInMs = 7 * 24 * 60 * 60 * 1000) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Date.now() + expiresInMs;
  const fullPayload = { ...payload, exp };
  const body = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const signature = crypto.createHmac('sha256', SECRET_KEY).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', SECRET_KEY).update(`${header}.${body}`).digest('base64url');
  if (signature !== expectedSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return null; // Expired
    return payload;
  } catch (e) {
    return null;
  }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, originalHash] = stored.split(':');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === originalHash;
}

function getBearerToken(req) {
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    if (authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7).trim();
    }
    return authHeader.trim();
  }
  if (req.headers['x-admin-token']) {
    return req.headers['x-admin-token'].trim();
  }
  // Check cookie if provided
  if (req.headers['cookie']) {
    const match = req.headers['cookie'].match(/rabbit_token=([^;]+)/);
    if (match) return match[1];
  }
  return null;
}

function authenticateAdmin(req) {
  const token = getBearerToken(req);
  if (!token) return false;
  // Strict Cryptographic JWT Verification - No hardcoded string bypasses
  const payload = verifyToken(token);
  return !!(payload && payload.role === 'admin');
}

function authenticateUser(req) {
  const token = getBearerToken(req);
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload || !payload.userId) return null;
  const users = getUsers();
  return users.find(u => u.id === payload.userId) || null;
}

// ================= PASSWORD RESET SECURE OTP STORE =================
const passwordResetStore = new Map();
// Structure: cleanPhone -> { phone, userId, sessionId, otpHash, expiresAt, attempts, lastRequestedAt }

setInterval(() => {
  const now = Date.now();
  for (const [phone, record] of passwordResetStore.entries()) {
    if (now > record.expiresAt) passwordResetStore.delete(phone);
  }
}, 300000);

// ================= REAL-TIME SERVER-SENT EVENTS (SSE) =================
const sseClients = new Set();

function broadcastRealtime(eventType, payload) {
  const message = `event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(message);
    } catch (err) {
      sseClients.delete(client);
    }
  }
}

// ================= GRANULAR RATE LIMITING & SECURITY =================
const rateLimitMap = new Map();

function checkRateLimit(key, limit = 60, windowMs = 60000) {
  const now = Date.now();
  let record = rateLimitMap.get(key);
  if (!record || now > record.resetTime) {
    record = { count: 1, resetTime: now + windowMs };
    rateLimitMap.set(key, record);
    return { limited: false, remaining: limit - 1, retryAfter: 0 };
  }
  record.count++;
  if (record.count > limit) {
    const retryAfter = Math.max(1, Math.ceil((record.resetTime - now) / 1000));
    return { limited: true, remaining: 0, retryAfter };
  }
  return { limited: false, remaining: limit - record.count, retryAfter: 0 };
}

function isRateLimited(ip, limit = 120, windowMs = 60000) {
  return checkRateLimit(`ip_gen_${ip}`, limit, windowMs).limited;
}

// Clean old rate limits every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) rateLimitMap.delete(key);
  }
}, 300000);

// ================= REQUEST BODY & IMAGE PARSING =================
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 100 * 1024 * 1024) {
        reject(new Error('Payload Too Large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function saveBase64Image(dataUri) {
  if (!dataUri || typeof dataUri !== 'string' || !dataUri.startsWith('data:image/')) {
    return dataUri;
  }
  try {
    const matches = dataUri.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return dataUri;
    
    let ext = matches[1].replace('+xml', '');
    if (ext === 'jpeg') ext = 'jpg';
    const buffer = Buffer.from(matches[2], 'base64');
    const filename = `shoe-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
    const filePath = path.join(UPLOADS_DIR, filename);
    fs.writeFileSync(filePath, buffer);
    return `/uploads/${filename}`;
  } catch (e) {
    console.error('Failed to save base64 image:', e);
    return dataUri;
  }
}

function processImagesArray(imagesInput, fallbackImage) {
  let list = [];
  if (Array.isArray(imagesInput) && imagesInput.length > 0) {
    list = imagesInput;
  } else if (fallbackImage) {
    list = [fallbackImage];
  }
  const processedList = list.map(img => saveBase64Image(img)).filter(Boolean);
  return processedList.length > 0 ? processedList : ['/placeholder.png'];
}

// MIME Types
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Security Headers Helper
function setSecurityHeaders(res) {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  const cspPolicy = [
    "default-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://fonts.googleapis.com https://fonts.gstatic.com https://images.unsplash.com https://cdn.shopify.com https://checkout.razorpay.com https://api.razorpay.com https://cdn.razorpay.com",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://checkout.razorpay.com https://cdn.razorpay.com https://api.razorpay.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.tailwindcss.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https: wss:",
    "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com"
  ].join('; ');
  res.setHeader('Content-Security-Policy', cspPolicy);
  res.removeHeader('X-Powered-By');
}

// ================= HTTP SERVER =================
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();
  const clientIP = req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : (req.socket.remoteAddress || 'unknown');

  // Helper response functions
  const sendJSON = (statusCode, data, extraHeaders = {}) => {
    setSecurityHeaders(res);
    res.writeHead(statusCode, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      ...extraHeaders
    });
    res.end(JSON.stringify(data));
  };

  const sendFile = (filePath, contentType) => {
    fs.readFile(filePath, (err, data) => {
      setSecurityHeaders(res);
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
      } else {
        res.writeHead(200, {
          'Content-Type': contentType || 'application/octet-stream',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0'
        });
        res.end(data);
      }
    });
  };

  // Handle CORS Preflight
  if (method === 'OPTIONS') {
    setSecurityHeaders(res);
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  // Rate Limiting check on APIs (Admin authenticated requests and local loopback are exempted from coarse limiter)
  const isLocal = clientIP === '127.0.0.1' || clientIP === '::1' || clientIP === '::ffff:127.0.0.1' || clientIP === 'localhost';
  const isAdmin = authenticateAdmin(req);
  if (!isAdmin && !isLocal && pathname.startsWith('/api/') && isRateLimited(clientIP, 300, 60000)) {
    return sendJSON(429, { error: 'Too many requests. Please slow down.' });
  }

  // ================= REAL-TIME SSE STREAM =================
  if (pathname === '/api/realtime/stream') {
    setSecurityHeaders(res);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write(`data: ${JSON.stringify({ type: 'connected', time: new Date().toISOString() })}\n\n`);
    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
    return;
  }

  // ================= 1. AUTHENTICATION APIS =================

  // Customer Registration
  if (pathname === '/api/auth/register' && method === 'POST') {
    try {
      const rl = checkRateLimit(`reg_${clientIP}`, 10, 60000);
      if (rl.limited) {
        return sendJSON(429, { error: 'Too many registration requests. Please wait before retrying.' }, { 'Retry-After': rl.retryAfter.toString() });
      }

      const body = await parseBody(req);
      const { name, phone, email, password } = body;

      if (!name || !phone || !password) {
        return sendJSON(400, { error: 'Name, mobile phone number, and password are required.' });
      }

      const cleanPhone = phone.replace(/\D/g, '').slice(-10);
      if (cleanPhone.length !== 10) {
        return sendJSON(400, { error: 'Please provide a valid 10-digit mobile number.' });
      }

      const users = getUsers();
      const existing = users.find(u => u.phone === cleanPhone || (email && u.email && u.email.toLowerCase() === email.toLowerCase()));
      if (existing) {
        return sendJSON(409, { error: 'An account with this phone or email already exists. Please log in.' });
      }

      const newUser = {
        id: 'usr_' + crypto.randomBytes(6).toString('hex'),
        name: name.trim(),
        phone: cleanPhone,
        email: email ? email.trim().toLowerCase() : '',
        passwordHash: hashPassword(password),
        createdAt: new Date().toISOString()
      };

      users.push(newUser);
      saveUsers(users);

      const token = signToken({ userId: newUser.id, phone: newUser.phone, name: newUser.name, role: 'customer' });
      return sendJSON(201, {
        success: true,
        user: { id: newUser.id, name: newUser.name, phone: newUser.phone, email: newUser.email },
        token
      }, {
        'Set-Cookie': `rabbit_token=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`
      });
    } catch (err) {
      return sendJSON(500, { error: 'Registration failed.' });
    }
  }

  // Customer Login
  if (pathname === '/api/auth/login' && method === 'POST') {
    try {
      const rl = checkRateLimit(`login_${clientIP}`, 20, 60000);
      if (rl.limited) {
        return sendJSON(429, { error: 'Too many login attempts. Please wait 1 minute before retrying.' }, { 'Retry-After': rl.retryAfter.toString() });
      }

      const body = await parseBody(req);
      const { identifier, password } = body;

      if (!identifier || !password) {
        return sendJSON(400, { error: 'Phone/Email and password are required.' });
      }

      const users = getUsers();
      const cleanInput = identifier.replace(/\D/g, '').slice(-10);
      const user = users.find(u => u.phone === cleanInput || (u.email && u.email.toLowerCase() === identifier.toLowerCase()));

      if (!user || !verifyPassword(password, user.passwordHash)) {
        return sendJSON(401, { error: 'Invalid phone/email or password.' });
      }

      const token = signToken({ userId: user.id, phone: user.phone, name: user.name, role: 'customer' });
      return sendJSON(200, {
        success: true,
        user: { id: user.id, name: user.name, phone: user.phone, email: user.email },
        token
      }, {
        'Set-Cookie': `rabbit_token=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`
      });
    } catch (err) {
      return sendJSON(500, { error: 'Login failed.' });
    }
  }

  // Customer Logout
  if (pathname === '/api/auth/logout' && method === 'POST') {
    return sendJSON(200, { success: true, message: 'Logged out successfully.' }, {
      'Set-Cookie': 'rabbit_token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'
    });
  }

  // Customer Get Current Profile
  if (pathname === '/api/auth/me' && method === 'GET') {
    const user = authenticateUser(req);
    if (!user) {
      return sendJSON(401, { error: 'Unauthorized. Please login.' });
    }
    return sendJSON(200, {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email
    });
  }

  // ================= SECURE PASSWORD RESET (TWO-STAGE OTP) =================

  // 1. Customer Request Password Reset OTP
  if (pathname === '/api/auth/forgot-password/request-otp' && method === 'POST') {
    try {
      const rl = checkRateLimit(`otp_req_${clientIP}`, 5, 600000); // 5 requests per 10 mins
      if (rl.limited) {
        return sendJSON(429, { error: 'Too many OTP requests. Please wait 10 minutes before requesting again.' }, { 'Retry-After': rl.retryAfter.toString() });
      }

      const body = await parseBody(req);
      const { identifier } = body;
      if (!identifier) {
        return sendJSON(400, { error: 'Registered mobile phone number or email is required.' });
      }

      const cleanInput = identifier.replace(/\D/g, '').slice(-10);
      const users = getUsers();
      const user = users.find(u => u.phone === cleanInput || (u.email && u.email.toLowerCase() === identifier.toLowerCase()));

      if (!user) {
        return sendJSON(404, { error: 'No account registered with this mobile number or email.' });
      }

      const cleanPhone = user.phone;
      // Prevent rapid spamming (< 30 seconds between requests for same number)
      const existingSession = passwordResetStore.get(cleanPhone);
      if (existingSession && Date.now() - existingSession.lastRequestedAt < 30000) {
        const waitSec = Math.ceil((30000 - (Date.now() - existingSession.lastRequestedAt)) / 1000);
        return sendJSON(429, { error: `Please wait ${waitSec}s before requesting a new OTP.` });
      }

      // Generate cryptographically secure 6-digit OTP
      const otp = crypto.randomInt(100000, 1000000).toString();
      const sessionId = 'rst_' + crypto.randomBytes(16).toString('hex');
      const salt = crypto.randomBytes(8).toString('hex');
      const otpHash = `${salt}:${crypto.pbkdf2Sync(otp, salt, 500, 32, 'sha256').toString('hex')}`;

      passwordResetStore.set(cleanPhone, {
        phone: cleanPhone,
        userId: user.id,
        sessionId,
        otpHash,
        expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes expiry
        attempts: 0,
        lastRequestedAt: Date.now()
      });

      console.log(`🔐 [PASSWORD RESET OTP DISPATCH to +91-${cleanPhone}]: Code is ${otp} | Session: ${sessionId}`);

      // Record in SMS logs
      const logEntry = {
        id: 'otp_' + Date.now().toString(36),
        phone: cleanPhone,
        type: 'OTP_PASSWORD_RESET',
        message: `[Rabbit Shoes] Your password reset OTP is ${otp}. Valid for 10 minutes.`,
        timestamp: new Date().toISOString(),
        status: 'Sent',
        gateway: 'SMS Gateway Engine'
      };
      const smsLogs = getSMSLogs();
      smsLogs.unshift(logEntry);
      if (smsLogs.length > 200) smsLogs.pop();
      saveSMSLogs(smsLogs);

      // Dispatch SMS OTP via Fast2SMS if key available
      const settings = getSettings();
      const fast2smsKey = (settings.smsApiKey && settings.smsApiKey !== 'FAST2SMS_TEST_API_KEY_2026') ? settings.smsApiKey : process.env.FAST2SMS_API_KEY;
      if (fast2smsKey) {
        try {
          await fetch('https://www.fast2sms.com/dev/bulkV2', {
            method: 'POST',
            headers: { 'authorization': fast2smsKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              route: 'otp',
              variables_values: otp,
              numbers: cleanPhone
            })
          });
          logEntry.gateway = 'Fast2SMS Delivered';
          saveSMSLogs(smsLogs);
        } catch (e) {
          console.error('Fast2SMS OTP dispatch failed:', e.message);
        }
      }

      return sendJSON(200, {
        success: true,
        sessionId,
        message: `6-digit verification OTP dispatched to mobile ending in ${cleanPhone.slice(-4)}.`
      });
    } catch (err) {
      console.error('Error requesting OTP:', err);
      return sendJSON(500, { error: 'Failed to request OTP.' });
    }
  }

  // 2. Customer Verify OTP & Reset Password
  if (pathname === '/api/auth/forgot-password/verify-otp' && method === 'POST') {
    try {
      const rl = checkRateLimit(`otp_ver_${clientIP}`, 10, 600000);
      if (rl.limited) {
        return sendJSON(429, { error: 'Too many verification attempts. Please wait before retrying.' }, { 'Retry-After': rl.retryAfter.toString() });
      }

      const body = await parseBody(req);
      const { sessionId, otp, newPassword } = body;

      if (!sessionId || !otp || !newPassword) {
        return sendJSON(400, { error: 'Session ID, OTP code, and new password are required.' });
      }

      if (newPassword.length < 6) {
        return sendJSON(400, { error: 'New password must be at least 6 characters long.' });
      }

      let targetPhone = null;
      let targetSession = null;
      for (const [phone, sess] of passwordResetStore.entries()) {
        if (sess.sessionId === sessionId) {
          targetPhone = phone;
          targetSession = sess;
          break;
        }
      }

      if (!targetSession) {
        return sendJSON(400, { error: 'Invalid or expired password reset session. Please request a new OTP.' });
      }

      if (Date.now() > targetSession.expiresAt) {
        passwordResetStore.delete(targetPhone);
        return sendJSON(400, { error: 'Verification OTP has expired. Please request a new OTP.' });
      }

      targetSession.attempts++;
      if (targetSession.attempts > 3) {
        passwordResetStore.delete(targetPhone);
        return sendJSON(429, { error: 'Too many incorrect attempts. Reset session terminated for security. Please request a new OTP.' });
      }

      const [salt, expectedHash] = targetSession.otpHash.split(':');
      const candidateHash = crypto.pbkdf2Sync(otp.toString().trim(), salt, 500, 32, 'sha256').toString('hex');

      if (candidateHash !== expectedHash) {
        const remaining = 3 - targetSession.attempts;
        return sendJSON(400, { error: `Incorrect verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` });
      }

      // Password Reset Verified! Update user password
      const users = getUsers();
      const user = users.find(u => u.id === targetSession.userId || u.phone === targetPhone);
      if (!user) {
        passwordResetStore.delete(targetPhone);
        return sendJSON(404, { error: 'Account not found.' });
      }

      user.passwordHash = hashPassword(newPassword);
      saveUsers(users);
      passwordResetStore.delete(targetPhone);

      console.log(`✅ [SECURITY] Password reset verified & updated for account +91-${targetPhone}`);
      return sendJSON(200, {
        success: true,
        message: 'Password reset successful! You can now log in with your new password.'
      });
    } catch (err) {
      console.error('Error verifying OTP reset:', err);
      return sendJSON(500, { error: 'Failed to reset password.' });
    }
  }

  // 3. Legacy Unverified Forgot-Password Endpoint (Strictly Disabled)
  if (pathname === '/api/auth/forgot-password' && method === 'POST') {
    return sendJSON(403, { 
      error: 'Direct unverified password reset is permanently blocked for security. Please use the OTP verification flow (/api/auth/forgot-password/request-otp).' 
    });
  }

  // Admin PIN Login (Issues authentic signed JWT)
  if (pathname === '/api/admin/login' && method === 'POST') {
    try {
      const rl = checkRateLimit(`admin_login_${clientIP}`, 6, 300000); // 6 attempts per 5 minutes
      if (rl.limited) {
        return sendJSON(429, { error: 'Too many admin login attempts. Account temporarily locked for 5 minutes.' }, { 'Retry-After': rl.retryAfter.toString() });
      }

      const body = await parseBody(req);
      if (body.pin === ADMIN_PIN) {
        const token = signToken({ role: 'admin', authAt: Date.now() }, 24 * 60 * 60 * 1000);
        return sendJSON(200, { success: true, token }, {
          'Set-Cookie': `rabbit_token=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`
        });
      }
      return sendJSON(401, { error: 'Incorrect Security PIN. Access denied.' });
    } catch (err) {
      return sendJSON(500, { error: 'Admin authentication failed.' });
    }
  }

  // Admin Logout
  if (pathname === '/api/admin/logout' && method === 'POST') {
    return sendJSON(200, { success: true, message: 'Admin logged out successfully.' }, {
      'Set-Cookie': 'rabbit_token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'
    });
  }

  // ================= 2. STORE SETTINGS & DISCOUNTS =================

  // Public Settings (Exposes ONLY safe storefront properties, ZERO secrets)
  if (pathname === '/api/settings' && method === 'GET') {
    const settings = getSettings();
    return sendJSON(200, {
      storeName: settings.storeName || 'Rabbit Activewear & Footwear',
      supportPhone: settings.supportPhone || '9828682274',
      supportWhatsApp: settings.supportWhatsApp || '9828682274',
      supportEmail: settings.supportEmail || 'support@rabbitshoes.in',
      warehouseAddress: settings.warehouseAddress || 'Plot 42, Rabbit Fulfillment Park, Industrial Area, Jaipur, Rajasthan - 302013',
      gstin: settings.gstin || '08KMFPS6415G1ZM',
      instagram: settings.instagram || 'rabbitshoes_06',
      instagramUrl: settings.instagramUrl || 'https://instagram.com/rabbitshoes_06',
      logo: settings.logo || '/images/rabbit-logo.png',
      upiId: settings.upiId || 'rabbitshoes.official@okaxis',
      upiMerchantName: settings.upiMerchantName || 'Rabbit Shoes Flagship Store',
      razorpayEnabled: settings.razorpayEnabled !== false,
      razorpayKeyId: settings.razorpayKeyId || 'rzp_test_RABBIT_SHOES_OFFICIAL',
      storewideDiscount: settings.storewideDiscount || 0,
      flashSaleActive: !!settings.flashSaleActive,
      flashSaleBanner: settings.flashSaleBanner || '',
      coupons: settings.coupons || []
    });
  }

  // Admin Get Complete Settings (Protected - Masks Sensitive Secrets)
  if (pathname === '/api/admin/settings' && method === 'GET') {
    if (!authenticateAdmin(req)) {
      return sendJSON(403, { error: 'Forbidden: Admin authorization required.' });
    }
    const settings = getSettings();
    const safeSettings = { ...settings };

    // Mask sensitive gateway secrets
    if (safeSettings.razorpayKeySecret) {
      const s = safeSettings.razorpayKeySecret;
      safeSettings.razorpayKeySecret = s.length > 8 ? `${s.slice(0, 4)}****${s.slice(-4)}` : '********';
      safeSettings.isRazorpaySecretConfigured = true;
    } else {
      safeSettings.isRazorpaySecretConfigured = false;
    }

    if (safeSettings.smsApiKey) {
      const s = safeSettings.smsApiKey;
      safeSettings.smsApiKey = s.length > 8 ? `${s.slice(0, 4)}****${s.slice(-4)}` : '********';
      safeSettings.isSmsApiKeyConfigured = true;
    } else {
      safeSettings.isSmsApiKeyConfigured = false;
    }

    return sendJSON(200, safeSettings);
  }

  // Admin Update Settings & Gateways (Protected)
  if (pathname === '/api/admin/settings' && method === 'POST') {
    if (!authenticateAdmin(req)) {
      return sendJSON(403, { error: 'Forbidden: Admin authorization required.' });
    }
    const body = await parseBody(req);
    const settings = getSettings();
    
    if (body.storeName) settings.storeName = body.storeName.trim();
    if (body.supportPhone) settings.supportPhone = body.supportPhone.trim();
    if (body.supportWhatsApp) settings.supportWhatsApp = body.supportWhatsApp.trim();
    if (body.supportEmail) settings.supportEmail = body.supportEmail.trim();
    if (body.warehouseAddress) settings.warehouseAddress = body.warehouseAddress.trim();
    if (body.gstin) settings.gstin = body.gstin.trim();
    if (body.instagram) settings.instagram = body.instagram.trim();
    if (body.instagramUrl) settings.instagramUrl = body.instagramUrl.trim();
    if (body.logo) settings.logo = body.logo.trim();
    if (body.upiId) settings.upiId = body.upiId.trim();
    if (body.upiMerchantName) settings.upiMerchantName = body.upiMerchantName.trim();
    if (typeof body.razorpayEnabled === 'boolean') settings.razorpayEnabled = body.razorpayEnabled;
    if (body.razorpayKeyId) settings.razorpayKeyId = body.razorpayKeyId.trim();

    // Preserve secret if masked value or empty is sent
    if (body.razorpayKeySecret !== undefined && !body.razorpayKeySecret.includes('****') && body.razorpayKeySecret.trim() !== '') {
      settings.razorpayKeySecret = body.razorpayKeySecret.trim();
    }
    if (body.smsGateway) settings.smsGateway = body.smsGateway.trim();
    if (body.smsApiKey !== undefined && !body.smsApiKey.includes('****') && body.smsApiKey.trim() !== '') {
      settings.smsApiKey = body.smsApiKey.trim();
    }
    if (body.smsSenderId) settings.smsSenderId = body.smsSenderId.trim();
    if (typeof body.autoSmsOnOrder === 'boolean') settings.autoSmsOnOrder = body.autoSmsOnOrder;
    if (typeof body.autoSmsOnDispatch === 'boolean') settings.autoSmsOnDispatch = body.autoSmsOnDispatch;
    if (typeof body.storewideDiscount === 'number') settings.storewideDiscount = Math.max(0, Math.min(90, body.storewideDiscount));
    if (typeof body.flashSaleActive === 'boolean') settings.flashSaleActive = body.flashSaleActive;
    if (body.flashSaleBanner !== undefined) settings.flashSaleBanner = body.flashSaleBanner;
    if (Array.isArray(body.coupons)) settings.coupons = body.coupons;

    saveSettings(settings);
    broadcastRealtime('settings_updated', settings);
    return sendJSON(200, { success: true, settings });
  }

  // Admin Send Test SMS (Protected)
  if (pathname === '/api/admin/test-sms' && method === 'POST') {
    if (!authenticateAdmin(req)) {
      return sendJSON(403, { error: 'Forbidden: Admin authorization required.' });
    }
    const body = await parseBody(req);
    const phone = (body.phone || '').replace(/\D/g, '').slice(-10);
    if (!phone || phone.length !== 10) {
      return sendJSON(400, { error: 'Valid 10-digit mobile number required' });
    }
    const testOrder = {
      orderId: 'TEST_' + Math.floor(1000 + Math.random() * 9000),
      phone: phone,
      customerName: body.customerName || 'Test Customer',
      totalAmount: 2499,
      courierPartner: 'Ekart Logistics',
      trackingNumber: 'TEST_AWB_' + Date.now().toString().slice(-6)
    };
    const resSMS = await sendSMSNotification(testOrder, 'ORDER_CONFIRMED');
    return sendJSON(200, { success: true, message: `Test alert generated for +91 ${phone}`, result: resSMS });
  }

  // ================= 3. PRODUCT CATALOG APIS =================

  // Get Products (Public)
  if (pathname === '/api/products' && method === 'GET') {
    const products = getProducts();
    const settings = getSettings();
    
    // If a storewide flash sale is active, compute live discounted price
    if (settings.flashSaleActive && settings.storewideDiscount > 0) {
      const discountRatio = (100 - settings.storewideDiscount) / 100;
      const discountedProducts = products.map(p => ({
        ...p,
        flashSaleApplied: true,
        flashSalePercent: settings.storewideDiscount,
        originalPrice: p.originalPrice || Math.round(p.price * 1.3),
        price: Math.round(p.price * discountRatio),
        discount: `${Math.round((( (p.originalPrice || p.price * 1.3) - (p.price * discountRatio) ) / (p.originalPrice || p.price * 1.3)) * 100)}% OFF`
      }));
      return sendJSON(200, discountedProducts);
    }
    return sendJSON(200, products);
  }

  // Create Product (Admin Only)
  if (pathname === '/api/products' && method === 'POST') {
    if (!authenticateAdmin(req)) {
      return sendJSON(403, { error: 'Forbidden: Admin privileges required to upload shoes.' });
    }

    try {
      const body = await parseBody(req);
      if (!body.name || !body.price) {
        return sendJSON(400, { error: 'Shoe Model Name and Price are mandatory' });
      }

      const products = getProducts();
      const processedImages = processImagesArray(body.images, body.image);
      const primaryImage = processedImages[0];

      const newProduct = {
        id: 'rabbit-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
        name: body.name,
        tagline: body.tagline || '',
        category: body.category || 'running',
        gender: body.gender || 'unisex',
        price: Number(body.price),
        originalPrice: body.originalPrice ? Number(body.originalPrice) : Math.round(Number(body.price) * 1.3),
        discount: body.originalPrice && body.originalPrice > body.price 
          ? `${Math.round(((body.originalPrice - body.price) / body.originalPrice) * 100)}% OFF` 
          : '',
        image: primaryImage,
        gallery: processedImages,
        colors: (body.colors && Array.isArray(body.colors) && body.colors.length > 0)
          ? body.colors
          : [{ name: 'Standard Edition', hex: '#111827', image: primaryImage }],
        sizes: body.sizes && body.sizes.length > 0 ? body.sizes.map(Number) : [6, 7, 8, 9, 10, 11],
        description: body.description || 'Authentic Rabbit Shoes footwear.',
        specs: {
          "Sole": "High-Traction Grip Rubber",
          "Cushion": "Ultralight Responsive Foam",
          "Fit": "True to standard international sizing"
        },
        inStock: body.inStock !== false,
        createdAt: new Date().toISOString()
      };

      products.unshift(newProduct);
      saveProducts(products);
      broadcastRealtime('inventory_updated', { action: 'create', product: newProduct });
      return sendJSON(201, newProduct);
    } catch (err) {
      console.error('Error creating product:', err);
      return sendJSON(500, { error: err.message || 'Failed to save product' });
    }
  }

  // Update Product (Admin Only)
  if (pathname.startsWith('/api/products/') && method === 'PUT') {
    if (!authenticateAdmin(req)) {
      return sendJSON(403, { error: 'Forbidden: Admin privileges required.' });
    }

    const id = pathname.replace('/api/products/', '');
    const products = getProducts();
    const index = products.findIndex(p => p.id === id);

    if (index === -1) {
      return sendJSON(404, { error: 'Product not found' });
    }

    try {
      const body = await parseBody(req);
      if (body.images && Array.isArray(body.images)) {
        body.gallery = processImagesArray(body.images, body.image);
        body.image = body.gallery[0];
        if (!body.colors) {
          body.colors = products[index].colors || [{ name: 'Standard Edition', hex: '#111827', image: body.image }];
        }
      } else if (body.image && body.image.startsWith('data:image/')) {
        body.image = saveBase64Image(body.image);
        body.gallery = [body.image];
        if (!body.colors) {
          body.colors = products[index].colors || [{ name: 'Standard Edition', hex: '#111827', image: body.image }];
        }
      }

      products[index] = { ...products[index], ...body };
      saveProducts(products);
      broadcastRealtime('inventory_updated', { action: 'update', product: products[index] });
      return sendJSON(200, products[index]);
    } catch (err) {
      return sendJSON(500, { error: err.message || 'Failed to update product' });
    }
  }

  // Delete Product (Admin Only)
  if (pathname.startsWith('/api/products/') && method === 'DELETE') {
    if (!authenticateAdmin(req)) {
      return sendJSON(403, { error: 'Forbidden: Admin privileges required.' });
    }

    const rawId = pathname.replace('/api/products/', '').replace(/\/$/, '').trim();
    const id = decodeURIComponent(rawId);
    const products = getProducts();
    const index = products.findIndex(p => p.id === id || p.id.toLowerCase() === id.toLowerCase());

    if (index === -1) {
      return sendJSON(404, { error: 'Product not found' });
    }

    const removed = products.splice(index, 1)[0];
    saveProducts(products);
    broadcastRealtime('inventory_updated', { action: 'delete', id });
    return sendJSON(200, { success: true, removed });
  }

  // ================= 4. ORDERS & REAL-TIME TRACKING =================

  // Place New Order (Public / Customer - Strictly Recomputes Pricing & Verifies Payments Server-Side)
  if (pathname === '/api/orders' && method === 'POST') {
    try {
      const body = await parseBody(req);
      if (!body.customerName || !body.phone || !body.items || !Array.isArray(body.items) || body.items.length === 0) {
        return sendJSON(400, { error: 'Customer name, phone number, and at least one item are required.' });
      }

      const cleanPhone = (body.phone || '').replace(/\D/g, '').slice(-10);
      if (cleanPhone.length !== 10) {
        return sendJSON(400, { error: 'Valid 10-digit mobile number is required.' });
      }

      // Catalog Product Verification & Server-Side Price Calculation
      const catalogProducts = getProducts();
      const settings = getSettings();
      const validatedItems = [];
      let calculatedSubtotal = 0;

      for (const item of body.items) {
        if (!item || !item.id) {
          return sendJSON(400, { error: 'Invalid order item.' });
        }
        const dbProd = catalogProducts.find(p => p.id === item.id);
        if (!dbProd) {
          return sendJSON(400, { error: `Product '${item.name || item.id}' is not in the active catalog.` });
        }

        const qty = Math.max(1, Math.min(20, Math.floor(Number(item.quantity || 1))));
        const canonicalPrice = Number(dbProd.price);
        calculatedSubtotal += (canonicalPrice * qty);

        validatedItems.push({
          id: dbProd.id,
          name: dbProd.name,
          price: canonicalPrice,
          originalPrice: dbProd.originalPrice || Math.round(canonicalPrice * 1.3),
          size: item.size ? Number(item.size) : 8,
          color: item.color || (dbProd.colors && dbProd.colors[0]) || { name: 'Standard', hex: '#111827' },
          image: dbProd.image || item.image,
          quantity: qty
        });
      }

      // Compute discounts server-side
      let calculatedDiscount = 0;

      // Check Storewide discount if active
      if (settings.flashSaleActive && settings.storewideDiscount > 0) {
        calculatedDiscount += Math.round(calculatedSubtotal * (settings.storewideDiscount / 100));
      }

      // Check Coupon discount if provided
      let validatedCoupon = null;
      let isFreeShippingCoupon = false;
      if (body.couponCode) {
        const codeClean = String(body.couponCode).trim().toUpperCase();
        const defaultCoupons = [
          { code: 'RABBIT15', type: 'percent', value: 15 },
          { code: 'RABBIT20', type: 'percent', value: 20 },
          { code: 'HOP500', type: 'fixed', value: 500 },
          { code: 'FREESHIP', type: 'shipping', value: 0, freeShipping: true }
        ];
        const allCoupons = [...(settings.coupons || []), ...defaultCoupons];
        const foundCoupon = allCoupons.find(c => c && c.code && c.code.toUpperCase() === codeClean);
        if (foundCoupon) {
          validatedCoupon = foundCoupon.code;
          if (foundCoupon.type === 'percent') {
            calculatedDiscount += Math.round(calculatedSubtotal * (Number(foundCoupon.value) / 100));
          } else if (foundCoupon.type === 'fixed') {
            calculatedDiscount += Math.min(calculatedSubtotal, Number(foundCoupon.value));
          }
          if (foundCoupon.type === 'shipping' || foundCoupon.freeShipping) {
            isFreeShippingCoupon = true;
          }
        }
      }

      // Shipping calculation server-side matching frontend cart rules
      let calculatedShipping = 0;
      const freeShippingThreshold = Number(settings.freeShippingThreshold) || 1999;
      const standardShippingFee = Number(settings.standardShippingFee) || 149;
      const isFreeShipping = isFreeShippingCoupon || (calculatedSubtotal >= freeShippingThreshold);
      if (calculatedSubtotal > 0 && !isFreeShipping) {
        calculatedShipping = standardShippingFee;
      }

      const calculatedTotalWithShipping = Math.max(0, calculatedSubtotal - calculatedDiscount + calculatedShipping);
      const calculatedTotalWithoutShipping = Math.max(0, calculatedSubtotal - calculatedDiscount);

      // Price manipulation prevention check: compare client-sent total with server-calculated total
      let finalOrderTotal = calculatedTotalWithShipping;
      if (body.totalAmount !== undefined && body.totalAmount !== null) {
        const clientTotal = Number(body.totalAmount);
        const matchWithShipping = Math.abs(clientTotal - calculatedTotalWithShipping) <= 2;
        const matchWithoutShipping = Math.abs(clientTotal - calculatedTotalWithoutShipping) <= 2;

        if (!matchWithShipping && !matchWithoutShipping) {
          return sendJSON(400, {
            error: `Price manipulation detected: Calculated total is ₹${calculatedTotalWithShipping} (or ₹${calculatedTotalWithoutShipping}), received ₹${clientTotal}. Order rejected.`,
            calculatedTotal: calculatedTotalWithShipping
          });
        }
        finalOrderTotal = clientTotal;
      }

      // Resolve Customer Account / Guest Account
      let user = authenticateUser(req);
      if (!user) {
        const users = getUsers();
        let existingUser = users.find(u => u.phone === cleanPhone);
        if (!existingUser) {
          existingUser = {
            id: 'usr-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
            name: body.customerName.trim(),
            phone: cleanPhone,
            isGuest: true,
            createdAt: new Date().toISOString()
          };
          users.push(existingUser);
          saveUsers(users);
        }
        user = existingUser;
      }

      const orders = getOrders();
      const orderId = 'RBT-' + Math.floor(100000 + Math.random() * 900000);
      const rawMethod = (body.paymentMethod || 'UPI').toUpperCase();
      const isUpi = rawMethod.includes('UPI');
      const isOnline = rawMethod.includes('ONLINE') || rawMethod.includes('RAZORPAY') || rawMethod.includes('CARD');

      let initialPaymentStatus = 'COD Pending';
      let paymentVerificationCompleted = false;
      let paymentDetails = 'Cash on Delivery selected - pay at doorstep';
      let verificationTimestamp = null;

      // Cryptographic Payment Verification
      if (isOnline) {
        const razorpayPaymentId = body.razorpay_payment_id || body.paymentId;
        const razorpayOrderId = body.razorpay_order_id;
        const razorpaySignature = body.razorpay_signature;
        const razorpaySecret = settings.razorpayKeySecret || process.env.RAZORPAY_KEY_SECRET;

        if (razorpayPaymentId && razorpayOrderId && razorpaySignature && razorpaySecret) {
          const generatedSig = crypto
            .createHmac('sha256', razorpaySecret)
            .update(`${razorpayOrderId}|${razorpayPaymentId}`)
            .digest('hex');

          if (generatedSig === razorpaySignature) {
            initialPaymentStatus = 'Paid';
            paymentVerificationCompleted = true;
            verificationTimestamp = new Date().toISOString();
            paymentDetails = `Online Payment Verified via Razorpay HMAC (Payment ID: ${razorpayPaymentId})`;
          } else {
            initialPaymentStatus = 'Payment Verification Failed';
            paymentVerificationCompleted = false;
            paymentDetails = `Fraud Alert: Razorpay signature mismatch for payment ID ${razorpayPaymentId}.`;
          }
        } else if (razorpayPaymentId) {
          // Payment ID submitted without HMAC signature
          initialPaymentStatus = 'Verification Pending';
          paymentVerificationCompleted = false;
          paymentDetails = `Payment submitted (${razorpayPaymentId}) - awaiting gateway webhook confirmation.`;
        } else {
          initialPaymentStatus = 'Awaiting Payment';
          paymentVerificationCompleted = false;
          paymentDetails = 'Online payment initiated; transaction confirmation pending.';
        }
      } else if (isUpi) {
        initialPaymentStatus = body.utrNumber ? 'Verification Pending' : 'Awaiting Payment';
        paymentVerificationCompleted = false;
        verificationTimestamp = body.utrNumber ? new Date().toISOString() : null;
        paymentDetails = body.utrNumber ? `UPI UTR submitted: ${body.utrNumber} (Pending Bank Verification)` : 'Awaiting customer payment confirmation';
      } else {
        initialPaymentStatus = 'COD Pending';
        paymentVerificationCompleted = true;
        paymentDetails = 'Cash on Delivery verified by customer';
      }

      const initialTimeline = [
        { stage: 'Order Placed', timestamp: new Date().toISOString(), completed: true, details: 'Order successfully logged in system' },
        { stage: 'Payment Verification', timestamp: verificationTimestamp, completed: paymentVerificationCompleted, details: paymentDetails },
        { stage: 'Processing & Quality Check', timestamp: null, completed: false, details: 'Footwear inspection and premium packaging' },
        { stage: 'Dispatched / In Transit', timestamp: null, completed: false, details: 'Waiting for pickup delivery partner to collect shipment' },
        { stage: 'Delivered', timestamp: null, completed: false, details: 'Out for delivery to customer address' }
      ];

      const newOrder = {
        orderId,
        userId: user.id,
        customerName: (body.customerName || user.name).trim(),
        phone: cleanPhone,
        email: body.email ? body.email.trim() : (user.email || ''),
        address: body.address ? body.address.trim() : '',
        city: body.city ? body.city.trim() : '',
        pincode: body.pincode ? body.pincode.trim() : '',
        items: validatedItems,
        totalAmount: finalOrderTotal,
        discountAmount: calculatedDiscount,
        couponApplied: validatedCoupon,
        paymentMethod: isOnline ? 'Online (Razorpay)' : (isUpi ? 'UPI' : 'COD'),
        paymentId: body.paymentId || body.razorpay_payment_id || null,
        utrNumber: body.utrNumber ? body.utrNumber.trim() : null,
        paymentStatus: initialPaymentStatus,
        orderStatus: 'Pending',
        trackingNumber: 'Pending Dispatch',
        courierPartner: 'Waiting for Pickup Delivery Partner',
        estimatedDeliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
        timeline: initialTimeline,
        createdAt: new Date().toISOString()
      };

      orders.unshift(newOrder);
      saveOrders(orders);
      broadcastRealtime('order_created', { orderId: newOrder.orderId, total: newOrder.totalAmount });
      
      try {
        await sendSMSNotification(newOrder, 'ORDER_CONFIRMED');
      } catch (e) {
        console.error('SMS notification error:', e);
      }
      
      return sendJSON(201, newOrder);
    } catch (err) {
      console.error('Error placing order:', err);
      return sendJSON(500, { error: 'Failed to place order.' });
    }
  }

  // Get Authenticated Customer's Personal Orders ONLY (Security Partitioned)
  if (pathname === '/api/my-orders' && method === 'GET') {
    const user = authenticateUser(req);
    if (!user) {
      return sendJSON(401, { error: 'Please login to view your orders.' });
    }

    const orders = getOrders();
    const userOrders = orders.filter(o => o.userId === user.id || o.phone === user.phone);
    return sendJSON(200, userOrders);
  }

  // Track Order Public Endpoint (Secure: requires BOTH Order ID + Registered Phone)
  if (pathname === '/api/track-order' && method === 'GET') {
    const { orderId, phone } = parsedUrl.query;
    if (!orderId || !phone) {
      return sendJSON(400, { error: 'Both Order ID and 10-digit Phone Number are required.' });
    }

    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    const orders = getOrders();
    const order = orders.find(o => o.orderId.toUpperCase() === orderId.trim().toUpperCase() && o.phone === cleanPhone);

    if (!order) {
      return sendJSON(404, { error: 'No matching order found for this Order ID and Phone Number.' });
    }

    return sendJSON(200, {
      orderId: order.orderId,
      customerName: order.customerName,
      phone: order.phone,
      address: order.address,
      city: order.city,
      pincode: order.pincode,
      items: order.items,
      totalAmount: order.totalAmount,
      discountAmount: order.discountAmount || 0,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      utrNumber: order.utrNumber,
      trackingNumber: order.trackingNumber,
      courierPartner: order.courierPartner,
      estimatedDeliveryDate: order.estimatedDeliveryDate,
      timeline: order.timeline,
      createdAt: order.createdAt
    });
  }

  // Get All Store Orders (ADMIN ONLY - Strictly Cryptographically Protected)
  if (pathname === '/api/orders' && method === 'GET') {
    if (!authenticateAdmin(req)) {
      return sendJSON(403, { error: 'Forbidden: Valid Admin JWT authorization required.' });
    }
    return sendJSON(200, getOrders());
  }

  // Update Order Status & Live Tracking Timeline (ADMIN ONLY)
  if (pathname.startsWith('/api/orders/') && method === 'PUT') {
    if (!authenticateAdmin(req)) {
      return sendJSON(403, { error: 'Forbidden: Valid Admin JWT authorization required.' });
    }

    const orderId = pathname.replace('/api/orders/', '');
    const body = await parseBody(req);
    const orders = getOrders();
    const order = orders.find(o => o.orderId === orderId);

    if (!order) {
      return sendJSON(404, { error: 'Order not found' });
    }

    if (body.courierPartner) order.courierPartner = body.courierPartner;
    if (body.trackingNumber) order.trackingNumber = body.trackingNumber;
    if (body.estimatedDeliveryDate) order.estimatedDeliveryDate = body.estimatedDeliveryDate;

    if (body.orderStatus) {
      order.orderStatus = body.orderStatus;

      if (!order.timeline || !Array.isArray(order.timeline)) {
        order.timeline = [
          { stage: 'Order Placed', timestamp: order.createdAt, completed: true },
          { stage: 'Payment Verification', timestamp: null, completed: false },
          { stage: 'Processing & Quality Check', timestamp: null, completed: false },
          { stage: 'Dispatched / In Transit', timestamp: null, completed: false },
          { stage: 'Delivered', timestamp: null, completed: false }
        ];
      }

      const now = new Date().toISOString();
      if (body.orderStatus === 'Processing') {
        order.timeline[1].completed = true;
        order.timeline[1].timestamp = order.timeline[1].timestamp || now;
        order.timeline[2].completed = true;
        order.timeline[2].timestamp = now;
      } else if (body.orderStatus === 'Shipped') {
        order.timeline[1].completed = true;
        order.timeline[2].completed = true;
        order.timeline[3].completed = true;
        order.timeline[3].timestamp = now;
        const cp = order.courierPartner || 'Assigned Courier';
        const trk = order.trackingNumber && order.trackingNumber !== 'Pending Dispatch' ? ` (AWB: ${order.trackingNumber})` : '';
        order.timeline[3].details = `Package handed over to ${cp}${trk}`;
      } else if (body.orderStatus === 'Delivered') {
        order.timeline.forEach(t => {
          t.completed = true;
          if (!t.timestamp) t.timestamp = now;
        });
        order.timeline[4].details = 'Package successfully delivered to customer address';
      } else if (body.orderStatus === 'Cancelled') {
        order.timeline.forEach((t, idx) => {
          if (idx > 0) t.completed = false;
        });
        if (!order.timeline.find(t => t.stage === 'Cancelled')) {
          order.timeline.push({
            stage: 'Cancelled',
            timestamp: now,
            completed: true,
            details: body.cancelReason || 'Order was cancelled by owner or customer request'
          });
        }
      }
    }

    if (body.paymentStatus) {
      order.paymentStatus = body.paymentStatus;
      if (body.paymentStatus === 'Paid' && order.timeline && order.timeline[1]) {
        order.timeline[1].completed = true;
        order.timeline[1].timestamp = new Date().toISOString();
      }
    }

    saveOrders(orders);
    broadcastRealtime('order_updated', { orderId: order.orderId, status: order.orderStatus, payment: order.paymentStatus });

    // Trigger Automated SMS alert on status change
    try {
      if (order.orderStatus === 'Shipped' || body.courierPartner) {
        await sendSMSNotification(order, 'ORDER_DISPATCHED', body);
      } else if (order.orderStatus === 'Cancelled') {
        await sendSMSNotification(order, 'ORDER_CANCELLED');
      }
    } catch (e) {
      console.error('SMS dispatch error:', e);
    }

    return sendJSON(200, order);
  }

  // Get Sent SMS Logs (Admin Only)
  if (pathname === '/api/admin/sms-logs' && method === 'GET') {
    if (!authenticateAdmin(req)) {
      return sendJSON(403, { error: 'Forbidden: Admin privileges required.' });
    }
    return sendJSON(200, getSMSLogs());
  }

  // Manually Trigger SMS (Admin Only)
  if (pathname === '/api/admin/send-sms' && method === 'POST') {
    if (!authenticateAdmin(req)) {
      return sendJSON(403, { error: 'Forbidden: Admin privileges required.' });
    }
    try {
      const body = await parseBody(req);
      const orders = getOrders();
      const order = orders.find(o => o.orderId === body.orderId);
      if (!order) return sendJSON(404, { error: 'Order not found' });
      const result = await sendSMSNotification(order, body.type || 'ORDER_DISPATCHED', body);
      return sendJSON(200, result);
    } catch(err) {
      return sendJSON(500, { error: err.message || 'SMS send failed' });
    }
  }

  // Online Payment Order Creation (Razorpay / Digital Gateway)
  if (pathname === '/api/payment/razorpay-order' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const settings = getSettings();
      const amountPaise = Math.round(Number(body.amount || 0) * 100);
      const receipt = 'rcpt_' + Date.now().toString(36);
      const razorpayOrderId = 'order_' + crypto.randomBytes(8).toString('hex');
      return sendJSON(200, {
        success: true,
        key: settings.razorpayKeyId || process.env.RAZORPAY_KEY_ID || 'rzp_test_RABBIT_SHOES_OFFICIAL',
        amount: amountPaise,
        currency: 'INR',
        orderId: razorpayOrderId,
        receipt: receipt
      });
    } catch (err) {
      return sendJSON(500, { error: 'Payment initialization failed' });
    }
  }

  // ================= 5. ADMIN ANALYTICS STATS (ADMIN ONLY) =================
  if (pathname === '/api/stats' && method === 'GET') {
    if (!authenticateAdmin(req)) {
      return sendJSON(403, { error: 'Forbidden: Admin privileges required.' });
    }

    const products = getProducts();
    const orders = getOrders();
    const users = getUsers();

    const totalRevenue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const pendingOrders = orders.filter(o => o.orderStatus === 'Pending' || o.orderStatus === 'Processing').length;
    const deliveredOrders = orders.filter(o => o.orderStatus === 'Delivered').length;

    return sendJSON(200, {
      totalRevenue,
      totalOrders: orders.length,
      pendingOrders,
      deliveredOrders,
      totalProducts: products.length,
      inStockProducts: products.filter(p => p.inStock).length,
      totalRegisteredUsers: users.length
    });
  }

  // ================= STATIC FILES & ROUTE PROTECTION =================

  // Security Filter 1: Block hidden files and directory traversal (.git, .env, etc.)
  if (pathname.includes('/.') || pathname.startsWith('/.')) {
    setSecurityHeaders(res);
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Access Denied: Protected System Resource');
  }

  // Security Filter 2: Block internal configuration, code, and log files
  const lowerPath = pathname.toLowerCase();
  const sensitiveFiles = [
    '/server.js',
    '/package.json',
    '/package-lock.json',
    '/dockerfile',
    '/docker-compose.yml',
    '/nginx.conf',
    '/tunnel.log',
    '/readme.md'
  ];
  if (sensitiveFiles.includes(lowerPath) || lowerPath.endsWith('.log') || lowerPath.endsWith('.bak')) {
    setSecurityHeaders(res);
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Access Denied: Protected File');
  }

  // Handle uploaded images
  if (pathname.startsWith('/uploads/')) {
    const filename = path.basename(pathname);
    const filePath = path.join(UPLOADS_DIR, filename);
    const ext = path.extname(filename).toLowerCase();
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    return sendFile(filePath, mime);
  }

  // Map designated application routes
  let safePath = pathname;
  if (safePath === '/' || safePath === '') {
    safePath = '/index.html';
  } else if (safePath === '/admin' || safePath === '/admin/') {
    safePath = '/admin.html';
  } else if (safePath === '/invoice' || safePath === '/invoice/') {
    safePath = '/invoice.html';
  }

  const normalizedPath = path.normalize(safePath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(__dirname, normalizedPath);
  const ext = path.extname(filePath).toLowerCase();

  // If request has a recognized file extension, check if file exists on disk.
  // If it does not exist, return a real 404 Not Found! DO NOT fall back to index.html!
  if (ext) {
    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        setSecurityHeaders(res);
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end(`Not Found: ${pathname}`);
      }
      const mime = MIME_TYPES[ext] || 'application/octet-stream';
      sendFile(filePath, mime);
    });
    return;
  }

  // SPA Route Fallback (Only for clean extensionless web application routes)
  sendFile(path.join(__dirname, 'index.html'), 'text/html; charset=utf-8');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🐰 Rabbit Shoes Hardened Server running at http://0.0.0.0:${PORT}`);
  console.log(`📦 Data directory: ${DATA_DIR}`);
});
