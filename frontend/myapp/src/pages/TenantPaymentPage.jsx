import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/common/LoadingSpinner';

const TenantPaymentPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [proofFile, setProofFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');

  const fetchPaymentDetails = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch all payments for tenant, then find this one
      const { data } = await api.get('/payments');
      const found = data.payments?.find(p => p._id === id);
      if (!found) {
        toast.error('Payment not found.');
        navigate('/payments');
        return;
      }
      setPayment(found);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [id, navigate, toast]);

  useEffect(() => {
    fetchPaymentDetails();
  }, [fetchPaymentDetails]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        return toast.error('File size exceeds 2MB limit.');
      }
      setProofFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleUploadProof = async (e) => {
    e.preventDefault();
    if (!proofFile) return toast.error('Please select an image first.');
    
    setSubmitting(true);
    const formData = new FormData();
    formData.append('image', proofFile);

    try {
      await api.post(`/payments/${payment._id}/upload-proof`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Payment proof uploaded! Waiting for owner verification.');
      navigate('/payments');
    } catch (err) {
      toast.error(err.message || 'Upload failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>;
  if (!payment) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
      <div>
        <button onClick={() => navigate(-1)} className="text-brand-400 hover:text-brand-300 text-sm font-bold flex items-center gap-1 mb-4">
          ← Back
        </button>
        <h1 className="page-title">Make a Payment</h1>
        <p className="text-slate-400 text-sm mt-1">Pay your rent and upload the proof.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Payment Details */}
        <div className="space-y-6">
          <div className="card p-6 border-brand-500/20 bg-brand-500/5">
            <h3 className="text-white font-bold mb-4 uppercase text-xs tracking-wider">Payment Details</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Month</span>
                <span className="text-white font-bold">{payment.month}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Due Date</span>
                <span className="text-white">{payment.dueDate ? new Date(payment.dueDate).toLocaleDateString() : '—'}</span>
              </div>
              <div className="flex justify-between items-center text-lg border-t border-slate-700 pt-4">
                <span className="text-slate-300">Amount Due</span>
                <span className="text-brand-400 font-bold">₹{payment.amount?.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="text-white font-bold mb-4 uppercase text-xs tracking-wider">Owner Payment Info</h3>
            {payment.ownerId?.qrCodeImage?.secureUrl ? (
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="w-48 h-48 bg-white p-2 rounded-xl shadow-glow">
                  <img src={payment.ownerId.qrCodeImage.secureUrl} alt="Owner QR Code" className="w-full h-full object-contain" />
                </div>
                <p className="text-sm font-bold text-slate-300">Scan to Pay via UPI</p>
              </div>
            ) : (
              <div className="text-center py-6 text-slate-500 italic text-sm border border-dashed border-slate-700 rounded-xl">
                No QR Code available.
              </div>
            )}
            
            {(payment.ownerId?.upiId || payment.ownerId?.upiNumber) && (
              <div className="mt-6 space-y-3 bg-surface border border-surface-border p-4 rounded-xl">
                {payment.ownerId.upiId && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 text-sm">UPI ID:</span>
                    <span className="text-white text-sm font-mono">{payment.ownerId.upiId}</span>
                  </div>
                )}
                {payment.ownerId.upiNumber && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 text-sm">UPI Number:</span>
                    <span className="text-white text-sm font-mono">{payment.ownerId.upiNumber}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Upload Proof */}
        <div className="card p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-white font-bold mb-4 uppercase text-xs tracking-wider flex items-center gap-2">
              <span className="text-brand-400">🧾</span> Upload Proof
            </h3>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              After transferring the amount, please take a screenshot of the successful transaction and upload it here for the owner to verify.
            </p>

            <form onSubmit={handleUploadProof} className="space-y-6">
              <div className="border-2 border-dashed border-slate-700 rounded-xl p-6 text-center hover:bg-surface-card transition-colors">
                <input 
                  type="file" 
                  id="proof-upload" 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleFileChange}
                />
                <label htmlFor="proof-upload" className="cursor-pointer flex flex-col items-center justify-center space-y-3">
                  {previewUrl ? (
                    <img src={previewUrl} alt="Preview" className="max-h-48 rounded object-contain border border-surface-border shadow-md" />
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-full bg-surface-border flex items-center justify-center text-slate-400">
                        📁
                      </div>
                      <span className="text-brand-400 text-sm font-bold">Select Image</span>
                      <span className="text-slate-500 text-xs">JPG, PNG up to 2MB</span>
                    </>
                  )}
                </label>
              </div>
              
              <button 
                type="submit" 
                disabled={submitting || !proofFile} 
                className={`btn-primary w-full ${!proofFile ? 'opacity-50 cursor-not-allowed' : 'shadow-glow'}`}
              >
                {submitting ? <LoadingSpinner size="sm" label="" /> : null}
                {submitting ? 'Uploading...' : 'Submit Payment Proof'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TenantPaymentPage;
