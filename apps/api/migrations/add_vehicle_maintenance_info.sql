-- Ajout des colonnes pour le kilométrage et le contrôle technique
ALTER TABLE vehicles ADD COLUMN kilometrage INTEGER DEFAULT 0;
ALTER TABLE vehicles ADD COLUMN controle_technique_type TEXT;
ALTER TABLE vehicles ADD COLUMN controle_technique_date TEXT;
ALTER TABLE vehicles ADD COLUMN controle_technique_deadline TEXT;
