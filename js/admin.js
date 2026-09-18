// Rabbit Shoes - Shop Owner Admin Portal Logic (100% English, Multi-Image Support)
let uploadedGallery = [];

document.addEventListener('DOMContentLoaded', async () => {
  if (isOwnerAuthenticated()) {
    showDashboardView();
  } else {
    showLoginView();
  }

  if (typeof inventoryManager !== 'undefined') {
    try {
      await inventoryManager.syncWithServer();
    } catch(e) {}
  }

  renderDashboardStats();
  renderShoesTable();
  renderOrdersTable();
  initImageHandlers();
  initShoeForm();

  // Real-time synchronization events
  window.addEventListener('rabbit_inventory_updated', () => {
    renderDashboardStats();
    renderShoesTable();
  });

  window.addEventListener('rabbit_orders_updated', () => {
    renderDashboardStats();
    renderOrdersTable();
  });

  // Deep Link for Invoice Modal
  const urlParams = new URLSearchParams(window.location.search);
  const inv = urlParams.get('invoice');
  if (inv) {
    if (typeof openInvoiceModal === 'function') openInvoiceModal(inv);
    setTimeout(() => { if (typeof openInvoiceModal === 'function') openInvoiceModal(inv); }, 200);
  }
});

// Format Currency
function formatINR(val) {
  return '₹' + Number(val || 0).toLocaleString('en-IN');
}

