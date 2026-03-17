-- Migration: Update subfamily and category icons
-- Subfamily icons
UPDATE equipment_categories SET icon = '🔊' WHERE level = 'subfamily' AND name = 'Enceinte';
UPDATE equipment_categories SET icon = '🎛️' WHERE level = 'subfamily' AND name = 'Console';
UPDATE equipment_categories SET icon = '🎤' WHERE level = 'subfamily' AND name = 'Micro';
UPDATE equipment_categories SET icon = '🔌' WHERE level = 'subfamily' AND (name LIKE 'Câblage%' OR name LIKE 'Cablage%');
UPDATE equipment_categories SET icon = '📡' WHERE level = 'subfamily' AND name = 'Amplification';
UPDATE equipment_categories SET icon = '🎧' WHERE level = 'subfamily' AND name = 'Ear Monitor';
UPDATE equipment_categories SET icon = '🎚️' WHERE level = 'subfamily' AND name = 'Périphérique';
UPDATE equipment_categories SET icon = '📻' WHERE level = 'subfamily' AND name = 'Source';
UPDATE equipment_categories SET icon = '📢' WHERE level = 'subfamily' AND name = '100 V';
UPDATE equipment_categories SET icon = '📞' WHERE level = 'subfamily' AND name = 'Intercomm / Talky';
UPDATE equipment_categories SET icon = '🏗️' WHERE level = 'subfamily' AND name = 'Levage';
UPDATE equipment_categories SET icon = '🎪' WHERE level = 'subfamily' AND name = 'Scène';
UPDATE equipment_categories SET icon = '🔩' WHERE level = 'subfamily' AND name = 'Pont Aluminium';
UPDATE equipment_categories SET icon = '🧱' WHERE level = 'subfamily' AND name = 'Layher';
UPDATE equipment_categories SET icon = '🏗️' WHERE level = 'subfamily' AND name = 'praticables';
UPDATE equipment_categories SET icon = '🚧' WHERE level = 'subfamily' AND name = 'protente / Crash / Leste';
UPDATE equipment_categories SET icon = '🔌' WHERE level = 'subfamily' AND name = 'Armoire de distribution';
UPDATE equipment_categories SET icon = '⚡' WHERE level = 'subfamily' AND name = 'Passage de câble';
UPDATE equipment_categories SET icon = '📹' WHERE level = 'subfamily' AND name = 'Captation d''image';
UPDATE equipment_categories SET icon = '📺' WHERE level = 'subfamily' AND name = 'Diffusion d''image';
UPDATE equipment_categories SET icon = '🎬' WHERE level = 'subfamily' AND name = 'Régie Vidéo';
UPDATE equipment_categories SET icon = '🔧' WHERE level = 'subfamily' AND name = 'Accessoires';
UPDATE equipment_categories SET icon = '✨' WHERE level = 'subfamily' AND name = 'Asservi';
UPDATE equipment_categories SET icon = '💡' WHERE level = 'subfamily' AND name = 'Traditionnel';
UPDATE equipment_categories SET icon = '🎛️' WHERE level = 'subfamily' AND name = 'Consoles';
UPDATE equipment_categories SET icon = '🔋' WHERE level = 'subfamily' AND name = 'Bloc de puissance';
UPDATE equipment_categories SET icon = '💨' WHERE level = 'subfamily' AND name = 'Effets / Fumée';
UPDATE equipment_categories SET icon = '🔒' WHERE level = 'subfamily' AND name = 'Sécurité / Eclairage site';
UPDATE equipment_categories SET icon = '🔦' WHERE level = 'subfamily' AND name = 'Sous-perches';
UPDATE equipment_categories SET icon = '🎸' WHERE level = 'subfamily' AND name IN ('Instruments', 'Amplis');
UPDATE equipment_categories SET icon = '🥁' WHERE level = 'subfamily' AND name IN ('Batteries', 'Percussions');
UPDATE equipment_categories SET icon = '🎹' WHERE level = 'subfamily' AND name = 'Accessoires backline';
UPDATE equipment_categories SET icon = '🎵' WHERE level = 'subfamily' AND name = 'Pupitres';
UPDATE equipment_categories SET icon = '🎪' WHERE level = 'subfamily' AND name = 'Rideau';
UPDATE equipment_categories SET icon = '⚙️' WHERE level = 'subfamily' AND name = 'Machinerie';
UPDATE equipment_categories SET icon = '💻' WHERE level = 'subfamily' AND name = 'Ordinateurs';

