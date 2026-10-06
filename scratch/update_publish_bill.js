const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'backend', 'controllers', 'monthlyBillController.js');
let code = fs.readFileSync(filePath, 'utf8');

const regex = /const bill = await MonthlyBill\.findById\(req\.params\.billId\)\s*\.populate\('tenantId'\)\s*\.populate\('userId', 'name email'\);/;
const replacement = `const bill = await MonthlyBill.findById(req.params.billId)
      .populate({ path: 'tenantId', populate: [{ path: 'roomId' }, { path: 'propertyId' }] })
      .populate('userId', 'name email');`;

code = code.replace(regex, replacement);

const emailRegex = /notificationService\.sendPushNotification\(\{\s*userId: bill\.userId\._id \|\| bill\.userId,\s*i18nKey: 'bill\.generated\.title',\s*i18nBodyKey: 'bill\.generated\.body',\s*i18nVars: \{ amount: bill\.totalAmount, month: bill\.month \},\s*type: 'bill_generated',\s*data: \{ billId: bill\._id, rentRecordId: rentRecord\._id \}\s*\}\)\.catch\(\(\) => null\);\s*res\.json\(\{ success: true, message: 'Bill published', bill \}\);/;

const emailReplacement = `notificationService.sendPushNotification({
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
    }
    
    res.json({ success: true, message: 'Bill published', bill });`;

code = code.replace(emailRegex, emailReplacement);
fs.writeFileSync(filePath, code);
console.log("Updated publishBill");