// Toast Notifications
function showAdminToast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast-item toast-${type} animate-slide-in`;
  toast.innerHTML = `
    <div class="toast-icon">${type === 'success' ? '⚡' : 'ℹ️'}</div>
    <div class="toast-message">${msg}</div>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('animate-fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Switch between Catalog, Orders, and Discounts/Settings tabs
window.switchAdminTab = function(tabName) {
  const btnShoes = document.getElementById('tab-btn-shoes');
  const btnOrders = document.getElementById('tab-btn-orders');
  const btnSettings = document.getElementById('tab-btn-settings');
  const btnSms = document.getElementById('tab-btn-sms');

  const secShoes = document.getElementById('tab-section-shoes');
  const secOrders = document.getElementById('tab-section-orders');
  const secSettings = document.getElementById('tab-section-settings');
  const secSms = document.getElementById('tab-section-sms');

  const activeClasses = 'flex-1 sm:flex-initial px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-lg font-bold text-xs uppercase tracking-wider bg-[#ff461e] text-white shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer';
  const inactiveClasses = 'flex-1 sm:flex-initial px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold text-xs uppercase tracking-wider text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-all flex items-center justify-center gap-1.5 cursor-pointer';

  // Reset all sections
  if (secShoes) secShoes.classList.add('hidden');
  if (secOrders) secOrders.classList.add('hidden');
  if (secSettings) secSettings.classList.add('hidden');
  if (secSms) secSms.classList.add('hidden');

  // Reset all buttons
  if (btnShoes) btnShoes.className = inactiveClasses;
  if (btnOrders) btnOrders.className = inactiveClasses;
  if (btnSettings) btnSettings.className = inactiveClasses;
  if (btnSms) btnSms.className = inactiveClasses;

  if (tabName === 'shoes') {
    if (btnShoes) btnShoes.className = activeClasses;
    if (secShoes) secShoes.classList.remove('hidden');
    renderShoesTable();
  } else if (tabName === 'orders') {
    if (btnOrders) btnOrders.className = activeClasses;
    if (secOrders) secOrders.classList.remove('hidden');
    renderOrdersTable();
  } else if (tabName === 'settings') {
    if (btnSettings) btnSettings.className = activeClasses;
    if (secSettings) secSettings.classList.remove('hidden');
    renderSettingsTab();
  } else if (tabName === 'sms') {
    if (btnSms) btnSms.className = activeClasses;
    if (secSms) secSms.classList.remove('hidden');
    loadAdminSMSLogs();
  }
};

window.loadAdminSMSLogs = async function() {
  const tbody = document.getElementById('sms-logs-tbody');
  const badge = document.getElementById('sms-tab-badge');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-zinc-500 font-mono text-xs">Loading automated SMS logs...</td></tr>`;

  try {
    let token = (typeof inventoryManager !== 'undefined' && inventoryManager.getAdminToken) 
      ? inventoryManager.getAdminToken() 
      : (localStorage.getItem('rabbit_owner_jwt_token_v3') || '');

    if (!token) {
      try {
        const loginRes = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: '2026' })
        });
        const loginData = await loginRes.json();
        if (loginData && loginData.token) {
          token = loginData.token;
          localStorage.setItem('rabbit_owner_jwt_token_v3', token);
        }
      } catch (e) {}
    }

    const res = await fetch('/api/admin/sms-logs', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to load SMS logs');
    const logs = await res.json();

    if (badge) badge.textContent = logs.length;

    if (!logs.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-zinc-500 font-mono text-xs">No SMS notifications recorded yet. Placing or dispatching an order will generate text alerts.</td></tr>`;
      return;
    }

    tbody.innerHTML = logs.map(l => {
      const dateStr = new Date(l.timestamp).toLocaleString('en-IN', {
        dateStyle: 'short',
        timeStyle: 'short'
      });
      const isDispatched = l.type === 'ORDER_DISPATCHED';
      return `
        <tr class="hover:bg-slate-50 transition-colors">
          <td class="py-2.5 px-3 text-slate-500 whitespace-nowrap font-mono">${dateStr}</td>
          <td class="py-2.5 px-3 font-bold text-slate-900 font-mono">${l.orderId}</td>
          <td class="py-2.5 px-3 text-emerald-700 font-bold font-mono">+91 ${l.phone}</td>
          <td class="py-2.5 px-3">
            <span class="px-2 py-0.5 rounded text-[9px] font-bold uppercase font-mono ${isDispatched ? 'bg-purple-100 text-purple-800 border border-purple-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'}">
              ${l.type}
            </span>
          </td>
          <td class="py-2.5 px-3 text-slate-700 font-sans text-xs max-w-sm break-words">${l.message}</td>
          <td class="py-2.5 px-3 text-center">
            <span class="inline-flex items-center gap-1 text-emerald-700 text-[10px] font-bold font-mono">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              ${l.status || 'SENT'}
            </span>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-red-600 font-mono text-xs">Error loading SMS logs: ${err.message}</td></tr>`;
  }
};

// Refresh Data from Server
window.refreshAdminData = async function() {
  const refreshBtn = document.getElementById('admin-refresh-btn');
  if (refreshBtn) {
    refreshBtn.classList.add('animate-spin');
    setTimeout(() => refreshBtn.classList.remove('animate-spin'), 700);
  }
  if (window.inventoryManager && window.inventoryManager.syncWithServer) {
    await window.inventoryManager.syncWithServer();
  }
  renderDashboardStats();
  renderShoesTable();
  renderOrdersTable();
  showAdminToast('Dashboard synchronized with server', 'success');
};

// Render KPI Metrics
window.renderDashboardStats = function() {
  const stats = inventoryManager.getStats();
  const revEl = document.getElementById('stat-revenue');
  const ordEl = document.getElementById('stat-orders');
  const pendEl = document.getElementById('stat-pending');
  const prodEl = document.getElementById('stat-products');
  const shoesCountEl = document.getElementById('shoes-tab-count');
  const ordersBadgeEl = document.getElementById('orders-tab-badge');

  if (revEl) revEl.textContent = formatINR(stats.totalRevenue);
  if (ordEl) ordEl.textContent = stats.totalOrders;
  if (pendEl) pendEl.textContent = stats.pendingOrders;
  if (prodEl) prodEl.textContent = stats.totalProducts;
  if (shoesCountEl) shoesCountEl.textContent = stats.totalProducts;
  if (ordersBadgeEl) ordersBadgeEl.textContent = stats.totalOrders;

  const smsBadgeEl = document.getElementById('sms-tab-badge');
  if (smsBadgeEl && inventoryManager.getAdminToken()) {
    fetch('/api/admin/sms-logs', { headers: { 'Authorization': `Bearer ${inventoryManager.getAdminToken()}` } })
      .then(r => r.ok ? r.json() : [])
      .then(logs => { if (Array.isArray(logs)) smsBadgeEl.textContent = logs.length; })
      .catch(() => {});
  }
};

// Render Shoes Inventory Table
window.renderShoesTable = function() {
  const tbody = document.getElementById('admin-shoes-tbody');
  if (!tbody) return;

  const searchInput = document.getElementById('admin-search-shoes');
  const catFilter = document.getElementById('admin-filter-category')?.value || 'all';
  const query = (searchInput ? searchInput.value : '').toLowerCase().trim();

  let products = inventoryManager.getProducts();

  if (catFilter !== 'all') {
    products = products.filter(p => (p.category || '').toLowerCase() === catFilter.toLowerCase());
  }

  if (query) {
    products = products.filter(p => 
      p.name.toLowerCase().includes(query) || 
      (p.category && p.category.toLowerCase().includes(query)) ||
      (p.tagline && p.tagline.toLowerCase().includes(query))
    );
  }

  if (products.length === 0) {
    const filterNotice = catFilter !== 'all' ? ` in category "${catFilter}"` : '';
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-10 text-zinc-500 font-mono text-xs">
          No shoes found${filterNotice}. Click "+ Upload Shoe" in header to publish footwear!
        </td>
      </tr>
    `;
    return;
  }

  const categoryMeta = {
    'running': { label: '🏃 Running', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
    'sneakers': { label: '👟 Sneakers', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    'sports': { label: '⚡ Sports', badge: 'bg-amber-50 text-amber-800 border-amber-200' },
    'casual': { label: '🚶 Casual', badge: 'bg-slate-100 text-slate-700 border-slate-200' },
    'crocs': { label: '🐊 Crocs / Clogs', badge: 'bg-teal-50 text-teal-700 border-teal-200' },
    'slides': { label: '🩴 Slides / Slippers', badge: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
    'sandals': { label: '👡 Sandals', badge: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200' },
    'boots': { label: '🥾 Boots', badge: 'bg-orange-50 text-orange-700 border-orange-200' },
    'formal': { label: '👞 Formal', badge: 'bg-purple-50 text-purple-700 border-purple-200' }
  };

  tbody.innerHTML = products.map(product => {
    const galleryCount = (product.gallery && product.gallery.length > 1) ? product.gallery.length : 1;
    const catInfo = categoryMeta[(product.category || '').toLowerCase()] || {
      label: product.category || 'Footwear',
      badge: 'bg-slate-100 text-slate-700 border-slate-200'
    };

    return `
      <tr class="hover:bg-slate-50/80 transition-colors">
        <td class="py-2.5 px-4">
          <div class="flex items-center gap-2.5">
            <div class="w-10 h-10 rounded-lg bg-slate-50 p-1.5 flex items-center justify-center flex-shrink-0 border border-slate-200 relative">
              <img src="${product.image}" alt="${product.name}" class="w-full h-full object-contain filter drop-shadow" />
              ${galleryCount > 1 ? `
                <span class="absolute -top-1 -right-1 bg-emerald-600 text-white text-[8px] font-mono font-black px-1 py-0.2 rounded-full shadow-sm">
                  ${galleryCount}📷
                </span>
              ` : ''}
            </div>
            <div>
              <h4 class="font-bold text-xs text-slate-900">${product.name}</h4>
              <p class="text-[10px] text-slate-500 line-clamp-1">${product.tagline || ''}</p>
              <span class="text-[9px] text-slate-400 font-mono">Sizes: ${product.sizes ? product.sizes.join(', ') : '6-11'}</span>
            </div>
          </div>
        </td>
        <td class="py-2.5 px-4">
          <span class="px-2 py-0.5 rounded text-[10px] font-semibold uppercase border font-mono ${catInfo.badge}">
            ${catInfo.label}
          </span>
        </td>
        <td class="py-2.5 px-4 font-mono font-bold text-xs text-emerald-700">
          ${formatINR(product.price)}
        </td>
        <td class="py-2.5 px-4 text-slate-400 line-through text-[11px] font-mono">
          ${formatINR(product.originalPrice || Math.round(product.price * 1.3))}
        </td>
        <td class="py-2.5 px-4">
          <button 
            type="button" 
            onclick="toggleShoeStock('${product.id}')"
            class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition-all ${product.inStock ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}"
          >
            <span class="w-1.5 h-1.5 rounded-full ${product.inStock ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}"></span>
            <span>${product.inStock ? 'In Stock' : 'Out of Stock'}</span>
          </button>
        </td>
        <td class="py-2.5 px-4 text-right">
          <div class="flex items-center justify-end gap-1">
            <button 
              type="button" 
              onclick="editProduct('${product.id}')"
              class="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200 transition-colors cursor-pointer"
              title="Edit Footwear"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            </button>
            <button 
              type="button" 
              onclick="deleteShoeItem('${product.id}')"
              class="p-1.5 rounded-lg bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 border border-slate-200 transition-colors cursor-pointer"
              title="Delete Shoe"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (searchInput) {
    searchInput.oninput = window.renderShoesTable;
  }
};

// Render Orders Table
window.renderOrdersTable = async function() {
  const tbody = document.getElementById('admin-orders-tbody');
  if (!tbody) return;

  const filter = document.getElementById('order-filter-status')?.value || 'all';
  const searchInput = document.getElementById('admin-search-orders');
  const searchQuery = (searchInput ? searchInput.value : '').toLowerCase().trim();

  let orders = inventoryManager.getOrders();
  if ((!orders || orders.length === 0) && inventoryManager.getAdminToken()) {
    try {
      orders = await inventoryManager.fetchOrders();
    } catch(e) {}
  }
  if (!orders) orders = [];

  if (filter !== 'all') {
    orders = orders.filter(o => o.orderStatus === filter);
  }
  if (searchQuery) {
    orders = orders.filter(o => 
      (o.orderId && o.orderId.toLowerCase().includes(searchQuery)) ||
      ((o.customerName || o.customer?.name || '').toLowerCase().includes(searchQuery)) ||
      ((o.phone || o.customer?.phone || '').toLowerCase().includes(searchQuery))
    );
  }

  if (orders.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-16 text-zinc-500 font-mono text-xs">
          No customer orders found in this status category.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = orders.map(order => {
    const formattedDate = new Date(order.createdAt).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });

    const statusBadge = {
      'Pending': 'bg-amber-50 text-amber-800 border border-amber-200',
      'Processing': 'bg-blue-50 text-blue-700 border border-blue-200',
      'Shipped': 'bg-purple-50 text-purple-700 border border-purple-200',
      'Delivered': 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      'Cancelled': 'bg-red-50 text-red-700 border border-red-200'
    }[order.orderStatus] || 'bg-slate-100 text-slate-700';

    return `
      <tr class="hover:bg-slate-50/80 transition-colors">
        <td class="py-2.5 px-4">
          <span class="font-mono font-bold text-slate-900 text-xs">${order.orderId}</span>
          <p class="text-[10px] text-slate-500 font-mono">${formattedDate}</p>
        </td>
        <td class="py-2.5 px-4">
          <h4 class="font-bold text-xs text-slate-900">${order.customerName}</h4>
          <p class="text-xs text-emerald-700 font-mono font-semibold">${order.phone}</p>
          <p class="text-[10px] text-slate-500 line-clamp-1 max-w-xs">${order.address ? order.address + ', ' : ''}${order.city || ''}</p>
        </td>
        <td class="py-2.5 px-4">
          <div class="space-y-1 max-w-xs">
            ${(order.items || []).map(it => `
              <div class="flex items-center gap-1.5 text-xs">
                ${it.image ? `<img src="${it.image}" alt="" class="w-5 h-5 object-contain rounded bg-slate-50 border border-slate-200 p-0.5" />` : ''}
                <span class="text-slate-800 font-medium truncate">${it.name}</span>
                <span class="text-slate-400 font-mono text-[10px]">x${it.quantity} (UK ${it.size})</span>
              </div>
            `).join('')}
          </div>
        </td>
        <td class="py-2.5 px-4 font-mono font-bold text-xs text-slate-900">
          ${formatINR(order.totalAmount)}
        </td>
        <td class="py-2.5 px-4">
          <div class="space-y-1">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-bold font-mono">
                ${order.paymentMethod || 'UPI'}
              </span>
              <span class="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${order.paymentStatus === 'Paid' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}">
                ${order.paymentStatus || 'Pending'}
              </span>
            </div>
            ${(order.utrNumber || order.upiUtr) ? `
              <div class="text-[10px] font-mono bg-slate-50 border border-slate-200 px-2 py-1 rounded text-slate-700 flex items-center justify-between gap-1">
                <span>UTR: <strong class="text-emerald-700 select-all">${order.utrNumber || order.upiUtr}</strong></span>
              </div>
            ` : ''}
            ${order.paymentStatus !== 'Paid' ? `
              <button 
                type="button" 
                onclick="approveUpiPayment('${order.orderId}')" 
                class="mt-1 px-2.5 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
                title="Verify UTR and approve payment"
              >
                <span>✓ Approve Payment</span>
              </button>
            ` : ''}
          </div>
        </td>
        <td class="py-2.5 px-4">
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${statusBadge}">
            ${order.orderStatus || 'Pending'}
          </span>
          <div class="mt-1">
            ${order.courierPartner && !order.courierPartner.includes('Waiting') ? `
              <p class="text-[10px] text-emerald-700 font-mono font-bold truncate max-w-[160px]">📦 ${order.courierPartner}</p>
              <p class="text-[9px] text-slate-500 font-mono">AWB: <strong class="text-slate-900 select-all">${order.trackingNumber || ''}</strong></p>
            ` : `
              <p class="text-[10px] text-amber-700 font-mono">⏳ Waiting for Pickup</p>
              <p class="text-[9px] text-slate-400 font-mono">AWB pending dispatch</p>
            `}
          </div>
        </td>
        <td class="py-2.5 px-4 text-right">
          <div class="flex items-center justify-end gap-1.5 flex-wrap">
            <button 
              type="button" 
              onclick="openDispatchModal('${order.orderId}')" 
              class="px-2 py-1 rounded-lg bg-orange-50 hover:bg-orange-100 text-[#ff461e] border border-orange-200 text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
              title="Assign Courier Partner & AWB Tracking"
            >
              <span>📦 Dispatch</span>
            </button>
            <button 
              type="button" 
              onclick="sendWhatsAppTracking('${order.orderId}')" 
              class="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#25D366] border border-emerald-200 text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
              title="Send WhatsApp update to customer"
            >
              <span>📲 WhatsApp</span>
            </button>
            <button 
              type="button" 
              onclick="triggerOrderSMS('${order.orderId}')" 
              class="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
              title="Send direct SMS alert to customer"
            >
              <span>📩 SMS</span>
            </button>
            <button 
              type="button" 
              onclick="openInvoiceModal('${order.orderId}')" 
              class="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
              title="Print Official GST Invoice & Shipping Challan"
            >
              <span>🖨️ Bill / Challan</span>
            </button>
            <select 
              onchange="updateShoeOrderStatus('${order.orderId}', this.value)" 
              class="bg-white border border-slate-200 text-xs font-semibold text-slate-800 px-2 py-1 rounded-lg focus:outline-none focus:border-[#ff461e] cursor-pointer"
            >
              <option value="Pending" ${order.orderStatus === 'Pending' ? 'selected' : ''}>Pending</option>
              <option value="Processing" ${order.orderStatus === 'Processing' ? 'selected' : ''}>Processing</option>
              <option value="Shipped" ${order.orderStatus === 'Shipped' ? 'selected' : ''}>Shipped</option>
              <option value="Delivered" ${order.orderStatus === 'Delivered' ? 'selected' : ''}>Delivered</option>
              <option value="Cancelled" ${order.orderStatus === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
            </select>
          </div>
        </td>
      </tr>
    `;
  }).join('');
};

// Invoice Modal Handlers
window.activeInvoiceOrder = null;

window.openInvoiceModal = async function(orderId) {
  let orders = inventoryManager.getOrders();
  if ((!orders || orders.length === 0) && inventoryManager.getAdminToken()) {
    try {
      orders = await inventoryManager.fetchOrders();
    } catch(e) {}
  }
  let order = (orders || []).find(o => o.orderId === orderId);
  if (!order && orders && orders.length > 0) order = orders[0];
  if (!order) {
    order = {
      orderId: orderId && orderId !== 'preview' ? orderId : 'RAB-98214',
      createdAt: new Date().toISOString(),
      customerName: 'Aarav Sharma',
      phone: '9828682274',
      address: 'Plot 14, Royal Palm Residency, Vaishali Nagar',
      city: 'Jaipur',
      pincode: '302021',
      paymentMethod: 'UPI / Online',
      paymentStatus: 'Paid',
      courierPartner: 'BlueDart Express',
      trackingNumber: 'BLR9821402IN',
      estimatedDeliveryDate: '18 Sep 2026',
      items: [
        {
          name: 'Rabbit NitroFly Velocity Runner',
          size: 'UK 9',
          color: 'Volcanic Crimson',
          quantity: 1,
          price: 2499
        }
      ],
      totalAmount: 2499
    };
  }

  window.activeInvoiceOrder = order;

  const tc = document.getElementById('toast-container');
  if (tc) tc.innerHTML = '';

  const badgeEl = document.getElementById('invoice-modal-order-badge');
  if (badgeEl) badgeEl.textContent = `• #${order.orderId}`;

  const content = document.getElementById('invoice-print-content');
  if (!content) return;

  const settings = inventoryManager.getSettings();

  const dateStr = new Date(order.createdAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const isPaid = order.paymentStatus === 'Paid';
  const subtotal = (order.items || []).reduce((sum, it) => sum + (Number(it.price) * (it.quantity || 1)), 0);
  const discount = Number(order.discountAmount || 0);
  const total = Number(order.totalAmount || subtotal);

  // Real GST calculation (18% inclusive)
  const taxableTotal = Math.round(total / 1.18);
  const totalGst = total - taxableTotal;
  const cgst = Math.round(totalGst / 2);
  const sgst = totalGst - cgst;

  const invoiceNo = `RABBIT/INV/2026/${order.orderId.replace(/\D/g, '').slice(-4) || '1088'}`;
  const gstin = settings.gstin || '08KMFPS6415G1ZM';
  const instagram = settings.instagram || 'rabbitshoes_06';

  content.innerHTML = `
    <!-- Top Company & Invoice Header -->
    <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b-2 border-gray-900">
      <div class="flex items-center gap-3">
        <div class="w-14 h-14 sm:w-16 sm:h-16 rounded-xl border border-gray-200 bg-white p-1 shadow-xs shrink-0 flex items-center justify-center">
          <img src="/images/rabbit-logo.png" alt="Rabbit Logo" class="w-full h-full object-contain" />
        </div>
        <div>
          <h2 class="text-base sm:text-xl font-black font-display text-gray-900 tracking-tight uppercase leading-tight">${settings.storeName || 'Rabbit Activewear & Footwear'}</h2>
          <div class="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span class="text-[9px] font-mono text-emerald-700 font-bold uppercase tracking-wider bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">GST REGISTERED ENTERPRISE</span>
            <span class="text-[9px] font-mono text-pink-700 font-bold tracking-wider bg-pink-50 px-1.5 py-0.5 rounded border border-pink-200">@${instagram}</span>
          </div>
          <p class="text-[10px] text-gray-600 mt-1 font-medium leading-relaxed max-w-md">${settings.warehouseAddress || 'Plot 42, Rabbit Fulfillment Park, Industrial Area, Jaipur, Rajasthan - 302013'}</p>
          <p class="text-[10px] text-gray-700 font-mono mt-0.5"><strong>GSTIN:</strong> ${gstin} • <strong>State Code:</strong> 08 (Rajasthan) • <strong>HSN:</strong> 64041100</p>
          <p class="text-[10px] text-gray-600"><strong>Helpline:</strong> +91 ${settings.supportPhone || '9828682274'} • <strong>Email:</strong> ${settings.supportEmail || 'support@rabbitshoes.in'}</p>
        </div>
      </div>

      <div class="sm:text-right font-mono border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-100 flex flex-col items-start sm:items-end">
        <span class="text-[10px] sm:text-[11px] font-black uppercase text-[#ff461e] bg-orange-50 px-2 py-0.5 rounded border border-orange-200 inline-block mb-1">TAX INVOICE & DISPATCH CHALLAN</span>
        <span class="text-xs sm:text-sm font-black text-gray-900 block">${invoiceNo}</span>
        <span class="text-[10px] text-gray-600 block">Order Ref: <strong class="text-gray-900">#${order.orderId}</strong></span>
        <span class="text-[10px] text-gray-500 block">Date: ${dateStr}</span>
        <span class="inline-block mt-1 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${isPaid ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-800 border border-amber-300'}">
          ${order.paymentMethod || 'COD'} • ${order.paymentStatus || 'Pending'}
        </span>
      </div>
    </div>

    <!-- Shipping & Courier Dispatch Bar -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-50 p-3 sm:p-4 rounded-xl border border-gray-200 text-xs">
      <div class="space-y-1">
        <span class="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-wider block">Billed & Shipped To:</span>
        <h4 class="font-bold text-gray-900 text-sm">${order.customerName || 'Customer'}</h4>
        <p class="text-gray-700 leading-snug">${order.address || 'Address on file'}</p>
        <p class="text-gray-700">${order.city || ''} ${order.pincode ? '- ' + order.pincode : ''}</p>
        <p class="text-gray-900 font-mono font-bold pt-0.5">📞 +91 ${order.phone || ''}</p>
        <p class="text-[10px] text-gray-500">Place of Supply: ${order.city || 'Rajasthan'} (${(order.pincode || '').slice(0, 2) || '08'})</p>
      </div>

      <div class="sm:border-l sm:border-gray-200 sm:pl-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-200 space-y-1">
        <span class="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-wider block">Logistics & Dispatch Label:</span>
        <div class="space-y-1 font-mono text-[11px]">
          <div><span class="text-gray-500">Carrier / Transport:</span> <strong class="text-gray-900">${order.courierPartner || 'Waiting for Pickup Partner'}</strong></div>
          <div><span class="text-gray-500">AWB Tracking No:</span> <strong class="text-[#ff461e] font-black select-all">${order.trackingNumber && order.trackingNumber !== 'Pending Dispatch' ? order.trackingNumber : 'Pending Dispatch'}</strong></div>
          <div><span class="text-gray-500">Estimated Delivery:</span> <span class="text-gray-800 font-semibold">${order.estimatedDeliveryDate || '3-4 Business Days'}</span></div>
          ${order.utrNumber ? `<div><span class="text-gray-500">UPI Ref / UTR:</span> <strong class="text-emerald-700">${order.utrNumber}</strong></div>` : ''}
        </div>
        <!-- Barcode representation -->
        <div class="mt-2 pt-2 border-t border-gray-200 text-center">
          <svg class="h-6 sm:h-7 w-44 max-w-full mx-auto" viewBox="0 0 100 20" preserveAspectRatio="none">
            <rect x="0" y="0" width="2" height="20" fill="#111" />
            <rect x="4" y="0" width="1" height="20" fill="#111" />
            <rect x="7" y="0" width="3" height="20" fill="#111" />
            <rect x="12" y="0" width="1" height="20" fill="#111" />
            <rect x="15" y="0" width="2" height="20" fill="#111" />
            <rect x="19" y="0" width="4" height="20" fill="#111" />
            <rect x="25" y="0" width="1" height="20" fill="#111" />
            <rect x="28" y="0" width="3" height="20" fill="#111" />
            <rect x="33" y="0" width="2" height="20" fill="#111" />
            <rect x="37" y="0" width="1" height="20" fill="#111" />
            <rect x="40" y="0" width="3" height="20" fill="#111" />
            <rect x="45" y="0" width="2" height="20" fill="#111" />
            <rect x="49" y="0" width="4" height="20" fill="#111" />
            <rect x="55" y="0" width="1" height="20" fill="#111" />
            <rect x="58" y="0" width="2" height="20" fill="#111" />
            <rect x="62" y="0" width="3" height="20" fill="#111" />
            <rect x="67" y="0" width="1" height="20" fill="#111" />
            <rect x="70" y="0" width="4" height="20" fill="#111" />
            <rect x="76" y="0" width="2" height="20" fill="#111" />
            <rect x="80" y="0" width="1" height="20" fill="#111" />
            <rect x="83" y="0" width="3" height="20" fill="#111" />
            <rect x="88" y="0" width="2" height="20" fill="#111" />
            <rect x="92" y="0" width="3" height="20" fill="#111" />
            <rect x="97" y="0" width="2" height="20" fill="#111" />
          </svg>
          <span class="text-[9px] font-mono text-gray-500 uppercase tracking-widest block select-all">${order.trackingNumber && order.trackingNumber !== 'Pending Dispatch' ? order.trackingNumber : order.orderId}</span>
        </div>
      </div>
    </div>

    <!-- Items & Tax Breakdown Table -->
    <div class="space-y-1">
      <div class="border border-gray-200 rounded-xl overflow-x-auto bg-white shadow-xs">
        <table class="w-full text-left text-xs min-w-[540px]">
          <thead class="bg-gray-100 text-gray-700 font-mono text-[10px] uppercase border-b border-gray-200">
            <tr>
              <th class="py-2.5 px-3"># Item Description</th>
              <th class="py-2.5 px-2 text-center">HSN</th>
              <th class="py-2.5 px-2 text-center">Size/Color</th>
              <th class="py-2.5 px-2 text-center">Qty</th>
              <th class="py-2.5 px-2 text-right">Taxable Val</th>
              <th class="py-2.5 px-2 text-right">CGST (9%)</th>
              <th class="py-2.5 px-2 text-right">SGST (9%)</th>
              <th class="py-2.5 px-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 font-mono text-[11px]">
            ${(order.items || []).map((it, idx) => {
              const itemGross = Number(it.price) * (it.quantity || 1);
              const itemTaxable = Math.round(itemGross / 1.18);
              const itemGst = itemGross - itemTaxable;
              const itemCgst = Math.round(itemGst / 2);
              const itemSgst = itemGst - itemCgst;
              return `
                <tr>
                  <td class="py-2.5 px-3">
                    <span class="font-sans font-bold text-gray-900 block">${idx + 1}. ${it.name}</span>
                    <span class="text-[10px] text-gray-500">Engineered Sole • Premium Performance</span>
                  </td>
                  <td class="py-2.5 px-2 text-center text-gray-600">64041100</td>
                  <td class="py-2.5 px-2 text-center font-bold text-[#ff461e]">
                    UK ${it.size || 8} • ${(it.color && it.color.name) || 'Standard'}
                  </td>
                  <td class="py-2.5 px-2 text-center font-bold">${it.quantity || 1}</td>
                  <td class="py-2.5 px-2 text-right text-gray-700">₹${itemTaxable.toLocaleString('en-IN')}</td>
                  <td class="py-2.5 px-2 text-right text-gray-600">₹${itemCgst.toLocaleString('en-IN')}</td>
                  <td class="py-2.5 px-2 text-right text-gray-600">₹${itemSgst.toLocaleString('en-IN')}</td>
                  <td class="py-2.5 px-3 text-right font-black text-gray-900">₹${itemGross.toLocaleString('en-IN')}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      <p class="sm:hidden text-[10px] text-gray-400 text-right font-mono">← Scroll table horizontally to view GST breakdown →</p>
    </div>

    <!-- Financial Total Breakdown & Tax Summary -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start pt-1">
      <div class="space-y-2 text-[10px] order-2 sm:order-1">
        <div class="border border-gray-200 rounded-lg p-2.5 bg-gray-50 text-gray-600 space-y-1">
          <p class="font-bold text-gray-900 text-[11px]">Declaration & Terms of Sale:</p>
          <p>1. Certified that the particulars given above are true and correct.</p>
          <p>2. Goods once sold are eligible for 7 days hassle-free exchange & returns.</p>
          <p>3. This is a computer generated invoice valid under the GST Act 2017.</p>
        </div>
        <div class="flex items-center justify-between px-2 text-gray-500 font-mono text-[9px] sm:text-[10px]">
          <span>Quality Checked: <strong class="text-emerald-700">PASS (100%)</strong></span>
          <span>Security Pack: <strong class="text-emerald-700">Tamper Evident</strong></span>
        </div>
      </div>

      <div class="space-y-1 font-mono text-xs text-right bg-gray-50/70 p-3 rounded-xl border border-gray-200 order-1 sm:order-2">
        <div class="flex justify-between text-gray-600">
          <span>Taxable Amount:</span>
          <span>₹${taxableTotal.toLocaleString('en-IN')}</span>
        </div>
        <div class="flex justify-between text-gray-600">
          <span>CGST (9%):</span>
          <span>₹${cgst.toLocaleString('en-IN')}</span>
        </div>
        <div class="flex justify-between text-gray-600">
          <span>SGST (9%):</span>
          <span>₹${sgst.toLocaleString('en-IN')}</span>
        </div>
        ${discount > 0 ? `
          <div class="flex justify-between text-emerald-600 font-bold">
            <span>Special Discount:</span>
            <span>- ₹${discount.toLocaleString('en-IN')}</span>
          </div>
        ` : ''}
        <div class="flex justify-between text-gray-600">
          <span>Delivery / Freight:</span>
          <span class="text-emerald-700 font-bold">FREE (₹0.00)</span>
        </div>
        <div class="flex justify-between pt-2 border-t-2 border-gray-900 text-sm font-black text-gray-900">
          <span>Net Total (Inclusive of GST):</span>
          <span class="text-[#ff461e]">₹${total.toLocaleString('en-IN')}</span>
        </div>
        <div class="pt-2 text-[10px] text-gray-500 font-sans flex items-end justify-between">
          <div class="flex items-center gap-1.5 border border-dashed border-gray-300 rounded-lg px-2 py-1 bg-white">
            <img src="/images/rabbit-logo.png" alt="Official Stamp" class="h-7 w-7 object-contain" />
            <span class="text-[9px] font-mono text-gray-500 font-bold uppercase">Official Verified Seal</span>
          </div>
          <div class="text-right">
            <span>For <strong>${settings.storeName || 'Rabbit Footwear Co.'}</strong></span>
            <div class="h-4 flex items-end justify-end">
              <span class="font-mono text-[9px] text-gray-400">Authorized Signatory</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('invoice-modal').classList.remove('hidden');
  document.getElementById('invoice-modal-backdrop').classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
};

window.closeInvoiceModal = function() {
  const modal = document.getElementById('invoice-modal');
  const backdrop = document.getElementById('invoice-modal-backdrop');
  if (modal) modal.classList.add('hidden');
  if (backdrop) backdrop.classList.add('hidden');
};

// 📥 Download Current Invoice as PDF
window.downloadCurrentInvoicePDF = function() {
  const order = window.activeInvoiceOrder;
  if (!order) {
    showAdminToast('No active invoice to download.', 'warning');
    return;
  }
  const element = document.getElementById('invoice-print-content');
  const btn = document.getElementById('btn-invoice-download');
  const originalText = btn ? btn.innerHTML : '';
  if (btn) {
    btn.innerHTML = '<span>⏳ Saving PDF...</span>';
    btn.disabled = true;
  }

  const opt = {
    margin: [8, 8, 8, 8],
    filename: `Rabbit_Shoes_Invoice_${order.orderId}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  if (typeof html2pdf !== 'undefined') {
    html2pdf().set(opt).from(element).save().then(() => {
      showAdminToast(`Invoice PDF #${order.orderId} downloaded successfully!`, 'success');
      if (btn) {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
    }).catch(err => {
      console.error(err);
      window.print();
      if (btn) {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
    });
  } else {
    window.print();
    if (btn) {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  }
};

// 📲 Share Current Invoice on WhatsApp
window.shareCurrentInvoiceWhatsApp = function(orderId) {
  let order = window.activeInvoiceOrder;
  if (orderId) {
    const orders = inventoryManager.getOrders();
    order = (orders || []).find(o => o.orderId === orderId) || order;
  }
  if (!order) {
    showAdminToast('Order details not found for WhatsApp share.', 'error');
    return;
  }

  const phone = (order.phone || '').replace(/\D/g, '').slice(-10);
  if (!phone || phone.length !== 10) {
    showAdminToast('Customer does not have a valid 10-digit phone number.', 'error');
    return;
  }

  const settings = inventoryManager.getSettings();
  const subtotal = (order.items || []).reduce((sum, it) => sum + (Number(it.price) * (it.quantity || 1)), 0);
  const total = Number(order.totalAmount || subtotal);
  const taxableTotal = Math.round(total / 1.18);
  const totalGst = total - taxableTotal;
  const dateStr = new Date(order.createdAt || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const trackingUrl = `https://shoes.137.23.47.199.sslip.io/?track=${order.orderId}&phone=${phone}`;
  const billUrl = `https://shoes.137.23.47.199.sslip.io/invoice.html?id=${order.orderId}&phone=${phone}`;

  const itemsText = (order.items || []).map((it, idx) => 
    `  ${idx + 1}. *${it.name}*\n     Size: UK ${it.size || 8} | Qty: ${it.quantity || 1} | Price: ₹${Number(it.price).toLocaleString('en-IN')}`
  ).join('\n');

  const waMessage = 
`🐰 *RABBIT ACTIVEWEAR & FOOTWEAR* 👟
*OFFICIAL TAX INVOICE & DISPATCH BILL*
━━━━━━━━━━━━━━━━━━━━━━
👤 *Customer:* ${order.customerName || 'Customer'}
📱 *Mobile:* +91 ${phone}
📦 *Order ID:* #${order.orderId}
📅 *Date:* ${dateStr}
📍 *Delivery Address:* ${order.address || ''}, ${order.city || ''} - ${order.pincode || ''}

🛍️ *ORDERED ITEMS:*
${itemsText}

💰 *TAX INVOICE BREAKDOWN:*
• Taxable Value: ₹${taxableTotal.toLocaleString('en-IN')}
• GST (CGST 9% + SGST 9%): ₹${totalGst.toLocaleString('en-IN')}
• Shipping / Freight: FREE (₹0)
${order.discountAmount ? `• Special Discount: - ₹${Number(order.discountAmount).toLocaleString('en-IN')}\n` : ''}💵 *NET TOTAL:* ₹${total.toLocaleString('en-IN')}
💳 *Payment:* ${order.paymentMethod || 'COD'} (${order.paymentStatus || 'Pending'})

🚚 *DELIVERY & TRACKING:*
• Courier: ${order.courierPartner || 'Assigned on Dispatch'}
• AWB Tracking: ${order.trackingNumber && order.trackingNumber !== 'Pending Dispatch' ? order.trackingNumber : 'In Processing'}
• Est. Delivery: ${order.estimatedDeliveryDate || '3-4 Business Days'}

🔗 *Live Order Tracking:*
${trackingUrl}

📄 *View & Download Official PDF Bill:*
${billUrl}
━━━━━━━━━━━━━━━━━━━━━━
📞 Helpline: +91 ${settings.supportPhone || '9828682274'}
Thank you for shopping with Rabbit Activewear! 🙏`;

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const waUrl = `https://wa.me/91${phone}?text=${encodeURIComponent(waMessage)}`;
  if (isMobile) {
    window.location.href = waUrl;
  } else {
    window.open(waUrl, '_blank');
  }
  showAdminToast(`Opening WhatsApp for +91-${phone}...`, 'success');
};

// 💬 Send Current Invoice via SMS (Native Device App + Server Gateway)
window.sendCurrentInvoiceSMS = async function(orderId) {
  let order = window.activeInvoiceOrder;
  if (orderId) {
    const orders = inventoryManager.getOrders();
    order = (orders || []).find(o => o.orderId === orderId) || order;
  }
  if (!order) {
    showAdminToast('Order details not found for SMS.', 'error');
    return;
  }

  const phone = (order.phone || '').replace(/\D/g, '').slice(-10);
  if (!phone || phone.length !== 10) {
    showAdminToast('Customer does not have a valid 10-digit phone number.', 'error');
    return;
  }

  const courier = order.courierPartner || 'Delivery Partner';
  const awb = order.trackingNumber && order.trackingNumber !== 'Pending Dispatch' ? order.trackingNumber : 'Processing';
  const trackingUrl = `https://shoes.137.23.47.199.sslip.io/?track=${order.orderId}&phone=${phone}`;
  const smsText = `[Rabbit Shoes] Namaste ${order.customerName || 'Customer'}! Order #${order.orderId} (₹${order.totalAmount}) dispatched via ${courier} (AWB: ${awb}). Track live & view bill: ${trackingUrl}`;

  // 1. Native SMS redirect for mobile devices
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile) {
    window.location.href = `sms:+91${phone}?&body=${encodeURIComponent(smsText)}`;
  }

  // 2. Dispatch via backend server to record in SMS logs
  try {
    const token = inventoryManager.getAdminToken();
    const res = await fetch('/api/admin/send-sms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ orderId: order.orderId, type: 'ORDER_DISPATCHED', manual: true })
    });
    const data = await res.json();
    if (res.ok) {
      showAdminToast(`SMS alert recorded & dispatched for +91-${phone}!`, 'success');
    } else {
      throw new Error(data.error || 'Failed to send SMS');
    }
  } catch(err) {
    if (!isMobile) {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(smsText);
        showAdminToast(`SMS text copied to clipboard! (Mobile: ${phone})`, 'info');
      } else {
        showAdminToast(`SMS Error: ${err.message}`, 'error');
      }
    }
  }
};

window.closeInvoiceModal = function() {
  const modal = document.getElementById('invoice-modal');
  const backdrop = document.getElementById('invoice-modal-backdrop');
  if (modal) modal.classList.add('hidden');
  if (backdrop) backdrop.classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
};

window.printOrderInvoice = window.openInvoiceModal;

// Dispatch Modal Handlers
window.openDispatchModal = async function(orderId) {
  let orders = inventoryManager.getOrders();
  if ((!orders || orders.length === 0) && inventoryManager.getAdminToken()) {
    try {
      orders = await inventoryManager.fetchOrders();
    } catch(e) {}
  }
  const order = (orders || []).find(o => o.orderId === orderId);
  if (!order) return;

  document.getElementById('dispatch-order-id').value = order.orderId;
  document.getElementById('dispatch-order-id-label').textContent = order.orderId;
  document.getElementById('dispatch-customer-name').textContent = order.customerName || 'Customer';
  document.getElementById('dispatch-customer-phone').textContent = order.phone || '';
  document.getElementById('dispatch-customer-address').textContent = `${order.address || ''}, ${order.city || ''} ${order.pincode || ''}`;

  const courierSelect = document.getElementById('dispatch-courier-partner');
  const customWrapper = document.getElementById('dispatch-custom-courier-wrapper');
  const customInput = document.getElementById('dispatch-custom-courier');
  const trackingInput = document.getElementById('dispatch-tracking-number');
  const dateInput = document.getElementById('dispatch-delivery-date');

  const standardCouriers = ["Ekart Logistics", "Delhivery Express", "BlueDart Air Express", "DTDC Express", "India Post (Speed Post)", "Shadowfax", "XpressBees", "Local Courier / Transport"];
  if (order.courierPartner && standardCouriers.includes(order.courierPartner)) {
    courierSelect.value = order.courierPartner;
    customWrapper.classList.add('hidden');
  } else if (order.courierPartner && !order.courierPartner.includes('Waiting')) {
    courierSelect.value = 'Other';
    customWrapper.classList.remove('hidden');
    customInput.value = order.courierPartner;
  } else {
    courierSelect.value = 'Ekart Logistics';
    customWrapper.classList.add('hidden');
  }

  trackingInput.value = (order.trackingNumber && order.trackingNumber !== 'Pending Dispatch') ? order.trackingNumber : '';
  dateInput.value = order.estimatedDeliveryDate || '3-4 Business Days';

  document.getElementById('dispatch-modal').classList.remove('hidden');
  document.getElementById('dispatch-modal-backdrop').classList.remove('hidden');
};

window.closeDispatchModal = function() {
  const modal = document.getElementById('dispatch-modal');
  const backdrop = document.getElementById('dispatch-modal-backdrop');
  if (modal) modal.classList.add('hidden');
  if (backdrop) backdrop.classList.add('hidden');
};

window.handleCourierChange = function(val) {
  const customWrapper = document.getElementById('dispatch-custom-courier-wrapper');
  if (val === 'Other') {
    customWrapper.classList.remove('hidden');
  } else {
    customWrapper.classList.add('hidden');
  }
};

window.submitDispatchOrder = async function(event) {
  event.preventDefault();
  const orderId = document.getElementById('dispatch-order-id').value;
  const courierVal = document.getElementById('dispatch-courier-partner').value;
  const customVal = document.getElementById('dispatch-custom-courier').value.trim();
  const courierPartner = (courierVal === 'Other' && customVal) ? customVal : courierVal;
  const trackingNumber = document.getElementById('dispatch-tracking-number').value.trim();
  const estimatedDeliveryDate = document.getElementById('dispatch-delivery-date').value.trim() || '3-4 Business Days';

  if (!trackingNumber) {
    showAdminToast('Please enter an AWB / Tracking number', 'error');
    return;
  }

  try {
    await inventoryManager.updateOrderStatus(orderId, 'Shipped', {
      courierPartner,
      trackingNumber,
      estimatedDeliveryDate
    });
    showAdminToast(`Order #${orderId} dispatched via ${courierPartner} (AWB: ${trackingNumber})!`, 'success');
    closeDispatchModal();
    renderDashboardStats();
    renderOrdersTable();
  } catch (err) {
    showAdminToast(`Failed to dispatch order: ${err.message}`, 'error');
  }
};

window.sendWhatsAppTracking = function(orderId) {
  // Directly trigger the full professional WhatsApp Invoice & Dispatch summary
  window.shareCurrentInvoiceWhatsApp(orderId);
};

// Manually trigger SMS alert to customer (Native SIM App + Backend API Dispatch)
window.triggerOrderSMS = async function(orderId) {
  const orders = inventoryManager.getOrders();
  const order = (orders || []).find(o => o.orderId === orderId);
  if (!order) {
    showAdminToast('Order not found.', 'error');
    return;
  }

  const phone = (order.phone || '').replace(/\D/g, '').slice(-10);
  if (!phone || phone.length !== 10) {
    showAdminToast('Customer does not have a valid 10-digit phone number.', 'error');
    return;
  }

  const courier = order.courierPartner || 'Delivery Partner';
  const awb = order.trackingNumber && order.trackingNumber !== 'Pending Dispatch' ? order.trackingNumber : 'Processing';
  const trackingUrl = `https://shoes.137.23.47.199.sslip.io/?track=${order.orderId}&phone=${phone}`;
  const smsText = `[Rabbit Shoes] Namaste ${order.customerName || 'Customer'}! Your order #${order.orderId} (₹${order.totalAmount}) is dispatched via ${courier} (AWB: ${awb}). Track live & view bill: ${trackingUrl}`;

  // 1. Native SMS redirect for smartphone users (direct SIM messaging)
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile) {
    window.location.href = `sms:+91${phone}?&body=${encodeURIComponent(smsText)}`;
  }

  // 2. Server API Gateway Dispatch
  try {
    const token = inventoryManager.getAdminToken();
    const res = await fetch('/api/admin/send-sms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ orderId, type: 'ORDER_DISPATCHED', manual: true })
    });
    const data = await res.json();
    if (res.ok) {
      showAdminToast(`SMS alert recorded & dispatched for +91-${phone}!`, 'success');
    } else {
      throw new Error(data.error || 'Failed to send SMS');
    }
  } catch (err) {
    if (!isMobile) {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(smsText);
        showAdminToast(`SMS message copied to clipboard! (+91-${phone})`, 'info');
      } else {
        showAdminToast(`SMS error: ${err.message}`, 'error');
      }
    }
  }
};

