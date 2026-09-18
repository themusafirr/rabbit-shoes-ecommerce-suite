<div align="center">

# 👟 Rabbit Shoes: Production E-Commerce Storefront & Merchant Operations Suite

**Full-Featured Retail Footwear E-Commerce Platform with WhatsApp Checkout, Real-Time Admin ERP & Automated GST Invoicing**

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.x-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://docker.com)
[![Nginx](https://img.shields.io/badge/Nginx-Reverse_Proxy-009639?style=for-the-badge&logo=nginx&logoColor=white)](https://nginx.org)
[![License: Commercial / Open](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

<br/>

[![Live Production VPS](https://img.shields.io/badge/🌐_Live_Store-shoes.137.23.47.199.sslip.io-00C853?style=for-the-badge&logo=google-chrome&logoColor=white)](https://shoes.137.23.47.199.sslip.io)
[![GitHub Pages Demo](https://img.shields.io/badge/📱_GitHub_Pages-Live_Interactive_Demo-38BDF8?style=for-the-badge&logo=github&logoColor=white)](https://themusafirr.github.io/rabbit-shoes-ecommerce-suite/)
[![Telegram Support](https://img.shields.io/badge/💬_Telegram-@the__musafir-0088cc?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/the_musafir)

<br/>

[⭐ Star This Repo](https://github.com/themusafirr/rabbit-shoes-ecommerce-suite) • [🌐 Live Store](https://shoes.137.23.47.199.sslip.io) • [📱 GitHub Demo](https://themusafirr.github.io/rabbit-shoes-ecommerce-suite/) • [💬 Contact Developer](https://t.me/the_musafir)

<br/><br/>

<img src="./assets/preview.png" width="100%" alt="Rabbit Shoes E-Commerce Live UI Preview" style="border-radius: 14px; border: 1px solid rgba(255, 255, 255, 0.15); box-shadow: 0 10px 35px rgba(0, 0, 0, 0.6);" />

</div>

---

## ⚡ Overview

**Rabbit Shoes** is a commercial-grade, end-to-end e-commerce software solution custom-built for modern retail businesses and footwear brands.

It combines an ultra-fast client-facing digital storefront with an all-in-one merchant administration panel featuring real-time inventory tracking, multi-variant sizing matrices, dynamic discount rules, automated GST-compliant tax invoices, and instant 1-tap WhatsApp checkout orders.

---

## 📸 Interface Preview

<div align="center">

### 🖥️ Customer Digital Storefront
<img src="./docs/screenshots/desktop_storefront.png" width="85%" alt="Desktop Storefront" style="border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);" />

<br/><br/>

### 📱 Responsive Mobile Experience & 🛒 Instant Checkout
<p float="left">
  <img src="./docs/screenshots/mobile_storefront.png" width="45%" alt="Mobile Storefront" style="border-radius: 8px;" />
  <img src="./docs/screenshots/checkout_flow.png" width="45%" alt="Checkout Flow" style="border-radius: 8px;" />
</p>

<br/>

### 📊 Merchant Admin Dashboard & 🧾 Automated GST Invoice
<p float="left">
  <img src="./docs/screenshots/admin_orders.png" width="48%" alt="Admin Order Management" style="border-radius: 8px;" />
  <img src="./docs/screenshots/gst_invoice.png" width="48%" alt="GST Tax Invoice" style="border-radius: 8px;" />
</p>

</div>

---

## ✨ Core System Capabilities

### 1. 🛍️ Digital Storefront (`index.html`)
- **Interactive Product Catalog:** Category filtering (Sneakers, Running, Formal, Sports, Casual).
- **Dynamic Size & Color Selector:** Real-time stock status based on selected size variant (UK 6 to UK 11).
- **Product Quick-View Modal:** Instant previews with zoomable galleries, sizing guides, and specifications.
- **Direct 1-Click WhatsApp Ordering:** Automatically generates formatted WhatsApp messages pre-filled with order items, selected size, customer delivery address, and total price.
- **Online Checkout Integration:** Seamlessly supports UPI, Cards, and Net Banking options.

### 2. 🛠️ Merchant Operations & Admin Portal (`admin.html`)
- **Live Orders Pipeline:** Filter orders by status (New, Processing, Dispatched, Delivered, Cancelled).
- **Product & Stock Manager:** Instant price adjustments, promotional banner updates, and out-of-stock toggles.
- **Discount & Coupon Engine:** Flat off, percentage discount codes, and flash sale countdown timers.
- **Customer CRM & SMS Notifications:** Automated order confirmation alerts and delivery status updates.

### 3. 🧾 Automated GST Invoicing Engine (`invoice.html`)
- **Compliant Tax Documentation:** Auto-calculates CGST (9%) and SGST (9%) or IGST (18%) based on state origin.
- **Print & PDF Export:** Clean print-ready invoice layout with merchant GSTIN, HSN codes, and unique invoice numbering.

---

## 🏗️ Architecture & Stack

- **Frontend:** Vanilla HTML5, Modern CSS3 (CSS Grid & Flexbox, Campus/Nike-inspired styling), Vanilla JavaScript ES6+.
- **Backend:** Node.js, Express.js REST API (`server.js`).
- **Data Persistence:** JSON-based state store with atomic file writes for zero-downtime reliability.
- **Deployment:** Containerized with `Dockerfile` and `docker-compose.yml`, fronted with Nginx reverse proxy.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm

### Installation
```bash
git clone https://github.com/themusafirr/rabbit-shoes-ecommerce-suite.git
cd rabbit-shoes-ecommerce-suite
npm install
node server.js
```

### Running with Docker Compose
```bash
docker-compose up -d --build
```
The application will be accessible at `http://localhost:3000`.

---

## 👨‍💻 Author & Commercial Inquiries

**Pankaj Kalosiya (@themusafirr)**  
- 💼 GitHub: [github.com/themusafirr](https://github.com/themusafirr)  
- 💬 Telegram: [@the_musafir](https://t.me/the_musafir)  
- 📸 Instagram: [@the.musafirrr__](https://instagram.com/the.musafirrr__)  
- 📧 Email: [musafir.developer@gmail.com](mailto:musafir.developer@gmail.com)  

---

## ⭐ Show Your Support

If you like this project or find it useful as an e-commerce template, please give it a **Star ⭐**!
