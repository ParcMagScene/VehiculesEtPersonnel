-- Migration: Ajout du champ uid à la table equipment
-- L'UID est un identifiant unique court de type EMAG-XXXXX
ALTER TABLE equipment ADD COLUMN uid TEXT UNIQUE;
