import { Music } from 'lucide-react';
import { memo, useEffect, useState } from 'react';

function isAlreadyLocalLogo(src) {
  const v = String(src || '');
  return (
    v.startsWith('/radio-logos/') ||
    v.startsWith('/sonos-logos/') ||
    v.startsWith('/api/sonos/artwork?') ||
    v.startsWith('/api/sonos/logo?') ||
    v.startsWith('data:image/')
  );
}

function resolveLogoUrl(src) {
  if (!src) return '';
  if (isAlreadyLocalLogo(src) || src.startsWith('/')) return src;
  if (!/^https?:\/\//i.test(src)) return src;
  // URL externe : passe par le proxy meme-origine pour contourner la CSP admin
  // (imgSrc sans wildcard) et le mixed content sur pages https servant du http.
  return `/api/sonos/logo?url=${encodeURIComponent(src)}`;
}

function RadioLogo({
  src,
  fallbackSrc = '',
  alt = '',
  className = '',
  placeholderClassName = '',
  placeholder = null,
  loading = 'lazy',
}) {
  const [resolvedSrc, setResolvedSrc] = useState('');
  const [failed, setFailed] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    setFailed(false);
    // Resout src en priorite, sinon bascule immediatement sur fallbackSrc.
    const primary = src || '';
    if (!primary && fallbackSrc) {
      setUsingFallback(true);
      setResolvedSrc(resolveLogoUrl(fallbackSrc));
      return;
    }
    setUsingFallback(false);
    setResolvedSrc(resolveLogoUrl(primary));
  }, [src, fallbackSrc]);

  const effectivePlaceholderClass = placeholderClassName || className;
  const fallbackNode = placeholder ?? <Music size={20} />;

  const tryFallbackOnError = () => {
    if (fallbackSrc && !usingFallback) {
      setUsingFallback(true);
      setFailed(false);
      setResolvedSrc(resolveLogoUrl(fallbackSrc));
      return;
    }
    setFailed(true);
  };

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
        onError={tryFallbackOnError}
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
