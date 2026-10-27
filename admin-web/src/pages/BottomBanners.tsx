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
  ExternalLink,
  Sliders,
  Clock,
  Layers,
  Sparkles,
  RefreshCw,
  FolderPlus
} from 'lucide-react';
import { io } from 'socket.io-client';
import '../index.css';

const API_BASE = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : 'https://anytime-help.onrender.com/api');
const SOCKET_BASE = API_BASE.replace('/api', '');

export type TargetAudience = 'All' | 'Resident' | 'Member' | 'Staff';

export interface BottomBannerItem {
  _id: string;
  title?: string;
  url: string;
  public_id?: string;
  link?: string;
  order?: number;
  targetAudience: TargetAudience;
  duration?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SelectedImageItem {
  id: string;
  file?: File;
  preview: string;
  title: string;
  link: string;
}

interface BottomBannersProps {
  embedded?: boolean;
}

export default function BottomBanners({ embedded = false }: BottomBannersProps) {
  const [banners, setBanners] = useState<BottomBannerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeAudience, setActiveAudience] = useState<'All' | 'Resident' | 'Member' | 'Staff'>('All');
  
  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<BottomBannerItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  // Multi-selection & Bulk Delete state
  const [selectedBannerIds, setSelectedBannerIds] = useState<string[]>([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Multi-Image Add Form state
  const [selectedImages, setSelectedImages] = useState<SelectedImageItem[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newLink, setNewLink] = useState('');
  const [newAudience, setNewAudience] = useState<TargetAudience>('All');
  const [newDuration, setNewDuration] = useState<number>(4);
  const [newOrder, setNewOrder] = useState<number>(0);
  const [newIsActive, setNewIsActive] = useState(true);
  const [singleUrlInput, setSingleUrlInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Edit Form state
  const [editTitle, setEditTitle] = useState('');
  const [editLink, setEditLink] = useState('');
  const [editAudience, setEditAudience] = useState<TargetAudience>('All');
  const [editDuration, setEditDuration] = useState<number>(4);
  const [editOrder, setEditOrder] = useState<number>(0);
  const [editIsActive, setEditIsActive] = useState(true);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const [editImageUrl, setEditImageUrl] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const getHeaders = () => {
    const token = localStorage.getItem('adminToken');
    return token ? { 'x-auth-token': token } : {};
  };

  const fetchBanners = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}/bottom-banners?all=true`, {
        headers: getHeaders()
      });
      if (Array.isArray(res.data)) {
        setBanners(res.data);
      } else {
        setBanners([]);
      }
    } catch (error: any) {
      console.error('Error fetching bottom banners:', error);
      try {
        const fallback = await axios.get(`${API_BASE}/bottom-banners`);
        if (Array.isArray(fallback.data)) setBanners(fallback.data);
      } catch (err) {
        toast.error('Failed to load bottom banners');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBanners();

    const socket = io(SOCKET_BASE, { transports: ['websocket', 'polling'] });
    socket.on('bottom_banners_changed', () => {
      fetchBanners();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Multi-file selection handler
  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newItems: SelectedImageItem[] = Array.from(files).map((file, idx) => ({
      id: `${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 6)}`,
      file,
      preview: URL.createObjectURL(file),
      title: '',
      link: ''
    }));

    setSelectedImages((prev) => [...prev, ...newItems]);
    toast.success(`Added ${newItems.length} image${newItems.length > 1 ? 's' : ''}`);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSelectNewImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFilesSelected(e.target.files);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files);
    }
  };

  const handleAddUrlImage = () => {
    if (!singleUrlInput.trim()) return;
    const url = singleUrlInput.trim();
    setSelectedImages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        preview: url,
        title: '',
        link: ''
      }
    ]);
    setSingleUrlInput('');
    toast.success('Added image URL');
  };

  const handleRemoveSelectedImage = (id: string) => {
    setSelectedImages((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSelectEditImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setEditImageFile(file);
      setEditImagePreview(URL.createObjectURL(file));
      setEditImageUrl('');
    }
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') resolve(reader.result);
        else reject(new Error('Failed reading file'));
      };
      reader.onerror = () => reject(new Error('Failed reading file'));
      reader.readAsDataURL(file);
    });
  };

  // Submit Multiple Banners
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedImages.length === 0) {
      toast.error('Please select at least one banner image');
      return;
    }

    setIsSubmitting(true);
    const count = selectedImages.length;
    const toastId = toast.loading(`Uploading ${count} banner${count > 1 ? 's' : ''}...`);

    try {
      const formData = new FormData();
      formData.append('targetAudience', newAudience);
      formData.append('duration', String(newDuration));
      formData.append('baseOrder', String(newOrder));
      formData.append('isActive', String(newIsActive));

      const hasOnlyFiles = selectedImages.every((img) => !!img.file);

      if (hasOnlyFiles) {
        selectedImages.forEach((img, idx) => {
          if (img.file) {
            formData.append('images', img.file);
            formData.append(`title_${idx}`, img.title.trim() || newTitle.trim());
            formData.append(`link_${idx}`, img.link.trim() || newLink.trim());
          }
        });

        await axios.post(`${API_BASE}/bottom-banners/bulk-upload`, formData, {
          headers: {
            ...getHeaders(),
            'Content-Type': 'multipart/form-data',
          },
        });
      } else {
        // Mixed files and URLs
        const imgStrings: string[] = [];
        for (let i = 0; i < selectedImages.length; i++) {
          const item = selectedImages[i];
          if (item.file) {
            const b64 = await readFileAsBase64(item.file);
            imgStrings.push(b64);
          } else {
            imgStrings.push(item.preview);
          }
        }

        await axios.post(`${API_BASE}/bottom-banners/bulk-upload`, {
          images: imgStrings,
          titles: selectedImages.map((img) => img.title.trim() || newTitle.trim()),
          links: selectedImages.map((img) => img.link.trim() || newLink.trim()),
          targetAudience: newAudience,
          duration: newDuration,
          baseOrder: newOrder,
          isActive: newIsActive
        }, {
          headers: getHeaders()
        });
      }

      toast.success(`Successfully uploaded ${count} banner${count > 1 ? 's' : ''}!`, { id: toastId });
      setIsAddModalOpen(false);
      resetNewForm();
      fetchBanners();
    } catch (error: any) {
      console.error('Bulk upload fallback:', error);
      // Fallback: sequential single uploads
      try {
        let uploaded = 0;
        for (let i = 0; i < selectedImages.length; i++) {
          const item = selectedImages[i];
          const singleData = new FormData();
          if (item.file) {
            singleData.append('image', item.file);
          } else {
            singleData.append('image', item.preview);
          }
          singleData.append('title', item.title.trim() || newTitle.trim());
          singleData.append('link', item.link.trim() || newLink.trim());
          singleData.append('targetAudience', newAudience);
          singleData.append('duration', String(newDuration));
          singleData.append('order', String(newOrder + i));
          singleData.append('isActive', String(newIsActive));

          await axios.post(`${API_BASE}/bottom-banners/upload`, singleData, {
            headers: {
              ...getHeaders(),
              'Content-Type': 'multipart/form-data'
            }
          });
          uploaded++;
        }
        toast.success(`Successfully uploaded ${uploaded} banner${uploaded > 1 ? 's' : ''}!`, { id: toastId });
        setIsAddModalOpen(false);
        resetNewForm();
        fetchBanners();
      } catch (fbErr: any) {
        toast.error(fbErr.response?.data?.msg || 'Failed to upload banners', { id: toastId });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBanner) return;

    setIsSubmitting(true);
    const toastId = toast.loading('Saving banner updates...');

    try {
      const formData = new FormData();
      if (editImageFile) {
        formData.append('image', editImageFile);
      } else if (editImageUrl.trim()) {
        formData.append('image', editImageUrl.trim());
      }
      formData.append('title', editTitle.trim());
      formData.append('link', editLink.trim());
      formData.append('targetAudience', editAudience);
      formData.append('duration', String(editDuration));
      formData.append('order', String(editOrder));
      formData.append('isActive', String(editIsActive));

      await axios.put(`${API_BASE}/bottom-banners/${editingBanner._id}`, formData, {
        headers: {
          ...getHeaders(),
          'Content-Type': 'multipart/form-data',
        },
      });

      toast.success('Bottom banner updated!', { id: toastId });
      setEditingBanner(null);
      fetchBanners();
    } catch (error: any) {
      console.error('Update error fallback:', error);
      if (editImageFile) {
        try {
          const base64 = await readFileAsBase64(editImageFile);
          await axios.put(`${API_BASE}/bottom-banners/${editingBanner._id}`, {
            image: base64,
            title: editTitle.trim(),
            link: editLink.trim(),
            targetAudience: editAudience,
            duration: editDuration,
            order: editOrder,
            isActive: editIsActive
          }, {
            headers: getHeaders()
          });
          toast.success('Bottom banner updated!', { id: toastId });
          setEditingBanner(null);
          fetchBanners();
          return;
        } catch (err: any) {
          toast.error(err.response?.data?.msg || 'Failed to update bottom banner', { id: toastId });
        }
      } else {
        toast.error(error.response?.data?.msg || 'Failed to update banner', { id: toastId });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (banner: BottomBannerItem) => {
    const updatedStatus = !banner.isActive;
    setBanners((prev) =>
      prev.map((b) => (b._id === banner._id ? { ...b, isActive: updatedStatus } : b))
    );

    try {
      await axios.patch(`${API_BASE}/bottom-banners/${banner._id}/toggle`, {}, {
        headers: getHeaders()
      });
      toast.success(updatedStatus ? 'Banner activated' : 'Banner paused');
    } catch (error) {
      console.error(error);
      toast.error('Failed to update status');
      fetchBanners();
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const toastId = toast.loading('Deleting banner...');

    try {
      await axios.delete(`${API_BASE}/bottom-banners/${deleteId}`, {
        headers: getHeaders()
      });
      toast.success('Bottom banner removed!', { id: toastId });
      setDeleteId(null);
      fetchBanners();
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete bottom banner', { id: toastId });
    }
  };

  const openEditModal = (banner: BottomBannerItem) => {
    setEditingBanner(banner);
    setEditTitle(banner.title || '');
    setEditLink(banner.link || '');
    setEditAudience(banner.targetAudience || 'All');
    setEditDuration(banner.duration || 4);
    setEditOrder(banner.order || 0);
    setEditIsActive(banner.isActive);
    setEditImageFile(null);
    setEditImagePreview(banner.url);
    setEditImageUrl('');
  };

  const resetNewForm = () => {
    setSelectedImages([]);
    setNewTitle('');
    setNewLink('');
    setNewAudience('All');
    setNewDuration(4);
    setNewOrder(banners.length);
    setNewIsActive(true);
    setSingleUrlInput('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openAddModal = () => {
    resetNewForm();
    setIsAddModalOpen(true);
  };

  const filteredBanners = banners.filter((b) => {
    if (activeAudience === 'All') return true;
    return b.targetAudience === activeAudience || b.targetAudience === 'All';
  });

  const activeCount = banners.filter((b) => b.isActive).length;

  // Selection & Bulk Delete helpers
  const isAllSelected = filteredBanners.length > 0 && filteredBanners.every((b) => selectedBannerIds.includes(b._id));
  const isIndeterminate = selectedBannerIds.length > 0 && !isAllSelected;

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedBannerIds((prev) => prev.filter((id) => !filteredBanners.some((b) => b._id === id)));
    } else {
      const filteredIds = filteredBanners.map((b) => b._id);
      setSelectedBannerIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const toggleSelectBanner = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedBannerIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedBannerIds.length === 0) return;
    setIsBulkDeleting(true);
    const count = selectedBannerIds.length;
    const toastId = toast.loading(`Deleting ${count} banner${count > 1 ? 's' : ''}...`);

    try {
      const res = await axios.post(`${API_BASE}/bottom-banners/bulk-delete`, {
        ids: selectedBannerIds,
      }, {
        headers: getHeaders(),
      });

      toast.success(`Successfully deleted ${res.data?.deletedCount ?? count} banner${count > 1 ? 's' : ''}!`, { id: toastId });
      setSelectedBannerIds([]);
      setIsBulkDeleteModalOpen(false);
      fetchBanners();
    } catch (error: any) {
      console.error('Bulk delete error:', error);
      // Fallback: sequential single deletes
      try {
        let deleted = 0;
        for (const id of selectedBannerIds) {
          await axios.delete(`${API_BASE}/bottom-banners/${id}`, { headers: getHeaders() });
          deleted++;
        }
        toast.success(`Successfully deleted ${deleted} banner${deleted > 1 ? 's' : ''}!`, { id: toastId });
        setSelectedBannerIds([]);
        setIsBulkDeleteModalOpen(false);
        fetchBanners();
      } catch (fbErr: any) {
        toast.error(fbErr.response?.data?.msg || 'Failed to delete selected banners', { id: toastId });
      }
    } finally {
      setIsBulkDeleting(false);
    }
  };

  return (
    <div className={embedded ? 'bottom-banners-embedded' : 'page-container fade-in'}>
      {/* Header */}
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start',
          flexWrap: 'wrap', 
          gap: 16, 
          marginBottom: 24 
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div 
              style={{ 
                background: 'rgba(29, 78, 216, 0.12)', 
                color: 'var(--primary)', 
                padding: '8px 10px', 
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Sliders size={22} />
            </div>
            <div>
              <h1 className="page-title" style={{ fontSize: embedded ? 20 : 26, margin: 0 }}>
                Bottom Banners (App Slider)
              </h1>
              <p className="page-subtitle" style={{ margin: '4px 0 0 0', fontSize: 13 }}>
                Upload & manage multi-slide auto-scroll banners shown at the bottom of Resident & Member home screens.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button 
            className="btn btn-outline" 
            onClick={fetchBanners}
            disabled={loading}
            title="Refresh banners list"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px' }}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            Refresh
          </button>
          
          <button 
            className="btn btn-primary"
            onClick={openAddModal}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', fontWeight: 600 }}
          >
            <Plus size={18} />
            + Add Bottom Banner (Multi-Select)
          </button>
        </div>
      </div>

      {/* Info Alert Banner */}
      <div 
        style={{ 
          background: 'linear-gradient(135deg, rgba(29, 78, 216, 0.06) 0%, rgba(59, 130, 246, 0.09) 100%)', 
          border: '1px solid rgba(29, 78, 216, 0.2)', 
          borderRadius: 14, 
          padding: '14px 18px', 
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Sparkles size={20} color="var(--primary)" />
          <div>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-main)' }}>
              Auto-Sliding Carousel Active:
            </span>{' '}
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              You can select multiple images at once (5, 10 or more). When active, the mobile app automatically slides through them.
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span 
            style={{ 
              background: '#FFFFFF', 
              padding: '4px 12px', 
              borderRadius: 20, 
              fontSize: 12, 
              fontWeight: 700, 
              color: 'var(--success)', 
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)' 
            }}
          >
            ● {activeCount} Active
          </span>
          <span 
            style={{ 
              background: '#FFFFFF', 
              padding: '4px 12px', 
              borderRadius: 20, 
              fontSize: 12, 
              fontWeight: 700, 
              color: 'var(--text-muted)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)' 
            }}
          >
            {banners.length} Total Banners
          </span>
        </div>
      </div>

      {/* Audience Filter Tabs */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
        {(['All', 'Resident', 'Member', 'Staff'] as const).map((aud) => {
          const count = aud === 'All' 
            ? banners.length 
            : banners.filter((b) => b.targetAudience === aud || b.targetAudience === 'All').length;
          const isSelected = activeAudience === aud;

          return (
            <button
              key={aud}
              onClick={() => setActiveAudience(aud)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                borderRadius: 20,
                border: isSelected ? 'none' : '1px solid var(--border-color)',
                background: isSelected ? 'var(--primary)' : '#FFFFFF',
                color: isSelected ? '#FFFFFF' : 'var(--text-muted)',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: isSelected ? '0 4px 12px rgba(29, 78, 216, 0.25)' : 'none',
              }}
            >
              {aud === 'All' ? 'All Audiences' : `${aud} App`}
              <span
                style={{
                  fontSize: 11,
                  padding: '2px 7px',
                  borderRadius: 10,
                  background: isSelected ? 'rgba(255,255,255,0.25)' : '#F1F5F9',
                  color: isSelected ? '#FFFFFF' : 'var(--text-main)',
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Multi-Selection & Bulk Delete Action Bar */}
      {filteredBanners.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: selectedBannerIds.length > 0 ? 'rgba(239, 68, 68, 0.05)' : '#FFFFFF',
            border: selectedBannerIds.length > 0 ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid var(--border-color)',
            borderRadius: 12,
            padding: '10px 16px',
            marginBottom: 20,
            gap: 12,
            flexWrap: 'wrap',
            transition: 'all 0.2s ease',
            boxShadow: selectedBannerIds.length > 0 ? '0 4px 12px rgba(239, 68, 68, 0.08)' : 'none'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 13,
                color: 'var(--text-main)',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={isAllSelected}
                ref={(el) => {
                  if (el) el.indeterminate = isIndeterminate;
                }}
                onChange={handleSelectAll}
                style={{ width: 17, height: 17, accentColor: 'var(--primary)', cursor: 'pointer' }}
              />
              <span>{isAllSelected ? 'Deselect All' : 'Select All'} ({filteredBanners.length} Banners)</span>
            </label>

            {selectedBannerIds.length > 0 && (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  background: 'rgba(239, 68, 68, 0.12)',
                  color: 'var(--danger)',
                  padding: '3px 10px',
                  borderRadius: 12,
                }}
              >
                {selectedBannerIds.length} Selected
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {selectedBannerIds.length > 0 ? (
              <>
                <button
                  type="button"
                  onClick={() => setSelectedBannerIds([])}
                  className="btn btn-outline"
                  style={{ padding: '6px 12px', fontSize: 12 }}
                >
                  Deselect All
                </button>
                <button
                  type="button"
                  onClick={() => setIsBulkDeleteModalOpen(true)}
                  className="btn btn-danger"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 14px',
                    fontSize: 13,
                    fontWeight: 700,
                    boxShadow: '0 2px 8px rgba(239, 68, 68, 0.25)',
                  }}
                >
                  <Trash2 size={15} />
                  Delete Selected ({selectedBannerIds.length})
                </button>
              </>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Check individual banners or click "Select All" to delete multiple at once
              </span>
            )}
          </div>
        </div>
      )}

      {/* Banner Grid */}
      {loading ? (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
          {[1, 2, 3].map((idx) => (
            <div key={`skeleton-${idx}`} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="skeleton" style={{ width: '100%', height: 160 }}></div>
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="skeleton skeleton-row" style={{ width: '70%', height: 16 }}></div>
                <div className="skeleton skeleton-row" style={{ width: '40%', height: 14 }}></div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredBanners.length === 0 ? (
        <div 
          className="glass" 
          style={{ 
            padding: 48, 
            textAlign: 'center', 
            borderRadius: 16, 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            gap: 16
          }}
        >
          <div 
            style={{ 
              width: 64, 
              height: 64, 
              borderRadius: 32, 
              background: 'rgba(29, 78, 216, 0.08)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: 'var(--primary)'
            }}
          >
            <ImageIcon size={32} />
          </div>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px 0' }}>No Bottom Banners Added</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 440, margin: '0 auto' }}>
              Select and upload multiple banners at once to create an auto-sliding showcase at the bottom of the user home screens.
            </p>
          </div>
          <button 
            className="btn btn-primary"
            onClick={openAddModal}
            style={{ marginTop: 8 }}
          >
            <Plus size={18} /> Select Multiple Images to Upload
          </button>
        </div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 22 }}>
          {filteredBanners.map((banner, index) => {
            const isSelected = selectedBannerIds.includes(banner._id);
            return (
              <div 
                key={banner._id} 
                className="card" 
                style={{ 
                  padding: 0, 
                  overflow: 'hidden', 
                  display: 'flex', 
                  flexDirection: 'column',
                  border: isSelected 
                    ? '2px solid var(--primary)' 
                    : banner.isActive 
                    ? '1px solid var(--border-color)' 
                    : '1px dashed #CBD5E1',
                  opacity: banner.isActive ? 1 : 0.78,
                  transition: 'all 0.2s ease',
                  boxShadow: isSelected 
                    ? '0 0 0 3px rgba(29, 78, 216, 0.18), 0 6px 18px rgba(0,0,0,0.08)' 
                    : banner.isActive 
                    ? '0 4px 15px rgba(0,0,0,0.05)' 
                    : 'none',
                }}
              >
                {/* Image Preview Container */}
                <div 
                  style={{ 
                    position: 'relative', 
                    width: '100%', 
                    height: 165, 
                    backgroundColor: '#0F172A', 
                    cursor: 'pointer',
                    overflow: 'hidden'
                  }}
                  onClick={() => setViewingImage(banner.url)}
                >
                  <img 
                    src={banner.url} 
                    alt={banner.title || 'Bottom banner'} 
                    style={{ 
                      width: '100%', 
                      height: '100%', 
                      objectFit: 'cover',
                      transition: 'transform 0.3s ease'
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.transform = 'scale(1.03)')}
                    onMouseOut={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                  />

                  {/* Multi-Select Checkbox on Banner Card */}
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelectBanner(banner._id, e);
                    }}
                    style={{ 
                      position: 'absolute', 
                      top: 10, 
                      left: 10, 
                      zIndex: 10,
                      background: isSelected ? 'var(--primary)' : 'rgba(15, 23, 42, 0.75)',
                      border: '2px solid #FFFFFF',
                      borderRadius: 7,
                      width: 24,
                      height: 24,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                      transition: 'all 0.15s ease'
                    }}
                    title={isSelected ? 'Deselect banner' : 'Select banner for bulk actions'}
                  >
                    <input 
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      style={{ 
                        cursor: 'pointer', 
                        width: 14, 
                        height: 14, 
                        accentColor: 'var(--primary)', 
                        pointerEvents: 'none' 
                      }}
                    />
                  </div>
                  
                  {/* Status Badges Overlay */}
                  <div style={{ position: 'absolute', top: 10, left: 42, display: 'flex', gap: 6, zIndex: 2 }}>
                    <span 
                      style={{ 
                        fontSize: 11, 
                        fontWeight: 700, 
                        padding: '3px 8px', 
                        borderRadius: 12, 
                        background: banner.isActive ? 'rgba(16, 185, 129, 0.9)' : 'rgba(100, 116, 139, 0.9)', 
                        color: '#FFFFFF',
                        backdropFilter: 'blur(4px)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      {banner.isActive ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                      {banner.isActive ? 'Active' : 'Paused'}
                    </span>
                    
                    <span 
                      style={{ 
                        fontSize: 11, 
                        fontWeight: 700, 
                        padding: '3px 8px', 
                        borderRadius: 12, 
                        background: 'rgba(15, 23, 42, 0.75)', 
                        color: '#FFFFFF',
                        backdropFilter: 'blur(4px)',
                      }}
                    >
                      {banner.targetAudience || 'All'}
                    </span>
                  </div>

                {/* Duration Badge Overlay */}
                <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 2 }}>
                  <span 
                    style={{ 
                      fontSize: 11, 
                      fontWeight: 700, 
                      padding: '3px 8px', 
                      borderRadius: 12, 
                      background: 'rgba(29, 78, 216, 0.85)', 
                      color: '#FFFFFF',
                      backdropFilter: 'blur(4px)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <Clock size={11} />
                    {banner.duration || 4}s
                  </span>
                </div>

                {/* Bottom title gradient banner */}
                {banner.title && (
                  <div 
                    style={{ 
                      position: 'absolute', 
                      bottom: 0, 
                      left: 0, 
                      right: 0, 
                      padding: '18px 12px 8px 12px',
                      background: 'linear-gradient(to top, rgba(15, 23, 42, 0.88), transparent)',
                      color: '#FFFFFF',
                      fontWeight: 600,
                      fontSize: 13,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {banner.title}
                  </div>
                )}
              </div>

              {/* Card Body */}
              <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Layers size={14} color="var(--text-muted)" />
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
                      Slide Order #{banner.order !== undefined ? banner.order : index}
                    </span>
                  </div>

                  {/* Toggle Active Button */}
                  <label 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 6, 
                      fontSize: 12, 
                      fontWeight: 600, 
                      cursor: 'pointer',
                      color: banner.isActive ? 'var(--success)' : 'var(--text-muted)'
                    }}
                  >
                    <input 
                      type="checkbox" 
                      checked={banner.isActive} 
                      onChange={() => handleToggleActive(banner)}
                      style={{ cursor: 'pointer' }}
                    />
                    {banner.isActive ? 'Enabled' : 'Disabled'}
                  </label>
                </div>

                {/* Link display if any */}
                {banner.link && (
                  <div 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 6, 
                      fontSize: 12, 
                      color: 'var(--primary)',
                      background: 'rgba(29, 78, 216, 0.05)',
                      padding: '5px 10px',
                      borderRadius: 8,
                      overflow: 'hidden'
                    }}
                  >
                    <ExternalLink size={13} style={{ flexShrink: 0 }} />
                    <a 
                      href={banner.link} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      style={{ 
                        color: 'inherit', 
                        textDecoration: 'none', 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        whiteSpace: 'nowrap' 
                      }}
                    >
                      {banner.link}
                    </a>
                  </div>
                )}

                {/* Card Actions Footer */}
                <div 
                  style={{ 
                    marginTop: 'auto', 
                    paddingTop: 10, 
                    borderTop: '1px solid var(--border-color)', 
                    display: 'flex', 
                    justifyContent: 'flex-end', 
                    gap: 8 
                  }}
                >
                  <button 
                    className="btn btn-outline" 
                    onClick={() => openEditModal(banner)}
                    style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}
                  >
                    <Edit2 size={13} />
                    Edit
                  </button>
                  <button 
                    className="btn btn-danger" 
                    onClick={() => setDeleteId(banner._id)}
                    style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}
                  >
                    <Trash2 size={13} />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    )}

      {/* MULTI-IMAGE ADD BANNER MODAL */}
      {isAddModalOpen && (
        <div 
          className="modal-overlay modal-backdrop" 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            backdropFilter: 'blur(5px)',
            padding: 20,
            boxSizing: 'border-box'
          }}
          onClick={() => !isSubmitting && setIsAddModalOpen(false)}
        >
          <div 
            className="modal-content" 
            style={{ 
              maxWidth: 680, 
              width: '100%', 
              backgroundColor: '#FFFFFF', 
              borderRadius: 16, 
              padding: 24, 
              maxHeight: '92vh', 
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              margin: 'auto',
              position: 'relative'
            }} 
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ background: 'rgba(29, 78, 216, 0.1)', color: 'var(--primary)', padding: 8, borderRadius: 10 }}>
                  <FolderPlus size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Add Multiple Bottom Banners</h2>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                    Select multiple images at once to create an auto-advancing slider.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsAddModalOpen(false)} 
                disabled={isSubmitting}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              {/* Multi-Image Upload Area */}
              <div className="form-group" style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label className="form-label" style={{ fontWeight: 600, margin: 0 }}>
                    Select Images {selectedImages.length > 0 && <span style={{ color: 'var(--primary)' }}>({selectedImages.length} selected)</span>}
                  </label>
                  {selectedImages.length > 0 && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="btn btn-outline"
                      style={{ padding: '4px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <Plus size={13} /> Add More Images
                    </button>
                  )}
                </div>

                {/* Dropzone / Upload Box */}
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                  style={{
                    border: `2px dashed ${isDragOver ? 'var(--primary)' : 'var(--border-color)'}`,
                    borderRadius: 14,
                    padding: selectedImages.length > 0 ? '16px' : '32px 20px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: isDragOver ? 'rgba(29, 78, 216, 0.05)' : '#F8FAFC',
                    transition: 'all 0.2s ease',
                    marginBottom: 12
                  }}
                >
                  <Upload size={32} color="var(--primary)" style={{ margin: '0 auto 8px auto' }} />
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-main)' }}>
                    Click or Drag & Drop multiple images here
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    Hold <kbd style={{ background: '#E2E8F0', padding: '1px 5px', borderRadius: 4 }}>Ctrl</kbd> or <kbd style={{ background: '#E2E8F0', padding: '1px 5px', borderRadius: 4 }}>Shift</kbd> to select 5, 10 or more images at once (PNG, JPG, WebP)
                  </div>
                </div>

                <input 
                  type="file" 
                  ref={fileInputRef} 
                  accept="image/*" 
                  multiple 
                  onChange={handleSelectNewImages} 
                  style={{ display: 'none' }} 
                />

                {/* Or Add Image by URL */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                  <input 
                    type="url" 
                    placeholder="Or paste an image web link (https://...)"
                    value={singleUrlInput}
                    onChange={(e) => setSingleUrlInput(e.target.value)}
                    className="form-control"
                    style={{ fontSize: 13, padding: '7px 12px' }}
                  />
                  <button
                    type="button"
                    onClick={handleAddUrlImage}
                    disabled={!singleUrlInput.trim()}
                    className="btn btn-outline"
                    style={{ padding: '7px 14px', fontSize: 13, flexShrink: 0 }}
                  >
                    Add URL
                  </button>
                </div>
              </div>

              {/* Selected Images Grid Preview */}
              {selectedImages.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>
                      Selected Slides ({selectedImages.length}):
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedImages([])}
                      style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
                    >
                      Clear All
                    </button>
                  </div>

                  <div 
                    style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fill, minmax(135px, 1fr))', 
                      gap: 12,
                      maxHeight: 260,
                      overflowY: 'auto',
                      padding: '8px',
                      background: '#F1F5F9',
                      borderRadius: 12
                    }}
                  >
                    {selectedImages.map((item, idx) => (
                      <div 
                        key={item.id} 
                        style={{ 
                          position: 'relative', 
                          background: '#FFFFFF', 
                          borderRadius: 10, 
                          overflow: 'hidden',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                          border: '1px solid var(--border-color)',
                          display: 'flex',
                          flexDirection: 'column'
                        }}
                      >
                        <div style={{ position: 'relative', height: 85, backgroundColor: '#0F172A' }}>
                          <img 
                            src={item.preview} 
                            alt={`Preview ${idx + 1}`} 
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                          />
                          <span 
                            style={{ 
                              position: 'absolute', 
                              top: 4, 
                              left: 4, 
                              background: 'rgba(15, 23, 42, 0.8)', 
                              color: '#FFFFFF', 
                              fontSize: 10, 
                              fontWeight: 700, 
                              padding: '2px 6px', 
                              borderRadius: 6 
                            }}
                          >
                            #{idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveSelectedImage(item.id)}
                            style={{
                              position: 'absolute',
                              top: 4,
                              right: 4,
                              background: 'rgba(239, 68, 68, 0.9)',
                              color: '#FFFFFF',
                              border: 'none',
                              borderRadius: '50%',
                              width: 20,
                              height: 20,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer'
                            }}
                            title="Remove image"
                          >
                            <X size={12} />
                          </button>
                        </div>
                        <div style={{ padding: '6px' }}>
                          <input 
                            type="text" 
                            placeholder="Title (optional)" 
                            value={item.title}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSelectedImages((prev) =>
                                prev.map((img) => (img.id === item.id ? { ...img, title: val } : img))
                              );
                            }}
                            style={{ 
                              width: '100%', 
                              fontSize: 11, 
                              padding: '4px 6px', 
                              border: '1px solid var(--border-color)', 
                              borderRadius: 6,
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Batch Defaults */}
              <div style={{ background: '#F8FAFC', border: '1px solid var(--border-color)', borderRadius: 12, padding: 16, marginBottom: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={15} color="var(--primary)" />
                  Batch Settings (Applied to all selected images)
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 12 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: 13 }}>Default Title / Caption</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Community Updates..."
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="form-control"
                      style={{ fontSize: 13 }}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: 13 }}>Redirect Link URL (Optional)</label>
                    <input 
                      type="text" 
                      placeholder="https://... or app path"
                      value={newLink}
                      onChange={(e) => setNewLink(e.target.value)}
                      className="form-control"
                      style={{ fontSize: 13 }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: 13 }}>Target Audience</label>
                    <select 
                      value={newAudience} 
                      onChange={(e) => setNewAudience(e.target.value as TargetAudience)}
                      className="form-control"
                      style={{ fontSize: 13 }}
                    >
                      <option value="All">All Users</option>
                      <option value="Resident">Residents Only</option>
                      <option value="Member">Members Only</option>
                      <option value="Staff">Staff Only</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: 13 }}>Slide Duration (s)</label>
                    <input 
                      type="number" 
                      min={1} 
                      max={60}
                      value={newDuration}
                      onChange={(e) => setNewDuration(Number(e.target.value) || 4)}
                      className="form-control"
                      style={{ fontSize: 13 }}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: 13 }}>Starting Order #</label>
                    <input 
                      type="number" 
                      value={newOrder}
                      onChange={(e) => setNewOrder(Number(e.target.value) || 0)}
                      className="form-control"
                      style={{ fontSize: 13 }}
                    />
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                    <input 
                      type="checkbox" 
                      checked={newIsActive} 
                      onChange={(e) => setNewIsActive(e.target.checked)} 
                    />
                    Enable all banners immediately on save
                  </label>
                </div>
              </div>

              {/* Form Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button 
                  type="button" 
                  className="btn btn-outline" 
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={isSubmitting || selectedImages.length === 0}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
                >
                  {isSubmitting 
                    ? `Uploading ${selectedImages.length} Banners...` 
                    : `Upload All (${selectedImages.length}) Banners`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT SINGLE BANNER MODAL */}
      {editingBanner && (
        <div 
          className="modal-overlay modal-backdrop" 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            backdropFilter: 'blur(5px)',
            padding: 20,
            boxSizing: 'border-box'
          }}
          onClick={() => !isSubmitting && setEditingBanner(null)}
        >
          <div 
            className="modal-content" 
            style={{ 
              maxWidth: 540, 
              width: '100%', 
              backgroundColor: '#FFFFFF', 
              borderRadius: 16, 
              padding: 24, 
              maxHeight: '90vh', 
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              margin: 'auto',
              position: 'relative'
            }} 
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ background: 'rgba(29, 78, 216, 0.1)', color: 'var(--primary)', padding: 8, borderRadius: 10 }}>
                  <Edit2 size={20} />
                </div>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Edit Bottom Banner</h2>
              </div>
              <button 
                onClick={() => setEditingBanner(null)} 
                disabled={isSubmitting}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              {/* Image Preview & Replace */}
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Banner Image</label>
                <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', height: 160, background: '#0F172A', marginBottom: 10 }}>
                  <img src={editImagePreview || editingBanner.url} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button
                    type="button"
                    onClick={() => editFileInputRef.current?.click()}
                    style={{
                      position: 'absolute',
                      bottom: 10,
                      right: 10,
                      background: 'rgba(15, 23, 42, 0.85)',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: 8,
                      padding: '6px 12px',
                      fontSize: 12,
                      cursor: 'pointer',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    <Upload size={14} /> Replace Image
                  </button>
                </div>
                
                <input 
                  type="file" 
                  ref={editFileInputRef} 
                  accept="image/*" 
                  onChange={handleSelectEditImage} 
                  style={{ display: 'none' }} 
                />
              </div>

              {/* Title Input */}
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Title / Caption</label>
                <input 
                  type="text" 
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="form-control"
                />
              </div>

              {/* Link Input */}
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Redirect Link</label>
                <input 
                  type="text" 
                  value={editLink}
                  onChange={(e) => setEditLink(e.target.value)}
                  className="form-control"
                />
              </div>

              {/* Audience & Duration Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Target Audience</label>
                  <select 
                    value={editAudience} 
                    onChange={(e) => setEditAudience(e.target.value as TargetAudience)}
                    className="form-control"
                  >
                    <option value="All">All Users</option>
                    <option value="Resident">Residents Only</option>
                    <option value="Member">Members Only</option>
                    <option value="Staff">Staff Only</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Slide Duration (Seconds)</label>
                  <input 
                    type="number" 
                    min={1} 
                    max={60}
                    value={editDuration}
                    onChange={(e) => setNewDuration(Number(e.target.value) || 4)}
                    className="form-control"
                  />
                </div>
              </div>

              {/* Order & Active Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Display Order</label>
                  <input 
                    type="number" 
                    value={editOrder}
                    onChange={(e) => setEditOrder(Number(e.target.value) || 0)}
                    className="form-control"
                  />
                </div>

                <div className="form-group" style={{ display: 'flex', alignItems: 'center', marginTop: 24 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                    <input 
                      type="checkbox" 
                      checked={editIsActive} 
                      onChange={(e) => setEditIsActive(e.target.checked)} 
                    />
                    Banner is active
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button 
                  type="button" 
                  className="btn btn-outline" 
                  onClick={() => setEditingBanner(null)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : 'Update Banner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteId && (
        <div 
          className="modal-overlay modal-backdrop" 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            backdropFilter: 'blur(5px)',
            padding: 20,
            boxSizing: 'border-box'
          }}
          onClick={() => setDeleteId(null)}
        >
          <div 
            className="modal-content" 
            style={{ 
              maxWidth: 420, 
              width: '100%', 
              backgroundColor: '#FFFFFF', 
              borderRadius: 16, 
              padding: 24, 
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              margin: 'auto',
              position: 'relative'
            }} 
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--danger)' }}>
              Delete Bottom Banner?
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20 }}>
              Are you sure you want to remove this banner? This action will immediately remove it from all mobile app sliders.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-outline" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}>Delete Banner</button>
            </div>
          </div>
        </div>
      )}

      {/* BULK DELETE CONFIRMATION MODAL */}
      {isBulkDeleteModalOpen && (
        <div 
          className="modal-overlay modal-backdrop" 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            backdropFilter: 'blur(5px)',
            padding: 20,
            boxSizing: 'border-box'
          }}
          onClick={() => !isBulkDeleting && setIsBulkDeleteModalOpen(false)}
        >
          <div 
            className="modal-content" 
            style={{ 
              maxWidth: 480, 
              width: '100%', 
              backgroundColor: '#FFFFFF', 
              borderRadius: 16, 
              padding: 24, 
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              margin: 'auto',
              position: 'relative'
            }} 
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: 10, borderRadius: 12 }}>
                <Trash2 size={24} />
              </div>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--danger)' }}>
                  Delete {selectedBannerIds.length} Selected Banners?
                </h2>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                  This action will permanently delete these banners.
                </p>
              </div>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16, lineHeight: 1.5 }}>
              Are you sure you want to delete all <strong style={{ color: 'var(--text-main)' }}>{selectedBannerIds.length} selected banners</strong>? They will be removed from Cloudinary and mobile app sliders immediately.
            </p>

            {/* Thumbnail previews of selected banners */}
            <div 
              style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(75px, 1fr))', 
                gap: 8, 
                maxHeight: 140, 
                overflowY: 'auto', 
                padding: 8, 
                background: '#F8FAFC', 
                borderRadius: 10, 
                marginBottom: 20,
                border: '1px solid var(--border-color)'
              }}
            >
              {banners
                .filter((b) => selectedBannerIds.includes(b._id))
                .map((b) => (
                  <div 
                    key={b._id} 
                    style={{ 
                      height: 52, 
                      borderRadius: 6, 
                      overflow: 'hidden', 
                      background: '#0F172A',
                      border: '1px solid var(--border-color)',
                      position: 'relative'
                    }}
                    title={b.title || 'Banner'}
                  >
                    <img src={b.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button 
                type="button"
                className="btn btn-outline" 
                onClick={() => setIsBulkDeleteModalOpen(false)}
                disabled={isBulkDeleting}
              >
                Cancel
              </button>
              <button 
                type="button"
                className="btn btn-danger" 
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
              >
                <Trash2 size={15} />
                {isBulkDeleting ? 'Deleting...' : `Yes, Delete ${selectedBannerIds.length} Banners`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN IMAGE MODAL */}
      {viewingImage && (
        <div 
          className="modal-overlay modal-backdrop" 
          style={{ 
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.88)', 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999999,
            padding: 20,
            boxSizing: 'border-box'
          }}
          onClick={() => setViewingImage(null)}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <img 
              src={viewingImage} 
              alt="Full Banner" 
              style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 12, objectFit: 'contain' }} 
            />
            <button 
              onClick={() => setViewingImage(null)}
              style={{
                position: 'absolute',
                top: -15,
                right: -15,
                background: '#FFFFFF',
                borderRadius: '50%',
                border: 'none',
                width: 32,
                height: 32,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
