import { ImageResponse } from 'next/og';

export const alt = 'Tournify — Torneos de Discord';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#0a0c0d',
          color: '#e9e4d0',
          padding: 80,
          fontFamily: 'sans-serif',
          backgroundImage:
            'radial-gradient(ellipse at top, rgba(139,149,52,0.15), transparent 60%), radial-gradient(ellipse at bottom right, rgba(217,119,6,0.12), transparent 60%)',
        }}
      >
        <div
          style={{
            fontSize: 24,
            letterSpacing: '0.3em',
            color: '#8a8676',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              border: '3px solid #8b9534',
              borderRadius: '50%',
            }}
          />
          OPSEC // TOURNIFY
        </div>

        <div
          style={{
            marginTop: 60,
            fontSize: 140,
            lineHeight: 0.95,
            fontWeight: 800,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <span>Deploy</span>
          <span>tournaments</span>
          <span style={{ color: '#8b9534' }}>// in discord</span>
        </div>

        <div
          style={{
            marginTop: 'auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '2px solid #2a2f36',
            paddingTop: 24,
            fontSize: 24,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
          }}
        >
          <span style={{ color: '#8a8676' }}>tournify.josbert.dev</span>
          <span style={{ color: '#d97706' }}>Single · Double · Round Robin · Teams</span>
        </div>
      </div>
    ),
    size,
  );
}
