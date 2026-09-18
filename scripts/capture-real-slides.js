const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE_URL = 'http://127.0.0.1:3000';
const CHROME_PATH = '/bin/chromium-browser';
const OUTPUT_DIR = '/home/ubuntu/rabbit_real_slides';
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'YOUR_TELEGRAM_BOT_TOKEN';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '1012757518';

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendPhotoToTelegram(filePath, caption) {
  const formDataBoundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const fileData = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);

  const postDataStart = [
    `--${formDataBoundary}\r\n`,
    `Content-Disposition: form-data; name="chat_id"\r\n\r\n`,
    `${TELEGRAM_CHAT_ID}\r\n`,
    `--${formDataBoundary}\r\n`,
    `Content-Disposition: form-data; name="caption"\r\n\r\n`,
    `${caption}\r\n`,
    `--${formDataBoundary}\r\n`,
    `Content-Disposition: form-data; name="parse_mode"\r\n\r\n`,
    `Markdown\r\n`,
    `--${formDataBoundary}\r\n`,
    `Content-Disposition: form-data; name="photo"; filename="${fileName}"\r\n`,
    `Content-Type: image/png\r\n\r\n`
  ].join('');

  const postDataEnd = `\r\n--${formDataBoundary}--\r\n`;

  const totalLength = Buffer.byteLength(postDataStart) + fileData.length + Buffer.byteLength(postDataEnd);

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${TELEGRAM_TOKEN}/sendPhoto`,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${formDataBoundary}`,
        'Content-Length': totalLength
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.log(`Delivered ${fileName} to Telegram: ${res.statusCode}`);
        resolve(body);
      });
    });

    req.on('error', reject);
    req.write(postDataStart);
    req.write(fileData);
    req.write(postDataEnd);
    req.end();
  });
}

