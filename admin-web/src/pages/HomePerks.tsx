import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Plus, Trash2, ArrowUp, ArrowDown, Globe, Heart } from 'lucide-react';
import { API_URL } from '../lib/area';
import { confirmDialog } from '../components/ConfirmDialog';
import '../index.css';

// "Why residents love Anytime Help" section on the resident/member home
// screen. Universal (same in every area); only the platform Super Admin edits it.

type Perk = { big: string; sub: string; icon: string; theme: string };

// Same colours as the app (components/home/ResidentHomeExtras.tsx PERK_THEMES)
const THEME_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  green: { bg: '#ECFDF5', fg: '#047857', label: 'Green' },
  yellow: { bg: '#FEF9C3', fg: '#A16207', label: 'Yellow' },
  pink: { bg: '#FCE7F3', fg: '#BE185D', label: 'Pink' },
  blue: { bg: '#EEF2FF', fg: '#1E40AF', label: 'Blue' },
  purple: { bg: '#F3E8FF', fg: '#7E22CE', label: 'Purple' },
  orange: { bg: '#FFEDD5', fg: '#C2410C', label: 'Orange' },
  teal: { bg: '#CCFBF1', fg: '#0F766E', label: 'Teal' },
  red: { bg: '#FEE2E2', fg: '#B91C1C', label: 'Red' },
};

const ICON_LABELS: Record<string, string> = {
  'flask-outline': 'Lab / test',
  'time-outline': 'Clock / priority',
  'pricetag-outline': 'Offer tag',
  'medkit-outline': 'Medical kit',
  'heart-outline': 'Heart',
  'shield-checkmark-outline': 'Safety / verified',
  'gift-outline': 'Gift',
  'star-outline': 'Star',
  'people-outline': 'People',
  'home-outline': 'Home',
  'call-outline': 'Phone',
  'cart-outline': 'Shopping cart',
  'construct-outline': 'Repair / tools',
  'flash-outline': 'Fast / electricity',
  'leaf-outline': 'Green / clean',
  'sparkles-outline': 'Sparkles',
};

const BASE = `${API_URL}/home-perks`;

