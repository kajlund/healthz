import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  lt,
  lte,
  max,
  or,
  type SQL,
  sql,
} from 'drizzle-orm';

import { db } from '../db/index.js';
import {
  healthcareEvents,
  healthcareEventTags,
  healthcareTags,
} from '../db/schema.js';
import { AppError } from '../errors.js';
import type {
  HealthcareEventInput,
  HealthcareEventListQuery,
} from './schemas.js';

export interface AssignedHealthcareTag {
  id: string;
  name: string;
}
export interface HealthcareEvent {
  id: string;
  eventDate: string;
  eventTime: string | null;
  title: string;
  description: string | null;
  provider: string | null;
  organization: string | null;
  location: string | null;
  tags: AssignedHealthcareTag[];
  createdAt: Date;
  updatedAt: Date;
}
export interface HealthcareEventPage {
  items: HealthcareEvent[];
  total: number;
  latestEventDate: string | null;
  page: number;
  pageSize: number;
}
export interface HealthcareDashboardEvents {
  latestPast: HealthcareEvent | null;
  nextFuture: HealthcareEvent | null;
}
export interface HealthcareEventRepository {
  create(input: HealthcareEventInput): Promise<HealthcareEvent>;
  list(query: HealthcareEventListQuery): Promise<HealthcareEventPage>;
  findById(id: string): Promise<HealthcareEvent | undefined>;
  update(
    id: string,
    input: HealthcareEventInput,
  ): Promise<HealthcareEvent | undefined>;
  delete(id: string): Promise<boolean>;
  dashboard(
    today: string,
    currentTime: string,
  ): Promise<HealthcareDashboardEvents>;
  listAll?(): Promise<HealthcareEvent[]>;
}

type EventRow = typeof healthcareEvents.$inferSelect;
const publicEvent = (
  row: EventRow,
  tags: AssignedHealthcareTag[],
): HealthcareEvent => ({
  ...row,
  eventTime: row.eventTime?.slice(0, 5) ?? null,
  tags,
});
const valuesFromInput = (input: HealthcareEventInput) => ({
  eventDate: input.eventDate,
  eventTime: input.eventTime || null,
  title: input.title,
  description: input.description ?? null,
  provider: input.provider ?? null,
  organization: input.organization ?? null,
  location: input.location ?? null,
});
const ensureTags = async (
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  tagIds: string[],
) => {
  if (!tagIds.length) return [];
  const tags = await tx
    .select({ id: healthcareTags.id, name: healthcareTags.name })
    .from(healthcareTags)
    .where(inArray(healthcareTags.id, tagIds))
    .orderBy(asc(healthcareTags.normalizedName));
  const found = new Set(tags.map(({ id }) => id));
  const missing = tagIds.filter((id) => !found.has(id));
  if (missing.length)
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'One or more healthcare tags do not exist',
      { missingTagIds: missing },
    );
  return tags;
};
const loadTags = async (eventIds: string[]) => {
  const result = new Map<string, AssignedHealthcareTag[]>();
  for (const id of eventIds) result.set(id, []);
  if (!eventIds.length) return result;
  const rows = await db
    .select({
      eventId: healthcareEventTags.healthcareEventId,
      id: healthcareTags.id,
      name: healthcareTags.name,
    })
    .from(healthcareEventTags)
    .innerJoin(
      healthcareTags,
      eq(healthcareEventTags.healthcareTagId, healthcareTags.id),
    )
    .where(inArray(healthcareEventTags.healthcareEventId, eventIds))
    .orderBy(asc(healthcareTags.normalizedName));
  for (const row of rows)
    result.get(row.eventId)?.push({ id: row.id, name: row.name });
  return result;
};
const eventOrder = [
  desc(healthcareEvents.eventDate),
  sql`${healthcareEvents.eventTime} desc nulls last`,
  desc(healthcareEvents.createdAt),
  desc(healthcareEvents.id),
] as const;

