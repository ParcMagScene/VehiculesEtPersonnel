import { Music } from 'lucide-react';
import { memo, useEffect, useState } from 'react';

const resolvedLogoCache = new Map();
const RESOLVED_LOGO_TTL_MS = 60 * 60 * 1000;
const RESOLVED_LOGO_CACHE_VERSION = 20260424;

function isAlreadyLocalLogo(src) {
  const v = String(src || '');
  return (
    v.startsWith('/radio-logos/') ||
    v.startsWith('/sonos-logos/') ||
    v.startsWith('/api/sonos/artwork?') ||
    v.startsWith('data:image/')
  );
}

async function resolveLogoUrl(src) {
  if (!src) return '';
  if (isAlreadyLocalLogo(src) || src.startsWith('/')) return src;
  if (!/^https?:\/\//i.test(src)) return src;

  const cached = resolvedLogoCache.get(src);
  if (cached && cached.expiresAt > Date.now() && cached.v === RESOLVED_LOGO_CACHE_VERSION) return cached.url;

  const res = await fetch(`/api/sonos/logo?url=${encodeURIComponent(src)}`, { method: 'GET', cache: 'no-cache' });
  if (!res.ok) throw new Error(`Logo resolver failed (${res.status})`);
  const data = await res.json();
  const url = data?.url || '';
  if (url) {
    resolvedLogoCache.set(src, { url, expiresAt: Date.now() + RESOLVED_LOGO_TTL_MS, v: RESOLVED_LOGO_CACHE_VERSION });
  }
  return url;
}

function RadioLogo({
  src,
  alt = '',
  className = '',
  placeholderClassName = '',
  placeholder = null,
  loading = 'lazy',
}) {
  const [resolvedSrc, setResolvedSrc] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setResolvedSrc('');

    resolveLogoUrl(src)
      .then((url) => {
        if (!cancelled) setResolvedSrc(url || '');
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [src]);

  const effectivePlaceholderClass = placeholderClassName || className;
  const fallbackNode = placeholder ?? <Music size={20} />;

  if (!resolvedSrc || failed) {
    return (
      <span
        className={effectivePlaceholderClass}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          aspectRatio: '1 / 1',
          overflow: 'hidden',
          borderRadius: 'var(--radius-md, 10px)',
          background: 'var(--theme-bg-hover, rgba(0, 0, 0, 0.05))',
          color: 'var(--theme-text-muted)',
        }}
      >
        {fallbackNode}
      </span>
    );
  }

  return (
    <span
      className={className}
      style={{
        display: 'block',
        aspectRatio: '1 / 1',
        overflow: 'hidden',
        borderRadius: 'var(--radius-md, 10px)',
      }}
    >
      <img
        src={resolvedSrc}
        alt={alt}
        loading={loading}
        onError={() => setFailed(true)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: 'block',
        }}
      />
    </span>
  );
}

export default memo(RadioLogo);
