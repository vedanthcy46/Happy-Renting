import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

export interface OwnerReportItem {
  _id: string;
  category: string;
  title?: string;
  amount: number;
  isRecurring: boolean;
  expenseDate?: string;
  propertyId?: { _id: string; name: string } | string;
}

/** Analytics series for the premium charts section (mirrors OwnerAnalytics). */
export interface ReportAnalytics {
  collectionTrend: { month: string; expected: number; collected: number; pending: number }[];
  incomeTrend: { month: string; income: number }[];
  paidVsPending: { paid: number; pending: number };
  occupancy: { totalRooms: number; occupiedRooms: number; vacantRooms: number; occupancyRate: number };
  tenantPaymentStatus: { paid: number; partial: number; pending: number; overdue: number };
  paymentMethods: { method: string; amount: number; count: number }[];
  propertyCollection: { propertyId: string; name: string; expected: number; collected: number; pending: number }[];
  propertyOccupancy: { propertyId: string; name: string; totalRooms: number; occupiedRooms: number; occupancyRate: number }[];
}

/** Translated strings for chart titles/legends, supplied by the screen. */
export interface ReportChartLabels {
  monthlyCollection: string;
  paidVsPending: string;
  pendingTrend: string;
  incomeTrend: string;
  occupancy: string;
  tenantStatus: string;
  propertyCollection: string;
  propertyOccupancy: string;
  paymentMethods: string;
  collected: string;
  pending: string;
  paid: string;
  partial: string;
  overdue: string;
  occupied: string;
  vacant: string;
  overall: string;
  occupancyRate: string;
}

export interface OwnerReportData {
  month: string;
  monthLabel: string;
  income: number;
  expenses: number;
  netProfit: number;
  expenseCount: number;
  propertyName: string;
  items: OwnerReportItem[];
  analytics?: ReportAnalytics | null;
  labels?: ReportChartLabels;
}

const CATEGORY_LABEL: Record<string, string> = {
  maintenance: 'Maintenance', electricity: 'Electricity', water: 'Water',
  society: 'Society', repairs: 'Repairs', cleaning: 'Cleaning', internet: 'Internet', misc: 'Misc',
  subscription: 'Subscription',
};

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: 'Cash', upi: 'UPI', bank_transfer: 'Bank Transfer', cheque: 'Cheque', other: 'Other',
};

const COLORS = {
  primary: '#4B6BED',
  success: '#16a34a',
  error: '#ef4444',
  warning: '#d97706',
  neutral: '#94a3b8',
  violet: '#7C3AED',
};

const METHOD_COLORS = [COLORS.primary, COLORS.success, COLORS.warning, COLORS.violet, COLORS.neutral];

const formatINR = (n: number) => '₹' + (Number.isFinite(n) ? n : 0).toLocaleString('en-IN');

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const shortMonth = (m: string) => {
  const [, mm] = m.split('-');
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const idx = parseInt(mm, 10) - 1;
  return Number.isNaN(idx) ? m : names[idx] ?? mm;
};

// ─────────────────────────────────────────────────────────────────────────────
// Chart builders — pure inline SVG / HTML-CSS (no JS execution in the print
// WebView, so everything is precomputed here).
// ─────────────────────────────────────────────────────────────────────────────

const legendHtml = (items: { label: string; color: string }[]) =>
  items
    .map(
      (i) => `<span style="margin-right:14px; font-size:10px; color:#475569;">
        <span style="display:inline-block; width:8px; height:8px; border-radius:4px; background:${i.color}; margin-right:4px;"></span>${esc(i.label)}</span>`
    )
    .join('');