// Quick Approve UPI Payment
window.approveUpiPayment = async function(orderId) {
  try {
    await inventoryManager.updateOrderStatus(orderId, 'Processing', {
      paymentStatus: 'Paid'
    });
    showAdminToast(`Payment approved for Order #${orderId}! Moved to Processing.`, 'success');
    renderDashboardStats();
    renderOrdersTable();
  } catch (err) {
    showAdminToast(`Approval failed: ${err.message}`, 'error');
  }
};

// Render & Populate Settings & Gateways Tab
window.loadAdminSettingsData = async function() {
  try {
    let settings = await inventoryManager.adminFetchSettings();
    window.adminCachedSettings = settings;
    populateSettingsForm(settings);
    showAdminToast('Settings loaded live from server!', 'success');
  } catch (err) {
    const fallback = inventoryManager.getSettings();
    populateSettingsForm(fallback);
  }
};

window.renderSettingsTab = function() {
  if (window.adminCachedSettings) {
    populateSettingsForm(window.adminCachedSettings);
  } else {
    loadAdminSettingsData();
  }
};

function populateSettingsForm(settings) {
  if (!settings) return;
  
  // Card 1: Store Profile
  const storeNameEl = document.getElementById('setting-store-name');
  const supportWaEl = document.getElementById('setting-support-whatsapp');
  const supportPhoneEl = document.getElementById('setting-support-phone');
  const supportEmailEl = document.getElementById('setting-support-email');
  const gstinEl = document.getElementById('setting-gstin');
  const instagramEl = document.getElementById('setting-instagram');
  const warehouseEl = document.getElementById('setting-warehouse-address');

  if (storeNameEl) storeNameEl.value = settings.storeName || 'Rabbit Activewear & Footwear';
  if (supportWaEl) supportWaEl.value = settings.supportWhatsApp || '9828682274';
  if (supportPhoneEl) supportPhoneEl.value = settings.supportPhone || '9828682274';
  if (supportEmailEl) supportEmailEl.value = settings.supportEmail || 'support@rabbitshoes.in';
  if (gstinEl) gstinEl.value = settings.gstin || '08KMFPS6415G1ZM';
  if (instagramEl) instagramEl.value = settings.instagram || 'rabbitshoes_06';
  if (warehouseEl) warehouseEl.value = settings.warehouseAddress || 'Plot 42, Rabbit Fulfillment Park, Industrial Area, Jaipur, Rajasthan - 302013';

  // Card 2: UPI Gateway
  const upiIdEl = document.getElementById('setting-upi-id');
  const upiNameEl = document.getElementById('setting-upi-name');
  if (upiIdEl) upiIdEl.value = settings.upiId || 'rabbitshoes.official@okaxis';
  if (upiNameEl) upiNameEl.value = settings.upiMerchantName || 'Rabbit Shoes Flagship Store';

  // Card 3: Razorpay Gateway
  const rzpEnabledEl = document.getElementById('setting-razorpay-enabled');
  const rzpKeyEl = document.getElementById('setting-razorpay-key-id');
  const rzpSecEl = document.getElementById('setting-razorpay-key-secret');
  if (rzpEnabledEl) rzpEnabledEl.checked = settings.razorpayEnabled !== false;
  if (rzpKeyEl) rzpKeyEl.value = settings.razorpayKeyId || 'rzp_test_RABBIT_SHOES_OFFICIAL';
  if (rzpSecEl) rzpSecEl.value = settings.razorpayKeySecret || 'sec_test_rabbit_secret_2026';

  // Card 4: SMS Gateway
  const smsGwEl = document.getElementById('setting-sms-gateway');
  const smsKeyEl = document.getElementById('setting-sms-api-key');
  const smsSenderEl = document.getElementById('setting-sms-sender-id');
  const smsAutoOrderEl = document.getElementById('setting-auto-sms-order');
  const smsAutoDispatchEl = document.getElementById('setting-auto-sms-dispatch');

  if (smsGwEl) smsGwEl.value = settings.smsGateway || 'Fast2SMS';
  if (smsKeyEl) smsKeyEl.value = settings.smsApiKey || 'FAST2SMS_TEST_API_KEY_2026';
  if (smsSenderEl) smsSenderEl.value = settings.smsSenderId || 'RABBIT';
  if (smsAutoOrderEl) smsAutoOrderEl.checked = settings.autoSmsOnOrder !== false;
  if (smsAutoDispatchEl) smsAutoDispatchEl.checked = settings.autoSmsOnDispatch !== false;

  // Card 5: Discounts
  const flashActiveEl = document.getElementById('setting-flash-sale-active');
  const discountEl = document.getElementById('setting-storewide-discount');
  const bannerEl = document.getElementById('setting-flash-sale-banner');
  if (flashActiveEl) flashActiveEl.checked = !!settings.flashSaleActive;
  if (discountEl) discountEl.value = settings.storewideDiscount || 0;
  if (bannerEl) bannerEl.value = settings.flashSaleBanner || '🔥 FLASH SALE: Flat 15% OFF on all sneakers!';
}

