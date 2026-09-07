import React from 'react';
import {
  LayoutDashboard,
  Cpu,
  Users,
  BarChart3,
  AlertTriangle,
  ShieldAlert,
  Bell,
  Share2,
  LineChart,
  Activity,
  X,
} from 'lucide-react';
import type { MaintenanceConfig } from '../types';
import type { AdminProduct } from '../lib/product';
import { productLabel } from '../lib/product';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  maintenanceConfig: MaintenanceConfig;
  product: AdminProduct;
  onProductChange: (product: AdminProduct) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  mobileOpen,
  setMobileOpen,
  maintenanceConfig,
  product,
  onProductChange,
}) => {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'devices', label: 'Devices', icon: Cpu },
    { id: 'users', label: 'Users', icon: Users },
    {
      id: 'media',
      label:
        product === 'omnigrab'
          ? 'Downloads & platforms'
          : product === 'shiftvoice'
            ? 'Voice & countries'
            : 'Media & countries',
      icon: BarChart3,
    },
    { id: 'live', label: 'Live analytics', icon: Activity },
    { id: 'analytics', label: 'Website analytics', icon: LineChart },
    { id: 'errors', label: 'Errors', icon: AlertTriangle },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'social', label: 'Social links', icon: Share2 },
    { id: 'branding', label: 'ShiftZero branding', icon: Share2 },
    { id: 'maintenance', label: 'Maintenance & updates', icon: ShieldAlert },
  ];

  const brandTitle = productLabel(product);

  return (
    <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="brand-header">
        <div className="brand-icon" aria-hidden />
        <div>
          <div className="brand-title">{brandTitle}</div>
          <div className="brand-sub">Admin panel</div>
        </div>
        <button
          type="button"
          className="mobile-menu-toggle"
          style={{ marginLeft: 'auto', color: '#fff' }}
          onClick={() => setMobileOpen(false)}
        >
          <X size={20} />
        </button>
      </div>

      <label className="product-switcher">
        <span>Product</span>
        <select
          value={product}
          onChange={(e) => onProductChange(e.target.value as AdminProduct)}
          aria-label="Admin product"
        >
          <option value="omni">Omni Removal</option>
          <option value="omnigrab">OmniGrab</option>
          <option value="shiftvoice">ShiftVoice</option>
        </select>
      </label>

      <nav className="nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(item.id);
                setMobileOpen(false);
              }}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-foot">
        {maintenanceConfig.isEnabled ? 'Maintenance ON' : 'System live'}
        {maintenanceConfig.forceUpdate ? ' · Update push ON' : ''}
      </div>
    </aside>
  );
};
