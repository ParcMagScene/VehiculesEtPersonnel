/**
 * Vérification CAPTCHA Cloudflare Turnstile.
 *
 * Activation : définir `TURNSTILE_SECRET_KEY` dans l'environnement.
 * Si la variable est absente → la vérification est désactivée (mode dev / tests).
 *
 * Doc : https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */

import logger from './logger.js';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export function isCaptchaEnabled() {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

/**
 * Vérifie un token CAPTCHA Turnstile.
 *
 * @param {string|undefined|null} token - token reçu du client
 * @param {string|undefined|null} remoteIp - IP du client (best-effort)
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
export async function verifyCaptcha(token, remoteIp) {
  if (!isCaptchaEnabled()) {
    return { ok: true, reason: 'disabled' };
  }
  if (!token || typeof token !== 'string') {
    return { ok: false, reason: 'missing_token' };
  }

  try {
    const params = new URLSearchParams();
    params.append('secret', process.env.TURNSTILE_SECRET_KEY);
    params.append('response', token);
    if (remoteIp) params.append('remoteip', remoteIp);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      body: params,
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      logger.warn(`CAPTCHA verify HTTP ${res.status}`);
      return { ok: false, reason: 'http_error' };
    }
    const data = await res.json();
    if (data?.success === true) {
      return { ok: true };
    }
    return {
      ok: false,
      reason: Array.isArray(data?.['error-codes'])
        ? data['error-codes'].join(',')
        : 'verification_failed',
    };
  } catch (err) {
    logger.warn(`CAPTCHA verify error: ${err.message}`);
    return { ok: false, reason: 'network_error' };
  }
}