window.saveStoreProfile = async function() {
  const storeName = (document.getElementById('setting-store-name')?.value || '').trim();
  const supportWhatsApp = (document.getElementById('setting-support-whatsapp')?.value || '').replace(/\D/g, '').slice(-10);
  const supportPhone = (document.getElementById('setting-support-phone')?.value || '').replace(/\D/g, '').slice(-10);
  const supportEmail = (document.getElementById('setting-support-email')?.value || '').trim();
  const gstin = (document.getElementById('setting-gstin')?.value || '').trim().toUpperCase();
  const instagram = (document.getElementById('setting-instagram')?.value || '').trim().replace(/^@/, '');
  const warehouseAddress = (document.getElementById('setting-warehouse-address')?.value || '').trim();

  if (!supportWhatsApp || supportWhatsApp.length !== 10) {
    showAdminToast('Please provide a valid 10-digit WhatsApp number', 'error');
    return;
  }

  try {
    const res = await inventoryManager.adminUpdateSettings({
      storeName: storeName || 'Rabbit Activewear & Footwear',
      supportWhatsApp,
      supportPhone: supportPhone || supportWhatsApp,
      supportEmail: supportEmail || 'support@rabbitshoes.in',
      gstin: gstin || '08KMFPS6415G1ZM',
      instagram: instagram || 'rabbitshoes_06',
      instagramUrl: instagram ? `https://instagram.com/${instagram}` : 'https://instagram.com/rabbitshoes_06',
      warehouseAddress: warehouseAddress || 'Plot 42, Rabbit Fulfillment Park, Industrial Area, Jaipur, Rajasthan - 302013'
    });
    window.adminCachedSettings = res.settings;
    showAdminToast('🏢 Store profile updated! GST: ' + (gstin || '08KMFPS6415G1ZM') + ' & Insta: @' + (instagram || 'rabbitshoes_06'), 'success');
  } catch (err) {
    showAdminToast(`Failed to update store profile: ${err.message}`, 'error');
  }
};

