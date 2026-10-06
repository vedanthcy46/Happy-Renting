const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'backend', 'controllers', 'monthlyBillController.js');
let code = fs.readFileSync(filePath, 'utf8');

// Ensure emailService is imported
if (!code.includes("const emailService = require('../services/emailService');")) {
  code = code.replace(/const notificationService = require\('\.\.\/services\/notificationService'\);/, 
    "const notificationService = require('../services/notificationService');\nconst emailService = require('../services/emailService');");
}

// Fix publishBill
const pbRegex = /const bill = await MonthlyBill\.findById\(req\.params\.id\)\.populate\('tenantId'\)\.populate\('userId', 'name email'\);/;
const pbReplacement = `const bill = await MonthlyBill.findById(req.params.id)
      .populate({ path: 'tenantId', populate: [{ path: 'roomId' }, { path: 'propertyId' }] })
      .populate('userId', 'name email');`;
code = code.replace(pbRegex, pbReplacement);

const pbEnsureRegex = /updateTotalRent: true,\s*\}/;
const pbEnsureReplacement = `updateTotalRent: true,
          suppressNotifications: true,
        }`;
code = code.replace(pbEnsureRegex, pbEnsureReplacement);

// Fix bulkPublishBills
const bulkRegex = /const bills = await MonthlyBill\.find\(\{ _id: \{ \$in: billIds \}, status: 'DRAFT' \}\)\.populate\('tenantId'\)\.populate\('userId', 'name email'\);/;
const bulkReplacement = `const bills = await MonthlyBill.find({ _id: { $in: billIds }, status: 'DRAFT' })
        .populate({ path: 'tenantId', populate: [{ path: 'roomId' }, { path: 'propertyId' }] })
        .populate('userId', 'name email');`;
code = code.replace(bulkRegex, bulkReplacement);

const bulkEnsureRegex = /dueDate: bill\.dueDate, updateTotalRent: true \}/;
const bulkEnsureReplacement = `dueDate: bill.dueDate, updateTotalRent: true, suppressNotifications: true }`;
code = code.replace(bulkEnsureRegex, bulkEnsureReplacement);

// Add email sending in bulkPublishBills
const bulkPushRegex = /notificationService\.sendPushNotification\(\{\s*userId: bill\.userId\._id \|\| bill\.userId,\s*i18nKey: 'bill\.generated\.title',\s*i18nBodyKey: 'bill\.generated\.body',\s*i18nVars: \{ amount: bill\.totalAmount, month: bill\.month \},\s*type: 'bill_generated',\s*data: \{ billId: bill\._id, rentRecordId: rentRecord\._id \}\s*\}\)\.catch\(\(\) => null\);/;
const bulkPushReplacement = `notificationService.sendPushNotification({
          userId: bill.userId._id || bill.userId,
          i18nKey: 'bill.generated.title',
          i18nBodyKey: 'bill.generated.body',
          i18nVars: { amount: bill.totalAmount, month: bill.month },
          type: 'bill_generated',
          data: { billId: bill._id, rentRecordId: rentRecord._id }
        }).catch(() => null);
        
        if (bill.userId && bill.userId.email) {
          emailService.sendBillGeneratedEmail({
            user: bill.userId,
            role: 'tenant',
            rentRecord: rentRecord,
            property: bill.tenantId.propertyId,
            room: bill.tenantId.roomId,
            tenantUser: bill.userId
          }).catch(err => console.error(\`[EMAIL ERROR] Failed to send bill generated email: \${err.message}\`));
        }`;
code = code.replace(bulkPushRegex, bulkPushReplacement);

// Do the same for publishBill
const pubPushRegex = /notificationService\.sendPushNotification\(\{\s*userId: bill\.userId\._id \|\| bill\.userId,\s*i18nKey: 'bill\.generated\.title',\s*i18nBodyKey: 'bill\.generated\.body',\s*i18nVars: \{ amount: bill\.totalAmount, month: bill\.month \},\s*type: 'bill_generated',\s*data: \{ billId: bill\._id, rentRecordId: rentRecord\._id \}\s*\}\)\.catch\(\(\) => null\);/;
const pubPushReplacement = `notificationService.sendPushNotification({
        userId: bill.userId._id || bill.userId,
        i18nKey: 'bill.generated.title',
        i18nBodyKey: 'bill.generated.body',
        i18nVars: { amount: bill.totalAmount, month: bill.month },
        type: 'bill_generated',
        data: { billId: bill._id, rentRecordId: rentRecord._id }
      }).catch(() => null);
      
      if (bill.userId && bill.userId.email) {
        emailService.sendBillGeneratedEmail({
          user: bill.userId,
          role: 'tenant',
          rentRecord: rentRecord,
          property: bill.tenantId.propertyId,
          room: bill.tenantId.roomId,
          tenantUser: bill.userId
        }).catch(err => console.error(\`[EMAIL ERROR] Failed to send bill generated email: \${err.message}\`));
      }`;
code = code.replace(pubPushRegex, pubPushReplacement);

fs.writeFileSync(filePath, code);
console.log("Updated monthlyBillController to send emails.");