async function captureAllRealSlides() {
  console.log('🚀 Launching Chromium to capture 100% REAL website screenshots...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=412,892'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({
    width: 412,
    height: 892,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  });

  const slidePaths = [];

  // ==========================================
  // SLIDE 1: REAL STOREFRONT & HOMEPAGE
  // ==========================================
  console.log('📸 Capturing Slide 1: Real Homepage & Catalog...');
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  await sleep(1500);
  
  const slide1Path = path.join(OUTPUT_DIR, 'slide_1_real_homepage.png');
  await page.screenshot({ path: slide1Path, fullPage: false });
  slidePaths.push({
    path: slide1Path,
    caption: "📸 *SLIDE 1: OFFICIAL RABBIT SHOES STOREFRONT*\n\n" +
             "👟 *100% Real Website Screenshot*\n" +
             "• Official Rabbit Brand Logo & Banner\n" +
             "• Category Filters (Sneakers, Running, Clogs)\n" +
             "• Flat 15% OFF (Code: *RABBIT15*)\n" +
             "🌐 Link: https://shoes.137.23.47.199.sslip.io/"
  });

  // ==========================================
  // SLIDE 2: REAL PRODUCT QUICK VIEW MODAL
  // ==========================================
  console.log('📸 Capturing Slide 2: Real Product Modal & Pincode Checker...');
  await page.evaluate(() => {
    const firstProduct = document.querySelector('#products-grid article');
    if (firstProduct) {
      const clickEl = firstProduct.querySelector('div[onclick^="openProductModal"]') || firstProduct;
      clickEl.click();
    }
  });
  await sleep(800);

  // Type pincode and test delivery
  await page.type('#modal-pincode-input', '302021');
  await page.click('#modal-pincode-check-btn');
  await sleep(500);

  const slide2Path = path.join(OUTPUT_DIR, 'slide_2_real_product_modal.png');
  await page.screenshot({ path: slide2Path, fullPage: false });
  slidePaths.push({
    path: slide2Path,
    caption: "📸 *SLIDE 2: QUICK VIEW & INSTANT PINCODE CHECK*\n\n" +
             "✨ *100% Real Website Screenshot*\n" +
             "• Neeman's Curve Knit Slip-Ons with high-res gallery\n" +
             "• Interactive Color Swatches & UK Sizes 6 to 10\n" +
             "• Live Pincode Delivery Estimator (Ekart Express)"
  });

  // Add to cart from modal
  await page.click('#modal-add-to-cart-btn');
  await sleep(800);

  // ==========================================
  // SLIDE 3: REAL CART DRAWER & COUPON
  // ==========================================
  console.log('📸 Capturing Slide 3: Real Cart Drawer with Coupon...');
  await page.type('#cart-coupon-input', 'RABBIT15');
  await page.click('#cart-apply-coupon-btn');
  await sleep(600);

  const slide3Path = path.join(OUTPUT_DIR, 'slide_3_real_cart_coupon.png');
  await page.screenshot({ path: slide3Path, fullPage: false });
  slidePaths.push({
    path: slide3Path,
    caption: "📸 *SLIDE 3: SMART CART & FESTIVE DISCOUNT*\n\n" +
             "🎉 *100% Real Website Screenshot*\n" +
             "• Real-time quantity stepper & free shipping bar\n" +
             "• Coupon *RABBIT15* applied (Flat 15% OFF saved!)\n" +
             "• Transparent pricing & 1-click checkout"
  });

  // ==========================================
  // SLIDE 4: REAL LIVE TRACKING SCREEN
  // ==========================================
  console.log('📸 Capturing Slide 4: Real Order Tracking Screen...');
  // Close cart
  await page.evaluate(() => {
    if (typeof cartManager !== 'undefined' && cartManager.closeDrawer) cartManager.closeDrawer();
  });
  await sleep(400);

  // Open Public Tracking Modal for live order RBT-668351
  await page.evaluate(async () => {
    if (typeof openPublicTrackModal === 'function') openPublicTrackModal();
    const idInput = document.getElementById('public-track-id');
    const phInput = document.getElementById('public-track-phone');
    if (idInput) idInput.value = 'RBT-668351';
    if (phInput) phInput.value = '9829445362';
    if (window.trackingManager) {
      const res = await window.trackingManager.trackOrder('RBT-668351', '9829445362');
      if (res.success && res.order) {
        window.trackingManager.renderTrackingModal(res.order);
      }
    }
  });
  await sleep(1000);

  const slide4Path = path.join(OUTPUT_DIR, 'slide_4_real_live_tracking.png');
  await page.screenshot({ path: slide4Path, fullPage: false });
  slidePaths.push({
    path: slide4Path,
    caption: "📸 *SLIDE 4: REAL-TIME COURIER TRACKING*\n\n" +
             "🚚 *100% Real Website Screenshot*\n" +
             "• Live Order #RBT-668351\n" +
             "• Dispatched via Ekart Logistics (AWB: EKART-72885784)\n" +
             "• Automated SMS updates & live progress timeline"
  });

  // ==========================================
  // SLIDE 5: REAL DIGITAL GST INVOICE
  // ==========================================
  console.log('📸 Capturing Slide 5: Real Digital GST Invoice / Bill...');
  await page.goto(`${BASE_URL}/invoice.html?id=RBT-668351&phone=9829445362`, { waitUntil: 'domcontentloaded' });
  await sleep(1500);

  const slide5Path = path.join(OUTPUT_DIR, 'slide_5_real_gst_invoice.png');
  await page.screenshot({ path: slide5Path, fullPage: false });
  slidePaths.push({
    path: slide5Path,
    caption: "📸 *SLIDE 5: OFFICIAL GST BILL & WHATSAPP SHARE*\n\n" +
             "📄 *100% Real Website Screenshot*\n" +
             "• Official Rabbit Footwear GSTIN & Rawatbhata Address\n" +
             "• 1-Click PDF Bill Download & Direct WhatsApp Share\n" +
             "• 7-Day Size Exchange Guarantee"
  });

  await browser.close();
  console.log('✅ All 5 REAL website slides successfully captured!');

  // Deliver to Telegram
  console.log(`📤 Sending all 5 real screenshots to Telegram (${TELEGRAM_CHAT_ID})...`);
  for (let i = 0; i < slidePaths.length; i++) {
    const s = slidePaths[i];
    await sendPhotoToTelegram(s.path, s.caption);
    await sleep(1500);
  }

  console.log('🎉 ALL 5 REAL SLIDES DELIVERED TO TELEGRAM SUCCESSFULLY!');
}

captureAllRealSlides().catch(err => {
  console.error('Error during capture/delivery:', err);
  process.exit(1);
});
