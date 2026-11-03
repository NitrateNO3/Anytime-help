import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { MapPin, Plus, Pencil, Trash2, UserPlus, X, ArrowRight, Users } from 'lucide-react';
import { API_URL, isPlatformSuperAdmin, getSelectedArea, setSelectedArea } from '../lib/area';

type Phase = { name: string; blocks: string[] };
type AreaType = 'sector' | 'village';
type AreaAdmin = { _id: string; name: string; email?: string; phone_number?: string; last_login_at?: string };

// '+919810922338' -> '9810922338'
const local10 = (p?: string) => (p || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '').slice(-10);
const digitsOnly = (v: string) => v.replace(/\D/g, '').slice(0, 10);
type Area = {
  _id: string;
  name: string;
  city: string;
  type?: AreaType;
  phases: Phase[];
  is_active: boolean;
  admins: AreaAdmin[];
  stats: Record<string, number>;
};

// One phase in the form: its blocks as a list, plus the block being typed
type PhaseRow = { name: string; blocks: string[]; draft: string };
const emptyPhaseRow: PhaseRow = { name: '', blocks: [], draft: '' };
// `phases` is the list for the selected type. The other type's list is kept
// in `savedPhases`, so switching Villages <-> Sectors never mixes the two and
// switching back restores what was typed.
const emptyAreaForm = {
  name: '', city: '', type: 'sector' as AreaType,
  phases: [emptyPhaseRow] as PhaseRow[],
  savedPhases: {} as Partial<Record<AreaType, PhaseRow[]>>,
  adminName: '', adminPhone: '',
};

