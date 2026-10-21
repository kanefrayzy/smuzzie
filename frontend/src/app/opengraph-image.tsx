import { ImageResponse } from 'next/og';

// Default social preview image for every page (Telegram, Discord, X, etc.)
// Edge runtime: the Node build of next/og fails to load on Windows in Next 14.
export const runtime = 'edge';
export const alt = 'Smuzzie — premium design services';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(circle at 50% 40%, #3d0000 0%, #080808 70%)',
          color: '#fff',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 120, fontWeight: 900, letterSpacing: -4 }}>
          <span>Smuzzie</span>
          <span style={{ color: '#e63946', marginLeft: 24 }}>Services</span>
        </div>
        <div style={{ fontSize: 40, color: '#bbb', marginTop: 24 }}>
          Logos · Avatars · 3D · Threads · Custom design
        </div>
      </div>
    ),
    size,
  );
}
