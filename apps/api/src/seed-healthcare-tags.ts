import { healthcareTags } from './db/schema.js';
import { db, pool } from './db/index.js';
import {
  cleanHealthcareTagName,
  normalizeHealthcareTagName,
} from './healthcare-tags/schemas.js';

export const initialHealthcareTagNames = [
  'Doctor',
  'Dentistry',
  'Physiotherapy',
  'Blood donation',
  'Vaccination',
  'Psychotherapy',
  'Medication',
  'Ophthalmology',
  'Laboratory',
  'Imaging',
  'Surgery',
  'Check-up',
] as const;

const main = async () => {
  const values = initialHealthcareTagNames.map((value) => {
    const name = cleanHealthcareTagName(value);
    return { name, normalizedName: normalizeHealthcareTagName(name) };
  });
  const inserted = await db
    .insert(healthcareTags)
    .values(values)
    .onConflictDoNothing({ target: healthcareTags.normalizedName })
    .returning({ id: healthcareTags.id });
  console.log(
    `Healthcare tags ready: ${values.length} (${inserted.length} inserted, ${values.length - inserted.length} already present).`,
  );
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
