const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'mobile', 'src', 'api', 'billing.ts');
let code = fs.readFileSync(filePath, 'utf8');

const regex = /export const deleteBill = async \(billId: string\): Promise<\{ success: boolean \}> => \{[\s\S]*?return data;\s*\};/;

const replacement = `export const deleteBill = async (billId: string): Promise<{ success: boolean }> => {
  const { data } = await client.delete(\`/v2/bills/\${billId}\`);
  return data;
};

export const bulkPublishBills = async (billIds: string[]): Promise<{ success: boolean; publishedIds: string[] }> => {
  const { data } = await client.post('/v2/bills/bulk-publish', { billIds });
  return data;
};

export const bulkDeleteBills = async (billIds: string[]): Promise<{ success: boolean }> => {
  const { data } = await client.post('/v2/bills/bulk-delete', { billIds });
  return data;
};`;

code = code.replace(regex, replacement);

fs.writeFileSync(filePath, code);
console.log("Added bulk APIs correctly");
