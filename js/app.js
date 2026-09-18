// Rabbit Shoes - Supercharged Storefront Application Engine (3D, UPI, Customer Auth & Live Tracking)

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
window.escapeHtml = escapeHtml;

// Audio Synthesizer for Tactile UI Feedback
const SoundEffects = {
  ctx: null,
  init() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
  },
  playPop() {
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.08);
    } catch(e) {}
  },
  playSuccess() {
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + i * 0.07);
        gain.gain.setValueAtTime(0.18, this.ctx.currentTime + i * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + i * 0.07 + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(this.ctx.currentTime + i * 0.07);
        osc.stop(this.ctx.currentTime + i * 0.07 + 0.25);
      });
    } catch(e) {}
  }
};

// Toast Notifications
function showToast(message, type = 'info', icon = '⚡') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast-item toast-${type} animate-slide-in`;
  toast.innerHTML = `
    <div class="toast-icon text-base">${icon}</div>
    <div class="toast-message">${message}</div>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('animate-fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// Format Currency in INR
function formatCurrency(amount) {
  return '₹' + Number(amount || 0).toLocaleString('en-IN');
}

// Copy Coupon to Clipboard
window.copyCoupon = function(code) {
  try {
    navigator.clipboard.writeText(code).then(() => {
      showToast(`Coupon ${code} copied! Extra 15% OFF applied.`, 'success', '🏷️');
    }).catch(() => {
      showToast(`Coupon code: ${code}`, 'info', '🏷️');
    });
  } catch(e) {
    showToast(`Coupon code: ${code}`, 'info', '🏷️');
  }
};

// Global UI App State
const AppState = {
  category: 'all',
  sortBy: 'featured',
  searchQuery: '',
  activeProductModal: null,
  selectedSize: null,
  cardSelectedColors: {},
  pendingCheckout: false
};
window.AppState = AppState;

// Footwear Category Taxonomy and Metadata
const SHOE_CATEGORIES = {
  'running': { name: 'Running / Marathon', icon: '🏃' },
  'sneakers': { name: 'Sneakers / Street', icon: '👟' },
  'sports': { name: 'Sports / Gym', icon: '⚡' },
  'casual': { name: 'Casual / Daily', icon: '🚶' },
  'walking': { name: 'Daily Walking', icon: '🚶' },
  'crocs': { name: 'Crocs / Clogs', icon: '🐊' },
  'slides': { name: 'Slides / Slippers', icon: '🩴' },
  'sandals': { name: 'Sandals / Floaters', icon: '👡' },
  'boots': { name: 'Boots / High-Tops', icon: '🥾' },
  'formal': { name: 'Formal / Loafers', icon: '👞' }
};

function getCategoryDisplayName(cat) {
  if (!cat) return 'Footwear';
  const item = SHOE_CATEGORIES[cat.toLowerCase()];
  return item ? `${item.icon} ${item.name}` : cat;
}

// ================= INITIALIZER =================
document.addEventListener('DOMContentLoaded', async () => {
  initAuthUI();
  initFilters();
  initCartUI();
  initQuickViewModal();
  initSizeGuideModal();
  initCheckoutModal();
  initFlashSaleBanner();
  renderProducts();
  renderHeroShowcase();
  if (typeof updateFloatingWhatsApp === 'function') updateFloatingWhatsApp();

  // Explicitly fetch and render live catalog from server immediately
  if (typeof inventoryManager !== 'undefined') {
    try {
      await inventoryManager.syncWithServer();
    } catch(e) {}
    renderProducts();
    renderHeroShowcase();
    initFlashSaleBanner();
    if (typeof updateFloatingWhatsApp === 'function') updateFloatingWhatsApp();
  }

  // Listen for inventory updates
  window.addEventListener('rabbit_inventory_updated', () => {
    renderProducts();
    renderHeroShowcase();
  });

  // Listen for settings & discounts updates
  window.addEventListener('rabbit_settings_updated', () => {
    initFlashSaleBanner();
    renderProducts();
    renderHeroShowcase();
    if (typeof updateFloatingWhatsApp === 'function') updateFloatingWhatsApp();
  });

  // Listen for customer auth changes
  window.addEventListener('rabbit_auth_changed', () => {
    updateNavAuthUI();
  });

  // URL Parameter Handlers for Direct Deep-Links
  const urlParams = new URLSearchParams(window.location.search);
  const qv = urlParams.get('quickview');
  const sg = urlParams.get('sizeguide');
  if (qv) {
    if (typeof openProductModal === 'function') openProductModal(qv);
    setTimeout(() => { if (typeof openProductModal === 'function') openProductModal(qv); }, 200);
  } else if (sg) {
    if (typeof openSizeGuideModal === 'function') openSizeGuideModal();
    setTimeout(() => { if (typeof openSizeGuideModal === 'function') openSizeGuideModal(); }, 200);
  }
});

// Flash Sale Realtime Banner
function initFlashSaleBanner() {
  const banner = document.getElementById('flash-sale-banner');
  const bannerText = document.getElementById('flash-sale-text');
  if (!banner || typeof inventoryManager === 'undefined') return;

  const settings = inventoryManager.getSettings();
  if (settings.flashSaleActive) {
    banner.classList.remove('hidden');
    if (bannerText) {
      bannerText.textContent = settings.flashSaleBanner || `🔥 FLASH SALE LIVE: Flat ${settings.storewideDiscount}% OFF across all sneakers!`;
    }
  } else {
    banner.classList.add('hidden');
  }
}

// ================= RENDER PRODUCTS =================
function renderProducts() {
  const grid = document.getElementById('products-grid');
  const emptyState = document.getElementById('products-empty');
  const countBadge = document.getElementById('product-count');
  if (!grid) return;

  const sourceProducts = (typeof inventoryManager !== 'undefined') ? inventoryManager.getProducts() : [];
  const query = (AppState.searchQuery || '').toLowerCase().trim();
  const selectedCat = (AppState.category || 'all').toLowerCase();

  let filtered = sourceProducts.filter(product => {
    const prodCat = (product.category || '').toLowerCase();
    
    // Category filter with smart alias matching
    let matchesCategory = selectedCat === 'all' || prodCat === selectedCat;
    if (!matchesCategory) {
      if (selectedCat === 'running' && (prodCat === 'sports' || prodCat === 'training')) matchesCategory = true;
      if (selectedCat === 'sports' && (prodCat === 'running' || prodCat === 'training')) matchesCategory = true;
      if (selectedCat === 'walking' && prodCat === 'casual') matchesCategory = true;
      if (selectedCat === 'casual' && prodCat === 'walking') matchesCategory = true;
    }
    if (!matchesCategory) return false;

    // Search query
    if (!query) return true;
    const name = (product.name || '').toLowerCase();
    const tagline = (product.tagline || '').toLowerCase();
    const desc = (product.description || '').toLowerCase();
    return name.includes(query) || tagline.includes(query) || desc.includes(query) || prodCat.includes(query);
  });

  // Sorting: Highest Discount shown automatically at top for 'featured' / default!
  if (AppState.sortBy === 'price-low') {
    filtered.sort((a, b) => a.price - b.price);
  } else if (AppState.sortBy === 'price-high') {
    filtered.sort((a, b) => b.price - a.price);
  } else {
    // Automatically rank shoes with the highest discount % at the top of the storefront!
    filtered.sort((a, b) => {
      const discA = a.originalPrice && a.originalPrice > a.price ? ((a.originalPrice - a.price) / a.originalPrice) : 0;
      const discB = b.originalPrice && b.originalPrice > b.price ? ((b.originalPrice - b.price) / b.originalPrice) : 0;
      if (discB !== discA) return discB - discA;
      return (b.createdAt || 0) > (a.createdAt || 0) ? 1 : -1;
    });
  }

  if (countBadge) {
    const catLabel = selectedCat === 'all' ? 'All Shoes' : (SHOE_CATEGORIES[selectedCat]?.name || selectedCat);
    countBadge.textContent = `${filtered.length} Model${filtered.length === 1 ? '' : 's'} (${catLabel})`;
  }

  if (filtered.length === 0) {
    grid.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

  // Track card selected sizes and colors
  if (!window.cardSelectedSizes) window.cardSelectedSizes = {};
  if (!window.cardSelectedColors) window.cardSelectedColors = {};

  grid.innerHTML = filtered.map(product => {
    const isOutOfStock = product.inStock === false;
    const catDisplay = getCategoryDisplayName(product.category);
    const discountPercent = product.originalPrice && product.originalPrice > product.price 
      ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100) 
      : null;
    const isWishlisted = typeof wishlistManager !== 'undefined' && typeof wishlistManager.has === 'function' 
      ? wishlistManager.has(product.id) 
      : false;
    const defaultSize = window.cardSelectedSizes[product.id] || (product.sizes && product.sizes[0]) || 7;
    window.cardSelectedSizes[product.id] = defaultSize;

    const defaultColorIdx = window.cardSelectedColors[product.id] || 0;
    const activeColor = (product.colors && product.colors[defaultColorIdx]) || { name: 'Standard', image: product.image };

    return `
      <article class="shoe-card rounded-2xl overflow-hidden flex flex-col justify-between group hover:border-[#ff461e]/50 hover:-translate-y-1 transition-all duration-300">
        
        <!-- Image & Badge Container -->
        <div class="relative bg-[#f5f6f8] p-3 aspect-square flex items-center justify-center cursor-pointer overflow-hidden" onclick="openProductModal('${product.id}')">
          
          <!-- Top Left Badges -->
          <div class="absolute top-2.5 left-2.5 z-10 flex flex-col gap-1 items-start">
            ${product.badge ? `
              <span class="bg-gray-900 text-amber-300 text-[9px] font-mono font-extrabold uppercase px-2 py-0.5 rounded-md shadow-sm">
                ★ ${product.badge}
              </span>
            ` : ''}
            ${discountPercent ? `
              <span class="bg-[#ff461e] text-white text-[9px] font-mono font-black uppercase px-2 py-0.5 rounded-md shadow-sm shadow-[#ff461e]/30">
                ${discountPercent}% OFF
              </span>
            ` : ''}
            ${isOutOfStock ? `
              <span class="bg-red-500 text-white text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-md">
                Sold Out
              </span>
            ` : ''}
          </div>

          <!-- Top Right Wishlist Heart -->
          <button 
            type="button" 
            onclick="event.stopPropagation(); toggleWishlistCard('${product.id}', this)"
            class="absolute top-2.5 right-2.5 z-10 w-7 h-7 rounded-full bg-white/90 hover:bg-white border border-gray-200 shadow-sm flex items-center justify-center text-xs transition-transform active:scale-90 cursor-pointer"
            title="Add to Wishlist"
          >
            <span class="${isWishlisted ? 'text-red-500' : 'text-gray-400'}">${isWishlisted ? '❤️' : '🤍'}</span>
          </button>

          <img 
            id="shoe-img-${product.id}"
            src="${activeColor.image || product.image}" 
            alt="${product.name}" 
            loading="lazy" 
            class="w-full h-full object-contain filter drop-shadow-sm group-hover:scale-105 transition-transform duration-300" 
          />
        </div>

        <!-- Details & Actions Box (Neeman's & Campus layout) -->
        <div class="p-3.5 sm:p-4 flex-1 flex flex-col justify-between space-y-2 bg-white">
          <div>
            <!-- Category & Rating row -->
            <div class="flex items-center justify-between gap-1 text-[10px] font-mono mb-1">
              <span class="uppercase font-bold text-[#ff461e] tracking-wider truncate">
                ${catDisplay}
              </span>
              <span class="text-amber-500 font-bold flex items-center gap-0.5">
                ★ ${product.rating || '4.8'} <span class="text-gray-400 font-normal">(${product.reviewsCount || '1.2k'})</span>
              </span>
            </div>

            <!-- Shoe Title -->
            <h3 class="font-display font-bold text-xs sm:text-sm text-gray-900 line-clamp-1 group-hover:text-[#ff461e] transition-colors cursor-pointer" onclick="openProductModal('${product.id}')">
              ${product.name}
            </h3>

            <p class="text-[11px] text-gray-500 line-clamp-1 mt-0.5">${product.tagline || 'High-Comfort Engineered Footwear'}</p>
          </div>

          <!-- Multi-Color Swatches (Amazon & Campus Style - 2-3 Colors) -->
          ${(product.colors && product.colors.length > 0) ? `
            <div class="py-0.5">
              <div class="flex items-center justify-between text-[10px] mb-1">
                <span class="font-mono text-gray-400 font-bold uppercase text-[9px]">Color:</span>
                <span id="shoe-color-label-${product.id}" class="font-mono text-gray-700 font-bold text-[10px] truncate max-w-[130px]">
                  ${activeColor.name || ''}
                </span>
              </div>
              <div class="flex items-center gap-1.5 flex-wrap">
                ${product.colors.map((col, cIdx) => {
                  const isSelected = cIdx === defaultColorIdx;
                  return `
                    <button 
                      type="button" 
                      onclick="event.stopPropagation(); selectCardColor('${product.id}', ${cIdx}, this)" 
                      title="${col.name}" 
                      aria-label="Color: ${col.name || 'Option'}"
                      class="w-5 h-5 rounded-full border border-gray-300 transition-all cursor-pointer ${isSelected ? 'ring-2 ring-[#ff461e] ring-offset-1 scale-110' : 'hover:scale-110'}" 
                      style="background-color: ${col.hex};"
                    ><span class="sr-only">${col.name || 'Color'}</span></button>
                  `;
                }).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Quick Size Chips Row -->
          ${(product.sizes && product.sizes.length) ? `
            <div>
              <span class="text-[9px] text-gray-400 font-mono font-bold uppercase block mb-1">Select Size (UK):</span>
              <div class="flex items-center gap-1 flex-wrap">
                ${product.sizes.map(sz => `
                  <button 
                    type="button" 
                    onclick="selectCardSize('${product.id}', ${sz}, this)"
                    class="size-chip ${sz === defaultSize ? 'active' : ''}"
                  >
                    ${sz}
                  </button>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Price & Instant Add to Bag Button -->
          <div class="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
            <div>
              <span class="font-mono font-black text-sm sm:text-base text-gray-900 block">
                ${formatCurrency(product.price)}
              </span>
              ${product.originalPrice && product.originalPrice > product.price ? `
                <span class="text-[10px] text-gray-400 line-through font-mono block">
                  ${formatCurrency(product.originalPrice)}
                </span>
              ` : ''}
            </div>

            <button 
              type="button" 
              onclick="quickAddCardShoe('${product.id}')"
              class="btn-brand px-3 py-1.5 rounded-xl text-[11px] uppercase tracking-wider font-extrabold flex items-center gap-1 shadow-sm active:scale-95 cursor-pointer"
              aria-label="Add to Bag"
            >
              <span>+ Bag</span>
            </button>
          </div>

        </div>

      </article>
    `;
  }).join('');
}

// Global helpers for Card actions
window.selectCardSize = function(productId, size, btn) {
  window.cardSelectedSizes[productId] = size;
  const parent = btn.parentElement;
  if (parent) {
    parent.querySelectorAll('.size-chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
  }
};

window.selectCardColor = function(productId, colorIdx, btn) {
  if (!window.cardSelectedColors) window.cardSelectedColors = {};
  window.cardSelectedColors[productId] = colorIdx;
  const prod = inventoryManager.getProductById(productId);
  if (!prod || !prod.colors || !prod.colors[colorIdx]) return;
  const col = prod.colors[colorIdx];

  const imgEl = document.getElementById(`shoe-img-${productId}`);
  if (imgEl && col.image) {
    imgEl.src = col.image;
  }
  const labelEl = document.getElementById(`shoe-color-label-${productId}`);
  if (labelEl) {
    labelEl.textContent = col.name;
  }

  if (btn && btn.parentElement) {
    btn.parentElement.querySelectorAll('button').forEach(b => {
      b.classList.remove('ring-2', 'ring-[#ff461e]', 'ring-offset-1', 'scale-110');
    });
    btn.classList.add('ring-2', 'ring-[#ff461e]', 'ring-offset-1', 'scale-110');
  }
};

window.quickAddCardShoe = function(productId) {
  const prod = inventoryManager.getProductById(productId);
  if (!prod) return;
  const size = window.cardSelectedSizes[productId] || (prod.sizes && prod.sizes[0]) || 7;
  const colorIdx = (window.cardSelectedColors && window.cardSelectedColors[productId]) || 0;
  const color = (prod.colors && prod.colors[colorIdx]) || { name: 'Default', hex: '#ff461e', image: prod.image };
  cartManager.addItem(prod, size, color, 1);
  showToast(`Added ${prod.name} (${color.name}, UK ${size}) to Bag!`, 'success');
  
  // Open cart drawer
  const drawer = document.getElementById('cart-drawer');
  const backdrop = document.getElementById('cart-drawer-backdrop');
  if (drawer && backdrop) {
    drawer.classList.remove('hidden');
    backdrop.classList.remove('hidden');
  }
};

// ================= HERO SHOWCASE CARD (HIGHEST DISCOUNT PRODUCT) =================
function renderHeroShowcase() {
  const container = document.getElementById('hero-showcase-container');
  if (!container) return;

  const products = (typeof inventoryManager !== 'undefined') ? inventoryManager.getProducts() : [];
  if (!products || products.length === 0) return;

  // Find product with highest discount percentage
  const topDeal = [...products].sort((a, b) => {
    const discA = a.originalPrice && a.originalPrice > a.price ? ((a.originalPrice - a.price) / a.originalPrice) : 0;
    const discB = b.originalPrice && b.originalPrice > b.price ? ((b.originalPrice - b.price) / b.originalPrice) : 0;
    return discB - discA;
  })[0];

  if (!topDeal) return;

  if (window.heroSelectedColorIndex === undefined) window.heroSelectedColorIndex = 0;
  const activeColor = (topDeal.colors && topDeal.colors[window.heroSelectedColorIndex]) || { name: 'Default', hex: '#ff461e', image: topDeal.image };
  const currentImg = activeColor.image || topDeal.image;
  const defaultSize = (topDeal.sizes && topDeal.sizes[0]) || 7;
  if (!window.heroSelectedSize) window.heroSelectedSize = defaultSize;

  const discountPercent = topDeal.originalPrice && topDeal.originalPrice > topDeal.price
    ? Math.round(((topDeal.originalPrice - topDeal.price) / topDeal.originalPrice) * 100)
    : 50;

  const savings = (topDeal.originalPrice - topDeal.price);

  container.innerHTML = `
    <div class="relative bg-white border-2 border-orange-200/90 rounded-3xl p-5 sm:p-7 shadow-2xl shadow-orange-500/10 overflow-hidden group hover:border-[#ff461e] transition-all">
      <!-- Glow Accent Badge Top Right -->
      <div class="absolute top-0 right-0 bg-gradient-to-l from-[#ff461e] to-orange-500 text-white text-[11px] font-mono font-black uppercase px-4 py-1.5 rounded-bl-2xl shadow-md flex items-center gap-1.5">
        <span>⚡ TOP STEAL DEAL</span>
        <span>${discountPercent}% OFF</span>
      </div>

      <!-- Category & Rating -->
      <div class="flex items-center gap-2 mb-2">
        <span class="bg-orange-50 text-[#ff461e] border border-orange-200 text-[10px] font-mono font-extrabold uppercase px-2.5 py-0.5 rounded-md">
          ${topDeal.category.toUpperCase()}
        </span>
        <div class="flex items-center text-amber-500 text-xs">
          ★★★★★ <span class="text-gray-500 font-mono text-[10px] ml-1">(${topDeal.reviewsCount || '2.8k'} reviews)</span>
        </div>
      </div>

      <!-- Title & Tagline -->
      <h3 class="font-display font-black text-lg sm:text-xl text-gray-900 tracking-tight cursor-pointer hover:text-[#ff461e] transition-colors" onclick="openProductModal('${topDeal.id}')">
        ${topDeal.name}
      </h3>
      <p class="text-xs text-gray-500 mt-0.5 line-clamp-1">${topDeal.tagline || 'Engineered cloud comfort footbed'}</p>

      <!-- Center Interactive Shoe Image -->
      <div class="relative my-3 sm:my-4 bg-gradient-to-b from-[#f8fafc] to-[#f1f5f9] rounded-2xl p-4 sm:p-6 aspect-[16/10] flex items-center justify-center cursor-pointer overflow-hidden border border-gray-100" onclick="openProductModal('${topDeal.id}')">
        <img 
          id="hero-shoe-main-img" 
          src="${currentImg}" 
          alt="${topDeal.name}" 
          class="w-full h-full object-contain filter drop-shadow-md group-hover:scale-105 transition-transform duration-300"
        />
        <div class="absolute bottom-2 right-2 bg-white/90 backdrop-blur-xs text-[10px] font-mono font-bold text-gray-700 px-2.5 py-1 rounded-lg border border-gray-200 shadow-xs flex items-center gap-1">
          <span>🔍 Quick Details</span>
        </div>
      </div>

      <!-- Color Swatches Row -->
      <div class="mb-3">
        <div class="flex items-center justify-between text-[11px] mb-1.5">
          <span class="font-mono font-bold text-gray-700 uppercase tracking-wider">Color: <strong id="hero-color-name" class="text-[#ff461e]">${activeColor.name}</strong></span>
          <span class="text-[10px] text-gray-400 font-mono">${(topDeal.colors && topDeal.colors.length > 1) ? `${topDeal.colors.length} Colors In Stock` : '1 Color Available'}</span>
        </div>
        <div class="flex items-center gap-2">
          ${(topDeal.colors || []).map((col, idx) => `
            <button 
              type="button" 
              onclick="selectHeroColor(${idx}, '${topDeal.id}', this)"
              title="${col.name}"
              aria-label="Color: ${col.name || 'Option'}"
              class="w-6 h-6 rounded-full border border-gray-300 transition-all cursor-pointer ${idx === window.heroSelectedColorIndex ? 'ring-2 ring-[#ff461e] ring-offset-2 scale-110' : 'hover:scale-110'}"
              style="background-color: ${col.hex};"
            ><span class="sr-only">${col.name || 'Color'}</span></button>
          `).join('')}
        </div>
      </div>

      <!-- UK Size Selector Chips -->
      <div class="mb-4">
        <span class="font-mono font-bold text-[11px] text-gray-700 uppercase tracking-wider block mb-1.5">Select Size (UK):</span>
        <div class="flex items-center gap-1.5 flex-wrap">
          ${(topDeal.sizes || [6, 7, 8, 9, 10]).map(sz => `
            <button 
              type="button" 
              onclick="selectHeroSize(${sz}, this)"
              class="size-chip ${sz === window.heroSelectedSize ? 'active' : ''}"
            >
              UK ${sz}
            </button>
          `).join('')}
        </div>
      </div>

      <!-- Price Breakdown & Instant Order Buttons -->
      <div class="pt-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div class="flex items-baseline gap-2">
            <span class="font-mono font-black text-2xl text-gray-900">${formatCurrency(topDeal.price)}</span>
            <span class="text-xs text-gray-400 line-through font-mono">${formatCurrency(topDeal.originalPrice)}</span>
          </div>
          <span class="text-[11px] text-emerald-600 font-bold font-mono">You Save ${formatCurrency(savings)} (${discountPercent}% OFF)</span>
        </div>

        <div class="flex items-center gap-2">
          <button 
            type="button" 
            onclick="heroAddToCart('${topDeal.id}')"
            class="px-4 py-3 rounded-xl border-2 border-gray-200 hover:border-gray-900 text-gray-800 font-extrabold text-xs uppercase tracking-wider transition-colors cursor-pointer"
          >
            + Bag
          </button>
          <button 
            type="button" 
            onclick="heroBuyNow('${topDeal.id}')"
            class="flex-1 sm:flex-initial btn-brand px-6 py-3 rounded-xl font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-[#ff461e]/25 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>⚡ Buy Now</span>
          </button>
        </div>
      </div>

    </div>
  `;
}

window.selectHeroColor = function(idx, productId, btn) {
  window.heroSelectedColorIndex = idx;
  const prod = inventoryManager.getProductById(productId);
  if (!prod || !prod.colors || !prod.colors[idx]) return;
  const col = prod.colors[idx];
  const imgEl = document.getElementById('hero-shoe-main-img');
  if (imgEl && col.image) imgEl.src = col.image;
  const nameEl = document.getElementById('hero-color-name');
  if (nameEl) nameEl.textContent = col.name;

  if (btn && btn.parentElement) {
    btn.parentElement.querySelectorAll('button').forEach(b => {
      b.classList.remove('ring-2', 'ring-[#ff461e]', 'ring-offset-2', 'scale-110');
    });
    btn.classList.add('ring-2', 'ring-[#ff461e]', 'ring-offset-2', 'scale-110');
  }
};

window.selectHeroSize = function(size, btn) {
  window.heroSelectedSize = size;
  if (btn && btn.parentElement) {
    btn.parentElement.querySelectorAll('.size-chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
  }
};

window.heroAddToCart = function(productId) {
  const prod = inventoryManager.getProductById(productId);
  if (!prod) return;
  const size = window.heroSelectedSize || (prod.sizes && prod.sizes[0]) || 7;
  const colorIdx = window.heroSelectedColorIndex || 0;
  const color = (prod.colors && prod.colors[colorIdx]) || { name: 'Default', hex: '#ff461e', image: prod.image };
  cartManager.addItem(prod, size, color, 1);
  showToast(`Added ${prod.name} (${color.name}, UK ${size}) to Bag!`, 'success');
};

window.heroBuyNow = function(productId) {
  const prod = inventoryManager.getProductById(productId);
  if (!prod) return;
  const size = window.heroSelectedSize || (prod.sizes && prod.sizes[0]) || 7;
  const colorIdx = window.heroSelectedColorIndex || 0;
  const color = (prod.colors && prod.colors[colorIdx]) || { name: 'Default', hex: '#ff461e', image: prod.image };
  cartManager.addItem(prod, size, color, 1);
  
  // Close cart drawer if open, and trigger checkout
  const drawer = document.getElementById('cart-drawer');
  const backdrop = document.getElementById('cart-drawer-backdrop');
  if (drawer) drawer.classList.add('hidden');
  if (backdrop) backdrop.classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
  
  if (typeof window.openCheckout === 'function') {
    window.openCheckout();
  } else {
    const openBtn = document.getElementById('open-checkout-btn');
    if (openBtn) openBtn.click();
  }
};

window.toggleWishlistCard = function(productId, btn) {
  if (typeof wishlistManager === 'undefined') return;
  const inWishlist = wishlistManager.isInWishlist(productId);
  if (inWishlist) {
    wishlistManager.removeItem(productId);
    btn.innerHTML = '<span class="text-zinc-400">🤍</span>';
    showToast('Removed from Wishlist', 'info');
  } else {
    wishlistManager.addItem(productId);
    btn.innerHTML = '<span class="text-red-500">❤️</span>';
    showToast('Saved to Wishlist!', 'success');
  }
};

// ================= FILTER & SEARCH HANDLERS =================
function initFilters() {
  const pills = document.querySelectorAll('.category-pill');
  pills.forEach(pill => {
    pill.addEventListener('click', (e) => {
      const cat = pill.dataset.category || 'all';
      AppState.category = cat;
      
      pills.forEach(p => {
        const isSelected = (p.dataset.category === cat);
        if (p.classList.contains('cat-bubble')) {
          p.classList.toggle('active', isSelected);
          const title = p.querySelector('.cat-title');
          if (title) {
            title.className = isSelected ? 'cat-title text-xs font-bold text-[#ff461e] whitespace-nowrap' : 'cat-title text-xs font-bold text-zinc-300 whitespace-nowrap';
          }
        } else {
          if (isSelected) {
            p.className = 'category-pill active flex-shrink-0 bg-[#ff461e] text-white border border-[#ff461e] font-bold text-xs px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-[#ff461e]/30';
          } else {
            p.className = 'category-pill flex-shrink-0 bg-[#13151c] hover:bg-white/5 text-zinc-400 hover:text-white border border-white/10 font-bold text-xs px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer';
          }
        }
      });

      renderProducts();
      SoundEffects.playPop();
    });
  });

  const searchInput = document.getElementById('search-shoes');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      AppState.searchQuery = e.target.value;
      renderProducts();
    });
  }

  const sortSelect = document.getElementById('sort-shoes');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      AppState.sortBy = e.target.value;
      renderProducts();
    });
  }

  const mobileSearchInput = document.getElementById('mobile-search-input');
  if (mobileSearchInput) {
    mobileSearchInput.addEventListener('input', (e) => {
      AppState.searchQuery = e.target.value;
      renderProducts();
    });
  }
}

// ================= MOBILE NAVIGATION DRAWER & ACTIONS =================
window.openMobileNavDrawer = function() {
  const drawer = document.getElementById('mobile-nav-drawer');
  const backdrop = document.getElementById('mobile-nav-backdrop');
  if (drawer && backdrop) {
    backdrop.classList.remove('hidden');
    drawer.classList.remove('-translate-x-full');
    drawer.classList.add('translate-x-0');
    document.body.classList.add('overflow-hidden');
  }
};

window.closeMobileNavDrawer = function() {
  const drawer = document.getElementById('mobile-nav-drawer');
  const backdrop = document.getElementById('mobile-nav-backdrop');
  if (drawer && backdrop) {
    drawer.classList.add('-translate-x-full');
    drawer.classList.remove('translate-x-0');
    backdrop.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
  }
};

window.selectMobileCategory = function(cat) {
  AppState.category = cat;
  closeMobileNavDrawer();
  
  const pills = document.querySelectorAll('.category-pill');
  pills.forEach(p => {
    const isSelected = (p.dataset.category === cat);
    if (p.classList.contains('cat-bubble')) {
      p.classList.toggle('active', isSelected);
    } else {
      if (isSelected) {
        p.className = 'category-pill active flex-shrink-0 bg-[#b41f17] text-white border border-[#b41f17] font-extrabold text-xs px-3 py-2 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-xs';
      } else {
        p.className = 'category-pill flex-shrink-0 bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 border border-transparent font-bold text-xs px-3 py-2 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer';
      }
    }
  });

  renderProducts();
  scrollToProducts();
};

window.toggleMobileSearchBar = function() {
  const bar = document.getElementById('mobile-search-bar');
  const input = document.getElementById('mobile-search-input');
  if (bar) {
    bar.classList.toggle('hidden');
    if (!bar.classList.contains('hidden') && input) {
      input.focus();
    }
  }
};

window.scrollToProducts = function(cat) {
  if (cat) AppState.category = cat;
  const section = document.getElementById('products-section') || document.getElementById('featured-grid');
  if (section) {
    section.scrollIntoView({ behavior: 'smooth' });
  }
};

// ================= QUICK VIEW PRODUCT MODAL =================
function initQuickViewModal() {
  const modal = document.getElementById('product-modal');
  const backdrop = document.getElementById('product-modal-backdrop');
  const closeBtn = document.getElementById('close-product-modal');
  const addBtn = document.getElementById('modal-add-to-cart-btn');

  function closeModal() {
    if (modal) modal.classList.add('hidden');
    if (backdrop) backdrop.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
    AppState.activeProductModal = null;
    AppState.selectedSize = null;
  }

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (backdrop) backdrop.addEventListener('click', closeModal);

  if (addBtn) {
    addBtn.addEventListener('click', () => {
      if (!AppState.activeProductModal) return;
      const product = AppState.activeProductModal;
      const size = AppState.selectedSize || (product.sizes ? product.sizes[0] : 8);
      const colorIdx = AppState.selectedColorIndex || 0;
      const color = (product.colors && product.colors[colorIdx]) || { name: 'Standard Edition', image: product.image };

      cartManager.addItem(product, size, color, 1);
      SoundEffects.playSuccess();
      showToast(`Added ${product.name} (${color.name}, UK ${size}) to Bag!`, "success", "🛍️");
      closeModal();
      document.querySelector('.open-cart-btn')?.click();
    });
  }
}

window.openProductModal = function(productId) {
  let product = (typeof inventoryManager !== 'undefined') ? inventoryManager.getProductById(productId) : null;
  if (!product && typeof inventoryManager !== 'undefined') {
    const all = inventoryManager.getAllProducts();
    if (all && all.length > 0) product = all[0];
  }
  if (!product) return;

  window.activeModalShoeId = productId;
  AppState.activeProductModal = product;
  AppState.selectedSize = (product.sizes && product.sizes.length > 0) ? product.sizes[0] : 8;
  AppState.selectedColorIndex = 0;

  const modal = document.getElementById('product-modal');
  const backdrop = document.getElementById('product-modal-backdrop');
  const imgEl = document.getElementById('modal-product-image');
  const nameEl = document.getElementById('modal-product-name');
  const tagEl = document.getElementById('modal-product-tagline');
  const priceEl = document.getElementById('modal-product-price');
  const origPriceEl = document.getElementById('modal-product-original-price');
  const discEl = document.getElementById('modal-product-discount');
  const catBadgeEl = document.getElementById('modal-category-badge');
  const descEl = document.getElementById('modal-product-description');
  const thumbsContainer = document.getElementById('modal-gallery-thumbs');
  const sizesGrid = document.getElementById('modal-sizes-grid');
  const colorsGrid = document.getElementById('modal-colors-grid');
  const colorNameEl = document.getElementById('modal-selected-color-name');

  if (imgEl) imgEl.src = product.image;
  if (nameEl) nameEl.textContent = product.name;
  if (tagEl) tagEl.textContent = product.tagline || '';
  if (priceEl) priceEl.textContent = formatCurrency(product.price);
  if (origPriceEl) {
    origPriceEl.textContent = product.originalPrice ? formatCurrency(product.originalPrice) : '';
  }
  if (discEl) {
    discEl.textContent = product.discount || (product.originalPrice ? `${Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}% OFF` : '');
  }
  if (catBadgeEl) {
    catBadgeEl.textContent = getCategoryDisplayName(product.category);
  }
  if (descEl) {
    descEl.textContent = product.description || 'Authentic engineered Rabbit performance footwear.';
  }

  // Reset Pincode Checker
  const pinInput = document.getElementById('modal-pincode-input');
  const pinResult = document.getElementById('modal-pincode-result');
  if (pinInput) pinInput.value = '';
  if (pinResult) {
    pinResult.textContent = '';
    pinResult.classList.add('hidden');
  }

  // Multi-color Swatches in Modal
  if (colorsGrid) {
    const colors = (product.colors && product.colors.length > 0) ? product.colors : [
      { name: 'Standard Edition', hex: '#ff461e', image: product.image }
    ];
    if (colorNameEl) colorNameEl.textContent = colors[0].name;

    colorsGrid.innerHTML = colors.map((col, cIdx) => `
      <button 
        type="button" 
        title="${col.name}"
        aria-label="Color: ${col.name || 'Option'}"
        onclick="selectModalColor(${cIdx})"
        class="modal-color-chip w-7 h-7 rounded-full border border-gray-300 transition-all cursor-pointer ${cIdx === 0 ? 'ring-2 ring-[#ff461e] ring-offset-2 scale-110' : 'hover:scale-110'}"
        style="background-color: ${col.hex};"
      ><span class="sr-only">${col.name || 'Color'}</span></button>
    `).join('');
  }

  // Multi-angle Thumbnails
  if (thumbsContainer) {
    const gallery = (product.gallery && product.gallery.length > 0) ? product.gallery : [product.image];
    thumbsContainer.innerHTML = gallery.map((imgUrl, idx) => `
      <button 
        type="button" 
        onclick="document.getElementById('modal-product-image').src='${imgUrl}'; SoundEffects.playPop();"
        class="w-12 h-12 rounded-lg bg-[#09090b] border ${idx === 0 ? 'border-[#ff461e]' : 'border-white/10'} p-1 flex-shrink-0 cursor-pointer hover:border-[#ff461e] transition-colors"
      >
        <img src="${imgUrl}" alt="Angle ${idx + 1}" class="w-full h-full object-contain" />
      </button>
    `).join('');
  }

  // Size buttons
  if (sizesGrid) {
    const availableSizes = product.sizes && product.sizes.length > 0 ? product.sizes : [6, 7, 8, 9, 10, 11];
    sizesGrid.innerHTML = availableSizes.map(sz => `
      <button 
        type="button" 
        data-size="${sz}"
        onclick="selectModalSize(${sz})"
        class="size-pill-btn px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase border transition-all cursor-pointer ${sz === AppState.selectedSize ? 'bg-[#ff461e] text-black border-[#ff461e] shadow-sm' : 'bg-[#09090b] text-zinc-300 border-white/10 hover:border-white/20'}"
      >
        UK ${sz}
      </button>
    `).join('');
  }

  if (modal) modal.classList.remove('hidden');
  if (backdrop) backdrop.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
};

window.selectModalColor = function(cIdx) {
  AppState.selectedColorIndex = cIdx;
  const prod = AppState.activeProductModal;
  if (!prod || !prod.colors || !prod.colors[cIdx]) return;
  const col = prod.colors[cIdx];
  const imgEl = document.getElementById('modal-product-image');
  if (imgEl && col.image) imgEl.src = col.image;
  const colorNameEl = document.getElementById('modal-selected-color-name');
  if (colorNameEl) colorNameEl.textContent = col.name;

  const chips = document.querySelectorAll('.modal-color-chip');
  chips.forEach((ch, idx) => {
    if (idx === cIdx) {
      ch.className = 'modal-color-chip w-7 h-7 rounded-full border border-gray-300 transition-all cursor-pointer ring-2 ring-[#ff461e] ring-offset-2 scale-110';
    } else {
      ch.className = 'modal-color-chip w-7 h-7 rounded-full border border-gray-300 transition-all cursor-pointer hover:scale-110';
    }
  });
  if (typeof SoundEffects !== 'undefined' && SoundEffects.playPop) SoundEffects.playPop();
};

window.selectModalSize = function(size) {
  AppState.selectedSize = size;
  const buttons = document.querySelectorAll('.size-pill-btn');
  buttons.forEach(btn => {
    if (Number(btn.dataset.size) === size) {
      btn.className = 'size-pill-btn px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase border transition-all cursor-pointer bg-[#ff461e] text-black border-[#ff461e] shadow-sm';
    } else {
      btn.className = 'size-pill-btn px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase border transition-all cursor-pointer bg-[#09090b] text-zinc-300 border-white/10 hover:border-white/20';
    }
  });
  SoundEffects.playPop();
};

// ================= SIZE GUIDE & STOREFRONT ENHANCEMENTS =================
window.openSizeGuideModal = function() {
  const modal = document.getElementById('size-guide-modal');
  const backdrop = document.getElementById('size-guide-backdrop') || document.getElementById('size-guide-modal-backdrop');
  if (modal) modal.classList.remove('hidden');
  if (backdrop) backdrop.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
};

window.closeSizeGuideModal = function() {
  const modal = document.getElementById('size-guide-modal');
  const backdrop = document.getElementById('size-guide-backdrop') || document.getElementById('size-guide-modal-backdrop');
  if (modal) modal.classList.add('hidden');
  if (backdrop) backdrop.classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
};

function initSizeGuideModal() {
  const backdrop = document.getElementById('size-guide-backdrop') || document.getElementById('size-guide-modal-backdrop');
  const openBtns = document.querySelectorAll('.open-size-guide-btn');
  const closeBtns = document.querySelectorAll('.close-size-guide-btn');

  openBtns.forEach(btn => btn.addEventListener('click', window.openSizeGuideModal));
  closeBtns.forEach(btn => btn.addEventListener('click', window.closeSizeGuideModal));
  if (backdrop) backdrop.addEventListener('click', window.closeSizeGuideModal);
}

// Pincode Delivery Estimator
window.checkModalPincodeDelivery = function() {
  const input = document.getElementById('modal-pincode-input');
  const resEl = document.getElementById('modal-pincode-result');
  if (!input || !resEl) return;
  const pin = (input.value || '').trim();
  if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
    resEl.className = 'text-[11px] font-medium text-red-600 bg-red-50 p-1.5 rounded border border-red-200';
    resEl.innerHTML = '❌ Please enter a valid 6-digit Indian PIN code';
    resEl.classList.remove('hidden');
    return;
  }
  
  // Calculate delivery date (2-3 days from now)
  const estDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const estStr = estDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

  resEl.className = 'text-[11px] font-medium text-emerald-700 bg-emerald-50 p-1.5 rounded border border-emerald-200';
  resEl.innerHTML = `✅ <strong>Fast Delivery to ${pin} by ${estStr}</strong><br><span class="text-[10px] text-emerald-800">Ekart / Express courier delivery partner • Free Shipping & Cash on Delivery Available!</span>`;
  resEl.classList.remove('hidden');
};

// Instant Buy from Modal
window.instantBuyFromModal = function() {
  if (!AppState.activeProductModal) return;
  const product = AppState.activeProductModal;
  const size = AppState.selectedSize || (product.sizes ? product.sizes[0] : 8);
  const colorIdx = AppState.selectedColorIndex || 0;
  const color = (product.colors && product.colors[colorIdx]) || { name: 'Standard Edition', image: product.image };

  cartManager.addItem(product, size, color, 1);
  SoundEffects.playSuccess();
  
  // Close product modal
  const modal = document.getElementById('product-modal');
  const backdrop = document.getElementById('product-modal-backdrop');
  if (modal) modal.classList.add('hidden');
  if (backdrop) backdrop.classList.add('hidden');
  document.body.classList.remove('overflow-hidden');

  // Trigger Checkout Modal immediately
  if (typeof startFastCheckout === 'function') {
    startFastCheckout();
  } else {
    document.querySelector('.open-cart-btn')?.click();
    setTimeout(() => {
      document.getElementById('cart-checkout-btn')?.click();
    }, 150);
  }
};

// Sync Floating WhatsApp button with settings
window.updateFloatingWhatsApp = function() {
  const settings = (typeof inventoryManager !== 'undefined') ? inventoryManager.getSettings() : null;
  const phone = (settings && settings.supportWhatsApp) ? settings.supportWhatsApp : '9828682274';
  const btn = document.getElementById('floating-whatsapp-btn');
  if (btn) {
    btn.href = `https://wa.me/91${phone}?text=${encodeURIComponent('Hello Rabbit Shoes, I need assistance regarding footwear or my order.')}`;
  }
};

// ================= SHOPPING CART UI =================
function initCartUI() {
  const drawer = document.getElementById('cart-drawer');
  const backdrop = document.getElementById('cart-drawer-backdrop');
  const openBtns = document.querySelectorAll('.open-cart-btn');
  const closeBtn = document.getElementById('close-cart-drawer');
  const itemsContainer = document.getElementById('cart-items-container');
  const countBadge = document.getElementById('cart-badge');
  const drawerCount = document.getElementById('cart-drawer-count');
  const subtotalEl = document.getElementById('cart-subtotal');
  const discountRow = document.getElementById('cart-discount-row');
  const discountEl = document.getElementById('cart-discount');
  const totalEl = document.getElementById('cart-total');
  const couponInput = document.getElementById('cart-coupon-input');
  const applyCouponBtn = document.getElementById('cart-apply-coupon-btn');

  function updateCartView() {
    const count = cartManager.getItemCount();
    if (countBadge) {
      countBadge.textContent = count;
      countBadge.classList.toggle('hidden', count === 0);
    }
    if (drawerCount) drawerCount.textContent = `${count} Item${count === 1 ? '' : 's'}`;

    if (itemsContainer) {
      if (cartManager.cart.length === 0) {
        itemsContainer.innerHTML = `
          <div class="text-center py-12 text-zinc-500 space-y-2">
            <span class="text-3xl block">🛍️</span>
            <p class="text-xs">Your shopping bag is empty.</p>
          </div>
        `;
      } else {
        itemsContainer.innerHTML = cartManager.cart.map((item, idx) => `
          <div class="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl p-2.5">
            <div class="w-12 h-12 rounded-lg bg-white p-1 flex-shrink-0 flex items-center justify-center border border-gray-200">
              <img src="${item.image}" alt="${item.name}" class="w-full h-full object-contain" />
            </div>
            <div class="flex-1 min-w-0">
              <h4 class="font-bold text-xs text-gray-900 truncate">${item.name}</h4>
              <span class="text-[10px] text-gray-500 font-mono">Size: UK ${item.size}</span>
              <p class="text-xs font-mono font-bold text-[#ff461e] mt-0.5">${formatCurrency(item.price)}</p>
            </div>
            <div class="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
              <button type="button" onclick="cartManager.updateQuantity(${idx}, -1); SoundEffects.playPop();" class="w-5 h-5 flex items-center justify-center text-gray-600 hover:text-black font-bold cursor-pointer">-</button>
              <span class="text-xs font-mono font-bold px-1 text-gray-900">${item.quantity}</span>
              <button type="button" onclick="cartManager.updateQuantity(${idx}, 1); SoundEffects.playPop();" class="w-5 h-5 flex items-center justify-center text-gray-600 hover:text-black font-bold cursor-pointer">+</button>
            </div>
          </div>
        `).join('');
      }
    }

    if (subtotalEl) subtotalEl.textContent = formatCurrency(cartManager.getSubtotal());
    if (totalEl) totalEl.textContent = formatCurrency(cartManager.getTotal());

    const discount = cartManager.getDiscountAmount();
    if (discountRow && discountEl) {
      if (discount > 0) {
        discountRow.classList.remove('hidden');
        discountEl.textContent = `-${formatCurrency(discount)}`;
      } else {
        discountRow.classList.add('hidden');
      }
    }
  }

  cartManager.subscribe(updateCartView);

  function openDrawer() {
    if (drawer) drawer.classList.remove('hidden');
    if (backdrop) backdrop.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
  }

  function closeDrawer() {
    if (drawer) drawer.classList.add('hidden');
    if (backdrop) backdrop.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
  }

  openBtns.forEach(btn => btn.addEventListener('click', openDrawer));
  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
  if (backdrop) backdrop.addEventListener('click', closeDrawer);

  if (applyCouponBtn && couponInput) {
    applyCouponBtn.addEventListener('click', () => {
      const code = couponInput.value;
      const res = cartManager.applyCouponCode(code);
      if (res.success) {
        showToast(res.message, "success", "🏷️");
        couponInput.value = '';
      } else {
        showToast(res.message, "error", "⚠️");
      }
    });
  }
}

// ================= ADVANCED REALTIME UPI CHECKOUT =================
function initCheckoutModal() {
  const modal = document.getElementById('checkout-modal');
  const backdrop = document.getElementById('checkout-modal-backdrop');
  const openBtn = document.getElementById('open-checkout-btn');
  const closeBtn = document.getElementById('close-checkout-modal');
  const stepAddress = document.getElementById('checkout-step-address');
  const stepSuccess = document.getElementById('checkout-step-success');
  const checkoutForm = document.getElementById('checkout-form');
  const successTrackBtn = document.getElementById('success-track-btn');

  function openCheckout() {
    if (cartManager.cart.length === 0) {
      showToast("Your shopping bag is empty.", "error", "🛍️");
      return;
    }

    // Auto-fill customer details from logged in profile if available
    const u = (window.authManager && window.authManager.isLoggedIn && window.authManager.isLoggedIn()) 
      ? window.authManager.getUser() 
      : null;
    const nameInp = document.getElementById('cust-name');
    const phoneInp = document.getElementById('cust-phone');
    if (nameInp && u && u.name) nameInp.value = u.name;
    if (phoneInp && u && u.phone) phoneInp.value = u.phone;

    const totalPaid = cartManager.getTotal();
    const checkoutTotal = document.getElementById('checkout-final-total');
    if (checkoutTotal) checkoutTotal.textContent = formatCurrency(totalPaid);

    // Prepare live UPI QR
    updateCheckoutUPI(totalPaid);

    stepAddress.classList.remove('hidden');
    stepSuccess.classList.add('hidden');
    modal.classList.remove('hidden');
    backdrop.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
  }

  function closeCheckout() {
    modal.classList.add('hidden');
    backdrop.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
  }

  window.openCheckout = openCheckout;
  window.closeCheckout = closeCheckout;

  if (openBtn) openBtn.addEventListener('click', openCheckout);
  if (closeBtn) closeBtn.addEventListener('click', closeCheckout);
  if (backdrop) backdrop.addEventListener('click', closeCheckout);

  if (checkoutForm) {
    checkoutForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('cust-name').value.trim();
      const phone = document.getElementById('cust-phone').value.trim();
      const pincode = document.getElementById('cust-pincode').value.trim();
      const address = document.getElementById('cust-address') ? document.getElementById('cust-address').value.trim() : '';
      const city = document.getElementById('cust-city').value.trim();
      const paymentMethod = document.querySelector('input[name="payment_method"]:checked')?.value || 'UPI';
      const utrInput = document.getElementById('cust-utr');
      const utr = utrInput ? utrInput.value.trim() : '';

      if (!name || !phone || !pincode || !address) {
        showToast("Please fill all required delivery details.", "error", "⚠️");
        return;
      }

      if (paymentMethod === 'UPI' && (!utr || utr.length < 6)) {
        showToast("Please enter your 12-digit UPI UTR / Transaction reference number.", "error", "⚠️");
        utrInput?.focus();
        return;
      }

      const totalPaid = cartManager.getTotal();
      const submitBtn = document.getElementById('checkout-submit-btn');

      const finishOrderSuccess = (createdOrder) => {
        // Store last order for easy 1-click tracking
        localStorage.setItem('rabbit_last_order', JSON.stringify(createdOrder));

        const idEl = document.getElementById('success-order-id');
        const nameEl = document.getElementById('success-customer-name');
        const amtEl = document.getElementById('success-amount-paid');

        if (idEl) idEl.textContent = createdOrder.orderId;
        if (nameEl) nameEl.textContent = name || user.name;
        if (amtEl) amtEl.textContent = formatCurrency(totalPaid);

        if (successTrackBtn) {
          successTrackBtn.onclick = () => {
            closeCheckout();
            window.trackingManager.renderTrackingModal(createdOrder);
          };
        }

        stepAddress.classList.add('hidden');
        stepSuccess.classList.remove('hidden');

        SoundEffects.playSuccess();
        cartManager.clear();
        showToast(`Order Confirmed! Tracking #${createdOrder.orderId}`, "success", "⚡");
      };

      let user = (window.authManager && window.authManager.isLoggedIn && window.authManager.isLoggedIn())
        ? window.authManager.getUser()
        : { id: 'guest-' + Date.now().toString(36), name: name, phone: phone, isGuest: true };

      // Case 1: ONLINE Payment via Razorpay
      if (paymentMethod === 'ONLINE') {
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<span>Opening Razorpay Secure Gateway...</span>';
        }

        try {
          // Pre-create Razorpay order from backend
          let rzpOrder = null;
          try {
            const rzpRes = await fetch('/api/payment/razorpay-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ amount: totalPaid, customerName: name, phone: phone })
            });
            rzpOrder = await rzpRes.json();
          } catch (e) {
            console.warn('Razorpay pre-order warning:', e);
          }

          if (typeof window.Razorpay !== 'undefined') {
            const options = {
              key: (rzpOrder && rzpOrder.key) || 'rzp_test_RABBIT_SHOES_OFFICIAL',
              amount: totalPaid * 100,
              currency: 'INR',
              name: 'Rabbit Shoes Official',
              description: `Payment for Order (${cartManager.cart.length} items)`,
              image: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23ff461e"><path d="M12 2C8.5 2 7 5.5 8 9.5c.5 2 2 3.5 4 3.5s3.5-1.5 4-3.5C17 5.5 15.5 2 12 2zm-4.5 10c-2.5 0-4.5 2-4.5 4.5S5 21 7.5 21c1.5 0 2.8-.7 3.6-1.8.6.5 1.3.8 2.1.8.8 0 1.5-.3 2.1-.8.8 1.1 2.1 1.8 3.6 1.8 2.5 0 4.5-2 4.5-4.5S21 12 18.5 12h-11z"/></svg>',
              order_id: (rzpOrder && rzpOrder.orderId) || undefined,
              prefill: {
                name: name || user.name,
                contact: phone || user.phone,
                email: user.email || ''
              },
              theme: {
                color: '#ff461e'
              },
              handler: async function(response) {
                if (submitBtn) submitBtn.innerHTML = '<span>Verifying Payment...</span>';
                try {
                  const createdOrder = await inventoryManager.createOrder({
                    userId: user.id,
                    customerName: name || user.name,
                    phone: phone || user.phone,
                    pincode: pincode,
                    address: address,
                    city: city,
                    items: [...cartManager.cart],
                    totalAmount: totalPaid,
                    discountAmount: cartManager.getDiscountAmount(),
                    couponCode: (cartManager.coupon && cartManager.coupon.code) ? cartManager.coupon.code : null,
                    paymentMethod: 'Online (Razorpay)',
                    paymentId: response.razorpay_payment_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_signature: response.razorpay_signature,
                    utrNumber: `RZP-${response.razorpay_payment_id || Date.now()}`
                  });
                  finishOrderSuccess(createdOrder);
                } catch (err) {
                  showToast("Order placement failed: " + err.message, "error");
                } finally {
                  if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<span>Pay via Razorpay →</span>';
                  }
                }
              },
              modal: {
                ondismiss: function() {
                  if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<span>Pay via Razorpay →</span>';
                  }
                  showToast("Payment window closed. You can retry or choose another payment method.", "info");
                }
              }
            };

            const rzp = new window.Razorpay(options);
            rzp.on('payment.failed', function (response) {
              if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<span>Pay via Razorpay →</span>';
              }
              showToast(`Payment declined: ${response.error?.description || 'Transaction unsuccessful'}`, "error");
            });
            rzp.open();
            return;
          } else {
            showToast("Secure payment gateway is unavailable or blocked by browser extensions. Please choose UPI or Cash on Delivery.", "error", "⚠️");
            return;
          }
        } catch (err) {
          showToast(err.message || 'Payment initiation failed', "error");
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>Pay via Razorpay →</span>';
          }
        }
        return;
      }

      // Case 2 & 3: UPI or Cash on Delivery (COD)
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Processing Order...</span>';
      }

      try {
        let createdOrder = null;
        if (typeof inventoryManager !== 'undefined') {
          createdOrder = await inventoryManager.createOrder({
            userId: user.id,
            customerName: name || user.name,
            phone: phone || user.phone,
            pincode: pincode,
            address: address,
            city: city,
            items: [...cartManager.cart],
            totalAmount: totalPaid,
            discountAmount: cartManager.getDiscountAmount(),
            couponCode: (cartManager.coupon && cartManager.coupon.code) ? cartManager.coupon.code : null,
            paymentMethod: paymentMethod,
            utrNumber: utr || null
          });
        }

        if (!createdOrder) throw new Error('Order creation failed');
        finishOrderSuccess(createdOrder);
      } catch (err) {
        showToast(err.message || 'Could not complete order', "error", "⚠️");
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = paymentMethod === 'COD' 
            ? '<span>Confirm Cash on Delivery Order →</span>' 
            : '<span>Submit UTR & Confirm Order →</span>';
        }
      }
    });
  }
}

