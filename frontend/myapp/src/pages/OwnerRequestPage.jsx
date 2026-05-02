import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Home, ArrowLeft, Send, CheckCircle2 } from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';

const OwnerRequestPage = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    propertyName: '',
    propertyLocation: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/owner-requests', formData);
      if (res.data.success) {
        setSubmitted(true);
        showToast('Request submitted successfully!', 'success');
      }
    } catch (err) {
      showToast(err.message || 'Failed to submit request.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4 transition-colors duration-300">
        <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-3xl shadow-xl p-10 text-center border border-transparent dark:border-gray-800">
          <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Request Submitted!</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
            Thank you for your interest. Our admin team will review your request and contact you at 
            <span className="font-bold text-gray-900 dark:text-white ml-1">{formData.phone}</span> for manual verification.
          </p>
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center p-4 py-12 transition-colors duration-300">
      <div className="mb-8 flex items-center gap-2">
        <Home className="text-blue-600 dark:text-blue-400 w-6 h-6" />
        <span className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Happy Renting</span>
      </div>

      <div className="max-w-xl w-full bg-white dark:bg-gray-900 rounded-3xl shadow-xl overflow-hidden border border-transparent dark:border-gray-800">
        <div className="bg-blue-600 px-8 py-10 text-white">
          <h1 className="text-3xl font-bold mb-2">Request Owner Access</h1>
          <p className="opacity-90">Fill out the form below and start managing your properties.</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <InputField 
              label="Full Name" 
              name="name" 
              placeholder="Enter your name"
              value={formData.name}
              onChange={handleChange}
              required
            />
            <InputField 
              label="Email Address" 
              name="email" 
              type="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleChange}
              required
            />
            <InputField 
              label="Phone Number" 
              name="phone" 
              placeholder="+91 XXXXX XXXXX"
              value={formData.phone}
              onChange={handleChange}
              required
            />
            <InputField 
              label="Property Name (Optional)" 
              name="propertyName" 
              placeholder="e.g. Green Valley"
              value={formData.propertyName}
              onChange={handleChange}
            />
          </div>

          <InputField 
            label="Property Location (Optional)" 
            name="propertyLocation" 
            placeholder="City, Area, or Landmark"
            value={formData.propertyLocation}
            onChange={handleChange}
          />

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-blue-200 dark:hover:shadow-blue-900/20"
            >
              {loading ? 'Submitting...' : 'Submit Access Request'}
              {!loading && <Send className="w-5 h-5" />}
            </button>
          </div>

          <div className="text-center">
            <Link to="/" className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              Cancel and return to home
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

const InputField = ({ label, name, type = 'text', placeholder, value, onChange, required = false }) => (
  <div className="flex flex-col gap-1.5">
    <label htmlFor={name} className="text-sm font-bold text-gray-700 dark:text-gray-300 ml-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input
      id={name}
      name={name}
      type={type}
      required={required}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500"
    />
  </div>
);

export default OwnerRequestPage;
