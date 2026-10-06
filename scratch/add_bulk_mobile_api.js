const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'mobile', 'src', 'api', 'billing.ts');
let code = fs.readFileSync(filePath, 'utf8');

const newExports = `export const bulkPublishBills = async (billIds: string[]): Promise<{ success: boolean; publishedIds: string[] }> => {
  const { data } = await client.post('/v2/bills/bulk-publish', { billIds });
  return data;
};

export const bulkDeleteBills = async (billIds: string[]): Promise<{ success: boolean }> => {
  const { data } = await client.post('/v2/bills/bulk-delete', { billIds });
  return data;
};

// "?"? Recurring Charges`;

code = code.replace('// "?"? Recurring Charges', newExports);

fs.writeFileSync(filePath, code);
console.log("Added bulk APIs to mobile billing.ts");
