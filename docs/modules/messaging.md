# 💬 Module Messagerie

> **Version** : 1.0.0 — **Dernière MÀJ** : 7 avril 2026

## Composants

| Composant | Rôle |
|-----------|------|
| MessagingPanel | Panel principal messagerie |

## Hooks

- `useMessagingPolling` — Polling messages non lus

## Service API

`utils/api/messaging.js` — Conversations, messages, notifications

## Fonctionnalités

- Conversations 1:1 (dédupliquées) et groupes
- Messages texte, image, vidéo, fichier
- Pagination par cursor (50 messages)
- Marquage lu/non lu
- Édition/suppression propres messages
- Upload sécurisé (allowlist MIME, 25Mo max, sanitize — Phase 4)
