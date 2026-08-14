import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Shield, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Login() {
  const [email, setEmail] = useState('admin@anytimehelp.com');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const res = await axios.post('https://anytime-help.onrender.com/api/auth/login', {
        email,
        password
      });

      if (res.data.user.role !== 'Admin') {
        toast.error('Unauthorized: Admin access only.');
        setLoading(false);
        return;
      }

      localStorage.setItem('adminToken', res.data.token);
      localStorage.setItem('adminUser', JSON.stringify(res.data.user));
      toast.success('Logged in successfully!');
      navigate('/dashboard');
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
            <div style={{
              background: 'rgba(255, 99, 71, 0.1)',
              padding: '12px',
              borderRadius: '14px',
              border: '1px solid rgba(255, 99, 71, 0.2)'
            }}>
              <Shield size={32} color="var(--primary)" strokeWidth={2} />
            </div>
            <span style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main)' }}>Anytime Help</span>
          </div>

          <h2 className="login-title" style={{ textAlign: 'left' }}>Welcome Back</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '40px', fontSize: '15px' }}>
            Enter your credentials to access the admin portal and manage the society.
          </p>

          <form onSubmit={handleLogin}>
            <div className="input-group">
              <label>Email Address</label>
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required
                placeholder="admin@anytimehelp.com"
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

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" style={{ width: '16px', height: '16px', borderRadius: '4px' }} />
                <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Remember me</span>
              </label>
              <a href="#" style={{ fontSize: '14px', color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>Forgot password?</a>
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
      <div className="login-right">
        <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', color: 'white', background: 'linear-gradient(135deg, rgba(255, 99, 71, 0.4) 0%, rgba(15, 23, 42, 0.8) 100%)' }}>
          <div style={{ maxWidth: '480px' }}>
            <h1 style={{ fontSize: '48px', fontWeight: 800, marginBottom: '24px', lineHeight: 1.1 }}>Manage your society efficiently.</h1>
            <p style={{ fontSize: '18px', opacity: 0.9, lineHeight: 1.6 }}>The Anytime Help administrative dashboard gives you full control over complaints, staff management, and analytics.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
