import { useEffect, useState } from 'react';
import {
  DEFAULT_BRAND,
  fetchBrandSettings,
  type BrandSettings,
} from '@/lib/telemetry';

function ShiftZeroMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" aria-hidden>
      <path d="M50 12 L18 44 L34 60 L50 44 Z" fill="#157B86" />
      <path d="M50 12 L82 44 L66 60 L50 44 Z" fill="#0e5c65" />
      <polygon points="50,54 64,68 50,82 36,68" fill="#157B86" stroke="#E4F3F3" strokeWidth="3" />
    </svg>
  );
}

const STEPS = [
  {
    n: '1',
    title: 'Download Executable',
    body: 'Grab the tool you need. Fast, private and 100% on-device.',
    tip: 'No sign-up required',
  },
  {
    n: '2',
    title: 'Local GPU Execution',
    body: 'Runs entirely on your device. No cloud. No data leaves.',
    tip: '100% On-Device',
  },
  {
    n: '3',
    title: 'Unlimited $0 Processing',
    body: 'Use it as much as you want. Forever free. Always will be.',
    tip: 'Truly Unlimited',
  },
];

export function ShiftZeroPage() {
  const [brand, setBrand] = useState<BrandSettings>(DEFAULT_BRAND);

  useEffect(() => {
    void fetchBrandSettings().then(setBrand);
  }, []);

  const openSite = () => {
    const url = brand.brandWebsiteUrl || 'https://shiftzero.dev';
    if (window.omni?.openExternal) void window.omni.openExternal(url);
    else window.open(url, '_blank', 'noopener,noreferrer');
  };

  const openSocial = (url: string) => {
    if (!url) return;
    if (window.omni?.openExternal) void window.omni.openExternal(url);
    else window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="shiftzero-page">
      <div className="page-header">
        <div>
          <h2>
            Shift<span className="sz-accent">Zero</span>
          </h2>
          <p>Developed by Team ShiftZero</p>
        </div>
      </div>

      <section className="sz-hero">
        <div className="sz-hero-brand">
          {brand.brandLogoUrl ? (
            <img src={brand.brandLogoUrl} alt="" className="sz-logo-img" />
          ) : (
            <ShiftZeroMark className="sz-logo-svg" />
          )}
          <div>
            <h3 className="sz-name">
              {brand.brandName.startsWith('Shift') ? (
                <>
                  Shift<span className="sz-accent">Zero</span>
                </>
              ) : (
                brand.brandName
              )}
            </h3>
            <p className="sz-tagline">{brand.brandTagline}</p>
          </div>
        </div>
        <p className="sz-about">{brand.brandAbout}</p>
        <div className="sz-pills">
          <span>Zero Cost</span>
          <span>Zero Telemetry</span>
          <span>100% On-Device</span>
        </div>
        <button className="btn btn-primary sz-cta" type="button" onClick={openSite}>
          Explore Products
        </button>
      </section>

      <section className="sz-section">
        <h3>How ShiftZero Works</h3>
        <p className="sz-section-lead">How ShiftZero Runs Off-Grid</p>
        <ol className="sz-steps">
          {STEPS.map((s) => (
            <li key={s.n}>
              <span className="sz-step-n">{s.n}</span>
              <div>
                <strong>{s.title}</strong>
                <p>{s.body}</p>
                <em>{s.tip}</em>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="sz-section">
        <h3>Follow Team ShiftZero</h3>
        <div className="sz-socials">
          {(
            [
              ['YouTube', brand.social.youtube],
              ['Twitter', brand.social.twitter],
              ['Facebook', brand.social.facebook],
              ['Instagram', brand.social.instagram],
              ['WhatsApp', brand.social.whatsapp],
              ['Discord', brand.social.discord],
            ] as const
          ).map(([label, url]) => (
            <button key={label} className="btn btn-secondary" type="button" onClick={() => openSocial(url)}>
              {label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