export const healthcareEventRepository: HealthcareEventRepository = {
  async create(input) {
    return db.transaction(async (tx) => {
      const tags = await ensureTags(tx, input.tagIds);
      const [event] = await tx
        .insert(healthcareEvents)
        .values(valuesFromInput(input))
        .returning();
      if (input.tagIds.length)
        await tx.insert(healthcareEventTags).values(
          input.tagIds.map((healthcareTagId) => ({
            healthcareEventId: event!.id,
            healthcareTagId,
          })),
        );
      return publicEvent(event!, tags);
    });
  },
  async list(query) {
    const conditions: SQL[] = [];
    if (query.from)
      conditions.push(gte(healthcareEvents.eventDate, query.from));
    if (query.to) conditions.push(lte(healthcareEvents.eventDate, query.to));
    if (query.search) {
      const pattern = `%${query.search}%`;
      conditions.push(
        or(
          ilike(healthcareEvents.title, pattern),
          ilike(healthcareEvents.description, pattern),
          ilike(healthcareEvents.provider, pattern),
          ilike(healthcareEvents.organization, pattern),
          ilike(healthcareEvents.location, pattern),
        )!,
      );
    }
    if (query.tagIds.length) {
      conditions.push(
        query.tagMatch === 'all'
          ? sql`${healthcareEvents.id} in (select ${healthcareEventTags.healthcareEventId} from ${healthcareEventTags} where ${inArray(healthcareEventTags.healthcareTagId, query.tagIds)} group by ${healthcareEventTags.healthcareEventId} having count(distinct ${healthcareEventTags.healthcareTagId}) = ${query.tagIds.length})`
          : sql`${healthcareEvents.id} in (select ${healthcareEventTags.healthcareEventId} from ${healthcareEventTags} where ${inArray(healthcareEventTags.healthcareTagId, query.tagIds)})`,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [totalRow, rows] = await Promise.all([
      db
        .select({
          value: count(),
          latestEventDate: max(healthcareEvents.eventDate),
        })
        .from(healthcareEvents)
        .where(where),
      db
        .select()
        .from(healthcareEvents)
        .where(where)
        .orderBy(...eventOrder)
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
    ]);
    const tags = await loadTags(rows.map(({ id }) => id));
    return {
      items: rows.map((row) => publicEvent(row, tags.get(row.id) ?? [])),
      total: Number(totalRow[0]?.value ?? 0),
      latestEventDate: totalRow[0]?.latestEventDate ?? null,
      page: query.page,
      pageSize: query.pageSize,
    };
  },
  async listAll() {
    const rows = await db
      .select()
      .from(healthcareEvents)
      .orderBy(...eventOrder);
    const tags = await loadTags(rows.map(({ id }) => id));
    return rows.map((row) => publicEvent(row, tags.get(row.id) ?? []));
  },
  async findById(id) {
    const [row] = await db
      .select()
      .from(healthcareEvents)
      .where(eq(healthcareEvents.id, id))
      .limit(1);
    if (!row) return undefined;
    const tags = await loadTags([id]);
    return publicEvent(row, tags.get(id) ?? []);
  },
  async update(id, input) {
    return db.transaction(async (tx) => {
      const tags = await ensureTags(tx, input.tagIds);
      const [event] = await tx
        .update(healthcareEvents)
        .set({ ...valuesFromInput(input), updatedAt: new Date() })
        .where(eq(healthcareEvents.id, id))
        .returning();
      if (!event) return undefined;
      await tx
        .delete(healthcareEventTags)
        .where(eq(healthcareEventTags.healthcareEventId, id));
      if (input.tagIds.length)
        await tx.insert(healthcareEventTags).values(
          input.tagIds.map((healthcareTagId) => ({
            healthcareEventId: id,
            healthcareTagId,
          })),
        );
      return publicEvent(event, tags);
    });
  },
  async delete(id) {
    const deleted = await db
      .delete(healthcareEvents)
      .where(eq(healthcareEvents.id, id))
      .returning({ id: healthcareEvents.id });
    return deleted.length > 0;
  },
  async dashboard(today, currentTime) {
    const past = or(
      lt(healthcareEvents.eventDate, today),
      and(
        eq(healthcareEvents.eventDate, today),
        or(
          sql`${healthcareEvents.eventTime} is null`,
          lte(healthcareEvents.eventTime, currentTime),
        ),
      ),
    );
    const future = or(
      gt(healthcareEvents.eventDate, today),
      and(
        eq(healthcareEvents.eventDate, today),
        gt(healthcareEvents.eventTime, currentTime),
      ),
    );
    const [pastRows, futureRows] = await Promise.all([
      db
        .select()
        .from(healthcareEvents)
        .where(past)
        .orderBy(...eventOrder)
        .limit(1),
      db
        .select()
        .from(healthcareEvents)
        .where(future)
        .orderBy(
          asc(healthcareEvents.eventDate),
          sql`${healthcareEvents.eventTime} asc nulls last`,
          asc(healthcareEvents.createdAt),
          asc(healthcareEvents.id),
        )
        .limit(1),
    ]);
    const rows = [pastRows[0], futureRows[0]].filter((row): row is EventRow =>
      Boolean(row),
    );
    const tags = await loadTags([...new Set(rows.map(({ id }) => id))]);
    return {
      latestPast: pastRows[0]
        ? publicEvent(pastRows[0], tags.get(pastRows[0].id) ?? [])
        : null,
      nextFuture: futureRows[0]
        ? publicEvent(futureRows[0], tags.get(futureRows[0].id) ?? [])
        : null,
    };
  },
};
