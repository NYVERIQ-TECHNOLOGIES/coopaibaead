import writeXlsxFile from "write-excel-file/browser";

export async function exportSpreadsheet(rows: Record<string, unknown>[], sheet: string, filename: string) {
  const keys = Object.keys(rows[0] ?? {});
  const data = [keys.map(value => ({ type: String, value })), ...rows.map(row => keys.map(key => {
    const value = row[key];
    return typeof value === "number" ? { type: Number, value } : typeof value === "boolean" ? { type: Boolean, value } : { type: String, value: String(value ?? "") };
  }))];
  await writeXlsxFile(data, { sheet }).toFile(filename);
}