// Payment method toggle handler
window.togglePaymentBox = function(method) {
  const upiPanel = document.getElementById('upi-payment-panel');
  const onlinePanel = document.getElementById('online-payment-panel');
  const codPanel = document.getElementById('cod-payment-panel');

  const labelUPI = document.getElementById('payment-label-upi');
  const labelOnline = document.getElementById('payment-label-online');
  const labelCOD = document.getElementById('payment-label-cod');

  const radio = document.querySelector(`input[name="payment_method"][value="${method}"]`);
  if (radio) radio.checked = true;

  const submitBtn = document.getElementById('checkout-submit-btn');

  // Hide all panels
  if (upiPanel) upiPanel.classList.add('hidden');
  if (onlinePanel) onlinePanel.classList.add('hidden');
  if (codPanel) codPanel.classList.add('hidden');

  const inactiveClass = 'cursor-pointer border border-gray-300 bg-gray-50 p-2.5 rounded-xl text-gray-600 hover:text-black flex flex-col items-center justify-center gap-0.5 transition-all';
  const activeClass = 'cursor-pointer border-2 border-[#ff461e] bg-orange-50 p-2.5 rounded-xl text-[#ff461e] flex flex-col items-center justify-center gap-0.5 transition-all';

  if (labelUPI) labelUPI.className = inactiveClass;
  if (labelOnline) labelOnline.className = inactiveClass;
  if (labelCOD) labelCOD.className = inactiveClass;

  if (method === 'UPI') {
    if (upiPanel) upiPanel.classList.remove('hidden');
    if (labelUPI) labelUPI.className = activeClass;
    if (submitBtn) submitBtn.innerHTML = '<span>Submit UTR & Confirm Order →</span>';
  } else if (method === 'ONLINE') {
    if (onlinePanel) onlinePanel.classList.remove('hidden');
    if (labelOnline) labelOnline.className = activeClass;
    if (submitBtn) submitBtn.innerHTML = '<span>Pay via Razorpay →</span>';
  } else {
    // COD
    if (codPanel) codPanel.classList.remove('hidden');
    if (labelCOD) labelCOD.className = activeClass;
    if (submitBtn) submitBtn.innerHTML = '<span>Confirm Cash on Delivery Order →</span>';
  }
  SoundEffects.playPop();
};

