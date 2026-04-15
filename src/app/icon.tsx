import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        background: 'linear-gradient(135deg, #7C8CFF 0%, #9B8CFF 50%, #C084FC 100%)',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '8px',
      }}
    >
      {/* Soft glowing dot — the "luminary" mark */}
      <div
        style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.95)',
          boxShadow: '0 0 8px 4px rgba(255,255,255,0.55)',
        }}
      />
    </div>,
    { ...size },
  );
}
