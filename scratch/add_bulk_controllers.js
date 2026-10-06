const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'backend', 'controllers', 'monthlyBillController.js');
let code = fs.readFileSync(filePath, 'utf8');

const newMethods = `const bulkPublishBills = async (req, res, next) => {
  try {
    const { billIds } = req.body;
    if (!Array.isArray(billIds) || billIds.length === 0) return res.status(400).json({ success: false, message: 'No bills specified' });
    const bills = await MonthlyBill.find({ _id: { $in: billIds }, status: 'DRAFT' }).populate('tenantId').populate('userId', 'name email');
    
    if (req.user.role === 'owner') {
      const unauth = bills.some(b => String(b.ownerId) !== String(req.user._id));
      if (unauth) return res.status(403).json({ success: false, message: 'Access denied to some bills' });
    }

    const publishedIds = [];
    for (const bill of bills) {
      if (bill.items.length === 0) continue;
      const rentRecord = await paymentServiceV2.ensureMonthlyRentRecord(
        bill.tenantId._id || bill.tenantId,
        bill.month,
        bill.totalAmount,
        { notes: \`Bill generated with \${bill.items.length} line items\`, allowVacated: true, tenant: bill.tenantId, dueDate: bill.dueDate, updateTotalRent: true }
      );
      if (rentRecord.totalRent !== bill.totalAmount) {
        rentRecord.totalRent = bill.totalAmount;
        rentRecord.fullRentAmount = bill.totalAmount;
        rentRecord.rentAmountAtGeneration = bill.totalAmount;
        await rentRecord.save();
      }
      bill.rentRecordId = rentRecord._id;
      bill.isPublished = true;
      bill.publishedAt = new Date();
      bill.status = 'PENDING';
      await bill.save();
      notificationService.sendPushNotification({
        userId: bill.userId._id || bill.userId,
        i18nKey: 'bill.generated.title',
        i18nBodyKey: 'bill.generated.body',
        i18nVars: { amount: bill.totalAmount, month: bill.month },
        type: 'bill_generated',
        data: { billId: bill._id, rentRecordId: rentRecord._id }
      }).catch(() => null);
      publishedIds.push(bill._id);
    }
    res.json({ success: true, message: \`\${publishedIds.length} bills published\`, publishedIds });
  } catch (err) {
    next(err);
  }
};

const bulkDeleteBills = async (req, res, next) => {
  try {
    const { billIds } = req.body;
    if (!Array.isArray(billIds) || billIds.length === 0) return res.status(400).json({ success: false, message: 'No bills specified' });
    const query = { _id: { $in: billIds }, status: 'DRAFT' };
    if (req.user.role === 'owner') query.ownerId = req.user._id;
    const result = await MonthlyBill.deleteMany(query);
    res.json({ success: true, message: \`\${result.deletedCount} draft bills deleted\` });
  } catch (err) {
    next(err);
  }
};

module.exports = {`;

code = code.replace('module.exports = {', newMethods);
code = code.replace('deleteRecurringCharge,', 'deleteRecurringCharge,\n  bulkPublishBills,\n  bulkDeleteBills,');

fs.writeFileSync(filePath, code);
console.log("Bulk controllers added.");