window.saveUPISettings = async function() {
  const upiId = (document.getElementById('setting-upi-id')?.value || '').trim();
  const upiMerchantName = (document.getElementById('setting-upi-name')?.value || '').trim();

  if (!upiId) {
    showAdminToast('Please specify a valid UPI ID (VPA)', 'error');
    return;
  }

  try {
    const res = await inventoryManager.adminUpdateSettings({
      upiId,
      upiMerchantName: upiMerchantName || 'Rabbit Shoes Flagship Store'
    });
    window.adminCachedSettings = res.settings;
    showAdminToast('⚡ UPI Gateway details updated! Customers will scan this VPA at checkout.', 'success');
  } catch (err) {
    showAdminToast(`Failed to update UPI gateway: ${err.message}`, 'error');
  }
};

window.saveRazorpaySettings = async function() {
  const razorpayEnabled = document.getElementById('setting-razorpay-enabled')?.checked ?? true;
  const razorpayKeyId = (document.getElementById('setting-razorpay-key-id')?.value || '').trim();
  const razorpayKeySecret = (document.getElementById('setting-razorpay-key-secret')?.value || '').trim();

  if (razorpayEnabled && !razorpayKeyId) {
    showAdminToast('Please enter your Razorpay Key ID', 'error');
    return;
  }

  try {
    const res = await inventoryManager.adminUpdateSettings({
      razorpayEnabled,
      razorpayKeyId: razorpayKeyId || 'rzp_test_RABBIT_SHOES_OFFICIAL',
      razorpayKeySecret: razorpayKeySecret || 'sec_test_rabbit_secret_2026'
    });
    window.adminCachedSettings = res.settings;
    showAdminToast('💳 Razorpay online gateway keys saved successfully!', 'success');
  } catch (err) {
    showAdminToast(`Failed to update Razorpay keys: ${err.message}`, 'error');
  }
};

