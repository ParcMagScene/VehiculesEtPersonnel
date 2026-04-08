# 📋 Schéma Base de Données — Détail par domaine

> **Version** : 1.0.0  
> **87 tables** — SQLite (better-sqlite3)  
> **Dernière MÀJ** : 7 avril 2026

---

## 1. Authentification & Sessions

### `users`
| Colonne | Type | Contrainte |
|---------|------|------------|
| id | INTEGER | PK AUTOINCREMENT |
| email | TEXT | UNIQUE NOT NULL |
| password | TEXT | NOT NULL (bcrypt 6.0) |
| name | TEXT | NOT NULL |
| is_admin | INTEGER | DEFAULT 0 |
| avatar | TEXT | |
| preferences | TEXT | JSON |
| is_active | INTEGER | DEFAULT 1 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

### `active_sessions`
| Colonne | Type | Contrainte |
|---------|------|------------|
| id | INTEGER | PK AUTOINCREMENT |
| user_id | INTEGER | FK → users(id) |
| token_hash | TEXT | NOT NULL |
| expires_at | DATETIME | NOT NULL — INDEX |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

### `authorized_emails`
| Colonne | Type | Contrainte |
|---------|------|------------|
| id | INTEGER | PK AUTOINCREMENT |
| email | TEXT | UNIQUE NOT NULL |
| created_by | INTEGER | FK → users(id) |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

### `access_requests`
| Colonne | Type | Contrainte |
|---------|------|------------|
| id | INTEGER | PK AUTOINCREMENT |
| name | TEXT | NOT NULL |
| email | TEXT | NOT NULL |
| reason | TEXT | |
| status | TEXT | DEFAULT 'pending' |
| reviewed_by | INTEGER | FK → users(id) |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

### `migrations_log`
| Colonne | Type | Contrainte |
|---------|------|------------|
| id | INTEGER | PK AUTOINCREMENT |
| name | TEXT | NOT NULL |
| applied_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

---

## 2. Véhicules & Réservations

### `vehicles`
| Colonne | Type | Contrainte |
|---------|------|------------|
| id | INTEGER | PK AUTOINCREMENT |
| type | TEXT | INDEX |
| brand | TEXT | |
| model | TEXT | |
| registration | TEXT | INDEX |
| year | INTEGER | |
| mileage | INTEGER | |
| fuel_type | TEXT | |
| status | TEXT | DEFAULT 'available' |
| photo | TEXT | |
| controles_techniques | TEXT | JSON |
| notes | TEXT | |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

### `reservations`
| Colonne | Type | Contrainte |
|---------|------|------------|
| id | INTEGER | PK AUTOINCREMENT |
| vehicle_id | INTEGER | FK → vehicles(id) ON DELETE CASCADE — INDEX |
| start_date | DATETIME | INDEX |
| end_date | DATETIME | INDEX |
| affaire | TEXT | INDEX |
| client | TEXT | |
| driver | TEXT | |
| destination | TEXT | |
| status | TEXT | DEFAULT 'pending' |
| notes | TEXT | |
| created_by | INTEGER | FK → users(id) |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

### `maintenances`
| Colonne | Type | Contrainte |
|---------|------|------------|
| id | INTEGER | PK AUTOINCREMENT |
| vehicle_id | INTEGER | FK → vehicles(id) |
| type | TEXT | |
| description | TEXT | |
| date | DATE | |
| cost | REAL | |
| mileage | INTEGER | |
| garage | TEXT | |
| status | TEXT | DEFAULT 'scheduled' |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

### `trip_details` / `trip_pauses`
Détails trajets et pauses liés aux réservations (FK CASCADE).

---

## 3. Personnel & Planning

### `persons`
| Colonne | Type | Contrainte |
|---------|------|------------|
| id | INTEGER | PK AUTOINCREMENT |
| name | TEXT | NOT NULL |
| type | TEXT | INDEX (intermittent, permanent, prestataire) |
| status | TEXT | INDEX DEFAULT 'active' |
| email | TEXT | |
| phone | TEXT | |
| position | TEXT | |
| user_id | INTEGER | FK → users(id) — INDEX |
| code_libre | TEXT | |
| contract_type | TEXT | |
| photo | TEXT | |
| notes | TEXT | |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

### `skills`
| Colonne | Type | Contrainte |
|---------|------|------------|
| id | INTEGER | PK AUTOINCREMENT |
| name | TEXT | NOT NULL |
| category | TEXT | |

### `person_competences` (relation N:N)
| Colonne | Type | Contrainte |
|---------|------|------------|
| id | INTEGER | PK |
| person_id | INTEGER | FK → persons(id) |
| skill_id | INTEGER | FK → skills(id) |
| level | INTEGER | 1-5 |

