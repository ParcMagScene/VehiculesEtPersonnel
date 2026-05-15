-- 0001_purge_orphan_fk.sql
-- Résorbe la dette FK historique détectée par scripts/db-check.mjs (PRAGMA foreign_key_check).
--
-- Avant : 222 violations (151 task_assignments → reservations, 71 person_skills → persons).
-- Après : 0 violation, foreign_keys = ON peut s'appliquer sans avertissement.
--
-- Politique :
--   - task_assignments.reservation_id : FK déclarée ON DELETE SET NULL → on
--     reproduit cette sémantique pour les orphelins préexistants (NULL).
--   - person_skills.person_id : FK déclarée ON DELETE CASCADE et NOT NULL → la
--     ligne n'a plus de sens si la personne n'existe plus, on supprime.

-- 1) Nullifier les references reservation_id orphelines sur task_assignments
UPDATE task_assignments
   SET reservation_id = NULL
 WHERE reservation_id IS NOT NULL
   AND reservation_id NOT IN (SELECT id FROM reservations);

-- 2) Supprimer les person_skills orphelins (person_id ou skill_id manquant)
DELETE FROM person_skills
 WHERE person_id NOT IN (SELECT id FROM persons)
    OR skill_id  NOT IN (SELECT id FROM skills);
