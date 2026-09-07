import { useState } from 'react';
import { useApp } from '@/lib/store';

/** First launch: ask for display name once, then continue. */
export function NameGate({ children }: { children: React.ReactNode }) {
  const { state, setDisplayName } = useApp();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');

  if (state.profile.nameSet && state.profile.displayName.trim()) {
    return <>{children}</>;
  }

  const save = () => {
    const name = draft.trim();
    if (name.length < 2) {
      setError('Please enter your name (at least 2 characters).');
      return;
    }
    setDisplayName(name);
  };

  return (
    <div className="deps-gate name-gate">
      <div className="deps-card name-card">
        <div className="deps-mark" aria-hidden />
        <h1>Omni-Removal</h1>
        <p className="deps-lead">Welcome. Enter your name to get started on this device.</p>
        <label className="settings-field name-field">
          Your name
          <input
            autoFocus
            value={draft}
            placeholder="e.g. Alex"
            onChange={(e) => {
              setDraft(e.target.value);
              setError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save();
            }}
          />
        </label>
        {error && <p className="deps-error">{error}</p>}
        <button className="btn btn-primary deps-cta" type="button" onClick={save}>
          Continue
        </button>
        {state.profile.hardwareId ? (
          <p className="name-hwid">Device linked · {state.profile.hardwareId}</p>
        ) : null}
      </div>
    </div>
  );
}
