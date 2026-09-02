/**
 * CSV / Excel contact import parser.
 *
 * Shared by the contacts manager (/contacts) and the campaign recipient
 * picker. Reads a File, auto-detects the column layout from the header row
 * (French/English synonyms), normalizes phone numbers, and reports per-row
 * validation problems so the UI can show exactly which lines were dropped.
 */
import * as XLSX from 'xlsx';

export type ContactFieldKey = 'name' | 'phone' | 'email' | 'company' | 'tags' | 'notes';

export const CONTACT_FIELDS: { key: ContactFieldKey | 'ignore'; label: string }[] = [
  { key: 'name', label: 'Nom' },
  { key: 'phone', label: 'Téléphone (WhatsApp)' },
  { key: 'email', label: 'E-mail' },
  { key: 'company', label: 'Entreprise' },
  { key: 'tags', label: 'Tags' },
  { key: 'notes', label: 'Notes' },
  { key: 'ignore', label: 'Ignorer' },
];

export interface ParsedContactRow {
  row: number;
  name?: string;
  phone?: string;
  email?: string;
  company?: string;
  tags: string[];
  notes?: string;
}

export interface ContactParseResult {
  headers: string[];
  /** Column index per field, when auto-detected (override via UI). */
  detected: Partial<Record<ContactFieldKey, number>>;
  rows: ParsedContactRow[];
  invalid: { row: number; reason: string }[];
}

const SYNONYMS: Record<ContactFieldKey, string[]> = {
  name: ['nom', 'name', 'prenom', 'prénom', 'nomcomplet', 'fullname', 'client', 'contact', 'destinataire'],
  phone: [
    'tel', 'telephone', 'téléphone', 'phone', 'mobile', 'gsm', 'numero', 'numéro', 'numtel',
    'whatsapp', 'wa', 'waid', 'telephonewhatsapp', 'portable', 'contactphone',
  ],
  email: ['email', 'courriel', 'mail', 'adresseemail', 'adresseemail'],
  company: ['entreprise', 'societe', 'société', 'company', 'organisation', 'organisme', 'structure', 'boite'],
  tags: ['tags', 'tag', 'etiquettes', 'étiquettes', 'categories', 'catégories', 'categorie', 'catégorie', 'liste', 'segment', 'segments', 'groupes', 'groupe'],
  notes: ['notes', 'note', 'remarques', 'commentaires', 'commentaire'],
};

function normalizeHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function detectField(header: string): ContactFieldKey | null {
  const key = normalizeHeader(header);
  if (!key) return null;
  for (const field of Object.keys(SYNONYMS) as ContactFieldKey[]) {
    if (SYNONYMS[field].includes(key)) return field;
  }
  return null;
}

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '');
  if (!digits) return '';
  const body = digits.startsWith('+') ? digits : `+${digits}`;
  const count = body.replace(/\D/g, '').length;
  return count >= 8 && count <= 15 ? body : '';
}

export function splitTags(raw: string): string[] {
  return raw
    .split(/[,;|/\n]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

async function parseSpreadsheet(file: File): Promise<string[][]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: '',
  });
  return grid.map((row) => row.map((cell) => String(cell ?? '').trim()));
}

async function parseCsv(file: File): Promise<string[][]> {
  const text = await file.text();
  const lines = text.split(/\r?\n/);
  const first = lines.find((l) => l.trim()) ?? '';
  const sep = (() => {
    const counts = [';', ',', '\t'].map((s) => [s, first.split(s).length] as const);
    counts.sort((a, b) => b[1] - a[1]);
    return counts[0][1] > 1 ? counts[0][0] : ',';
  })();
  const cells = (line: string) => line.split(sep).map((c) => c.trim().replace(/^["']|["']$/g, ''));
  return lines.filter((l) => l.trim()).map(cells);
}

export async function parseContactFile(file: File): Promise<ContactParseResult> {
  const isCsv =
    /\.(csv|txt)$/i.test(file.name) ||
    file.type.startsWith('text/') ||
    file.type === 'application/csv';
  const grid = isCsv ? await parseCsv(file) : await parseSpreadsheet(file);
  if (grid.length === 0) {
    return { headers: [], detected: {}, rows: [], invalid: [] };
  }

  // Find the header row: first of the first 15 rows containing at least one
  // known column name. When nothing matches (e.g. a bare phone list), run in
  // headerless mode: every row is data and the phone is looked up cell by cell.
  const maxScan = Math.min(grid.length, 15);
  let headerIndex = -1;
  for (let i = 0; i < maxScan; i += 1) {
    if (grid[i].some((cell) => detectField(cell) !== null)) {
      headerIndex = i;
      break;
    }
  }

  const rows: ParsedContactRow[] = [];
  const invalid: { row: number; reason: string }[] = [];

  // ── Headerless mode: bare phone lists (CSV/Excel column or line per number)
  if (headerIndex === -1) {
    grid.forEach((raw, index) => {
      if (raw.every((c) => !c.trim())) return;
      const phone = raw
        .map((cell) => normalizePhone(cell))
        .find((value): value is string => value.length > 0);
      if (!phone) {
        invalid.push({ row: index + 1, reason: 'numéro manquant ou invalide' });
        return;
      }
      rows.push({ row: index + 1, phone, tags: [] });
    });
    return { headers: [], detected: {}, rows, invalid };
  }

  const headers = grid[headerIndex];
  const width = Math.max(headers.length, ...grid.slice(headerIndex + 1).map((r) => r.length));

  const detected: Partial<Record<ContactFieldKey, number>> = {};
  headers.forEach((header, index) => {
    const field = detectField(header);
    if (field && detected[field] === undefined) detected[field] = index;
  });

  const at = (row: string[], index: number | undefined) =>
    index === undefined || index >= row.length ? '' : row[index];

  for (let i = headerIndex + 1; i < grid.length; i += 1) {
    const raw = grid[i];
    if (raw.every((c) => !c.trim())) continue; // blank line
    const name = at(raw, detected.name).trim();
    const rawPhone = at(raw, detected.phone).trim();
    const phone = rawPhone ? normalizePhone(rawPhone) : '';
    const email = at(raw, detected.email).trim();
    const company = at(raw, detected.company).trim();
    const tagsRaw = at(raw, detected.tags).trim();
    const notes = at(raw, detected.notes).trim();

    if (rawPhone && !phone) {
      invalid.push({ row: i + 1, reason: `numéro invalide : « ${rawPhone.slice(0, 24)} »` });
      continue;
    }
    if (!name && !phone) {
      invalid.push({ row: i + 1, reason: 'nom et téléphone manquants' });
      continue;
    }

    rows.push({
      row: i + 1,
      name: name || undefined,
      phone: phone || undefined,
      email: email || undefined,
      company: company || undefined,
      notes: notes || undefined,
      tags: tagsRaw ? splitTags(tagsRaw) : [],
    });
  }

  void width;
  return { headers, detected, rows, invalid };
}
