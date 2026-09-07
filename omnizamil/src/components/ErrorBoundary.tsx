import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: string | null };

/** Keeps the desktop window from going fully blank on a React crash. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(err: Error) {
    return { error: err?.message || String(err) };
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error('[Omni-Removal]', err, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100%',
            padding: 32,
            fontFamily: 'Segoe UI, system-ui, sans-serif',
            background: '#f4f6f7',
            color: '#102a30',
          }}
        >
          <h1 style={{ marginTop: 0 }}>Omni-Removal hit an error</h1>
          <p>The UI crashed while starting. Restart the app, or open Settings after a refresh.</p>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              background: '#fff',
              border: '1px solid #d7e0e3',
              borderRadius: 12,
              padding: 16,
            }}
          >
            {this.state.error}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: 12,
              padding: '10px 16px',
              borderRadius: 10,
              border: 'none',
              background: '#0f9f96',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
