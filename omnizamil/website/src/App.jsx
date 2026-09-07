// ShiftZero Desktop Media Engine App
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Box, Play, LayoutGrid, CheckCircle2, UserX, FileX, EyeOff, Zap, DollarSign, X, Settings, Menu, Sparkles,
  Cpu, Monitor, Apple, Layers, Download, ChevronDown, ArrowUp, ShieldCheck, HardDrive, Lock, RefreshCw, Mail,
  Check, ArrowRight, Shield, Globe, Terminal, Code, Image, Plus, Trash2, Edit3, BookOpen, Share2, ExternalLink, Crop, Sliders,
  HelpCircle, MessageSquare, Tag, FileText, Link, CheckSquare, Mic, ShieldAlert, MousePointerClick, Eye, Wand2
} from 'lucide-react';
import SoftwareHeroCard from './components/SoftwareHeroCard';
import {
  loadAnalytics,
  trackVisit,
  trackDwellHeartbeat,
  trackDownloadClick,
  trackDownloadStart,
  trackBlogView,
  formatDwell,
  countryBreakdown
} from './lib/analytics';
import { generateSoftwareCopy } from './lib/groq';

const ADMIN_SECRET_PATH = '/admin-login/12345';
const PRODUCTS_KEY = 'shiftzero_products_v10';
const BLOGS_KEY = 'shiftzero_blogs_v2';
const CATEGORIES_KEY = 'shiftzero_blog_categories_v1';
const SETTINGS_KEY = 'shiftzero_settings_v2';
const MAINTENANCE_KEY = 'shiftzero_maintenance_v1';

const OMNI_WINDOWS_DOWNLOAD =
  'https://github.com/omniai01/omni-removal/releases/latest/download/Omni-Watermark-Removal-Final.exe';
const SHIFTGRAB_WINDOWS_DOWNLOAD =
  'https://github.com/omniai01/shiftgrab/releases/latest/download/ShiftGrab-Final.exe';

/** Always return a direct .exe asset URL — never the GitHub repo/HTML page. */
function directWindowsDownloadUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return OMNI_WINDOWS_DOWNLOAD;
  if (/releases\/latest\/download\//i.test(raw) || /releases\/download\//i.test(raw)) return raw;
  if (/github\.com\/[^/]+\/omni-removal/i.test(raw)) return OMNI_WINDOWS_DOWNLOAD;
  if (/github\.com\/[^/]+\/shiftgrab/i.test(raw)) return SHIFTGRAB_WINDOWS_DOWNLOAD;
  if (/\.exe(\?|$)/i.test(raw)) return raw;
  return raw;
}

const DEFAULT_PRODUCT = {
  id: 'omni-watermark-removal',
  name: 'Omni Removal',
  tagline: 'Clean watermarks from photos and videos on your Windows PC.',
  version: 'v1.0.3',
  description: 'Free, unlimited desktop tool for removing watermarks from images and videos. Runs on your machine — no uploads, no subscription.',
  logoUrl: '/brand/omni-logo-1x1.jpg',
  imageUrl: '/brand/omni-banner-16x9.png',
  aspectRatio: '16:9',
  imageFit: 'cover',
  vramReq: '4GB+ VRAM recommended',
  windowsUrl: OMNI_WINDOWS_DOWNLOAD,
  macUrl: '',
  isFree: true,
  features: [
    'Image & video watermark cleanup',
    'Runs fully on your Windows PC',
    'Free forever — unlimited cleans',
    'No account or cloud upload required'
  ],
  faqs: [
    { q: 'Is Omni Removal free?', a: 'Yes. It is free forever with unlimited local use.' },
    { q: 'Do my files leave my computer?', a: 'No. Cleaning runs on your device.' }
  ]
};

const SHIFTGRAB_PRODUCT = {
  id: 'shiftgrab',
  name: 'ShiftGrab',
  tagline: 'Download YouTube videos and playlists on your Windows PC.',
  version: 'v1.1.4',
  description:
    'On-device YouTube downloader by ShiftZero. Paste a link, pick quality or MP3, and save locally — nothing uploads to ShiftZero servers.',
  logoUrl: '/brand/shiftgrab-logo.png',
  imageUrl: '/brand/shiftgrab-banner-16x9.png',
  aspectRatio: '16:9',
  imageFit: 'cover',
  vramReq: 'Any modern PC',
  windowsUrl: SHIFTGRAB_WINDOWS_DOWNLOAD,
  macUrl: '',
  isFree: true,
  features: [
    'YouTube video & playlist downloads',
    'Quality picker + MP3 audio',
    'Runs fully on your Windows PC',
    'Free forever — no account required'
  ],
  faqs: [
    { q: 'Is ShiftGrab free?', a: 'Yes. Free forever for local use.' },
    { q: 'Do my downloads leave my PC?', a: 'No. Files save directly to folders you choose.' }
  ]
};

const DEFAULT_PRODUCTS = [DEFAULT_PRODUCT, SHIFTGRAB_PRODUCT];

const DEFAULT_BLOGS = [
  {
    id: 'on-device-watermark-cleanup',
    title: 'Why On-Device Watermark Cleanup Beats Cloud Upload Tools',
    category: 'Guides',
    date: '2026-09-02',
    readTime: '5 min read',
    imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
    summary: 'Keep media private: clean watermarks locally instead of uploading files to a remote SaaS.',
    content: `Cloud watermark removers ask you to upload photos and videos to someone else's servers. That adds latency, privacy risk, and often a subscription wall.

Omni Watermark Removal runs on your Windows PC. Files stay local while you clean overlays and marks, then export the result.

What that means for you:
1. No waiting on upload queues.
2. Your media never leaves your machine for processing.
3. Free forever — no per-file credits.`,
    faqs: [
      { q: 'Do I need the internet after install?', a: 'Cleaning works offline. Internet is only needed to download the installer or updates.' }
    ]
  },
  {
    id: 'image-and-video-watermark-tips',
    title: 'Practical Tips for Cleaner Image & Video Watermark Removal',
    category: 'Tutorials',
    date: '2026-08-28',
    readTime: '6 min read',
    imageUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&q=80',
    summary: 'Simple habits that improve watermark cleanup quality on stills and clips.',
    content: `Start with the highest-quality source you have. Heavy compression already damages edges around a watermark.

For images, mark the watermark area carefully and review edges after cleanup.
For video, keep the region stable across frames when the mark stays in one place.

Export a short test clip first, then run the full batch once you like the result.`,
    faqs: [
      { q: 'Can I process batches?', a: 'Yes — queue multiple files and clean them in one session.' }
    ]
  }
];

const DEFAULT_CATEGORIES = ['Guides', 'Tutorials', 'Release Notes', 'AI Technology'];

