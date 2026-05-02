import React from 'react';
import { Link } from 'react-router-dom';
import { Home, Shield, BarChart3, CreditCard, MessageSquare, ArrowRight, Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const LandingPage = () => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 transition-colors duration-300">
      {/* --- Navigation --- */}
      <nav className="fixed top-0 w-full bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <div className="bg-blue-600 p-1.5 rounded-lg">
                <Home className="text-white w-5 h-5" />
              </div>
              <span className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Happy Renting</span>
            </div>
            <div className="flex items-center gap-4">
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              <Link to="/login" className="text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                Login
              </Link>
              <Link
                to="/request-access"
                className="bg-blue-600 text-white px-5 py-2 rounded-full text-sm font-semibold hover:bg-blue-700 transition-all shadow-md hover:shadow-lg active:scale-95"
              >
                Request Owner Access
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* --- Hero Section --- */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 dark:text-white mb-6 tracking-tight">
            Effortless Rental <span className="text-blue-600">Management</span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            The all-in-one platform for property owners to track payments, manage tenants,
            and resolve complaints with ease.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              to="/request-access"
              className="bg-gray-900 dark:bg-white dark:text-gray-900 text-white px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-800 dark:hover:bg-gray-100 transition-all group"
            >
              Get Started as Owner
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to="/login"
              className="bg-white dark:bg-transparent text-gray-900 dark:text-white border-2 border-gray-200 dark:border-gray-800 px-8 py-4 rounded-xl font-bold hover:border-gray-900 dark:hover:border-white transition-all"
            >
              Member Login
            </Link>
          </div>
        </div>
      </section>

      {/* --- Features Section --- */}
      <section className="py-20 bg-gray-50 dark:bg-gray-900/50 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Everything you need to grow</h2>
            <p className="text-gray-600 dark:text-gray-400">Built for modern landlords who value efficiency and transparency.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<BarChart3 className="w-6 h-6 text-blue-600" />}
              title="Rent Tracking"
              description="Automatically generate monthly bills and track payment history for every tenant."
            />
            <FeatureCard
              icon={<CreditCard className="w-6 h-6 text-green-600" />}
              title="Payment Management"
              description="Verify online payment proofs or record cash payments with detailed receipts."
            />
            <FeatureCard
              icon={<MessageSquare className="w-6 h-6 text-purple-600" />}
              title="Complaint System"
              description="Integrated ticketing system for maintenance requests and tenant communication."
            />
          </div>
        </div>
      </section>

      {/* --- About Section --- */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-block bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 px-3 py-1 rounded-full text-sm font-bold mb-4">
              About Happy Renting
            </div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
              A Secure and Transparent Ecosystem for Tenants and Owners
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Happy Renting was built with one goal: to remove the friction from rental relationships.
              By providing a central source of truth for payments and maintenance, we help owners
              protect their investments and tenants enjoy their homes.
            </p>
            <div className="space-y-4">
              <CheckItem text="Automated Rent Reminders" />
              <CheckItem text="Real-time Analytics Dashboard" />
              <CheckItem text="Secure Data Isolation" />
            </div>
          </div>
          <div className="bg-blue-600 rounded-3xl p-10 text-white relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
            <div className="relative z-10">
              <Shield className="w-16 h-16 mb-6 opacity-80" />
              <p className="text-2xl font-bold mb-4 italic">"Transforming how rental businesses operate in the digital age."</p>
              <p className="font-medium opacity-80">— The Happy Renting Team</p>
            </div>
          </div>
        </div>
      </section>

      {/* --- Footer --- */}
      <footer className="bg-gray-900 text-gray-400 py-12 px-4 border-t border-gray-800">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-10">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Home className="text-white w-6 h-6" />
              <span className="text-xl font-bold text-white tracking-tight">Happy Renting</span>
            </div>
            <p className="text-sm">Modernizing the rental experience for everyone.</p>
          </div>
          <div>
            <h3 className="text-white font-bold mb-4 text-sm uppercase tracking-widest">Platform</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/login" className="hover:text-white transition-colors">Login</Link></li>
              <li><Link to="/request-access" className="hover:text-white transition-colors">Owner Access</Link></li>
              <li><Link to="#" className="hover:text-white transition-colors">Documentation</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-white font-bold mb-4 text-sm uppercase tracking-widest">Contact</h3>
            <ul className="space-y-2 text-sm">
              <li><a href='mailto:vedanthh46@gmail.com'>vedanthh46@gmail.com</a></li>
              <li><a href="tel: +917204778319">+91 7204778319</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-gray-800 text-center text-xs">
          © {new Date().getFullYear()} Happy Renting Platform. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

const FeatureCard = ({ icon, title, description }) => (
  <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 hover:shadow-md transition-all">
    <div className="mb-6">{icon}</div>
    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">{title}</h3>
    <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{description}</p>
  </div>
);

const CheckItem = ({ text }) => (
  <div className="flex items-center gap-3">
    <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
      <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
    </div>
    <span className="text-gray-700 dark:text-gray-300 font-medium">{text}</span>
  </div>
);

export default LandingPage;