function updateCheckoutUPI(amount) {
  const settings = (typeof inventoryManager !== 'undefined') ? inventoryManager.getSettings() : {};
  const upiId = settings.upiId || 'rabbitshoes@okhdfcbank';
  const merchant = settings.upiMerchantName || 'Rabbit Shoes Official';

  const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(merchant)}&am=${amount}&cu=INR&tn=Rabbit%20Shoes%20Order`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiUri)}`;

  const qrImg = document.getElementById('checkout-upi-qr');
  const upiIdDisplay = document.getElementById('checkout-upi-id-display');
  const amountDisplay = document.getElementById('checkout-upi-amount-display');
  const intentLink = document.getElementById('upi-intent-link');

  if (qrImg) qrImg.src = qrUrl;
  if (upiIdDisplay) upiIdDisplay.textContent = upiId;
  if (amountDisplay) amountDisplay.textContent = formatCurrency(amount);
  if (intentLink) intentLink.href = upiUri;
}

window.copyUPIId = function() {
  const settings = (typeof inventoryManager !== 'undefined') ? inventoryManager.getSettings() : {};
  const upiId = settings.upiId || 'rabbitshoes@okhdfcbank';
  navigator.clipboard.writeText(upiId).then(() => {
    showToast("UPI ID Copied to clipboard!", "success", "📋");
  });
};

