import { sql } from 'drizzle-orm';
import { sleepRecords, sleepSessions } from '../db/schema.js';
import type { StageCoverage } from './service.js';

// Keep the outer ID qualified: Drizzle strips column qualifiers from single-table
// selections, which would otherwise bind an unqualified id to the child table.
const parentId = sql.raw('"sleep_records"."id"');

// Read coverage without joining child rows into daily observations or summing
// measurements again. Parent totals alone cannot distinguish partial from none.
export const sleepStageCoverageSql = sql<StageCoverage>`case
  when ${sleepRecords.detailMode} = 'summary' then case
    when ${sleepRecords.lightMinutes} is not null and ${sleepRecords.deepMinutes} is not null and ${sleepRecords.remMinutes} is not null then 'complete'
    when ${sleepRecords.lightMinutes} is not null or ${sleepRecords.deepMinutes} is not null or ${sleepRecords.remMinutes} is not null then 'partial'
    else 'none' end
  when exists (select 1 from ${sleepSessions} where ${sleepSessions.sleepRecordId} = ${parentId})
    and not exists (select 1 from ${sleepSessions} where ${sleepSessions.sleepRecordId} = ${parentId}
      and (${sleepSessions.lightMinutes} is null or ${sleepSessions.deepMinutes} is null or ${sleepSessions.remMinutes} is null)) then 'complete'
  when exists (select 1 from ${sleepSessions} where ${sleepSessions.sleepRecordId} = ${parentId}
    and (${sleepSessions.lightMinutes} is not null or ${sleepSessions.deepMinutes} is not null or ${sleepSessions.remMinutes} is not null)) then 'partial'
  else 'none' end`;

export const sleepSessionCountSql = sql<number>`case when ${sleepRecords.detailMode} = 'sessions'
  then (select count(*)::integer from ${sleepSessions} where ${sleepSessions.sleepRecordId} = ${parentId}) else 0 end`;
export const sleepNapCountSql = sql<number>`case when ${sleepRecords.detailMode} = 'sessions'
  then (select count(*)::integer from ${sleepSessions} where ${sleepSessions.sleepRecordId} = ${parentId} and ${sleepSessions.sessionType} = 'nap') else 0 end`;
