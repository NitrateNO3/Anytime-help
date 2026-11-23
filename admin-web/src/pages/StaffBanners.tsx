import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { 
  Trash2, 
  Upload, 
  Image as ImageIcon, 
  Edit2, 
  Plus, 
  CheckCircle2, 
  XCircle, 
  X,
  Smartphone,
  Users,
  Home,
  Clock,
  Calendar
} from 'lucide-react';
import '../index.css';

const API_URL = 'https://anytime-help.onrender.com/api';

type AudienceType = 'Staff' | 'Resident' | 'Member';

interface BannerItem {
  _id: string;
  title?: string;
  url: string;
  public_id: string;
  audience?: AudienceType;
  isActive: boolean;
  link?: string;
  order?: number;
  duration?: number;
  expiresAt?: string | null;
  style?: 'image' | 'card';
  tag?: string;
  subtitle?: string;
  ctaLabel?: string;
  icon?: string;
  createdAt: string;
  updatedAt: string;
}

// Text card banners (Residents & Members home): text on the teal header, icon or small image on the right
type CardForm = { style: 'image' | 'card'; tag: string; subtitle: string; ctaLabel: string; icon: string; link: string };
const EMPTY_CARD: CardForm = { style: 'card', tag: '', subtitle: '', ctaLabel: '', icon: 'sparkles-outline', link: '' };
const CARD_ICONS: { value: string; label: string }[] = [
  { value: 'sparkles-outline', label: 'Sparkles' },
  { value: 'medkit-outline', label: 'Health / Clinic' },
  { value: 'fitness-outline', label: 'Fitness' },
  { value: 'cart-outline', label: 'Shopping' },
  { value: 'basket-outline', label: 'Grocery' },
  { value: 'restaurant-outline', label: 'Food' },
  { value: 'cut-outline', label: 'Salon' },
  { value: 'construct-outline', label: 'Repairs' },
  { value: 'water-outline', label: 'Water' },
  { value: 'flash-outline', label: 'Electricity' },
  { value: 'car-outline', label: 'Vehicle' },
  { value: 'school-outline', label: 'Education' },
  { value: 'gift-outline', label: 'Offer / Gift' },
  { value: 'pricetag-outline', label: 'Discount' },
  { value: 'calendar-outline', label: 'Event' },
  { value: 'megaphone-outline', label: 'Announcement' },
  { value: 'leaf-outline', label: 'Green / Garden' },
  { value: 'paw-outline', label: 'Pets' },
  { value: 'home-outline', label: 'Home' },
];

