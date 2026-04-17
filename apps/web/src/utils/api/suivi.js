// API — Suivi du Personnel (fiches quotidiennes, synthèses, PDF)

export function registerSuiviMethods(ApiClient) {
  Object.assign(ApiClient.prototype, {
    // Liste personnel avec stats suivi
    async getSuiviPersonnel() {
      return this.request('/suivi/personnel');
    },

    // Récupérer (ou créer automatiquement) la fiche d'un jour
    async getSuiviSheet(personnelId, date) {
      return this.request(`/suivi/${personnelId}/${date}`);
    },

    // Mise à jour complète (statut + notes + entrées)
    async updateSuiviSheet(personnelId, date, data) {
      return this.request(`/suivi/${personnelId}/${date}`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    // Mise à jour d'une entrée individuelle
    async patchSuiviEntry(entryId, data) {
      return this.request(`/suivi/tache/${entryId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    // Valider une fiche (admin)
    async validateSuiviSheet(sheetId) {
      return this.request(`/suivi/${sheetId}/validate`, { method: 'PUT' });
    },

    // Synthèses JSON
    async getSuiviSyntheseJour(date) {
      return this.request(`/suivi/synthese/jour/${date}`);
    },
    async getSuiviSyntheseSemaine(week) {
      return this.request(`/suivi/synthese/semaine/${week}`);
    },
    async getSuiviSyntheseMois(month) {
      return this.request(`/suivi/synthese/mois/${month}`);
    },

    // Export PDF individuel
    async exportSuiviSheetPdf(sheetId) {
      return this.requestBlob(`/suivi/${sheetId}/pdf`);
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
