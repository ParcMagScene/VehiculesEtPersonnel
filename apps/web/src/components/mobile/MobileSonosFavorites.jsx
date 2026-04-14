// ═══════════════════════════════════════════════════════════════
// MobileSonosFavorites — Liste scrollable des favoris (mobile)
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, memo } from 'react';
import { Heart, Music } from 'lucide-react';
import { Input } from '@/design-system';

function MobileSonosFavorites({ favorites, favoritesLoading, loadFavorites, playFavorite, nowPlaying, isAdmin }) {
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (favorites.length === 0 && !favoritesLoading) loadFavorites();
  }, [favorites.length, favoritesLoading, loadFavorites]);

  if (!isAdmin) return null;

  const filtered = search
    ? favorites.filter(f => f.title?.toLowerCase().includes(search.toLowerCase()))
    : favorites;

  const currentTitle = nowPlaying?.title;

  return (
    <div className="mobile-sonos-favorites">
      <div className="mobile-sonos-fav-header">
        <span><Heart size={14} /> Favoris</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--theme-text-muted)' }}>{favorites.length}</span>
      </div>

      {favorites.length > 5 && (
        <div className="mobile-sonos-search">
          <Input
            type="text"
            placeholder="Rechercher…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            size="sm"
          />
        </div>
      )}

      <div className="mobile-sonos-fav-list">
        {favoritesLoading ? (
          <span className="mobile-sonos-fav-empty">Chargement…</span>
        ) : filtered.length === 0 ? (
          <span className="mobile-sonos-fav-empty">
            {search ? 'Aucun favori trouvé' : 'Aucun favori configuré'}
          </span>
        ) : (
          filtered.map((fav, i) => (
            <button
              key={i}
              className={`mobile-sonos-fav-item${currentTitle === fav.title ? ' mobile-sonos-fav-playing' : ''}`}
              onClick={() => playFavorite(fav)}
            >
              {fav.albumArtURI ? (
                <img src={fav.albumArtURI} alt="" className="mobile-sonos-fav-art" loading="lazy" />
              ) : (
                <Music size={20} />
              )}
              <span className="mobile-sonos-fav-title">{fav.title}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export default memo(MobileSonosFavorites);