export default function HomePerks() {
  const [enabled, setEnabled] = useState(true);
  const [title, setTitle] = useState('');
  const [perks, setPerks] = useState<Perk[]>([]);
  const [icons, setIcons] = useState<string[]>(Object.keys(ICON_LABELS));
  const [themes, setThemes] = useState<string[]>(Object.keys(THEME_COLORS));
  const [maxPerks, setMaxPerks] = useState(6);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = async () => {
    try {
      const res = await axios.get(BASE);
      const d = res.data || {};
      setEnabled(d.enabled !== false);
      setTitle(d.title || '');
      setPerks(Array.isArray(d.perks) ? d.perks : []);
      if (Array.isArray(d.icons) && d.icons.length) setIcons(d.icons);
      if (Array.isArray(d.themes) && d.themes.length) setThemes(d.themes);
      if (d.maxPerks) setMaxPerks(d.maxPerks);
      setDirty(false);
    } catch {
      toast.error('Failed to load section');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const change = () => setDirty(true);
  const updatePerk = (i: number, patch: Partial<Perk>) => {
    setPerks(list => list.map((p, j) => (j === i ? { ...p, ...patch } : p)));
    change();
  };
  const addPerk = () => {
    if (perks.length >= maxPerks) return;
    const used = new Set(perks.map(p => p.theme));
    setPerks(list => [...list, { big: '', sub: '', icon: icons[0], theme: themes.find(t => !used.has(t)) || themes[0] }]);
    change();
  };
  const removePerk = async (i: number) => {
    const p = perks[i];
    if ((p.big || p.sub) && !(await confirmDialog({ title: 'Remove this card?', message: `"${p.big || p.sub}" will be removed when you save.`, confirmText: 'Remove', danger: true }))) return;
    setPerks(list => list.filter((_, j) => j !== i));
    change();
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= perks.length) return;
    setPerks(list => {
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    change();
  };

  const save = async () => {
    const filled = perks.filter(p => p.big.trim() || p.sub.trim());
    if (enabled && filled.length === 0) { toast.error('Add at least one card, or turn the section off'); return; }
    setSaving(true);
    try {
      const res = await axios.put(BASE, { enabled, title, perks: filled });
      setPerks(res.data?.perks || filled);
      setTitle(res.data?.title || title);
      setDirty(false);
      toast.success('Saved. All areas will see the change.');
    } catch (e: any) {
      toast.error(e?.response?.data?.msg || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="page-container"><p style={{ color: 'var(--text-muted)' }}>Loading...</p></div>;

  return (
    <div className="page-container fade-in">
      <header className="page-header" style={{ marginBottom: 18 }}>
        <div>
          <h1 className="page-title">Why Residents Love</h1>
          <p className="page-subtitle" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Globe size={15} /> The "Why residents love Anytime Help" cards on the home screen. Same in every area.
          </p>
        </div>
        <button className="btn btn-primary" onClick={save} disabled={saving || !dirty}>
          {saving ? 'Saving...' : dirty ? 'Save changes' : 'Saved'}
        </button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(280px, 1fr)', gap: 20, alignItems: 'start' }}>
        {/* Editor */}
        <div>
          <div className="card" style={{ padding: 18, marginBottom: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, marginBottom: 14 }}>
              <input type="checkbox" checked={enabled} onChange={e => { setEnabled(e.target.checked); change(); }} />
              Show this section in the app
            </label>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Section title</label>
              <input className="form-input" value={title} placeholder="Why residents love Anytime Help" onChange={e => { setTitle(e.target.value); change(); }} />
            </div>
          </div>

          {perks.map((p, i) => {
            const c = THEME_COLORS[p.theme] || THEME_COLORS.green;
            return (
              <div key={i} className="card" style={{ padding: 16, marginBottom: 12, borderLeft: `5px solid ${c.fg}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <b style={{ fontSize: 14 }}>Card {i + 1}</b>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-icon" onClick={() => move(i, -1)} disabled={i === 0} title="Move up"><ArrowUp size={16} /></button>
                    <button className="btn btn-icon" onClick={() => move(i, 1)} disabled={i === perks.length - 1} title="Move down"><ArrowDown size={16} /></button>
                    <button className="btn btn-icon" onClick={() => removePerk(i)} title="Remove" style={{ color: '#DC2626' }}><Trash2 size={16} /></button>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
                  <div className="form-group" style={{ marginBottom: 10 }}>
                    <label className="form-label">Big text</label>
                    <input className="form-input" maxLength={30} placeholder="e.g. 15% off" value={p.big} onChange={e => updatePerk(i, { big: e.target.value })} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 10 }}>
                    <label className="form-label">Small text</label>
                    <input className="form-input" maxLength={90} placeholder="e.g. Lab tests, scans and health check-ups" value={p.sub} onChange={e => updatePerk(i, { sub: e.target.value })} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Icon</label>
                    <select className="form-input" value={p.icon} onChange={e => updatePerk(i, { icon: e.target.value })}>
                      {icons.map(ic => <option key={ic} value={ic}>{ICON_LABELS[ic] || ic}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Colour</label>
                    <select className="form-input" value={p.theme} onChange={e => updatePerk(i, { theme: e.target.value })}>
                      {themes.map(t => <option key={t} value={t}>{THEME_COLORS[t]?.label || t}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            );
          })}

          <button className="btn btn-outline" onClick={addPerk} disabled={perks.length >= maxPerks} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={16} /> Add card {perks.length >= maxPerks ? `(max ${maxPerks})` : ''}
          </button>
          {perks.length % 2 === 1 && (
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 8 }}>
              Tip: cards show two per row in the app, so an even number looks best.
            </p>
          )}
        </div>

        {/* Preview */}
        <div className="card" style={{ padding: 16, position: 'sticky', top: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10 }}>APP PREVIEW</div>
          {!enabled ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Section is turned off and will not show in the app.</p>
          ) : (
            <>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>{title || 'Why residents love Anytime Help'}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {perks.filter(p => p.big || p.sub).map((p, i) => {
                  const c = THEME_COLORS[p.theme] || THEME_COLORS.green;
                  return (
                    <div key={i} style={{ background: c.bg, borderRadius: 16, padding: 12, minHeight: 110 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                        <Heart size={15} color={c.fg} />
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: c.fg }}>{p.big}</div>
                      <div style={{ fontSize: 12, color: '#334155', marginTop: 4 }}>{p.sub}</div>
                    </div>
                  );
                })}
              </div>
              <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 10 }}>The icon in the app follows your "Icon" choice.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