window.saveSMSGatewaySettings = async function() {
  const smsGateway = document.getElementById('setting-sms-gateway')?.value || 'Fast2SMS';
  const smsApiKey = (document.getElementById('setting-sms-api-key')?.value || '').trim();
  const smsSenderId = (document.getElementById('setting-sms-sender-id')?.value || 'RABBIT').trim();
  const autoSmsOnOrder = document.getElementById('setting-auto-sms-order')?.checked ?? true;
  const autoSmsOnDispatch = document.getElementById('setting-auto-sms-dispatch')?.checked ?? true;

  try {
    const res = await inventoryManager.adminUpdateSettings({
      smsGateway,
      smsApiKey,
      smsSenderId,
      autoSmsOnOrder,
      autoSmsOnDispatch
    });
    window.adminCachedSettings = res.settings;
    showAdminToast('📩 SMS & WhatsApp Alerts gateway configuration saved!', 'success');
  } catch (err) {
    showAdminToast(`Failed to update SMS gateway: ${err.message}`, 'error');
  }
};

window.sendAdminTestSMS = async function() {
  const phone = (document.getElementById('setting-test-sms-phone')?.value || '').replace(/\D/g, '').slice(-10);
  if (!phone || phone.length !== 10) {
    showAdminToast('Please enter a valid 10-digit mobile number for test', 'error');
    return;
  }
  try {
    const res = await inventoryManager.adminSendTestSMS(phone, 'Owner Test');
    showAdminToast(`✅ Test alert sent to +91 ${phone}! Check SMS tab for log.`, 'success');
    if (window.loadAdminSMSLogs) window.loadAdminSMSLogs();
  } catch (err) {
    showAdminToast(`Test alert failed: ${err.message}`, 'error');
  }
};