window.copySuccessOrderId = function() {
  const idEl = document.getElementById('success-order-id');
  if (!idEl || !idEl.textContent) return;
  const id = idEl.textContent.trim();
  navigator.clipboard.writeText(id).then(() => {
    showToast(`Order ID #${id} copied to clipboard!`, "success", "📋");
  }).catch(() => {
    showToast(`Order ID: #${id}`, "info", "📋");
  });
};

// ================= CUSTOMER AUTH MODAL & NAV UI =================
function initAuthUI() {
  updateNavAuthUI();

  const loginForm = document.getElementById('auth-login-form');
  const regForm = document.getElementById('auth-register-form');
  const forgotForm = document.getElementById('auth-forgot-form');

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const identifier = document.getElementById('auth-login-identifier').value.trim();
      const pass = document.getElementById('auth-login-password').value;

      const res = await window.authManager.login(identifier, pass);
      if (res.success) {
        showToast(`Welcome back, ${res.user.name}!`, "success", "👤");
        closeAuthModal();
        if (window.AppState && window.AppState.pendingCheckout) {
          window.AppState.pendingCheckout = false;
          setTimeout(() => {
            document.getElementById('open-checkout-btn')?.click();
          }, 200);
        }
      } else {
        showToast(res.error || "Login failed", "error", "⚠️");
      }
    });
  }

  if (regForm) {
    regForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('auth-reg-name').value.trim();
      const phone = document.getElementById('auth-reg-phone').value.trim();
      const email = document.getElementById('auth-reg-email').value.trim();
      const pass = document.getElementById('auth-reg-password').value;

      const res = await window.authManager.register(name, phone, email, pass);
      if (res.success) {
        showToast(`Account created! Welcome, ${res.user.name}!`, "success", "🎉");
        closeAuthModal();
        if (window.AppState && window.AppState.pendingCheckout) {
          window.AppState.pendingCheckout = false;
          setTimeout(() => {
            document.getElementById('open-checkout-btn')?.click();
          }, 200);
        }
      } else {
        showToast(res.error || "Registration failed", "error", "⚠️");
      }
    });
  }

  const stage1Form = document.getElementById('forgot-stage-1-form');
  const stage2Form = document.getElementById('forgot-stage-2-form');
  const resendOtpBtn = document.getElementById('btn-resend-otp');

  if (stage1Form) {
    stage1Form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const identifier = document.getElementById('auth-forgot-identifier').value.trim();
      if (!identifier) {
        showToast("Please enter your registered mobile number or email.", "error", "⚠️");
        return;
      }

      const btn = document.getElementById('btn-request-otp');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<span class="inline-block animate-spin mr-1">⏳</span> Sending OTP...`;
      }

      const res = await window.authManager.requestPasswordResetOtp(identifier);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `Send 6-Digit OTP Code`;
      }

      if (res.success) {
        showToast(res.message || "OTP sent successfully! Please check SMS.", "success", "📲");
        const sessInput = document.getElementById('auth-forgot-session-id');
        if (sessInput) sessInput.value = res.sessionId;
        const feedbackEl = document.getElementById('otp-sent-feedback');
        if (feedbackEl) feedbackEl.textContent = res.message || "OTP code sent to your mobile. Enter below.";
        stage1Form.classList.add('hidden');
        if (stage2Form) {
          stage2Form.classList.remove('hidden');
          const otpInput = document.getElementById('auth-forgot-otp');
          if (otpInput) {
            otpInput.value = '';
            otpInput.focus();
          }
        }
      } else {
        showToast(res.error || "Failed to request OTP code.", "error", "⚠️");
      }
    });
  }

  if (stage2Form) {
    stage2Form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const sessionId = document.getElementById('auth-forgot-session-id').value;
      const otp = document.getElementById('auth-forgot-otp').value.trim();
      const newPass = document.getElementById('auth-forgot-password').value;
      const confirmPass = document.getElementById('auth-forgot-confirm').value;

      if (!otp || otp.length !== 6) {
        showToast("Please enter the complete 6-digit OTP code.", "error", "⚠️");
        return;
      }

      if (newPass.length < 6) {
        showToast("New password must be at least 6 characters long.", "error", "⚠️");
        return;
      }

      if (newPass !== confirmPass) {
        showToast("Passwords do not match! Please verify both fields.", "error", "⚠️");
        return;
      }

      const btn = document.getElementById('btn-verify-otp-reset');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<span class="inline-block animate-spin mr-1">⏳</span> Verifying & Updating...`;
      }

      const res = await window.authManager.verifyPasswordResetOtp(sessionId, otp, newPass);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `Verify OTP & Reset Password`;
      }

      if (res.success) {
        showToast(res.message || "Password reset successful! Please log in.", "success", "🔑");
        switchAuthTab('login');
        const loginId = document.getElementById('auth-login-identifier');
        const identInput = document.getElementById('auth-forgot-identifier');
        if (loginId && identInput) loginId.value = identInput.value.trim();
        const loginPass = document.getElementById('auth-login-password');
        if (loginPass) {
          loginPass.value = '';
          loginPass.focus();
        }
      } else {
        showToast(res.error || "Failed to verify OTP.", "error", "⚠️");
      }
    });
  }

  if (resendOtpBtn) {
    resendOtpBtn.addEventListener('click', async () => {
      const identifier = document.getElementById('auth-forgot-identifier').value.trim();
      if (!identifier) {
        showToast("Enter registered mobile number.", "error", "⚠️");
        return;
      }
      resendOtpBtn.disabled = true;
      resendOtpBtn.textContent = 'Sending new OTP...';
      const res = await window.authManager.requestPasswordResetOtp(identifier);
      resendOtpBtn.disabled = false;
      resendOtpBtn.textContent = 'Resend OTP Code';
      if (res.success) {
        showToast("New OTP sent to your registered mobile number!", "success", "📲");
        const sessInput = document.getElementById('auth-forgot-session-id');
        if (sessInput) sessInput.value = res.sessionId;
      } else {
        showToast(res.error || "Failed to resend OTP.", "error", "⚠️");
      }
    });
  }
}

