import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Plus, Trash2, Edit2, X } from 'lucide-react';
import '../index.css';

const API_URL = 'https://anytime-help.onrender.com/api';

export default function Categories() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  interface SubCategoryDetail {
    en: string;
    hi: string;
    hinglish: string;
  }

  const [formData, setFormData] = useState({
    title: '',
    title_hi: '',
    title_hinglish: '',
    image: '',
    subCategories: [] as string[],
    subCategoriesDetails: [] as SubCategoryDetail[]
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [removeImageFlag, setRemoveImageFlag] = useState(false);
  const [newSubEn, setNewSubEn] = useState('');
  const [newSubHi, setNewSubHi] = useState('');
  const [newSubHinglish, setNewSubHinglish] = useState('');

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await axios.get(`${API_URL}/categories`);
      setCategories(res.data);
    } catch (error) {
      console.error(error);
      toast.error('Failed to fetch categories');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (category: any = null) => {
    if (category) {
      setEditingId(category._id);
      
      let details: SubCategoryDetail[] = [];
      if (Array.isArray(category.subCategoriesDetails) && category.subCategoriesDetails.length > 0) {
        details = category.subCategoriesDetails;
      } else if (Array.isArray(category.subCategories)) {
        details = category.subCategories.map((s: string) => ({ en: s, hi: '', hinglish: '' }));
      }

      setFormData({
        title: category.title || '',
        title_hi: category.title_hi || '',
        title_hinglish: category.title_hinglish || '',
        image: category.image || '',
        subCategories: category.subCategories || [],
        subCategoriesDetails: details
      });
    } else {
      setEditingId(null);
      setFormData({
        title: '',
        title_hi: '',
        title_hinglish: '',
        image: '',
        subCategories: [],
        subCategoriesDetails: []
      });
    }
    setImageFile(null);
    setRemoveImageFlag(false);
    setNewSubEn('');
    setNewSubHi('');
    setNewSubHinglish('');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const handleAddSubCategory = () => {
    if (newSubEn.trim() === '') {
      toast.error('Please enter subcategory English name');
      return;
    }

    const newItem: SubCategoryDetail = {
      en: newSubEn.trim(),
      hi: newSubHi.trim(),
      hinglish: newSubHinglish.trim()
    };

    setFormData({
      ...formData,
      subCategories: [...formData.subCategories, newItem.en],
      subCategoriesDetails: [...formData.subCategoriesDetails, newItem]
    });

    setNewSubEn('');
    setNewSubHi('');
    setNewSubHinglish('');
  };

  const handleRemoveSubCategory = (indexToRemove: number) => {
    setFormData({
      ...formData,
      subCategories: formData.subCategories.filter((_, index) => index !== indexToRemove),
      subCategoriesDetails: formData.subCategoriesDetails.filter((_, index) => index !== indexToRemove)
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) {
      toast.error('Title is required');
      return;
    }

    const payload = new FormData();
    payload.append('title', formData.title);
    payload.append('title_hi', formData.title_hi || '');
    payload.append('title_hinglish', formData.title_hinglish || '');
    
    let finalDetails = [...formData.subCategoriesDetails];
    if (newSubEn.trim() !== '') {
      finalDetails.push({
        en: newSubEn.trim(),
        hi: newSubHi.trim(),
        hinglish: newSubHinglish.trim()
      });
    }

    const finalSubCategories = finalDetails.map(d => d.en);
    payload.append('subCategories', JSON.stringify(finalSubCategories));
    payload.append('subCategoriesDetails', JSON.stringify(finalDetails));

    if (removeImageFlag) {
      payload.append('removeImage', 'true');
    } else if (imageFile) {
      payload.append('image', imageFile);
    }

    const loadingToast = toast.loading(editingId ? 'Updating category...' : 'Adding category...');
    try {
      const token = localStorage.getItem('adminToken') || '';
      
      if (editingId) {
        await axios.put(`${API_URL}/categories/${editingId}`, payload, {
          headers: { 
            'x-auth-token': token,
            'Content-Type': 'multipart/form-data'
          }
        });
        toast.success('Category updated successfully!', { id: loadingToast });
      } else {
        await axios.post(`${API_URL}/categories`, payload, {
          headers: { 
            'x-auth-token': token,
            'Content-Type': 'multipart/form-data'
          }
        });
        toast.success('Category added successfully!', { id: loadingToast });
      }
      
      handleCloseModal();
      setNewSubEn('');
      setNewSubHi('');
      setNewSubHinglish('');
      fetchCategories();
    } catch (error) {
      console.error(error);
      toast.error('Failed to save category', { id: loadingToast });
    }
  };

  const confirmDelete = (id: string) => {
    setDeleteId(id);
  };

  const executeDelete = async () => {
    if (!deleteId) return;

    const loadingToast = toast.loading('Deleting category...');
    try {
      const token = localStorage.getItem('adminToken') || '';
      await axios.delete(`${API_URL}/categories/${deleteId}`, {
        headers: { 'x-auth-token': token }
      });
      toast.success('Category deleted successfully!', { id: loadingToast });
      setDeleteId(null);
      fetchCategories();
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete category', { id: loadingToast });
    }
  };

  return (
    <div style={{ marginTop: '40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: 24, fontWeight: 700 }}>Manage Categories & Sub-Categories</h2>
        <button className="btn btn-primary" onClick={() => handleOpenModal()}>
          <Plus size={18} /> Add Category
        </button>
      </div>

      {loading ? (
        <div className="grid">
          {[1, 2, 3, 4].map(idx => (
            <div key={`skeleton-${idx}`} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                  <div className="skeleton" style={{ width: '48px', height: '48px', borderRadius: '12px' }}></div>
                  <div style={{ width: '100%' }}>
                    <div className="skeleton skeleton-row" style={{ width: '60%', height: '16px', marginBottom: '8px' }}></div>
                    <div className="skeleton skeleton-row" style={{ width: '40%', height: '12px' }}></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid">
          {categories.length === 0 ? (
            <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px' }}>
              <h3>No categories found</h3>
              <p style={{ color: 'var(--text-secondary)' }}>Add your first category.</p>
            </div>
          ) : (
            categories.map((cat) => (
              <div key={cat._id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ 
                      width: '48px', height: '48px', borderRadius: '12px', 
                      backgroundColor: '#F1F5F9', overflow: 'hidden',
                      display: 'flex', justifyContent: 'center', alignItems: 'center'
                    }}>
                      {cat.image ? (
                        <img src={cat.image} alt={cat.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontWeight: 'bold', color: '#94A3B8' }}>{cat.title.substring(0, 2).toUpperCase()}</span>
                      )}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)' }}>{cat.title}</h3>
                        {cat.title_hi && (
                          <span style={{ fontSize: '11px', background: '#FEF3C7', color: '#92400E', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                            {cat.title_hi}
                          </span>
                        )}
                        {cat.title_hinglish && (
                          <span style={{ fontSize: '11px', background: '#E0E7FF', color: '#3730A3', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                            {cat.title_hinglish}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {cat.subCategories?.length || 0} Sub-categories
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-icon" onClick={() => handleOpenModal(cat)} style={{ color: 'var(--primary)' }}>
                      <Edit2 size={16} />
                    </button>
                    <button className="btn btn-icon" onClick={() => confirmDelete(cat._id)} style={{ color: 'var(--danger)' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

              </div>
            ))
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>{editingId ? 'Edit Category' : 'Add New Category'}</h2>
              <button className="btn btn-icon" onClick={handleCloseModal}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="modal-body">
              <div className="form-group">
                <label className="form-label">Category Title (English) *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={formData.title} 
                  onChange={(e) => setFormData({...formData, title: e.target.value})} 
                  placeholder="e.g. Electricity" 
                  required 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '13px' }}>Title in Hindi (हिंदी)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={formData.title_hi} 
                    onChange={(e) => setFormData({...formData, title_hi: e.target.value})} 
                    placeholder="जैसे: बिजली" 
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '13px' }}>Title in Hinglish</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={formData.title_hinglish} 
                    onChange={(e) => setFormData({...formData, title_hinglish: e.target.value})} 
                    placeholder="e.g. Bijli" 
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Category Image</label>
                
                {formData.image && !removeImageFlag && !imageFile && (
                  <div style={{ marginBottom: '12px', position: 'relative', display: 'inline-block' }}>
                    <img src={formData.image} alt="Preview" style={{ width: '80px', height: '80px', borderRadius: '12px', objectFit: 'cover', border: '1px solid var(--border-color)' }} />
                    <button 
                      type="button" 
                      onClick={() => setRemoveImageFlag(true)}
                      style={{ 
                        position: 'absolute', top: '-8px', right: '-8px', background: '#EF4444', color: 'white', 
                        border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                      }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input 
                    type="file" 
                    accept="image/*"
                    className="form-input" 
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setImageFile(e.target.files[0]);
                        setRemoveImageFlag(false);
                      }
                    }}
                    style={{ display: imageFile ? 'none' : 'block' }}
                  />
                  {imageFile && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', backgroundColor: '#F3F4F6', borderRadius: '8px', border: '1px solid #D1D5DB' }}>
                      <span style={{ fontSize: '14px', color: '#374151' }}>{imageFile.name}</span>
                      <button 
                        type="button" 
                        onClick={() => {
                          setImageFile(null);
                          const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
                          if (fileInput) fileInput.value = '';
                        }} 
                        style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', display: 'flex' }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Sub Categories (Multi-Language)</label>
                <div style={{ background: '#F9FAFB', padding: '12px', borderRadius: '8px', border: '1px solid #E5E7EB', marginBottom: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={newSubEn} 
                      onChange={(e) => setNewSubEn(e.target.value)} 
                      placeholder="English (e.g. Power Outage)"
                    />
                    <input 
                      type="text" 
                      className="form-input" 
                      value={newSubHi} 
                      onChange={(e) => setNewSubHi(e.target.value)} 
                      placeholder="हिंदी (उदा. बिजली कटौती)"
                    />
                    <input 
                      type="text" 
                      className="form-input" 
                      value={newSubHinglish} 
                      onChange={(e) => setNewSubHinglish(e.target.value)} 
                      placeholder="Hinglish (e.g. Bijli Chali Gayi)"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddSubCategory();
                        }
                      }}
                    />
                  </div>
                  <button type="button" className="btn btn-secondary" onClick={handleAddSubCategory} style={{ width: '100%', justifyContent: 'center' }}>
                    <Plus size={16} /> Add Sub-category
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                  {formData.subCategoriesDetails.map((detail, index) => (
                    <div key={index} style={{ 
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', 
                      backgroundColor: '#EFF6FF', borderRadius: '8px', border: '1px solid #BFDBFE' 
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, color: '#1E40AF', fontSize: '13px' }}>{detail.en}</span>
                        {detail.hi && (
                          <span style={{ background: '#FEF3C7', color: '#92400E', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                            {detail.hi}
                          </span>
                        )}
                        {detail.hinglish && (
                          <span style={{ background: '#E0E7FF', color: '#3730A3', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                            {detail.hinglish}
                          </span>
                        )}
                      </div>
                      <button type="button" onClick={() => handleRemoveSubCategory(index)} style={{ 
                        background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', display: 'flex' 
                      }}>
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                  {formData.subCategoriesDetails.length === 0 && (
                    <p style={{ color: '#9CA3AF', fontSize: '13px', margin: '4px 0' }}>No sub-categories added yet.</p>
                  )}
                </div>
              </div>

              <div className="modal-footer" style={{ marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingId ? 'Update' : 'Save'} Category</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Delete Category</h2>
            </div>
            <div className="modal-body">
              <p style={{ fontWeight: 600, marginBottom: 12, color: 'var(--text-main)' }}>Are you sure you want to delete this category?</p>
              <p style={{ color: 'var(--text-secondary)' }}>This action cannot be undone. All associated sub-categories will also be removed.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ background: 'var(--danger)' }} onClick={executeDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
