// API — Suivi du Personnel (fiches quotidiennes, synthèses, PDF)

export function registerSuiviMethods(ApiClient) {
  Object.assign(ApiClient.prototype, {
    // Liste personnel avec stats suivi
    async getSuiviPersonnel() {
      return this.request('/suivi/personnel', { skipCamelCase: true });
    },

    // Récupérer (ou créer automatiquement) la fiche d'un jour
    async getSuiviSheet(personnelId, date) {
      // Coalescing + mini cache anti-rafale pour éviter les 429 sur appels identiques
      if (!this._suiviSheetInFlight) this._suiviSheetInFlight = new Map();
      if (!this._suiviSheetCache) this._suiviSheetCache = new Map();

      const key = `${personnelId}:${date}`;
      const now = Date.now();
      const cached = this._suiviSheetCache.get(key);

      // Retourne la dernière réponse très récente pour absorber les doubles montages/renders
      if (cached && now - cached.ts < 2000) {
        return cached.data;
      }

      const inFlight = this._suiviSheetInFlight.get(key);
      if (inFlight) return inFlight;

      const requestPromise = this.request(`/suivi/${personnelId}/${date}`, {
        skipCamelCase: true,
      })
        .then((data) => {
          this._suiviSheetCache.set(key, { data, ts: Date.now() });
          return data;
        })
        .finally(() => {
          if (this._suiviSheetInFlight.get(key) === requestPromise) {
            this._suiviSheetInFlight.delete(key);
          }
        });

      this._suiviSheetInFlight.set(key, requestPromise);
      return requestPromise;
    },

    // Mise à jour complète (statut + notes + entrées)
    async updateSuiviSheet(personnelId, date, data) {
      return this.request(`/suivi/${personnelId}/${date}`, {
        method: 'POST',
        body: JSON.stringify(data),
        skipCamelCase: true,
      });
    },

    // Mise à jour d'une entrée individuelle
    async patchSuiviEntry(entryId, data) {
      return this.request(`/suivi/tache/${entryId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
        skipCamelCase: true,
      });
    },

    // Valider une fiche (admin)
    async validateSuiviSheet(sheetId) {
      return this.request(`/suivi/${sheetId}/validate`, { method: 'PUT', skipCamelCase: true });
    },

    // Tâches planifiées du jour non affectées (pour sélection dans le suivi)
    async getSuiviPlanningTasks(date) {
      return this.request(`/suivi/planning-tasks/${date}`, { skipCamelCase: true });
    },

    // Tâches récurrentes (Suivi) par personnel
    async getSuiviRecurringTasks(personnelId) {
      return this.request(`/suivi/recurring/${personnelId}`, { skipCamelCase: true });
    },
    async createSuiviRecurringTask(personnelId, data) {
      return this.request(`/suivi/recurring/${personnelId}`, {
        method: 'POST',
        body: JSON.stringify(data),
        skipCamelCase: true,
      });
    },
    async deleteSuiviRecurringTask(recurringId) {
      return this.request(`/suivi/recurring/${recurringId}`, {
        method: 'DELETE',
        skipCamelCase: true,
      });
    },
    async updateSuiviRecurringTask(recurringId, data) {
      return this.request(`/suivi/recurring/${recurringId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
        skipCamelCase: true,
      });
    },

    // Synthèses JSON
    async getSuiviSyntheseJour(date) {
      return this.request(`/suivi/synthese/jour/${date}`, { skipCamelCase: true });
    },
    async getSuiviSyntheseSemaine(week) {
      return this.request(`/suivi/synthese/semaine/${week}`, { skipCamelCase: true });
    },
    async getSuiviSyntheseMois(month) {
      return this.request(`/suivi/synthese/mois/${month}`, { skipCamelCase: true });
    },
    async getSuiviSyntheseAnnee(year) {
      return this.request(`/suivi/synthese/annee/${year}`, { skipCamelCase: true });
    },

    // Incidents affaires (hebdo/mensuel/annuel)
    async getSuiviIncidentAffaireBase(affaireNum) {
      return this.request(`/suivi/incidents/affaire/${encodeURIComponent(affaireNum)}/base`, {
        skipCamelCase: true,
      });
    },
    async getSuiviIncidentTickets(weekKey) {
      return this.request(`/suivi/incidents/tickets/${weekKey}`, { skipCamelCase: true });
    },
    async upsertSuiviIncidentTicket(payload) {
      return this.request('/suivi/incidents/tickets', {
        method: 'POST',
        body: JSON.stringify(payload),
        skipCamelCase: true,
      });
    },
    async deleteSuiviIncidentTicket(ticketId) {
      return this.request(`/suivi/incidents/tickets/${ticketId}`, {
        method: 'DELETE',
        skipCamelCase: true,
      });
    },
    async getSuiviIncidentSyntheseSemaine(weekKey) {
      return this.request(`/suivi/incidents/synthese/semaine/${weekKey}`, { skipCamelCase: true });
    },
    async getSuiviIncidentSyntheseMois(month) {
      return this.request(`/suivi/incidents/synthese/mois/${month}`, { skipCamelCase: true });
    },
    async getSuiviIncidentSyntheseAnnee(year) {
      return this.request(`/suivi/incidents/synthese/annee/${year}`, { skipCamelCase: true });
    },

    // Export PDF individuel
    async exportSuiviSheetPdf(sheetId) {
      return this.requestBlob(`/suivi/${sheetId}/pdf`);
    },

    // Export PDF batch (multi-fiches sélectionnées, format normal)
    async exportSuiviBatchPdf(sheetIds) {
      return this.requestBlob('/suivi/batch/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetIds }),
      });
    },

    // Impression batch (multi-fiches, recto-verso + filigrane)
    async printSuiviBatch(sheetIds) {
      return this.requestBlob('/suivi/batch/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetIds }),
      });
    },

    // Reporter une entrée récurrente à une autre date
    async postponeSuiviEntry(entryId, targetDate, targetPeriod) {
      return this.request(`/suivi/entries/${entryId}/postpone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_date: targetDate, target_period: targetPeriod }),
      });
    },

    // Export PDF synthèses
    async exportSuiviSyntheseJourPdf(date) {
      return this.requestBlob(`/suivi/synthese/jour/${date}/pdf`);
    },
    async exportSuiviSyntheseSemainePdf(week) {
      return this.requestBlob(`/suivi/synthese/semaine/${week}/pdf`);
    },
    async exportSuiviSyntheseMoisPdf(month) {
      return this.requestBlob(`/suivi/synthese/mois/${month}/pdf`);
    },
    async exportSuiviSyntheseAnneePdf(year) {
      return this.requestBlob(`/suivi/synthese/annee/${year}/pdf`);
    },
  });
}