-- Category icons - Enceintes
UPDATE equipment_categories SET icon = '🔊' WHERE level = 'category' AND name LIKE '%Enceinte%';
UPDATE equipment_categories SET icon = '🦶' WHERE level = 'category' AND name LIKE 'Pied d''enceinte%';
UPDATE equipment_categories SET icon = '🔧' WHERE level = 'category' AND name LIKE 'accessoire%L-ACOUSTICS%';

-- Category icons - Consoles
UPDATE equipment_categories SET icon = '🎛️' WHERE level = 'category' AND name LIKE 'Console %';
UPDATE equipment_categories SET icon = '🎛️' WHERE level = 'category' AND name LIKE 'Accessoire console%';

-- Category icons - Micros
UPDATE equipment_categories SET icon = '🎤' WHERE level = 'category' AND name LIKE 'Micro %';
UPDATE equipment_categories SET icon = '🎤' WHERE level = 'category' AND name LIKE 'DPA Micro%';
UPDATE equipment_categories SET icon = '🔧' WHERE level = 'category' AND name LIKE 'DPA Accessoires%';
UPDATE equipment_categories SET icon = '📡' WHERE level = 'category' AND name LIKE 'HF%';
UPDATE equipment_categories SET icon = '🎵' WHERE level = 'category' AND name LIKE 'Boitier de direct%';
UPDATE equipment_categories SET icon = '🦶' WHERE level = 'category' AND name LIKE 'Pieds%';

-- Category icons - Cables
UPDATE equipment_categories SET icon = '🔌' WHERE level = 'category' AND (name LIKE 'Câble%' OR name LIKE 'Cable%' OR name LIKE 'Câbles%');
UPDATE equipment_categories SET icon = '🔌' WHERE level = 'category' AND name LIKE 'Adapt%';
UPDATE equipment_categories SET icon = '🔌' WHERE level = 'category' AND name LIKE 'Multipaire%';
UPDATE equipment_categories SET icon = '🔌' WHERE level = 'category' AND name LIKE 'Multipries%';
UPDATE equipment_categories SET icon = '🔌' WHERE level = 'category' AND name LIKE 'Fibre%';
UPDATE equipment_categories SET icon = '🔌' WHERE level = 'category' AND name LIKE 'Jack%';
UPDATE equipment_categories SET icon = '🔌' WHERE level = 'category' AND name IN ('HDMI', 'SDI', 'VGA');
UPDATE equipment_categories SET icon = '🔌' WHERE level = 'category' AND name LIKE 'DMX%';
UPDATE equipment_categories SET icon = '🔌' WHERE level = 'category' AND name LIKE 'SNAKE%';
UPDATE equipment_categories SET icon = '🔌' WHERE level = 'category' AND name LIKE 'STRAP%';
UPDATE equipment_categories SET icon = '🔌' WHERE level = 'category' AND name LIKE 'Multicâble%';

-- Category icons - Amplification
UPDATE equipment_categories SET icon = '🔊' WHERE level = 'category' AND name = 'Ampli';
UPDATE equipment_categories SET icon = '📡' WHERE level = 'category' AND name = 'Amplificateur';

-- Category icons - Ear Monitor
UPDATE equipment_categories SET icon = '🎧' WHERE level = 'category' AND name = 'Ear Monitor';
UPDATE equipment_categories SET icon = '🎧' WHERE level = 'category' AND name LIKE 'Fischer Amp%';

-- Category icons - Peripheriques
UPDATE equipment_categories SET icon = '🎚️' WHERE level = 'category' AND name IN ('Compresseurs', 'Egalisation', 'Gates', 'Effet');
UPDATE equipment_categories SET icon = '🎚️' WHERE level = 'category' AND name LIKE 'Processeur%';
UPDATE equipment_categories SET icon = '🎚️' WHERE level = 'category' AND name LIKE 'Préampli%';
UPDATE equipment_categories SET icon = '🎚️' WHERE level = 'category' AND name = 'Périphérique';
UPDATE equipment_categories SET icon = '📏' WHERE level = 'category' AND name LIKE 'Appareil de mesure%';

-- Category icons - Source
UPDATE equipment_categories SET icon = '📻' WHERE level = 'category' AND name LIKE 'Lecteur%';

-- Category icons - 100V
UPDATE equipment_categories SET icon = '📢' WHERE level = 'category' AND name = 'Projecteur de son';

