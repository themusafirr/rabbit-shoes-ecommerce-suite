// Rabbit Shoes - Customer Authentication & Account Management
(function() {
  const TOKEN_KEY = 'rabbit_customer_jwt_token_v3';
  const USER_KEY = 'rabbit_customer_profile_v3';

  class AuthManager {
    constructor() {
      this.token = localStorage.getItem(TOKEN_KEY) || null;
      this.user = this.loadStoredUser();
      this.init();
    }

    loadStoredUser() {
      try {
        const u = localStorage.getItem(USER_KEY);
        return u ? JSON.parse(u) : null;
      } catch (e) {
        return null;
      }
    }

    init() {
      if (this.token) {
        this.validateSession();
      }
    }

    isLoggedIn() {
      return !!(this.token && this.user);
    }

    getToken() {
      return this.token;
    }

    getUser() {
      return this.user;
    }

    async register(name, phone, email, password) {
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, phone, email, password })
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Registration failed.');
        }

        this.token = data.token;
        this.user = data.user;
        localStorage.setItem(TOKEN_KEY, this.token);
        localStorage.setItem(USER_KEY, JSON.stringify(this.user));
        window.dispatchEvent(new CustomEvent('rabbit_auth_changed', { detail: { user: this.user, token: this.token } }));
        return { success: true, user: this.user };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }

    async login(identifier, password) {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier, password })
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Invalid credentials.');
        }

        this.token = data.token;
        this.user = data.user;
        localStorage.setItem(TOKEN_KEY, this.token);
        localStorage.setItem(USER_KEY, JSON.stringify(this.user));
        window.dispatchEvent(new CustomEvent('rabbit_auth_changed', { detail: { user: this.user, token: this.token } }));
        return { success: true, user: this.user };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }

    async requestPasswordResetOtp(identifier) {
      try {
        const res = await fetch('/api/auth/forgot-password/request-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier })
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to request verification code.');
        }
        return { success: true, sessionId: data.sessionId, message: data.message };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }

    async verifyPasswordResetOtp(sessionId, otp, newPassword) {
      try {
        const res = await fetch('/api/auth/forgot-password/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, otp, newPassword })
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to verify code and reset password.');
        }
        return { success: true, message: data.message };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }

    async validateSession() {
      if (!this.token) return;
      try {
        const res = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${this.token}` }
        });
        if (res.ok) {
          const user = await res.json();
          this.user = user;
          localStorage.setItem(USER_KEY, JSON.stringify(user));
          window.dispatchEvent(new CustomEvent('rabbit_auth_changed', { detail: { user: this.user, token: this.token } }));
        } else {
          this.logout(false);
        }
      } catch (e) {
        // Offline or connection glitch, keep local cache
      }
    }

    logout(notify = true) {
      this.token = null;
      this.user = null;
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      if (notify) {
        window.dispatchEvent(new CustomEvent('rabbit_auth_changed', { detail: { user: null, token: null } }));
      }
    }
  }

  window.authManager = new AuthManager();
})();
