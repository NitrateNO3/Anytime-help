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
  Smartphone
} from 'lucide-react';
import '../index.css';

const API_URL = 'https://anytime-help.onrender.com/api';

interface StaffBannerItem {
  _id: string;
  title?: string;
  url: string;
  public_id: string;
  isActive: boolean;
  link?: string;
  order?: number;
  createdAt: string;
  updatedAt: string;
}

export default function StaffBanners() {
  const [banners, setBanners] = useState<StaffBannerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<StaffBannerItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Add Form state
  const [newTitle, setNewTitle] = useState('');
  const [newIsActive, setNewIsActive] = useState(true);
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);

  // Edit Form state
  const [editTitle, setEditTitle] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const adminUserStr = localStorage.getItem('adminUser');
  const adminUser = adminUserStr ? JSON.parse(adminUserStr) : null;
  const isSubAdmin = adminUser?.role === 'SubAdmin';

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      setLoading(true);
      // Fetch all banners (both active and inactive) for admin
      const res = await axios.get(`${API_URL}/staff-banners?all=true`);
      setBanners(res.data);
    } catch (error) {
      console.error(error);
      // Try fallback route
      try {
        const fallbackRes = await axios.get(`${API_URL}/banners?type=staff&all=true`);
        setBanners(fallbackRes.data);
      } catch (fallbackErr) {
        console.error(fallbackErr);
        toast.error('Failed to load staff banners');
      }
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
    }
  };

  const handleOpenAddModal = () => {
    setNewTitle('');
    setNewIsActive(true);
    setNewImageFile(null);
    setNewImagePreview(null);
    setIsAddModalOpen(true);
  };

  const handleCloseAddModal = () => {
    setIsAddModalOpen(false);
    setNewImageFile(null);
    setNewImagePreview(null);
    setNewTitle('');
  };

  const handleOpenEditModal = (banner: StaffBannerItem) => {
    setEditingBanner(banner);
    setEditTitle(banner.title || '');
    setEditIsActive(banner.isActive !== false);
    setEditImageFile(null);
    setEditImagePreview(banner.url);
  };

  const handleCloseEditModal = () => {
    setEditingBanner(null);
    setEditImageFile(null);
    setEditImagePreview(null);
  };

  // Add / Upload New Banner
  const handleCreateBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newImageFile) {
      toast.error('Please select an image for the banner');
      return;
    }

    setUploading(true);
    const loadingToast = toast.loading('Uploading staff banner...');

    try {
      const formData = new FormData();
      formData.append('image', newImageFile);
      formData.append('title', newTitle.trim());
      formData.append('isActive', String(newIsActive));

      await axios.post(`${API_URL}/staff-banners/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.success('Staff banner uploaded successfully!', { id: loadingToast });
      handleCloseAddModal();
      fetchBanners();
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

    setSavingEdit(true);
    const loadingToast = toast.loading('Updating staff banner...');

    try {
      const formData = new FormData();
      formData.append('title', editTitle.trim());
      formData.append('isActive', String(editIsActive));
      if (editImageFile) {
        formData.append('image', editImageFile);
      }

      await axios.put(`${API_URL}/staff-banners/${editingBanner._id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.success('Staff banner modified successfully!', { id: loadingToast });
      handleCloseEditModal();
      fetchBanners();
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.msg || 'Failed to update banner', { id: loadingToast });
    } finally {
      setSavingEdit(false);
    }
  };

  // Quick Toggle Active Status
  const handleToggleActive = async (banner: StaffBannerItem) => {
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
      fetchBanners();
    }
  };

  // Delete Banner
  const executeDelete = async () => {
    if (!deleteId) return;
    const loadingToast = toast.loading('Deleting staff banner...');
    try {
      await axios.delete(`${API_URL}/staff-banners/${deleteId}`);
      toast.success('Staff banner deleted successfully!', { id: loadingToast });
      setDeleteId(null);
      fetchBanners();
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete staff banner', { id: loadingToast });
    }
  };

  return (
    <div className="page-container fade-in">
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 className="page-title" style={{ margin: 0 }}>Staff Banners</h1>
            <span style={{ 
              fontSize: 12, 
              padding: '3px 8px', 
              borderRadius: 12, 
              background: '#EEF2FF', 
              color: '#4F46E5', 
              fontWeight: 600 
            }}>
              Staff Portal
            </span>
          </div>
          <p className="page-subtitle" style={{ margin: '4px 0 0' }}>
            Upload, modify, and manage promotional or instructional banners for the Staff Portal
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
              Add Staff Banner
            </button>
          )}
        </div>
      </header>

      {/* Info Notice Box */}
      <div style={{ 
        background: 'linear-gradient(135deg, #F8FAFC 0%, #EFF6FF 100%)', 
        border: '1px solid #DBEAFE', 
        borderRadius: 12, 
        padding: '16px 20px', 
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 20, background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Smartphone size={22} color="#2563EB" />
          </div>
          <div>
            <div style={{ fontWeight: 600, color: '#1E293B', fontSize: 14 }}>
              Live on Staff Mobile App
            </div>
            <div style={{ color: '#64748B', fontSize: 13 }}>
              Active banners appear right below &quot;Staff Portal / Welcome&quot; greeting on the staff dashboard. If no active banners are uploaded, the default graphic is displayed.
            </div>
          </div>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading ? (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
          {[1, 2, 3].map((idx) => (
            <div key={`skeleton-${idx}`} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="skeleton" style={{ width: '100%', height: '180px' }}></div>
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
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1E293B', marginBottom: 8 }}>No Staff Banners Found</h3>
              <p style={{ color: '#64748B', maxWidth: 420, margin: '0 auto 20px', fontSize: 14 }}>
                You haven&apos;t added any custom staff banners yet. Click &quot;Add Staff Banner&quot; to upload your first custom banner for your staff team.
              </p>
              {!isSubAdmin && (
                <button className="btn btn-primary" onClick={handleOpenAddModal} style={{ margin: '0 auto' }}>
                  <Plus size={18} />
                  Add Staff Banner Now
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
                  <img 
                    src={banner.url} 
                    alt={banner.title || 'Staff Banner'} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  />
                  
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
                      {banner.title || 'Untitled Staff Banner'}
                    </h3>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      Added on {new Date(banner.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
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
                Add Staff Banner
              </h2>
              <button className="btn btn-icon" onClick={handleCloseAddModal}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateBanner}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Image Picker Box */}
                <div>
                  <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>
                    Banner Image <span style={{ color: 'var(--danger)' }}>*</span>
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
                      <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>Supports JPG, PNG, WEBP (Recommended ~1200x500)</div>
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
                    Banner Title (Optional)
                  </label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. Safety Guidelines / Staff Portal Notice"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    style={{ width: '100%' }}
                  />
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
                    Make banner active immediately in Staff app
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
                Modify Staff Banner
              </h2>
              <button className="btn btn-icon" onClick={handleCloseEditModal}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateBanner}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Banner Image Preview / Replace */}
                <div>
                  <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>
                    Banner Image
                  </label>
                  
                  <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', height: 160, background: '#0F172A', border: '1px solid #CBD5E1' }}>
                    <img 
                      src={editImagePreview || editingBanner.url} 
                      alt="Banner Preview" 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    />
                    
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
                    Active (Show in Staff Portal)
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
              <h2 className="modal-title" style={{ color: 'var(--danger)' }}>Delete Staff Banner</h2>
            </div>
            <div className="modal-body">
              <p style={{ fontWeight: 600, marginBottom: 8, color: 'var(--text-main)' }}>
                Are you sure you want to delete this staff banner?
              </p>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                This banner will be permanently deleted from the cloud storage and will no longer show in the staff app.
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
