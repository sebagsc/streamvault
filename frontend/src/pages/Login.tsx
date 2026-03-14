import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth as authApi } from '../lib/api';
import { useAuthStore } from '../store/authStore';

type Step = 'credentials' | 'totp' | 'setup_required';

export default function Login() {
  const navigate = useNavigate();
  const { setUser, user } = useAuthStore();
  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const totpRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user]);

  useEffect(() => {
    if (step === 'totp') totpRef.current?.focus();
  }, [step]);

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.login(email, password);
      if (res.totp_required) {
        setStep('totp');
      } else if (res.totp_setup_required) {
        setStep('setup_required');
      } else if (res.ok && res.user) {
        setUser(res.user);
        navigate('/', { replace: true });
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.login(email, password, totpCode);
      if (res.ok && res.user) {
        setUser(res.user);
        navigate('/', { replace: true });
      } else {
        setError('Invalid TOTP code');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/4 -left-1/4 w-3/4 h-3/4 bg-accent/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-1/4 -right-1/4 w-3/4 h-3/4 bg-accent/3 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="w-full max-w-sm relative z-10 animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-bg-primary" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z" />
              </svg>
            </div>
            <span className="text-2xl font-bold text-text-primary tracking-tight">StreamVault</span>
          </div>
          <p className="text-text-secondary text-sm">
            {step === 'credentials' ? 'Sign in to your account' : step === 'totp' ? 'Enter authentication code' : 'TOTP setup required'}
          </p>
        </div>

        <div className="card p-6 shadow-2xl">
          {step === 'credentials' && (
            <form onSubmit={handleCredentials} className="space-y-4">
              <div>
                <label className="block text-sm text-text-secondary mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                  placeholder="you@example.com"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1.5">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input"
                  placeholder="••••••••"
                  required
                />
              </div>
              {error && (
                <p className="text-status-broken text-sm bg-status-broken/10 rounded-lg px-3 py-2">{error}</p>
              )}
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? 'Signing in...' : 'Continue'}
              </button>
            </form>
          )}

          {step === 'totp' && (
            <form onSubmit={handleTotp} className="space-y-4">
              <div className="text-center mb-4">
                <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <p className="text-sm text-text-secondary">
                  Enter the 6-digit code from your authenticator app
                </p>
              </div>
              <div>
                <input
                  ref={totpRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  className="input text-center text-2xl tracking-widest font-mono"
                  placeholder="000000"
                  required
                />
              </div>
              {error && (
                <p className="text-status-broken text-sm bg-status-broken/10 rounded-lg px-3 py-2">{error}</p>
              )}
              <button type="submit" disabled={loading || totpCode.length !== 6} className="btn-primary w-full">
                {loading ? 'Verifying...' : 'Sign in'}
              </button>
              <button
                type="button"
                onClick={() => { setStep('credentials'); setTotpCode(''); setError(''); }}
                className="btn-ghost w-full text-sm"
              >
                Back
              </button>
            </form>
          )}

          {step === 'setup_required' && (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-status-broken/10 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-status-broken" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.962-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <p className="text-text-secondary text-sm">
                Your TOTP authenticator was reset by an admin. Please contact support or log in again and set up your authenticator.
              </p>
              <button
                onClick={() => { setStep('credentials'); setError(''); }}
                className="btn-primary w-full"
              >
                Start over
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-text-muted text-xs mt-6">
          Access by invitation only
        </p>
      </div>
    </div>
  );
}
