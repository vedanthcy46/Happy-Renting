import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

interface ReceiptData {
  tenantName: string;
  propertyName: string;
  roomNumber: string;
  month: string;
  totalRent: number;
  totalPaid: number;
  paidDate: string;
  ownerName: string;
  transactionId?: string;
}

export async function generateAndShareReceipt(data: ReceiptData): Promise<void> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #1e293b; background-color: #f8fafc; }
        .receipt-box { max-width: 600px; margin: auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); border: 1px solid #e2e8f0; }
        .header { background: #4B6BED; color: white; padding: 24px; border-radius: 8px; margin-bottom: 32px; text-align: center; }
        .header h1 { margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.5px; }
        .header p { margin: 6px 0 0 0; opacity: 0.85; font-size: 14px; }
        .row { display: flex; justify-content: space-between; padding: 14px 0; border-bottom: 1px dashed #e2e8f0; }
        .label { color: #64748b; font-size: 14px; font-weight: 500; }
        .value { font-weight: 600; font-size: 14px; color: #0f172a; }
        .total-row { background: #eff6ff; padding: 18px; border-radius: 8px; margin-top: 24px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #bfdbfe; }
        .total-label { color: #1e3a8a; font-size: 16px; font-weight: 750; }
        .total-value { color: #1d4ed8; font-size: 22px; font-weight: 800; }
        .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.5; }
        .badge { background: #dcfce7; color: #16a34a; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; border: 1px solid #bbf7d0; text-transform: uppercase; }
      </style>
    </head>
    <body>
      <div class="receipt-box">
        <div class="header">
          <h1>Happy Renting</h1>
          <p>Official Rent Payment Receipt</p>
        </div>
        <div class="row"><span class="label">Tenant Name</span><span class="value">${data.tenantName}</span></div>
        <div class="row"><span class="label">Property</span><span class="value">${data.propertyName}</span></div>
        <div class="row"><span class="label">Room Number</span><span class="value">Room ${data.roomNumber}</span></div>
        <div class="row"><span class="label">Rent Month</span><span class="value">${data.month}</span></div>
        <div class="row"><span class="label">Property Owner</span><span class="value">${data.ownerName}</span></div>
        <div class="row"><span class="label">Payment Date</span><span class="value">${data.paidDate}</span></div>
        ${data.transactionId ? `<div class="row"><span class="label">Transaction Reference</span><span class="value">${data.transactionId}</span></div>` : ''}
        <div class="row" style="border-bottom: none;"><span class="label">Status</span><span><span class="badge">PAID</span></span></div>
        <div class="total-row">
          <span class="total-label">Amount Paid</span>
          <span class="total-value">₹${data.totalPaid.toLocaleString('en-IN')}</span>
        </div>
        <div class="footer">
          Thank you for your payment! This is a computer-generated receipt.<br/>
          Happy Renting — Property & Tenancy Management System<br/>
          Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
        </div>
      </div>
    </body>
    </html>
  `;

  const { base64 } = await Print.printToFileAsync({ html, base64: true });
  const filename = `Receipt_${data.month.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  const destinationUri = `${FileSystem.cacheDirectory}${filename}`;
  
  if (!base64) {
    throw new Error('Failed to generate base64 PDF data.');
  }

  await FileSystem.writeAsStringAsync(destinationUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  await Sharing.shareAsync(destinationUri, {
    mimeType: 'application/pdf',
    dialogTitle: `Rent Receipt - ${data.month}`,
    UTI: 'com.adobe.pdf',
  });
}