-- Category icons - Levage
UPDATE equipment_categories SET icon = '⚙️' WHERE level = 'category' AND name LIKE 'Moteurs%';
UPDATE equipment_categories SET icon = '🔗' WHERE level = 'category' AND name LIKE 'Elingue%';
UPDATE equipment_categories SET icon = '🦶' WHERE level = 'category' AND name LIKE 'Pied de levage%';
UPDATE equipment_categories SET icon = '🎮' WHERE level = 'category' AND name LIKE 'Télécommandes%';
UPDATE equipment_categories SET icon = '🔧' WHERE level = 'category' AND name LIKE 'Accessoires levage%';

-- Category icons - Structure
UPDATE equipment_categories SET icon = '🔩' WHERE level = 'category' AND name LIKE 'Série%';
UPDATE equipment_categories SET icon = '🔩' WHERE level = 'category' AND name LIKE 'Cercle%';
UPDATE equipment_categories SET icon = '🔩' WHERE level = 'category' AND name LIKE 'Echelle%';
UPDATE equipment_categories SET icon = '🔩' WHERE level = 'category' AND name = 'Mono Tube';
UPDATE equipment_categories SET icon = '🔧' WHERE level = 'category' AND name LIKE 'Accessoire structure%';
UPDATE equipment_categories SET icon = '🎪' WHERE level = 'category' AND name LIKE 'Scène%';
UPDATE equipment_categories SET icon = '🎪' WHERE level = 'category' AND name LIKE 'Bâche%';
UPDATE equipment_categories SET icon = '🧱' WHERE level = 'category' AND name LIKE 'Echaffaudage%';
UPDATE equipment_categories SET icon = '🧱' WHERE level = 'category' AND name LIKE 'Kit Tour%';
UPDATE equipment_categories SET icon = '🏗️' WHERE level = 'category' AND name = 'praticables';
UPDATE equipment_categories SET icon = '🚧' WHERE level = 'category' AND name LIKE 'Crash%';
UPDATE equipment_categories SET icon = '🚧' WHERE level = 'category' AND name LIKE 'Leste%';
UPDATE equipment_categories SET icon = '🚧' WHERE level = 'category' AND name LIKE 'Protente%';

-- Category icons - Distribution electrique
UPDATE equipment_categories SET icon = '🔌' WHERE level = 'category' AND name LIKE 'Armoire%';
UPDATE equipment_categories SET icon = '🔌' WHERE level = 'category' AND name IN ('CM1', 'Divisionnaire', 'Rackscan');
UPDATE equipment_categories SET icon = '🔌' WHERE level = 'category' AND name LIKE 'CTA%';
UPDATE equipment_categories SET icon = '⚡' WHERE level = 'category' AND name LIKE '%ampère%';
UPDATE equipment_categories SET icon = '⚡' WHERE level = 'category' AND name LIKE '%powerlock%';
UPDATE equipment_categories SET icon = '🛣️' WHERE level = 'category' AND name LIKE '%canaux%';

-- Category icons - Eclairage
UPDATE equipment_categories SET icon = '✨' WHERE level = 'category' AND name IN ('Beam', 'Spot', 'Wash', 'Blinder Led', 'Architecturaux');
UPDATE equipment_categories SET icon = '✨' WHERE level = 'category' AND name = 'PAR Led';
UPDATE equipment_categories SET icon = '🎨' WHERE level = 'category' AND name LIKE 'Changeur de couleur%';
UPDATE equipment_categories SET icon = '🔧' WHERE level = 'category' AND name LIKE 'Accessoires asservis%';
UPDATE equipment_categories SET icon = '💡' WHERE level = 'category' AND name IN ('Découpe', 'Fresnels', 'Molefay', 'Basse tension');
UPDATE equipment_categories SET icon = '💡' WHERE level = 'category' AND name LIKE 'Plans convexe%';
UPDATE equipment_categories SET icon = '💡' WHERE level = 'category' AND name LIKE 'Projecteur%';
UPDATE equipment_categories SET icon = '💡' WHERE level = 'category' AND name LIKE 'Cycliode%';
UPDATE equipment_categories SET icon = '🔧' WHERE level = 'category' AND name LIKE 'Accessoire Trad%';
UPDATE equipment_categories SET icon = '🎛️' WHERE level = 'category' AND name LIKE 'Consoles trad%';
UPDATE equipment_categories SET icon = '🎛️' WHERE level = 'category' AND name LIKE 'Consoles projecteurs%';
UPDATE equipment_categories SET icon = '🔋' WHERE level = 'category' AND name = 'Bloc de puissance';
UPDATE equipment_categories SET icon = '🌫️' WHERE level = 'category' AND name LIKE 'Machine à fumée%';
UPDATE equipment_categories SET icon = '💨' WHERE level = 'category' AND name = 'Ventilation';
UPDATE equipment_categories SET icon = '🧪' WHERE level = 'category' AND name LIKE 'Consommable%';
UPDATE equipment_categories SET icon = '🔦' WHERE level = 'category' AND name = 'Sous-perches';
UPDATE equipment_categories SET icon = '💡' WHERE level = 'category' AND name IN ('HQI', 'Quartz');
UPDATE equipment_categories SET icon = '🔒' WHERE level = 'category' AND name LIKE 'Sécurité%';

