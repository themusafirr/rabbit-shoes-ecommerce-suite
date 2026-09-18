// Rabbit Shoes - Live Order Tracking & My Orders Dashboard (Neeman's & Campus D2C Theme)
(function() {
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  class TrackingManager {
    constructor() {
      this.activeOrder = null;
      this.cachedOrders = new Map();
      this.initRealtimeListener();
    }

    initRealtimeListener() {
      window.addEventListener('rabbit_realtime_event', (e) => {
        const { event, data } = e.detail;
        if (event === 'order_updated') {
          // If active tracking modal is showing this order, update it live!
          if (this.activeOrder && this.activeOrder.orderId === data.orderId) {
            this.refreshActiveOrder(data.orderId);
          }
          // Also dispatch refresh for My Orders list
          window.dispatchEvent(new CustomEvent('rabbit_orders_refreshed'));
        }
      });
    }

    async fetchMyOrders() {
      if (!window.authManager || !window.authManager.isLoggedIn()) {
        return [];
      }
      try {
        const token = window.authManager.getToken();
        const res = await fetch('/api/my-orders', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const orders = await res.json();
          this.cachedOrders.clear();
          orders.forEach(o => {
            if (o && o.orderId) this.cachedOrders.set(o.orderId, o);
          });
          return orders;
        }
        return [];
      } catch (e) {
        console.error('Error fetching user orders:', e);
        return [];
      }
    }

    trackOrderById(orderId) {
      if (!orderId) return;
      const order = this.cachedOrders.get(orderId);
      if (order) {
        this.renderTrackingModal(order);
      }
    }

    async trackOrder(orderId, phone) {
      try {
        const res = await fetch(`/api/track-order?orderId=${encodeURIComponent(orderId)}&phone=${encodeURIComponent(phone)}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Could not find order.');
        }
        this.activeOrder = data;
        if (data && data.orderId) {
          this.cachedOrders.set(data.orderId, data);
        }
        return { success: true, order: data };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }

    async refreshActiveOrder(orderId) {
      if (!this.activeOrder) return;
      const phone = this.activeOrder.phone || (window.authManager && window.authManager.getUser()?.phone);
      if (!phone) return;
      const result = await this.trackOrder(orderId, phone);
      if (result.success) {
        this.renderTrackingModal(result.order);
      }
    }

    renderTrackingModal(order) {
      if (!order) return;
      this.activeOrder = order;
      const modal = document.getElementById('order-tracking-modal');
      const content = document.getElementById('order-tracking-content');
      if (!modal || !content) return;

      const timeline = order.timeline || [];
      const statusColors = {
        'Pending': 'text-amber-700 bg-amber-50 border-amber-300',
        'Processing': 'text-blue-700 bg-blue-50 border-blue-300',
        'Shipped': 'text-purple-700 bg-purple-50 border-purple-300',
        'Delivered': 'text-emerald-700 bg-emerald-50 border-emerald-300'
      };

      const safeOrderId = escapeHtml(order.orderId);
      const safeOrderStatus = escapeHtml(order.orderStatus);
      const safeCourier = escapeHtml(order.courierPartner || 'Waiting for Pickup Delivery Partner');
      const safeTracking = escapeHtml(order.trackingNumber);
      const safeEstimated = escapeHtml(order.estimatedDeliveryDate || '3-4 Business Days');

      content.innerHTML = `
        <!-- Order Top Summary Card -->
        <div class="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-sm">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
            <div>
              <div class="flex items-center gap-2">
                <span class="font-mono font-black text-sm sm:text-base text-gray-900">${safeOrderId}</span>
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${statusColors[order.orderStatus] || 'text-gray-700 border-gray-200'}">
                  ${safeOrderStatus}
                </span>
              </div>
              <p class="text-xs text-gray-500 mt-1 font-mono">
                Courier: <strong class="${order.courierPartner && !order.courierPartner.includes('Waiting') ? 'text-gray-800 font-bold' : 'text-amber-600 font-bold'}">${safeCourier}</strong> 
                • AWB: ${order.trackingNumber && order.trackingNumber !== 'Pending Dispatch' ? `<span class="text-[#ff461e] font-bold">${safeTracking}</span>` : `<span class="text-amber-600 font-semibold italic">Assigned upon dispatch</span>`}
              </p>
            </div>

            <div class="sm:text-right bg-gray-50 sm:bg-transparent p-2.5 sm:p-0 rounded-xl border border-gray-100 sm:border-0">
              <span class="text-[11px] uppercase tracking-wider text-gray-500 font-bold block">Estimated Arrival</span>
              <span class="text-xs sm:text-sm font-bold text-[#ff461e] font-mono flex items-center gap-1.5 sm:justify-end">
                <svg class="w-4 h-4 text-[#ff461e]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                ${safeEstimated}
              </span>
            </div>
          </div>

          <!-- Items Ordered Summary -->
          <div class="pt-3 flex flex-wrap items-center gap-3">
            ${(order.items || []).map(it => `
              <div class="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs">
                ${it.image ? `<img src="${encodeURI(it.image)}" alt="" class="w-6 h-6 object-contain rounded bg-white" />` : ''}
                <span class="font-medium text-gray-900 truncate max-w-[140px]">${escapeHtml(it.name)}</span>
                <span class="text-gray-500 font-mono text-[10px]">UK ${escapeHtml(it.size)} x${Number(it.quantity || 1)}</span>
              </div>
            `).join('')}
            <div class="ml-auto text-right">
              <span class="text-[11px] text-gray-500 block">Total Amount</span>
              <span class="font-mono font-bold text-sm text-[#ff461e]">₹${Number(order.totalAmount || 0).toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        <!-- 5-Stage Live Timeline Track -->
        <div class="bg-gray-50/70 border border-gray-200 rounded-2xl p-5 sm:p-6 space-y-6">
          <div class="flex items-center justify-between">
            <h4 class="text-xs font-bold uppercase tracking-wider text-gray-900 flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-[#ff461e] animate-pulse"></span>
              Live Fulfillment Trajectory
            </h4>
            <span class="text-[10px] font-mono text-gray-500">Live Auto-Sync</span>
          </div>

          <div class="relative pl-6 sm:pl-8 space-y-6 border-l-2 border-gray-200 ml-2 sm:ml-4">
            ${timeline.map((step, idx) => {
              const isCompleted = step.completed;
              const isCurrent = isCompleted && (!timeline[idx + 1] || !timeline[idx + 1].completed);
              return `
                <div class="relative group">
                  <!-- Milestone Dot Indicator -->
                  <div class="absolute -left-[31px] sm:-left-[39px] top-0.5 w-5 h-5 rounded-full flex items-center justify-center border-2 transition-all ${
                    isCompleted 
                      ? 'bg-[#ff461e] border-[#ff461e] text-white shadow-md shadow-[#ff461e]/30' 
                      : 'bg-white border-gray-300 text-gray-400'
                  }">
                    ${isCompleted 
                      ? `<svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>`
                      : `<span class="w-1.5 h-1.5 rounded-full bg-gray-300"></span>`
                    }
                  </div>

                  <div>
                    <div class="flex items-center justify-between">
                      <h5 class="text-xs sm:text-sm font-bold ${isCompleted ? 'text-gray-900' : 'text-gray-400'} flex items-center gap-2">
                        ${escapeHtml(step.stage)}
                        ${isCurrent ? `<span class="bg-[#ff461e]/10 text-[#ff461e] text-[9px] font-mono font-bold px-2 py-0.2 rounded-full border border-[#ff461e]/30 animate-pulse">CURRENT</span>` : ''}
                      </h5>
                      <span class="text-[10px] font-mono text-gray-500">
                        ${step.timestamp ? new Date(step.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }) : 'Pending'}
                      </span>
                    </div>
                    <p class="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                      ${escapeHtml(step.details || (isCompleted ? 'Stage completed successfully' : 'Awaiting fulfillment'))}
                    </p>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;

      modal.classList.remove('hidden');
      document.body.classList.add('overflow-hidden');
    }

    closeTrackingModal() {
      const modal = document.getElementById('order-tracking-modal');
      if (modal) modal.classList.add('hidden');
      document.body.classList.remove('overflow-hidden');
      this.activeOrder = null;
    }
  }

  window.trackingManager = new TrackingManager();
})();
