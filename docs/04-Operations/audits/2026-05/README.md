# Audits & Plans de Correction — Mai 2026

> Snapshot complet de l'état du projet eM@g au **6 mai 2026**, suivi des deux plans de correction
> (S1 critiques, S2 leviers). Tous les documents sont datés et figés : ne pas les modifier
> rétro-activement, créer un nouveau dossier `YYYY-MM/` pour un audit ultérieur.

## Documents

| Fichier | Date | Rôle |
|---|---|---|
| [AUDIT-COMPLET-2026-05-06.md](AUDIT-COMPLET-2026-05-06.md) | 06/05/2026 | **Master** — audit lecture seule (sécurité, perf, dette, workflows). Commit HEAD : `321ef262`. |
| [AUDIT-CSP-PATCHES.md](AUDIT-CSP-PATCHES.md) | 06/05/2026 | Patches techniques CSP — QR codes externes (option A locale `qrcode` recommandée, option B whitelist). |
| [PLAN-CORRECTION-S1-2026-05-07.md](PLAN-CORRECTION-S1-2026-05-07.md) | 07/05/2026 | Plan S1 — 8 items critiques (WAL SQLite, EADDRINUSE, CVE deps, SQL dynamique, etc.). |
| [PLAN-CORRECTION-S2-2026-05-07.md](PLAN-CORRECTION-S2-2026-05-07.md) | 07/05/2026 | Plan S2 — 4 leviers (cache LRU, Sentry, pagination, split fichiers >2000 LOC). |

## Synthèse exécutive (extrait de AUDIT-COMPLET)

**Top 5 risques S1** : WAL 244 Mo · 5 CVE deps (`ip`, `ip-address`) · 7 SQL dynamiques résiduels · 27 `.bak` non gitignorés · HTTPS 3443 `EADDRINUSE`.

**Top 5 leviers S2** : split `database.js` 3797 LOC + `suiviRoutes.js` 2835 LOC · pagination listes >100 · cache LRU 5 endpoints chauds · réactivation Sentry · cleanup `*.db.bak-*`.

## Archive de l'audit précédent

L'audit du **20 avril 2026** ([AUDIT-REPORT.md](../../../07-Archive/2026-04/AUDIT-REPORT.md))
est conservé en archive ; il a été remplacé et étendu par le présent AUDIT-COMPLET.
