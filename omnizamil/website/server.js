import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const DATA_FILE = path.join(__dirname, 'data', 'products.json');
const LOGO_PATH = 'C:\\Users\\musta\\.gemini\\antigravity-ide\\brain\\68167457-885d-4e1c-81eb-df49534f17dc\\shiftzero_competitor_style_logo_v1_1788663222594.jpg';

app.use(cors());
app.use(express.json());

// Serve static frontend files if built
app.use(express.static(path.join(__dirname, 'dist')));

// Helper to read products
function getProducts() {
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading products:', err);
    return [];
  }
}

// Helper to save products
function saveProducts(products) {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(products, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error saving products:', err);
    return false;
  }
}

// API: Download Logo Image File
app.get('/api/download-logo', (req, res) => {
  if (fs.existsSync(LOGO_PATH)) {
    return res.download(LOGO_PATH, 'shiftzero_vector_logo.jpg');
  }
  return res.status(404).json({ error: 'Logo file not found' });
});

// API: Get all products
app.get('/api/products', (req, res) => {
  const products = getProducts();
  res.json({ success: true, data: products });
});

// API: Tracked Download Endpoint
app.get('/api/download', (req, res) => {
  const { product, platform, arch, url } = req.query;
  const products = getProducts();
  const target = products.find(p => p.id === product);

  if (target && target.downloads?.[platform]?.[arch]) {
    const downloadUrl = url || target.downloads[platform][arch];
    return res.redirect(downloadUrl);
  }

  if (url) {
    return res.redirect(url);
  }

  return res.status(404).json({ error: 'Download link not found' });
});

// API: Admin Authentication
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  const ADMIN_KEY = process.env.ADMIN_SECRET || 'admin123';

  if (password === ADMIN_KEY) {
    return res.json({ success: true, token: 'session-' + Date.now() });
  }
  return res.status(401).json({ success: false, error: 'Invalid password' });
});

// API: Update Product Download Links / Version (Admin action)
app.post('/api/admin/update-product', (req, res) => {
  const { auth, productId, version, downloads } = req.body;

  if (!auth) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const products = getProducts();
  const index = products.findIndex(p => p.id === productId);

  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Product not found' });
  }

  if (version) products[index].version = version;
  if (downloads) products[index].downloads = { ...products[index].downloads, ...downloads };

  if (saveProducts(products)) {
    return res.json({ success: true, product: products[index] });
  } else {
    return res.status(500).json({ success: false, error: 'Failed to write data' });
  }
});

// Fallback for SPA routing
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'dist', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send('Backend Server Running.');
  }
});

app.listen(PORT, () => {
  console.log(`[ShiftZero Web API] Server running on http://localhost:${PORT}`);
});