// "A, B, B1" -> ['A', 'B', 'B1'] added to existing blocks, without duplicates (case-insensitive)
const mergeBlocks = (existing: string[], text: string) => {
  const out = [...existing];
  text.split(',').map((b) => b.trim()).filter(Boolean).forEach((b) => {
    if (!out.some((x) => x.toLowerCase() === b.toLowerCase())) out.push(b);
  });
  return out;
};

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
  const [adminForm, setAdminForm] = useState({ name: '', phone_number: '' });

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
      type: area.type === 'village' ? 'village' : 'sector',
      phases: area.phases.length ? area.phases.map((p) => ({ name: p.name, blocks: [...p.blocks], draft: '' })) : [emptyPhaseRow],
    });
    setAreaModal({ mode: 'edit', area });
  };

  const updatePhase = (i: number, patch: Partial<PhaseRow>) => {
    setForm((f) => ({ ...f, phases: f.phases.map((p, idx) => (idx === i ? { ...p, ...patch } : p)) }));
  };

  const switchType = (type: AreaType) => {
    setForm((f) => (f.type === type ? f : {
      ...f,
      type,
      phases: f.savedPhases[type] || [emptyPhaseRow],
      savedPhases: { ...f.savedPhases, [f.type]: f.phases },
    }));
  };

  const addBlocks = (i: number) => {
    setForm((f) => ({
      ...f,
      phases: f.phases.map((p, idx) => (idx === i ? { ...p, blocks: mergeBlocks(p.blocks, p.draft), draft: '' } : p)),
    }));
  };

  const removeBlock = (i: number, block: string) => {
    setForm((f) => ({ ...f, phases: f.phases.map((p, idx) => (idx === i ? { ...p, blocks: p.blocks.filter((b) => b !== block) } : p)) }));
  };

  const saveArea = async () => {
    if (!form.name.trim()) return toast.error('Area name is required');
    const isVillage = form.type === 'village';
    const phases = form.phases
      .filter((p) => p.name.trim())
      // A block typed but not yet added with Enter / "Add block" still counts
      .map((p) => ({ name: p.name.trim(), blocks: isVillage ? [] : mergeBlocks(p.blocks, p.draft) }));
    if (!phases.length) return toast.error(isVillage ? 'Add at least one village' : 'Add at least one phase / sector');
    const noBlocks = phases.find((p) => !isVillage && p.blocks.length === 0);
    if (noBlocks) return toast.error(`Add at least one block to "${noBlocks.name}"`);
    const names = phases.map((p) => p.name.toLowerCase());
    if (new Set(names).size !== names.length) return toast.error(isVillage ? 'Each village name must be different' : 'Each phase name must be different');

    setSaving(true);
    try {
      if (areaModal?.mode === 'edit') {
        await axios.put(`${API_URL}/areas/${areaModal.area._id}`, { name: form.name, city: form.city, type: form.type, phases }, authHeaders());
        toast.success('Area updated');
      } else {
        if (form.adminPhone && form.adminPhone.length !== 10) {
          setSaving(false);
          return toast.error('Admin mobile number must be 10 digits');
        }
        const admin = form.adminPhone ? { name: form.adminName, phone_number: form.adminPhone } : undefined;
        const res = await axios.post(`${API_URL}/areas`, { name: form.name, city: form.city, type: form.type, phases, admin }, authHeaders());
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
    setAdminForm({ name: admin?.name || '', phone_number: local10(admin?.phone_number) });
    setAdminModal({ area, admin });
  };

  const saveAdmin = async () => {
    if (!adminModal) return;
    const { area, admin } = adminModal;
    if (adminForm.phone_number.length !== 10) return toast.error('Please enter a valid 10-digit mobile number');
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
    if (!window.confirm(`Remove ${admin.name || admin.phone_number || admin.email} as admin of ${area.name}?`)) return;
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
                {area.type === 'village' && <span className="badge progress">Villages</span>}
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>{area.type === 'village' ? `Villages (${area.phases.length})` : 'Phases / Blocks'}</div>
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
                      <div style={{ fontSize: 13, color: a.phone_number ? 'var(--text-muted)' : 'var(--danger)', overflowWrap: 'anywhere' }}>{a.phone_number ? `+91 ${local10(a.phone_number)}` : 'No mobile number: cannot sign in'}</div>
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
                <label className="form-label">Area type *</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {([
                    ['sector', 'Sectors / Phases', 'With blocks. Residents pick block + house no.'],
                    ['village', 'Villages', 'Several villages, one admin. Residents give house no. + landmark.'],
                  ] as [AreaType, string, string][]).map(([value, title, hint]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => switchType(value)}
                      style={{
                        flex: '1 1 200px', textAlign: 'left', padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                        border: `1.5px solid ${form.type === value ? 'var(--primary)' : 'var(--border-color)'}`,
                        background: form.type === value ? 'rgba(37, 99, 235, 0.06)' : 'white',
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{hint}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                {form.type === 'village' ? (
                  <>
                    <label className="form-label">Villages *</label>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 10px' }}>Each village shows up separately on the app registration screen. Residents of every village fill the same form: house no. and nearby landmark (both optional).</p>
                  </>
                ) : (
                  <>
                    <label className="form-label">Phases / Sectors and their blocks *</label>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 10px' }}>Residents choose a phase and then one of its blocks when they register. Add as many phases as needed, and as many blocks in each phase.</p>
                  </>
                )}
                {form.phases.map((p, i) => {
                  const removeRow = form.phases.length > 1 && (
                    <button className="btn-icon" title={form.type === 'village' ? 'Remove village' : 'Remove phase'} onClick={() => setForm({ ...form, phases: form.phases.filter((_, idx) => idx !== i) })}><X size={16} /></button>
                  );
                  if (form.type === 'village') {
                    return (
                      <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <input className="form-input" style={{ flex: 1 }} value={p.name} onChange={(e) => updatePhase(i, { name: e.target.value })} placeholder={`Village ${i + 1} name, e.g. Ghata`} />
                        {removeRow}
                      </div>
                    );
                  }
                  return (
                    <div key={i} style={{ border: '1px solid var(--border-color)', borderRadius: 12, padding: 14, marginBottom: 10, background: '#F8FAFC' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>PHASE {i + 1}</span>
                        <input className="form-input" style={{ flex: 1, background: 'white' }} value={p.name} onChange={(e) => updatePhase(i, { name: e.target.value })} placeholder="Phase name, e.g. Sushant Lok 2" />
                        {removeRow}
                      </div>

                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', margin: '12px 0 6px' }}>
                        BLOCKS {p.blocks.length > 0 && `(${p.blocks.length})`}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: p.blocks.length ? 8 : 0 }}>
                        {p.blocks.map((b) => (
                          <span key={b} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'white', border: '1px solid var(--primary)', color: 'var(--primary)', borderRadius: 999, padding: '4px 6px 4px 12px', fontSize: 13, fontWeight: 600 }}>
                            {b}
                            <button type="button" title={`Remove block ${b}`} onClick={() => removeBlock(i, b)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--primary)', display: 'flex', padding: 2 }}>
                              <X size={13} />
                            </button>
                          </span>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          className="form-input"
                          style={{ flex: 1, background: 'white' }}
                          value={p.draft}
                          onChange={(e) => updatePhase(i, { draft: e.target.value })}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addBlocks(i); } }}
                          placeholder="Block name, e.g. A (press Enter to add)"
                        />
                        <button type="button" className="btn btn-secondary" onClick={() => addBlocks(i)} disabled={!p.draft.trim()} style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                          <Plus size={15} /> Add block
                        </button>
                      </div>
                    </div>
                  );
                })}
                <button className="btn btn-secondary" onClick={() => setForm({ ...form, phases: [...form.phases, { ...emptyPhaseRow }] })} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Plus size={16} /> {form.type === 'village' ? 'Add village' : 'Add phase'}
                </button>
              </div>

              {areaModal.mode === 'create' && (
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 20 }}>
                  <label className="form-label">Area admin (can be added later)</label>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 10px' }}>The admin signs in with an OTP sent to this mobile number.</p>
                  <div className="form-group">
                    <input className="form-input" value={form.adminName} onChange={(e) => setForm({ ...form, adminName: e.target.value })} placeholder="Admin name" />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <input className="form-input" type="tel" inputMode="numeric" value={form.adminPhone} onChange={(e) => setForm({ ...form, adminPhone: digitsOnly(e.target.value) })} placeholder="Admin mobile number (10 digits)" />
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
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Mobile number (login) *</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontWeight: 600 }}>+91</span>
                  <input className="form-input" style={{ paddingLeft: 46 }} type="tel" inputMode="numeric" value={adminForm.phone_number} onChange={(e) => setAdminForm({ ...adminForm, phone_number: digitsOnly(e.target.value) })} placeholder="10-digit mobile number" />
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '6px 0 0' }}>The OTP for signing in is sent to this number.</p>
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
