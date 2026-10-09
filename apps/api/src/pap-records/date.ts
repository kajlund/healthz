export interface PapDatedRecord { therapyDate: string; healthDate: string | null; }

/** Daily PAP reports use healthDate; legacy rows temporarily fall back to therapyDate. */
export const effectivePapHealthDate = (record: PapDatedRecord) => record.healthDate ?? record.therapyDate;