/** Grouped vertical bars (monthly collected vs pending). */
function groupedBarSvg(data: { label: string; values: number[] }[], colors: string[]): string {
  const W = 640, H = 200, padT = 10, padB = 22;
  const chartH = H - padT - padB;
  const max = Math.max(1, ...data.flatMap((d) => d.values.map((v) => (Number.isFinite(v) ? Math.max(0, v) : 0))));
  const gw = W / Math.max(1, data.length);
  const bw = Math.min(18, (gw * 0.5) / Math.max(1, colors.length));
  let out = `<line x1="0" y1="${padT + chartH}" x2="${W}" y2="${padT + chartH}" stroke="#e2e8f0" stroke-width="1"/>`;
  data.forEach((d, di) => {
    const cx = di * gw + gw / 2;
    d.values.forEach((raw, si) => {
      const v = Number.isFinite(raw) ? Math.max(0, raw) : 0;
      const bh = Math.max((v / max) * chartH, v > 0 ? 2 : 0);
      const x = cx - (colors.length * bw) / 2 + si * bw;
      const y = padT + chartH - bh;
      out += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="3" fill="${colors[si]}"/>`;
    });
    out += `<text x="${cx.toFixed(1)}" y="${H - 6}" font-size="9" text-anchor="middle" fill="#64748b">${esc(d.label)}</text>`;
  });
  return `<svg width="100%" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${out}</svg>`;
}

/** Simple line chart (trends). */
function lineChartSvg(data: { label: string; value: number }[], color: string): string {
  const W = 640, H = 190, padT = 12, padB = 24, padL = 8, padR = 8;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const vals = data.map((d) => (Number.isFinite(d.value) ? Math.max(0, d.value) : 0));
  const m = Math.max(...vals, 0);
  const max = m === 0 ? 1 : m * 1.15;
  let out = `<line x1="${padL}" y1="${padT + plotH}" x2="${padL + plotW}" y2="${padT + plotH}" stroke="#e2e8f0" stroke-width="1"/>`;
  if (data.length > 1) {
    const pts = data.map((d, i) => ({
      x: padL + (i / (data.length - 1)) * plotW,
      y: padT + plotH - (vals[i] / max) * plotH,
    }));
    const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    out += `<path d="${path}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    pts.forEach((p) => {
      out += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="${color}"/>`;
    });
    data.forEach((d, i) => {
      if (data.length > 8 && i % 2 === 1) return;
      out += `<text x="${pts[i].x.toFixed(1)}" y="${H - 6}" font-size="9" text-anchor="middle" fill="#64748b">${esc(d.label)}</text>`;
    });
  }
  return `<svg width="100%" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${out}</svg>`;
}

/** Donut with center label + side legend. */
function donutHtml(
  segments: { label: string; value: number; color: string }[],
  centerLabel?: string,
  centerValue?: string,
  valueFormat: (n: number) => string = formatINR
): string {
  const size = 130, thickness = 16;
  const r = (size - thickness) / 2;
  const C = 2 * Math.PI * r;
  const safe = segments.map((s) => ({ ...s, value: Number.isFinite(s.value) ? Math.max(0, s.value) : 0 }));
  const total = safe.reduce((s, x) => s + x.value, 0);
  let circles = `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="#e2e8f0" stroke-width="${thickness}" fill="none"/>`;
  if (total > 0) {
    let acc = 0;
    safe.forEach((seg) => {
      const len = (seg.value / total) * C;
      if (len > 0.5) {
        circles += `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="${seg.color}" stroke-width="${thickness}" fill="none" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-acc).toFixed(2)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>`;
      }
      acc += len;
    });
  }
  const center = `
    <text x="${size / 2}" y="${centerValue ? size / 2 - 2 : size / 2 + 4}" text-anchor="middle" font-size="15" font-weight="700" fill="#1e293b">${esc(centerValue ?? '')}</text>
    ${centerValue ? `<text x="${size / 2}" y="${size / 2 + 14}" text-anchor="middle" font-size="8.5" fill="#94a3b8">${esc(centerLabel ?? '')}</text>` : ''}`;
  const legend = safe
    .map(
      (seg) => `<div style="font-size:10px; color:#475569; margin-bottom:6px;">
        <span style="display:inline-block; width:8px; height:8px; border-radius:4px; background:${seg.color}; margin-right:5px;"></span>
        ${esc(seg.label)} · <b>${valueFormat(seg.value)}</b> · ${total > 0 ? ((seg.value / total) * 100).toFixed(0) : 0}%
      </div>`
    )
    .join('');
  return `
    <div style="display:flex; align-items:center; gap:20px;">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">${circles}${center}</svg>
      <div>${legend}</div>
    </div>`;
}

/** Horizontal bar rows (tenant status / property-wise). */
function hbarsHtml(rows: { label: string; value: number; color: string; display: string; sub?: string }[]): string {
  const max = Math.max(1, ...rows.map((r) => (Number.isFinite(r.value) ? Math.max(0, r.value) : 0)));
  return rows
    .map((r) => {
      const v = Number.isFinite(r.value) ? Math.max(0, r.value) : 0;
      const pct = Math.max((v / max) * 100, v > 0 ? 3 : 0);
      return `
      <div style="margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:3px;">
          <span style="color:#334155; font-weight:600;">${esc(r.label)}</span>
          <span style="color:#64748b;">${esc(r.display)}${r.sub ? ` · ${esc(r.sub)}` : ''}</span>
        </div>
        <div style="background:#f1f5f9; border-radius:4px; height:8px; overflow:hidden;">
          <div style="width:${pct.toFixed(1)}%; background:${r.color}; border-radius:4px; height:8px;"></div>
        </div>
      </div>`;
    })
    .join('');
}

const chartCard = (title: string, body: string, full = false) => `
  <div class="chartcard ${full ? 'full' : 'half'}">
    <div class="charttitle">${esc(title)}</div>
    ${body}
  </div>`;

// ─────────────────────────────────────────────────────────────────────────────

export async function generateOwnerReportPdf(data: OwnerReportData): Promise<void> {
  const rows = data.items
    .map(
      (e) => `
      <tr>
        <td>${e.expenseDate ?? ''}</td>
        <td>${CATEGORY_LABEL[e.category] ?? e.category}</td>
        <td>${e.title ?? '—'}</td>
        <td>${typeof e.propertyId === 'object' && e.propertyId ? e.propertyId.name : '—'}</td>
        <td class="num">${formatINR(e.amount)}</td>
      </tr>`
    )
    .join('');

  const a = data.analytics;
  const L = data.labels;
  let chartsHtml = '';
  if (a && L) {
    const parts: string[] = [];

    // 1. Monthly rent collection (full width)
    if (a.collectionTrend.length > 0) {
      parts.push(
        chartCard(
          L.monthlyCollection,
          groupedBarSvg(
            a.collectionTrend.map((m) => ({ label: shortMonth(m.month), values: [m.collected, m.pending] })),
            [COLORS.success, COLORS.error]
          ) + `<div style="margin-top:6px;">${legendHtml([{ label: L.collected, color: COLORS.success }, { label: L.pending, color: COLORS.error }])}</div>`,
          true
        )
      );
    }

    // 2. Paid vs pending (donut)
    if (a.paidVsPending.paid > 0 || a.paidVsPending.pending > 0) {
      parts.push(
        chartCard(
          L.paidVsPending,
          donutHtml(
            [
              { label: L.paid, value: a.paidVsPending.paid, color: COLORS.success },
              { label: L.pending, value: a.paidVsPending.pending, color: COLORS.error },
            ],
            L.overall
          )
        )
      );
    }

    // 3. Occupancy (donut)
    if (a.occupancy.totalRooms > 0) {
      parts.push(
        chartCard(
          L.occupancy,
          donutHtml(
            [
              { label: L.occupied, value: a.occupancy.occupiedRooms, color: COLORS.primary },
              { label: L.vacant, value: a.occupancy.vacantRooms, color: COLORS.neutral },
            ],
            L.occupancyRate,
            `${a.occupancy.occupancyRate}%`,
            (n) => `${n}`
          )
        )
      );
    }

    // 4. Pending rent trend
    if (a.collectionTrend.length > 1) {
      parts.push(
        chartCard(L.pendingTrend, lineChartSvg(a.collectionTrend.map((m) => ({ label: shortMonth(m.month), value: m.pending })), COLORS.error))
      );
    }

    // 5. Income trend
    if (a.incomeTrend.length > 1) {
      parts.push(
        chartCard(L.incomeTrend, lineChartSvg(a.incomeTrend.map((m) => ({ label: shortMonth(m.month), value: m.income })), COLORS.primary))
      );
    }

    // 6. Tenant payment status
    const tps = a.tenantPaymentStatus;
    if (tps.paid + tps.partial + tps.pending + tps.overdue > 0) {
      parts.push(
        chartCard(
          L.tenantStatus,
          hbarsHtml([
            { label: L.paid, value: tps.paid, color: COLORS.success, display: String(tps.paid) },
            { label: L.partial, value: tps.partial, color: COLORS.warning, display: String(tps.partial) },
            { label: L.pending, value: tps.pending, color: COLORS.neutral, display: String(tps.pending) },
            { label: L.overdue, value: tps.overdue, color: COLORS.error, display: String(tps.overdue) },
          ])
        )
      );
    }

    // 7. Payment method distribution
    if (a.paymentMethods.length > 0) {
      parts.push(
        chartCard(
          L.paymentMethods,
          donutHtml(
            a.paymentMethods.map((m, i) => ({
              label: PAYMENT_METHOD_LABEL[m.method] ?? m.method,
              value: m.amount,
              color: METHOD_COLORS[i % METHOD_COLORS.length],
            })),
            L.collected
          )
        )
      );
    }

    // 8. Property-wise rent collection (full width)
    if (a.propertyCollection.length > 0) {
      parts.push(
        chartCard(
          L.propertyCollection,
          hbarsHtml(
            a.propertyCollection.map((p) => ({
              label: p.name,
              value: p.collected,
              color: COLORS.success,
              display: formatINR(p.collected),
              sub: p.pending > 0 ? `${formatINR(p.pending)} ${L.pending.toLowerCase()}` : undefined,
            }))
          ),
          true
        )
      );
    }

    // 9. Property-wise occupancy (full width)
    if (a.propertyOccupancy.length > 0) {
      parts.push(
        chartCard(
          L.propertyOccupancy,
          hbarsHtml(
            a.propertyOccupancy.map((p) => ({
              label: p.name,
              value: p.occupancyRate,
              color: p.occupancyRate >= 100 ? COLORS.success : p.occupancyRate > 0 ? COLORS.primary : COLORS.neutral,
              display: `${p.occupancyRate}%`,
              sub: `${p.occupiedRooms}/${p.totalRooms}`,
            }))
          ),
          true
        )
      );
    }

    if (parts.length > 0) {
      chartsHtml = `
        <h3 class="sectionh">Analytics</h3>
        <div>${parts.join('')}</div>
        <div style="clear:both;"></div>`;
    }
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #1e293b; background-color: #f8fafc; }
        .box { max-width: 760px; margin: auto; background: white; padding: 32px; border-radius: 12px; border: 1px solid #e2e8f0; }
        .header { background: #4B6BED; color: white; padding: 24px; border-radius: 8px; margin-bottom: 28px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .header p { margin: 6px 0 0 0; opacity: 0.85; font-size: 13px; }
        .summary { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 24px; }
        .card { flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; text-align: center; }
        .card .lbl { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.4px; }
        .card .val { font-size: 20px; font-weight: 800; margin-top: 4px; }
        .income { color: #16a34a; } .expense { color: #ef4444; } .profit { color: #4B6BED; }
        .sectionh { font-size: 14px; margin: 22px 0 10px; color: #334155; }
        .chartcard { border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin: 0 0 14px 0; page-break-inside: avoid; box-sizing: border-box; }
        .chartcard.half { display: inline-block; width: 48.5%; vertical-align: top; margin-right: 1%; }
        .chartcard.full { display: block; width: 100%; }
        .charttitle { font-size: 12px; font-weight: 700; color: #334155; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.3px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { background: #f1f5f9; text-align: left; padding: 8px; color: #475569; text-transform: uppercase; font-size: 10px; letter-spacing: 0.4px; }
        td { padding: 8px; border-bottom: 1px solid #f1f5f9; }
        .num { text-align: right; font-weight: 600; }
        .footer { margin-top: 32px; text-align: center; font-size: 11px; color: #94a3b8; }
      </style>
    </head>
    <body>
      <div class="box">
        <div class="header">
          <h1>Happy Renting</h1>
          <p>Monthly Report — ${data.monthLabel} · ${data.propertyName}</p>
        </div>
        <div class="summary">
          <div class="card"><div class="lbl">Rent Collected</div><div class="val income">${formatINR(data.income)}</div></div>
          <div class="card"><div class="lbl">Expenses</div><div class="val expense">${formatINR(data.expenses)}</div></div>
          <div class="card"><div class="lbl">Net Profit</div><div class="val profit">${formatINR(data.netProfit)}</div></div>
        </div>
        ${chartsHtml}
        <h3 class="sectionh">Expense Breakdown (${data.expenseCount})</h3>
        <table>
          <thead>
            <tr><th>Date</th><th>Category</th><th>Title</th><th>Property</th><th class="num">Amount</th></tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="5" style="text-align:center; color:#94a3b8;">No expenses recorded</td></tr>'}</tbody>
        </table>
        <div class="footer">
          Generated by Happy Renting — Property & Tenancy Management System<br/>
          Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
        </div>
      </div>
    </body>
    </html>
  `;

  const { base64 } = await Print.printToFileAsync({ html, base64: true });
  if (!base64) throw new Error('Failed to generate PDF');

  const filename = `Report_${data.month}.pdf`;
  const destinationUri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(destinationUri, base64, { encoding: FileSystem.EncodingType.Base64 });

  await Sharing.shareAsync(destinationUri, {
    mimeType: 'application/pdf',
    dialogTitle: `Monthly Report - ${data.monthLabel}`,
    UTI: 'com.adobe.pdf',
  });
}
