import React from 'react';
import { Download } from 'lucide-react';

function DefaultLogo() {
  return (
    <svg width="44" height="44" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M50 12 L18 44 L34 60 L50 44 Z" fill="#157B86" />
      <path d="M50 12 L82 44 L66 60 L50 44 Z" fill="#0e5c65" />
      <polygon points="50,54 64,68 50,82 36,68" fill="#157B86" stroke="#E4F3F3" strokeWidth="3" />
    </svg>
  );
}

/**
 * Public software post card — inspired by competitor layout (logo + name + version + download)
 * but ShiftZero teal / slate palette (not a copy).
 */
export default function SoftwareHeroCard({ product, onDownload, onDetails }) {
  if (!product) return null;

  const versionLabel = `LATEST ${(product.version || 'v1.0.0').toUpperCase()}`;

  return (
    <article className="software-hero-card">
      <div className="software-hero-inner">
        <div className="software-hero-top">
          <div className="software-hero-logo" aria-hidden="true">
            {product.logoUrl ? (
              <img src={product.logoUrl} alt="" />
            ) : (
              <DefaultLogo />
            )}
          </div>

          <div className="software-hero-copy">
            <div className="software-hero-title-row">
              <h3 className="software-hero-name">{product.name}</h3>
              <span className="software-hero-version">{versionLabel}</span>
            </div>
            <p className="software-hero-tagline">{product.tagline || product.description}</p>
            {product.isFree !== false && (
              <p className="software-hero-free">Free forever · Unlimited use · Windows</p>
            )}
          </div>
        </div>

        <div className="software-hero-actions">
          <button
            type="button"
            className="software-hero-download"
            onClick={() => onDownload?.(product)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M3 5.5C3 4.12 4.12 3 5.5 3h2.1c.3 0 .58.13.77.36l1.16 1.39c.19.23.47.36.77.36H18.5C19.88 5.11 21 6.23 21 7.61V18.5c0 1.38-1.12 2.5-2.5 2.5h-13C4.12 21 3 19.88 3 18.5v-13z" opacity=".15" />
              <path d="M9.5 11.25h5v1.5h-5v-1.5zm0 3h5v1.5h-5v-1.5zM4.5 6.75h6.2l1.1 1.3H19.5v10.5h-15V6.75z" />
            </svg>
            <span>DOWNLOAD v{(product.version || '1.0.3').replace(/^v/i, '')} · WINDOWS</span>
          </button>

          {onDetails && (
            <button type="button" className="software-hero-details" onClick={() => onDetails(product)}>
              <Download style={{ width: 14, height: 14, opacity: 0.7 }} />
              Details
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
