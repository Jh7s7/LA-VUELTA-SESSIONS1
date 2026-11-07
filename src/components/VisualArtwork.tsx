import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { AdVisualPreset } from '../types';
import heroStageImg from '../assets/images/hero_urbana_stage_1793486915838.jpg';
import vipLoungeAdImg from '../assets/images/ad_vip_lounge_1793486918507.jpg';
import streetwearAdImg from '../assets/images/ad_streetwear_capsule_1793486918489.jpg';
import rooftopSessionImg from '../assets/images/session_rooftop_night_1793486919091.jpg';

export const EDITORIAL_MEDIA = {
  stage: heroStageImg,
  vip_bar: vipLoungeAdImg,
  streetwear: streetwearAdImg,
  rooftop: rooftopSessionImg,
} as const;

interface EventPosterProps {
  imageUrl?: string;
  title: string;
  subtitle?: string;
  theme?: 'crimson' | 'cyan' | 'violet' | 'amber';
  className?: string;
}

const THEME_GRADIENTS: Record<
  string,
  { bg: string; beam1: string; beam2: string; accent: string; fallbackImg: string; tint: string }
> = {
  crimson: {
    bg: 'from-[#1f0608] via-[#120406] to-[#080304]',
    beam1: '#E50914',
    beam2: '#FF5722',
    accent: '#FF5722',
    fallbackImg: heroStageImg,
    tint: 'from-[#E50914]/25 via-transparent to-black/75',
  },
  cyan: {
    bg: 'from-[#041824] via-[#040e17] to-[#03060a]',
    beam1: '#00B4D8',
    beam2: '#2563EB',
    accent: '#38BDF8',
    fallbackImg: rooftopSessionImg,
    tint: 'from-cyan-500/20 via-transparent to-black/75',
  },
  violet: {
    bg: 'from-[#180726] via-[#0d0517] to-[#050308]',
    beam1: '#8B5CF6',
    beam2: '#EC4899',
    accent: '#C084FC',
    fallbackImg: vipLoungeAdImg,
    tint: 'from-fuchsia-600/20 via-transparent to-black/75',
  },
  amber: {
    bg: 'from-[#241404] via-[#140b03] to-[#080502]',
    beam1: '#F59E0B',
    beam2: '#EA580C',
    accent: '#FBBF24',
    fallbackImg: streetwearAdImg,
    tint: 'from-amber-500/25 via-transparent to-black/75',
  },
};

