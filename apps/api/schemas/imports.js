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
    stock: z.coerce.number().nonnegative().optional(),
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
    cout: z.coerce.number().nonnegative().optional(),
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

// ── [AUDIT FIX I1] Supplier Articles Import (catalogue fournisseur) ──
export const supplierImportSchema = z.object({
  supplier_id: z.number().int().positive(),
  filename: str(500),
  file_size: z.number().int().nonnegative().optional().default(0),
  page_count: z.number().int().nonnegative().optional().default(0),
  articles: z.array(z.object({
    designation: str(1000),
    supplier_ref: optStr(255),
    brand: optStr(255),
    brand_id: z.number().int().positive().optional().nullable(),
    model: optStr(500),
    description: optStr(5000),
    family: optStr(255),
    subfamily: optStr(255),
    category: optStr(255),
    price_ht: z.number().nonnegative().optional().nullable(),
    currency: optStr(10),
    weight: optStr(50),
    dimensions: z.any().optional(),
    unit: optStr(20),
    metadata: z.any().optional(),
  }).passthrough()).min(1).max(10000),
});

// ── [AUDIT FIX I2] Contacts CSV Import ──
export const contactsImportSchema = z.object({
  data: z.array(z.object({
    name: optStr(255),
    nom_prenom: optStr(255),
    codeFree: optStr(50),
    code_libre: optStr(50),
    phone: optStr(30),
    telephone: optStr(30),
    mobile: optStr(30),
    portable: optStr(30),
    email: optStr(255),
    company: optStr(255),
    societe: optStr(255),
    function: optStr(255),
    fonction: optStr(255),
    type: optStr(50),
    notes: optStr(2000),
  }).passthrough()).min(1).max(5000),
  mode: z.enum(['preview', 'import']).optional().default('import'),
});

// ── [AUDIT FIX I5] Stock Import ──
export const stockImportSchema = z.object({
  items: z.array(z.object({
    name: str(255),
    reference: optStr(100),
    description: optStr(2000),
    category_name: optStr(255),
    category: optStr(255),
    category_id: z.number().int().positive().optional().nullable(),
    quantity: z.coerce.number().nonnegative().optional().default(0),
    unit_price: z.coerce.number().nonnegative().optional().default(0),
    value: z.coerce.number().nonnegative().optional().default(0),
    sell_price: z.coerce.number().nonnegative().optional().default(0),
    min_quantity: z.coerce.number().nonnegative().optional().default(0),
    unit: optStr(20),
    location: optStr(255),
    emplacement: optStr(255),
    notes: optStr(2000),
  }).passthrough()).min(1).max(5000),
  mode: z.enum(['upsert', 'insert']).optional().default('upsert'),
});

// ── Middleware factory de validation Zod ──
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const zodIssues = Array.isArray(result.error?.issues)
        ? result.error.issues
        : Array.isArray(result.error?.errors)
          ? result.error.errors
          : [];
      const errors = zodIssues.map(e => `${Array.isArray(e.path) ? e.path.join('.') : ''}: ${e.message}`);
      return res.status(400).json({ success: false, error: 'Données invalides', details: errors });
    }
    req.body = result.data;
    next();
  };
}