function CardPreview({ title, card, image }: { title: string; card: CardForm; image?: string | null }) {
  return (
    <div style={{ background: 'linear-gradient(160deg, #0D3346, #1C6A66)', borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', gap: 12, minHeight: 150, height: '100%', boxSizing: 'border-box' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {card.tag && <span style={{ display: 'inline-block', background: '#5EE9C9', color: '#064E3B', fontSize: 10, fontWeight: 900, letterSpacing: 0.8, borderRadius: 999, padding: '3px 9px', marginBottom: 8 }}>{card.tag.toUpperCase()}</span>}
        <div style={{ color: '#fff', fontSize: 19, fontWeight: 800, lineHeight: 1.2 }}>{title || 'Banner title'}</div>
        {card.subtitle && <div style={{ color: 'rgba(255,255,255,0.88)', fontSize: 12, marginTop: 4 }}>{card.subtitle}</div>}
        {card.ctaLabel && <span style={{ display: 'inline-block', marginTop: 10, background: '#EEF2F6', color: '#0D3346', fontWeight: 800, fontSize: 13, borderRadius: 999, padding: '6px 14px' }}>{card.ctaLabel} &rsaquo;</span>}
      </div>
      <div style={{ width: 72, height: 78, borderRadius: 18, background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.3)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, textAlign: 'center', flexShrink: 0 }}>
        {image ? <img src={image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (CARD_ICONS.find(i => i.value === card.icon)?.label || 'Icon')}
      </div>
    </div>
  );
}

// Residents and Members share one banner pool, so 'Resident' stands for both
const audienceLabel = (aud?: AudienceType) => (aud === 'Staff' ? 'Staff' : 'Residents & Members');

export default function StaffBanners({ embedded = false }: { embedded?: boolean }) {
  const [activeTab, setActiveTab] = useState<AudienceType>('Staff');
  const [banners, setBanners] = useState<BannerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<BannerItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Add Form state
  const [newTitle, setNewTitle] = useState('');
  const [newAudience, setNewAudience] = useState<AudienceType>('Staff');
  const [newIsActive, setNewIsActive] = useState(true);
  const [newDuration, setNewDuration] = useState<number | string>(4);
  const [newExpiresAt, setNewExpiresAt] = useState<string>('');
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);

  // Edit Form state
  const [editTitle, setEditTitle] = useState('');
  const [editAudience, setEditAudience] = useState<AudienceType>('Staff');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editDuration, setEditDuration] = useState<number | string>(4);
  const [editExpiresAt, setEditExpiresAt] = useState<string>('');
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const [editRemoveImage, setEditRemoveImage] = useState(false);

  // Text card fields, shared by whichever modal is open
  const [cardForm, setCardForm] = useState<CardForm>(EMPTY_CARD);
  const setCard = (patch: Partial<CardForm>) => setCardForm(prev => ({ ...prev, ...patch }));
  const appendCardFields = (fd: FormData) => {
    fd.append('style', cardForm.style);
    fd.append('tag', cardForm.tag.trim());
    fd.append('subtitle', cardForm.subtitle.trim());
    fd.append('ctaLabel', cardForm.ctaLabel.trim());
    fd.append('icon', cardForm.icon);
    fd.append('link', cardForm.link.trim());
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const adminUserStr = localStorage.getItem('adminUser');
  const adminUser = adminUserStr ? JSON.parse(adminUserStr) : null;
  const isSubAdmin = adminUser?.role === 'SubAdmin';

  useEffect(() => {
    fetchBanners(activeTab);
  }, [activeTab]);

  const fetchBanners = async (tab: AudienceType) => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/staff-banners?target=${tab}&all=true`);
      setBanners(res.data);
    } catch (error) {
      console.error(error);
      toast.error(`Failed to load ${tab} banners`);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectNewImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setNewImageFile(file);
      setNewImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSelectEditImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setEditImageFile(file);
      setEditImagePreview(URL.createObjectURL(file));
      setEditRemoveImage(false);
    }
  };

  const handleOpenAddModal = () => {
    setNewTitle('');
    setNewAudience(activeTab);
    setNewIsActive(true);
    setNewDuration(4);
    setNewExpiresAt('');
    setNewImageFile(null);
    setNewImagePreview(null);
    setCardForm(EMPTY_CARD);
    setIsAddModalOpen(true);
  };

  const handleCloseAddModal = () => {
    setIsAddModalOpen(false);
    setNewImageFile(null);
    setNewImagePreview(null);
    setNewTitle('');
    setNewDuration(4);
    setNewExpiresAt('');
  };

  const handleOpenEditModal = (banner: BannerItem) => {
    setEditingBanner(banner);
    setEditTitle(banner.title || '');
    setEditAudience(banner.audience === 'Member' ? 'Resident' : (banner.audience || activeTab));
    setEditIsActive(banner.isActive !== false);
    setEditDuration(banner.duration || 4);
    setEditExpiresAt(banner.expiresAt ? new Date(banner.expiresAt).toISOString().split('T')[0] : '');
    setEditImageFile(null);
    setEditImagePreview(banner.url || null);
    setEditRemoveImage(false);
    setCardForm({
      style: banner.style === 'card' ? 'card' : 'image',
      tag: banner.tag || '',
      subtitle: banner.subtitle || '',
      ctaLabel: banner.ctaLabel || '',
      icon: banner.icon || 'sparkles-outline',
      link: banner.link || '',
    });
  };

  const handleCloseEditModal = () => {
    setEditingBanner(null);
    setEditImageFile(null);
    setEditImagePreview(null);
    setEditDuration(4);
    setEditExpiresAt('');
  };

  // Add / Upload New Banner
  const handleCreateBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    const newIsCard = newAudience !== 'Staff' && cardForm.style === 'card';
    if (newIsCard && !newTitle.trim()) {
      toast.error('Please enter a title for the text card');
      return;
    }
    if (!newIsCard && !newImageFile) {
      toast.error('Please select an image for the banner');
      return;
    }

    setUploading(true);
    const loadingToast = toast.loading(`Uploading ${audienceLabel(newAudience)} banner...`);

    try {
      const formData = new FormData();
      if (newImageFile) formData.append('image', newImageFile);
      formData.append('title', newTitle.trim());
      formData.append('audience', newAudience);
      if (newAudience !== 'Staff') appendCardFields(formData);
      formData.append('isActive', String(newIsActive));
      formData.append('duration', String(newDuration || 4));
      if (newExpiresAt) {
        formData.append('expiresAt', newExpiresAt);
      }

      await axios.post(`${API_URL}/staff-banners/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.success(`${audienceLabel(newAudience)} banner uploaded successfully!`, { id: loadingToast });
      handleCloseAddModal();
      if (newAudience === activeTab) {
        fetchBanners(activeTab);
      } else {
        setActiveTab(newAudience);
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.msg || 'Failed to upload banner', { id: loadingToast });
    } finally {
      setUploading(false);
    }
  };

  // Update / Modify Banner
  const handleUpdateBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBanner) return;
    const editIsCard = editAudience !== 'Staff' && cardForm.style === 'card';
    if (editIsCard && !editTitle.trim()) {
      toast.error('Please enter a title for the text card');
      return;
    }
    if (!editIsCard && !editImageFile && (!editingBanner.url || editRemoveImage)) {
      toast.error('Image banners need an image');
      return;
    }

    setSavingEdit(true);
    const loadingToast = toast.loading('Updating banner...');

    try {
      const formData = new FormData();
      formData.append('title', editTitle.trim());
      formData.append('audience', editAudience);
      formData.append('isActive', String(editIsActive));
      formData.append('duration', String(editDuration || 4));
      formData.append('expiresAt', editExpiresAt || '');
      if (editImageFile) {
        formData.append('image', editImageFile);
      }
      if (editAudience !== 'Staff') {
        appendCardFields(formData);
        if (editRemoveImage && !editImageFile) formData.append('removeImage', 'true');
      } else {
        formData.append('style', 'image');
      }

      await axios.put(`${API_URL}/staff-banners/${editingBanner._id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.success('Banner modified successfully!', { id: loadingToast });
      handleCloseEditModal();
      fetchBanners(activeTab);
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.msg || 'Failed to update banner', { id: loadingToast });
    } finally {
      setSavingEdit(false);
    }
  };

  // Quick Toggle Active Status
  const handleToggleActive = async (banner: BannerItem) => {
    const updatedStatus = !banner.isActive;
    const toastId = toast.loading(updatedStatus ? 'Activating banner...' : 'Deactivating banner...');
    try {
      await axios.put(`${API_URL}/staff-banners/${banner._id}`, {
        isActive: updatedStatus
      });
      toast.success(`Banner is now ${updatedStatus ? 'Active' : 'Inactive'}`, { id: toastId });
      setBanners(prev => prev.map(b => b._id === banner._id ? { ...b, isActive: updatedStatus } : b));
    } catch (err) {
      console.error(err);
      toast.error('Failed to update status', { id: toastId });
      fetchBanners(activeTab);
    }
  };

  // Delete Banner
  const executeDelete = async () => {
    if (!deleteId) return;
    const loadingToast = toast.loading('Deleting banner...');
    try {
      await axios.delete(`${API_URL}/staff-banners/${deleteId}`);
      toast.success('Banner deleted successfully!', { id: loadingToast });
      setDeleteId(null);
      fetchBanners(activeTab);
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete banner', { id: loadingToast });
    }
  };

  const getPortalInfo = () => {
    switch (activeTab) {
      case 'Staff':
        return {
          label: 'Staff Portal',
          icon: <Users size={18} />,
          desc: 'Appears directly on the Staff dashboard under the greeting. Auto-slides smoothly for staff members.'
        };
      default:
        return {
          label: 'Resident & Member Portal',
          icon: <Home size={18} />,
          desc: 'Same banners appear on both the Resident home screen and the RWA Member dashboard (top header slider).'
        };
    }
  };

  const portalInfo = getPortalInfo();

  return (
    <div className={embedded ? '' : 'page-container fade-in'}>
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 className="page-title" style={{ margin: 0, fontSize: embedded ? 20 : undefined }}>Home Top Banners</h1>
            <span style={{ 
              fontSize: 12, 
              padding: '3px 10px', 
              borderRadius: 12, 
              background: '#EEF2FF', 
              color: '#4F46E5', 
              fontWeight: 700 
            }}>
              {portalInfo.label}
            </span>
          </div>
          <p className="page-subtitle" style={{ margin: '4px 0 0' }}>
            Header slider banners. Residents and Members see the same banners.
          </p>
        </div>

        <div>
          {!isSubAdmin && (
            <button 
              className="btn btn-primary" 
              onClick={handleOpenAddModal}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <Plus size={18} />
              Add {audienceLabel(activeTab)} Banner
            </button>
          )}
        </div>
      </header>

      {/* Audience Tabs */}
      <div style={{ 
        display: 'flex', 
        gap: 8, 
        borderBottom: '2px solid #E2E8F0', 
        marginBottom: 20 
      }}>
        <button
          onClick={() => setActiveTab('Staff')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'Staff' ? '3px solid #2563EB' : '3px solid transparent',
            color: activeTab === 'Staff' ? '#2563EB' : '#64748B',
            fontWeight: activeTab === 'Staff' ? 700 : 500,
            fontSize: 15,
            cursor: 'pointer',
            transition: 'all 0.2s',
            marginBottom: -2
          }}
        >
          <Users size={18} />
          Staff Banners
        </button>

        <button
          onClick={() => setActiveTab('Resident')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'Resident' ? '3px solid #2563EB' : '3px solid transparent',
            color: activeTab === 'Resident' ? '#2563EB' : '#64748B',
            fontWeight: activeTab === 'Resident' ? 700 : 500,
            fontSize: 15,
            cursor: 'pointer',
            transition: 'all 0.2s',
            marginBottom: -2
          }}
        >
          <Home size={18} />
          Residents & Members
        </button>

      </div>

      {/* Info Notice Box */}
      <div style={{ 
        background: 'linear-gradient(135deg, #F8FAFC 0%, #EFF6FF 100%)', 
        border: '1px solid #DBEAFE', 
        borderRadius: 12, 
        padding: '14px 18px', 
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }}>
        <div style={{ width: 38, height: 38, borderRadius: 19, background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB', flexShrink: 0 }}>
          <Smartphone size={20} />
        </div>
        <div>
          <div style={{ fontWeight: 600, color: '#1E293B', fontSize: 13 }}>
            Live in {portalInfo.label}
          </div>
          <div style={{ color: '#64748B', fontSize: 13 }}>
            {portalInfo.desc}
          </div>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading ? (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
          {[1, 2, 3].map((idx) => (
            <div key={`skeleton-${idx}`} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="skeleton" style={{ width: '100%', height: '170px' }}></div>
              <div style={{ padding: '16px' }}>
                <div className="skeleton skeleton-row" style={{ width: '70%', height: 18, marginBottom: 8 }}></div>
                <div className="skeleton skeleton-row" style={{ width: '40%', height: 14 }}></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
          {banners.length === 0 ? (
            <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '50px 20px' }}>
              <div style={{ width: 64, height: 64, borderRadius: 32, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <ImageIcon size={32} color="#94A3B8" />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1E293B', marginBottom: 8 }}>No {audienceLabel(activeTab)} Banners Found</h3>
              <p style={{ color: '#64748B', maxWidth: 440, margin: '0 auto 20px', fontSize: 14 }}>
                You haven&apos;t added any custom banners for the {audienceLabel(activeTab)} portal yet. Click &quot;Add {audienceLabel(activeTab)} Banner&quot; to upload your first banner.
              </p>
              {!isSubAdmin && (
                <button className="btn btn-primary" onClick={handleOpenAddModal} style={{ margin: '0 auto' }}>
                  <Plus size={18} />
                  Add {audienceLabel(activeTab)} Banner Now
                </button>
              )}
            </div>
          ) : (
            banners.map((banner) => (
              <div 
                key={banner._id} 
                className="card" 
                style={{ 
                  padding: 0, 
                  overflow: 'hidden', 
                  display: 'flex', 
                  flexDirection: 'column',
                  border: banner.isActive ? '1px solid #E2E8F0' : '1px dashed #CBD5E1',
                  opacity: banner.isActive ? 1 : 0.8
                }}
              >
                {/* Banner Image Preview */}
                <div style={{ position: 'relative', width: '100%', height: '170px', background: '#0F172A' }}>
                  {banner.style === 'card' || !banner.url ? (
                    <CardPreview
                      title={banner.title || ''}
                      image={banner.url}
                      card={{ style: 'card', tag: banner.tag || '', subtitle: banner.subtitle || '', ctaLabel: banner.ctaLabel || '', icon: banner.icon || '', link: banner.link || '' }}
                    />
                  ) : (
                  <img
                    src={banner.url}
                    alt={banner.title || `${audienceLabel(activeTab)} Banner`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  )}
                  
                  {/* Status Badge */}
                  <div style={{ 
                    position: 'absolute', 
                    top: 10, 
                    right: 10,
                    padding: '4px 10px',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    background: banner.isActive ? 'rgba(16, 185, 129, 0.95)' : 'rgba(100, 116, 139, 0.95)',
                    color: '#FFFFFF',
                    backdropFilter: 'blur(4px)',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
                  }}>
                    {banner.isActive ? (
                      <>
                        <CheckCircle2 size={13} />
                        Active
                      </>
                    ) : (
                      <>
                        <XCircle size={13} />
                        Inactive
                      </>
                    )}
                  </div>
                </div>

                {/* Card Info & Actions */}
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1, justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1E293B', margin: '0 0 4px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {banner.title || `Untitled ${audienceLabel(activeTab)} Banner`}
                    </h3>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                      Added on {new Date(banner.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>

                    {/* Duration & Expiry Badges */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: 4, 
                        fontSize: 11, 
                        fontWeight: 600, 
                        background: '#EEF2FF', 
                        color: '#4338CA', 
                        padding: '3px 8px', 
                        borderRadius: 6 
                      }}>
                        <Clock size={12} />
                        {banner.duration || 4}s slide
                      </span>
                      {banner.expiresAt ? (
                        (() => {
                          const isExpired = new Date(banner.expiresAt).getTime() < Date.now();
                          return (
                            <span style={{ 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: 4, 
                              fontSize: 11, 
                              fontWeight: 600, 
                              background: isExpired ? '#FEF2F2' : '#F0FDF4', 
                              color: isExpired ? '#B91C1C' : '#15803D', 
                              padding: '3px 8px', 
                              borderRadius: 6 
                            }}>
                              <Calendar size={12} />
                              {isExpired ? 'Expired: ' : 'Expires: '}
                              {new Date(banner.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          );
                        })()
                      ) : null}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    paddingTop: 12, 
                    borderTop: '1px solid #F1F5F9' 
                  }}>
                    {/* Toggle Switch */}
                    <button 
                      onClick={() => handleToggleActive(banner)}
                      className="btn btn-outline"
                      style={{ 
                        fontSize: 12, 
                        padding: '5px 10px', 
                        height: 'auto',
                        color: banner.isActive ? '#059669' : '#64748B',
                        borderColor: banner.isActive ? '#A7F3D0' : '#CBD5E1',
                        background: banner.isActive ? '#ECFDF5' : '#F8FAFC'
                      }}
                      title="Click to toggle active status"
                    >
                      {banner.isActive ? 'Deactivate' : 'Activate'}
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {!isSubAdmin && (
                        <>
                          <button 
                            className="btn btn-icon" 
                            onClick={() => handleOpenEditModal(banner)}
                            style={{ color: '#2563EB', background: '#EFF6FF' }}
                            title="Modify Banner"
                          >
                            <Edit2 size={16} />
                          </button>
                          
                          <button 
                            className="btn btn-icon" 
                            onClick={() => setDeleteId(banner._id)}
                            style={{ color: 'var(--danger)', background: '#FEF2F2' }}
                            title="Delete Banner"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ===================== ADD BANNER MODAL ===================== */}
      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Upload size={20} color="#2563EB" />
                Add {audienceLabel(newAudience)} Banner
              </h2>
              <button className="btn btn-icon" onClick={handleCloseAddModal}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateBanner}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Audience Selection Tabs */}
                <div>
                  <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>
                    Target Portal
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['Staff', 'Resident'] as AudienceType[]).map((aud) => (
                      <button
                        key={aud}
                        type="button"
                        onClick={() => setNewAudience(aud)}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: 8,
                          border: newAudience === aud ? '2px solid #2563EB' : '1px solid #CBD5E1',
                          background: newAudience === aud ? '#EFF6FF' : '#FFFFFF',
                          color: newAudience === aud ? '#1D4ED8' : '#475569',
                          fontWeight: newAudience === aud ? 700 : 500,
                          fontSize: 13,
                          cursor: 'pointer'
                        }}
                      >
                        {audienceLabel(aud)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Banner type + text card fields (Residents & Members only) */}
                {newAudience !== 'Staff' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Banner Type</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {([['card', 'Text card'], ['image', 'Full image']] as const).map(([val, lbl]) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setCard({ style: val })}
                            style={{
                              flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                              border: cardForm.style === val ? '2px solid #2563EB' : '1px solid #CBD5E1',
                              background: cardForm.style === val ? '#EFF6FF' : '#FFFFFF',
                              color: cardForm.style === val ? '#1D4ED8' : '#475569',
                              fontWeight: cardForm.style === val ? 700 : 500,
                            }}
                          >
                            {lbl}
                          </button>
                        ))}
                      </div>
                    </div>
                    {cardForm.style === 'card' && (
                      <>
                        <CardPreview title={newTitle} card={cardForm} image={newImagePreview} />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <div>
                            <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: 6, fontSize: 13 }}>Tag line</label>
                            <input type="text" className="form-input" placeholder="e.g. Happydent · Sector 52" value={cardForm.tag} onChange={(e) => setCard({ tag: e.target.value })} style={{ width: '100%' }} />
                          </div>
                          <div>
                            <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: 6, fontSize: 13 }}>Button text</label>
                            <input type="text" className="form-input" placeholder="e.g. Book now" value={cardForm.ctaLabel} onChange={(e) => setCard({ ctaLabel: e.target.value })} style={{ width: '100%' }} />
                          </div>
                        </div>
                        <div>
                          <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: 6, fontSize: 13 }}>Subtitle</label>
                          <input type="text" className="form-input" placeholder="e.g. Cleaning, X-ray & consultation · this month" value={cardForm.subtitle} onChange={(e) => setCard({ subtitle: e.target.value })} style={{ width: '100%' }} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <div>
                            <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: 6, fontSize: 13 }}>Icon (used when no image)</label>
                            <select className="form-input" value={cardForm.icon} onChange={(e) => setCard({ icon: e.target.value })} style={{ width: '100%' }}>
                              {CARD_ICONS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: 6, fontSize: 13 }}>Link on tap (optional)</label>
                            <input type="text" className="form-input" placeholder="https://... or tel:..." value={cardForm.link} onChange={(e) => setCard({ link: e.target.value })} style={{ width: '100%' }} />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Image Picker Box */}
                <div>
                  <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>
                    {newAudience !== 'Staff' && cardForm.style === 'card'
                      ? 'Side tile image (optional, replaces the icon)'
                      : <>Banner Image <span style={{ color: 'var(--danger)' }}>*</span></>}
                  </label>
                  
                  {newImagePreview ? (
                    <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', height: 160, background: '#0F172A', border: '1px solid #CBD5E1' }}>
                      <img src={newImagePreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button 
                        type="button" 
                        onClick={() => { setNewImageFile(null); setNewImagePreview(null); }}
                        style={{ 
                          position: 'absolute', 
                          top: 8, 
                          right: 8, 
                          background: 'rgba(0,0,0,0.6)', 
                          color: '#fff', 
                          border: 'none', 
                          borderRadius: '50%', 
                          width: 28, 
                          height: 28, 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          cursor: 'pointer' 
                        }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      style={{ 
                        border: '2px dashed #CBD5E1', 
                        borderRadius: 12, 
                        padding: '30px 20px', 
                        textAlign: 'center', 
                        cursor: 'pointer',
                        background: '#F8FAFC',
                        transition: 'border-color 0.2s'
                      }}
                    >
                      <ImageIcon size={36} color="#94A3B8" style={{ margin: '0 auto 8px' }} />
                      <div style={{ fontWeight: 600, color: '#334155', fontSize: 14 }}>Click to choose banner image</div>
                      <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>Supports JPG, PNG, WEBP (Recommended horizontal ~1200x675)</div>
                    </div>
                  )}

                  <input 
                    ref={fileInputRef}
                    type="file" 
                    accept="image/*" 
                    style={{ display: 'none' }} 
                    onChange={handleSelectNewImage}
                  />
                </div>

                {/* Banner Title */}
                <div>
                  <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>
                    {newAudience !== 'Staff' && cardForm.style === 'card' ? <>Title <span style={{ color: 'var(--danger)' }}>*</span></> : 'Banner Title (Optional)'}
                  </label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. Society Notice / Event Update"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>

                {/* Duration & Expiry Settings */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: 6, fontSize: 13 }}>
                      Slide Duration (Seconds)
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type="number" 
                        min={1}
                        max={120}
                        className="form-input" 
                        placeholder="e.g. 5"
                        value={newDuration}
                        onChange={(e) => setNewDuration(e.target.value)}
                        onBlur={() => {
                          const val = parseInt(String(newDuration), 10);
                          if (isNaN(val) || val < 1) setNewDuration(4);
                          else if (val > 120) setNewDuration(120);
                          else setNewDuration(val);
                        }}
                        style={{ width: '100%', paddingLeft: 34 }}
                      />
                      <Clock size={16} color="#64748B" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                    </div>
                    <span style={{ fontSize: 11, color: '#64748B', marginTop: 4, display: 'block' }}>
                      App me kitne sec show hoga (default: 4s)
                    </span>
                  </div>

                  <div>
                    <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: 6, fontSize: 13 }}>
                      Expiry Date (Optional)
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type="date" 
                        className="form-input" 
                        value={newExpiresAt}
                        onChange={(e) => setNewExpiresAt(e.target.value)}
                        style={{ width: '100%', paddingLeft: 34 }}
                      />
                      <Calendar size={16} color="#64748B" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                    </div>
                    <span style={{ fontSize: 11, color: '#64748B', marginTop: 4, display: 'block' }}>
                      Is date ke baad band ho jayega
                    </span>
                  </div>
                </div>

                {/* Active Checkbox */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                  <input 
                    type="checkbox" 
                    id="newIsActive" 
                    checked={newIsActive}
                    onChange={(e) => setNewIsActive(e.target.checked)}
                    style={{ width: 18, height: 18, cursor: 'pointer' }}
                  />
                  <label htmlFor="newIsActive" style={{ fontSize: 14, fontWeight: 500, color: '#1E293B', cursor: 'pointer' }}>
                    Make banner active immediately in {audienceLabel(newAudience)} portal
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={handleCloseAddModal} disabled={uploading}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={uploading || !newImageFile}>
                  {uploading ? 'Uploading...' : 'Save & Publish Banner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== MODIFY / EDIT BANNER MODAL ===================== */}
      {editingBanner && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Edit2 size={20} color="#2563EB" />
                Modify Banner
              </h2>
              <button className="btn btn-icon" onClick={handleCloseEditModal}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateBanner}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Target Audience Pill */}
                <div>
                  <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>
                    Target Portal
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['Staff', 'Resident'] as AudienceType[]).map((aud) => (
                      <button
                        key={aud}
                        type="button"
                        onClick={() => setEditAudience(aud)}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: 8,
                          border: editAudience === aud ? '2px solid #2563EB' : '1px solid #CBD5E1',
                          background: editAudience === aud ? '#EFF6FF' : '#FFFFFF',
                          color: editAudience === aud ? '#1D4ED8' : '#475569',
                          fontWeight: editAudience === aud ? 700 : 500,
                          fontSize: 13,
                          cursor: 'pointer'
                        }}
                      >
                        {audienceLabel(aud)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Banner type + text card fields (Residents & Members only) */}
                {editAudience !== 'Staff' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Banner Type</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {([['card', 'Text card'], ['image', 'Full image']] as const).map(([val, lbl]) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setCard({ style: val })}
                            style={{
                              flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                              border: cardForm.style === val ? '2px solid #2563EB' : '1px solid #CBD5E1',
                              background: cardForm.style === val ? '#EFF6FF' : '#FFFFFF',
                              color: cardForm.style === val ? '#1D4ED8' : '#475569',
                              fontWeight: cardForm.style === val ? 700 : 500,
                            }}
                          >
                            {lbl}
                          </button>
                        ))}
                      </div>
                    </div>
                    {cardForm.style === 'card' && (
                      <>
                        <CardPreview title={editTitle} card={cardForm} image={editRemoveImage ? null : editImagePreview} />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <div>
                            <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: 6, fontSize: 13 }}>Tag line</label>
                            <input type="text" className="form-input" placeholder="e.g. Happydent · Sector 52" value={cardForm.tag} onChange={(e) => setCard({ tag: e.target.value })} style={{ width: '100%' }} />
                          </div>
                          <div>
                            <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: 6, fontSize: 13 }}>Button text</label>
                            <input type="text" className="form-input" placeholder="e.g. Book now" value={cardForm.ctaLabel} onChange={(e) => setCard({ ctaLabel: e.target.value })} style={{ width: '100%' }} />
                          </div>
                        </div>
                        <div>
                          <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: 6, fontSize: 13 }}>Subtitle</label>
                          <input type="text" className="form-input" placeholder="e.g. Cleaning, X-ray & consultation · this month" value={cardForm.subtitle} onChange={(e) => setCard({ subtitle: e.target.value })} style={{ width: '100%' }} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <div>
                            <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: 6, fontSize: 13 }}>Icon (used when no image)</label>
                            <select className="form-input" value={cardForm.icon} onChange={(e) => setCard({ icon: e.target.value })} style={{ width: '100%' }}>
                              {CARD_ICONS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: 6, fontSize: 13 }}>Link on tap (optional)</label>
                            <input type="text" className="form-input" placeholder="https://... or tel:..." value={cardForm.link} onChange={(e) => setCard({ link: e.target.value })} style={{ width: '100%' }} />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Banner Image Preview / Replace */}
                <div>
                  <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>
                    {editAudience !== 'Staff' && cardForm.style === 'card' ? 'Side tile image (optional, replaces the icon)' : 'Banner Image'}
                  </label>

                  <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', height: 160, background: '#0F172A', border: '1px solid #CBD5E1' }}>
                    {editImagePreview && !editRemoveImage ? (
                    <img
                      src={editImagePreview}
                      alt="Banner Preview"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    ) : (
                      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: 13 }}>No image</div>
                    )}
                    {editAudience !== 'Staff' && cardForm.style === 'card' && editImagePreview && !editRemoveImage && (
                      <button
                        type="button"
                        onClick={() => { setEditRemoveImage(true); setEditImageFile(null); }}
                        style={{ position: 'absolute', bottom: 8, left: 8, background: 'rgba(220, 38, 38, 0.9)', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                      >
                        Remove Image
                      </button>
                    )}

                    <button 
                      type="button" 
                      onClick={() => editFileInputRef.current?.click()}
                      style={{ 
                        position: 'absolute', 
                        bottom: 8, 
                        right: 8, 
                        background: 'rgba(15, 23, 42, 0.85)', 
                        color: '#fff', 
                        border: 'none', 
                        borderRadius: 6, 
                        padding: '6px 12px',
                        fontSize: 12,
                        fontWeight: 600,
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 6,
                        cursor: 'pointer',
                        backdropFilter: 'blur(4px)'
                      }}
                    >
                      <Upload size={14} />
                      Replace Image
                    </button>
                  </div>

                  <input 
                    ref={editFileInputRef}
                    type="file" 
                    accept="image/*" 
                    style={{ display: 'none' }} 
                    onChange={handleSelectEditImage}
                  />
                  {editImageFile && (
                    <div style={{ fontSize: 12, color: '#059669', marginTop: 4, fontWeight: 500 }}>
                      New image selected: {editImageFile.name}
                    </div>
                  )}
                </div>

                {/* Banner Title */}
                <div>
                  <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>
                    Banner Title
                  </label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Banner title / description"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>

                {/* Duration & Expiry Settings */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: 6, fontSize: 13 }}>
                      Slide Duration (Seconds)
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type="number" 
                        min={1}
                        max={120}
                        className="form-input" 
                        placeholder="e.g. 5"
                        value={editDuration}
                        onChange={(e) => setEditDuration(e.target.value)}
                        onBlur={() => {
                          const val = parseInt(String(editDuration), 10);
                          if (isNaN(val) || val < 1) setEditDuration(4);
                          else if (val > 120) setEditDuration(120);
                          else setEditDuration(val);
                        }}
                        style={{ width: '100%', paddingLeft: 34 }}
                      />
                      <Clock size={16} color="#64748B" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                    </div>
                    <span style={{ fontSize: 11, color: '#64748B', marginTop: 4, display: 'block' }}>
                      App me kitne sec show hoga (default: 4s)
                    </span>
                  </div>

                  <div>
                    <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: 6, fontSize: 13 }}>
                      Expiry Date (Optional)
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type="date" 
                        className="form-input" 
                        value={editExpiresAt}
                        onChange={(e) => setEditExpiresAt(e.target.value)}
                        style={{ width: '100%', paddingLeft: 34 }}
                      />
                      <Calendar size={16} color="#64748B" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                    </div>
                    <span style={{ fontSize: 11, color: '#64748B', marginTop: 4, display: 'block' }}>
                      Is date ke baad band ho jayega
                    </span>
                  </div>
                </div>

                {/* Active Checkbox */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                  <input 
                    type="checkbox" 
                    id="editIsActive" 
                    checked={editIsActive}
                    onChange={(e) => setEditIsActive(e.target.checked)}
                    style={{ width: 18, height: 18, cursor: 'pointer' }}
                  />
                  <label htmlFor="editIsActive" style={{ fontSize: 14, fontWeight: 500, color: '#1E293B', cursor: 'pointer' }}>
                    Active (Show in {audienceLabel(editAudience)} Portal)
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={handleCloseEditModal} disabled={savingEdit}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingEdit}>
                  {savingEdit ? 'Saving Changes...' : 'Save Modifications'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== DELETE CONFIRMATION MODAL ===================== */}
      {deleteId && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ color: 'var(--danger)' }}>Delete {activeTab} Banner</h2>
            </div>
            <div className="modal-body">
              <p style={{ fontWeight: 600, marginBottom: 8, color: 'var(--text-main)' }}>
                Are you sure you want to delete this {activeTab} banner?
              </p>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                This banner will be permanently removed from the cloud storage and will no longer show in the {activeTab} app.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ background: 'var(--danger)' }} onClick={executeDelete}>
                Yes, Delete Banner
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
