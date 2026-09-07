import React, { useEffect, useState } from 'react';
import { type BrandConfig, type SocialLinks } from '../lib/supabaseAdmin';

type Props = {
  initial: BrandConfig;
  social: SocialLinks;
  onSave: (brand: BrandConfig, social: SocialLinks) => Promise<void>;
};

const SOCIAL_LABELS: { key: keyof SocialLinks; label: string }[] = [
  { key: 'youtube', label: 'YouTube' },
  { key: 'twitter', label: 'Twitter / X' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'discord', label: 'Discord' },
];

export const BrandingControl: React.FC<Props> = ({ initial, social, onSave }) => {
  const [draft, setDraft] = useState(initial);
  const [socialDraft, setSocialDraft] = useState(social);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setDraft(initial);
  }, [initial]);

  useEffect(() => {
    setSocialDraft(social);
  }, [social]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      await onSave(draft, socialDraft);
      setMsg('ShiftZero branding saved — desktop ShiftZero page updates on next sync.');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="panel-card form-grid" onSubmit={save}>
      <div className="card-header-clean">
        <h2>ShiftZero branding</h2>
      </div>
      <p style={{ color: '#5a6b72', margin: 0 }}>
        Desktop ShiftZero page. Brand color stays teal <strong>#157B86</strong>.
      </p>

      <label>
        Brand name
        <input
          className="settings-input"
          value={draft.brandName}
          onChange={(e) => setDraft({ ...draft, brandName: e.target.value })}
        />
      </label>
      <label>
        Tagline
        <input
          className="settings-input"
          value={draft.brandTagline}
          onChange={(e) => setDraft({ ...draft, brandTagline: e.target.value })}
        />
      </label>
      <label>
        About
        <textarea
          className="settings-input"
          rows={3}
          value={draft.brandAbout}
          onChange={(e) => setDraft({ ...draft, brandAbout: e.target.value })}
        />
      </label>
      <label>
        Website / domain URL
        <input
          className="settings-input"
          value={draft.brandWebsiteUrl}
          onChange={(e) => setDraft({ ...draft, brandWebsiteUrl: e.target.value })}
          placeholder="https://shiftzero.dev"
        />
      </label>
      <label>
        Logo image URL (optional)
        <input
          className="settings-input"
          value={draft.brandLogoUrl}
          onChange={(e) => setDraft({ ...draft, brandLogoUrl: e.target.value })}
          placeholder="https://…"
        />
      </label>

      <h3 style={{ marginBottom: 0 }}>Social links</h3>
      {SOCIAL_LABELS.map(({ key, label }) => (
        <label key={key}>
          {label}
          <input
            className="settings-input"
            value={socialDraft[key]}
            onChange={(e) => setSocialDraft({ ...socialDraft, [key]: e.target.value })}
          />
        </label>
      ))}

      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? 'Saving…' : 'Save branding'}
      </button>
      {msg && <p>{msg}</p>}
    </form>
  );
};
