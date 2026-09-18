// Rabbit Shoes - Cart & Checkout Management

class CartManager {
  constructor() {
    this.storageKey = 'rabbit_shoes_cart_v1';
    this.couponKey = 'rabbit_shoes_applied_coupon';
    this.cart = this.loadCart();
    this.coupon = this.loadCoupon();
    this.freeShippingThreshold = 1999;
    this.standardShippingFee = 149;
    this.listeners = [];
  }

  loadCart() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.warn("Could not load cart from storage", e);
      return [];
    }
  }

  saveCart() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.cart));
    } catch (e) {
      console.error("Could not save cart", e);
    }
    this.notify();
  }

  loadCoupon() {
    try {
      const saved = localStorage.getItem(this.couponKey);
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  }

  saveCoupon(coupon) {
    this.coupon = coupon;
    if (coupon) {
      localStorage.setItem(this.couponKey, JSON.stringify(coupon));
    } else {
      localStorage.removeItem(this.couponKey);
    }
    this.notify();
  }

  subscribe(callback) {
    this.listeners.push(callback);
    callback(this);
  }

  notify() {
    this.listeners.forEach(cb => cb(this));
  }

  addItem(product, size, color, quantity = 1) {
    const existingIndex = this.cart.findIndex(
      item => item.id === product.id && item.size === size && item.color.name === color.name
    );

    if (existingIndex > -1) {
      this.cart[existingIndex].quantity += quantity;
    } else {
      this.cart.push({
        id: product.id,
        name: product.name,
        price: product.price,
        originalPrice: product.originalPrice,
        size: size,
        color: color,
        image: color.image || product.image,
        quantity: quantity
      });
    }

    this.saveCart();
    return true;
  }

  updateQuantity(index, delta) {
    if (this.cart[index]) {
      this.cart[index].quantity += delta;
      if (this.cart[index].quantity <= 0) {
        this.cart.splice(index, 1);
      }
      this.saveCart();
    }
  }

  removeItem(index) {
    if (this.cart[index]) {
      this.cart.splice(index, 1);
      this.saveCart();
    }
  }

  clear() {
    this.cart = [];
    this.saveCart();
  }

  getItemCount() {
    return this.cart.reduce((sum, item) => sum + item.quantity, 0);
  }

  getSubtotal() {
    return this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  getOriginalSubtotal() {
    return this.cart.reduce((sum, item) => sum + (item.originalPrice * item.quantity), 0);
  }

  getShippingFee() {
    const subtotal = this.getSubtotal();
    if (subtotal === 0 || subtotal >= this.freeShippingThreshold || (this.coupon && this.coupon.freeShipping)) {
      return 0;
    }
    return this.standardShippingFee;
  }

  getDiscountAmount() {
    const subtotal = this.getSubtotal();
    if (!this.coupon || subtotal === 0) return 0;

    if (this.coupon.type === 'percent') {
      return Math.round((subtotal * this.coupon.value) / 100);
    } else if (this.coupon.type === 'fixed') {
      return Math.min(subtotal, this.coupon.value);
    }
    return 0;
  }

  getTotal() {
    const subtotal = this.getSubtotal();
    if (subtotal === 0) return 0;
    const discount = this.getDiscountAmount();
    const shipping = this.getShippingFee();
    return Math.max(0, subtotal - discount + shipping);
  }

  applyCouponCode(rawCode) {
    const code = (rawCode || '').trim().toUpperCase();
    if (!code) {
      return { success: false, message: "Please enter a valid coupon code." };
    }

    const coupons = {
      'RABBIT15': {
        code: 'RABBIT15',
        type: 'percent',
        value: 15,
        description: '15% Flat Welcome Discount applied!'
      },
      'RABBIT20': {
        code: 'RABBIT20',
        type: 'percent',
        value: 20,
        description: '20% Flat Discount applied!'
      },
      'HOP500': {
        code: 'HOP500',
        type: 'fixed',
        value: 500,
        description: '₹500 Flat Savings applied!'
      },
      'FREESHIP': {
        code: 'FREESHIP',
        type: 'fixed',
        value: 0,
        freeShipping: true,
        description: 'Free Express Shipping unlocked!'
      }
    };

    if (typeof inventoryManager !== 'undefined' && inventoryManager.getSettings) {
      const storeCoupons = inventoryManager.getSettings()?.coupons || [];
      if (Array.isArray(storeCoupons)) {
        storeCoupons.forEach(c => {
          if (c && c.code) {
            coupons[c.code.toUpperCase()] = {
              code: c.code.toUpperCase(),
              type: c.type || 'percent',
              value: Number(c.value || 10),
              description: c.description || `${c.value}% Discount applied!`
            };
          }
        });
      }
    }

    if (coupons[code]) {
      this.saveCoupon(coupons[code]);
      return { success: true, coupon: coupons[code], message: coupons[code].description };
    }

    return { success: false, message: "Invalid promo code. Try 'RABBIT15' or 'RABBIT20'!" };
  }

  removeCoupon() {
    this.saveCoupon(null);
  }
}

// Global cart instance
const cartManager = new CartManager();
