# Changelog Base de Données — eM@g

Toutes les modifications de schéma SQLite sont listées ici.  
Format : [Keep a Changelog](https://keepachangelog.com)

---

## [1.1.0] — 2026-04-08

### Added
- Colonne `channel` (INTEGER DEFAULT 1) sur table `cameras` — support multi-channel par caméra

---

## [1.0.0] — 2026-04-07

### Initial
- Documentation initiale de 87 tables réparties sur 21 domaines fonctionnels
- WAL mode, FK ON, idempotent migrations documented
- Domaines : Auth, Véhicules, Personnel, Congés, Affaires, Messagerie, Matériel, Stock, Commandes, Planning, Annuaire, Vidéo, Display, Inventaire, Mailing, BL, Devis, Alertes, Récurrence, Maintenance, Catalogue
