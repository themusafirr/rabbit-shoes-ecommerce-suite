// Test script for Mobile Keyboard Auto-Dismiss and Anti-Zoom logic

function createMockElement(tagName, id = '', isButton = false) {
  const el = {
    tagName: tagName.toUpperCase(),
    id: id,
    isContentEditable: false,
    blurred: false,
    focused: false,
    blur() {
      this.blurred = true;
      this.focused = false;
    },
    focus() {
      this.focused = true;
      this.blurred = false;
    },
    closest(selector) {
      if (isButton && (selector === 'button' || selector.includes('button'))) return el;
      return null;
    }
  };
  return el;
}

const listeners = {};
const mockDocument = {
  activeElement: null,
  addEventListener(event, fn) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(fn);
  },
  trigger(event, eventObj) {
    if (listeners[event]) {
      listeners[event].forEach(fn => fn(eventObj));
    }
  },
  querySelector(sel) {
    if (sel === 'meta[name="viewport"]') {
      return {
        setAttribute(k, v) { this.content = v; },
        content: 'width=device-width, initial-scale=1.0'
      };
    }
    return null;
  }
};

const mockWindow = {
  visualViewport: { scale: 1, offsetTop: 0 },
  scrollY: 100,
  scrollToCalled: false,
  scrollTo(opts) {
    this.scrollToCalled = true;
  },
  matchMedia() { return { matches: true }; }
};

// Simulate browser global scope
global.document = mockDocument;
global.window = mockWindow;

// Load mobile-keyboard logic
require('../js/mobile-keyboard.js');

console.log('--- Testing Mobile Keyboard Logic ---');

// TEST 1: Outside touch dismisses keyboard
const searchInput = createMockElement('input', 'search-shoes');
mockDocument.activeElement = searchInput;
const bodyArea = createMockElement('div', 'hero-section');

mockDocument.trigger('touchend', { target: bodyArea });
console.log('Test 1 (Touch outside on body/hero):');
if (searchInput.blurred) {
  console.log('  ✓ PASSED: searchInput was successfully blurred!');
} else {
  console.error('  ❌ FAILED: searchInput was NOT blurred!');
  process.exit(1);
}

// TEST 2: Touch on same input does NOT blur
searchInput.blurred = false;
mockDocument.activeElement = searchInput;
mockDocument.trigger('touchend', { target: searchInput });
console.log('Test 2 (Touch inside same input):');
if (!searchInput.blurred) {
  console.log('  ✓ PASSED: input was NOT blurred (cursor repositioning preserved)!');
} else {
  console.error('  ❌ FAILED: input was wrongly blurred!');
  process.exit(1);
}

// TEST 3: Touch on another input does NOT trigger handler blur (browser switches focus)
const anotherInput = createMockElement('input', 'cust-phone');
searchInput.blurred = false;
mockDocument.activeElement = searchInput;
mockDocument.trigger('touchend', { target: anotherInput });
console.log('Test 3 (Touch on another input):');
if (!searchInput.blurred) {
  console.log('  ✓ PASSED: input was not prematurely blurred, allowing smooth field transition!');
} else {
  console.error('  ❌ FAILED: input was wrongly blurred!');
  process.exit(1);
}

// TEST 4: Enter key on search input dismisses keyboard
searchInput.blurred = false;
mockDocument.activeElement = searchInput;
mockDocument.trigger('keydown', { key: 'Enter', target: searchInput });
console.log('Test 4 (Press Enter on search input):');
if (searchInput.blurred) {
  console.log('  ✓ PASSED: Enter key dismissed keyboard!');
} else {
  console.error('  ❌ FAILED: Enter key did NOT blur search input!');
  process.exit(1);
}

// TEST 5: Swipe / touchmove outside active input dismisses keyboard
const couponInput = createMockElement('input', 'cart-coupon-input');
couponInput.blurred = false;
mockDocument.activeElement = couponInput;
// Start touch outside on products list
mockDocument.trigger('touchstart', { target: bodyArea });
// Move finger outside
mockDocument.trigger('touchmove', { target: bodyArea });
console.log('Test 5 (Swipe/scroll outside input):');
if (couponInput.blurred) {
  console.log('  ✓ PASSED: Scrolling/swiping outside dismissed keyboard!');
} else {
  console.error('  ❌ FAILED: Scrolling outside did NOT blur input!');
  process.exit(1);
}

console.log('\n🎉 ALL LOGIC UNIT TESTS PASSED!');
