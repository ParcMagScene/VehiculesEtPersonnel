// API — Suivi du Personnel (fiches quotidiennes, synthèses, PDF)

export function registerSuiviMethods(ApiClient) {
  Object.assign(ApiClient.prototype, {
    // Liste personnel avec stats suivi
    async getSuiviPersonnel() {
      return this.request('/suivi/personnel', { skipCamelCase: true });
    },

    // Récupérer (ou créer automatiquement) la fiche d'un jour
    async getSuiviSheet(personnelId, date) {
      return this.request(`/suivi/${personnelId}/${date}`, { skipCamelCase: true });
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
  });
}
