import { and, count, desc, eq, gte, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requirePermission } from '@/lib/server/workspace';

export const dynamic = 'force-dynamic';

export interface StatsPayload {
  mode: 'db' | 'local';
  totals: {
    inbound: number;
    outbound: number;
    conversations: number;
    avgPerDay: number;
  };
  responseRate: { answered: number; inboundConversations: number; rate: number | null };
  daily: { day: string; inbound: number; outbound: number }[];
  topContacts: { contact: string; inbound: number; outbound: number; lastAt: string }[];
}

function emptyPayload(mode: 'db' | 'local'): StatsPayload {
  return {
    mode,
    totals: { inbound: 0, outbound: 0, conversations: 0, avgPerDay: 0 },
    responseRate: { answered: 0, inboundConversations: 0, rate: null },
    daily: [],
    topContacts: [],
  };
}

export async function GET() {
  const gate = await requirePermission('stats.view');
  if (!gate.ok) return gate.response;
  // Les statistiques portent sur le journal du workspace (propriétaire), pas
  // sur l'utilisateur individuel : owner et collaborateurs voient la même vue.
  const userId = gate.workspace.ownerUserId;
  if (!db) return Response.json(emptyPayload('local'));

  const last30 = sql`now() - interval '30 days'`;
  const last14 = sql`now() - interval '14 days'`;

  // Volume in/out sur 30 jours + nombre de conversations actives.
  const [volumeRows, conversationRows] = await Promise.all([
    db
      .select({
        direction: schema.whatsappMessages.direction,
        total: count(),
      })
      .from(schema.whatsappMessages)
      .where(
        and(
          eq(schema.whatsappMessages.userId, userId),
          gte(schema.whatsappMessages.createdAt, last30),
        ),
      )
      .groupBy(schema.whatsappMessages.direction),
    db
      .select({ conversations: sql<number>`count(distinct ${schema.whatsappMessages.conversationId})` })
      .from(schema.whatsappMessages)
      .where(
        and(
          eq(schema.whatsappMessages.userId, userId),
          gte(schema.whatsappMessages.createdAt, last30),
        ),
      ),
  ]);

  // Taux de réponse : parmi les conversations avec au moins un message entrant
  // sur 30 jours, celles qui ont aussi reçu au moins une réponse sortante.
  const convDirections = await db
    .select({
      conversationId: schema.whatsappMessages.conversationId,
      inbound: sql<boolean>`bool_or(${schema.whatsappMessages.direction} = 'INBOUND')`,
      outbound: sql<boolean>`bool_or(${schema.whatsappMessages.direction} = 'OUTBOUND')`,
    })
    .from(schema.whatsappMessages)
    .where(
      and(
        eq(schema.whatsappMessages.userId, userId),
        gte(schema.whatsappMessages.createdAt, last30),
      ),
    )
    .groupBy(schema.whatsappMessages.conversationId);
  const inboundConversations = convDirections.filter((c) => c.inbound).length;
  const answered = convDirections.filter((c) => c.inbound && c.outbound).length;

  // Série quotidienne sur 14 jours (in/out) — les journées sans message sont
  // ajoutées côté client pour un graphique continu.
  const dailyRows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${schema.whatsappMessages.createdAt}), 'YYYY-MM-DD')`,
      inbound: sql<number>`count(*) filter (where ${schema.whatsappMessages.direction} = 'INBOUND')`,
      outbound: sql<number>`count(*) filter (where ${schema.whatsappMessages.direction} = 'OUTBOUND')`,
    })
    .from(schema.whatsappMessages)
    .where(
      and(
        eq(schema.whatsappMessages.userId, userId),
        gte(schema.whatsappMessages.createdAt, last14),
      ),
    )
    .groupBy(sql`date_trunc('day', ${schema.whatsappMessages.createdAt})`)
    .orderBy(sql`date_trunc('day', ${schema.whatsappMessages.createdAt})`);

  // Top contacts par volume total sur 30 jours.
  const topRows = await db
    .select({
      contact: sql<string>`case when ${schema.whatsappMessages.direction} = 'INBOUND' then ${schema.whatsappMessages.fromNumber} else ${schema.whatsappMessages.toNumber} end`,
      inbound: sql<number>`count(*) filter (where ${schema.whatsappMessages.direction} = 'INBOUND')`,
      outbound: sql<number>`count(*) filter (where ${schema.whatsappMessages.direction} = 'OUTBOUND')`,
      lastAt: sql<string>`max(${schema.whatsappMessages.createdAt})`,
    })
    .from(schema.whatsappMessages)
    .where(
      and(
        eq(schema.whatsappMessages.userId, userId),
        gte(schema.whatsappMessages.createdAt, last30),
      ),
    )
    .groupBy(sql`1`)
    .orderBy(desc(sql`count(*)`))
    .limit(8);

  const inbound = Number(volumeRows.find((r) => r.direction === 'INBOUND')?.total ?? 0);
  const outbound = Number(volumeRows.find((r) => r.direction === 'OUTBOUND')?.total ?? 0);

  const payload: StatsPayload = {
    mode: 'db',
    totals: {
      inbound,
      outbound,
      conversations: Number(conversationRows[0]?.conversations ?? 0),
      avgPerDay: Math.round(((inbound + outbound) / 14) * 10) / 10,
    },
    responseRate: {
      answered,
      inboundConversations,
      rate: inboundConversations > 0 ? Math.round((answered / inboundConversations) * 100) : null,
    },
    daily: dailyRows.map((r) => ({
      day: r.day,
      inbound: Number(r.inbound),
      outbound: Number(r.outbound),
    })),
    topContacts: topRows.map((r) => ({
      contact: r.contact || 'Inconnu',
      inbound: Number(r.inbound),
      outbound: Number(r.outbound),
      lastAt: r.lastAt,
    })),
  };
  return Response.json(payload);
}
