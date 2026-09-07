import React, { useEffect, useState } from 'react';
import { saveSocialLinks, type SocialLinks } from '../lib/supabaseAdmin';
import type { AdminProduct } from '../lib/product';

const LABELS: { key: keyof SocialLinks; label: string }[] = [
  { key: 'youtube', label: 'YouTube' },
  { key: 'twitter', label: 'Twitter / X' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'discord', label: 'Discord' },
];

export const SocialLinksControl: React.FC<{
  links: SocialLinks;
  onSaved: (links: SocialLinks) => void;
  product?: AdminProduct;
}> = ({ links, onSaved, product = 'omni' }) => {
  const [draft, setDraft] = useState(links);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setDraft(links);
  }, [links]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    try {
      await saveSocialLinks(product, draft);
      onSaved(draft);
      setMsg('Social links saved — desktop Support & Settings will pick them up on next sync.');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Save failed');
    }
  };

  return (
    <form className="panel-card form-grid" onSubmit={save}>
      <div className="card-header-clean">
        <h2>Social links</h2>
      </div>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
        Update anytime. Omni-Removal Support and Settings show these links automatically.
      </p>
      {LABELS.map(({ key, label }) => (
        <label key={key}>
          {label}
          <input
            value={draft[key]}
            onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
          />
        </label>
      ))}
      <button className="btn btn-primary" type="submit">
        Save social links
      </button>
      {msg && <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>{msg}</p>}
    </form>
  );
};
