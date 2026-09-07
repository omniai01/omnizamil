import React from 'react';
import { Menu, RefreshCw, Activity, ShieldCheck, ShieldAlert } from 'lucide-react';
import type { MaintenanceConfig, SystemMetrics } from '../types';
import type { AdminProduct } from '../lib/product';
import { productLabel } from '../lib/product';

interface NavbarProps {
  setMobileOpen: (open: boolean) => void;
  metrics: SystemMetrics;
  maintenanceConfig: MaintenanceConfig;
  onRefresh: () => void;
  activeTab: string;
  product?: AdminProduct;
}

export const Navbar: React.FC<NavbarProps> = ({
  setMobileOpen,
  metrics,
  maintenanceConfig,
  onRefresh,
  activeTab,
  product = 'omni',
}) => {
  const isGrab = product === 'omnigrab';
  const isVoice = product === 'shiftvoice';
  const titles: Record<string, string> = {
    overview: 'Overview',
    devices: 'Devices',
    users: 'Users',
    media: isGrab ? 'Downloads & platforms' : isVoice ? 'Voice & countries' : 'Media & countries',
    live: 'Live analytics',
    analytics: 'Website analytics',
    errors: 'Errors',
    notifications: 'Notifications',
    social: 'Social links',
    maintenance: 'Maintenance & updates',
  };

  return (
    <header className="top-navbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="mobile-menu-toggle" type="button" onClick={() => setMobileOpen(true)}>
          <Menu size={22} />
        </button>
        <div className="page-title-group">
          <h1>{titles[activeTab] || 'Admin'}</h1>
          <p>Live {productLabel(product)} telemetry</p>
        </div>
      </div>

      <div className="top-actions">
        <div className="quick-pill">
          <Activity size={14} />
          Active {metrics.activeDevicesCount} / {metrics.totalDevices}
        </div>
        <div className="quick-pill">
          {maintenanceConfig.isEnabled ? (
            <>
              <ShieldAlert size={14} /> Maintenance
            </>
          ) : (
            <>
              <ShieldCheck size={14} /> Operational
            </>
          )}
        </div>
        <button className="btn btn-primary" type="button" onClick={onRefresh}>
          <RefreshCw size={16} /> Sync
        </button>
      </div>
    </header>
  );
};
