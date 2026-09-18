// Rabbit Shoes - Wishlist Management

class WishlistManager {
  constructor() {
    this.storageKey = 'rabbit_shoes_wishlist_v1';
    this.items = this.loadWishlist();
    this.listeners = [];
  }

  loadWishlist() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  }

  saveWishlist() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.items));
    } catch (e) {
      console.error("Failed to save wishlist", e);
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

  has(productId) {
    return this.items.includes(productId);
  }

  isInWishlist(productId) {
    return this.has(productId);
  }

  addItem(productId) {
    if (!this.items.includes(productId)) {
      this.items.push(productId);
      this.saveWishlist();
    }
  }

  removeItem(productId) {
    const idx = this.items.indexOf(productId);
    if (idx > -1) {
      this.items.splice(idx, 1);
      this.saveWishlist();
    }
  }

  toggle(productId) {
    const idx = this.items.indexOf(productId);
    let added = false;
    if (idx > -1) {
      this.items.splice(idx, 1);
      added = false;
    } else {
      this.items.push(productId);
      added = true;
    }
    this.saveWishlist();
    return added;
  }

  getCount() {
    return this.items.length;
  }

  getItems() {
    return PRODUCTS_DATA.filter(p => this.items.includes(p.id));
  }
}

const wishlistManager = new WishlistManager();
