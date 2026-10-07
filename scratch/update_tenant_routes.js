const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'backend', 'routes', 'tenantRoutes.js');
let code = fs.readFileSync(filePath, 'utf8');

const replacement = `const { createUploadMiddleware } = require('../middleware/uploadMiddleware');
const validate = require('../middleware/validate');

const upload = createUploadMiddleware('tenant_docs');

router.use(authenticate);

// Tenant self-view
router.get('/my', authorize('tenant'), getMyTenancy);

router.get ('/',                authorize('superadmin', 'owner'),  getTenants);
router.get ('/:id',             authorize('superadmin', 'owner', 'tenant'), getTenant);
router.post('/',                authorize('superadmin', 'owner'),  upload.single('govDocument'), addTenantValidation, validate, addTenant);
router.patch('/:id',            authorize('superadmin', 'owner'),  upload.single('govDocument'), updateTenant);`;

code = code.replace(/const validate = require\('\.\.\/middleware\/validate'\);[\s\S]*?router\.patch\('\/:id',\s*authorize\('superadmin', 'owner'\),\s*updateTenant\);/m, replacement);

fs.writeFileSync(filePath, code);
console.log("Updated tenantRoutes");
