import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { MapPin, Plus, Pencil, Trash2, UserPlus, X, ArrowRight, Users } from 'lucide-react';
import { API_URL, isPlatformSuperAdmin, getSelectedArea, setSelectedArea } from '../lib/area';

type Phase = { name: string; blocks: string[] };
type AreaAdmin = { _id: string; name: string; email: string; last_login_at?: string };
type Area = {
  _id: string;
  name: string;
  city: string;
  phases: Phase[];
  is_active: boolean;
  admins: AreaAdmin[];
  stats: Record<string, number>;
};

type PhaseRow = { name: string; blocks: string };
const emptyAreaForm = { name: '', city: '', phases: [{ name: '', blocks: '' }] as PhaseRow[], adminName: '', adminEmail: '', adminPassword: '' };

const authHeaders = () => ({ headers: { 'x-auth-token': localStorage.getItem('adminToken') || '' } });
const errMsg = (err: any, fallback: string) => err?.response?.data?.msg || err?.response?.data?.message || fallback;

export default function Areas() {
  const navigate = useNavigate();
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Area create / edit modal
  const [areaModal, setAreaModal] = useState<null | { mode: 'create' } | { mode: 'edit'; area: Area }>(null);
  const [form, setForm] = useState(emptyAreaForm);

  // Admin add / edit modal
  const [adminModal, setAdminModal] = useState<null | { area: Area; admin?: AreaAdmin }>(null);
  const [adminForm, setAdminForm] = useState({ name: '', email: '', password: '' });

  useEffect(() => {
    if (!isPlatformSuperAdmin()) {
      navigate('/dashboard', { replace: true });
      return;
    }
    fetchAreas();
  }, []);

  const fetchAreas = async () => {
    try {
      const res = await axios.get(`${API_URL}/areas`, authHeaders());
      setAreas(res.data);
    } catch (err) {
      toast.error(errMsg(err, 'Failed to load areas'));
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setForm(emptyAreaForm);
    setAreaModal({ mode: 'create' });
  };

  const openEdit = (area: Area) => {
    setForm({
      ...emptyAreaForm,
      name: area.name,
      city: area.city || '',
      phases: area.phases.length ? area.phases.map((p) => ({ name: p.name, blocks: p.blocks.join(', ') })) : [{ name: '', blocks: '' }],
    });
    setAreaModal({ mode: 'edit', area });
  };

  const updatePhase = (i: number, key: keyof PhaseRow, value: string) => {
    setForm((f) => ({ ...f, phases: f.phases.map((p, idx) => (idx === i ? { ...p, [key]: value } : p)) }));
  };

  const saveArea = async () => {
    if (!form.name.trim()) return toast.error('Area name is required');
    const phases = form.phases
      .filter((p) => p.name.trim())
      .map((p) => ({ name: p.name.trim(), blocks: p.blocks.split(',').map((b) => b.trim()).filter(Boolean) }));
    if (!phases.length) return toast.error('Add at least one phase / sector');

    setSaving(true);
    try {
      if (areaModal?.mode === 'edit') {
        await axios.put(`${API_URL}/areas/${areaModal.area._id}`, { name: form.name, city: form.city, phases }, authHeaders());
        toast.success('Area updated');
      } else {
        const admin = form.adminEmail || form.adminPassword
          ? { name: form.adminName, email: form.adminEmail, password: form.adminPassword }
          : undefined;
        const res = await axios.post(`${API_URL}/areas`, { name: form.name, city: form.city, phases, admin }, authHeaders());
        if (!getSelectedArea()) setSelectedArea(res.data._id);
        toast.success('Area created. It now shows on the app registration screen.');
      }
      setAreaModal(null);
      fetchAreas();
    } catch (err) {
      toast.error(errMsg(err, 'Failed to save area'));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (area: Area) => {
    const next = !area.is_active;
    if (!next && !window.confirm(`Hide "${area.name}" from the app registration screen? Existing users keep working.`)) return;
    try {
      await axios.put(`${API_URL}/areas/${area._id}`, { is_active: next }, authHeaders());
      toast.success(next ? 'Area is now visible on registration' : 'Area hidden from registration');
      fetchAreas();
    } catch (err) {
      toast.error(errMsg(err, 'Failed to update area'));
    }
  };

  const deleteArea = async (area: Area) => {
    if (!window.confirm(`Delete "${area.name}" permanently? Only an empty area (no residents, staff, admins or complaints) can be deleted. Its categories and other setup are deleted too.`)) return;
    try {
      await axios.delete(`${API_URL}/areas/${area._id}`, authHeaders());
      if (getSelectedArea() === area._id) setSelectedArea(null);
      toast.success(`"${area.name}" deleted`);
      fetchAreas();
    } catch (err) {
      toast.error(errMsg(err, 'Failed to delete area'));
    }
  };

  const openAdminModal = (area: Area, admin?: AreaAdmin) => {
    setAdminForm({ name: admin?.name || '', email: admin?.email || '', password: '' });
    setAdminModal({ area, admin });
  };

  const saveAdmin = async () => {
    if (!adminModal) return;
    const { area, admin } = adminModal;
    if (!adminForm.email.trim()) return toast.error('Email is required');
    if (!admin && !adminForm.password) return toast.error('Password is required');
    setSaving(true);
    try {
      if (admin) {
        await axios.put(`${API_URL}/areas/${area._id}/admins/${admin._id}`, adminForm, authHeaders());
        toast.success('Admin updated');
      } else {
        await axios.post(`${API_URL}/areas/${area._id}/admins`, adminForm, authHeaders());
        toast.success(`Admin added to ${area.name}`);
      }
      setAdminModal(null);
      fetchAreas();
    } catch (err) {
      toast.error(errMsg(err, 'Failed to save admin'));
    } finally {
      setSaving(false);
    }
  };

  const removeAdmin = async (area: Area, admin: AreaAdmin) => {
    if (!window.confirm(`Remove ${admin.name || admin.email} as admin of ${area.name}?`)) return;
    try {
      await axios.delete(`${API_URL}/areas/${area._id}/admins/${admin._id}`, authHeaders());
      toast.success('Admin removed');
      fetchAreas();
    } catch (err) {
      toast.error(errMsg(err, 'Failed to remove admin'));
    }
  };

  const openArea = (area: Area) => {
    setSelectedArea(area._id);
    window.location.href = '/dashboard';
  };

  const selected = getSelectedArea();

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Areas</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>
            Each area is a separate client. Active areas show up on the app's registration screen.
          </p>
        </div>
        <button className="btn btn-primary" onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Plus size={18} /> Add Area
        </button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading areas…</p>
      ) : areas.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No areas yet. Click "Add Area" to create the first one.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
          {areas.map((area) => (
            <div key={area._id} style={{ background: 'white', border: `1px solid ${selected === area._id ? 'var(--primary)' : 'var(--border-color)'}`, borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 14, opacity: area.is_active ? 1 : 0.65 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MapPin size={18} color="var(--primary)" />
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, overflowWrap: 'anywhere' }}>{area.name}</h3>
                  </div>
                  {area.city && <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 2, marginLeft: 26 }}>{area.city}</div>}
                </div>
                <button className="btn-icon" title="Edit area" onClick={() => openEdit(area)}><Pencil size={16} /></button>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 13 }}>
                <span className={`badge ${area.is_active ? 'resolved' : 'pending'}`}>{area.is_active ? 'Visible on registration' : 'Hidden'}</span>
                <span className="badge progress"><Users size={12} style={{ verticalAlign: -2 }} /> {area.stats?.Resident || 0} residents</span>
                <span className="badge progress">{area.stats?.Staff || 0} staff</span>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Phases / Blocks</div>
                {area.phases.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>None set</div>
                ) : area.phases.map((p) => (
                  <div key={p.name} style={{ fontSize: 14, marginBottom: 4 }}>
                    <strong>{p.name}</strong>
                    {p.blocks.length > 0 && <span style={{ color: 'var(--text-muted)' }}> · {p.blocks.join(', ')}</span>}
                  </div>
                ))}
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Admins</span>
                  <button className="btn-icon" title="Add admin" onClick={() => openAdminModal(area)}><UserPlus size={16} /></button>
                </div>
                {area.admins.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--danger)' }}>No admin yet</div>
                ) : area.admins.map((a) => (
                  <div key={a._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 0', borderTop: '1px solid var(--border-color)' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{a.name}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>{a.email}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button className="btn-icon" title="Edit admin" onClick={() => openAdminModal(area, a)}><Pencil size={15} /></button>
                      <button className="btn-icon" title="Remove admin" onClick={() => removeAdmin(area, a)} style={{ color: 'var(--danger)' }}><Trash2 size={15} /></button>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 'auto' }}>
                <button className="btn btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={() => openArea(area)}>
                  Open dashboard <ArrowRight size={16} />
                </button>
                <button className="btn btn-secondary" onClick={() => toggleActive(area)}>
                  {area.is_active ? 'Hide' : 'Show'}
                </button>
                <button className="btn-icon" title="Delete area" onClick={() => deleteArea(area)} style={{ color: 'var(--danger)' }}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {areaModal && (
        <div className="modal-backdrop" onClick={() => !saving && setAreaModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{areaModal.mode === 'edit' ? 'Edit Area' : 'Add Area'}</h2>
              <button className="btn-icon" onClick={() => setAreaModal(null)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Area / Society name *</label>
                <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. DLF Phase 4" />
              </div>
              <div className="form-group">
                <label className="form-label">City</label>
                <input className="form-input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="e.g. Gurugram" />
              </div>

              <div className="form-group">
                <label className="form-label">Phases / Sectors and their blocks *</label>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 10px' }}>Residents choose these when they register. Separate blocks with commas. For a village, leave Blocks empty: residents then enter an optional house no. and landmark instead.</p>
                {form.phases.map((p, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                    <input className="form-input" style={{ flex: '1 1 160px' }} value={p.name} onChange={(e) => updatePhase(i, 'name', e.target.value)} placeholder="Phase name, e.g. Phase 1" />
                    <input className="form-input" style={{ flex: '1 1 160px' }} value={p.blocks} onChange={(e) => updatePhase(i, 'blocks', e.target.value)} placeholder="Blocks, e.g. A, B, C (empty for a village)" />
                    {form.phases.length > 1 && (
                      <button className="btn-icon" title="Remove phase" onClick={() => setForm({ ...form, phases: form.phases.filter((_, idx) => idx !== i) })}><X size={16} /></button>
                    )}
                  </div>
                ))}
                <button className="btn btn-secondary" onClick={() => setForm({ ...form, phases: [...form.phases, { name: '', blocks: '' }] })} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Plus size={16} /> Add phase
                </button>
              </div>

              {areaModal.mode === 'create' && (
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 20 }}>
                  <label className="form-label">Area admin (can be added later)</label>
                  <div className="form-group">
                    <input className="form-input" value={form.adminName} onChange={(e) => setForm({ ...form, adminName: e.target.value })} placeholder="Admin name" />
                  </div>
                  <div className="form-group">
                    <input className="form-input" type="email" value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} placeholder="Admin email (login ID)" />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <input className="form-input" type="password" value={form.adminPassword} onChange={(e) => setForm({ ...form, adminPassword: e.target.value })} placeholder="Admin password" />
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setAreaModal(null)} disabled={saving}>Cancel</button>
              <button className="btn btn-primary" onClick={saveArea} disabled={saving}>{saving ? 'Saving…' : areaModal.mode === 'edit' ? 'Save changes' : 'Create area'}</button>
            </div>
          </div>
        </div>
      )}

      {adminModal && (
        <div className="modal-backdrop" onClick={() => !saving && setAdminModal(null)}>
          <div className="modal-content" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{adminModal.admin ? 'Edit admin' : `Add admin to ${adminModal.area.name}`}</h2>
              <button className="btn-icon" onClick={() => setAdminModal(null)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Name</label>
                <input className="form-input" value={adminForm.name} onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Email (login ID) *</label>
                <input className="form-input" type="email" value={adminForm.email} onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">{adminModal.admin ? 'New password (leave blank to keep)' : 'Password *'}</label>
                <input className="form-input" type="password" value={adminForm.password} onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setAdminModal(null)} disabled={saving}>Cancel</button>
              <button className="btn btn-primary" onClick={saveAdmin} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