export const EventPosterVisual: React.FC<EventPosterProps> = ({
  imageUrl,
  title,
  subtitle,
  theme = 'crimson',
  className = '',
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const palette = THEME_GRADIENTS[theme] || THEME_GRADIENTS.crimson;
  const resolvedSrc = imageUrl || palette.fallbackImg;

  useEffect(() => {
    setImgFailed(false);
  }, [imageUrl, theme]);

  if (resolvedSrc && !imgFailed) {
    return (
      <div className={`relative overflow-hidden bg-zinc-950 ${className}`}>
        <img
          src={resolvedSrc}
          alt={title}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="h-full w-full object-cover"
        />
        {!imageUrl && (
          <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${palette.tint}`} />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${palette.bg} ${className}`}>
      <svg
        viewBox="0 0 600 360"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id={`spotA-${theme}`} cx="25%" cy="15%" r="65%">
            <stop offset="0%" stopColor={palette.beam1} stopOpacity="0.42" />
            <stop offset="100%" stopColor={palette.beam1} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`spotB-${theme}`} cx="80%" cy="25%" r="60%">
            <stop offset="0%" stopColor={palette.beam2} stopOpacity="0.35" />
            <stop offset="100%" stopColor={palette.beam2} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="600" height="360" fill={`url(#spotA-${theme})`} />
        <rect width="600" height="360" fill={`url(#spotB-${theme})`} />
        <polygon points="120,0 40,360 220,360" fill={palette.beam1} fillOpacity="0.11" />
        <polygon points="480,0 370,360 560,360" fill={palette.beam2} fillOpacity="0.11" />
        <polygon points="300,0 210,360 390,360" fill="#ffffff" fillOpacity="0.05" />
        {Array.from({ length: 28 }).map((_, idx) => {
          const barH = 18 + ((idx * 37) % 68);
          return (
            <rect
              key={idx}
              x={86 + idx * 15.5}
              y={245 - barH / 2}
              width="6"
              height={barH}
              rx="3"
              fill={idx % 2 === 0 ? palette.beam1 : palette.accent}
              fillOpacity="0.45"
            />
          );
        })}
        <path
          d="M0,310 Q150,292 300,308 T600,304 L600,360 L0,360 Z"
          fill="#050505"
          fillOpacity="0.92"
        />
      </svg>
      {subtitle && (
        <div className="pointer-events-none absolute top-3 right-3 text-[11px] font-medium tracking-wide text-white/75">
          {subtitle}
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
    </div>
  );
};

interface PromoBannerVisualProps {
  imageUrl?: string;
  title: string;
  preset?: AdVisualPreset;
  fallbackIndex?: number;
  className?: string;
}

const AD_PRESET_IMAGES: Record<AdVisualPreset, string> = {
  vip_bar: vipLoungeAdImg,
  streetwear: streetwearAdImg,
  stage: heroStageImg,
  rooftop: rooftopSessionImg,
};

const AD_ROTATION_IMAGES = [vipLoungeAdImg, streetwearAdImg, heroStageImg, rooftopSessionImg];

export const PromoBannerVisual: React.FC<PromoBannerVisualProps> = ({
  imageUrl,
  title,
  preset,
  fallbackIndex = 0,
  className = '',
}) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [imageUrl, preset]);

  const defaultImg = preset
    ? AD_PRESET_IMAGES[preset] || vipLoungeAdImg
    : AD_ROTATION_IMAGES[Math.abs(fallbackIndex) % AD_ROTATION_IMAGES.length];
  const src = imageUrl || defaultImg;

  if (src && !failed) {
    return (
      <div className={`relative overflow-hidden bg-zinc-950 ${className}`}>
        <img
          src={src}
          alt={title}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/92 via-black/65 to-black/25" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-br from-[#1f0608] via-[#100912] to-[#070709] ${className}`}
    />
  );
};

interface GalleryVisualProps {
  imageUrl?: string;
  title: string;
  preset?: 'outfit' | 'flow' | 'community' | 'night' | 'dj' | 'backstage';
  className?: string;
}

export const GalleryVisual: React.FC<GalleryVisualProps> = ({
  imageUrl,
  title,
  preset = 'night',
  className = '',
}) => {
  const [failed, setFailed] = useState(false);

  const presetImgMap: Record<string, string> = {
    outfit: streetwearAdImg,
    flow: heroStageImg,
    community: rooftopSessionImg,
    night: heroStageImg,
    dj: rooftopSessionImg,
    backstage: vipLoungeAdImg,
  };

  const resolvedSrc = imageUrl || presetImgMap[preset];

  if (resolvedSrc && !failed) {
    return (
      <div className={`relative overflow-hidden bg-zinc-900 ${className}`}>
        <img
          src={resolvedSrc}
          alt={title}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.035]"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      </div>
    );
  }

  const presetMap: Record<string, { c1: string; c2: string; label: string }> = {
    outfit: { c1: '#E50914', c2: '#991B1B', label: 'ESTILO URBANO' },
    flow: { c1: '#F97316', c2: '#BE123C', label: 'PISTA CENTRAL' },
    community: { c1: '#0EA5E9', c2: '#1E3A8A', label: 'COMUNIDAD LV' },
    night: { c1: '#E11D48', c2: '#4C0519', label: 'SESIÓN EN VIVO' },
    dj: { c1: '#8B5CF6', c2: '#3B0764', label: 'CABINA & DJ SET' },
    backstage: { c1: '#F59E0B', c2: '#78350F', label: 'BACKSTAGE' },
  };
  const cfg = presetMap[preset] || presetMap.night;

  return (
    <div
      className={`relative flex flex-col justify-between overflow-hidden bg-zinc-950 p-5 ${className}`}
    >
      <svg
        viewBox="0 0 400 400"
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id={`gal-${preset}`} cx="30%" cy="25%" r="75%">
            <stop offset="0%" stopColor={cfg.c1} stopOpacity="0.45" />
            <stop offset="65%" stopColor={cfg.c2} stopOpacity="0.2" />
            <stop offset="100%" stopColor="#09090b" stopOpacity="1" />
          </radialGradient>
        </defs>
        <rect width="400" height="400" fill={`url(#gal-${preset})`} />
        <circle cx="290" cy="110" r="95" stroke={cfg.c1} strokeOpacity="0.22" strokeWidth="1.5" fill="none" />
        <circle cx="290" cy="110" r="55" stroke="#ffffff" strokeOpacity="0.1" strokeWidth="1" fill="none" />
        <line x1="32" y1="320" x2="368" y2="320" stroke="#ffffff" strokeOpacity="0.12" strokeWidth="1" />
      </svg>
      <div className="relative z-10 flex items-center justify-between text-[11px] font-medium text-zinc-400">
        <span>LA VUELTA ARCHIVO</span>
        <span>{cfg.label}</span>
      </div>
      <div className="relative z-10 mt-auto pt-12">
        <p className="font-display text-2xl leading-tight text-white">{title}</p>
      </div>
    </div>
  );
};

export const QrCodeBox: React.FC<{ payload: string; size?: number }> = ({ payload, size = 148 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (canvasRef.current && payload) {
      QRCode.toCanvas(canvasRef.current, payload, {
        width: size,
        margin: 1,
        color: { dark: '#09090b', light: '#ffffff' },
      }).catch(() => {});
    }
  }, [payload, size]);

  return (
    <div className="inline-flex items-center justify-center rounded-lg bg-white p-2.5 shadow-xs">
      <canvas ref={canvasRef} width={size} height={size} aria-label="Código QR único de entrada" />
    </div>
  );
};

export const OFFICIAL_BRAND_LOGO_SRC = '/assets/aistudio/xxhdpi_f2a8a61a.png';

interface AnimatedBrandMarkProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const AnimatedBrandMark: React.FC<AnimatedBrandMarkProps> = ({
  size = 'md',
  className = '',
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  const dims =
    size === 'lg'
      ? { box: 'h-14 w-14', inner: 'inset-[4px]' }
      : size === 'sm'
      ? { box: 'h-9 w-9', inner: 'inset-[3px]' }
      : { box: 'h-10 w-10', inner: 'inset-[3px]' };

  return (
    <span
      className={`relative inline-flex ${dims.box} shrink-0 items-center justify-center select-none ${className}`}
    >
      {/* Pulsing Crimson Acoustic Halo */}
      <span
        aria-hidden="true"
        className="lv-seal-halo pointer-events-none absolute inset-0 rounded-full bg-[#E50914]/45 blur-[5px]"
      />

      {/* Rotating Vinyl & Gold Strobe Ring */}
      <svg
        viewBox="0 0 64 64"
        className="lv-orbit-ring pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <circle
          cx="32"
          cy="32"
          r="30.5"
          fill="#09090B"
          stroke="rgba(255,255,255,0.16)"
          strokeWidth="1"
        />
        <circle
          cx="32"
          cy="32"
          r="29.5"
          fill="none"
          stroke="#E50914"
          strokeWidth="2"
          strokeDasharray="24 14 10 14"
          strokeLinecap="round"
        />
        <circle
          cx="32"
          cy="32"
          r="29.5"
          fill="none"
          stroke="#D4AF37"
          strokeWidth="1.75"
          strokeDasharray="8 38"
          strokeDashoffset="18"
          strokeLinecap="round"
        />
      </svg>

      {/* Official Circular Red LA VUELTA SESSIONS Seal */}
      <span
        className={`lv-seal-disc absolute ${dims.inner} overflow-hidden rounded-full bg-[#E50914] ring-1 ring-white/80 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105`}
      >
        {!imgFailed ? (
          <img
            src={OFFICIAL_BRAND_LOGO_SRC}
            alt="LA VUELTA SESSIONS"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="h-full w-full scale-[1.12] object-cover"
          />
        ) : (
          <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
            <circle cx="32" cy="32" r="32" fill="#E50914" />
            <text
              x="32"
              y="19"
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize="10"
              fontWeight="900"
              fontFamily="Bebas Neue, sans-serif"
            >
              LA
            </text>
            <text
              x="32"
              y="36"
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize="16"
              fontWeight="900"
              fontFamily="Bebas Neue, sans-serif"
            >
              VUELTA
            </text>
            <text
              x="32"
              y="49"
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize="9"
              fontWeight="900"
              fontFamily="Bebas Neue, sans-serif"
            >
              SESSIONS
            </text>
          </svg>
        )}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/15 to-transparent"
        />
      </span>
    </span>
  );
};

export type ThematicBadgeVariant = 'sessions' | 'vip_zones' | 'qr_shield' | 'gallery_archive';

export const ThematicLogoBadge: React.FC<{
  variant: ThematicBadgeVariant;
  className?: string;
}> = ({ variant, className = '' }) => {
  const gradId = `lvStampGrad-${variant}`;

  return (
    <span
      className={`relative inline-flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full select-none transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.08] ${className}`}
      aria-hidden="true"
    >
      {/* Subtle Crimson Backlight on Hover */}
      <span className="pointer-events-none absolute inset-0.5 rounded-full bg-[#E50914]/25 blur-[4px] opacity-75 transition-opacity duration-200 group-hover:opacity-100" />

      <svg viewBox="0 0 64 64" className="relative h-full w-full">
        <defs>
          <radialGradient id={gradId} cx="35%" cy="28%" r="72%">
            <stop offset="0%" stopColor="#FF1F2A" />
            <stop offset="62%" stopColor="#E50914" />
            <stop offset="100%" stopColor="#B8050E" />
          </radialGradient>
        </defs>

        {/* Outer Obsidian Vinyl Disc Base */}
        <circle cx="32" cy="32" r="31" fill="#09090B" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />

        {/* Animated Orbital Vinyl Grooves */}
        <g className="lv-orbit-ring-slow">
          <circle
            cx="32"
            cy="32"
            r="28.5"
            fill="none"
            stroke="#D4AF37"
            strokeOpacity="0.85"
            strokeWidth="1.5"
            strokeDasharray="12 22 6 22"
            strokeLinecap="round"
          />
          <circle
            cx="32"
            cy="32"
            r="28.5"
            fill="none"
            stroke="#E50914"
            strokeWidth="1.5"
            strokeDasharray="16 32"
            strokeDashoffset="20"
            strokeLinecap="round"
          />
        </g>

        {/* Official Signature Crimson Stamp Core + Crisp White Ring */}
        <circle
          cx="32"
          cy="32"
          r="24.5"
          fill={`url(#${gradId})`}
          stroke="#FFFFFF"
          strokeWidth="1.75"
        />

        {/* Arched Stamp Crest & Base Lines (Echoing LA / VUELTA / SESSIONS Seal Geometry) */}
        <path
          d="M 20.5 16.5 A 19.5 19.5 0 0 1 43.5 16.5"
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity="0.65"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M 21.5 48 A 19.5 19.5 0 0 0 42.5 48"
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity="0.65"
          strokeWidth="1.6"
          strokeLinecap="round"
        />

        {/* 01. SESSIONS — Studio Condenser Mic + Animated Acoustic Waves */}
        {variant === 'sessions' && (
          <g>
            <rect
              x="16.5"
              y="27"
              width="2.6"
              height="10"
              rx="1.3"
              fill="#FDE047"
              className="lv-mini-wave"
              style={{ animationDelay: '0.05s' }}
            />
            <rect
              x="21"
              y="24"
              width="2.6"
              height="16"
              rx="1.3"
              fill="#FFFFFF"
              className="lv-mini-wave"
              style={{ animationDelay: '0.22s' }}
            />
            {/* Condenser Mic Capsule & Stand */}
            <rect x="28" y="20.5" width="8" height="13.5" rx="4" fill="#FFFFFF" />
            <line x1="29.5" y1="25" x2="34.5" y2="25" stroke="#E50914" strokeWidth="1.4" strokeLinecap="round" />
            <line x1="29.5" y1="28.2" x2="34.5" y2="28.2" stroke="#E50914" strokeWidth="1.4" strokeLinecap="round" />
            <path
              d="M 25.5 28.5 A 6.5 6.5 0 0 0 38.5 28.5"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="2.1"
              strokeLinecap="round"
            />
            <line x1="32" y1="35" x2="32" y2="41.5" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
            <line x1="27.5" y1="41.5" x2="36.5" y2="41.5" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
            <rect
              x="40.4"
              y="24"
              width="2.6"
              height="16"
              rx="1.3"
              fill="#FFFFFF"
              className="lv-mini-wave"
              style={{ animationDelay: '0.35s' }}
            />
            <rect
              x="44.9"
              y="27"
              width="2.6"
              height="10"
              rx="1.3"
              fill="#FDE047"
              className="lv-mini-wave"
              style={{ animationDelay: '0.15s' }}
            />
          </g>
        )}

        {/* 02. GENERAL · VIP — VIP Crown + Perforated Stage Pass */}
        {variant === 'vip_zones' && (
          <g>
            {/* VIP Crown */}
            <path
              d="M 23.5 28 L 25.5 20.5 L 32 25 L 38.5 20.5 L 40.5 28 Z"
              fill="#FDE047"
              stroke="#FFFFFF"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            {/* Perforated Ticket Pass */}
            <path
              d="M 19.5 31 H 44.5 V 35 A 2.4 2.4 0 0 0 44.5 39.8 V 43 H 19.5 V 39.8 A 2.4 2.4 0 0 0 19.5 35 Z"
              fill="#FFFFFF"
            />
            <line
              x1="36.5"
              y1="32.5"
              x2="36.5"
              y2="41.5"
              stroke="#E50914"
              strokeWidth="1.6"
              strokeDasharray="2 2"
              strokeLinecap="round"
            />
            <rect x="23" y="34.8" width="9.5" height="2" rx="1" fill="#E50914" />
            <rect x="23" y="38.2" width="6.5" height="1.8" rx="0.9" fill="#09090B" />
          </g>
        )}

        {/* 03. HMAC-256 QR — Scannable QR Finder Matrix + Sweeping Laser */}
        {variant === 'qr_shield' && (
          <g>
            {/* Top-Left Finder */}
            <rect x="20.5" y="21" width="9" height="9" rx="1.8" fill="none" stroke="#FFFFFF" strokeWidth="2.1" />
            <rect x="23.5" y="24" width="3" height="3" rx="0.6" fill="#FFFFFF" />
            {/* Top-Right Finder */}
            <rect x="34.5" y="21" width="9" height="9" rx="1.8" fill="none" stroke="#FFFFFF" strokeWidth="2.1" />
            <rect x="37.5" y="24" width="3" height="3" rx="0.6" fill="#FFFFFF" />
            {/* Bottom-Left Finder */}
            <rect x="20.5" y="34" width="9" height="9" rx="1.8" fill="none" stroke="#FFFFFF" strokeWidth="2.1" />
            <rect x="23.5" y="37" width="3" height="3" rx="0.6" fill="#FFFFFF" />
            {/* Bottom-Right Cryptographic Check */}
            <path
              d="M 34.5 38.5 L 37.8 41.8 L 43.8 34.8"
              fill="none"
              stroke="#FDE047"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Animated Laser Scan Sweep */}
            <line
              x1="18.5"
              y1="32"
              x2="45.5"
              y2="32"
              stroke="#FDE047"
              strokeWidth="1.8"
              strokeLinecap="round"
              className="lv-qr-laser"
            />
          </g>
        )}

        {/* 04. MEMORIAS FOTOGRÁFICAS — Urban Camera Shutter Lens + Flash Spark */}
        {variant === 'gallery_archive' && (
          <g>
            {/* Camera Body */}
            <path
              d="M 20 26.5 H 25 L 27.2 23.2 H 36.8 L 39 26.5 H 44 A 2.5 2.5 0 0 1 46.5 29 V 41 A 2.5 2.5 0 0 1 44 43.5 H 20 A 2.5 2.5 0 0 1 17.5 41 V 29 A 2.5 2.5 0 0 1 20 26.5 Z"
              fill="#FFFFFF"
            />
            {/* Red Shutter Lens Ring */}
            <circle cx="32" cy="35" r="6.4" fill="#E50914" />
            <circle cx="32" cy="35" r="3.4" fill="#09090B" stroke="#FFFFFF" strokeWidth="1.4" />
            <circle cx="33.3" cy="33.7" r="1" fill="#FDE047" />
            {/* Flash Spark */}
            <circle cx="42" cy="30" r="1.6" fill="#E50914" />
            <path
              d="M 44.5 19.5 L 45.4 22.1 L 48 23 L 45.4 23.9 L 44.5 26.5 L 43.6 23.9 L 41 23 L 43.6 22.1 Z"
              fill="#FDE047"
            />
          </g>
        )}
      </svg>
    </span>
  );
};