-- Category icons - Audiovisuel
UPDATE equipment_categories SET icon = '📺' WHERE level = 'category' AND name LIKE 'Ecran%';
UPDATE equipment_categories SET icon = '📺' WHERE level = 'category' AND name = 'Moniteur';
UPDATE equipment_categories SET icon = '📺' WHERE level = 'category' AND name LIKE 'Vidéoprojecteur%';
UPDATE equipment_categories SET icon = '📹' WHERE level = 'category' AND name LIKE 'Lecteurs%';
UPDATE equipment_categories SET icon = '📹' WHERE level = 'category' AND name = 'Medias';
UPDATE equipment_categories SET icon = '🔧' WHERE level = 'category' AND name IN ('Convertisseur', 'Distributeur', 'Extender', 'Selecteur', 'Shutter', 'Accroche');
UPDATE equipment_categories SET icon = '🎬' WHERE level = 'category' AND name LIKE 'Mélangeur%';

-- Category icons - Backline
UPDATE equipment_categories SET icon = '🎸' WHERE level = 'category' AND name LIKE 'Guitare%';
UPDATE equipment_categories SET icon = '🎸' WHERE level = 'category' AND name = 'Ampli GUIT';
UPDATE equipment_categories SET icon = '🎸' WHERE level = 'category' AND name = 'Ampli BASSE';
UPDATE equipment_categories SET icon = '🎸' WHERE level = 'category' AND name LIKE 'Stand guitare%';
UPDATE equipment_categories SET icon = '🎹' WHERE level = 'category' AND name LIKE 'Clavier%';
UPDATE equipment_categories SET icon = '🎹' WHERE level = 'category' AND name LIKE 'Stand clavier%';
UPDATE equipment_categories SET icon = '🎹' WHERE level = 'category' AND name LIKE 'Banquette%';
UPDATE equipment_categories SET icon = '🥁' WHERE level = 'category' AND name IN ('Cymbales', 'Bongos', 'Congas', 'Timbales');
UPDATE equipment_categories SET icon = '🥁' WHERE level = 'category' AND name LIKE 'Fûts%';
UPDATE equipment_categories SET icon = '🥁' WHERE level = 'category' AND name LIKE 'Accesoires batt%';
UPDATE equipment_categories SET icon = '🥁' WHERE level = 'category' AND name LIKE 'Accessoires percus%';
UPDATE equipment_categories SET icon = '🪑' WHERE level = 'category' AND name LIKE 'Tabouret%';
UPDATE equipment_categories SET icon = '🎵' WHERE level = 'category' AND name LIKE 'Pupitre%';

-- Category icons - Rideau-Machinerie
UPDATE equipment_categories SET icon = '🎪' WHERE level = 'category' AND name LIKE 'Rideau%';
UPDATE equipment_categories SET icon = '🎪' WHERE level = 'category' AND name LIKE 'Frise%';
UPDATE equipment_categories SET icon = '🎪' WHERE level = 'category' AND name LIKE 'Cyclorama%';
UPDATE equipment_categories SET icon = '🩰' WHERE level = 'category' AND name LIKE 'Tapis de danse%';
UPDATE equipment_categories SET icon = '⏳' WHERE level = 'category' AND name = 'Patience';
UPDATE equipment_categories SET icon = '🎵' WHERE level = 'category' AND name = 'Pupitres';

-- Category icons - Intercom
UPDATE equipment_categories SET icon = '📞' WHERE level = 'category' AND name LIKE 'Intercom%';
UPDATE equipment_categories SET icon = '📞' WHERE level = 'category' AND name = 'Talky';

-- Category icons - Informatique
UPDATE equipment_categories SET icon = '💻' WHERE level = 'category' AND name = 'Ordinateurs';

-- Category icons - misc
UPDATE equipment_categories SET icon = '🔧' WHERE level = 'category' AND name = 'Accessoires';
UPDATE equipment_categories SET icon = '🔧' WHERE level = 'category' AND name = 'Divers';
UPDATE equipment_categories SET icon = '⚙️' WHERE level = 'category' AND name LIKE 'RS moteur%';
