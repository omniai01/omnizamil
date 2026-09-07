import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DEFAULT_SOCIAL_LINKS, fetchSocialLinks, type SocialLinks } from '@/lib/telemetry';

const LABELS: { key: keyof SocialLinks; label: string; className: string }[] = [
  { key: 'youtube', label: 'YouTube', className: 'social-yt' },
  { key: 'twitter', label: 'Twitter', className: 'social-tw' },
  { key: 'facebook', label: 'Facebook', className: 'social-fb' },
  { key: 'instagram', label: 'Instagram', className: 'social-ig' },
  { key: 'whatsapp', label: 'WhatsApp', className: 'social-wa' },
  { key: 'discord', label: 'Discord', className: 'social-dc' },
];

export function SupportPage() {
  const [links, setLinks] = useState<SocialLinks>(DEFAULT_SOCIAL_LINKS);

  useEffect(() => {
    void fetchSocialLinks().then(setLinks);
  }, []);

  return (
    <div className="page-wrap">
      <div className="page-header">
        <div>
          <h2>Support</h2>
          <p>Help for Omni-Removal</p>
        </div>
        <Link className="btn btn-ghost" to="/settings">
          Back to Settings
        </Link>
      </div>

      <div className="settings-grid settings-wide">
        <div className="setting-row setting-block">
          <div>
            <h4>Solid Word support</h4>
            <p className="text-strong">Free of cost. Unlimited.</p>
            <p>
              Omni is built for creators who need clean exports without subscriptions. Support stays
              free. Ask anytime, no ticket fees.
            </p>
          </div>
        </div>

        <div className="setting-row setting-block">
          <div>
            <h4>Works offline</h4>
            <p>
              Download Omni-Removal once. After that, image and video cleaning runs fully offline on
              your machine. No internet required for processing.
            </p>
          </div>
        </div>

        <div className="setting-row setting-block">
          <div>
            <h4>Everything free and unlimited</h4>
            <p>
              Single Image, Bulk Image, Single Video, Bulk Video, Downloads, and Dashboard are all
              unlocked. No caps on how many files you clean.
            </p>
          </div>
        </div>

        <div className="setting-row setting-block">
          <div>
            <h4>Join our social and more activity</h4>
            <p>Stay close for new project drops and Omni channel updates.</p>
            <div className="social-row">
              {LABELS.map((s) => (
                <a
                  key={s.key}
                  className={`social-btn ${s.className}`}
                  href={links[s.key] || '#'}
                  target="_blank"
                  rel="noreferrer"
                >
                  {s.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
