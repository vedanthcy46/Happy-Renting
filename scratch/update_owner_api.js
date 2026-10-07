const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'mobile', 'src', 'api', 'owner.ts');
let code = fs.readFileSync(filePath, 'utf8');

const regex1 = /export const addTenant = async \(payload: \{[\s\S]*?tempPassword\?: string;\s*\}\) => \{\s*const \{ data \} = await client\.post\('\/tenants', payload\);\s*return data;\s*\};/;
const replacement1 = `export const addTenant = async (payload: any) => {
  const isFormData = payload instanceof FormData;
  const { data } = await client.post('/tenants', payload, {
    headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
  });
  return data;
};`;

const regex2 = /export const updateTenant = async \(id: string, payload: Partial<\{[\s\S]*?idProof: string;\s*\}>\) => \{\s*const \{ data \} = await client\.patch\(\`\/tenants\/\$\{id\}\`, payload\);\s*return data;\s*\};/;
const replacement2 = `export const updateTenant = async (id: string, payload: any) => {
  const isFormData = payload instanceof FormData;
  const { data } = await client.patch(\`/tenants/\${id}\`, payload, {
    headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
  });
  return data;
};`;

code = code.replace(regex1, replacement1).replace(regex2, replacement2);
fs.writeFileSync(filePath, code);
console.log("Updated mobile owner.ts API endpoints");
