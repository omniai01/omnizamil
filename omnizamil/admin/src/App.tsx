import React, { useCallback, useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { OverviewCards } from './components/OverviewCards';
import { DeviceMonitor } from './components/DeviceMonitor';
import { UserLeaderboard } from './components/UserLeaderboard';
import { MediaAnalytics } from './components/MediaAnalytics';
import { ErrorLogs } from './components/ErrorLogs';
import { MaintenanceControl } from './components/MaintenanceControl';
import { NotificationsPanel } from './components/NotificationsPanel';
import { SocialLinksControl } from './components/SocialLinksControl';
import { BrandingControl } from './components/BrandingControl';
import {
  deleteDevice,
  deleteSmokeDevices,
  loadAdminSnapshot,
  resolveErrorLog,
  saveBrandSettings,
  saveMaintenance,
  saveSiteAnalytics,
  type BrandConfig,
  type PlatformStat,
  type SocialLinks,
} from './lib/supabaseAdmin';
import { productFromHash, setProductHash, type AdminProduct } from './lib/product';
import { LiveAnalytics } from './components/LiveAnalytics';
import { WebsiteAnalytics, type SiteAnalytics } from './components/WebsiteAnalytics';
import type {
  CountryStat,
  DeviceInfo,
  ErrorLog,
  MaintenanceConfig,
  SystemMetrics,
  UserMetric,
} from './types';
import './styles.css';

const emptyMetrics: SystemMetrics = {
  totalDevices: 0,
  activeDevicesCount: 0,
  chokedDevicesCount: 0,
  offlineDevicesCount: 0,
  totalImagesCleaned: 0,
  totalVideosCleaned: 0,
  targetImageGoal: 1_000_000,
  targetVideoGoal: 1_000_000,
  avgImageProcessTimeSec: 0,
  avgVideoProcessTimeSec: 0,
  systemUptimePercent: 100,
};

function emptyMaintenanceFor(product: AdminProduct): MaintenanceConfig {
  return {
    isEnabled: false,
    message:
      product === 'omnigrab'
        ? 'OmniGrab is under maintenance. Please try again later.'
        : product === 'shiftvoice'
          ? 'ShiftVoice is under maintenance. Please try again later.'
          : 'Omni-Removal is under maintenance. Please try again later.',
    affectAllDevices: true,
    allowedHwids: [],
    lockEngine: true,
    updatedAt: '—',
    forceUpdate: false,
    latestVersion: product === 'shiftvoice' ? '1.6.0' : '1.0.0',
    updateUrl: '',
    updateMessage:
      product === 'omnigrab'
        ? 'A new OmniGrab / ShiftGrab update is available. Download and install it to continue.'
        : product === 'shiftvoice'
          ? 'A new ShiftVoice update is available. Download and install it to continue.'
          : 'A new Omni-Removal update is available. Download and install it to continue.',
    durationMinutes: 0,
    startedAt: null,
  };
}

const emptySocial: SocialLinks = {
  youtube: 'https://youtube.com',
  twitter: 'https://x.com',
  facebook: 'https://facebook.com',
  instagram: 'https://instagram.com',
  whatsapp: 'https://whatsapp.com/channel',
  discord: 'https://discord.com',
};

const emptyBrand: BrandConfig = {
  brandName: 'ShiftZero',
  brandTagline: 'Zero cost. Always free.',
  brandAbout: 'Small tools. Zero cost. Zero telemetry. 100% on-device local AI.',
  brandWebsiteUrl: 'https://shiftzero.dev',
  brandLogoUrl: '',
};

const emptySite: SiteAnalytics = {
  siteViews: 0,
  downloadClicks: 0,
  updateClicks: 0,
};

export const App: React.FC = () => {
  const [product, setProduct] = useState<AdminProduct>(() => productFromHash());
  const [activeTab, setActiveTab] = useState('overview');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('omni-admin-ok') === '1');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [metrics, setMetrics] = useState<SystemMetrics>(emptyMetrics);
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [users, setUsers] = useState<UserMetric[]>([]);
  const [countries, setCountries] = useState<CountryStat[]>([]);
  const [platforms, setPlatforms] = useState<PlatformStat[]>([]);
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [maintenanceConfig, setMaintenanceConfig] = useState<MaintenanceConfig>(() =>
    emptyMaintenanceFor(productFromHash()),
  );
  const [socialLinks, setSocialLinks] = useState<SocialLinks>(emptySocial);
  const [brand, setBrand] = useState<BrandConfig>(emptyBrand);
  const [siteAnalytics, setSiteAnalytics] = useState<SiteAnalytics>(emptySite);
  const [loading, setLoading] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [lastSync, setLastSync] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setSyncError('');
    try {
      const snap = await loadAdminSnapshot(product);
      setMetrics(snap.metrics);
      setDevices(snap.devices);
      setUsers(snap.users);
      setCountries(snap.countries);
      setPlatforms(snap.platforms || []);
      setErrorLogs(snap.errorLogs);
      setMaintenanceConfig(snap.maintenanceConfig);
      setSocialLinks(snap.socialLinks);
      setBrand(snap.brand);
      setSiteAnalytics(snap.siteAnalytics);
      setLastSync(new Date().toLocaleTimeString());
      if (snap.errorLoadWarning) {
        setSyncError(`Errors feed: ${snap.errorLoadWarning}`);
      }
    } catch (err) {
      setSyncError(
        err instanceof Error
          ? err.message
          : product === 'shiftvoice'
            ? 'Could not load ShiftVoice tables. Run supabase/schema-shiftvoice.sql in Supabase SQL Editor.'
            : 'Could not load Supabase. Run supabase/schema.sql (+ schema-delta.sql) first.',
      );
    } finally {
      setLoading(false);
    }
  }, [product]);

  useEffect(() => {
    const onHash = () => {
      const next = productFromHash();
      setProduct((prev) => {
        if (prev === next) return prev;
        setActiveTab('overview');
        return next;
      });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const handleProductChange = (next: AdminProduct) => {
    if (next === product) return;
    setProductHash(next);
    setProduct(next);
    setActiveTab('overview');
  };

  useEffect(() => {
    if (!authed) return;
    void deleteSmokeDevices(product).catch(() => 0);
    void refresh();
    const t = window.setInterval(() => void refresh(), 45_000);
    return () => window.clearInterval(t);
  }, [authed, product, refresh]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const expected = import.meta.env.VITE_ADMIN_PASSWORD || 'omni-admin';
    if (password === expected) {
      sessionStorage.setItem('omni-admin-ok', '1');
      setAuthed(true);
      setLoginError('');
    } else {
      setLoginError('Wrong password.');
    }
  };

  if (!authed) {
    return (
      <div className="admin-login">
        <form className="admin-login-card" onSubmit={handleLogin}>
          <h1>ShiftZero Admin</h1>
          <p>Private control panel — live Supabase data.</p>
          <input
            type="password"
            placeholder="Admin password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          {loginError && <p className="admin-login-error">{loginError}</p>}
          <button type="submit">Enter</button>
        </form>
      </div>
    );
  }

  return (
    <div className="admin-layout">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        maintenanceConfig={maintenanceConfig}
        product={product}
        onProductChange={handleProductChange}
      />
      <div className="main-wrapper">
        <Navbar
          setMobileOpen={setMobileOpen}
          metrics={metrics}
          maintenanceConfig={maintenanceConfig}
          onRefresh={() => void refresh()}
          activeTab={activeTab}
          product={product}
        />
        <main className="content-area">
          <div className="admin-sync-bar">
            <span>{loading ? 'Syncing…' : lastSync ? `Live · last sync ${lastSync}` : 'Connecting…'}</span>
            {syncError && <span className="admin-sync-error">{syncError}</span>}
          </div>

          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <OverviewCards metrics={metrics} product={product} devices={devices} />
              <DeviceMonitor
                devices={devices}
                product={product}
                onRefresh={() => void refresh()}
                onDelete={(hwid) =>
                  void deleteDevice(product, hwid)
                    .then(() => refresh())
                    .catch((err) =>
                      setSyncError(err instanceof Error ? err.message : 'Delete failed'),
                    )
                }
              />
              <UserLeaderboard users={users} product={product} />
            </div>
          )}
          {activeTab === 'devices' && (
            <DeviceMonitor
              devices={devices}
              product={product}
              onRefresh={() => void refresh()}
              onDelete={(hwid) =>
                void deleteDevice(product, hwid)
                  .then(() => refresh())
                  .catch((err) =>
                    setSyncError(err instanceof Error ? err.message : 'Delete failed'),
                  )
              }
            />
          )}
          {activeTab === 'users' && <UserLeaderboard users={users} product={product} />}
          {activeTab === 'media' && (
            <MediaAnalytics
              metrics={metrics}
              countries={countries}
              product={product}
              platforms={platforms}
            />
          )}
          {activeTab === 'live' && <LiveAnalytics devices={devices} product={product} />}
          {activeTab === 'analytics' && (
            <WebsiteAnalytics
              stats={siteAnalytics}
              onSave={async (next) => {
                await saveSiteAnalytics(product, next);
                setSiteAnalytics(next);
              }}
            />
          )}
          {activeTab === 'errors' && (
            <ErrorLogs
              logs={errorLogs}
              onResolveLog={(id) => {
                void resolveErrorLog(product, id)
                  .then(() =>
                    setErrorLogs((prev) =>
                      prev.map((l) => (l.id === id ? { ...l, status: 'resolved' as const } : l)),
                    ),
                  )
                  .catch((err) =>
                    setSyncError(err instanceof Error ? err.message : 'Resolve failed'),
                  );
              }}
            />
          )}
          {activeTab === 'notifications' && (
            <NotificationsPanel product={product} deviceHwids={devices.map((d) => d.hwid)} />
          )}
          {activeTab === 'social' && (
            <SocialLinksControl product={product} links={socialLinks} onSaved={setSocialLinks} />
          )}
          {activeTab === 'branding' && (
            <BrandingControl
              initial={brand}
              social={socialLinks}
              onSave={async (nextBrand, nextSocial) => {
                await saveBrandSettings(product, nextBrand, nextSocial);
                setBrand(nextBrand);
                setSocialLinks(nextSocial);
              }}
            />
          )}
          {activeTab === 'maintenance' && (
            <MaintenanceControl
              config={maintenanceConfig}
              onUpdateConfig={(c) => {
                void saveMaintenance(product, c)
                  .then(() => setMaintenanceConfig({ ...c, updatedAt: 'Just now' }))
                  .catch((err) =>
                    setSyncError(err instanceof Error ? err.message : 'Save failed'),
                  );
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
