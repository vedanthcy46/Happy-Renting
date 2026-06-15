import React, { useEffect, useState, useCallback } from 'react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/common/LoadingSpinner';

const AuditLogPage = () => {
  const toast = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLogs = useCallback(async (pageNum) => {
    try {
      setLoading(true);
      const res = await api.get(/system/audit-logs?page= + pageNum + &limit=20);
      setLogs(res.data.logs || []);
      setTotalPages(res.data.pages || 1);
      setPage(res.data.page || 1);
    } catch (err) {
      toast.error(err.message || 'Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchLogs(page);
  }, [fetchLogs, page]);

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Ledger Audit Log</h1>
          <p className="text-slate-400 text-sm mt-1">System activity and automated rent calculations</p>
        </div>
      </div>

      <div className="card table-wrapper">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date / Time</th>
                <th>Tenant</th>
                <th>Trigger Source</th>
                <th>Version Change</th>
                <th>Months Affected</th>
                <th>Before Totals</th>
                <th>After Totals</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="text-center py-12">
                    <LoadingSpinner size="md" />
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-12 text-slate-500 italic">
                    No audit logs found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log._id}>
                    <td className="font-mono text-xs text-slate-300">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="font-medium text-white">
                      {log.tenantId?.userId?.name || 'Unknown'}
                      <br />
                      <span className="text-[10px] text-slate-500 font-mono">
                        {log.tenantId?.userId?.email || 'N/A'}
                      </span>
                    </td>
                    <td>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-500/10 text-slate-400 border border-slate-500/20">
                        {log.triggerSource}
                      </span>
                    </td>
                    <td className="text-xs font-mono text-slate-300">
                      v{log.oldVersion} → v{log.newVersion}
                    </td>
                    <td className="text-xs text-slate-400">
                      {log.monthsAffected?.join(', ') || 'None'}
                    </td>
                    <td className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
                      Rent: ₹{log.beforeTotals?.totalRent || 0} <br/>
                      Paid: ₹{log.beforeTotals?.totalPaid || 0} <br/>
                      Rem: ₹{log.beforeTotals?.remainingAmount || 0}
                    </td>
                    <td className="text-[10px] font-mono text-slate-300 whitespace-nowrap">
                      Rent: ₹{log.afterTotals?.totalRent || 0} <br/>
                      Paid: ₹{log.afterTotals?.totalPaid || 0} <br/>
                      Rem: ₹{log.afterTotals?.remainingAmount || 0}
                    </td>
                    <td className="text-xs font-mono text-slate-400 text-right">
                      {log.durationMs}ms
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-secondary py-1 px-3 text-xs"
          >
            Previous
          </button>
          <span className="text-xs text-slate-400">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="btn-secondary py-1 px-3 text-xs"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default AuditLogPage;
