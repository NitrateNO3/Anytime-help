// Admin: add / view / delete 24-hour stories on one community channel.
// Followers of the channel see these stories in the app's Status bar.
import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { X, Image as ImageIcon, Type, Trash2, Eye, Heart, Send, Upload } from 'lucide-react';
import { confirmDialog } from './ConfirmDialog';

const TEXT_BG_COLORS = ['#2563EB', '#16A34A', '#DC2626', '#9333EA', '#EA580C', '#0F172A', '#DB2777', '#0891B2'];

interface ChannelStory {
  _id: string;
  author_name: string;
  media_type: 'image' | 'text';
  media_url: string;
  caption: string;
  bg_color: string;
  createdAt: string;
  expiresAt: string;
  view_count: number;
  like_count: number;
}

const timeAgo = (iso: string) => {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
};

const hoursLeft = (iso: string) => {
  const h = Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 3600000));
  return h <= 0 ? 'expires soon' : `${h}h left`;
};

export default function ChannelStoriesModal({ section, apiUrl, headers, onClose }: {
  section: { _id: string; name: string };
  apiUrl: string;
  headers: () => { headers: Record<string, any> };
  onClose: () => void;
}) {
  const [stories, setStories] = useState<ChannelStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'image' | 'text'>('image');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [caption, setCaption] = useState('');
  const [bg, setBg] = useState(TEXT_BG_COLORS[0]);
  const [posting, setPosting] = useState(false);

  const load = async () => {
    try {
      const res = await axios.get(`${apiUrl}/stories/channel/${section._id}`, headers());
      setStories(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      toast.error(err.response?.data?.msg || 'Could not load stories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [section._id]);

  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const canSubmit = mode === 'image' ? !!file : caption.trim().length > 0;

  const submit = async () => {
    if (!canSubmit || posting) return;
    setPosting(true);
    try {
      const fd = new FormData();
      fd.append('section', section._id);
      fd.append('caption', caption.trim());
      if (mode === 'image' && file) fd.append('image', file);
      else fd.append('bg_color', bg);
      await axios.post(`${apiUrl}/stories`, fd, headers());
      toast.success('Story added');
      setFile(null);
      setCaption('');
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.msg || 'Could not add story');
    } finally {
      setPosting(false);
    }
  };

  const remove = async (st: ChannelStory) => {
    const ok = await confirmDialog({
      title: 'Delete story?',
      message: 'This story will be removed for everyone.',
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await axios.delete(`${apiUrl}/stories/${st._id}`, headers());
      setStories(prev => prev.filter(x => x._id !== st._id));
      toast.success('Story deleted');
    } catch (err: any) {
      toast.error(err.response?.data?.msg || 'Could not delete story');
    }
  };

  const tabBtn = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
    cursor: 'pointer', border: '1px solid ' + (active ? '#2563EB' : '#E2E8F0'),
    background: active ? '#2563EB' : '#FFFFFF', color: active ? '#FFFFFF' : '#334155',
  });

  return (
    <div className="comm-modal-overlay">
      <div className="comm-modal-box" style={{ maxWidth: 680 }}>
        <div className="comm-modal-header">
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Stories · {section.name}</h3>
            <small style={{ color: '#64748b' }}>
              Shown for 24 hours in the app's Status bar to everyone following this channel. Channel Admins can add stories from the app too.
            </small>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <X size={20} />
          </button>
        </div>

        <div className="comm-modal-body">
          {/* Composer */}
          <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, padding: 14, marginBottom: 18 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button type="button" style={tabBtn(mode === 'image')} onClick={() => setMode('image')}><ImageIcon size={15} /> Photo</button>
              <button type="button" style={tabBtn(mode === 'text')} onClick={() => setMode('text')}><Type size={15} /> Text</button>
            </div>

            {mode === 'image' ? (
              <div>
                {preview ? (
                  <div style={{ position: 'relative', background: '#0F172A', borderRadius: 10, height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    <img src={preview} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    <button type="button" onClick={() => setFile(null)}
                      style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: 16, padding: 6, cursor: 'pointer', color: '#fff', display: 'flex' }}>
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, height: 160, border: '2px dashed #CBD5E1', borderRadius: 10, cursor: 'pointer', color: '#64748B', fontSize: 13 }}>
                    <Upload size={26} color="#2563EB" />
                    <span>Click to choose a photo</span>
                    <input type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) setFile(f); e.target.value = ''; }} />
                  </label>
                )}
                <input className="form-input" style={{ marginTop: 10, fontSize: 13 }} placeholder="Add a caption (optional)"
                  value={caption} maxLength={700} onChange={e => setCaption(e.target.value)} />
              </div>
            ) : (
              <div>
                <textarea
                  value={caption}
                  maxLength={700}
                  onChange={e => setCaption(e.target.value)}
                  placeholder="Type an update…"
                  style={{ width: '100%', minHeight: 150, borderRadius: 10, border: 'none', padding: 16, background: bg, color: '#FFFFFF', fontSize: 20, fontWeight: 700, textAlign: 'center', resize: 'vertical', boxSizing: 'border-box', outline: 'none' }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  {TEXT_BG_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setBg(c)} aria-label={c}
                      style={{ width: 26, height: 26, borderRadius: 13, background: c, cursor: 'pointer', border: bg === c ? '3px solid #94A3B8' : '2px solid transparent' }} />
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <button className="btn btn-primary" disabled={!canSubmit || posting} onClick={submit}
                style={{ padding: '8px 16px', fontSize: 13, opacity: !canSubmit || posting ? 0.5 : 1 }}>
                <Send size={14} /> {posting ? 'Posting…' : 'Add Story'}
              </button>
            </div>
          </div>

          {/* Active stories */}
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 10 }}>
            Active stories {stories.length > 0 ? `(${stories.length})` : ''}
          </div>
          {loading ? (
            <div style={{ color: '#64748B', fontSize: 13, padding: '10px 0' }}>Loading…</div>
          ) : stories.length === 0 ? (
            <div style={{ color: '#64748B', fontSize: 13, padding: '10px 0' }}>No active stories on this channel.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
              {stories.map(st => (
                <div key={st._id} style={{ border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden', background: '#FFFFFF' }}>
                  <div style={{ height: 180, background: st.media_type === 'text' ? (st.bg_color || '#2563EB') : '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: st.media_type === 'text' ? 10 : 0 }}>
                    {st.media_type === 'image'
                      ? <img src={st.media_url} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                      : <span style={{ color: '#fff', fontWeight: 700, fontSize: 14, textAlign: 'center', overflow: 'hidden', maxHeight: '100%' }}>{st.caption}</span>}
                  </div>
                  <div style={{ padding: '8px 10px', fontSize: 12, color: '#475569' }}>
                    <div style={{ fontWeight: 600, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{st.author_name || 'Admin'}</div>
                    <div>{timeAgo(st.createdAt)} · {hoursLeft(st.expiresAt)}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Eye size={13} /> {st.view_count}
                        <Heart size={13} color="#F43F5E" style={{ marginLeft: 8 }} /> {st.like_count}
                      </span>
                      <button onClick={() => remove(st)} title="Delete story"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', display: 'flex' }}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