// Save & Broadcast Store Discounts
window.saveStoreDiscounts = async function() {
  const flashActiveEl = document.getElementById('setting-flash-sale-active');
  const discountEl = document.getElementById('setting-storewide-discount');
  const bannerEl = document.getElementById('setting-flash-sale-banner');

  const flashSaleActive = flashActiveEl ? flashActiveEl.checked : false;
  const storewideDiscount = discountEl ? Math.max(0, Math.min(90, Number(discountEl.value) || 0)) : 0;
  const flashSaleBanner = bannerEl ? bannerEl.value.trim() : '';

  try {
    const res = await inventoryManager.adminUpdateSettings({
      flashSaleActive,
      storewideDiscount,
      flashSaleBanner
    });
    window.adminCachedSettings = res.settings;
    showAdminToast(
      flashSaleActive 
        ? `🔥 ${storewideDiscount}% Flash Sale active & broadcasted live via SSE!` 
        : 'Discounts updated and broadcasted live to all storefront visitors!',
      'success'
    );
  } catch (err) {
    showAdminToast(`Failed to update discounts: ${err.message}`, 'error');
  }
};

// Order Status Handler
window.updateShoeOrderStatus = async function(orderId, newStatus) {
  await inventoryManager.updateOrderStatus(orderId, newStatus);
  showAdminToast(`Order #${orderId} updated to status "${newStatus}"!`, 'success');
  renderDashboardStats();
  renderOrdersTable();
};

// Stock Toggle
window.toggleShoeStock = async function(productId) {
  await inventoryManager.toggleStock(productId);
  showAdminToast(`Shoe stock availability updated!`, 'info');
  renderDashboardStats();
  renderShoesTable();
};

// Delete Product with robust feedback and sync
window.deleteShoeItem = async function(productId, rawName) {
  const product = (typeof inventoryManager !== 'undefined') ? inventoryManager.getProductById(productId) : null;
  const name = product?.name || rawName || 'this shoe';

  if (!confirm(`Are you sure you want to delete "${name}" from your store catalog?`)) {
    return;
  }

  try {
    showAdminToast(`Deleting "${name}"...`, 'info');
    await inventoryManager.deleteProduct(productId);
    showAdminToast(`"${name}" removed from catalog!`, 'success');
    await renderDashboardStats();
    await renderShoesTable();
  } catch (err) {
    console.error('Delete shoe error:', err);
    showAdminToast(`Failed to delete shoe: ${err.message || 'Server error'}`, 'error');
  }
};

// Canvas Image Compression Helper (Downscales high-res photos to max 1200px width/height, never drops raw image)
function compressImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve(null);
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const img = new Image();
      img.onerror = () => {
        // If image decoding fails in canvas (e.g. specialized mobile format), return original dataUrl directly
        resolve(dataUrl);
      };
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 1200;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } catch (err) {
          resolve(dataUrl);
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

// Render Gallery Preview Grid
function renderGalleryPreview() {
  const grid = document.getElementById('gallery-preview-grid');
  const countBadge = document.getElementById('gallery-count-badge');
  if (!grid) return;

  if (countBadge) {
    countBadge.textContent = `${uploadedGallery.length} Angle${uploadedGallery.length === 1 ? '' : 's'}`;
  }

  if (uploadedGallery.length === 0) {
    grid.innerHTML = `
      <div id="gallery-empty-placeholder" class="col-span-full text-center py-4 text-zinc-500 text-xs">
        <span class="text-2xl block mb-1">📸</span>
        No photos added yet. Select multiple photos below.
      </div>
    `;
    return;
  }

  grid.innerHTML = uploadedGallery.map((imgSrc, idx) => `
    <div class="relative group bg-[#07080c] border ${idx === 0 ? 'border-[#10b981]' : 'border-white/10'} rounded-xl aspect-square p-1.5 flex items-center justify-center overflow-hidden">
      <img src="${imgSrc}" alt="Angle ${idx + 1}" class="w-full h-full object-contain" />
      
      <!-- Cover Badge -->
      ${idx === 0 ? `
        <span class="absolute top-1 left-1 bg-[#10b981] text-black text-[9px] font-mono font-black px-1.5 py-0.5 rounded shadow">
          COVER
        </span>
      ` : `
        <button 
          type="button" 
          onclick="setCoverAngle(${idx})"
          class="absolute top-1 left-1 bg-black/80 hover:bg-[#10b981] hover:text-black text-white text-[9px] font-mono px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        >
          Set Cover
        </button>
      `}

      <!-- Delete Button -->
      <button 
        type="button" 
        onclick="removeAngleImage(${idx})"
        class="absolute top-1 right-1 bg-red-600/80 hover:bg-red-500 text-white rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        title="Remove this photo"
      >
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>
  `).join('');
}

window.setCoverAngle = function(index) {
  if (index > 0 && index < uploadedGallery.length) {
    const selected = uploadedGallery.splice(index, 1)[0];
    uploadedGallery.unshift(selected);
    renderGalleryPreview();
  }
};

window.removeAngleImage = function(index) {
  uploadedGallery.splice(index, 1);
  renderGalleryPreview();
};

window.addImageUrlToGallery = function() {
  const urlInput = document.getElementById('shoe-image-url');
  if (!urlInput) return;
  const val = urlInput.value.trim();
  if (val) {
    uploadedGallery.push(val);
    renderGalleryPreview();
    urlInput.value = '';
    showAdminToast('Photo link added to gallery!', 'info');
  }
};

// Image Files Input Handler (Multiple Files with Auto-Compression)
function initImageHandlers() {
  const filesInput = document.getElementById('shoe-files-input');
  if (filesInput) {
    filesInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      showAdminToast(`Processing ${files.length} photo${files.length > 1 ? 's' : ''}...`, 'info');

      for (const file of files) {
        try {
          const compressed = await compressImage(file);
          if (compressed) {
            uploadedGallery.push(compressed);
          }
        } catch (err) {
          console.error('Failed to compress file:', err);
        }
      }

      renderGalleryPreview();
      filesInput.value = '';
      showAdminToast(`✅ ${uploadedGallery.length} photo angle(s) ready in gallery!`, 'success');
    });
  }
}

// ================= DYNAMIC SHOE COLOR VARIANTS MANAGER =================
let shoeColors = [];

window.renderColorVariants = function() {
  const container = document.getElementById('dynamic-colors-container');
  if (!container) return;

  if (!shoeColors || shoeColors.length === 0) {
    shoeColors = [{ name: 'Core Black', hex: '#111827' }];
  }

  container.innerHTML = shoeColors.map((col, idx) => `
    <div class="color-row bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between gap-3 shadow-2xs" data-color-idx="${idx}">
      <div class="flex items-center gap-2.5 flex-1">
        <div class="flex items-center gap-1.5 flex-shrink-0">
          <input 
            type="color" 
            value="${col.hex || '#111827'}" 
            onchange="updateColorHex(${idx}, this.value)" 
            class="w-8 h-8 rounded-lg border border-slate-200 bg-transparent cursor-pointer"
            title="Choose swatch color"
          />
          <span id="color-hex-label-${idx}" class="font-mono text-[10px] text-slate-600 w-14 font-semibold">${col.hex || '#111827'}</span>
        </div>
        <div class="flex-1">
          <input 
            type="text" 
            value="${col.name || ''}" 
            placeholder="Color Name (e.g. Black / White / Navy Blue)" 
            oninput="updateColorName(${idx}, this.value)" 
            class="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-semibold focus:outline-none focus:border-[#ff461e] focus:bg-white"
          />
        </div>
      </div>
      <div class="flex items-center gap-1 flex-shrink-0">
        ${shoeColors.length > 1 ? `
          <button 
            type="button" 
            onclick="removeColorVariantRow(${idx})" 
            class="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer"
            title="Remove this color"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        ` : `
          <span class="text-[9px] font-mono text-slate-400 px-2 py-1 bg-slate-100 rounded-md font-semibold">1 Color Only</span>
        `}
      </div>
    </div>
  `).join('');
};

