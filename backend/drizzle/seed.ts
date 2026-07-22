import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as bcrypt from 'bcrypt';
import * as schema from './schema';

async function seed() {
  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle(client, { schema });

  console.log('Seeding database...');

  // ─── Users (admin, operador, vendedor) ────────────────────────────────────
  const users: Array<{ name: string; email: string; password: string; role: 'ADMIN' | 'OPERADOR' | 'VENDEDOR' }> = [
    { name: 'Administrador', email: 'admin@wpp-autoflow.com', password: 'admin123', role: 'ADMIN' },
    { name: 'Operador', email: 'op@wpp.io', password: 'op', role: 'OPERADOR' },
    { name: 'Vendedor', email: 'vendedor@wpp.io', password: 'vendedor', role: 'VENDEDOR' },
  ];

  for (const user of users) {
    await db
      .insert(schema.adminUsers)
      .values({
        name: user.name,
        email: user.email,
        passwordHash: await bcrypt.hash(user.password, 10),
        role: user.role,
        status: 'ATIVO',
      })
      .onConflictDoNothing();
  }

  // ─── System parameters ────────────────────────────────────────────────────
  const params: schema.NewSystemParam[] = [
    // Pulse
    { key: 'PULSE_ATIVO', value: 'true', description: 'Enable/disable automatic dispatch job' },
    { key: 'PULSE_INTERVALO_MINUTOS', value: '5', description: 'Pulse interval in minutes' },
    { key: 'PULSE_MAX_CONTATOS_POR_CICLO', value: '5', description: 'Max contacts per pulse cycle' },
    { key: 'PULSE_COOLDOWN_HORAS', value: '24', description: 'Cooldown hours after dispatch' },
    { key: 'BROADCAST_DELAY_ENTRE_ENVIOS_MS', value: '3000', description: 'Delay between broadcast sends (ms)' },
    { key: 'MAX_UPLOAD_TAMANHO_MB', value: '50', description: 'Maximum upload size (MB)' },
    { key: 'FLUXO_DELAY_PADRAO_SEGUNDOS', value: '3', description: 'Default delay between flow steps (s)' },

    // Salesperson contact
    { key: 'SELLER_PHONE_NUMBER', value: '', description: 'Main salesperson WhatsApp number' },
    { key: 'SELLER_NAME', value: 'Vendedor', description: 'Main salesperson display name' },

    // Operating hours (Slice 13)
    { key: 'OPERATING_HOURS_START', value: '08:00', description: 'Bot operating start time (HH:MM)' },
    { key: 'OPERATING_HOURS_END', value: '22:00', description: 'Bot operating end time (HH:MM)' },
    { key: 'OPERATING_DAYS', value: '1,2,3,4,5,6', description: 'Active days: 1=Mon…7=Sun (comma-separated)' },

    // AI — OpenRouter (Slice 12)
    { key: 'AI_ENABLED', value: 'false', description: 'Enable AI automatic responses' },
    { key: 'AI_MODEL', value: 'openai/gpt-4o-mini', description: 'OpenRouter model identifier' },
    { key: 'AI_CONTEXT_MESSAGES', value: '20', description: 'Number of past messages sent as context to the AI' },
    { key: 'AI_MAX_TOKENS', value: '300', description: 'Max tokens for AI response' },
    { key: 'AI_SYSTEM_PROMPT', value: 'Você é um assistente de vendas. Responda de forma natural e adaptada ao estilo de comunicação do cliente. Seja objetivo e cordial.', description: 'System prompt for the AI' },
  ];

  for (const param of params) {
    await db.insert(schema.systemParams).values(param).onConflictDoNothing();
  }

  // ─── Default instance-to-star mappings ────────────────────────────────────
  // Shelby atende estrelas 2 e 3 (clientes com mais de R$1.000 gasto)
  // Moritz atende estrela 2 (R$1.000–R$5.000)
  // Prospectador atende estrela 1 (novos leads, até R$1.000)
  // Cobrador sem mapeamento — acionado por lógica de cobrança separada
  const mappings: schema.NewInstanceStarMapping[] = [
    { instanceRole: 'shelby', starRatings: ['2', '3'], active: true },
    { instanceRole: 'moritz', starRatings: ['2'], active: true },
    { instanceRole: 'prospectador', starRatings: ['1'], active: true },
    { instanceRole: 'cobrador', starRatings: [], active: true },
  ];

  for (const mapping of mappings) {
    await db.insert(schema.instanceStarMappings).values(mapping).onConflictDoNothing();
  }

  console.log('Seed completed.');
  await client.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
