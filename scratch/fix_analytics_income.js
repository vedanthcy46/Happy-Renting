const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'backend', 'controllers', 'analyticsController.js');
let code = fs.readFileSync(filePath, 'utf8');

const oldIncome = `    // ── Income trend (actual completed cash) ──
    const monthBounds = keys.map((k) => ({ key: k, ...monthRange(k) }));
    const incomeAgg = await PaymentTransaction.aggregate([
      {
        $match: {
          ...txnMatch,
          status: 'completed',
          amount: { $gt: 0 },
          transactionType: { $nin: NON_CASH_TRANSACTION_TYPES },
          paymentDate: {
            $gte: monthBounds[monthBounds.length - 1].start,
            $lt: monthBounds[0].end,
          },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$paymentDate' },
            month: { $month: '$paymentDate' },
          },
          income: { $sum: '$amount' },
        },
      },
    ]);

    const incomeMap = new Map();
    for (const row of incomeAgg) {
      const key = \`\${row._id.year}-\${String(row._id.month).padStart(2, '0')}\`;
      incomeMap.set(key, row.income);
    }
    const incomeTrend = [...keys].reverse().map((key) => ({
      month: key,
      income: incomeMap.get(key) || 0,
    }));`;

const newIncome = `    // ── Income trend ──
    // Group by the BILLING MONTH of the associated rent record, NOT by the
    // calendar date the payment was made. This prevents a September bill paid
    // in October from inflating October and deflating September.
    const incomeAgg = await PaymentTransaction.aggregate([
      {
        $match: {
          ...txnMatch,
          status: 'completed',
          amount: { $gt: 0 },
          transactionType: { $nin: NON_CASH_TRANSACTION_TYPES },
          rentRecordId: { $ne: null },
        },
      },
      {
        $lookup: {
          from: 'monthlyrentrecords',
          localField: 'rentRecordId',
          foreignField: '_id',
          as: 'rentRecord',
        },
      },
      { $unwind: { path: '$rentRecord', preserveNullAndEmptyArrays: false } },
      { $match: { 'rentRecord.month': { $in: keys } } },
      {
        $group: {
          _id: '$rentRecord.month',
          income: { $sum: '$amount' },
        },
      },
    ]);

    // Legacy: payments with no rentRecordId are grouped by paymentDate (fallback)
    const monthBounds = keys.map((k) => ({ key: k, ...monthRange(k) }));
    const legacyIncomeAgg = await PaymentTransaction.aggregate([
      {
        $match: {
          ...txnMatch,
          status: 'completed',
          amount: { $gt: 0 },
          transactionType: { $nin: NON_CASH_TRANSACTION_TYPES },
          rentRecordId: null,
          paymentDate: {
            $gte: monthBounds[monthBounds.length - 1].start,
            $lt: monthBounds[0].end,
          },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$paymentDate' },
            month: { $month: '$paymentDate' },
          },
          income: { $sum: '$amount' },
        },
      },
    ]);

    const incomeMap = new Map();
    for (const row of legacyIncomeAgg) {
      const key = \`\${row._id.year}-\${String(row._id.month).padStart(2, '0')}\`;
      incomeMap.set(key, (incomeMap.get(key) || 0) + row.income);
    }
    for (const row of incomeAgg) {
      incomeMap.set(row._id, (incomeMap.get(row._id) || 0) + row.income);
    }
    const incomeTrend = [...keys].reverse().map((key) => ({
      month: key,
      income: incomeMap.get(key) || 0,
    }));`;

if (!code.includes(oldIncome.trim().slice(0, 60))) {
  console.error("Target not found! First 60 chars of target:", oldIncome.trim().slice(0, 60));
  process.exit(1);
}

code = code.replace(oldIncome, newIncome);
fs.writeFileSync(filePath, code);
console.log("Fixed income trend to group by billing month.");
