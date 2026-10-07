const fs = require('fs');
const path = require('path');

// 1. Update tenantController.js - addTenant
let ctrlPath = path.join(__dirname, '..', 'backend', 'controllers', 'tenantController.js');
let ctrlCode = fs.readFileSync(ctrlPath, 'utf8');

// For addTenant
const addTenantRegex = /const ownerId = req\.user\.role === 'owner'[\s\S]*?\?\s*req\.user\._id\s*:\s*req\.body\.ownerId;\s*\/\/\s*superadmin can specify ownerId/;
const addTenantReplacement = `const ownerId = req.user.role === 'owner'
      ? req.user._id
      : req.body.ownerId;   // superadmin can specify ownerId

    let govDocument = undefined;
    if (req.file) {
      govDocument = {
        secureUrl: req.file.path,
        publicId: req.file.filename,
      };
    }`;

ctrlCode = ctrlCode.replace(addTenantRegex, addTenantReplacement);

const moveInCallRegex = /customBillingDay, isMigratedTenant, bedId,\s*tempPassword: req\.body\.tempPassword \|\| req\.body\.password\s*\}/;
const moveInCallReplacement = `customBillingDay, isMigratedTenant, bedId, govDocument,
          tempPassword: req.body.tempPassword || req.body.password 
        }`;
ctrlCode = ctrlCode.replace(moveInCallRegex, moveInCallReplacement);

// For updateTenant
const updateTenantRegex = /const \{\s*roomId,\s*joinDate,\s*exitDate,\s*notes,\s*phone,\s*idProof,\s*advancePaid,\s*coOccupants,\s*customBillingDay,\s*bedId\s*\}\s*=\s*req\.body;/;
const updateTenantReplacement = `const { 
      roomId, joinDate, exitDate, notes, phone, idProof, 
      advancePaid, coOccupants, customBillingDay, bedId 
    } = req.body;

    let govDocument = undefined;
    if (req.file) {
      govDocument = {
        secureUrl: req.file.path,
        publicId: req.file.filename,
      };
    }`;
ctrlCode = ctrlCode.replace(updateTenantRegex, updateTenantReplacement);

const updateServiceCallRegex = /idProof,\s*advancePaid,\s*coOccupants,\s*customBillingDay,\s*bedId\s*\},/;
const updateServiceCallReplacement = `idProof, advancePaid, coOccupants, customBillingDay, bedId, govDocument },`;
ctrlCode = ctrlCode.replace(updateServiceCallRegex, updateServiceCallReplacement);

fs.writeFileSync(ctrlPath, ctrlCode);
console.log("Updated tenantController.js");

// 2. Update tenantService.js - moveIn
let srvPath = path.join(__dirname, '..', 'backend', 'services', 'tenantService.js');
let srvCode = fs.readFileSync(srvPath, 'utf8');

const srvMoveInRegex = /phone, idProof, coOccupants = \[\], customBillingDay, isMigratedTenant, bedId\s*\} = params;/;
const srvMoveInReplacement = `phone, idProof, coOccupants = [], customBillingDay, isMigratedTenant, bedId, govDocument
  } = params;`;
srvCode = srvCode.replace(srvMoveInRegex, srvMoveInReplacement);

const tenantCreateRegex = /phone,\s*idProof,\s*customBillingDay,\s*bedId:\s*assignedBedId,\s*\}\]/;
const tenantCreateReplacement = `phone,
        idProof,
        customBillingDay,
        bedId: assignedBedId,
        govDocument,
      }]`;
srvCode = srvCode.replace(tenantCreateRegex, tenantCreateReplacement);

// Update tenantService.js - updateTenantDetails
const srvUpdateRegex = /phone, idProof, advancePaid, coOccupants, customBillingDay, bedId\s*\} = params;/;
const srvUpdateReplacement = `phone, idProof, advancePaid, coOccupants, customBillingDay, bedId, govDocument
  } = params;`;
srvCode = srvCode.replace(srvUpdateRegex, srvUpdateReplacement);

const tenantUpdateFieldsRegex = /if \(idProof !== undefined\) tenant\.idProof = idProof;/;
const tenantUpdateFieldsReplacement = `if (idProof !== undefined) tenant.idProof = idProof;
    if (govDocument !== undefined) tenant.govDocument = govDocument;`;
srvCode = srvCode.replace(tenantUpdateFieldsRegex, tenantUpdateFieldsReplacement);

fs.writeFileSync(srvPath, srvCode);
console.log("Updated tenantService.js");

