import { useEffect, useMemo, useState } from 'react'
import { Mark } from '../Mark'
import { PageHeader } from '../components/PageHeader'
import { useControl } from '../lib/control'
import { fetchBrandSettings, DEFAULT_BRAND, type BrandSettings } from '../lib/telemetry'

const STEPS = [
  {
    title: 'Download Executable',
    body: 'Grab the tool you need. Fast, private and on-device downloads.',
    tip: 'No sign-up required',
  },
  {
    title: 'Local Execution',
    body: 'Media is saved on your PC. Jobs and engines stay local.',
    tip: 'On-device downloads',
  },
  {
    title: 'Unlimited $0 Processing',
    body: 'Use it as much as you want. Forever free.',
    tip: 'Truly Unlimited',
  },
]

export function AboutPage() {
  const { settings, refreshRemote } = useControl()
  const [brand, setBrand] = useState<BrandSettings>(DEFAULT_BRAND)

  useEffect(() => {
    void fetchBrandSettings().then(setBrand)
    void refreshRemote()
    const t = window.setInterval(() => {
      void fetchBrandSettings().then(setBrand)
      void refreshRemote()
    }, 12_000)
    return () => window.clearInterval(t)
  }, [refreshRemote, settings?.brand_website_url, settings?.social_links])

  const website =
    brand.brandWebsiteUrl ||
    settings?.brand_website_url ||
    'https://shiftzero.netlify.app/'

  const social = useMemo(() => {
    const links = {
      ...DEFAULT_BRAND.social,
      ...(brand.social || {}),
      ...(settings?.social_links || {}),
    }
    return [
      { label: 'YouTube', url: links.youtube },
      { label: 'Twitter', url: links.twitter },
      { label: 'Facebook', url: links.facebook },
      { label: 'Instagram', url: links.instagram },
      { label: 'WhatsApp', url: links.whatsapp },
      { label: 'Discord', url: links.discord },
    ].filter((s) => Boolean(s.url))
  }, [brand.social, settings?.social_links])

  return (
    <PageHeader title="About" subtitle={`${brand.brandName} — the studio behind ShiftGrab.`}>
      <div className="sz-about">
        <section className="sz-card sz-hero-card">
          <p className="sz-kicker">Developed by Team {brand.brandName}</p>
          <div className="sz-brand-row">
            <Mark className="sz-logo" studio />
            <div>
              <h2 className="sz-name">{brand.brandName}</h2>
              <p className="sz-tagline">{brand.brandTagline}</p>
            </div>
          </div>
          <p className="sz-desc">{brand.brandAbout}</p>
          <div className="sz-badges">
            <span className="sz-badge">Zero Cost</span>
            <span className="sz-badge">On-Device Downloads</span>
            <span className="sz-badge">ShiftGrab</span>
          </div>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => void window.shiftgrab.openExternal(website)}
          >
            Explore Products
          </button>
        </section>

        <section className="sz-card">
          <h3 className="sz-section-title">How ShiftZero Works</h3>
          <ol className="sz-steps">
            {STEPS.map((step, i) => (
              <li key={step.title}>
                <span className="sz-step-num">{i + 1}</span>
                <div>
                  <strong>{step.title}</strong>
                  <p>{step.body}</p>
                  <span className="sz-step-tip">{step.tip}</span>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="sz-card sz-follow">
          <h3 className="sz-section-title">Follow Team {brand.brandName}</h3>
          <div className="sz-social">
            {social.map((s) => (
              <button
                key={s.label}
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => void window.shiftgrab.openExternal(s.url)}
              >
                {s.label}
              </button>
            ))}
          </div>
          <p className="muted" style={{ marginTop: 12, fontSize: 12 }}>
            Links update from OmniGrab admin automatically (no restart needed).
          </p>
        </section>
      </div>
    </PageHeader>
  )
}
