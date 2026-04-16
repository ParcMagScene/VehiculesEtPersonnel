// ═══════════════════════════════════════════════════════════════
// SonosSources — Navigation sources + Favoris intégrés (col 3)
// Services musicaux, radios, playlists, browsing hiérarchique
// ═══════════════════════════════════════════════════════════════

import { useEffect, useState, memo } from 'react';
import {
  Radio,
  ListMusic,
  Music,
  Star,
  ChevronLeft,
  ChevronRight,
  Folder,
  Loader,
  Book,
  Server,
  Info,
  Podcast,
} from 'lucide-react';

const SERVICE_ICONS = {
  star: <Star size={16} />,
  'list-music': <ListMusic size={16} />,
  radio: <Radio size={16} />,
  music: <Music size={16} />,
  book: <Book size={16} />,
  server: <Server size={16} />,
  podcast: <Podcast size={16} />,
};

function SonosSources({
  musicServices,
  loadMusicServices,
  browseSource,
  browseBack,
  browseReset,
  browseStack,
  browseData,
  browseLoading,
  favorites,
  favoritesLoading,
  loadFavorites,
  playFavorite,
  nowPlaying,
  isAdmin,
  search,
}) {
  const [tab, setTab] = useState('favorites'); // 'favorites' | 'sources'

  useEffect(() => {
    if (favorites.length === 0 && !favoritesLoading) loadFavorites();
  }, [favorites.length, favoritesLoading, loadFavorites]);

  useEffect(() => {
    if (musicServices.length === 0 && isAdmin) loadMusicServices();
  }, [musicServices.length, isAdmin, loadMusicServices]);

  const isBrowsing = browseStack.length > 0;
  const currentTitle = isBrowsing ? browseStack[browseStack.length - 1].title : null;
  const currentNowTitle = nowPlaying?.title;
  const searchLower = (search || '').toLowerCase();

  // Filtrage favoris par recherche
  const filteredFavorites = searchLower
    ? favorites.filter((f) => f.title?.toLowerCase().includes(searchLower))
    : favorites;

  return (
    <div className="sonos-sources">
      {/* Tabs */}
      <div className="sonos-sources-tabs">
        <button
          className={`sonos-sources-tab${tab === 'favorites' ? ' sonos-sources-tab-active' : ''}`}
          onClick={() => {
            setTab('favorites');
            browseReset();
          }}
        >
          <Star size={13} />
          Favoris
          {favorites.length > 0 && <span className="sonos-sources-badge">{favorites.length}</span>}
        </button>
        {isAdmin && (
          <button
            className={`sonos-sources-tab${tab === 'sources' ? ' sonos-sources-tab-active' : ''}`}
            onClick={() => setTab('sources')}
          >
            <Radio size={13} />
            Sources
          </button>
        )}
      </div>

      {/* ─── Favoris Tab ─── */}
      {tab === 'favorites' && (
        <div className="sonos-sources-list">
          {favoritesLoading ? (
            <div className="sonos-sources-loading">
              <Loader size={18} className="sonos-spin" /> Chargement…
            </div>
          ) : filteredFavorites.length === 0 ? (
            <div className="sonos-sources-empty">
              {searchLower ? 'Aucun résultat' : 'Aucun favori configuré'}
            </div>
          ) : (
            filteredFavorites.map((fav, i) => (
              <button
                key={i}
                className={`sonos-sources-item sonos-sources-playable${currentNowTitle === fav.title ? ' sonos-sources-active' : ''}`}
                onClick={() => playFavorite(fav)}
                title={`Lire : ${fav.title}`}
              >
                {fav.albumArtURI ? (
                  <img src={fav.albumArtURI} alt="" className="sonos-sources-art" loading="lazy" />
                ) : (
                  <span className="sonos-sources-icon">
                    <Music size={16} />
                  </span>
                )}
                <div className="sonos-sources-item-meta">
                  <span className="sonos-sources-item-title">{fav.title}</span>
                  {fav.description && (
                    <span className="sonos-sources-item-artist">{fav.description}</span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* ─── Sources Tab ─── */}
      {tab === 'sources' && (
        <>
          {/* Breadcrumb header when browsing */}
          {isBrowsing && (
            <div className="sonos-sources-head">
              <button className="sonos-sources-back" onClick={browseBack} title="Retour">
                <ChevronLeft size={16} />
              </button>
              <span className="sonos-sources-breadcrumb">{currentTitle}</span>
            </div>
          )}

          {browseLoading ? (
            <div className="sonos-sources-loading">
              <Loader size={18} className="sonos-spin" /> Chargement…
            </div>
          ) : isBrowsing ? (
            <BrowseContent
              data={browseData}
              onBrowse={browseSource}
              onPlay={playFavorite}
              search={searchLower}
            />
          ) : (
            <ServiceList services={musicServices} onBrowse={browseSource} search={searchLower} />
          )}
        </>
      )}
    </div>
  );
}

/** Liste des services musicaux (vue racine) */
function ServiceList({ services, onBrowse, search }) {
  const filtered = search
    ? services.filter((s) => s.title?.toLowerCase().includes(search))
    : services;

  if (filtered.length === 0) {
    return (
      <div className="sonos-sources-empty">
        {search ? 'Aucun résultat' : 'Aucune source disponible'}
      </div>
    );
  }
  return (
    <div className="sonos-sources-list">
      {filtered.map((svc) => (
        <button
          key={svc.id}
          className="sonos-sources-item"
          onClick={() => onBrowse(svc.id, svc.title)}
        >
          <span className="sonos-sources-icon">
            {SERVICE_ICONS[svc.icon] || <Folder size={16} />}
          </span>
          <span className="sonos-sources-item-title">{svc.title}</span>
          {svc.childCount > 0 && <span className="sonos-sources-count">{svc.childCount}</span>}
          <ChevronRight size={14} className="sonos-sources-chevron" />
        </button>
      ))}
    </div>
  );
}

/** Contenu d'un browse (conteneurs + items jouables) */
function BrowseContent({ data, onBrowse, onPlay, search }) {
  if (!data) return null;

  // Message pour les services non-browsables (ex: Tidal, Sonos Radio via MS:xxx)
  if (data.message) {
    return (
      <div className="sonos-sources-message">
        <Info size={18} />
        <span>{data.message}</span>
      </div>
    );
  }

  let { containers = [], items = [] } = data;

  if (search) {
    containers = containers.filter((c) => c.title?.toLowerCase().includes(search));
    items = items.filter(
      (it) => it.title?.toLowerCase().includes(search) || it.artist?.toLowerCase().includes(search),
    );
  }

  if (containers.length === 0 && items.length === 0) {
    return <div className="sonos-sources-empty">{search ? 'Aucun résultat' : 'Aucun contenu'}</div>;
  }

  return (
    <div className="sonos-sources-list">
      {containers.map((c) => (
        <button key={c.id} className="sonos-sources-item" onClick={() => onBrowse(c.id, c.title)}>
          {c.albumArtURI ? (
            <img src={c.albumArtURI} alt="" className="sonos-sources-art" loading="lazy" />
          ) : (
            <span className="sonos-sources-icon">
              <Folder size={16} />
            </span>
          )}
          <span className="sonos-sources-item-title">{c.title}</span>
          {c.childCount > 0 && <span className="sonos-sources-count">{c.childCount}</span>}
          <ChevronRight size={14} className="sonos-sources-chevron" />
        </button>
      ))}

      {items.map((item, i) => (
        <button
          key={i}
          className="sonos-sources-item sonos-sources-playable"
          onClick={() => onPlay({ uri: item.uri, title: item.title })}
          title={`Lire : ${item.title}`}
        >
          {item.albumArtURI ? (
            <img src={item.albumArtURI} alt="" className="sonos-sources-art" loading="lazy" />
          ) : (
            <span className="sonos-sources-icon">
              <Music size={16} />
            </span>
          )}
          <div className="sonos-sources-item-meta">
            <span className="sonos-sources-item-title">{item.title}</span>
            {item.artist && <span className="sonos-sources-item-artist">{item.artist}</span>}
          </div>
        </button>
      ))}
    </div>
  );
}

export default memo(SonosSources);
