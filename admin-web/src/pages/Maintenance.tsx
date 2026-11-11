import { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Wrench, Power, Clock } from 'lucide-react';
import { API_URL, isPlatformSuperAdmin } from '../lib/area';
import { confirmDialog } from '../components/ConfirmDialog';

type MaintenanceState = { enabled: boolean; message: string; ends_at: string | null; updated_at?: string };

const authHeaders = () => ({ headers: { 'x-auth-token': localStorage.getItem('adminToken') || '' } });

// ISO -> value for <input type="datetime-local"> (local time)
const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const formatTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '');

export default function Maintenance() {
  const [current, setCurrent] = useState<MaintenanceState | null>(null);
  const [message, setMessage] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const res = await axios.get(`${API_URL}/config`);
      const m: MaintenanceState = res.data?.maintenance || { enabled: false, message: '', ends_at: null };
      setCurrent(m);
      setMessage(m.message || '');
      setEndsAt(toLocalInput(m.ends_at));
    } catch {
      toast.error('Failed to load maintenance status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async (enabled: boolean) => {
    if (enabled && !current?.enabled && !(await confirmDialog({ title: 'Turn ON maintenance mode?', message: 'The app will be blocked for ALL users in ALL areas until you turn it off.', confirmText: 'Turn ON', danger: true }))) return;
    setSaving(true);
    const t = toast.loading(enabled ? 'Turning on...' : 'Saving...');
    try {
      const res = await axios.put(`${API_URL}/config/maintenance`, {
        enabled,
        message: message.trim(),
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
      }, authHeaders());
      setCurrent(res.data.maintenance);
      toast.success(enabled ? 'Maintenance mode is ON' : (current?.enabled ? 'Maintenance mode is OFF. App is live again.' : 'Saved'), { id: t });
    } catch (err: any) {
      toast.error(err.response?.data?.msg || 'Failed to update maintenance mode', { id: t });
    } finally {
      setSaving(false);
    }
  };

  // Quick preset: from now for N hours
  const setHoursFromNow = (h: number) => setEndsAt(toLocalInput(new Date(Date.now() + h * 3600 * 1000).toISOString()));

  if (!isPlatformSuperAdmin()) {
    return <p style={{ color: 'var(--text-muted)' }}>Only the Super Admin can manage maintenance mode.</p>;
  }

  const isOn = !!current?.enabled;

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Maintenance Mode</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>
            When ON, the mobile app shows a maintenance screen to every user in every area. The admin panel keeps working.
          </p>
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      ) : (
        <div style={{ background: 'white', border: '1px solid var(--border-color)', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: 16, borderRadius: 12,
            background: isOn ? '#FEF2F2' : '#F0FDF4', border: `1px solid ${isOn ? '#FECACA' : '#BBF7D0'}`,
          }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isOn ? '#FEE2E2' : '#DCFCE7' }}>
              <Wrench size={22} color={isOn ? '#DC2626' : '#16A34A'} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: isOn ? '#B91C1C' : '#15803D' }}>
                {isOn ? 'Maintenance is ON: app is blocked for users' : 'App is live'}
              </div>
              {isOn && current?.ends_at && (
                <div style={{ fontSize: 13, color: '#7F1D1D', marginTop: 2 }}>Expected back: {formatTime(current.ends_at)}</div>
              )}
            </div>
          </div>

          <div>
            <label className="form-label">Message shown to users</label>
            <textarea
              className="form-input"
              rows={3}
              maxLength={500}
              placeholder="e.g. App 3 ghante ke liye maintenance par hai. Shaam 5 baje tak wapas aa jayega."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              style={{ width: '100%', resize: 'vertical' }}
            />
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Leave empty to show a default message.</p>
          </div>

          <div>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Clock size={14} /> Expected back at (optional)</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input type="datetime-local" className="form-input" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} style={{ maxWidth: 240 }} />
              {[1, 2, 3].map(h => (
                <button key={h} type="button" className="btn btn-secondary" onClick={() => setHoursFromNow(h)}>+{h} hr</button>
              ))}
              {endsAt && <button type="button" className="btn btn-secondary" onClick={() => setEndsAt('')}>Clear</button>}
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Only shown to users. Maintenance does not turn off by itself: turn it OFF when you are done.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
            {isOn ? (
              <>
                <button className="btn btn-primary" disabled={saving} onClick={() => save(false)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#16A34A', borderColor: '#16A34A' }}>
                  <Power size={16} /> Turn OFF (make app live)
                </button>
                <button className="btn btn-secondary" disabled={saving} onClick={() => save(true)}>Update message / time</button>
              </>
            ) : (
              <button className="btn btn-primary" disabled={saving} onClick={() => save(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#DC2626', borderColor: '#DC2626' }}>
                <Power size={16} /> Turn ON maintenance
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
