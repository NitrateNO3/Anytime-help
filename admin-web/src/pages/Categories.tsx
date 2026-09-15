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

  const [formData, setFormData] = useState({
    title: '',
    image: '',
    subCategories: [] as string[]
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [removeImageFlag, setRemoveImageFlag] = useState(false);
  const [newSub, setNewSub] = useState('');

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
      setFormData({
        title: category.title || '',
        image: category.image || '',
        subCategories: category.subCategories || []
      });
    } else {
      setEditingId(null);
      setFormData({
        title: '',
        image: '',
        subCategories: []
      });
    }
    setImageFile(null);
    setRemoveImageFlag(false);
    setNewSub('');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const handleAddSubCategory = () => {
    if (newSub.trim() === '') {
      toast.error('Please enter subcategory name');
      return;
    }

    if (formData.subCategories.includes(newSub.trim())) {
      toast.error('Subcategory already exists');
      return;
    }

    setFormData({
      ...formData,
      subCategories: [...formData.subCategories, newSub.trim()]
    });

    setNewSub('');
  };

  const handleRemoveSubCategory = (indexToRemove: number) => {
    setFormData({
      ...formData,
      subCategories: formData.subCategories.filter((_, index) => index !== indexToRemove)
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
    
    let finalSubCategories = [...formData.subCategories];
    if (newSub.trim() !== '' && !finalSubCategories.includes(newSub.trim())) {
      finalSubCategories.push(newSub.trim());
    }

    payload.append('subCategories', JSON.stringify(finalSubCategories));

    if (imageFile) {
      payload.append('image', imageFile);
    }
    if (removeImageFlag) {
      payload.append('removeImage', 'true');
    }

    const loadingToast = toast.loading(editingId ? 'Updating category...' : 'Creating category...');

    try {
      const token = localStorage.getItem('adminToken');
      const config = {
        headers: {
          'Content-Type': 'multipart/form-data',
          'x-auth-token': token
        }
      };

      if (editingId) {
        await axios.put(`${API_URL}/categories/${editingId}`, payload, config);
        toast.success('Category updated successfully!', { id: loadingToast });
      } else {
        await axios.post(`${API_URL}/categories`, payload, config);
        toast.success('Category created successfully!', { id: loadingToast });
      }

      handleCloseModal();
      fetchCategories();
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.msg || 'Failed to save category', { id: loadingToast });
    }
  };

  const confirmDelete = (id: string) => {
    setDeleteId(id);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const loadingToast = toast.loading('Deleting category...');
    try {
      const token = localStorage.getItem('adminToken');
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {[1, 2, 3, 4].map(idx => (
            <div key={`skeleton-${idx}`} className="card" style={{ padding: '16px 20px', borderRadius: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', width: '100%' }}>
                  <div className="skeleton" style={{ width: '48px', height: '48px', borderRadius: '12px' }}></div>
                  <div style={{ width: '100%' }}>
                    <div className="skeleton skeleton-row" style={{ width: '40%', height: '16px', marginBottom: '8px' }}></div>
                    <div className="skeleton skeleton-row" style={{ width: '25%', height: '12px' }}></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {categories.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
              <h3>No categories found</h3>
              <p style={{ color: 'var(--text-secondary)' }}>Add your first category.</p>
            </div>
          ) : (
            categories.map((cat) => (
              <div key={cat._id} className="card" style={{ display: 'flex', flexDirection: 'column', padding: '16px 20px', borderRadius: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
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
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>{cat.title}</h3>
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', display: 'inline-block' }}>
                        {cat.subCategories?.length || 0} Sub-categories
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-icon" onClick={() => handleOpenModal(cat)} style={{ color: 'var(--primary)' }} title="Edit Category">
                      <Edit2 size={18} />
                    </button>
                    <button className="btn btn-icon" onClick={() => confirmDelete(cat._id)} style={{ color: 'var(--danger)' }} title="Delete Category">
                      <Trash2 size={18} />
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
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h2>{editingId ? 'Edit Category' : 'Add New Category'}</h2>
              <button className="btn btn-icon" onClick={handleCloseModal}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="modal-body">
              <div className="form-group">
                <label className="form-label">Category Title *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={formData.title} 
                  onChange={(e) => setFormData({...formData, title: e.target.value})} 
                  placeholder="e.g. Electricity" 
                  required 
                />
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
                <label className="form-label">Sub Categories</label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={newSub} 
                    onChange={(e) => setNewSub(e.target.value)} 
                    placeholder="e.g. Power Outage"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSubCategory();
                      }
                    }}
                  />
                  <button type="button" className="btn btn-primary" onClick={handleAddSubCategory} style={{ whiteSpace: 'nowrap', padding: '0 16px' }}>
                    <Plus size={16} /> Add
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {formData.subCategories.map((sub, index) => (
                    <div key={index} style={{ 
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', 
                      backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' 
                    }}>
                      <span style={{ fontWeight: 500, color: '#1E293B', fontSize: '14px' }}>{sub}</span>
                      <button type="button" onClick={() => handleRemoveSubCategory(index)} style={{ 
                        background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', display: 'flex' 
                      }}>
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                  {formData.subCategories.length === 0 && (
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
              <button className="btn btn-secondary" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
