// Report exporters — turn a { title, columns, rows } report into CSV / Excel / PDF.
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

const csvEscape = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const toCSV = ({ columns, rows }) => {
  const header = columns.map(c => csvEscape(c.label)).join(',');
  const body = rows.map(r => columns.map(c => csvEscape(r[c.key])).join(',')).join('\n');
  return Buffer.from(`${header}\n${body}`, 'utf8');
};

const toXLSX = async ({ title, columns, rows }) => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Report');
  ws.addRow([title]); ws.getRow(1).font = { bold: true, size: 14 };
  ws.addRow([]);
  ws.addRow(columns.map(c => c.label)).font = { bold: true };
  rows.forEach(r => ws.addRow(columns.map(c => r[c.key])));
  ws.columns.forEach(col => { col.width = 22; });
  return Buffer.from(await wb.xlsx.writeBuffer());
};

const toPDF = ({ title, columns, rows, summary }) => new Promise((resolve, reject) => {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  const chunks = [];
  doc.on('data', c => chunks.push(c));
  doc.on('end', () => resolve(Buffer.concat(chunks)));
  doc.on('error', reject);

  doc.fontSize(16).fillColor('#0f1f3d').text(title, { underline: false });
  if (summary) doc.moveDown(0.3).fontSize(10).fillColor('#475569').text(summary);
  doc.moveDown(0.6);

  const startX = doc.x, colW = (515) / columns.length;
  const drawRow = (vals, bold) => {
    const y = doc.y;
    doc.fontSize(9).fillColor(bold ? '#0f1f3d' : '#1e293b').font(bold ? 'Helvetica-Bold' : 'Helvetica');
    vals.forEach((v, i) => doc.text(String(v == null ? '' : v), startX + i * colW, y, { width: colW - 6 }));
    doc.moveDown(0.2);
    doc.moveTo(startX, doc.y).lineTo(startX + 515, doc.y).strokeColor('#e2e8f0').stroke();
    doc.moveDown(0.2);
  };
  drawRow(columns.map(c => c.label), true);
  rows.forEach(r => drawRow(columns.map(c => r[c.key]), false));
  if (!rows.length) doc.moveDown().fontSize(10).fillColor('#94a3b8').text('No data for this period.');

  doc.end();
});

const FORMATS = {
  csv:  { mime: 'text/csv', ext: 'csv', build: async (r) => toCSV(r) },
  xlsx: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: 'xlsx', build: toXLSX },
  pdf:  { mime: 'application/pdf', ext: 'pdf', build: toPDF },
};

const exportReport = async (report, format) => {
  const f = FORMATS[format];
  if (!f) throw new Error(`Unsupported format: ${format}. Use csv, xlsx, or pdf.`);
  const buffer = await f.build(report);
  const safe = (report.report || 'report').replace(/[^a-z0-9_-]/gi, '_');
  return { buffer, mime: f.mime, filename: `${safe}_${new Date().toISOString().slice(0, 10)}.${f.ext}` };
};

module.exports = { exportReport, FORMATS };
