interface Searchable {
  recipient_name: string;
  certificate_no: string;
  group_name: string | null;
  workshop: { title: string } | null;
}

/** Case-insensitive contains match on recipient, number, group and workshop title. */
export function filterCertificates<T extends Searchable>(rows: readonly T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (q === '') return [...rows];
  return rows.filter((r) =>
    [r.recipient_name, r.certificate_no, r.group_name ?? '', r.workshop?.title ?? ''].some((v) => v.toLowerCase().includes(q)));
}
