import React, { useEffect, useState, useCallback } from 'react';
import { useToast } from '../context/ToastContext';
import api from '../api/axios';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Modal from '../components/common/Modal';

const CATEGORIES = {
  maintenance: 'Maintenance',
  electricity: 'Electricity',
  water: 'Water',
  society: 'Society Fee',
  repairs: 'Repairs',
  cleaning: 'Cleaning',
  internet: 'Internet',
  misc: 'Miscellaneous',
};

const categoryColor = (cat) => {
  const colors = {
    maintenance: 'text-orange-400 bg-orange-500/10',
    electricity: 'text-yellow-400 bg-yellow-500/10',
    water: 'text-blue-400 bg-blue-500/10',
    society: 'text-purple-400 bg-purple-500/10',
    repairs: 'text-red-400 bg-red-500/10',
    cleaning: 'text-teal-400 bg-teal-500/10',
    internet: 'text-indigo-400 bg-indigo-500/10',
    misc: 'text-slate-400 bg-slate-500/10',
  };
  return colors[cat] || colors.misc;
};

const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const formatMonthLabel = (month) => {
  const [y, m] = month.split('-').map(Number);
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${names[m - 1]} ${y}`;
};

const emptyForm = (month) => ({
  propertyId: '',
  category: 'misc',
  title: '',
  amount: '',
  month,
  isRecurring: false,
  notes: '',
});

const ExpensesPage = () => {
  const toast = useToast();

  const [properties, setProperties] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [summary, setSummary] = useState(null);
  const [month, setMonth] = useState(currentMonth());
  const [propertyFilter, setPropertyFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [modal, setModal] = useState({ open: false, editing: null, form: emptyForm(currentMonth()) });
  const [expenseDate, setExpenseDate] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('month', month);
      if (propertyFilter) params.append('propertyId', propertyFilter);

      const [expRes, recRes, sumRes, propRes] = await Promise.all([
        api.get(`/v2/expenses?${params.toString()}`),
        api.get('/v2/expenses/recurring'),
        api.get(`/v2/expenses/summary?${params.toString()}`),
        api.get('/properties'),
      ]);

      setExpenses(expRes.data.expenses || []);
      setRecurring(recRes.data.expenses || []);
      setSummary(sumRes.data.summary);
      setProperties(propRes.data.properties || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }, [month, propertyFilter, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openAdd = () => {
    setModal({ open: true, editing: null, form: emptyForm(month) });
    setExpenseDate('');
  };

  const openEdit = (expense) => {
    setModal({
      open: true,
      editing: expense,
      form: {
        propertyId: expense.propertyId?._id || expense.propertyId,
        category: expense.category,
        title: expense.title || '',
        amount: String(expense.amount),
        month: expense.month,
        isRecurring: expense.isRecurring,
        notes: expense.notes || '',
      },
    });
    setExpenseDate(expense.expenseDate ? expense.expenseDate.slice(0, 10) : '');
  };

  const closeModal = () => {
    setModal({ open: false, editing: null, form: emptyForm(month) });
    setExpenseDate('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { form } = modal;

    if (!form.propertyId) return toast.error('Please select a property');
    const amountNum = parseFloat(form.amount);
    if (isNaN(amountNum) || amountNum <= 0) return toast.error('Please enter a valid amount');

    if (submitting) return;
    setSubmitting(true);
    try {
      const payload = {
        propertyId: form.propertyId,
        category: form.category,
        title: form.title || undefined,
        amount: amountNum,
        month: form.month,
        isRecurring: form.isRecurring,
        notes: form.notes || undefined,
      };
      if (expenseDate) payload.expenseDate = new Date(expenseDate).toISOString();

      if (modal.editing) {
        await api.patch(`/v2/expenses/${modal.editing._id}`, payload);
        toast.success('Expense updated.');
      } else {
        await api.post('/v2/expenses', payload);
        toast.success('Expense added.');
      }
      closeModal();
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to save expense');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (expense) => {
    if (!window.confirm(`Delete this ${CATEGORIES[expense.category] || 'expense'} of ₹${expense.amount.toLocaleString()}?`)) return;
    try {
      await api.delete(`/v2/expenses/${expense._id}`);
      toast.success('Expense deleted.');
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to delete expense');
    }
  };

  const logRecurring = async (exp) => {
    try {
      await api.post('/v2/expenses', {
        propertyId: exp.propertyId?._id || exp.propertyId,
        category: exp.category,
        title: exp.title || '',
        amount: exp.amount,
        month,
        isRecurring: false,
        notes: exp.notes || 'Recurring expense',
      });
      toast.success(`${CATEGORIES[exp.category] || 'Expense'} logged for ${formatMonthLabel(month)}`);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to log recurring expense');
    }
  };

  const netColor = summary ? (summary.netProfit >= 0 ? 'text-success' : 'text-red-400') : 'text-white';

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Expenses & Profit</h1>
          <p className="text-slate-400 text-sm mt-1">Track property expenses and see your net profit each month</p>
        </div>
        <button onClick={openAdd} className="btn-primary py-3 px-6 rounded-xl shadow-glow font-semibold">
          + Add Expense
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Month</label>
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="form-input w-auto"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Property</label>
          <select
            value={propertyFilter}
            onChange={e => setPropertyFilter(e.target.value)}
            className="form-input w-auto min-w-[220px]"
          >
            <option value="">All Properties</option>
            {properties.map(p => (
              <option key={p._id} value={p._id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Profit Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="card p-6 bg-gradient-to-br from-surface-card to-brand-900/10 border-brand-500/20 relative overflow-hidden group">
          <span className="text-slate-400 text-sm font-semibold uppercase tracking-wider">Rent Collected</span>
          <h2 className="text-3xl font-extrabold text-white mt-2">
            ₹{(summary?.totalIncome || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </h2>
          <p className="text-xs text-slate-500 mt-2 font-medium">Completed payments · {formatMonthLabel(summary?.month || month)}</p>
        </div>

        <div className="card p-6 bg-gradient-to-br from-surface-card to-warning/5 border-warning/10 relative overflow-hidden group">
          <span className="text-slate-400 text-sm font-semibold uppercase tracking-wider">Total Expenses</span>
          <h2 className="text-3xl font-extrabold text-warning mt-2">
            ₹{(summary?.totalExpenses || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </h2>
          <p className="text-xs text-slate-500 mt-2 font-medium">{summary?.expenseCount || 0} expense entries</p>
        </div>

        <div className="card p-6 bg-gradient-to-br from-surface-card to-success/5 border-success/10 relative overflow-hidden group">
          <span className="text-slate-400 text-sm font-semibold uppercase tracking-wider">Net Profit</span>
          <h2 className={`text-3xl font-extrabold mt-2 ${netColor}`}>
            ₹{(summary?.netProfit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </h2>
          <p className="text-xs text-slate-500 mt-2 font-medium">Collected minus expenses</p>
        </div>
      </div>

      {/* Recurring Suggestions */}
      {recurring.length > 0 && (
        <div className="card p-6 bg-surface-card border border-surface-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Recurring Expenses</h3>
            <span className="text-xs text-slate-500">Tap to log for {formatMonthLabel(month)}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {recurring.map(exp => (
              <button
                key={exp._id}
                onClick={() => logRecurring(exp)}
                className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-surface/80 border border-surface-border hover:border-brand-500/40 transition-colors text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-lg shrink-0 ${categoryColor(exp.category)}`}>
                    {CATEGORIES[exp.category] || exp.category}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{exp.title || CATEGORIES[exp.category]}</p>
                    <p className="text-xs text-slate-500 truncate">{exp.propertyId?.name || 'Property'}</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-white shrink-0">₹{exp.amount.toLocaleString()}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Expense List */}
      {loading ? (
        <div className="flex justify-center items-center min-h-[40vh]">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <div className="card bg-surface-card border border-surface-border overflow-hidden">
          <div className="px-6 py-5 border-b border-surface-border flex justify-between items-center">
            <h2 className="text-lg font-bold text-white">Expenses · {formatMonthLabel(month)}</h2>
            <span className="text-xs text-slate-500 font-mono">{expenses.length} entries</span>
          </div>

          <div className="table-wrapper rounded-none border-none overflow-x-auto">
            {expenses.length === 0 ? (
              <p className="text-center text-slate-500 py-12 italic">No expenses recorded for this month.</p>
            ) : (
              <table className="data-table min-w-[720px]">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Property</th>
                    <th>Recurring</th>
                    <th>Amount</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map(exp => (
                    <tr key={exp._id}>
                      <td className="font-mono text-xs">{new Date(exp.expenseDate).toLocaleDateString()}</td>
                      <td>
                        <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-lg ${categoryColor(exp.category)}`}>
                          {CATEGORIES[exp.category] || exp.category}
                        </span>
                      </td>
                      <td className="text-sm font-medium text-white">{exp.title || '—'}</td>
                      <td className="text-xs text-slate-400">{exp.propertyId?.name || '—'}</td>
                      <td>
                        {exp.isRecurring ? (
                          <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 px-2 py-1 rounded-lg">Monthly</span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="text-sm font-bold text-warning">₹{exp.amount.toLocaleString()}</td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(exp)}
                            className="btn-ghost p-1.5 rounded-lg text-slate-400 hover:text-brand-400 transition-colors"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(exp)}
                            className="btn-ghost p-1.5 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal isOpen={modal.open} onClose={closeModal} title={modal.editing ? 'Edit Expense' : 'Add Expense'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">Property</label>
            <select
              className="form-input"
              value={modal.form.propertyId}
              onChange={e => setModal(m => ({ ...m, form: { ...m.form, propertyId: e.target.value } }))}
            >
              <option value="">Select property</option>
              {properties.map(p => (
                <option key={p._id} value={p._id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Category</label>
              <select
                className="form-input"
                value={modal.form.category}
                onChange={e => setModal(m => ({ ...m, form: { ...m.form, category: e.target.value } }))}
              >
                {Object.entries(CATEGORIES).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Amount (₹)</label>
              <input
                type="number"
                min="0.01"
                step="any"
                className="form-input"
                placeholder="e.g. 1500"
                value={modal.form.amount}
                onChange={e => setModal(m => ({ ...m, form: { ...m.form, amount: e.target.value } }))}
              />
            </div>
          </div>

          <div>
            <label className="form-label">Description (optional)</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Fan repair, quarterly society"
              value={modal.form.title}
              onChange={e => setModal(m => ({ ...m, form: { ...m.form, title: e.target.value } }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Month</label>
              <input
                type="month"
                className="form-input"
                value={modal.form.month}
                onChange={e => setModal(m => ({ ...m, form: { ...m.form, month: e.target.value } }))}
              />
            </div>
            <div>
              <label className="form-label">Expense Date</label>
              <input
                type="date"
                className="form-input"
                value={expenseDate}
                onChange={e => setExpenseDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="form-label">Notes (optional)</label>
            <textarea
              className="form-input"
              rows="2"
              placeholder="Any extra details"
              value={modal.form.notes}
              onChange={e => setModal(m => ({ ...m, form: { ...m.form, notes: e.target.value } }))}
            />
          </div>

          <label className="flex items-center gap-3 text-sm text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={modal.form.isRecurring}
              onChange={e => setModal(m => ({ ...m, form: { ...m.form, isRecurring: e.target.checked } }))}
              className="w-4 h-4 accent-brand-600"
            />
            <span>Recurring monthly expense (re-suggested each month)</span>
          </label>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={closeModal} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary flex-1">
              {submitting ? 'Saving…' : modal.editing ? 'Save Changes' : 'Add Expense'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ExpensesPage;