function updateNavAuthUI() {
  const slot = document.getElementById('nav-auth-slot');
  if (!slot) return;

  if (window.authManager && window.authManager.isLoggedIn()) {
    const u = window.authManager.getUser();
    slot.innerHTML = `
      <div class="flex items-center gap-1">
        <button 
          type="button" 
          onclick="openMyOrdersModal()"
          class="flex items-center gap-1.5 text-xs font-bold text-gray-800 hover:text-[#ff461e] p-1.5 sm:px-2.5 sm:py-1.5 rounded-full sm:rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
          title="View My Orders"
        >
          <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span class="hidden sm:inline truncate max-w-[90px]">${(u.name || 'Account').split(' ')[0]}</span>
          <span class="bg-[#ff461e] text-white text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full">Orders</span>
        </button>
        <button 
          type="button" 
          onclick="window.authManager.logout(); showToast('Logged out successfully.', 'info', '👋');"
          class="text-gray-400 hover:text-red-500 p-1.5 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
          title="Sign Out"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
        </button>
      </div>
    `;
  } else {
    slot.innerHTML = `
      <button 
        type="button" 
        onclick="openAuthModal('login')"
        class="flex items-center gap-1.5 text-xs font-bold text-gray-700 hover:text-[#ff461e] p-2 sm:px-3 sm:py-2 rounded-full sm:rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
        title="Sign In / Register"
      >
        <svg class="w-5 h-5 text-gray-700 hover:text-[#ff461e]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
        <span class="hidden sm:inline">Sign In</span>
      </button>
    `;
  }
}

