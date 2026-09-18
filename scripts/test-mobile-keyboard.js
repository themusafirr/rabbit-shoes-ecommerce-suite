const puppeteer = require('puppeteer');

(async () => {
  console.log('--- Testing Mobile Input Auto-Zoom Prevention & Tap-Outside Dismiss ---');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    // Emulate mobile device (iPhone 13 / 14: 390x844)
    await page.setViewport({
      width: 390,
      height: 844,
      isMobile: true,
      hasTouch: true
    });

    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });

    // 1. Verify Viewport Meta Tag
    const viewportMeta = await page.$eval('meta[name="viewport"]', el => el.getAttribute('content'));
    console.log('1. Viewport Meta Content:', viewportMeta);
    if (!viewportMeta.includes('user-scalable=no') || !viewportMeta.includes('maximum-scale=1.0')) {
      throw new Error('Viewport meta does not prevent auto-zoom!');
    }
    console.log('✅ Viewport meta correctly configured with maximum-scale=1.0 and user-scalable=no');

    // 2. Verify Computed Font-Size for Inputs on Mobile (Must be >= 16px to prevent iOS auto-zoom)
    const searchFontSize = await page.$eval('#search-shoes', el => window.getComputedStyle(el).fontSize);
    console.log('2. Computed font-size for #search-shoes:', searchFontSize);
    if (parseFloat(searchFontSize) < 16) {
      throw new Error(`Font size is ${searchFontSize}, which is < 16px and will trigger mobile auto-zoom!`);
    }
    console.log('✅ Input font size is >= 16px (16px), completely preventing mobile auto-zoom!');

    // 3. Test Focusing Search Input & Dismissing on Tap Outside
    console.log('3. Testing #search-shoes focus...');
    await page.focus('#search-shoes');
    await page.type('#search-shoes', 'Athero', { delay: 50 });

    let activeId = await page.evaluate(() => document.activeElement ? document.activeElement.id : null);
    console.log('   Active element after focus & typing:', activeId);
    if (activeId !== 'search-shoes') {
      throw new Error('Search input failed to focus!');
    }

    // Now tap outside on the hero section or body
    console.log('   Tapping outside on hero banner...');
    await page.touchscreen.tap(200, 350); // Tap middle of screen

    // Wait a brief moment for blur & reset
    await new Promise(r => setTimeout(r, 200));

    activeId = await page.evaluate(() => document.activeElement ? document.activeElement.id : null);
    console.log('   Active element after outside tap:', activeId);
    if (activeId === 'search-shoes') {
      throw new Error('Input failed to blur after outside tap!');
    }
    console.log('✅ Input successfully blurred and virtual keyboard dismissed on outside tap!');

    // 4. Test Enter Key auto-dismiss on Search Input
    console.log('4. Testing Enter key dismiss on search...');
    await page.focus('#search-shoes');
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 200));

    activeId = await page.evaluate(() => document.activeElement ? document.activeElement.id : null);
    console.log('   Active element after Enter key press:', activeId);
    if (activeId === 'search-shoes') {
      throw new Error('Search input did not blur on Enter key!');
    }
    console.log('✅ Enter key successfully dismissed keyboard and normalized view!');

    // 5. Test Track Modal Input
    console.log('5. Testing Public Track Modal input & backdrop tap...');
    await page.evaluate(() => window.openPublicTrackModal());
    await new Promise(r => setTimeout(r, 250));

    await page.focus('#public-track-id');
    await page.type('#public-track-id', 'RBT-123456');

    activeId = await page.evaluate(() => document.activeElement ? document.activeElement.id : null);
    console.log('   Active element in modal:', activeId);

    // Tap outside input on modal container / backdrop
    await page.touchscreen.tap(30, 30);
    await new Promise(r => setTimeout(r, 250));

    activeId = await page.evaluate(() => document.activeElement ? document.activeElement.id : null);
    console.log('   Active element after backdrop tap:', activeId);
    if (activeId === 'public-track-id') {
      throw new Error('Modal input did not blur on outside tap!');
    }
    console.log('✅ Modal input blurred and keyboard dismissed when tapping outside!');

    console.log('\n🎉 ALL MOBILE KEYBOARD & SCREEN NORMALIZATION TESTS PASSED 100%!');
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
