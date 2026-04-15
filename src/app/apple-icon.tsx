import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        background: 'linear-gradient(135deg, #7C8CFF 0%, #9B8CFF 50%, #C084FC 100%)',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '40px',
      }}
    >
      <span
        style={{
          color: '#ffffff',
          fontSize: '110px',
          fontWeight: 800,
          fontFamily: 'sans-serif',
          lineHeight: 1,
          letterSpacing: '-4px',
          marginTop: '6px',
        }}
      >
        L
      </span>
    </div>,
    { ...size },
  );
}
