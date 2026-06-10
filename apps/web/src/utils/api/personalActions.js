// API — Auth éphémère « actions personnelles » (compte Equipe)
//
// Endpoint backend : POST /api/personal-actions/perform
//
// Permet au compte commun@magsav.com de déclencher une action en
// re-authentifiant ponctuellement un membre du personnel par PIN
// ou mot de passe, sans changer de session JWT.

export function registerPersonalActionsMethods(ApiClient) {
  Object.assign(ApiClient.prototype, {
    /**
     * Déclenche une action personnelle authentifiée éphémèrement.
     *
     * @param {object} params
     * @param {number} params.personId      ID dans la table `persons`
     * @param {string} [params.pin]         PIN à 4 chiffres
     * @param {string} [params.password]    Mot de passe (alternative au PIN)
     * @param {'create_assignment'|'request_leave'|'declare_unavailability'}
     *   params.actionType
     * @param {object} params.payload       Payload spécifique au type d'action
     * @returns {Promise<{ success: boolean, person: object,
     *   actionType: string, result: any }>}
     */
    async performPersonalAction({ personId, pin, password, actionType, payload }) {
      return this.request('/personal-actions/perform', {
        method: 'POST',
        skipCamelCase: true,
        body: JSON.stringify({
          personId,
          pin: pin || undefined,
          password: password || undefined,
          actionType,
          payload: payload || {},
        }),
      });
    },
  });
}
