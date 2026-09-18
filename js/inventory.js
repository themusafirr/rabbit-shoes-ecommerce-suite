// Rabbit Shoes - Unified Inventory, Realtime SSE & Settings Engine
(function() {
  const INVENTORY_STORAGE_KEY = 'rabbit_shoes_inventory_clean_v4';
  const SETTINGS_STORAGE_KEY = 'rabbit_shoes_settings_clean_v4';

  class InventoryManager {
    constructor() {
      this.apiUrl = '/api';
      this.productsCache = this.loadLocalProducts();
      this.settingsCache = this.loadLocalSettings();
      this.ordersCache = [];
      this.sseEventSource = null;
      this.init();
    }

    loadLocalProducts() {
      try {
        const data = localStorage.getItem(INVENTORY_STORAGE_KEY);
        if (data) {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch(e) {}
      return (typeof PRODUCTS_DATA !== 'undefined' && Array.isArray(PRODUCTS_DATA) && PRODUCTS_DATA.length > 0) 
        ? PRODUCTS_DATA 
        : [];
    }

    saveLocalProducts(products) {
      this.productsCache = products;
      try {
        localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(products));
      } catch(e) {}
      window.dispatchEvent(new CustomEvent('rabbit_inventory_updated', { detail: products }));
    }

    loadLocalSettings() {
      try {
        const data = localStorage.getItem(SETTINGS_STORAGE_KEY);
        return data ? JSON.parse(data) : {
          storeName: 'Rabbit Shoes',
          upiId: 'rabbitshoes@okhdfcbank',
          upiMerchantName: 'Rabbit Shoes Official',
          storewideDiscount: 0,
          flashSaleActive: false,
          flashSaleBanner: '',
          coupons: []
        };
      } catch(e) {
        return {
          storeName: 'Rabbit Shoes',
          upiId: 'rabbitshoes@okhdfcbank',
          upiMerchantName: 'Rabbit Shoes Official',
          storewideDiscount: 0,
          flashSaleActive: false,
          flashSaleBanner: '',
          coupons: []
        };
      }
    }

    saveLocalSettings(settings) {
      this.settingsCache = settings;
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
      } catch(e) {}
      window.dispatchEvent(new CustomEvent('rabbit_settings_updated', { detail: settings }));
    }

    init() {
      this.syncWithServer();
      this.initRealtimeSSE();
    }

    // Connect to Server-Sent Events for instant live broadcast updates
    initRealtimeSSE() {
      try {
        if (typeof window !== 'undefined' && window.location && window.location.search && window.location.search.includes('nosse=1')) {
          return;
        }
        if (typeof EventSource !== 'undefined') {
          this.sseEventSource = new EventSource('/api/realtime/stream');
          
          this.sseEventSource.addEventListener('inventory_updated', (e) => {
            this.fetchProducts();
          });

          this.sseEventSource.addEventListener('discount_updated', (e) => {
            try {
              const data = JSON.parse(e.data);
              this.saveLocalSettings(data);
              this.fetchProducts(); // Refresh products with new discount
            } catch(err) {}
          });

          this.sseEventSource.addEventListener('settings_updated', (e) => {
            try {
              const data = JSON.parse(e.data);
              this.saveLocalSettings(data);
            } catch(err) {}
          });

          this.sseEventSource.addEventListener('order_updated', (e) => {
            try {
              const data = JSON.parse(e.data);
              if (this.getAdminToken()) {
                this.fetchOrders();
              }
              window.dispatchEvent(new CustomEvent('rabbit_orders_updated', { detail: data }));
              window.dispatchEvent(new CustomEvent('rabbit_realtime_event', { detail: { event: 'order_updated', data } }));
            } catch(err) {}
          });

          this.sseEventSource.addEventListener('order_created', (e) => {
            try {
              const data = JSON.parse(e.data);
              if (this.getAdminToken()) {
                this.fetchOrders();
              }
              window.dispatchEvent(new CustomEvent('rabbit_orders_updated', { detail: data }));
              window.dispatchEvent(new CustomEvent('rabbit_realtime_event', { detail: { event: 'order_created', data } }));
            } catch(err) {}
          });

          this.sseEventSource.onerror = () => {
            // Reconnect handled automatically by browser EventSource
          };
        }
      } catch (err) {
        console.warn('Realtime SSE not available, using polling fallback');
      }
    }

    async syncWithServer() {
      const promises = [
        this.fetchProducts(),
        this.fetchSettings()
      ];
      if (this.getAdminToken()) {
        promises.push(this.fetchOrders());
      }
      await Promise.all(promises);
    }

    async fetchProducts() {
      try {
        const res = await fetch(`${this.apiUrl}/products`, { cache: 'no-store' });
        if (res.ok) {
          const products = await res.json();
          this.saveLocalProducts(products);
          return products;
        }
      } catch (e) {
        console.warn('Using cached products');
      }
      return this.getProducts();
    }

    async fetchSettings() {
      try {
        const res = await fetch(`${this.apiUrl}/settings`, { cache: 'no-store' });
        if (res.ok) {
          const settings = await res.json();
          this.saveLocalSettings(settings);
          return settings;
        }
      } catch (e) {}
      return this.getSettings();
    }

    async fetchOrders() {
      const token = this.getAdminToken();
      if (!token) return [];
      try {
        const orders = await this.adminFetchOrders();
        this.ordersCache = orders || [];
        window.dispatchEvent(new CustomEvent('rabbit_orders_updated', { detail: this.ordersCache }));
        return this.ordersCache;
      } catch(e) {
        return this.ordersCache || [];
      }
    }

    getProducts() {
      return this.productsCache || [];
    }

    getSettings() {
      return this.settingsCache || {
        storeName: 'Rabbit Shoes',
        upiId: 'rabbitshoes@okhdfcbank',
        upiMerchantName: 'Rabbit Shoes Official',
        storewideDiscount: 0,
        flashSaleActive: false,
        flashSaleBanner: '',
        coupons: []
      };
    }

    getOrders() {
      return this.ordersCache || [];
    }

    getStats() {
      const products = this.getProducts();
      const orders = this.getOrders();
      const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
      const pendingOrders = orders.filter(o => (o.orderStatus || 'Pending') === 'Pending').length;
      return {
        totalRevenue,
        totalOrders: orders.length,
        pendingOrders,
        totalProducts: products.length
      };
    }

    getProductById(id) {
      return this.getProducts().find(p => p.id === id);
    }

    // Place Order via Server API
    async createOrder(orderData) {
      try {
        const headers = { 'Content-Type': 'application/json' };
        if (window.authManager && window.authManager.isLoggedIn()) {
          headers['Authorization'] = `Bearer ${window.authManager.getToken()}`;
        }

        const res = await fetch(`${this.apiUrl}/orders`, {
          method: 'POST',
          headers,
          body: JSON.stringify(orderData)
        });

        const created = await res.json();
        if (!res.ok) {
          throw new Error(created.error || 'Failed to place order');
        }

        return created;
      } catch (err) {
        console.error('Error placing order:', err);
        return null;
      }
    }

    // --- Admin Operations (Authorized with Bearer Token) ---
    getAdminToken() {
      return localStorage.getItem('rabbit_owner_jwt_token_v3') || '';
    }

    async adminFetchOrders() {
      const token = this.getAdminToken();
      const res = await fetch(`${this.apiUrl}/orders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Unauthorized');
      return await res.json();
    }

    async adminUpdateOrderStatus(orderId, updatePayload) {
      const token = this.getAdminToken();
      const res = await fetch(`${this.apiUrl}/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updatePayload)
      });
      if (!res.ok) throw new Error('Failed to update order');
      return await res.json();
    }

    async updateOrderStatus(orderId, newStatus, extraData = {}) {
      const payload = { orderStatus: newStatus, ...extraData };
      const updated = await this.adminUpdateOrderStatus(orderId, payload);
      const idx = this.ordersCache.findIndex(o => o.orderId === orderId);
      if (idx !== -1) {
        this.ordersCache[idx] = updated;
      }
      window.dispatchEvent(new CustomEvent('rabbit_orders_updated', { detail: this.ordersCache }));
      return updated;
    }

    async adminUpdateSettings(settingsPayload) {
      const token = this.getAdminToken();
      const res = await fetch(`${this.apiUrl}/admin/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(settingsPayload)
      });
      if (!res.ok) throw new Error('Failed to update settings');
      const data = await res.json();
      this.saveLocalSettings(data.settings);
      return data;
    }

    async adminFetchSettings() {
      const token = this.getAdminToken();
      const res = await fetch(`${this.apiUrl}/admin/settings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch admin settings');
      return await res.json();
    }

    async adminSendTestSMS(phone, customerName = 'Pankaj Kalosiya') {
      const token = this.getAdminToken();
      const res = await fetch(`${this.apiUrl}/admin/test-sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ phone, customerName })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to send test SMS');
      }
      return await res.json();
    }

    async adminFetchStats() {
      const token = this.getAdminToken();
      const res = await fetch(`${this.apiUrl}/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Unauthorized');
      return await res.json();
    }

    async addProduct(productData) {
      const token = this.getAdminToken();
      const res = await fetch(`${this.apiUrl}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(productData)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to add product');
      }
      const prod = await res.json();
      await this.fetchProducts();
      return prod;
    }

    async updateProduct(id, productData) {
      const token = this.getAdminToken();
      const res = await fetch(`${this.apiUrl}/products/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(productData)
      });
      if (!res.ok) throw new Error('Failed to update product');
      const updated = await res.json();
      await this.fetchProducts();
      return updated;
    }

    async toggleStock(productId) {
      const product = this.getProductById(productId);
      if (!product) return;
      const nextStock = product.inStock === false ? true : false;
      return await this.updateProduct(productId, { inStock: nextStock });
    }

    async deleteProduct(id) {
      const token = this.getAdminToken();
      const res = await fetch(`${this.apiUrl}/products/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json().catch(() => ({ success: true }));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete product');
      }
      await this.fetchProducts();
      return data;
    }
  }

  window.inventoryManager = new InventoryManager();
})();
