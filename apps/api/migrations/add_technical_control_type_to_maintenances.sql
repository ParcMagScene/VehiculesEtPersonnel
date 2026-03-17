-- Migration : Ajouter lien entre interventions CT et deadlines
-- Date : 2026-02-05

-- Ajouter la colonne technical_control_type pour lier les interventions aux types de contrôles techniques
ALTER TABLE maintenances ADD COLUMN technical_control_type TEXT;

-- Commentaire : 
-- Cette colonne contient le type de contrôle technique (VL, PL, SEMI, SCENE, POLLUTION, HAYON)
-- si l'intervention est de type technical_inspection
-- Cela permet de lier l'intervention à une deadline spécifique