window.openAuthModal = function(mode = 'login') {
  const modal = document.getElementById('customer-auth-modal');
  const backdrop = document.getElementById('customer-auth-backdrop');
  switchAuthTab(mode);
  if (modal) modal.classList.remove('hidden');
  if (backdrop) backdrop.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
};

window.closeAuthModal = function() {
  const modal = document.getElementById('customer-auth-modal');
  const backdrop = document.getElementById('customer-auth-backdrop');
  if (modal) modal.classList.add('hidden');
  if (backdrop) backdrop.classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
};

window.switchAuthTab = function(tab) {
  const btnLog = document.getElementById('auth-tab-login');
  const btnReg = document.getElementById('auth-tab-register');
  const formLog = document.getElementById('auth-login-form');
  const formReg = document.getElementById('auth-register-form');
  const formForgot = document.getElementById('auth-forgot-form');
  const title = document.getElementById('auth-modal-title');

  if (tab === 'login') {
    if (btnLog) btnLog.className = 'flex-1 py-1.5 rounded-lg text-xs font-bold uppercase transition-all bg-[#ff461e] text-white shadow-xs';
    if (btnReg) btnReg.className = 'flex-1 py-1.5 rounded-lg text-xs font-bold uppercase text-gray-600 hover:text-black transition-all';
    if (formLog) formLog.classList.remove('hidden');
    if (formReg) formReg.classList.add('hidden');
    if (formForgot) formForgot.classList.add('hidden');
    if (title) title.textContent = 'Customer Sign In';
  } else if (tab === 'register') {
    if (btnReg) btnReg.className = 'flex-1 py-1.5 rounded-lg text-xs font-bold uppercase transition-all bg-[#ff461e] text-white shadow-xs';
    if (btnLog) btnLog.className = 'flex-1 py-1.5 rounded-lg text-xs font-bold uppercase text-gray-600 hover:text-black transition-all';
    if (formReg) formReg.classList.remove('hidden');
    if (formLog) formLog.classList.add('hidden');
    if (formForgot) formForgot.classList.add('hidden');
    if (title) title.textContent = 'Create New Account';
  } else if (tab === 'forgot') {
    if (btnLog) btnLog.className = 'flex-1 py-1.5 rounded-lg text-xs font-bold uppercase text-gray-600 hover:text-black transition-all';
    if (btnReg) btnReg.className = 'flex-1 py-1.5 rounded-lg text-xs font-bold uppercase text-gray-600 hover:text-black transition-all';
    if (formLog) formLog.classList.add('hidden');
    if (formReg) formReg.classList.add('hidden');
    if (formForgot) formForgot.classList.remove('hidden');
    const s1 = document.getElementById('forgot-stage-1-form');
    const s2 = document.getElementById('forgot-stage-2-form');
    if (s1) s1.classList.remove('hidden');
    if (s2) s2.classList.add('hidden');
    if (title) title.textContent = 'Reset Password via OTP';
  }
};

