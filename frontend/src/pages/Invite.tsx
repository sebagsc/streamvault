import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { invite as inviteApi } from '../lib/api';

type Step = 'loading' | 'invalid' | 'register' | 'totp' | 'done';

export default function Invite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('loading');
  const [invalidReason, setInvalidReason] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [totpUri, setTotpUri] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [userId, setUserId] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!token) return;
    inviteApi.validate(token).then((res) => {
      if (res.valid) {
        setStep('register');
      } else {
        setInvalidReason(res.reason ?? 'invalid');
        setStep('invalid');
      }
    }).catch(() => {
      setStep('invalid');
      setInvalidReason('network');
    });
  }, [token]);

  useEffect(() => {
    if (totpUri) {
      QRCode.toDataURL(totpUri, { width: 240, margin: 1, color: { dark: '#0f0f13', light: '#f0f0f5' } })
        .then(setQrDataUrl)
        .catch(console.error);
    }
  }, [totpUri]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (!token) return;

    setLoading(true);
    try {
      const res = await inviteApi.register(token, email, password);
      setTotpUri(res.totp_uri);
      setUserId(res.user_id);
      setStep('totp');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await inviteApi.confirmTotp(userId, totpCode);
      setStep('done');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/4 -right-1/4 w-2/3 h-2/3 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10 animate-slide-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3">
            <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-bg-primary" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z" />
              </svg>
            </div>
            <span className="text-2xl font-bold text-text-primary tracking-tight">StreamVault</span>
          </div>
        </div>

        <div className="card p-6 shadow-2xl">
          {step === 'loading' && (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-text-secondary mt-4">Validating invite...</p>
            </div>
          )}

          {step === 'invalid' && (
            <div className="text-center py-6 space-y-4">
              <div className="w-12 h-12 bg-status-broken/10 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-status-broken" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-text-primary">Invalid invite link</h2>
              <p className="text-text-secondary text-sm">
                {invalidReason === 'revoked' && 'This invite link has been revoked.'}
                {invalidReason === 'already_used' && 'This invite link has already been used.'}
                {invalidReason === 'not_found' && 'This invite link does not exist.'}
                {invalidReason === 'network' && 'Could not verify invite. Please try again.'}
                {!['revoked','already_used','not_found','network'].includes(invalidReason) && 'This invite link is invalid.'}
              </p>
            </div>
          )}

          {step === 'register' && (
            <>
              <h2 className="text-lg font-semibold text-text-primary mb-4">Create your account</h2>
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-sm text-text-secondary mb-1.5">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="you@example.com" required autoFocus />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1.5">Password</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" placeholder="Min. 8 characters" required />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1.5">Confirm password</label>
                  <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="input" placeholder="Repeat password" required />
                </div>
                {error && <p className="text-status-broken text-sm bg-status-broken/10 rounded-lg px-3 py-2">{error}</p>}
                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? 'Creating account...' : 'Create account'}
                </button>
              </form>
            </>
          )}

          {step === 'totp' && (
            <>
              <h2 className="text-lg font-semibold text-text-primary mb-2">Set up authenticator</h2>
              <p className="text-text-secondary text-sm mb-5">
                Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.), then enter the 6-digit code to confirm.
              </p>
              {qrDataUrl && (
                <div className="flex justify-center mb-5">
                  <div className="p-3 bg-white rounded-xl">
                    <img src={qrDataUrl} alt="TOTP QR Code" className="w-48 h-48" />
                  </div>
                </div>
              )}
              <details className="mb-4">
                <summary className="text-xs text-text-muted cursor-pointer hover:text-text-secondary">
                  Can't scan? Show manual entry key
                </summary>
                <p className="mt-2 font-mono text-xs text-accent break-all bg-accent/10 rounded-lg p-3">
                  {totpUri.match(/secret=([A-Z2-7]+)/)?.[1] ?? ''}
                </p>
              </details>
              <form onSubmit={handleConfirmTotp} className="space-y-4">
                <div>
                  <label className="block text-sm text-text-secondary mb-1.5">6-digit code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                    className="input text-center text-2xl tracking-widest font-mono"
                    placeholder="000000"
                    required
                    autoFocus
                  />
                </div>
                {error && <p className="text-status-broken text-sm bg-status-broken/10 rounded-lg px-3 py-2">{error}</p>}
                <button type="submit" disabled={loading || totpCode.length !== 6} className="btn-primary w-full">
                  {loading ? 'Confirming...' : 'Confirm & complete setup'}
                </button>
              </form>
            </>
          )}

          {step === 'done' && (
            <div className="text-center py-6 space-y-4">
              <div className="w-14 h-14 bg-accent/10 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-7 h-7 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-text-primary">You're all set!</h2>
              <p className="text-text-secondary text-sm">Your account is ready. Sign in to start watching.</p>
              <button onClick={() => navigate('/login')} className="btn-primary w-full">
                Go to login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