### `missions`
| Colonne | Type | Contrainte |
|---------|------|------------|
| id | INTEGER | PK AUTOINCREMENT |
| title | TEXT | |
| start_date | DATETIME | INDEX |
| end_date | DATETIME | INDEX |
| status | TEXT | INDEX (pending, confirmed, in_progress, completed, cancelled) |
| affaire_id | INTEGER | FK → affaires(id) ON DELETE CASCADE |
| required_skills | TEXT | JSON |
| notes | TEXT | |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

### `mission_assignments`
| Colonne | Type | Contrainte |
|---------|------|------------|
| id | INTEGER | PK |
| mission_id | INTEGER | FK → missions(id) |
| person_id | INTEGER | FK → persons(id) |
| role | TEXT | |
| status | TEXT | DEFAULT 'assigned' |

---

## 4. Congés

### `leave_requests`
| Colonne | Type | Contrainte |
|---------|------|------------|
| id | INTEGER | PK AUTOINCREMENT |
| person_id | INTEGER | FK → persons(id) — INDEX |
| type | TEXT | (conge_paye, sans_solde, exceptionnel, maladie...) |
| start_date | DATE | INDEX |
| end_date | DATE | INDEX |
| status | TEXT | INDEX (draft, pending, approved, rejected, cancelled, taken) |
| days_count | REAL | |
| reason | TEXT | |
| decision_by | INTEGER | FK → users(id) |
| decision_date | DATETIME | |
| signature_employee | TEXT | |
| signature_employer | TEXT | |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

### `leave_request_history`
Audit trail des modifications congés.

### `public_holidays`
Jours fériés configurables par année.

---

## 5. Affaires

### `affaires`
| Colonne | Type | Contrainte |
|---------|------|------------|
| id | INTEGER | PK AUTOINCREMENT |
| numero_affaire | TEXT | UNIQUE |
| title | TEXT | |
| client | TEXT | |
| start_date | DATE | |
| end_date | DATE | |
| status | TEXT | |
| is_active | INTEGER | DEFAULT 1 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

### `affaire_links`
Liens inter-affaires (parent/enfant).

---

## 6. Messagerie

### `conversations`
| Colonne | Type | Contrainte |
|---------|------|------------|
| id | INTEGER | PK AUTOINCREMENT |
| type | TEXT | (direct, group) |
| title | TEXT | |
| created_by | INTEGER | FK → users(id) |
| updated_at | DATETIME | |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

### `conversation_participants`
| Colonne | Type | Contrainte |
|---------|------|------------|
| id | INTEGER | PK |
| conversation_id | INTEGER | FK → conversations(id) |
| user_id | INTEGER | FK → users(id) |
| last_read_at | DATETIME | |

### `messages`
| Colonne | Type | Contrainte |
|---------|------|------------|
| id | INTEGER | PK AUTOINCREMENT |
| conversation_id | INTEGER | FK → conversations(id) |
| sender_id | INTEGER | FK → users(id) |
| content | TEXT | |
| type | TEXT | (text, image, video, file) |
| is_deleted | INTEGER | DEFAULT 0 |
| edited_at | DATETIME | |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

### `message_attachments`
Fichiers joints aux messages (filename, original_name, mime_type, size).

---

## 7. Matériel & SAV

### `equipment`
| Colonne | Type | Contrainte |
|---------|------|------------|
| id | INTEGER | PK AUTOINCREMENT |
| uid | TEXT | UNIQUE |
| name | TEXT | NOT NULL |
| category_id | INTEGER | FK → equipment_categories(id) |
| status | TEXT | DEFAULT 'available' |
| location_depot | TEXT | |
| location_zone | TEXT | |
| location_floor | TEXT | |
| serial_number | TEXT | |
| purchase_date | DATE | |
| purchase_price | REAL | |
| notes | TEXT | |
| photo | TEXT | |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

### `sav_tickets`
Tickets SAV (equipment_id, status, priority, assigned_to, description, resolution).

### `equipment_assignments`
Assignations personne↔matériel (start_date, end_date, status).

### `equipment_categories`
Hiérarchie famille/sous-famille/catégorie (parent_id self-ref).

### `equipment_lists` / `equipment_list_items`
Listes nommées de matériel.

---

## 8-21. Autres domaines

Voir les domaines détaillés dans les fichiers de documentation API correspondants :
- Stock : [../api/stock.md](../api/stock.md)
- Commandes : [../api/orders.md](../api/orders.md)
- Annuaire : [../api/annuaire.md](../api/annuaire.md)
- Dashboard TV : [../api/display.md](../api/display.md)
- Catalogue : [../api/supplier-catalog.md](../api/supplier-catalog.md)
