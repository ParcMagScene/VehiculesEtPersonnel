// API — Module Sonos (Config, Now Playing, Zones, Contrôles, Favoris)

export function registerSonosMethods(ApiClient) {
  Object.assign(ApiClient.prototype, {
    // ── Config ──
    async getSonosConfig() {
      return this.request('/sonos/config');
    },
    async saveSonosConfig(sonosIP) {
      return this.request('/sonos/config', { method: 'POST', body: JSON.stringify({ sonosIP }) });
    },

    // ── Now Playing ──
    async getSonosNowPlaying() {
      return this.request('/sonos/now-playing');
    },

    // ── Zones ──
    async getSonosZones() {
      return this.request('/sonos/zones');
    },

    // ── État complet d'une zone ──
    async getSonosState(zone) {
      return this.request(`/sonos/state/${zone}`);
    },

    // ── Contrôles de lecture ──
    async sonosPlay(zone) {
      return this.request(`/sonos/play/${zone}`, { method: 'POST' });
    },
    async sonosPause(zone) {
      return this.request(`/sonos/pause/${zone}`, { method: 'POST' });
    },
    async sonosNext(zone) {
      return this.request(`/sonos/next/${zone}`, { method: 'POST' });
    },
    async sonosPrevious(zone) {
      return this.request(`/sonos/previous/${zone}`, { method: 'POST' });
    },

    // ── Volume ──
    async sonosSetVolume(zone, value) {
      return this.request(`/sonos/volume/${zone}`, {
        method: 'POST',
        body: JSON.stringify({ value }),
      });
    },
    async sonosMute(zone) {
      return this.request(`/sonos/mute/${zone}`, { method: 'POST' });
    },
    async sonosUnmute(zone) {
      return this.request(`/sonos/unmute/${zone}`, { method: 'POST' });
    },

    // ── Favoris ──
    async getSonosFavorites() {
      return this.request('/sonos/favorites');
    },
    async sonosPlayFavorite(zone, uri, title) {
      return this.request(`/sonos/favorite/${zone}`, {
        method: 'POST',
        body: JSON.stringify({ uri, title }),
      });
    },

    // ── Seek / Shuffle / Repeat ──
    async sonosSeek(zone, position) {
      return this.request(`/sonos/seek/${zone}`, {
        method: 'POST',
        body: JSON.stringify({ position }),
      });
    },
    async sonosShuffle(zone, enabled) {
      return this.request(`/sonos/shuffle/${zone}`, {
        method: 'POST',
        body: JSON.stringify({ enabled }),
      });
    },
    async sonosRepeat(zone, mode) {
      return this.request(`/sonos/repeat/${zone}`, {
        method: 'POST',
        body: JSON.stringify({ mode }),
      });
    },

    // ── Sources / Browse ──
    async getSonosMusicServices() {
      return this.request('/sonos/music-services');
    },
    async getSonosRadioStations() {
      return this.request('/sonos/radio-stations');
    },
    async browseSonos(objectId) {
      return this.request(`/sonos/browse/${encodeURIComponent(objectId)}`);
    },
    async getSonosQueue() {
      return this.request('/sonos/queue');
    },
  });
}
