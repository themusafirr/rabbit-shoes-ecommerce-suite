/**
 * Rabbit Shoes - Mobile Keyboard & Viewport Auto-Reset Controller
 * 
 * 1. Prevents unwanted auto-zoom when tapping/typing in input fields on mobile.
 * 2. Automatically dismisses virtual keyboard when tapping or scrolling anywhere outside the active input.
 * 3. Smoothly resets screen zoom and scroll position back to normal when typing finishes.
 */

(function() {
  'use strict';

  // 1. Prevent gesture-based auto-zoom on iOS WebKit
  document.addEventListener('gesturestart', function(e) {
    e.preventDefault();
  }, { passive: false });

  let touchStartElement = null;

  // 2. Track where touch started
  document.addEventListener('touchstart', function(e) {
    if (e.target) {
      touchStartElement = e.target;
    }
  }, { passive: true });

  // 3. Handle tap / click anywhere on screen
  function handleScreenTouch(e) {
    const activeEl = document.activeElement;
    if (!activeEl) return;

    // Is an input, textarea or contenteditable currently focused?
    const isInputActive = activeEl.tagName === 'INPUT' || 
                          activeEl.tagName === 'TEXTAREA' || 
                          activeEl.tagName === 'SELECT' || 
                          activeEl.isContentEditable;

    if (!isInputActive) return;

    const clickedTarget = e.target;
    if (!clickedTarget) return;

    // Check if clicked element is an input or editable field
    const isTargetInput = clickedTarget.tagName === 'INPUT' || 
                          clickedTarget.tagName === 'TEXTAREA' || 
                          clickedTarget.tagName === 'SELECT' || 
                          clickedTarget.isContentEditable;

    // If user tapped on the same input, do not blur (user is placing cursor)
    if (clickedTarget === activeEl) return;

    // If user tapped on another input, let browser transfer focus naturally
    if (isTargetInput) return;

    // Check if clicked element is an action button (submit, coupon apply, login btn, bag, etc.)
    const isActionBtn = clickedTarget.closest('button') || 
                        clickedTarget.closest('a') || 
                        clickedTarget.closest('label');

    if (isActionBtn) {
      // If user tapped a button, let the button execute its click, but also dismiss keyboard
      setTimeout(function() {
        if (document.activeElement === activeEl) {
          activeEl.blur();
          resetScreenToNormal();
        }
      }, 50);
      return;
    }

    // User touched outside anywhere on the screen (background, card, text, whitespace, backdrop)
    activeEl.blur(); // Instantly dismisses mobile virtual keyboard
    resetScreenToNormal();
  }

  // Bind to touchstart and mousedown
  document.addEventListener('touchend', handleScreenTouch, { passive: true });
  document.addEventListener('mousedown', function(e) {
    // Only handle mouse events on devices where touch didn't just handle it
    if (window.matchMedia('(pointer: fine)').matches) {
      handleScreenTouch(e);
    }
  });

  // 4. Dismiss keyboard when user swipes / scrolls the screen outside the active input
  document.addEventListener('touchmove', function(e) {
    const activeEl = document.activeElement;
    if (!activeEl) return;

    const isInputActive = activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA';
    if (!isInputActive) return;

    // If scroll gesture started outside the active input
    if (touchStartElement && touchStartElement !== activeEl && !touchStartElement.closest('input, textarea')) {
      activeEl.blur();
      resetScreenToNormal();
    }
  }, { passive: true });

  // 5. Dismiss keyboard when pressing Enter on single-line inputs (Search, Promo code, Tracking)
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      const activeEl = document.activeElement;
      if (activeEl && activeEl.tagName === 'INPUT') {
        // If it's a search input or coupon input, dismiss keyboard on Enter
        if (activeEl.id === 'search-shoes' || activeEl.id === 'cart-coupon-input' || activeEl.id === 'public-track-id') {
          activeEl.blur();
          resetScreenToNormal();
        }
      }
    }
  });

  // 6. Reset screen scale & scroll when focus is lost (focusout / blur)
  document.addEventListener('focusout', function(e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) {
      setTimeout(function() {
        const currentActive = document.activeElement;
        const stillInInput = currentActive && (
          currentActive.tagName === 'INPUT' || 
          currentActive.tagName === 'TEXTAREA' || 
          currentActive.tagName === 'SELECT'
        );

        if (!stillInInput) {
          resetScreenToNormal();
        }
      }, 120);
    }
  });

  // 7. Function to restore viewport scale and smooth scroll back to normal
  function resetScreenToNormal() {
    // Force viewport meta tag to unzoom if any mobile browser zoomed
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    if (viewportMeta) {
      const standardViewport = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
      viewportMeta.setAttribute('content', standardViewport);
    }

    // If page is offset or zoomed, normalize
    if (window.visualViewport && (window.visualViewport.scale !== 1 || window.visualViewport.offsetTop > 0)) {
      window.scrollTo({
        top: window.scrollY,
        left: 0,
        behavior: 'smooth'
      });
    }
  }

  // 8. Global export
  window.dismissMobileKeyboard = function() {
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
    resetScreenToNormal();
  };

  window.resetScreenToNormal = resetScreenToNormal;
})();
