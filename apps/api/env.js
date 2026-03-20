// ═══════════════════════════════════════════════════════════════
// env.js — Chargement du .env AVANT tous les autres imports
// Doit être le PREMIER import dans server.js
// ═══════════════════════════════════════════════════════════════
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
const envFile = isDev ? '.env.development' : '.env';
dotenv.config({ path: join(__dir, envFile) });

export { isDev, envFile };