// ================= MY ORDERS DRAWER =================
window.openMyOrdersModal = async function() {
  if (!window.authManager || !window.authManager.isLoggedIn()) {
    openAuthModal('login');
    return;
  }

  const modal = document.getElementById('my-orders-modal');
  const backdrop = document.getElementById('my-orders-backdrop');
  const listContainer = document.getElementById('my-orders-list');

  if (modal) modal.classList.remove('hidden');
  if (backdrop) backdrop.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');

  if (listContainer) {
    listContainer.innerHTML = `
      <div class="text-center py-8 text-zinc-400 text-xs font-mono">
        <span class="inline-block animate-spin mr-2">⏳</span> Loading your orders...
      </div>
    `;

    const orders = await window.trackingManager.fetchMyOrders();
    if (orders.length === 0) {
      listContainer.innerHTML = `
        <div class="text-center py-12 text-zinc-500 space-y-2">
          <span class="text-3xl block">👟</span>
          <p class="text-xs font-medium text-zinc-300">You haven't placed any orders yet.</p>
          <p class="text-[11px] text-zinc-500">Pick a pair from our drops and experience ultra-fast dispatch.</p>
        </div>
      `;
      return;
    }

    const statusBadge = {
      'Pending': 'bg-amber-50 text-amber-700 border border-amber-300',
      'Processing': 'bg-blue-50 text-blue-700 border border-blue-300',
      'Shipped': 'bg-purple-50 text-purple-700 border border-purple-300',
      'Delivered': 'bg-emerald-50 text-emerald-700 border border-emerald-300'
    };

    listContainer.innerHTML = orders.map(order => {
      const safeId = escapeHtml(order.orderId);
      const safeStatus = escapeHtml(order.orderStatus);
      return `
      <div class="bg-white border border-gray-200 rounded-xl p-3.5 sm:p-4 space-y-2.5 hover:shadow-md transition-all shadow-sm">
        <div class="flex items-center justify-between pb-2 border-b border-gray-100">
          <div>
            <span class="font-mono font-bold text-xs text-gray-900">${safeId}</span>
            <p class="text-[10px] text-gray-500 font-mono">${new Date(order.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</p>
          </div>
          <div class="flex items-center gap-2">
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${statusBadge[order.orderStatus] || 'bg-gray-100 text-gray-600'}">
              ${safeStatus}
            </span>
          </div>
        </div>

        <!-- Items Summary -->
        <div class="space-y-1">
          ${(order.items || []).map(it => `
            <div class="flex items-center gap-2 text-xs">
              ${it.image ? `<img src="${encodeURI(it.image)}" alt="" class="w-6 h-6 object-contain rounded bg-gray-50 border border-gray-100" />` : ''}
              <span class="text-gray-900 font-medium truncate flex-1">${escapeHtml(it.name)}</span>
              <span class="text-gray-500 font-mono text-[10px]">UK ${escapeHtml(it.size)} x${Number(it.quantity || 1)}</span>
              <span class="font-mono font-bold text-[#ff461e] text-xs">${formatCurrency(it.price * it.quantity)}</span>
            </div>
          `).join('')}
        </div>

        <div class="pt-2 border-t border-gray-100 flex items-center justify-between">
          <div>
            <span class="text-[10px] text-gray-500">Total: <strong class="text-gray-900 font-mono">${formatCurrency(order.totalAmount)}</strong></span>
            <span class="text-[10px] text-gray-400 ml-2 font-mono">(${escapeHtml(order.paymentMethod)})</span>
          </div>
          <button 
            type="button" 
            onclick="closeMyOrdersModal(); window.trackingManager.trackOrderById('${safeId}');"
            class="btn-volt px-3 py-1 rounded-lg text-[11px] font-bold uppercase cursor-pointer flex items-center gap-1 shadow-sm"
          >
            <span>📍 Track Trajectory</span>
          </button>
        </div>
      </div>
    `;
    }).join('');
  }
};

