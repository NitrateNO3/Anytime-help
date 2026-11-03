import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import logoImg from '../assets/logo.png';

const API_URL = 'https://anytime-help.onrender.com/api';

export default function Login() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [shortCode, setShortCode] = useState(false);
  const [timer, setTimer] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loginType, setLoginType] = useState<'Admin' | 'SubAdmin'>('Admin');
  const navigate = useNavigate();

  // Sign in as soon as the OTP is filled: 6 digits right away; a 4-digit
  // testing code (only offered for some numbers) after a short pause
  useEffect(() => {
    if (!otpSent || loading) return;
    if (otp.length === 6) { verifyOtp(); return; }
    if (shortCode && otp.length === 4) {
      const id = setTimeout(() => verifyOtp(), 700);
      return () => clearTimeout(id);
    }
  }, [otp]);

  useEffect(() => {
    if (timer <= 0) return;
    const id = setTimeout(() => setTimer((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timer]);

  const switchPortal = (type: 'Admin' | 'SubAdmin') => {
    setLoginType(type);
    setOtpSent(false);
    setOtp('');
    setTimer(0);
  };

  const sendOtp = async () => {
    if (phone.length !== 10) {
      toast.error('Please enter a valid 10-digit mobile number');
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/auth/admin/send-otp`, { phone_number: phone, portal: loginType });
      setOtpSent(true);
      setShortCode(!!res.data?.short_code);
      setOtp('');
      setTimer(60);
      toast.success(res.data?.msg || 'OTP sent');
    } catch (err: any) {
      toast.error(err.response?.data?.msg || 'Could not send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpSent) sendOtp();
    else verifyOtp();
  };

  const verifyOtp = async () => {
    if (loading) return;
    if (!otp.trim()) {
      toast.error('Please enter the OTP');
      return;
    }
    setLoading(true);

    try {
      const res = await axios.post(`${API_URL}/auth/admin/verify-otp`, {
        phone_number: phone,
        otp: otp.trim(),
        portal: loginType,
      });

      // A platform Super Admin signs in from the Admin tab and is treated as a
      // full Admin inside whichever area it selects.
      if (res.data.user.role === 'SuperAdmin' && loginType === 'Admin') {
        localStorage.setItem('adminToken', res.data.token);
        localStorage.setItem('adminUser', JSON.stringify({ ...res.data.user, role: 'Admin', isSuperAdmin: true }));
        localStorage.removeItem('selectedAreaId');
        toast.success('Logged in successfully!');
        navigate('/areas');
        return;
      }

      if (res.data.user.role !== loginType) {
        toast.error(`Unauthorized: Please log in using the correct portal.`);
        setLoading(false);
        return;
      }

      localStorage.setItem('adminToken', res.data.token);
      localStorage.setItem('adminUser', JSON.stringify(res.data.user));
      localStorage.removeItem('selectedAreaId');
      toast.success('Logged in successfully!');
      
      if (loginType === 'SubAdmin') {
        const perms = res.data.user.permissions || [];
        if (perms.includes('Residents')) navigate('/residents');
        else if (perms.includes('Staff Team')) navigate('/staff');
        else if (perms.includes('Committee Members')) navigate('/members');
        else if (perms.includes('Announcements')) navigate('/announcements');
        else if (perms.includes('Banners')) navigate('/banners');
        else if (perms.includes('Directory')) navigate('/directory');
        else navigate('/residents'); // fallback
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.msg || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-split">
      <div className="login-left">
        <div style={{ width: '100%', maxWidth: '440px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '40px' }}>
            <img src={logoImg} alt="Logo" style={{ width: 70, height: 70, objectFit: 'contain' }} />
            <span style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main)' }}>Anytime Help</span>
          </div>

          <h2 className="login-title" style={{ textAlign: 'left' }}>Welcome Back</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '30px', fontSize: '15px' }}>
            Enter your registered mobile number. We will send an OTP to it.
          </p>

          <div style={{ display: 'flex', gap: 10, marginBottom: 30, background: '#F1F5F9', padding: 6, borderRadius: 12 }}>
            <button
              type="button"
              onClick={() => switchPortal('Admin')}
              style={{ flex: 1, padding: '12px', borderRadius: 8, border: 'none', background: loginType === 'Admin' ? 'white' : 'transparent', color: loginType === 'Admin' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 700, cursor: 'pointer', boxShadow: loginType === 'Admin' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }}
            >
              Super Admin
            </button>
            <button
              type="button"
              onClick={() => switchPortal('SubAdmin')}
              style={{ flex: 1, padding: '12px', borderRadius: 8, border: 'none', background: loginType === 'SubAdmin' ? 'white' : 'transparent', color: loginType === 'SubAdmin' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 700, cursor: 'pointer', boxShadow: loginType === 'SubAdmin' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }}
            >
              Sub-Admin
            </button>
          </div>

          <form onSubmit={handleLogin}>
            <div className="input-group">
              <label>Mobile Number</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontWeight: 600, color: 'var(--text-main)' }}>+91</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); if (otpSent) { setOtpSent(false); setOtp(''); } }}
                  required
                  placeholder="10-digit mobile number"
                  style={{ paddingLeft: 52 }}
                  autoFocus
                />
              </div>
            </div>

            {otpSent && (
              <div className="input-group">
                <label>OTP</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter OTP"
                  style={{ letterSpacing: 6, fontWeight: 700, fontSize: 18 }}
                  autoFocus
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 13, color: 'var(--text-muted)' }}>
                  <span>Sent to +91 {phone.slice(0, 2)}XXXXX{phone.slice(-3)}</span>
                  {timer > 0 ? (
                    <span>Resend in {timer}s</span>
                  ) : (
                    <button type="button" onClick={sendOtp} disabled={loading} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', padding: 0 }}>
                      Resend OTP
                    </button>
                  )}
                </div>
              </div>
            )}

            <button type="submit" className="btn-primary" disabled={loading || phone.length !== 10 || (otpSent && !otp)}>
              {loading ? (otpSent ? 'Verifying...' : 'Sending OTP...') : (otpSent ? 'Verify & Sign In' : 'Send OTP')}
            </button>
          </form>
        </div>
      </div>
      <div className="login-right">
        <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', color: 'white', background: 'linear-gradient(135deg, rgba(29, 78, 216, 0.4) 0%, rgba(15, 23, 42, 0.8) 100%)' }}>
          <div style={{ maxWidth: '480px' }}>
            <h1 style={{ fontSize: '48px', fontWeight: 800, marginBottom: '24px', lineHeight: 1.1 }}>Manage your society efficiently.</h1>
            <p style={{ fontSize: '18px', opacity: 0.9, lineHeight: 1.6 }}>The Anytime Help administrative dashboard gives you full control over complaints, staff management, and analytics.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
