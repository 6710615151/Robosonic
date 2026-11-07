// Server-side redaction for the raw database browser (/database) and CSV export (/api/export).
// Both used to return every column to anonymous visitors, including submitters' contact details,
// internal review notes and the inventory fields the /inventory page masks in public mode.
// Rule: administrators see full rows; everyone else gets these columns replaced before the data
// leaves the server, so nothing sensitive is ever sent to the browser.
export const REDACTED = "[restricted]";

type Row = Record<string, unknown>;
type Rule = (row: Row) => Row;

const RULES: Record<string, Rule> = {
  // Community submissions: identity of the submitter and the reviewers' internal notes.
  submissions: (row) => ({
    ...row,
    submitterName: row.submitterName == null ? null : REDACTED,
    submitterContact: row.submitterContact == null ? null : REDACTED,
    reviewNotes: row.reviewNotes == null ? null : REDACTED,
    submittedById: row.submittedById == null ? null : REDACTED
  }),
  // Physical inventory: same masking as the public mode of /inventory.
  owned_inventory: (row) => ({
    ...row,
    locationLabel: row.locationLabel == null ? null : REDACTED,
    serialNumber: row.serialNumber == null || row.publicSerialSafe === true ? row.serialNumber : REDACTED,
    notes: row.notes == null ? null : REDACTED
  })
};

export function redactRows<T extends Row>(table: string, rows: T[], admin: boolean): Row[] {
  const rule = RULES[table];
  if (admin || !rule) return rows;
  return rows.map(rule);
}

export function isRedactedTable(table: string) {
  return table in RULES;
}