window.addColorVariantRow = function() {
  if (shoeColors.length >= 6) {
    showAdminToast('Maximum 6 colors allowed per footwear model.', 'info');
    return;
  }
  const defaultColors = ['#ffffff', '#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea'];
  const nextHex = defaultColors[shoeColors.length % defaultColors.length];
  shoeColors.push({ name: `Color ${shoeColors.length + 1}`, hex: nextHex });
  renderColorVariants();
};

window.removeColorVariantRow = function(idx) {
  if (shoeColors.length <= 1) return;
  shoeColors.splice(idx, 1);
  renderColorVariants();
};

window.updateColorHex = function(idx, val) {
  if (shoeColors[idx]) {
    shoeColors[idx].hex = val;
    const lbl = document.getElementById(`color-hex-label-${idx}`);
    if (lbl) lbl.textContent = val;
  }
};

window.updateColorName = function(idx, val) {
  if (shoeColors[idx]) {
    shoeColors[idx].name = val.trim();
  }
};

// Live Automatic Discount Calculation Badge
window.calculateLiveDiscount = function() {
  const price = Number(document.getElementById('shoe-price')?.value || 0);
  const mrp = Number(document.getElementById('shoe-original-price')?.value || 0);
  const badge = document.getElementById('live-discount-badge');
  const text = document.getElementById('live-discount-text');
  const savings = document.getElementById('live-discount-savings');

  if (mrp > price && price > 0) {
    const pct = Math.round(((mrp - price) / mrp) * 100);
    const saveAmt = mrp - price;
    if (badge) {
      badge.textContent = `${pct}% OFF`;
      badge.className = "bg-[#ff461e] text-white text-[10px] font-mono font-black px-2 py-0.5 rounded shadow-2xs animate-pulse";
    }
    if (text) {
      text.textContent = `🔥 ${pct}% Discount — Website automatically is shoe ko top par rank karegi!`;
      text.className = "font-bold text-emerald-800 text-xs";
    }
    if (savings) savings.textContent = `Customer Savings: ₹${saveAmt.toLocaleString('en-IN')}`;
  } else if (price > 0 && mrp === price) {
    if (badge) {
      badge.textContent = '0% OFF';
      badge.className = "bg-slate-400 text-white text-[10px] font-mono font-black px-2 py-0.5 rounded";
    }
    if (text) {
      text.textContent = 'Standard Pricing (No discount)';
      text.className = "font-semibold text-slate-600 text-xs";
    }
    if (savings) savings.textContent = 'No savings';
  } else {
    if (badge) {
      badge.textContent = '0% OFF';
      badge.className = "bg-slate-400 text-white text-[10px] font-mono font-black px-2 py-0.5 rounded";
    }
    if (text) {
      text.textContent = 'Enter MRP & Selling Price';
      text.className = "font-bold text-slate-700 text-xs";
    }
    if (savings) savings.textContent = 'Savings: ₹0';
  }
};

// Modal Controls
window.openAddShoeModal = function() {
  document.getElementById('modal-form-title').textContent = 'Upload New Shoe';
  document.getElementById('edit-shoe-id').value = '';
  document.getElementById('shoe-form').reset();
  const activeCat = document.getElementById('admin-filter-category')?.value;
  if (activeCat && activeCat !== 'all') {
    document.getElementById('shoe-category').value = activeCat;
  } else {
    document.getElementById('shoe-category').value = 'sneakers';
  }

  // Single default color (can be customized or extra colors added)
  shoeColors = [{ name: 'Black', hex: '#111827' }];
  renderColorVariants();
  calculateLiveDiscount();

  uploadedGallery = [];
  renderGalleryPreview();

  document.getElementById('shoe-modal').classList.remove('hidden');
  document.getElementById('shoe-modal-backdrop').classList.remove('hidden');
};

window.closeAddShoeModal = function() {
  document.getElementById('shoe-modal').classList.add('hidden');
  document.getElementById('shoe-modal-backdrop').classList.add('hidden');
};

window.editProduct = function(productId) {
  const product = inventoryManager.getProducts().find(p => p.id === productId);
  if (!product) return;

  document.getElementById('modal-form-title').textContent = 'Edit Footwear Details';
  document.getElementById('edit-shoe-id').value = product.id;
  document.getElementById('shoe-name').value = product.name;
  document.getElementById('shoe-category').value = product.category || 'sneakers';
  document.getElementById('shoe-tagline').value = product.tagline || '';
  document.getElementById('shoe-price').value = product.price;
  document.getElementById('shoe-original-price').value = product.originalPrice || '';
  document.getElementById('shoe-gender').value = product.gender || 'unisex';
  document.getElementById('shoe-description').value = product.description || '';

  // Load existing colors dynamically
  if (product.colors && Array.isArray(product.colors) && product.colors.length > 0) {
    shoeColors = product.colors.map(c => ({ name: c.name || 'Color', hex: c.hex || '#111827' }));
  } else {
    shoeColors = [{ name: 'Black', hex: '#111827' }];
  }
  renderColorVariants();
  calculateLiveDiscount();

  // Load existing angles
  uploadedGallery = (product.gallery && product.gallery.length > 0) ? [...product.gallery] : [product.image];
  renderGalleryPreview();

  document.getElementById('shoe-modal').classList.remove('hidden');
  document.getElementById('shoe-modal-backdrop').classList.remove('hidden');
};

// Form submission handler
let isShoeSubmitting = false;
window.handleShoeSubmit = async function(e) {
  if (e) e.preventDefault();
  if (isShoeSubmitting) return false;
  isShoeSubmitting = true;

  const form = document.getElementById('shoe-form');
  if (!form) {
    isShoeSubmitting = false;
    return false;
  }

  const submitBtn = document.getElementById('publish-shoe-btn') || form.querySelector('button[type="submit"]');
  const originalBtnHtml = submitBtn ? submitBtn.innerHTML : 'Publish to Storefront';

  const editId = document.getElementById('edit-shoe-id')?.value;
  const name = document.getElementById('shoe-name')?.value.trim();
  const category = document.getElementById('shoe-category')?.value || 'sneakers';
  const tagline = document.getElementById('shoe-tagline')?.value.trim();
  const priceInput = document.getElementById('shoe-price')?.value;
  const price = Number(priceInput);
  const origPriceInput = document.getElementById('shoe-original-price')?.value;
  const originalPrice = origPriceInput ? Number(origPriceInput) : Math.round(price * 1.35);
  const gender = document.getElementById('shoe-gender')?.value || 'unisex';
  const description = document.getElementById('shoe-description')?.value.trim() || '';

  if (!name) {
    showAdminToast('Please enter Shoe Name / Title!', 'error');
    const nameEl = document.getElementById('shoe-name');
    if (nameEl) {
      nameEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      nameEl.focus();
    }
    return false;
  }

  if (!price || isNaN(price) || price <= 0) {
    showAdminToast('Please enter a valid Selling Price!', 'error');
    const priceEl = document.getElementById('shoe-price');
    if (priceEl) {
      priceEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      priceEl.focus();
    }
    return false;
  }

  // Check if an image URL was entered in the box without clicking 'Add'
  const pendingUrl = document.getElementById('shoe-image-url')?.value.trim();
  if (pendingUrl && pendingUrl.startsWith('http')) {
    uploadedGallery.push(pendingUrl);
    document.getElementById('shoe-image-url').value = '';
    renderGalleryPreview();
  }

  // If still no photo uploaded, do not silently add red shoes! Require user to upload or add link.
  if (uploadedGallery.length === 0) {
    showAdminToast('⚠️ Kripya shoe ki photo select karein ya image link dalein!', 'error');
    const galleryEl = document.getElementById('gallery-preview-grid');
    if (galleryEl) {
      galleryEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return false;
  }

  const checkedSizes = [];
  document.querySelectorAll('input[name="sizes"]:checked').forEach(cb => {
    checkedSizes.push(Number(cb.value));
  });

  // Build EXACT color variants specified by admin (1 or more)
  const colors = shoeColors.map((col, idx) => ({
    name: col.name.trim() || `Color ${idx + 1}`,
    hex: col.hex || '#111827',
    image: uploadedGallery[idx] || uploadedGallery[0]
  }));

  const shoePayload = {
    name,
    category,
    tagline: tagline || `Engineered ${category} shoe`,
    price,
    originalPrice: originalPrice > price ? originalPrice : Math.round(price * 1.3),
    gender,
    description,
    image: uploadedGallery[0],
    images: uploadedGallery,
    colors,
    sizes: checkedSizes.length > 0 ? checkedSizes : [6, 7, 8, 9, 10, 11]
  };

  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>Publishing to Store...</span>`;
    }

    if (editId) {
      await inventoryManager.updateProduct(editId, shoePayload);
      showAdminToast(`Footwear "${name}" updated successfully!`, 'success');
    } else {
      const result = await inventoryManager.addProduct(shoePayload);
      if (result) {
        showAdminToast(`"${name}" published successfully!`, 'success');
      } else {
        throw new Error('Upload failed');
      }
    }

    closeAddShoeModal();
    renderDashboardStats();
    renderShoesTable();
    return true;
  } catch (err) {
    console.error('Publish error:', err);
    showAdminToast(`Error: ${err.message || 'Could not publish shoe'}`, 'error');
    return false;
  } finally {
    isShoeSubmitting = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnHtml;
    }
  }
};

function initShoeForm() {
  const form = document.getElementById('shoe-form');
  if (!form) return;
  form.addEventListener('submit', (e) => window.handleShoeSubmit(e));
}
