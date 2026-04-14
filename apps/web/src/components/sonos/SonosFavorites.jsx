// ═══════════════════════════════════════════════════════════════
// SonosFavorites — Liste verticale avec vignettes (style Sonos)
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, memo } from 'react';
import { Star, Search, Music } from 'lucide-react';

function SonosFavorites({
  favorites, favoritesLoading, loadFavorites, playFavorite,
  nowPlaying,
}) {
  const [search, setSearch] = useState('');

  // Auto-load favorites on mount
  useEffect(() => {
    if (favorites.length === 0 && !favoritesLoading) loadFavorites();
  }, [favorites.length, favoritesLoading, loadFavorites]);

  const filtered = search
    ? favorites.filter(f => f.title?.toLowerCase().includes(search.toLowerCase()))
    : favorites;

  const currentTitle = nowPlaying?.title;

  return (
    <div className="sonos-favs">
      {/* Header */}
      <div className="sonos-favs-head">
        <Star size={15} />
        <span className="sonos-favs-title">Favoris Sonos</span>
      </div>

      {/* Search */}
      {favorites.length > 5 && (
        <div className="sonos-favs-search">
          <Search size={13} />
          <input
            type="text"
            placeholder="Rechercher…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      )}

      {/* List */}
      <div className="sonos-favs-list">
        {favoritesLoading ? (
          <div className="sonos-favs-empty">Chargement…</div>
        ) : filtered.length === 0 ? (
          <div className="sonos-favs-empty">
            {search ? 'Aucun résultat' : 'Aucun favori configuré'}
          </div>
        ) : (
          filtered.map((fav, i) => (
            <button
              key={i}
              className={`sonos-favs-item${currentTitle === fav.title ? ' sonos-favs-active' : ''}`}
              onClick={() => playFavorite(fav)}
              title={`Lire : ${fav.title}`}
            >
              {fav.albumArtURI ? (
                <img src={fav.albumArtURI} alt="" className="sonos-favs-art" loading="lazy" />
              ) : (
                <span className="sonos-favs-art sonos-favs-art-ph">
                  <Music size={18} />
                </span>
              )}
              <div className="sonos-favs-meta">
                <span className="sonos-favs-name">{fav.title}</span>
                {fav.description && (
                  <span className="sonos-favs-desc">{fav.description}</span>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export default memo(SonosFavorites);
