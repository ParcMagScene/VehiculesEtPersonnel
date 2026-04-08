import { z } from 'zod';

// ── Helpers ──
const str = (max = 255) => z.string().max(max).trim();
const optStr = (max = 255) => str(max).optional().or(z.literal(''));

// ── Equipment Import CSV ──
export const equipmentImportSchema = z.object({
  data: z.array(z.object({
    code_libre: optStr(100),
    nom: str(255),
    famille: optStr(100),
    sous_famille: optStr(100),
    categorie: optStr(100),
    zone: optStr(100),
    stock: z.union([z.number(), z.string()]).optional(),
    marque: optStr(100),
    numero_serie: optStr(100),
  }).passthrough()).min(1).max(10000),
  mode: z.enum(['preview', 'import']),
});

// ── Personnel Import CSV ──
export const personnelImportSchema = z.object({
  data: z.array(z.object({
    code_libre: optStr(50),
    nom: optStr(100),
    prenom: optStr(100),
    cp: optStr(10),
    ville: optStr(100),
    portable: optStr(30),
    type_csv: optStr(50),
  }).passthrough()).min(1).max(5000),
  mode: z.enum(['preview', 'import']),
});

// ── SAV Tickets Import CSV ──
export const savImportSchema = z.object({
  data: z.array(z.object({
    intervention: optStr(255),
    code_article: optStr(100),
    nom_article: optStr(255),
    numero_de_serie: optStr(255),
    debut: optStr(50),
    fin: optStr(50),
    cout: z.union([z.number(), z.string()]).optional(),
    a: optStr(255),
  }).passthrough()).min(1).max(10000),
  mode: z.enum(['preview', 'import']),
  manualLinks: z.record(z.string(), z.number()).optional(),
});

// ── Affaire Create/Update ──
export const affaireSchema = z.object({
  numero_affaire: str(50),
  nom: str(255).optional(),
  type: str(50).optional(),
  client: optStr(255),
  client_id: z.number().int().positive().optional().nullable(),
  contact_nom: optStr(255),
  contact_tel: optStr(30),
  contact_email: optStr(255),
  lieu: optStr(255),
  date_debut: optStr(50),
  date_fin: optStr(50),
  heure_debut: optStr(10),
  heure_fin: optStr(10),
  status: optStr(30),
  notes: optStr(5000),
  color: optStr(20),
}).passthrough();

// ── Middleware factory de validation Zod ──
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      return res.status(400).json({ error: 'Données invalides', details: errors });
    }
    req.body = result.data;
    next();
  };
}
