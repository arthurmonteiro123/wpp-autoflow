import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

interface ContatoExtraido {
  name: string;
  starLevel: number;
  phoneNumber: string;
  city: string;
  status: string;
  whatsapp: string;
  instagram: string;
  address: string;
  debt: string;
}

const STATUS_MAP: Record<string, 'ATIVO' | 'INATIVO' | 'NOVO'> = {
  Ativo: 'ATIVO',
  Inativo: 'INATIVO',
};

function humanizeCity(city: string): string {
  return city
    .replace(/_/g, ' ')
    .split(' ')
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

/** Múltiplos números vêm separados por "/", "," ou " - " (com espaços); pega só o primeiro. */
function firstPhoneToken(raw: string): string {
  return raw.split(/\s*[/,]\s*|\s+-\s+/)[0] ?? raw;
}

/** Normaliza para dígitos com DDI 55 quando o número parece ser BR sem código de país. */
function normalizePhone(raw: string): string | null {
  const token = firstPhoneToken(raw.trim());
  const digits = token.replace(/\D/g, '');
  if (!digits) return null;

  let normalized = digits;
  if (digits.length === 10 || digits.length === 11) {
    normalized = '55' + digits;
  }

  if (!/^\d{10,15}$/.test(normalized)) return null;
  return normalized;
}

function parseDebt(raw: string): string | null {
  const cleaned = raw.trim().replace(',', '.');
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value.toFixed(2);
}

async function seedLeads() {
  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle(client, { schema });

  const filePath = join(__dirname, '..', 'docs', 'contatos_extraidos.json');
  const contatos: ContatoExtraido[] = JSON.parse(readFileSync(filePath, 'utf-8'));

  console.log(`Importando ${contatos.length} leads de ${filePath}...`);

  let inseridos = 0;
  let ignoradosSemTelefone = 0;
  let ignoradosTelefoneInvalido = 0;

  for (const c of contatos) {
    if (!c.phoneNumber?.trim()) {
      ignoradosSemTelefone++;
      continue;
    }

    const phoneNumber = normalizePhone(c.phoneNumber);
    if (!phoneNumber) {
      ignoradosTelefoneInvalido++;
      console.warn(`Telefone inválido, ignorado: "${c.phoneNumber}" (${c.name})`);
      continue;
    }

    const cityLabel = c.city ? humanizeCity(c.city) : '';
    const address = [c.address?.trim(), cityLabel].filter(Boolean).join(' — ') || null;

    const socialMedia =
      c.instagram && c.instagram !== 'não-encontrado' ? c.instagram.trim() : null;

    const notes = c.whatsapp?.trim() ? `Apelido no WhatsApp: ${c.whatsapp.trim()}` : null;

    const debtAmount = parseDebt(c.debt ?? '');

    const [inserted] = await db
      .insert(schema.contacts)
      .values({
        name: c.name.trim(),
        phoneNumber,
        starLevel: c.starLevel,
        starLevelManual: true, // preserva a classificação da extração original
        engagementStatus: STATUS_MAP[c.status] ?? 'NOVO',
        address,
        socialMedia,
        notes,
        owesDebt: debtAmount !== null,
        debtAmount,
      })
      .onConflictDoNothing({ target: schema.contacts.phoneNumber })
      .returning({ id: schema.contacts.id });

    if (inserted) inseridos++;
  }

  console.log('--- Importação de leads concluída ---');
  console.log(`Inseridos: ${inseridos}`);
  console.log(`Ignorados (sem telefone): ${ignoradosSemTelefone}`);
  console.log(`Ignorados (telefone inválido): ${ignoradosTelefoneInvalido}`);
  console.log(
    `Ignorados/duplicados (telefone já existente): ${
      contatos.length - inseridos - ignoradosSemTelefone - ignoradosTelefoneInvalido
    }`,
  );

  await client.end();
}

seedLeads().catch((err) => {
  console.error('Importação de leads falhou:', err);
  process.exit(1);
});