window.closeMyOrdersModal = function() {
  const modal = document.getElementById('my-orders-modal');
  const backdrop = document.getElementById('my-orders-backdrop');
  if (modal) modal.classList.add('hidden');
  if (backdrop) backdrop.classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
};

// ================= PUBLIC TRACK ORDER LOOKUP =================
window.openPublicTrackModal = function() {
  const modal = document.getElementById('public-track-modal');
  const backdrop = document.getElementById('public-track-backdrop');
  if (modal) modal.classList.remove('hidden');
  if (backdrop) backdrop.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');

  // Auto-fill from last placed order or logged-in profile
  const idInp = document.getElementById('public-track-id');
  const phoneInp = document.getElementById('public-track-phone');
  const lastOrderStr = localStorage.getItem('rabbit_last_order');
  if (lastOrderStr) {
    try {
      const lo = JSON.parse(lastOrderStr);
      if (idInp && !idInp.value) idInp.value = lo.orderId || '';
      if (phoneInp && !phoneInp.value) phoneInp.value = lo.phone || '';
    } catch(e) {}
  } else if (window.authManager && window.authManager.isLoggedIn()) {
    const u = window.authManager.getUser();
    if (phoneInp && !phoneInp.value) phoneInp.value = u.phone || '';
  }

  const form = document.getElementById('public-track-form');
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const orderId = document.getElementById('public-track-id').value.trim();
      const phone = document.getElementById('public-track-phone').value.trim();

      const res = await window.trackingManager.trackOrder(orderId, phone);
      if (res.success) {
        closePublicTrackModal();
        window.trackingManager.renderTrackingModal(res.order);
      } else {
        showToast(res.error || "No order found with these credentials.", "error", "⚠️");
      }
    };
  }
};

window.closePublicTrackModal = function() {
  const modal = document.getElementById('public-track-modal');
  const backdrop = document.getElementById('public-track-backdrop');
  if (modal) modal.classList.add('hidden');
  if (backdrop) backdrop.classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
};

// URL Query Param Actions (Deep-linking & automated preview)
window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('action') === 'checkout_preview') {
    setTimeout(() => {
      if (typeof cartManager !== 'undefined' && cartManager.cart.length === 0) {
        cartManager.addItem({
          id: 'neeman-crv-002',
          name: "Neeman's Curve Knit Slip-Ons",
          price: 1699,
          originalPrice: 3999,
          size: 8,
          color: { name: 'Ivory Brown', hex: '#fdfbf7', image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800&q=80' },
          image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800&q=80'
        });
      }
      if (window.openCheckout) window.openCheckout();
      const tab = params.get('pay');
      if (tab && window.togglePaymentBox) {
        setTimeout(() => window.togglePaymentBox(tab.toUpperCase()), 200);
      }
    }, 350);
  }
});

// ================= FOOTER LINKS & STORE POLICY MODALS =================
window.filterByCategory = function(category) {
  AppState.category = category || 'all';
  const pills = document.querySelectorAll('.category-pill');
  pills.forEach(p => {
    const isSelected = (p.dataset.category === AppState.category);
    p.classList.toggle('active', isSelected);
  });
  renderProducts();
  const sec = document.getElementById('products-section');
  if (sec) sec.scrollIntoView({ behavior: 'smooth' });
};

const STORE_POLICIES = {
  return: {
    icon: '🔄',
    title: '7-Day Return & Size Exchange Policy',
    subtitle: '100% Risk-Free Guarantee for Every Order',
    html: `
      <div class="space-y-2">
        <p><strong>1. Easy 7-Day Window:</strong> If the shoe size doesn't fit comfortably or you wish to exchange, initiate a request within 7 days of delivery.</p>
        <p><strong>2. Free Doorstep Pickup:</strong> Our logistics partner will pick up the footwear package directly from your home address within 24-48 business hours.</p>
        <p><strong>3. Instant Exchange / Refund:</strong> Once picked up, your replacement pair is dispatched immediately or refund is credited directly to your UPI/Bank account.</p>
        <p class="text-gray-500 text-[11px]">Note: Footwear must be in original condition with brand box and tags intact.</p>
      </div>
    `
  },
  shipping: {
    icon: '⚡',
    title: 'Pan-India Express Delivery',
    subtitle: 'Fast, Insured Logistics to 28,000+ Indian Pincodes',
    html: `
      <div class="space-y-2">
        <p><strong>1. Free Shipping:</strong> Enjoy 100% free delivery across India on prepaid and COD orders.</p>
        <p><strong>2. Same-Day Dispatch:</strong> Orders placed before 4:00 PM IST are packed and handed over to our transport partner the same day.</p>
        <p><strong>3. Delivery Timelines:</strong> Metro cities: 2-3 business days. Rest of India: 3-5 business days.</p>
        <p><strong>4. Real-Time Tracking:</strong> Receive live SMS updates with active courier AWB (Ekart / Delhivery / BlueDart).</p>
      </div>
    `
  },
  faqs: {
    icon: '💳',
    title: 'Instant UPI & Payment FAQs',
    subtitle: 'Zero Surcharges • 100% RBI Compliant Safety',
    html: `
      <div class="space-y-2">
        <p><strong>Q: What payment options are supported?</strong><br/>A: We accept Dynamic UPI QR (Google Pay, PhonePe, Paytm, BHIM, Cred), RuPay/Visa/MasterCard, Net Banking, and Cash on Delivery (COD).</p>
        <p><strong>Q: How does Instant UPI payment work?</strong><br/>A: When you choose UPI at checkout, a dynamic QR code appears on screen. Scan it with any UPI mobile app to approve payment securely without typing card credentials.</p>
        <p><strong>Q: Is Cash on Delivery (COD) available in my area?</strong><br/>A: Yes! We provide Cash on Delivery across all major Indian pincodes. Simply hand payment to delivery executive upon receiving parcel.</p>
      </div>
    `
  },
  contact: {
    icon: '📞',
    title: 'Customer Support & Dispatch Hub',
    subtitle: 'Dedicated Indian Support Team',
    html: `
      <div class="space-y-2">
        <p><strong>WhatsApp Support:</strong> <a href="https://wa.me/919828682274" target="_blank" class="text-[#ff461e] font-bold underline">+91 9828682274</a> (Instant assistance)</p>
        <p><strong>Email Support:</strong> support@rabbitshoes.in</p>
        <p><strong>Operating Hours:</strong> Monday – Saturday, 10:00 AM – 8:00 PM IST</p>
        <p><strong>Central Dispatch Hub:</strong> Rabbit Activewear Hub, Mansarovar Industrial Area, Jaipur, Rajasthan - 302020</p>
      </div>
    `
  },
  privacy: {
    icon: '🔒',
    title: 'Privacy & Data Protection',
    subtitle: 'Customer Information Security Promise',
    html: `
      <div class="space-y-2">
        <p><strong>1. Strict Confidentiality:</strong> Your contact number, delivery address, and order details are encrypted and utilized solely for courier dispatch and delivery tracking.</p>
        <p><strong>2. Zero Data Sharing:</strong> We never sell, lease, or distribute your personal information to third-party telemarketers or ad brokers.</p>
        <p><strong>3. Industry Encryption:</strong> All checkout sessions and payment authorizations use 256-bit SSL/TLS encryption.</p>
      </div>
    `
  },
  terms: {
    icon: '📜',
    title: 'Terms of Service & Quality Guarantee',
    subtitle: 'Engineered High-Performance Footwear',
    html: `
      <div class="space-y-2">
        <p><strong>1. Genuine Product Promise:</strong> All footwear sold on the Rabbit storefront is 100% authentic, featuring ergonomic Nitrofly soles and breathable knits.</p>
        <p><strong>2. 60-Day Sole Bonding Warranty:</strong> If any sole bonding or manufacturing defect occurs within 60 days of purchase, we will replace the pair completely free of charge.</p>
        <p><strong>3. Order Cancellation:</strong> You may cancel any unfulfilled order prior to courier dispatch by contacting support with your Order ID.</p>
      </div>
    `
  }
};

window.openStorePolicyModal = function(type) {
  const modal = document.getElementById('store-policy-modal');
  const backdrop = document.getElementById('store-policy-backdrop');
  const policy = STORE_POLICIES[type] || STORE_POLICIES['return'];

  const iconEl = document.getElementById('store-policy-icon');
  const titleEl = document.getElementById('store-policy-title');
  const subtitleEl = document.getElementById('store-policy-subtitle');
  const bodyEl = document.getElementById('store-policy-body');

  if (iconEl) iconEl.textContent = policy.icon;
  if (titleEl) titleEl.textContent = policy.title;
  if (subtitleEl) subtitleEl.textContent = policy.subtitle;
  if (bodyEl) bodyEl.innerHTML = policy.html;

  if (modal) modal.classList.remove('hidden');
  if (backdrop) backdrop.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
};

window.closeStorePolicyModal = function() {
  const modal = document.getElementById('store-policy-modal');
  const backdrop = document.getElementById('store-policy-backdrop');
  if (modal) modal.classList.add('hidden');
  if (backdrop) backdrop.classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
};

window.handleNewsletterSubscribe = function(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('newsletter-email');
  if (!input || !input.value.trim()) return;
  const email = input.value.trim();
  showToast(`🎉 Subscribed with ${email}! Welcome to Rabbit Club.`, 'success');
  input.value = '';
};

