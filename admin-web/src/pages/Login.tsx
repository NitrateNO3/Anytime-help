import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import logoImg from '../assets/logo.png';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginType, setLoginType] = useState<'Admin' | 'SubAdmin'>('Admin');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const API_URL = 'https://anytime-help.onrender.com/api';
    
    try {
      const res = await axios.post(`${API_URL}/auth/login`, {
        email,
        password
      });

      if (res.data.user.role !== loginType) {
        toast.error(`Unauthorized: Please log in using the correct portal.`);
        setLoading(false);
        return;
      }

      localStorage.setItem('adminToken', res.data.token);
      localStorage.setItem('adminUser', JSON.stringify(res.data.user));
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
            Enter your credentials to access the admin portal and manage the society.
          </p>

          <div style={{ display: 'flex', gap: 10, marginBottom: 30, background: '#F1F5F9', padding: 6, borderRadius: 12 }}>
            <button
              onClick={() => setLoginType('Admin')}
              style={{ flex: 1, padding: '12px', borderRadius: 8, border: 'none', background: loginType === 'Admin' ? 'white' : 'transparent', color: loginType === 'Admin' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 700, cursor: 'pointer', boxShadow: loginType === 'Admin' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }}
            >
              Super Admin
            </button>
            <button
              onClick={() => setLoginType('SubAdmin')}
              style={{ flex: 1, padding: '12px', borderRadius: 8, border: 'none', background: loginType === 'SubAdmin' ? 'white' : 'transparent', color: loginType === 'SubAdmin' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 700, cursor: 'pointer', boxShadow: loginType === 'SubAdmin' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }}
            >
              Sub-Admin
            </button>
          </div>

          <form onSubmit={handleLogin}>
            <div className="input-group">
              <label>Email Address</label>
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required
                placeholder="Email Address"
              />
            </div>
            <div className="input-group" style={{ position: 'relative' }}>
              <label>Password</label>
              <input 
                type={showPassword ? "text" : "password"} 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required
                placeholder="••••••••"
                style={{ paddingRight: '48px' }}
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ 
                  position: 'absolute', 
                  right: '16px', 
                  top: '38px', 
                  background: 'none', 
                  border: 'none', 
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>


            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Authenticating...' : 'Sign In'}
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