function readStore(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export default function App() {
  // Preloader State (2-Second Initial Site Splash)
  const [isSiteLoading, setIsSiteLoading] = useState(true);
  const [preloaderLeft, setPreloaderLeft] = useState('');
  const [preloaderRight, setPreloaderRight] = useState('');
  const [preloaderStatusText, setPreloaderStatusText] = useState('Opening…');
  const [preloaderShowCard, setPreloaderShowCard] = useState(false);

  // Software Products — Omni Removal + ShiftGrab by default (admin managed + persisted)
  const [products, setProducts] = useState(() => {
    const saved = readStore(PRODUCTS_KEY, null);
    let list = Array.isArray(saved) && saved.length ? saved : DEFAULT_PRODUCTS;
    list = list.map((p) => {
      if (p?.id === 'omni-watermark-removal' || (/omni/i.test(p?.name || '') && !/shiftgrab/i.test(p?.id || ''))) {
        const staleCover = !p.imageUrl || /unsplash\.com/i.test(p.imageUrl);
        const staleLogo = !p.logoUrl || /githubusercontent\.com|unsplash\.com/i.test(p.logoUrl);
        return {
          ...DEFAULT_PRODUCT,
          ...p,
          name: p.name || DEFAULT_PRODUCT.name,
          version: DEFAULT_PRODUCT.version,
          windowsUrl: OMNI_WINDOWS_DOWNLOAD,
          logoUrl: staleLogo ? DEFAULT_PRODUCT.logoUrl : p.logoUrl,
          imageUrl: staleCover ? DEFAULT_PRODUCT.imageUrl : p.imageUrl,
          aspectRatio: p.aspectRatio || '16:9',
          isFree: true
        };
      }
      if (p?.id === 'shiftgrab' || /shiftgrab/i.test(p?.name || '')) {
        return {
          ...SHIFTGRAB_PRODUCT,
          ...p,
          name: p.name || SHIFTGRAB_PRODUCT.name,
          version: SHIFTGRAB_PRODUCT.version,
          windowsUrl: SHIFTGRAB_WINDOWS_DOWNLOAD,
          logoUrl: p.logoUrl || SHIFTGRAB_PRODUCT.logoUrl,
          imageUrl: p.imageUrl || SHIFTGRAB_PRODUCT.imageUrl,
          aspectRatio: p.aspectRatio || '16:9',
          isFree: true
        };
      }
      return p;
    });
    if (!list.some((p) => p?.id === 'shiftgrab')) list = [...list, SHIFTGRAB_PRODUCT];
    if (!list.some((p) => p?.id === 'omni-watermark-removal')) list = [DEFAULT_PRODUCT, ...list];
    return list;
  });

  // Blogs — trimmed to Omni-relevant posts
  const [blogs, setBlogs] = useState(() => {
    const saved = readStore(BLOGS_KEY, null);
    if (Array.isArray(saved) && saved.length) return saved;
    return DEFAULT_BLOGS;
  });

  const [blogCategories, setBlogCategories] = useState(() => readStore(CATEGORIES_KEY, DEFAULT_CATEGORIES));
  const [newCategoryName, setNewCategoryName] = useState('');

  // Navigation State with Real Browser URL Synchronization
  const [currentPage, setCurrentPage] = useState('home'); // 'home' | 'products' | 'product-detail' | 'technology' | 'how-it-works' | 'privacy' | 'terms' | 'disclaimer' | 'blogs' | 'blog-detail' | 'admin'
  const [selectedProductDetail, setSelectedProductDetail] = useState(null);
  const [selectedBlogDetail, setSelectedBlogDetail] = useState(null);

  // Synchronize browser URL route on page change and initial load
  const parseRouteFromUrl = () => {
    const path = window.location.pathname.toLowerCase().replace(/\/+$/, '') || '/';

    // Secret owner portal only — public /admin is blocked
    if (path === ADMIN_SECRET_PATH || path === '/admin-login/12345') {
      setCurrentPage('admin');
      return;
    }
    if (path === '/admin' || path.startsWith('/admin/')) {
      setCurrentPage('home');
      window.history.replaceState(null, '', '/');
      return;
    }

    if (path === '/products') {
      setCurrentPage('products');
    } else if (path.startsWith('/products/')) {
      const id = path.split('/products/')[1];
      const prod = products.find(p => p.id === id);
      if (prod) {
        setSelectedProductDetail(prod);
        setCurrentPage('product-detail');
      } else {
        setCurrentPage('products');
      }
    } else if (path === '/blogs' || path === '/blog') {
      setCurrentPage('blogs');
    } else if (path.startsWith('/blogs/') || path.startsWith('/blog/')) {
      const parts = path.split('/');
      const id = parts[parts.length - 1];
      const b = blogs.find(x => x.id === id);
      if (b) {
        setSelectedBlogDetail(b);
        setCurrentPage('blog-detail');
      } else {
        setCurrentPage('blogs');
      }
    } else if (path === '/technology') {
      setCurrentPage('technology');
    } else if (path === '/how-it-works') {
      setCurrentPage('how-it-works');
    } else if (path === '/privacy') {
      setCurrentPage('privacy');
    } else if (path === '/terms') {
      setCurrentPage('terms');
    } else if (path === '/disclaimer') {
      setCurrentPage('disclaimer');
    } else {
      setCurrentPage('home');
    }
  };

  useEffect(() => {
    // Fast brand splash: logo pops → type Shift | Zero → soft card → exit (~2s)
    const timeouts = [];
    const intervals = [];
    const typeSide = (word, setter, startDelay, stepMs = 55) => {
      timeouts.push(setTimeout(() => {
        let i = 0;
        const tick = setInterval(() => {
          i += 1;
          setter(word.slice(0, i));
          if (i >= word.length) clearInterval(tick);
        }, stepMs);
        intervals.push(tick);
      }, startDelay));
    };

    typeSide('Shift', setPreloaderLeft, 80);
    typeSide('Zero', setPreloaderRight, 280);

    timeouts.push(setTimeout(() => {
      setPreloaderShowCard(true);
      setPreloaderStatusText('Welcome to ShiftZero');
    }, 700));

    timeouts.push(setTimeout(() => {
      setPreloaderStatusText('Almost ready…');
    }, 1300));

    timeouts.push(setTimeout(() => {
      setIsSiteLoading(false);
    }, 1900));

    parseRouteFromUrl();
    trackVisit().then(({ data }) => setAnalytics(data));

    const dwellTimer = setInterval(() => {
      setAnalytics(trackDwellHeartbeat());
    }, 15000);
    intervals.push(dwellTimer);

    const handlePopState = () => {
      parseRouteFromUrl();
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      timeouts.forEach(clearTimeout);
      intervals.forEach(clearInterval);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem(BLOGS_KEY, JSON.stringify(blogs));
  }, [blogs]);

  useEffect(() => {
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(blogCategories));
  }, [blogCategories]);

  useEffect(() => {
    if (currentPage === 'blog-detail' && selectedBlogDetail?.id) {
      setAnalytics(trackBlogView(selectedBlogDetail.id, selectedBlogDetail.title));
    }
  }, [currentPage, selectedBlogDetail?.id]);

  const navigateTo = (page, item = null) => {
    setCurrentPage(page);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    let targetUrl = '/';
    if (page === 'products') targetUrl = '/products';
    else if (page === 'product-detail' && item) {
      setSelectedProductDetail(item);
      targetUrl = `/products/${item.id}`;
    }
    else if (page === 'blogs') targetUrl = '/blogs';
    else if (page === 'blog-detail' && item) {
      setSelectedBlogDetail(item);
      targetUrl = `/blogs/${item.id}`;
    }
    else if (page === 'admin') targetUrl = ADMIN_SECRET_PATH;
    else if (page === 'technology') targetUrl = '/technology';
    else if (page === 'how-it-works') targetUrl = '/how-it-works';
    else if (page === 'privacy') targetUrl = '/privacy';
    else if (page === 'terms') targetUrl = '/terms';
    else if (page === 'disclaimer') targetUrl = '/disclaimer';

    if (window.location.pathname !== targetUrl) {
      window.history.pushState(null, '', targetUrl);
    }
  };

  // Admin Portal State
  const [adminTab, setAdminTab] = useState('dashboard'); // 'dashboard' | 'software' | 'blogs' | 'settings'
  const [adminKey, setAdminKey] = useState('');
  const [adminStatus, setAdminStatus] = useState('');
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(() => {
    try {
      return localStorage.getItem(MAINTENANCE_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(MAINTENANCE_KEY, maintenanceMode ? '1' : '0');
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('shiftzero_maintenance');
        bc.postMessage({ maintenance: maintenanceMode });
        bc.close();
      }
      window.dispatchEvent(new CustomEvent('shiftzero-maintenance', { detail: { maintenance: maintenanceMode } }));
    } catch {
      /* ignore */
    }
  }, [maintenanceMode]);

  // Live sync: other tabs / same-tab listeners apply maintenance without refresh
  useEffect(() => {
    const apply = (on) => setMaintenanceMode(Boolean(on));
    const onStorage = (e) => {
      if (e.key === MAINTENANCE_KEY) apply(e.newValue === '1');
    };
    const onCustom = (e) => apply(e?.detail?.maintenance);
    let bc;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('shiftzero_maintenance');
        bc.onmessage = (ev) => apply(ev?.data?.maintenance);
      }
    } catch {
      /* ignore */
    }
    window.addEventListener('storage', onStorage);
    window.addEventListener('shiftzero-maintenance', onCustom);
    const poll = setInterval(() => {
      try {
        const on = localStorage.getItem(MAINTENANCE_KEY) === '1';
        setMaintenanceMode((prev) => (prev === on ? prev : on));
      } catch {
        /* ignore */
      }
    }, 2000);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('shiftzero-maintenance', onCustom);
      clearInterval(poll);
      try { bc?.close(); } catch { /* ignore */ }
    };
  }, []);

  // Site Settings & Socials State (Admin Dynamic)
  const [siteSettings, setSiteSettings] = useState(() => readStore(SETTINGS_KEY, {
    siteName: 'ShiftZero',
    twitterUrl: 'https://twitter.com/ShiftZeroApp',
    githubUrl: 'https://github.com/ShiftZero',
    discordUrl: 'https://discord.gg/ShiftZero',
    contactEmail: 'support@shiftzero.dev',
    announcementBanner: 'Omni Watermark Removal — free forever for Windows.',
    groqApiKey: ''
  }));

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(siteSettings));
  }, [siteSettings]);

  // Software Post Form State (Admin)
  const [editingSoftwareId, setEditingSoftwareId] = useState(null);
  const [softwareForm, setSoftwareForm] = useState({
    id: '',
    name: '',
    tagline: '',
    version: 'v1.0.3',
    description: '',
    logoUrl: '/brand/omni-logo-1x1.jpg',
    imageUrl: '/brand/omni-banner-16x9.png',
    aspectRatio: '16:9',
    imageFit: 'cover',
    vramReq: '4GB+ VRAM',
    windowsUrl: OMNI_WINDOWS_DOWNLOAD,
    macUrl: '',
    featuresText: '',
    aiNotes: ''
  });
  const [groqBusy, setGroqBusy] = useState(false);
  const [countryFilter, setCountryFilter] = useState('All');
  const [softwareFilter, setSoftwareFilter] = useState('All');

  // Blog Post Form State (Admin)
  const [editingBlogId, setEditingBlogId] = useState(null);
  const [blogForm, setBlogForm] = useState({
    id: '',
    title: '',
    category: 'Guides',
    readTime: '5 min read',
    imageUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&q=80',
    summary: '',
    content: ''
  });

  // Live analytics (starts at zero — grows from real visitor/download events)
  const [analytics, setAnalytics] = useState(() => loadAnalytics());

  const analyticsSummary = useMemo(() => {
    const countries = countryBreakdown(analytics.byCountry || {});
    const filteredCountries = countryFilter === 'All'
      ? countries
      : countries.filter((c) => c.country === countryFilter);
    const avgMs = analytics.totalSessions
      ? analytics.totalDwellMs / analytics.totalSessions
      : 0;
    const softwareStats = Object.entries(analytics.bySoftware || {}).map(([id, row]) => ({
      id,
      name: row.name || id,
      clicks: row.clicks || 0,
      downloads: row.downloads || 0,
      countries: countryBreakdown(row.byCountry || {})
    }));
    const selectedSoft = softwareFilter === 'All'
      ? null
      : softwareStats.find((s) => s.id === softwareFilter) || products.find((p) => p.id === softwareFilter);
    const selectedClicks = softwareFilter === 'All'
      ? (analytics.downloadClicks || 0)
      : (selectedSoft?.clicks || 0);
    const selectedDownloads = softwareFilter === 'All'
      ? (analytics.downloads || 0)
      : (selectedSoft?.downloads || 0);
    return {
      visitors: analytics.totalVisitors || 0,
      downloads: analytics.downloads || 0,
      clicks: analytics.downloadClicks || 0,
      selectedClicks,
      selectedDownloads,
      avgStay: formatDwell(avgMs),
      countries,
      filteredCountries,
      softwareStats,
      recent: analytics.recentEvents || []
    };
  }, [analytics, countryFilter, softwareFilter, products]);

  const emptySoftwareForm = () => ({
    version: 'v1.0.3', description: '', logoUrl: '/brand/omni-logo-1x1.jpg',
    imageUrl: '/brand/omni-banner-16x9.png',
    aspectRatio: '16:9', imageFit: 'cover', vramReq: '4GB+ VRAM', windowsUrl: OMNI_WINDOWS_DOWNLOAD, macUrl: '',
    featuresText: '', aiNotes: ''
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeBadgeToast, setActiveBadgeToast] = useState('');
  const [showLogoModal, setShowLogoModal] = useState(false);
  const [blogCategoryFilter, setBlogCategoryFilter] = useState('All');

  // Typewriter Hero Animation State
  const phrases = [
    "Native Windows & macOS apps",
    "Instant watermark erasure engine",
    "Lossless 4K GPU media trimming",
    "100% local VRAM processing"
  ];
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [currentText, setCurrentText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const targetPhrase = phrases[phraseIndex];
    let timer;

    if (!isDeleting && currentText === targetPhrase) {
      timer = setTimeout(() => setIsDeleting(true), 2400);
    } else if (isDeleting && currentText === '') {
      setIsDeleting(false);
      setPhraseIndex((prev) => (prev + 1) % phrases.length);
    } else {
      const speed = isDeleting ? 30 : 60;
      timer = setTimeout(() => {
        setCurrentText(
          targetPhrase.substring(0, currentText.length + (isDeleting ? -1 : 1))
        );
      }, speed);
    }

    return () => clearTimeout(timer);
  }, [currentText, isDeleting, phraseIndex]);

  const triggerBadgeClick = (label) => {
    setActiveBadgeToast(`ShiftZero Engine: ${label} verified clean`);
    setTimeout(() => setActiveBadgeToast(''), 3000);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const downloadLogoSvg = () => {
    const svgContent = `<svg width="512" height="512" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M50 12 L18 44 L34 60 L50 44 Z" fill="#157B86"/>
  <path d="M50 12 L82 44 L66 60 L50 44 Z" fill="#0e5c65"/>
  <polygon points="50,54 64,68 50,82 36,68" fill="#157B86" stroke="#E4F3F3" stroke-width="3"/>
</svg>`;
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ShiftZero_Geometric_Logo.svg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadLogoPng = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    
    const scale = 10.24;
    ctx.beginPath();
    ctx.moveTo(50 * scale, 12 * scale);
    ctx.lineTo(18 * scale, 44 * scale);
    ctx.lineTo(34 * scale, 60 * scale);
    ctx.lineTo(50 * scale, 44 * scale);
    ctx.closePath();
    ctx.fillStyle = '#157B86';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(50 * scale, 12 * scale);
    ctx.lineTo(82 * scale, 44 * scale);
    ctx.lineTo(66 * scale, 60 * scale);
    ctx.lineTo(50 * scale, 44 * scale);
    ctx.closePath();
    ctx.fillStyle = '#0e5c65';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(50 * scale, 54 * scale);
    ctx.lineTo(64 * scale, 68 * scale);
    ctx.lineTo(50 * scale, 82 * scale);
    ctx.lineTo(36 * scale, 68 * scale);
    ctx.closePath();
    ctx.fillStyle = '#157B86';
    ctx.fill();
    ctx.strokeStyle = '#E4F3F3';
    ctx.lineWidth = 3 * scale;
    ctx.stroke();

    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ShiftZero_Geometric_Logo.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Helper to handle Software Form Save
  const handleSaveSoftware = (e) => {
    e.preventDefault();
    if (!softwareForm.name) return;

    const features = (softwareForm.featuresText || '')
      .split('\n')
      .map((line) => line.replace(/^[-•*]\s*/, '').trim())
      .filter(Boolean);

    const newProd = {
      id: editingSoftwareId || softwareForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      name: softwareForm.name,
      tagline: softwareForm.tagline || 'Free Windows desktop tool',
      version: softwareForm.version || 'v1.0.0',
      description: softwareForm.description || 'Native desktop software published on ShiftZero.',
      logoUrl: softwareForm.logoUrl || '',
      imageUrl: softwareForm.imageUrl || '',
      aspectRatio: softwareForm.aspectRatio,
      imageFit: softwareForm.imageFit,
      vramReq: softwareForm.vramReq,
      windowsUrl: softwareForm.windowsUrl || '',
      macUrl: softwareForm.macUrl || '',
      isFree: true,
      features: features.length ? features : ['Free forever', 'Unlimited use', 'Windows download'],
      faqs: [
        { q: `Is ${softwareForm.name} free?`, a: 'Yes — free forever with unlimited local use.' }
      ]
    };

    if (editingSoftwareId) {
      setProducts(products.map(p => p.id === editingSoftwareId ? { ...p, ...newProd, id: editingSoftwareId } : p));
      setActiveBadgeToast(`Updated software post: ${newProd.name}`);
    } else {
      setProducts([...products, newProd]);
      setActiveBadgeToast(`Published new software post: ${newProd.name}`);
    }

    setEditingSoftwareId(null);
    setSoftwareForm(emptySoftwareForm());
    setTimeout(() => setActiveBadgeToast(''), 4000);
  };

  const handleWindowsDownload = async (prod) => {
    if (!prod) return;
    const next = await trackDownloadClick(prod.id, prod.name);
    setAnalytics(next);

    const url = directWindowsDownloadUrl(prod.windowsUrl || OMNI_WINDOWS_DOWNLOAD);
    const started = await trackDownloadStart(prod.id, prod.name, `${prod.name} Windows`);
    setAnalytics(started);

    // Direct asset URL — avoid GitHub HTML pages (especially on mobile)
    const a = document.createElement('a');
    a.href = url;
    a.rel = 'noopener';
    a.setAttribute('download', 'Omni-Watermark-Removal-Final.exe');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Fallback for stubborn mobile browsers
    window.setTimeout(() => {
      try {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = url;
        document.body.appendChild(iframe);
        window.setTimeout(() => {
          try {
            document.body.removeChild(iframe);
          } catch {
            /* ignore */
          }
        }, 60000);
      } catch {
        window.location.assign(url);
      }
    }, 250);
  };

  const handleGroqFill = async () => {
    try {
      setGroqBusy(true);
      const copy = await generateSoftwareCopy({
        apiKey: siteSettings.groqApiKey,
        name: softwareForm.name,
        tagline: softwareForm.tagline,
        notes: softwareForm.aiNotes || softwareForm.description
      });
      setSoftwareForm((prev) => ({
        ...prev,
        tagline: copy.tagline || prev.tagline,
        description: copy.description || prev.description,
        featuresText: (copy.features || []).join('\n')
      }));
      setActiveBadgeToast('Groq filled tagline, description, and key points.');
      setTimeout(() => setActiveBadgeToast(''), 4000);
    } catch (err) {
      setActiveBadgeToast(err.message || 'Groq failed');
      setTimeout(() => setActiveBadgeToast(''), 5000);
    } finally {
      setGroqBusy(false);
    }
  };

  // Helper to handle Blog Form Save
  const handleSaveBlog = (e) => {
    e.preventDefault();
    if (!blogForm.title) return;

    const newBlog = {
      id: editingBlogId || blogForm.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      title: blogForm.title,
      category: blogForm.category || blogCategories[0] || 'Guides',
      date: editingBlogId
        ? (blogs.find((b) => b.id === editingBlogId)?.date || new Date().toISOString().split('T')[0])
        : new Date().toISOString().split('T')[0],
      readTime: blogForm.readTime || '5 min read',
      imageUrl: blogForm.imageUrl || 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&q=80',
      summary: blogForm.summary || 'Summary of the published article.',
      content: blogForm.content || 'Article content details...',
      faqs: [
        { q: 'Where can I read more?', a: 'Browse more ShiftZero guides or open the product page for Omni Watermark Removal.' }
      ]
    };

    if (editingBlogId) {
      setBlogs(blogs.map(b => b.id === editingBlogId ? newBlog : b));
      setActiveBadgeToast(`Saved to live site: ${newBlog.title}`);
    } else {
      setBlogs([newBlog, ...blogs]);
      setActiveBadgeToast(`Published & saved to live site: ${newBlog.title}`);
    }

    setEditingBlogId(null);
    setBlogForm({ id: '', title: '', category: blogCategories[0] || 'Guides', readTime: '5 min read', imageUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&q=80', summary: '', content: '' });
    setTimeout(() => setActiveBadgeToast(''), 4000);
  };

  const filteredBlogs = blogCategoryFilter === 'All' 
    ? blogs 
    : blogs.filter(b => b.category.toLowerCase() === blogCategoryFilter.toLowerCase());

  const techStackList = [
    { name: 'DirectML / CUDA', icon: Cpu, tag: 'GPU Hardware Core' },
    { name: 'ONNX Neural Runtime', icon: Zap, tag: 'High Throughput' },
    { name: 'Native C++ Engine', icon: Terminal, tag: 'Zero Overhead' },
    { name: 'Lossless FFmpeg NVENC', icon: Monitor, tag: 'Hardware Encode' },
    { name: 'Windows x64 / ARM64', icon: HardDrive, tag: 'Standalone Binaries' },
    { name: 'Apple Metal 3', icon: Apple, tag: 'M-Series Unified RAM' }
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f2f9f9', color: '#152529', position: 'relative', overflowX: 'hidden' }}>
      
      {/* ~2s brand splash — logo pop + typed Shift | Zero + soft card */}
      <div className={`site-preloader ${!isSiteLoading ? 'fade-out' : ''}`} aria-hidden={!isSiteLoading}>
        <div className="preloader-stage">
          <div className="preloader-brand-row">
            <span className="preloader-side preloader-side-left">{preloaderLeft}<span className="preloader-caret" aria-hidden="true" /></span>

            <div className="preloader-logo-pop">
              <svg width="72" height="72" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M50 12 L18 44 L34 60 L50 44 Z" fill="#157B86"/>
                <path d="M50 12 L82 44 L66 60 L50 44 Z" fill="#0e5c65"/>
                <polygon points="50,54 64,68 50,82 36,68" fill="#157B86" stroke="#E4F3F3" strokeWidth="3"/>
              </svg>
            </div>

            <span className="preloader-side preloader-side-right">{preloaderRight}<span className="preloader-caret" aria-hidden="true" /></span>
          </div>

          <div className={`preloader-card ${preloaderShowCard ? 'show' : ''}`}>
            <p className="preloader-card-title">ShiftZero</p>
            <p className="preloader-card-status">{preloaderStatusText}</p>
          </div>
        </div>
      </div>

      {/* Public maintenance page — admin portal still reachable via secret URL */}
      {maintenanceMode && currentPage !== 'admin' && !isSiteLoading && (
        <div className="site-maintenance" role="status" aria-live="polite">
          <div className="site-maintenance-bg" aria-hidden="true">
            <span className="maint-orb maint-orb-a" />
            <span className="maint-orb maint-orb-b" />
            <span className="maint-orb maint-orb-c" />
            <span className="maint-grid" />
            <span className="maint-scan" />
          </div>
          <div className="site-maintenance-card">
            <div className="maint-logo-wrap">
              <img src="/brand/omni-logo-1x1.jpg" alt="" className="maint-logo" width="72" height="72" />
              <span className="maint-pulse" aria-hidden="true" />
            </div>
            <p className="maint-kicker">ShiftZero · Temporary pause</p>
            <h1 className="maint-title">We&apos;ll be right back</h1>
            <p className="maint-copy">
              This site is under maintenance. Please wait a little while — we&apos;re polishing things and will return soon.
            </p>
            <div className="maint-dots" aria-hidden="true">
              <span /><span /><span />
            </div>
            <div className="site-maintenance-socials">
              {siteSettings.twitterUrl && <a href={siteSettings.twitterUrl} target="_blank" rel="noreferrer">Twitter / X</a>}
              {siteSettings.githubUrl && <a href={siteSettings.githubUrl} target="_blank" rel="noreferrer">GitHub</a>}
              {siteSettings.discordUrl && <a href={siteSettings.discordUrl} target="_blank" rel="noreferrer">Discord</a>}
              {siteSettings.contactEmail && <a href={`mailto:${siteSettings.contactEmail}`}>Email</a>}
            </div>
          </div>
        </div>
      )}

      {!(maintenanceMode && currentPage !== 'admin') && (
      <>
      {/* Background Animated Gradient Mesh */}
      {currentPage !== 'admin' && <div className="hero-animated-bg" />}

      {/* MOBILE NAV DRAWER BACKDROP & DRAWER */}
      {currentPage !== 'admin' && (
      <>
      <div 
        className={`mobile-nav-backdrop ${mobileMenuOpen ? 'open' : ''}`}
        onClick={() => setMobileMenuOpen(false)}
      />

      <div className={`mobile-nav-drawer ${mobileMenuOpen ? 'open' : ''}`}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid #cde5e5' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="28" height="28" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M50 12 L18 44 L34 60 L50 44 Z" fill="#157B86"/>
              <path d="M50 12 L82 44 L66 60 L50 44 Z" fill="#0e5c65"/>
              <polygon points="50,54 64,68 50,82 36,68" fill="#157B86" stroke="#E4F3F3" strokeWidth="3"/>
            </svg>
            <span style={{ fontWeight: 800, fontSize: '1.15rem', color: '#152529' }}>Shift<span style={{ color: '#157B86' }}>Zero</span></span>
          </div>

          <button 
            onClick={() => setMobileMenuOpen(false)}
            style={{ background: '#E4F3F3', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#152529', cursor: 'pointer' }}
          >
            <X style={{ width: '20px', height: '20px' }} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button onClick={() => navigateTo('home')} className={`mobile-menu-link ${currentPage === 'home' ? 'active' : ''}`}>
            <span>Home</span>
            <ArrowRight style={{ width: '16px', height: '16px', opacity: currentPage === 'home' ? 1 : 0.4 }} />
          </button>

          <button onClick={() => navigateTo('technology')} className={`mobile-menu-link ${currentPage === 'technology' ? 'active' : ''}`}>
            <span>Technology</span>
            <ArrowRight style={{ width: '16px', height: '16px', opacity: currentPage === 'technology' ? 1 : 0.4 }} />
          </button>

          <button onClick={() => navigateTo('how-it-works')} className={`mobile-menu-link ${currentPage === 'how-it-works' ? 'active' : ''}`}>
            <span>How It Works</span>
            <ArrowRight style={{ width: '16px', height: '16px', opacity: currentPage === 'how-it-works' ? 1 : 0.4 }} />
          </button>

          <button onClick={() => navigateTo('products')} className={`mobile-menu-link ${currentPage === 'products' ? 'active' : ''}`}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Box style={{ width: '16px', height: '16px', color: '#157B86' }} />
              Products
            </span>
            <ArrowRight style={{ width: '16px', height: '16px', color: '#157B86' }} />
          </button>

          <button onClick={() => navigateTo('blogs')} className={`mobile-menu-link ${currentPage === 'blogs' || currentPage === 'blog-detail' ? 'active' : ''}`}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BookOpen style={{ width: '16px', height: '16px', color: '#157B86' }} />
              Blogs & Articles
            </span>
            <ArrowRight style={{ width: '16px', height: '16px', color: '#157B86' }} />
          </button>

        </div>
      </div>
      </>
      )}

      {/* FLOATING ROUNDED HEADER PILL — hide on admin (own chrome) */}
      {currentPage !== 'admin' && (
      <header className="header-bar">
        <div className="header-container">
          
          {/* Logo Mark */}
          <button onClick={() => navigateTo('home')} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <svg width="34" height="34" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: 'drop-shadow(0 2px 6px rgba(21,123,134,0.3))' }}>
              <path d="M50 12 L18 44 L34 60 L50 44 Z" fill="#157B86"/>
              <path d="M50 12 L82 44 L66 60 L50 44 Z" fill="#0e5c65"/>
              <polygon points="50,54 64,68 50,82 36,68" fill="#157B86" stroke="#E4F3F3" strokeWidth="3"/>
            </svg>

            <span style={{ fontWeight: '800', fontSize: '1.25rem', color: '#152529', letterSpacing: '-0.02em' }}>
              Shift<span style={{ color: '#157B86' }}>Zero</span>
            </span>
          </button>

          {/* Desktop Navigation Links */}
          <nav className="desktop-nav">
            <button onClick={() => navigateTo('home')} className={`header-nav-link ${currentPage === 'home' ? 'active' : ''}`}>Home</button>
            <button onClick={() => navigateTo('technology')} className={`header-nav-link ${currentPage === 'technology' ? 'active' : ''}`}>Technology</button>
            <button onClick={() => navigateTo('how-it-works')} className={`header-nav-link ${currentPage === 'how-it-works' ? 'active' : ''}`}>How It Works</button>
            <button onClick={() => navigateTo('products')} className={`header-nav-link ${currentPage === 'products' || currentPage === 'product-detail' ? 'active' : ''}`}>Products</button>
            <button onClick={() => navigateTo('blogs')} className={`header-nav-link ${currentPage === 'blogs' || currentPage === 'blog-detail' ? 'active' : ''}`}>Blogs</button>
          </nav>

          {/* Mobile Hamburger Button */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="mobile-hamburger-btn"
              style={{ alignItems: 'center', justifyContent: 'center', background: '#E4F3F3', border: '1px solid #cde5e5', borderRadius: '9999px', color: '#152529', cursor: 'pointer', padding: '6px 12px', gap: '6px', fontSize: '0.8rem', fontWeight: 600 }}
            >
              <span>Menu</span>
              {mobileMenuOpen ? <X style={{ width: '18px', height: '18px' }} /> : <Menu style={{ width: '18px', height: '18px' }} />}
            </button>
          </div>
        </div>
      </header>
      )}

      {/* PAGE 1: HOME PAGE */}
      {currentPage === 'home' && (
        <>
          <section style={{ maxWidth: '1000px', margin: '0 auto', padding: '50px 20px 60px 20px', textAlign: 'center', position: 'relative', zIndex: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
              <div className="top-pill">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>Zero Cost <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#157B86' }} /></span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>Zero Telemetry <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#157B86' }} /></span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>100% On-Device</span>
              </div>
            </div>

            <h1 className="hero-title" style={{ fontSize: '4.2rem', fontWeight: '800', lineHeight: 1.08, letterSpacing: '-0.035em', color: '#152529', margin: '0 auto 20px auto', maxWidth: '840px' }}>
              Small tools.<br />
              <span style={{ color: '#157B86' }}>Zero cost. Always free.</span>
            </h1>

            <div className="hero-subtitle" style={{ fontSize: '1.2rem', color: '#4a6369', maxWidth: '660px', margin: '0 auto 36px auto', fontWeight: 400, lineHeight: 1.6, minHeight: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span>
                {currentText}
                <span className="typewriter-cursor" />
              </span>
            </div>

            <div className="hero-cta-group" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginBottom: '44px' }}>
              <button onClick={() => navigateTo('products')} className="btn-cyan-solid">
                <Box style={{ width: '18px', height: '18px' }} />
                <span>Explore Products</span>
              </button>

              <button onClick={() => navigateTo('how-it-works')} className="btn-white-outline">
                <Play style={{ width: '18px', height: '18px', color: '#157B86' }} />
                <span>How ShiftZero Works</span>
              </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px', maxWidth: '860px', margin: '0 auto' }}>
              {[
                { label: 'No ads', icon: CheckCircle2 },
                { label: 'No accounts', icon: UserX },
                { label: 'No trial', icon: FileX },
                { label: 'No trackers', icon: EyeOff },
                { label: 'No pro tier', icon: Zap },
                { label: '$0 Cost', icon: DollarSign }
              ].map((badge, i) => (
                <button key={i} className="cute-pill-btn" onClick={() => triggerBadgeClick(badge.label)}>
                  <badge.icon style={{ width: '15px', height: '15px' }} />
                  <span>{badge.label}</span>
                </button>
              ))}
            </div>

            {activeBadgeToast && (
              <div style={{ marginTop: '20px', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 18px', borderRadius: '9999px', background: '#157B86', color: '#ffffff', fontSize: '0.8rem', fontWeight: 600, boxShadow: '0 4px 14px rgba(21, 123, 134, 0.35)' }}>
                <Sparkles style={{ width: '14px', height: '14px' }} />
                <span>{activeBadgeToast}</span>
              </div>
            )}
          </section>

          {/* INFINITE MARQUEE TICKER LOOP */}
          <section style={{ padding: '30px 0 60px 0', borderTop: '1px solid #cde5e5', borderBottom: '1px solid #cde5e5', backgroundColor: '#E4F3F3' }}>
            <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 20px', marginBottom: '20px', textAlign: 'center' }}>
              <div className="section-pill-badge">
                <Cpu style={{ width: '14px', height: '14px', color: '#157B86' }} />
                <span>Desktop Hardware Engine Architecture</span>
              </div>
            </div>

            <div className="marquee-container">
              <div className="marquee-content">
                {techStackList.concat(techStackList).map((item, idx) => (
                  <div key={idx} className="tech-ticker-card">
                    <item.icon style={{ width: '16px', height: '16px', color: '#157B86' }} />
                    <span>{item.name}</span>
                    <span style={{ fontSize: '0.7rem', color: '#4a6369', background: '#f2f9f9', padding: '2px 8px', borderRadius: '4px', fontFamily: 'monospace', border: '1px solid #cde5e5' }}>{item.tag}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* FLOWCHART SECTION */}
          <section style={{ maxWidth: '1060px', margin: '0 auto', padding: '80px 20px' }}>
            <div style={{ textAlign: 'center', marginBottom: '50px' }}>
              <div className="section-pill-badge">
                <CheckCircle2 style={{ width: '14px', height: '14px', color: '#157B86' }} />
                <span>Zero Server Cost Model</span>
              </div>
              <h2 style={{ fontSize: '2.2rem', fontWeight: 800, color: '#152529' }}>
                How ShiftZero Runs Off-Grid
              </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
              <div className="flow-card">
                <div className="flow-step-num">1</div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#152529', marginBottom: '8px' }}>Download Executable</h3>
                <p style={{ fontSize: '0.9rem', color: '#4a6369', lineHeight: 1.6, margin: 0 }}>Grab the tool you need. Fast, private and 100% on-device.</p>
                <div className="flow-badge-tag">No sign-up required</div>
              </div>

              <div className="flow-card">
                <div className="flow-step-num">2</div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#152529', marginBottom: '8px' }}>Local GPU Execution</h3>
                <p style={{ fontSize: '0.9rem', color: '#4a6369', lineHeight: 1.6, margin: 0 }}>Runs entirely on your device. No cloud. No data leaves.</p>
                <div className="flow-badge-tag">100% On-Device</div>
              </div>

              <div className="flow-card">
                <div className="flow-step-num">3</div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#152529', marginBottom: '8px' }}>Unlimited $0 Processing</h3>
                <p style={{ fontSize: '0.9rem', color: '#4a6369', lineHeight: 1.6, margin: 0 }}>Use it as much as you want. Forever free. Always will be.</p>
                <div className="flow-badge-tag">Truly Unlimited</div>
              </div>
            </div>
          </section>

          {/* PRODUCTS HIGHLIGHT SECTION */}
          <section style={{ maxWidth: '1060px', margin: '0 auto', padding: '0 20px 80px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #cde5e5', paddingBottom: '20px', marginBottom: '36px' }}>
              <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#152529', margin: 0 }}>Our Products</h2>
              <button onClick={() => navigateTo('products')} style={{ background: 'none', border: 'none', color: '#157B86', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>View all products</span>
                <ArrowRight style={{ width: '16px', height: '16px' }} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {products.map((prod) => (
                <SoftwareHeroCard
                  key={prod.id}
                  product={prod}
                  onDownload={handleWindowsDownload}
                  onDetails={(p) => navigateTo('product-detail', p)}
                />
              ))}
            </div>
          </section>
        </>
      )}

      {/* PAGE 2: PRODUCTS CATALOGUE */}
      {currentPage === 'products' && (
        <main style={{ maxWidth: '1060px', margin: '0 auto', padding: '60px 20px 80px 20px' }}>
          <div style={{ textAlign: 'center', marginBottom: '50px' }}>
            <div className="section-pill-badge">
              <Box style={{ width: '14px', height: '14px', color: '#157B86' }} />
              <span>ShiftZero Executables</span>
            </div>
            <h1 style={{ fontSize: '2.8rem', fontWeight: 800, color: '#152529', marginBottom: '12px' }}>
              Standalone Desktop Software
            </h1>
            <p style={{ fontSize: '1.05rem', color: '#4a6369', maxWidth: '640px', margin: '0 auto' }}>
              100% offline, privacy-first media utilities. No server accounts required.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '820px', margin: '0 auto' }}>
            {products.map((prod) => (
              <SoftwareHeroCard
                key={prod.id}
                product={prod}
                onDownload={handleWindowsDownload}
                onDetails={(p) => navigateTo('product-detail', p)}
              />
            ))}
          </div>
        </main>
      )}

      {/* PAGE 3: PRODUCT DETAIL PAGE */}
      {currentPage === 'product-detail' && selectedProductDetail && (
        <main style={{ maxWidth: '900px', margin: '0 auto', padding: '60px 20px 80px 20px' }}>
          <button 
            onClick={() => navigateTo('products')}
            style={{ background: '#E4F3F3', border: '1px solid #cde5e5', borderRadius: '9999px', padding: '8px 18px', color: '#157B86', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '28px' }}
          >
            <ArrowRight style={{ width: '16px', height: '16px', transform: 'rotate(180deg)' }} />
            <span>Back to All Products</span>
          </button>

          <div style={{ background: '#ffffff', border: '1px solid #cde5e5', borderRadius: '28px', padding: '40px', boxShadow: '0 10px 30px rgba(21,123,134,0.05)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '20px', marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid #cde5e5' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', minWidth: 0, flex: 1 }}>
                <div className="product-logo-mark" aria-hidden="true">
                  {selectedProductDetail.logoUrl ? (
                    <img src={selectedProductDetail.logoUrl} alt="" />
                  ) : (
                    <svg width="36" height="36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M50 12 L18 44 L34 60 L50 44 Z" fill="#157B86"/>
                      <path d="M50 12 L82 44 L66 60 L50 44 Z" fill="#0e5c65"/>
                      <polygon points="50,54 64,68 50,82 36,68" fill="#157B86" stroke="#E4F3F3" strokeWidth="3"/>
                    </svg>
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                    <h1 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', fontWeight: 800, color: '#152529', margin: 0 }}>{selectedProductDetail.name}</h1>
                    <span style={{ background: '#157B86', color: '#ffffff', padding: '4px 12px', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 700, fontFamily: 'monospace' }}>
                      {selectedProductDetail.version}
                    </span>
                  </div>
                  <p style={{ fontSize: '1.05rem', color: '#157B86', fontWeight: 600, margin: 0 }}>{selectedProductDetail.tagline}</p>
                </div>
              </div>

              <button type="button" onClick={() => handleWindowsDownload(selectedProductDetail)} className="btn-cyan-solid" style={{ padding: '14px 28px' }}>
                <Download style={{ width: '18px', height: '18px' }} />
                <span>DOWNLOAD FOR WINDOWS</span>
              </button>
            </div>

            {selectedProductDetail.imageUrl && (
              <div style={{ borderRadius: '20px', overflow: 'hidden', height: '320px', background: '#152529', marginBottom: '32px', border: '1px solid #cde5e5' }}>
                <img 
                  src={selectedProductDetail.imageUrl} 
                  alt={selectedProductDetail.name} 
                  style={{ width: '100%', height: '100%', objectFit: selectedProductDetail.imageFit || 'cover' }} 
                />
              </div>
            )}

            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#152529', marginBottom: '12px' }}>Overview & Architecture</h3>
            <p style={{ fontSize: '1rem', color: '#4a6369', lineHeight: 1.8, marginBottom: '32px' }}>
              {selectedProductDetail.description}
            </p>

            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#152529', marginBottom: '16px' }}>Key Engine Specifications</h3>
            <div className="specs-four-row">
              {selectedProductDetail.features?.map((feat, idx) => (
                <div key={idx} className="spec-chip">
                  <CheckCircle2 style={{ width: '18px', height: '18px', color: '#157B86', flexShrink: 0, marginTop: 2 }} />
                  <span>{feat}</span>
                </div>
              ))}
            </div>

            {selectedProductDetail.faqs && selectedProductDetail.faqs.length > 0 && (
              <div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#152529', marginBottom: '16px' }}>Frequently Asked Questions</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {selectedProductDetail.faqs.map((faq, idx) => (
                    <div key={idx} style={{ background: '#f2f9f9', border: '1px solid #cde5e5', borderRadius: '14px', padding: '18px' }}>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#152529', marginBottom: '6px' }}>{faq.q}</h4>
                      <p style={{ fontSize: '0.875rem', color: '#4a6369', margin: 0 }}>{faq.a}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      )}

      {/* PAGE 4: PUBLIC BLOGS LISTING PAGE (/blogs) */}
      {currentPage === 'blogs' && (
        <main style={{ maxWidth: '1060px', margin: '0 auto', padding: '60px 20px 80px 20px' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <div className="section-pill-badge">
              <BookOpen style={{ width: '14px', height: '14px', color: '#157B86' }} />
              <span>ShiftZero Knowledge Base & SEO Articles</span>
            </div>
            <h1 style={{ fontSize: '2.8rem', fontWeight: 800, color: '#152529', marginBottom: '12px' }}>
              Engine Blogs & Technical Deep Dives
            </h1>
            <p style={{ fontSize: '1.05rem', color: '#4a6369', maxWidth: '640px', margin: '0 auto' }}>
              Learn about hardware accelerated neural inpainting, local VRAM optimization, and off-grid desktop architecture.
            </p>
          </div>

          {/* Category Filter Pills */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '40px' }}>
            {['All', ...blogCategories].map((cat) => (
              <button 
                key={cat}
                onClick={() => setBlogCategoryFilter(cat)}
                style={{ 
                  padding: '8px 20px', 
                  borderRadius: '9999px', 
                  fontSize: '0.85rem', 
                  fontWeight: 700, 
                  cursor: 'pointer',
                  border: '1px solid #cde5e5',
                  background: blogCategoryFilter === cat ? '#157B86' : '#ffffff',
                  color: blogCategoryFilter === cat ? '#ffffff' : '#152529',
                  boxShadow: blogCategoryFilter === cat ? '0 4px 14px rgba(21,123,134,0.3)' : '0 2px 8px rgba(0,0,0,0.03)'
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '28px' }}>
            {filteredBlogs.map((blog) => (
              <article key={blog.id} style={{ background: '#ffffff', border: '1px solid #cde5e5', borderRadius: '24px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 20px rgba(21,123,134,0.04)' }}>
                {blog.imageUrl && (
                  <div style={{ height: '200px', overflow: 'hidden', background: '#152529', position: 'relative' }}>
                    <img 
                      src={blog.imageUrl} 
                      alt={blog.title} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    />
                    <span style={{ position: 'absolute', top: '14px', left: '14px', background: '#ffffff', color: '#157B86', padding: '4px 12px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                      {blog.category}
                    </span>
                  </div>
                )}

                <div style={{ padding: '28px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.78rem', color: '#4a6369', marginBottom: '10px', fontFamily: 'monospace' }}>
                    <span>{blog.date}</span>
                    <span>•</span>
                    <span>{blog.readTime}</span>
                  </div>

                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#152529', marginBottom: '10px', lineHeight: 1.4 }}>{blog.title}</h3>
                  <p style={{ fontSize: '0.875rem', color: '#4a6369', lineHeight: 1.6, marginBottom: '24px', flex: 1 }}>{blog.summary}</p>

                  <button 
                    onClick={() => navigateTo('blog-detail', blog)}
                    className="btn-white-outline"
                    style={{ width: '100%', padding: '12px', fontSize: '0.85rem', justifyContent: 'center' }}
                  >
                    <span>Read Full Article</span>
                    <ArrowRight style={{ width: '16px', height: '16px', color: '#157B86' }} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </main>
      )}

      {/* PAGE 5: SINGLE BLOG DETAIL ARTICLE READER VIEW */}
      {currentPage === 'blog-detail' && selectedBlogDetail && (
        <main style={{ maxWidth: '840px', margin: '0 auto', padding: '60px 20px 80px 20px' }}>
          <button 
            onClick={() => navigateTo('blogs')}
            style={{ background: '#ffffff', border: '1px solid #cde5e5', borderRadius: '9999px', padding: '8px 18px', color: '#152529', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '28px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
          >
            <ArrowRight style={{ width: '16px', height: '16px', transform: 'rotate(180deg)', color: '#157B86' }} />
            <span>Back to All Blogs</span>
          </button>

          <article style={{ background: '#ffffff', border: '1px solid #cde5e5', borderRadius: '28px', padding: '40px', boxShadow: '0 10px 30px rgba(21,123,134,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <span style={{ background: '#157B86', color: '#ffffff', padding: '4px 14px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>
                {selectedBlogDetail.category}
              </span>
              <span style={{ fontSize: '0.8rem', color: '#4a6369', fontFamily: 'monospace' }}>{selectedBlogDetail.date}</span>
              <span style={{ fontSize: '0.8rem', color: '#4a6369', fontFamily: 'monospace' }}>• {selectedBlogDetail.readTime}</span>
            </div>

            <h1 style={{ fontSize: '2.4rem', fontWeight: 800, color: '#152529', marginBottom: '20px', lineHeight: 1.25 }}>
              {selectedBlogDetail.title}
            </h1>

            {selectedBlogDetail.imageUrl && (
              <div style={{ borderRadius: '20px', overflow: 'hidden', height: '340px', background: '#152529', marginBottom: '32px' }}>
                <img src={selectedBlogDetail.imageUrl} alt={selectedBlogDetail.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}

            {/* SEO Overview Highlight Box */}
            <div style={{ background: '#E4F3F3', border: '1px solid #cde5e5', borderRadius: '18px', padding: '24px', marginBottom: '32px' }}>
              <h3 style={{ fontSize: '0.9rem', fontFamily: 'monospace', color: '#157B86', textTransform: 'uppercase', fontWeight: 800, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles style={{ width: '16px', height: '16px' }} />
                <span>Article Key Takeaways</span>
              </h3>
              <p style={{ fontSize: '0.95rem', color: '#152529', fontWeight: 500, margin: 0, lineHeight: 1.6 }}>
                {selectedBlogDetail.summary}
              </p>
            </div>

            {/* Main Article Body Text */}
            <div style={{ color: '#4a6369', lineHeight: 1.85, fontSize: '1.02rem', whiteSpace: 'pre-line', marginBottom: '40px' }}>
              {selectedBlogDetail.content}
            </div>

            {/* FAQs Accordion at Bottom of Blog */}
            {selectedBlogDetail.faqs && selectedBlogDetail.faqs.length > 0 && (
              <div style={{ borderTop: '1px solid #cde5e5', paddingTop: '32px' }}>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#152529', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <HelpCircle style={{ width: '20px', height: '20px', color: '#157B86' }} />
                  <span>Frequently Asked Questions</span>
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {selectedBlogDetail.faqs.map((faq, idx) => (
                    <div key={idx} style={{ background: '#f2f9f9', border: '1px solid #cde5e5', borderRadius: '16px', padding: '20px' }}>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#152529', marginBottom: '6px' }}>{faq.q}</h4>
                      <p style={{ fontSize: '0.875rem', color: '#4a6369', margin: 0, lineHeight: 1.6 }}>{faq.a}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </article>
        </main>
      )}

      {/* PAGE 6: STANDALONE FULL-WIDTH DESKTOP ADMIN PORTAL (/admin) */}
      {currentPage === 'admin' && (
        <main className="admin-portal-wrapper">
          {!isAdminLoggedIn ? (
            /* ADMIN LOGIN CARD */
            <div style={{ maxWidth: '460px', margin: '60px auto', background: '#ffffff', border: '1px solid #cde5e5', borderRadius: '28px', padding: '40px', boxShadow: '0 20px 40px rgba(21,37,41,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' }}>
                <div style={{ padding: '12px', background: '#E4F3F3', borderRadius: '14px', color: '#157B86' }}>
                  <Lock style={{ width: '28px', height: '28px' }} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#152529', margin: 0 }}>Admin Authentication</h2>
                  <p style={{ fontSize: '0.8rem', color: '#4a6369', margin: 0 }}>ShiftZero Engine Control Center</p>
                </div>
              </div>

              <form onSubmit={(e) => { 
                e.preventDefault(); 
                if (adminKey === 'admin123') {
                  setIsAdminLoggedIn(true);
                  setAdminStatus('');
                } else {
                  setAdminStatus('Invalid security passkey');
                }
              }} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <p style={{ fontSize: '0.85rem', color: '#4a6369', background: '#f2f9f9', padding: '12px 16px', borderRadius: '12px', border: '1px solid #cde5e5', margin: 0 }}>
                  Enter master key to edit software posts, manage blogs, and adjust site settings. (Default: <code style={{ color: '#157B86', fontWeight: 700 }}>admin123</code>)
                </p>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontFamily: 'monospace', color: '#152529', fontWeight: 700, marginBottom: '6px' }}>Master Security Passkey</label>
                  <input 
                    type="password"
                    value={adminKey}
                    onChange={(e) => setAdminKey(e.target.value)}
                    placeholder="Enter passkey..."
                    style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', background: '#E4F3F3', border: '1px solid #cde5e5', color: '#152529', fontFamily: 'monospace', fontSize: '0.95rem', boxSizing: 'border-box' }}
                    required
                  />
                </div>

                {adminStatus && (
                  <div style={{ fontSize: '0.85rem', color: '#ef4444', background: '#fff1f2', padding: '10px 14px', borderRadius: '10px', border: '1px solid #fecdd3' }}>
                    {adminStatus}
                  </div>
                )}

                <button type="submit" className="btn-cyan-solid" style={{ width: '100%', padding: '14px' }}>
                  Authenticate & Open Portal
                </button>
              </form>
            </div>
          ) : (
            /* LOGGED-IN FULL-WIDTH DESKTOP ADMIN DASHBOARD WITH SIDEBAR */
            <div style={{ width: '100%', minHeight: '100vh', background: '#ffffff' }}>
              
              {/* TOP ADMIN HEADER BAR */}
              <div style={{ padding: '20px 40px', background: '#152529', borderBottom: '1px solid #23373b', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px #10b981' }} />
                  <span style={{ color: '#ffffff', fontWeight: 800, fontSize: '1.25rem' }}>Shift<span style={{ color: '#157B86' }}>Zero</span> Full-Stack Portal</span>
                  <span style={{ background: 'rgba(21,123,134,0.3)', color: '#E4F3F3', padding: '4px 12px', borderRadius: '9999px', fontSize: '0.75rem', fontFamily: 'monospace', fontWeight: 700 }}>Real-Time Control Mode</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <button 
                    onClick={() => navigateTo('home')}
                    style={{ background: 'rgba(228,243,243,0.1)', border: '1px solid rgba(228,243,243,0.2)', borderRadius: '8px', padding: '8px 16px', color: '#ffffff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    View Public Site
                  </button>
                  <button 
                    onClick={() => { setIsAdminLoggedIn(false); setAdminKey(''); }}
                    style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '8px', padding: '8px 16px', color: '#9f1239', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
                  >
                    Lock Portal
                  </button>
                </div>
              </div>

              {/* MAIN FULL-WIDTH GRID WITH SIDEBAR */}
              <div className="admin-grid-layout">
                
                {/* LEFT SIDEBAR NAVIGATION */}
                <aside style={{ background: '#f2f9f9', borderRight: '1px solid #cde5e5', padding: '32px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '0.725rem', fontFamily: 'monospace', color: '#157B86', fontWeight: 800, textTransform: 'uppercase', padding: '0 12px 8px 12px' }}>
                    Dashboard Pages
                  </div>

                  <button 
                    onClick={() => setAdminTab('dashboard')}
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 18px', borderRadius: '12px', border: 'none', background: adminTab === 'dashboard' ? '#157B86' : 'transparent', color: adminTab === 'dashboard' ? '#ffffff' : '#152529', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <Globe style={{ width: '18px', height: '18px' }} />
                    <span>Dashboard Analytics</span>
                  </button>

                  <button 
                    onClick={() => setAdminTab('software')}
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 18px', borderRadius: '12px', border: 'none', background: adminTab === 'software' ? '#157B86' : 'transparent', color: adminTab === 'software' ? '#ffffff' : '#152529', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <Box style={{ width: '18px', height: '18px' }} />
                    <span>Software Manager</span>
                  </button>

                  <button 
                    onClick={() => setAdminTab('blogs')}
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 18px', borderRadius: '12px', border: 'none', background: adminTab === 'blogs' ? '#157B86' : 'transparent', color: adminTab === 'blogs' ? '#ffffff' : '#152529', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <FileText style={{ width: '18px', height: '18px' }} />
                    <span>Blog Articles</span>
                  </button>

                  <button 
                    onClick={() => setAdminTab('settings')}
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 18px', borderRadius: '12px', border: 'none', background: adminTab === 'settings' ? '#157B86' : 'transparent', color: adminTab === 'settings' ? '#ffffff' : '#152529', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <Sliders style={{ width: '18px', height: '18px' }} />
                    <span>Site & Socials</span>
                  </button>

                  <div style={{ marginTop: 'auto', background: '#E4F3F3', borderRadius: '16px', padding: '18px', border: '1px solid #cde5e5' }}>
                    <div style={{ fontSize: '0.75rem', color: '#157B86', fontWeight: 700 }}>Engine DirectML Status</div>
                    <div style={{ fontSize: '0.85rem', color: '#152529', marginTop: '2px', fontWeight: 700 }}>100% Operational</div>
                  </div>
                </aside>

                {/* RIGHT MAIN FULL-WIDTH PANEL */}
                <div style={{ padding: '40px', backgroundColor: '#ffffff', overflowY: 'auto' }}>
                  
                  {/* TAB 1: DASHBOARD ANALYTICS */}
                  {adminTab === 'dashboard' && (
                    <div>
                      <h3 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#152529', marginBottom: '8px' }}>Live Site Analytics</h3>
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
                        <p style={{ fontSize: '0.9rem', color: '#4a6369', margin: 0 }}>Counts start at zero and grow from real visits, download clicks, and downloads on this browser store.</p>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#152529', fontWeight: 600 }}>
                          Software
                          <select
                            value={softwareFilter}
                            onChange={(e) => setSoftwareFilter(e.target.value)}
                            style={{ padding: '8px 12px', borderRadius: '10px', border: '1px solid #cde5e5', background: '#f2f9f9', fontSize: '0.85rem', minWidth: '180px' }}
                          >
                            <option value="All">All software</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <div className="analytics-four-row">
                        <div style={{ background: '#f2f9f9', border: '1px solid #cde5e5', borderRadius: '20px', padding: '22px' }}>
                          <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#4a6369', textTransform: 'uppercase' }}>Visitors</div>
                          <div style={{ fontSize: '2.1rem', fontWeight: 800, color: '#152529', marginTop: '4px' }}>{analyticsSummary.visitors}</div>
                        </div>
                        <div style={{ background: '#E4F3F3', border: '1px solid #cde5e5', borderRadius: '20px', padding: '22px' }}>
                          <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#157B86', textTransform: 'uppercase', fontWeight: 700 }}>Download Clicks{softwareFilter !== 'All' ? ' · Selected' : ''}</div>
                          <div style={{ fontSize: '2.1rem', fontWeight: 800, color: '#157B86', marginTop: '4px' }}>{analyticsSummary.selectedClicks}</div>
                        </div>
                        <div style={{ background: '#f2f9f9', border: '1px solid #cde5e5', borderRadius: '20px', padding: '22px' }}>
                          <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#4a6369', textTransform: 'uppercase' }}>Downloads Started{softwareFilter !== 'All' ? ' · Selected' : ''}</div>
                          <div style={{ fontSize: '2.1rem', fontWeight: 800, color: '#152529', marginTop: '4px' }}>{analyticsSummary.selectedDownloads}</div>
                        </div>
                        <div style={{ background: '#f2f9f9', border: '1px solid #cde5e5', borderRadius: '20px', padding: '22px' }}>
                          <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#4a6369', textTransform: 'uppercase' }}>Avg Time On Site</div>
                          <div style={{ fontSize: '2.1rem', fontWeight: 800, color: '#152529', marginTop: '4px' }}>{analyticsSummary.avgStay}</div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginBottom: '28px' }}>
                        <div style={{ background: '#ffffff', border: '1px solid #cde5e5', borderRadius: '20px', padding: '24px' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
                            <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#152529', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Globe style={{ width: '18px', height: '18px', color: '#157B86' }} />
                              Visitors by Country
                            </h4>
                            <select
                              value={countryFilter}
                              onChange={(e) => setCountryFilter(e.target.value)}
                              style={{ padding: '8px 12px', borderRadius: '10px', border: '1px solid #cde5e5', background: '#f2f9f9', fontSize: '0.85rem' }}
                            >
                              <option value="All">All countries</option>
                              {analyticsSummary.countries.map((c) => (
                                <option key={c.country} value={c.country}>{c.country}</option>
                              ))}
                            </select>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {analyticsSummary.filteredCountries.length === 0 && (
                              <div style={{ fontSize: '0.85rem', color: '#4a6369' }}>No visitor countries yet.</div>
                            )}
                            {analyticsSummary.filteredCountries.map((loc) => (
                              <div key={loc.country} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem' }}>
                                <span style={{ fontWeight: 600, color: '#152529' }}>{loc.country}</span>
                                <span style={{ fontFamily: 'monospace', color: '#157B86', fontWeight: 700 }}>{loc.pct} · {loc.count}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div style={{ background: '#f2f9f9', border: '1px solid #cde5e5', borderRadius: '20px', padding: '24px' }}>
                          <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#152529', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Terminal style={{ width: '18px', height: '18px', color: '#157B86' }} />
                            Recent Activity
                          </h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '280px', overflowY: 'auto' }}>
                            {analyticsSummary.recent.length === 0 && (
                              <div style={{ fontSize: '0.85rem', color: '#4a6369' }}>No events yet — open the public site and click download to test.</div>
                            )}
                            {analyticsSummary.recent.map((ev, idx) => (
                              <div key={`${ev.at}-${idx}`} style={{ padding: '10px 12px', background: '#ffffff', borderRadius: '10px', border: '1px solid #cde5e5', fontSize: '0.8rem' }}>
                                <div style={{ fontWeight: 700, color: '#152529' }}>{ev.label || ev.type}</div>
                                <div style={{ color: '#4a6369', fontFamily: 'monospace', marginTop: '2px' }}>
                                  {(ev.country || '—')} · {ev.at ? new Date(ev.at).toLocaleString() : ''}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '14px' }}>
                        <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#152529', margin: 0 }}>Per Software</h4>
                        <select
                          value={softwareFilter}
                          onChange={(e) => setSoftwareFilter(e.target.value)}
                          style={{ padding: '8px 12px', borderRadius: '10px', border: '1px solid #cde5e5', background: '#f2f9f9', fontSize: '0.85rem' }}
                        >
                          <option value="All">Show all</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px' }}>
                        {products.filter((prod) => softwareFilter === 'All' || prod.id === softwareFilter).map((prod) => {
                          const row = analyticsSummary.softwareStats.find((s) => s.id === prod.id) || { clicks: 0, downloads: 0, countries: [] };
                          return (
                            <div key={prod.id} style={{ background: '#ffffff', border: '1px solid #cde5e5', borderRadius: '16px', padding: '18px 20px' }}>
                              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' }}>
                                <strong style={{ color: '#152529' }}>{prod.name}</strong>
                                <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                                  <span><MousePointerClick style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'middle' }} /> {row.clicks} clicks</span>
                                  <span><Download style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'middle' }} /> {row.downloads} downloads</span>
                                </div>
                              </div>
                              <div style={{ fontSize: '0.8rem', color: '#4a6369' }}>
                                {row.countries.length === 0 ? 'No country clicks yet.' : row.countries.map((c) => `${c.country} ${c.count}`).join(' · ')}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#152529', marginBottom: '14px' }}>Blog Article Views</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {blogs.map((b) => (
                          <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', background: '#ffffff', border: '1px solid #cde5e5', borderRadius: '12px', padding: '14px 16px' }}>
                            <span style={{ fontWeight: 600, color: '#152529' }}>{b.title}</span>
                            <span style={{ fontFamily: 'monospace', color: '#157B86', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <Eye style={{ width: 14, height: 14 }} />
                              {(analytics.blogViews && analytics.blogViews[b.id]) || 0}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TAB 2: SOFTWARE POST MANAGER */}
                  {adminTab === 'software' && (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                        <div>
                          <h3 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#152529', margin: 0 }}>Software Manager</h3>
                          <p style={{ fontSize: '0.9rem', color: '#4a6369', margin: 0 }}>Post software like a dark hero card — logo, name, version, Windows download. Free &amp; unlimited.</p>
                        </div>
                      </div>

                      {/* EDIT / CREATE SOFTWARE FORM */}
                      <form onSubmit={handleSaveSoftware} style={{ background: '#f2f9f9', border: '1px solid #cde5e5', borderRadius: '24px', padding: '28px', marginBottom: '40px' }}>
                        <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#152529', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Plus style={{ width: '20px', height: '20px', color: '#157B86' }} />
                          <span>{editingSoftwareId ? 'Edit Software Post' : 'Create New Software Post'}</span>
                        </h4>

                        <div style={{ background: '#152529', borderRadius: '16px', padding: '16px 18px', marginBottom: '20px', color: '#E4F3F3' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' }}>
                            <strong style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                              <Wand2 style={{ width: 16, height: 16, color: '#6fd0d8' }} />
                              Groq AI auto-write
                            </strong>
                            <button type="button" onClick={handleGroqFill} disabled={groqBusy} className="btn-cyan-solid" style={{ padding: '8px 14px', fontSize: '0.8rem', opacity: groqBusy ? 0.7 : 1 }}>
                              {groqBusy ? 'Writing…' : 'Generate with Groq'}
                            </button>
                          </div>
                          <textarea
                            rows={2}
                            placeholder="Optional notes for AI (what the tool does, who it's for)…"
                            value={softwareForm.aiNotes}
                            onChange={(e) => setSoftwareForm({ ...softwareForm, aiNotes: e.target.value })}
                            style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #2f5056', background: '#0f1c1f', color: '#E4F3F3', fontSize: '0.85rem', boxSizing: 'border-box' }}
                          />
                          <div style={{ fontSize: '0.72rem', color: '#9bb4b8', marginTop: '8px' }}>Add Groq API key in Settings. AI fills tagline, description, and key points.</div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginBottom: '20px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.78rem', fontFamily: 'monospace', color: '#152529', fontWeight: 700, marginBottom: '6px' }}>Software Name</label>
                            <input 
                              type="text" 
                              placeholder="e.g. Omni Watermark Removal" 
                              value={softwareForm.name}
                              onChange={(e) => setSoftwareForm({ ...softwareForm, name: e.target.value })}
                              style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', background: '#ffffff', border: '1px solid #cde5e5', color: '#152529', fontSize: '0.9rem', boxSizing: 'border-box' }}
                              required
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.78rem', fontFamily: 'monospace', color: '#152529', fontWeight: 700, marginBottom: '6px' }}>Tagline</label>
                            <input 
                              type="text" 
                              placeholder="Short line under the title" 
                              value={softwareForm.tagline}
                              onChange={(e) => setSoftwareForm({ ...softwareForm, tagline: e.target.value })}
                              style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', background: '#ffffff', border: '1px solid #cde5e5', color: '#152529', fontSize: '0.9rem', boxSizing: 'border-box' }}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.78rem', fontFamily: 'monospace', color: '#152529', fontWeight: 700, marginBottom: '6px' }}>Version Tag</label>
                            <input 
                              type="text" 
                              placeholder="e.g. v1.0.0" 
                              value={softwareForm.version}
                              onChange={(e) => setSoftwareForm({ ...softwareForm, version: e.target.value })}
                              style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', background: '#ffffff', border: '1px solid #cde5e5', color: '#152529', fontSize: '0.9rem', boxSizing: 'border-box' }}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.78rem', fontFamily: 'monospace', color: '#152529', fontWeight: 700, marginBottom: '6px' }}>Logo URL (1:1 square)</label>
                            <input 
                              type="text" 
                              placeholder="/brand/omni-logo-1x1.jpg" 
                              value={softwareForm.logoUrl}
                              onChange={(e) => setSoftwareForm({ ...softwareForm, logoUrl: e.target.value })}
                              style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', background: '#ffffff', border: '1px solid #cde5e5', color: '#152529', fontSize: '0.9rem', boxSizing: 'border-box' }}
                            />
                          </div>
                        </div>

                        {/* IMAGE SELECTOR & ASPECT RATIO CROP SETTINGS */}
                        <div style={{ background: '#ffffff', border: '1px solid #cde5e5', borderRadius: '20px', padding: '24px', marginBottom: '20px' }}>
                          <h5 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#152529', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Crop style={{ width: '18px', height: '18px', color: '#157B86' }} />
                            <span>Detail Page Cover Image</span>
                          </h5>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.78rem', fontFamily: 'monospace', color: '#152529', fontWeight: 700, marginBottom: '6px' }}>Cover Image URL (16:9 widescreen)</label>
                              <input 
                                type="text" 
                                placeholder="/brand/omni-banner-16x9.png" 
                                value={softwareForm.imageUrl}
                                onChange={(e) => setSoftwareForm({ ...softwareForm, imageUrl: e.target.value })}
                                style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', background: '#E4F3F3', border: '1px solid #cde5e5', color: '#152529', fontSize: '0.9rem', boxSizing: 'border-box' }}
                              />
                              <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: '#4a6369' }}>
                                Use <code>/brand/omni-banner-16x9.png</code> for the ShiftZero 16:9 banner (already on this site).
                              </p>
                            </div>

                            <div>
                              <label style={{ display: 'block', fontSize: '0.78rem', fontFamily: 'monospace', color: '#152529', fontWeight: 700, marginBottom: '6px' }}>Aspect Ratio Preset</label>
                              <select 
                                value={softwareForm.aspectRatio}
                                onChange={(e) => setSoftwareForm({ ...softwareForm, aspectRatio: e.target.value })}
                                style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', background: '#ffffff', border: '1px solid #cde5e5', color: '#152529', fontSize: '0.9rem', boxSizing: 'border-box' }}
                              >
                                <option value="16:9">16:9 Widescreen Banner</option>
                                <option value="4:3">4:3 Standard Frame</option>
                                <option value="1:1">1:1 Square App Icon</option>
                              </select>
                            </div>

                            <div>
                              <label style={{ display: 'block', fontSize: '0.78rem', fontFamily: 'monospace', color: '#152529', fontWeight: 700, marginBottom: '6px' }}>Crop Fit Mode</label>
                              <div style={{ display: 'flex', gap: '10px' }}>
                                <button 
                                  type="button"
                                  onClick={() => setSoftwareForm({ ...softwareForm, imageFit: 'cover' })}
                                  style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid #cde5e5', background: softwareForm.imageFit === 'cover' ? '#157B86' : '#ffffff', color: softwareForm.imageFit === 'cover' ? '#ffffff' : '#152529', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
                                >
                                  Cover
                                </button>
                                <button 
                                  type="button"
                                  onClick={() => setSoftwareForm({ ...softwareForm, imageFit: 'contain' })}
                                  style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid #cde5e5', background: softwareForm.imageFit === 'contain' ? '#157B86' : '#ffffff', color: softwareForm.imageFit === 'contain' ? '#ffffff' : '#152529', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
                                >
                                  Contain
                                </button>
                              </div>
                            </div>
                          </div>

                          {softwareForm.imageUrl && (
                            <div style={{ marginTop: '20px' }}>
                              <span style={{ fontSize: '0.78rem', fontFamily: 'monospace', color: '#157B86', fontWeight: 700 }}>Live preview:</span>
                              <div style={{ width: '100%', height: '160px', borderRadius: '14px', overflow: 'hidden', background: '#152529', marginTop: '8px', border: '1px solid #cde5e5' }}>
                                <img src={softwareForm.imageUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: softwareForm.imageFit }} />
                              </div>
                            </div>
                          )}
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                          <label style={{ display: 'block', fontSize: '0.78rem', fontFamily: 'monospace', color: '#152529', fontWeight: 700, marginBottom: '6px' }}>Windows Download URL (.exe)</label>
                          <input 
                            type="text" 
                            placeholder="Direct .exe link — click starts download" 
                            value={softwareForm.windowsUrl}
                            onChange={(e) => setSoftwareForm({ ...softwareForm, windowsUrl: e.target.value })}
                            style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', background: '#ffffff', border: '1px solid #cde5e5', color: '#152529', fontSize: '0.9rem', boxSizing: 'border-box' }}
                          />
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                          <label style={{ display: 'block', fontSize: '0.78rem', fontFamily: 'monospace', color: '#152529', fontWeight: 700, marginBottom: '6px' }}>Software Post Description</label>
                          <textarea 
                            rows={3}
                            placeholder="Detailed software description..."
                            value={softwareForm.description}
                            onChange={(e) => setSoftwareForm({ ...softwareForm, description: e.target.value })}
                            style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', background: '#ffffff', border: '1px solid #cde5e5', color: '#152529', fontSize: '0.9rem', boxSizing: 'border-box' }}
                          />
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                          <label style={{ display: 'block', fontSize: '0.78rem', fontFamily: 'monospace', color: '#152529', fontWeight: 700, marginBottom: '6px' }}>Key Points (one per line)</label>
                          <textarea 
                            rows={4}
                            placeholder={"Free forever\nUnlimited cleans\nWindows desktop"}
                            value={softwareForm.featuresText}
                            onChange={(e) => setSoftwareForm({ ...softwareForm, featuresText: e.target.value })}
                            style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', background: '#ffffff', border: '1px solid #cde5e5', color: '#152529', fontSize: '0.9rem', boxSizing: 'border-box' }}
                          />
                        </div>

                        {(softwareForm.name || softwareForm.tagline) && (
                          <div style={{ marginBottom: '24px' }}>
                            <div style={{ fontSize: '0.78rem', fontFamily: 'monospace', color: '#157B86', fontWeight: 700, marginBottom: '8px' }}>Public card preview</div>
                            <SoftwareHeroCard
                              product={{
                                name: softwareForm.name || 'Software name',
                                tagline: softwareForm.tagline || 'Tagline appears here',
                                version: softwareForm.version || 'v1.0.0',
                                logoUrl: softwareForm.logoUrl,
                                isFree: true
                              }}
                              onDownload={() => {}}
                            />
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                          <button type="submit" className="btn-cyan-solid" style={{ padding: '14px 32px', fontSize: '0.9rem' }}>
                            <CheckCircle2 style={{ width: '18px', height: '18px' }} />
                            <span>{editingSoftwareId ? 'Save Updates' : 'Publish Software Post'}</span>
                          </button>
                          {editingSoftwareId && (
                            <button 
                              type="button" 
                              onClick={() => {
                                setEditingSoftwareId(null);
                                setSoftwareForm(emptySoftwareForm());
                              }}
                              style={{ background: '#ffffff', border: '1px solid #cde5e5', borderRadius: '9999px', padding: '14px 24px', color: '#4a6369', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}
                            >
                              Cancel Edit
                            </button>
                          )}
                        </div>
                      </form>

                      {/* CURRENT PUBLISHED SOFTWARE POSTS TABLE */}
                      <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#152529', marginBottom: '20px' }}>Published Software Posts</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {products.map((prod) => (
                          <div key={prod.id} style={{ background: '#ffffff', border: '1px solid #cde5e5', borderRadius: '20px', padding: '24px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '20px', boxShadow: '0 4px 16px rgba(21,123,134,0.03)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                              <div className="product-logo-mark">
                                {(prod.logoUrl || DEFAULT_PRODUCT.logoUrl) ? (
                                  <img src={prod.logoUrl || DEFAULT_PRODUCT.logoUrl} alt={prod.name} />
                                ) : null}
                              </div>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <h5 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#152529', margin: 0 }}>{prod.name}</h5>
                                  <span style={{ fontSize: '0.78rem', fontFamily: 'monospace', color: '#157B86', background: '#E4F3F3', padding: '3px 10px', borderRadius: '6px', fontWeight: 700 }}>{prod.version}</span>
                                </div>
                                <p style={{ fontSize: '0.85rem', color: '#4a6369', margin: '4px 0 0 0' }}>{prod.tagline}</p>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <button 
                                onClick={() => {
                                  setEditingSoftwareId(prod.id);
                                  setSoftwareForm({
                                    id: prod.id,
                                    name: prod.name,
                                    tagline: prod.tagline,
                                    version: prod.version,
                                    description: prod.description,
                                    logoUrl: prod.logoUrl || '',
                                    imageUrl: prod.imageUrl || '',
                                    aspectRatio: prod.aspectRatio || '16:9',
                                    imageFit: prod.imageFit || 'cover',
                                    vramReq: prod.vramReq || '4GB+ VRAM',
                                    windowsUrl: prod.windowsUrl || '',
                                    macUrl: prod.macUrl || '',
                                    featuresText: (prod.features || []).join('\n'),
                                    aiNotes: ''
                                  });
                                }}
                                style={{ background: '#E4F3F3', border: '1px solid #cde5e5', borderRadius: '10px', padding: '10px 18px', color: '#157B86', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                              >
                                <Edit3 style={{ width: '16px', height: '16px' }} />
                                <span>Edit</span>
                              </button>

                              <button 
                                onClick={() => {
                                  setProducts(products.filter(p => p.id !== prod.id));
                                  setActiveBadgeToast(`Deleted software post: ${prod.name}`);
                                  setTimeout(() => setActiveBadgeToast(''), 3000);
                                }}
                                style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '10px', padding: '10px 18px', color: '#9f1239', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                              >
                                <Trash2 style={{ width: '16px', height: '16px' }} />
                                <span>Delete</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TAB 3: BLOG ARTICLES MANAGER */}
                  {adminTab === 'blogs' && (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                        <div>
                          <h3 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#152529', margin: 0 }}>Blog Articles</h3>
                          <p style={{ fontSize: '0.9rem', color: '#4a6369', margin: 0 }}>Create categories, publish posts, and track views on the dashboard.</p>
                        </div>
                      </div>

                      <div style={{ background: '#ffffff', border: '1px solid #cde5e5', borderRadius: '20px', padding: '20px', marginBottom: '24px' }}>
                        <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#152529', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Tag style={{ width: 16, height: 16, color: '#157B86' }} />
                          Categories
                        </h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                          {blogCategories.map((cat) => (
                            <span key={cat} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#E4F3F3', border: '1px solid #cde5e5', borderRadius: '9999px', padding: '6px 12px', fontSize: '0.8rem', fontWeight: 700, color: '#152529' }}>
                              {cat}
                              <button
                                type="button"
                                onClick={() => setBlogCategories(blogCategories.filter((c) => c !== cat))}
                                style={{ background: 'none', border: 'none', color: '#9f1239', cursor: 'pointer', padding: 0, fontWeight: 800 }}
                                title="Remove category"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                          <input
                            type="text"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            placeholder="New category name"
                            style={{ flex: '1 1 200px', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cde5e5', fontSize: '0.9rem' }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const name = newCategoryName.trim();
                              if (!name) return;
                              if (blogCategories.some((c) => c.toLowerCase() === name.toLowerCase())) {
                                setActiveBadgeToast('Category already exists');
                                setTimeout(() => setActiveBadgeToast(''), 2500);
                                return;
                              }
                              setBlogCategories([...blogCategories, name]);
                              setNewCategoryName('');
                            }}
                            className="btn-cyan-solid"
                            style={{ padding: '10px 18px', fontSize: '0.85rem' }}
                          >
                            Add Category
                          </button>
                        </div>
                      </div>

                      {/* EDIT / CREATE BLOG FORM */}
                      <form onSubmit={handleSaveBlog} style={{ background: '#f2f9f9', border: '1px solid #cde5e5', borderRadius: '24px', padding: '28px', marginBottom: '40px' }}>
                        <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#152529', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Plus style={{ width: '20px', height: '20px', color: '#157B86' }} />
                          <span>{editingBlogId ? 'Edit Blog Article' : 'Create New SEO Blog Article'}</span>
                        </h4>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginBottom: '20px' }}>
                          <div style={{ gridColumn: 'span 2' }}>
                            <label style={{ display: 'block', fontSize: '0.78rem', fontFamily: 'monospace', color: '#152529', fontWeight: 700, marginBottom: '6px' }}>Article Title</label>
                            <input 
                              type="text" 
                              placeholder="e.g. Why On-Device Watermark Cleanup Beats Cloud Tools" 
                              value={blogForm.title}
                              onChange={(e) => setBlogForm({ ...blogForm, title: e.target.value })}
                              style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', background: '#ffffff', border: '1px solid #cde5e5', color: '#152529', fontSize: '0.9rem', boxSizing: 'border-box' }}
                              required
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.78rem', fontFamily: 'monospace', color: '#152529', fontWeight: 700, marginBottom: '6px' }}>Category</label>
                            <select 
                              value={blogForm.category}
                              onChange={(e) => setBlogForm({ ...blogForm, category: e.target.value })}
                              style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', background: '#ffffff', border: '1px solid #cde5e5', color: '#152529', fontSize: '0.9rem', boxSizing: 'border-box' }}
                            >
                              {blogCategories.map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* ONLINE EMBEDDED IMAGE URL */}
                        <div style={{ marginBottom: '20px' }}>
                          <label style={{ display: 'block', fontSize: '0.78rem', fontFamily: 'monospace', color: '#152529', fontWeight: 700, marginBottom: '6px' }}>Online Cover Image URL (Embed Link)</label>
                          <input 
                            type="text" 
                            placeholder="https://images.unsplash.com/photo-..." 
                            value={blogForm.imageUrl}
                            onChange={(e) => setBlogForm({ ...blogForm, imageUrl: e.target.value })}
                            style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', background: '#E4F3F3', border: '1px solid #cde5e5', color: '#152529', fontSize: '0.9rem', boxSizing: 'border-box' }}
                          />
                          <div style={{ fontSize: '0.75rem', color: '#4a6369', marginTop: '4px' }}>Loads image directly from web URL link so server stays fast.</div>
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                          <label style={{ display: 'block', fontSize: '0.78rem', fontFamily: 'monospace', color: '#152529', fontWeight: 700, marginBottom: '6px' }}>Short Summary Excerpt</label>
                          <input 
                            type="text" 
                            placeholder="Brief overview highlight for blog card..." 
                            value={blogForm.summary}
                            onChange={(e) => setBlogForm({ ...blogForm, summary: e.target.value })}
                            style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', background: '#ffffff', border: '1px solid #cde5e5', color: '#152529', fontSize: '0.9rem', boxSizing: 'border-box' }}
                          />
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                          <label style={{ display: 'block', fontSize: '0.78rem', fontFamily: 'monospace', color: '#152529', fontWeight: 700, marginBottom: '6px' }}>Full Article Body Content</label>
                          <textarea 
                            rows={6}
                            placeholder="Write full article content here..."
                            value={blogForm.content}
                            onChange={(e) => setBlogForm({ ...blogForm, content: e.target.value })}
                            style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', background: '#ffffff', border: '1px solid #cde5e5', color: '#152529', fontSize: '0.9rem', lineHeight: 1.6, boxSizing: 'border-box' }}
                          />
                        </div>

                        <div style={{ display: 'flex', gap: '14px' }}>
                          <button type="submit" className="btn-cyan-solid" style={{ padding: '14px 32px', fontSize: '0.9rem' }}>
                            <BookOpen style={{ width: '18px', height: '18px' }} />
                            <span>{editingBlogId ? 'Save Blog Updates' : 'Publish SEO Blog Article'}</span>
                          </button>
                          {editingBlogId && (
                            <button 
                              type="button" 
                              onClick={() => {
                                setEditingBlogId(null);
                                setBlogForm({ id: '', title: '', category: 'AI Technology', readTime: '5 min read', imageUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&q=80', summary: '', content: '' });
                              }}
                              style={{ background: '#ffffff', border: '1px solid #cde5e5', borderRadius: '9999px', padding: '14px 24px', color: '#4a6369', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}
                            >
                              Cancel Edit
                            </button>
                          )}
                        </div>
                      </form>

                      {/* CURRENT PUBLISHED BLOGS LIST */}
                      <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#152529', marginBottom: '20px' }}>Published Blog Articles</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {blogs.map((b) => (
                          <div key={b.id} style={{ background: '#ffffff', border: '1px solid #cde5e5', borderRadius: '20px', padding: '24px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '20px', boxShadow: '0 4px 16px rgba(21,123,134,0.03)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                              {b.imageUrl && (
                                <img src={b.imageUrl} alt={b.title} style={{ width: '72px', height: '72px', borderRadius: '14px', objectFit: 'cover' }} />
                              )}
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <span style={{ background: '#157B86', color: '#ffffff', padding: '3px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 }}>{b.category}</span>
                                  <span style={{ fontSize: '0.8rem', color: '#4a6369', fontFamily: 'monospace' }}>{b.date}</span>
                                  <span style={{ fontSize: '0.8rem', color: '#157B86', fontFamily: 'monospace', fontWeight: 700 }}>
                                    {(analytics.blogViews && analytics.blogViews[b.id]) || 0} views
                                  </span>
                                </div>
                                <h5 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#152529', margin: '6px 0 0 0' }}>{b.title}</h5>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <button 
                                onClick={() => {
                                  setEditingBlogId(b.id);
                                  setBlogForm({
                                    id: b.id,
                                    title: b.title,
                                    category: b.category,
                                    readTime: b.readTime,
                                    imageUrl: b.imageUrl || '',
                                    summary: b.summary,
                                    content: b.content
                                  });
                                }}
                                style={{ background: '#E4F3F3', border: '1px solid #cde5e5', borderRadius: '10px', padding: '10px 18px', color: '#157B86', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                              >
                                <Edit3 style={{ width: '16px', height: '16px' }} />
                                <span>Edit</span>
                              </button>

                              <button 
                                onClick={() => {
                                  const next = blogs.filter(x => x.id !== b.id);
                                  setBlogs(next);
                                  localStorage.setItem(BLOGS_KEY, JSON.stringify(next));
                                  setActiveBadgeToast(`Deleted & saved to live site: ${b.title}`);
                                  setTimeout(() => setActiveBadgeToast(''), 3000);
                                }}
                                style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '10px', padding: '10px 18px', color: '#9f1239', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                              >
                                <Trash2 style={{ width: '16px', height: '16px' }} />
                                <span>Delete</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TAB 4: SITE SETTINGS & SOCIAL LINKS */}
                  {adminTab === 'settings' && (
                    <div>
                      <h3 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#152529', marginBottom: '24px' }}>Website Branding & Social Links Settings</h3>

                      <div style={{ background: maintenanceMode ? '#fff7ed' : '#f2f9f9', border: `1px solid ${maintenanceMode ? '#fdba74' : '#cde5e5'}`, borderRadius: '20px', padding: '22px', marginBottom: '24px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#152529' }}>Maintenance Mode</h4>
                          <p style={{ margin: '6px 0 0', fontSize: '0.85rem', color: '#4a6369' }}>
                            When ON, public visitors see the animated maintenance page with your social links — applies live (no refresh). Admin stays open.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const next = !maintenanceMode;
                            setMaintenanceMode(next);
                            setActiveBadgeToast(next ? 'Maintenance mode ON — site shows wait page.' : 'Maintenance mode OFF — site is live.');
                            setTimeout(() => setActiveBadgeToast(''), 3500);
                          }}
                          className="btn-cyan-solid"
                          style={{ padding: '12px 18px', background: maintenanceMode ? '#c2410c' : '#157B86' }}
                        >
                          {maintenanceMode ? 'Turn Maintenance OFF' : 'Turn Maintenance ON'}
                        </button>
                      </div>

                      <form onSubmit={(e) => {
                        e.preventDefault();
                        localStorage.setItem(SETTINGS_KEY, JSON.stringify(siteSettings));
                        setActiveBadgeToast('Site settings & social links saved!');
                        setTimeout(() => setActiveBadgeToast(''), 4000);
                      }} style={{ background: '#f2f9f9', border: '1px solid #cde5e5', borderRadius: '24px', padding: '28px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.78rem', fontFamily: 'monospace', color: '#152529', fontWeight: 700, marginBottom: '6px' }}>Twitter / X Profile Link</label>
                            <input 
                              type="text"
                              value={siteSettings.twitterUrl}
                              onChange={(e) => setSiteSettings({ ...siteSettings, twitterUrl: e.target.value })}
                              style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', background: '#ffffff', border: '1px solid #cde5e5', color: '#152529', fontSize: '0.9rem', boxSizing: 'border-box' }}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.78rem', fontFamily: 'monospace', color: '#152529', fontWeight: 700, marginBottom: '6px' }}>GitHub Organization Link</label>
                            <input 
                              type="text"
                              value={siteSettings.githubUrl}
                              onChange={(e) => setSiteSettings({ ...siteSettings, githubUrl: e.target.value })}
                              style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', background: '#ffffff', border: '1px solid #cde5e5', color: '#152529', fontSize: '0.9rem', boxSizing: 'border-box' }}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.78rem', fontFamily: 'monospace', color: '#152529', fontWeight: 700, marginBottom: '6px' }}>Discord Server Invite Link</label>
                            <input 
                              type="text"
                              value={siteSettings.discordUrl}
                              onChange={(e) => setSiteSettings({ ...siteSettings, discordUrl: e.target.value })}
                              style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', background: '#ffffff', border: '1px solid #cde5e5', color: '#152529', fontSize: '0.9rem', boxSizing: 'border-box' }}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.78rem', fontFamily: 'monospace', color: '#152529', fontWeight: 700, marginBottom: '6px' }}>Official Support Email</label>
                            <input 
                              type="text"
                              value={siteSettings.contactEmail}
                              onChange={(e) => setSiteSettings({ ...siteSettings, contactEmail: e.target.value })}
                              style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', background: '#ffffff', border: '1px solid #cde5e5', color: '#152529', fontSize: '0.9rem', boxSizing: 'border-box' }}
                            />
                          </div>
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                          <label style={{ display: 'block', fontSize: '0.78rem', fontFamily: 'monospace', color: '#152529', fontWeight: 700, marginBottom: '6px' }}>Groq API Key (software auto-write)</label>
                          <input 
                            type="password"
                            value={siteSettings.groqApiKey || ''}
                            onChange={(e) => setSiteSettings({ ...siteSettings, groqApiKey: e.target.value })}
                            placeholder="gsk_…"
                            style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', background: '#ffffff', border: '1px solid #cde5e5', color: '#152529', fontSize: '0.9rem', boxSizing: 'border-box' }}
                          />
                          <div style={{ fontSize: '0.75rem', color: '#4a6369', marginTop: '4px' }}>Used only in Software Manager → Generate with Groq. Stored in this browser.</div>
                        </div>

                        <div style={{ marginBottom: '28px' }}>
                          <label style={{ display: 'block', fontSize: '0.78rem', fontFamily: 'monospace', color: '#152529', fontWeight: 700, marginBottom: '6px' }}>Announcement Banner Message</label>
                          <input 
                            type="text"
                            value={siteSettings.announcementBanner}
                            onChange={(e) => setSiteSettings({ ...siteSettings, announcementBanner: e.target.value })}
                            style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', background: '#ffffff', border: '1px solid #cde5e5', color: '#152529', fontSize: '0.9rem', boxSizing: 'border-box' }}
                          />
                        </div>

                        <button type="submit" className="btn-cyan-solid" style={{ padding: '14px 32px', fontSize: '0.9rem' }}>
                          <CheckCircle2 style={{ width: '18px', height: '18px' }} />
                          <span>Save Settings & Social Links</span>
                        </button>
                      </form>
                    </div>
                  )}

                </div>
              </div>
            </div>
          )}
        </main>
      )}

      {/* PAGE 7: TECHNOLOGY PAGE */}
      {currentPage === 'technology' && (
        <main style={{ maxWidth: '1060px', margin: '0 auto', padding: '60px 20px 80px 20px' }}>
          <div style={{ textAlign: 'center', marginBottom: '50px' }}>
            <div className="section-pill-badge">
              <Cpu style={{ width: '14px', height: '14px', color: '#157B86' }} />
              <span>ShiftZero Technology</span>
            </div>
            <h1 style={{ fontSize: '2.8rem', fontWeight: 800, color: '#152529', marginBottom: '12px' }}>
              Engine Architecture & Performance
            </h1>
            <p style={{ fontSize: '1.05rem', color: '#4a6369', maxWidth: '640px', margin: '0 auto' }}>
              Built for high performance with hardware-accelerated local execution.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
            <div className="flow-card">
              <Cpu style={{ width: '32px', height: '32px', color: '#157B86', marginBottom: '14px' }} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#152529', marginBottom: '8px' }}>DirectML & CUDA Core</h3>
              <p style={{ fontSize: '0.9rem', color: '#4a6369', lineHeight: 1.6, margin: 0 }}>Direct hardware matrix acceleration across NVIDIA, AMD, and Intel GPUs.</p>
              <div className="flow-badge-tag">Zero Overhead</div>
            </div>

            <div className="flow-card">
              <Zap style={{ width: '32px', height: '32px', color: '#157B86', marginBottom: '14px' }} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#152529', marginBottom: '8px' }}>ONNX Neural Runtime</h3>
              <p style={{ fontSize: '0.9rem', color: '#4a6369', lineHeight: 1.6, margin: 0 }}>Optimized weights run directly in local VRAM with zero latency.</p>
              <div className="flow-badge-tag">High Throughput</div>
            </div>

            <div className="flow-card">
              <ShieldCheck style={{ width: '32px', height: '32px', color: '#157B86', marginBottom: '14px' }} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#152529', marginBottom: '8px' }}>Offline Telemetry Isolation</h3>
              <p style={{ fontSize: '0.9rem', color: '#4a6369', lineHeight: 1.6, margin: 0 }}>Strict privacy guarantee. No telemetry, analytics, or file uploads.</p>
              <div className="flow-badge-tag">100% Private</div>
            </div>
          </div>
        </main>
      )}

      {/* PAGE 8: HOW IT WORKS PAGE */}
      {currentPage === 'how-it-works' && (
        <main style={{ maxWidth: '1060px', margin: '0 auto', padding: '60px 20px 80px 20px' }}>
          <div style={{ textAlign: 'center', marginBottom: '50px' }}>
            <div className="section-pill-badge">
              <Play style={{ width: '14px', height: '14px', color: '#157B86' }} />
              <span>How It Works</span>
            </div>
            <h1 style={{ fontSize: '2.8rem', fontWeight: 800, color: '#152529', marginBottom: '12px' }}>
              Off-Grid Desktop Execution Model
            </h1>
            <p style={{ fontSize: '1.05rem', color: '#4a6369', maxWidth: '640px', margin: '0 auto' }}>
              No cloud infrastructure. No user accounts. Zero subscription fees forever.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
            <div className="flow-card">
              <div className="flow-step-num">1</div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#152529', marginBottom: '8px' }}>Download Executable</h3>
              <p style={{ fontSize: '0.9rem', color: '#4a6369', lineHeight: 1.6, margin: 0 }}>Grab the tool you need. Fast, private and 100% on-device.</p>
              <div className="flow-badge-tag">No sign-up required</div>
            </div>

            <div className="flow-card">
              <div className="flow-step-num">2</div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#152529', marginBottom: '8px' }}>Local GPU Execution</h3>
              <p style={{ fontSize: '0.9rem', color: '#4a6369', lineHeight: 1.6, margin: 0 }}>Runs entirely on your device. No cloud. No data leaves.</p>
              <div className="flow-badge-tag">100% On-Device</div>
            </div>

            <div className="flow-card">
              <div className="flow-step-num">3</div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#152529', marginBottom: '8px' }}>Unlimited $0 Processing</h3>
              <p style={{ fontSize: '0.9rem', color: '#4a6369', lineHeight: 1.6, margin: 0 }}>Use it as much as you want. Forever free. Always will be.</p>
              <div className="flow-badge-tag">Truly Unlimited</div>
            </div>
          </div>
        </main>
      )}

      {/* PAGE 9: PRIVACY POLICY */}
      {currentPage === 'privacy' && (
        <main style={{ maxWidth: '860px', margin: '0 auto', padding: '60px 20px 80px 20px' }}>
          <button onClick={() => navigateTo('home')} style={{ background: '#E4F3F3', border: '1px solid #cde5e5', borderRadius: '9999px', padding: '8px 18px', color: '#157B86', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
            <ArrowRight style={{ width: '16px', height: '16px', transform: 'rotate(180deg)' }} />
            <span>Back to Home</span>
          </button>
          <div style={{ background: '#ffffff', border: '1px solid #cde5e5', borderRadius: '24px', padding: '40px' }}>
            <h1 style={{ fontSize: '2.2rem', fontWeight: 800, color: '#152529', marginBottom: '16px' }}>Privacy Policy</h1>
            <p style={{ fontSize: '1rem', color: '#4a6369', lineHeight: 1.8 }}>
              ShiftZero desktop applications operate with 100% local isolation. We do not collect, transmit, or store any personal telemetry, media files, or device logs.
            </p>
          </div>
        </main>
      )}

      {/* PAGE 10: TERMS OF SERVICE */}
      {currentPage === 'terms' && (
        <main style={{ maxWidth: '860px', margin: '0 auto', padding: '60px 20px 80px 20px' }}>
          <button onClick={() => navigateTo('home')} style={{ background: '#E4F3F3', border: '1px solid #cde5e5', borderRadius: '9999px', padding: '8px 18px', color: '#157B86', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
            <ArrowRight style={{ width: '16px', height: '16px', transform: 'rotate(180deg)' }} />
            <span>Back to Home</span>
          </button>
          <div style={{ background: '#ffffff', border: '1px solid #cde5e5', borderRadius: '24px', padding: '40px' }}>
            <h1 style={{ fontSize: '2.2rem', fontWeight: 800, color: '#152529', marginBottom: '16px' }}>Terms of Service</h1>
            <p style={{ fontSize: '1rem', color: '#4a6369', lineHeight: 1.8 }}>
              ShiftZero software is provided "as-is" for off-grid desktop media processing. Users are responsible for complying with local media copyright laws.
            </p>
          </div>
        </main>
      )}

      {/* PAGE 11: DISCLAIMER */}
      {currentPage === 'disclaimer' && (
        <main style={{ maxWidth: '860px', margin: '0 auto', padding: '60px 20px 80px 20px' }}>
          <button onClick={() => navigateTo('home')} style={{ background: '#E4F3F3', border: '1px solid #cde5e5', borderRadius: '9999px', padding: '8px 18px', color: '#157B86', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
            <ArrowRight style={{ width: '16px', height: '16px', transform: 'rotate(180deg)' }} />
            <span>Back to Home</span>
          </button>
          <div style={{ background: '#ffffff', border: '1px solid #cde5e5', borderRadius: '24px', padding: '40px' }}>
            <h1 style={{ fontSize: '2.2rem', fontWeight: 800, color: '#152529', marginBottom: '16px' }}>Legal Disclaimer</h1>
            <p style={{ fontSize: '1rem', color: '#4a6369', lineHeight: 1.8 }}>
              ShiftZero applications run completely on local hardware. We hold no warranty for user-created media or downstream hardware compatibility.
            </p>
          </div>
        </main>
      )}

      {/* FOOTER — hide on admin */}
      {currentPage !== 'admin' && (
      <footer style={{ borderTop: '1px solid #cde5e5', padding: '48px 24px', backgroundColor: '#ffffff', fontSize: '0.85rem', color: '#4a6369' }}>
        <div style={{ maxWidth: '1080px', margin: '0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '24px' }}>
          <div>
            <div style={{ fontWeight: '800', color: '#152529', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#152529' }}>Shift<span style={{ color: '#157B86' }}>Zero</span></span> Engine
            </div>
            <div style={{ fontSize: '0.8rem', color: '#4a6369', marginTop: '2px' }}>Small tools. Zero cost. 100% On-Device.</div>
          </div>

          {/* Footer Page Links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
            <button onClick={() => navigateTo('technology')} style={{ background: 'none', border: 'none', color: '#152529', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}>Technology</button>
            <button onClick={() => navigateTo('how-it-works')} style={{ background: 'none', border: 'none', color: '#152529', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}>How It Works</button>
            <button onClick={() => navigateTo('products')} style={{ background: 'none', border: 'none', color: '#152529', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}>Products</button>
            <button onClick={() => navigateTo('blogs')} style={{ background: 'none', border: 'none', color: '#152529', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}>Blogs</button>
            <button onClick={() => navigateTo('privacy')} style={{ background: 'none', border: 'none', color: '#152529', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}>Privacy Policy</button>
            <button onClick={() => navigateTo('terms')} style={{ background: 'none', border: 'none', color: '#152529', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}>Terms</button>
            <button onClick={() => navigateTo('disclaimer')} style={{ background: 'none', border: 'none', color: '#152529', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}>Disclaimer</button>
          </div>

          <div>© 2026 ShiftZero. Built cleanly.</div>
        </div>
      </footer>
      )}

      {/* FLOATING BACK TO TOP BUTTON */}
      {currentPage !== 'admin' && (
      <button onClick={scrollToTop} className="back-to-top-btn" title="Scroll to top">
        <ArrowUp style={{ width: '20px', height: '20px' }} />
      </button>
      )}

      {/* BRAND LOGO ASSET DOWNLOAD MODAL */}
      {showLogoModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', backgroundColor: 'rgba(21, 37, 41, 0.5)', backdropFilter: 'blur(8px)' }}>
          <div style={{ width: '100%', maxWidth: '520px', padding: '32px', backgroundColor: '#ffffff', borderRadius: '24px', border: '1px solid #cde5e5', position: 'relative', boxShadow: '0 20px 40px rgba(21,37,41,0.12)' }}>
            <button 
              onClick={() => setShowLogoModal(false)}
              style={{ position: 'absolute', top: '20px', right: '20px', background: '#E4F3F3', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#152529', cursor: 'pointer' }}
            >
              <X style={{ width: '18px', height: '18px' }} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ padding: '10px', background: '#E4F3F3', borderRadius: '12px', color: '#157B86' }}>
                <Sparkles style={{ width: '22px', height: '22px' }} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#152529', margin: 0 }}>ShiftZero Logo Assets</h3>
                <p style={{ fontSize: '0.8rem', color: '#4a6369', margin: 0 }}>Minimalist 3-Diamond Vector Logo Mark</p>
              </div>
            </div>

            {/* Logo Preview Box */}
            <div style={{ background: 'linear-gradient(135deg, #152529 0%, #0c1618 100%)', borderRadius: '20px', padding: '36px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', position: 'relative', border: '1px solid rgba(205,229,229,0.15)' }}>
              <svg width="110" height="110" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: 'drop-shadow(0 4px 14px rgba(21,123,134,0.4))' }}>
                <path d="M50 12 L18 44 L34 60 L50 44 Z" fill="#157B86"/>
                <path d="M50 12 L82 44 L66 60 L50 44 Z" fill="#0e5c65"/>
                <polygon points="50,54 64,68 50,82 36,68" fill="#157B86" stroke="#E4F3F3" strokeWidth="3"/>
              </svg>
              <span style={{ color: '#E4F3F3', fontWeight: 800, fontSize: '1.35rem', marginTop: '16px', letterSpacing: '-0.02em' }}>ShiftZero</span>
              <span style={{ color: '#157B86', fontSize: '0.8rem', fontWeight: 600, marginTop: '2px' }}>Transparent Vector Logo Mark (#157B86)</span>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button 
                onClick={downloadLogoSvg}
                className="btn-cyan-solid"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px' }}
              >
                <Download style={{ width: '16px', height: '16px' }} />
                <span>Download SVG</span>
              </button>

              <button 
                onClick={downloadLogoPng}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', background: '#E4F3F3', border: '1px solid #cde5e5', borderRadius: '12px', color: '#152529', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}
              >
                <Download style={{ width: '16px', height: '16px', color: '#157B86' }} />
                <span>Download PNG</span>
              </button>
            </div>
          </div>
        </div>
      )}

      </>
      )}

    </div>
  );
}
