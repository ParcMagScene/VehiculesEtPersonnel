# 📧 Module Mailing

> **Version** : 1.0.0 — **Dernière MÀJ** : 7 avril 2026

## Composants

| Composant | Rôle |
|-----------|------|
| MailingPanel | Panel envoi mails groupés |

## Service API

`utils/api/mailing.js` — Envoi mails groupés

## Tables

- `mail_templates` — Templates email
- `mail_history` — Historique envois

## Sécurité

- En-têtes email sanitisés (`sanitizeEmailHeader()` — strips CR/LF)
- Corps HTML échappé (`escapeHtml()` — entités HTML complètes)
- Mot de passe SMTP chiffré AES-256-GCM (Phase 1 — CRIT-3)
