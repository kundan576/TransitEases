import React, { useState, useEffect } from 'react';
import { Bus, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getRoleMismatchMessage } from '../types';

export const AuthPage: React.FC<{
  onSuccess: (role?: string) => void;
  initialRole?: 'passenger' | 'driver' | 'admin';
}> = ({ onSuccess, initialRole = 'passenger' }) => {
  const { login, register } = useAuth();
  const [selectedContextRole, setSelectedContextRole] = useState<'passenger' | 'driver' | 'admin'>(initialRole);
  const [isLoginMode, setIsLoginMode] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState(() => {
    if (initialRole === 'admin') return 'admin@transitease.city';
    if (initialRole === 'driver') return '9876543210';
    return '9988776655';
  });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(() => {
    if (initialRole === 'admin') return 'admin123';
    if (initialRole === 'driver') return 'driver123';
    return 'pass123';
  });
  const [role, setRole] = useState<'passenger' | 'driver'>(initialRole === 'driver' ? 'driver' : 'passenger');
  const [licenseNumber, setLicenseNumber] = useState('');

  useEffect(() => {
    setSelectedContextRole(initialRole);
    if (initialRole === 'admin') {
      setMobile('admin@transitease.city');
      setPassword('admin123');
      setIsLoginMode(true);
      setError(null);
    } else if (initialRole === 'driver') {
      setMobile('9876543210');
      setPassword('driver123');
      setRole('driver');
      setIsLoginMode(true);
      setError(null);
    } else {
      setMobile('9988776655');
      setPassword('pass123');
      setRole('passenger');
      setError(null);
    }
  }, [initialRole]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    if (isLoginMode) {
      const res = await login(mobile || email, password, selectedContextRole);
      if (res.success && res.user) {
        if (selectedContextRole && res.user.role !== selectedContextRole) {
          setError(getRoleMismatchMessage(res.user.role, selectedContextRole));
          setLoading(false);
          return;
        }
        onSuccess(res.user.role);
      } else {
        setError(res.error || 'Login failed.');
      }
    } else {
      const res = await register({
        name,
        mobile,
        email: email || undefined,
        password,
        role,
        licenseNumber: role === 'driver' ? licenseNumber : undefined
      });
      if (res.success) {
        setSuccessMsg(res.message || 'Account registered successfully!');
        const assignedRole = res.user?.role || role;
        setTimeout(() => onSuccess(assignedRole), 1200);
      } else {
        setError(res.error || 'Registration failed.');
      }
    }
    setLoading(false);
  };

  const handleQuickFill = (uRole: 'passenger' | 'driver' | 'admin') => {
    setIsLoginMode(true);
    setSelectedContextRole(uRole);
    setError(null);
    setSuccessMsg(null);
    if (uRole === 'passenger') {
      setMobile('9988776655');
      setPassword('pass123');
      setEmail('');
      setRole('passenger');
    } else if (uRole === 'driver') {
      setMobile('9876543210');
      setPassword('driver123');
      setEmail('');
      setRole('driver');
    } else if (uRole === 'admin') {
      setMobile('admin@transitease.city');
      setPassword('admin123');
      setEmail('');
    }
  };

  return (
    <div className="max-w-md mx-auto my-8">
      <div className="bg-white rounded-xl p-6 sm:p-8 shadow-2xs border border-slate-200/90">
        <div className="text-center mb-6">
          <div className="w-10 h-10 bg-slate-900 text-emerald-400 rounded-lg flex items-center justify-center mx-auto mb-3 shadow-2xs">
            <Bus className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            {isLoginMode ? 'Sign In to TransitEase' : 'Create Transit Account'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Real-time public transport tracking for passengers, drivers, and staff
          </p>
        </div>

        {/* Role Context & Demo Login Selector */}
        <div className="mb-5 p-3 bg-slate-50 border border-slate-200/80 rounded-lg text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-600 block text-[11px] uppercase tracking-wider">
              Select Role Context & Demo Fill:
            </span>
            <span className="text-[10px] font-mono text-slate-500 uppercase font-semibold">
              Active: {selectedContextRole}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5" role="tablist">
            <button
              type="button"
              data-testid="role-tab-passenger"
              onClick={() => handleQuickFill('passenger')}
              className={`py-1.5 px-2 border rounded-md font-semibold text-xs transition-colors cursor-pointer flex items-center justify-center ${
                selectedContextRole === 'passenger' && isLoginMode
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
              }`}
            >
              Passenger
            </button>
            <button
              type="button"
              data-testid="role-tab-driver"
              onClick={() => handleQuickFill('driver')}
              className={`py-1.5 px-2 border rounded-md font-semibold text-xs transition-colors cursor-pointer flex items-center justify-center ${
                selectedContextRole === 'driver' && isLoginMode
                  ? 'bg-emerald-800 text-white border-emerald-800'
                  : 'bg-emerald-50/70 hover:bg-emerald-100/70 border-emerald-200/80 text-emerald-900'
              }`}
            >
              Driver
            </button>
            <button
              type="button"
              data-testid="role-tab-admin"
              onClick={() => handleQuickFill('admin')}
              className={`py-1.5 px-2 border rounded-md font-semibold text-xs transition-colors cursor-pointer flex items-center justify-center ${
                selectedContextRole === 'admin' && isLoginMode
                  ? 'bg-indigo-800 text-white border-indigo-800'
                  : 'bg-indigo-50/70 hover:bg-indigo-100/70 border-indigo-200/80 text-indigo-900'
              }`}
            >
              Admin
            </button>
          </div>
        </div>

        {/* Dynamic Synchronized Role Gate Badge */}
        {isLoginMode && (
          <div
            data-testid="role-gate-indicator"
            className={`mb-4 p-2.5 rounded-lg text-xs flex items-center justify-between border ${
              selectedContextRole === 'admin'
                ? 'bg-indigo-50/70 border-indigo-200 text-indigo-900'
                : selectedContextRole === 'driver'
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}
          >
            <span className="font-medium">
              {selectedContextRole === 'admin'
                ? 'Signing into Admin Account'
                : selectedContextRole === 'driver'
                ? 'Signing into Driver Account'
                : 'Signing into Passenger Account'}
            </span>
            <span className="text-[10px] uppercase font-bold font-mono">
              {selectedContextRole === 'admin'
                ? 'Admin Gate'
                : selectedContextRole === 'driver'
                ? 'Driver Gate'
                : 'Passenger Gate'}
            </span>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span className="font-medium">{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          {!isLoginMode && (
            <>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rameshwar Yadav"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Account Role</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('passenger')}
                    className={`py-2 px-3 rounded-lg font-semibold border transition-colors cursor-pointer text-xs ${
                      role === 'passenger'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    Passenger
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('driver')}
                    className={`py-2 px-3 rounded-lg font-semibold border transition-colors cursor-pointer text-xs ${
                      role === 'driver'
                        ? 'bg-emerald-800 text-white border-emerald-800'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    Bus Driver
                  </button>
                </div>
              </div>

              {role === 'driver' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Commercial Driver License #</label>
                  <input
                    type="text"
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    placeholder="DL-1420180091823"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-700"
                    required
                  />
                  <span className="text-[10px] text-amber-700 mt-0.5 block">
                    Driver accounts require verification from the transit authority before operating.
                  </span>
                </div>
              )}
            </>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              {isLoginMode ? 'Mobile Number or Email' : 'Mobile Number (10 digits)'}
            </label>
            <input
              type="text"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="e.g., 9876543210"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-700"
              required
            />
          </div>

          {!isLoginMode && (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Email Address (Optional)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="passenger@example.com"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-700"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-xs shadow-2xs transition-colors cursor-pointer disabled:opacity-50 mt-1"
          >
            {loading ? 'Processing...' : isLoginMode ? 'Sign In Securely' : 'Complete Registration'}
          </button>
        </form>

        <div className="mt-4 text-center text-xs text-slate-500 border-t border-slate-100 pt-3">
          {isLoginMode ? (
            <span>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setIsLoginMode(false);
                  setError(null);
                }}
                className="text-emerald-800 font-semibold hover:underline cursor-pointer"
              >
                Register Here
              </button>
            </span>
          ) : (
            <span>
              Already registered?{' '}
              <button
                type="button"
                onClick={() => {
                  setIsLoginMode(true);
                  setError(null);
                }}
                className="text-emerald-800 font-semibold hover:underline cursor-pointer"
              >
                Sign In
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
