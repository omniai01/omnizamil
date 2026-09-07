# ShiftZero — Website & Software Distribution Platform

A sleek, ultra-minimalist, high-performance website inspired by modern zero-friction software distribution platforms.

## Architecture

- **Frontend**: React 18, Vite, Lucide Icons, Custom CSS Glassmorphism system (Dark Mode).
- **Backend API & Admin**: Express.js server providing tracked download redirects (`/api/download`), JSON product database management (`/data/products.json`), and password-protected Admin controls (`/api/admin/login`, `/api/admin/update-product`).
- **Brand**: **ShiftZero** (*Small tools. Nothing to buy.*)

## Getting Started

### 1. Install Dependencies
```bash
cd website
npm install
```

### 2. Run Backend Admin & API Server
```bash
npm run server
```
Runs on `http://localhost:5000`

### 3. Run Frontend Development Server
```bash
npm run dev
```
Runs on `http://localhost:3000` (proxies `/api` requests to backend).

## Admin Backend

- Click **Admin** in the header navigation or open the Admin Modal.
- Allows real-time updating of:
  - Windows x64 & ARM64 installer links
  - macOS Apple Silicon & Intel DMG links
  - Software version tags (e.g. `v1.5.0` -> `v1.6.0`)
