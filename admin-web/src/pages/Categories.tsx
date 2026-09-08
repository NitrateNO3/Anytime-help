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
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    image: '',
    subCategories: [] as string[]
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [removeImageFlag, setRemoveImageFlag] = useState(false);
  const [newSubCategory, setNewSubCategory] = useState('');

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
        title: category.title,
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
    setNewSubCategory('');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const handleAddSubCategory = () => {
    if (newSubCategory.trim() === '') return;
    setFormData({
      ...formData,
      subCategories: [...formData.subCategories, newSubCategory.trim()]
    });
    setNewSubCategory('');
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
    if (newSubCategory.trim() !== '') {
      finalSubCategories.push(newSubCategory.trim());
    }
    payload.append('subCategories', JSON.stringify(finalSubCategories));
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
      setNewSubCategory('');
      fetchCategories();
    } catch (error) {
      console.error(error);
      toast.error('Failed to save category', { id: loadingToast });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this category?')) return;

    const loadingToast = toast.loading('Deleting category...');
    try {
      const token = localStorage.getItem('adminToken') || '';
      await axios.delete(`${API_URL}/categories/${id}`, {
        headers: { 'x-auth-token': token }
      });
      toast.success('Category deleted successfully!', { id: loadingToast });
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
        <div style={{ textAlign: 'center', padding: '40px' }}>Loading categories...</div>
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
                      <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)' }}>{cat.title}</h3>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {cat.subCategories?.length || 0} Sub-categories
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-icon" onClick={() => handleOpenModal(cat)} style={{ color: 'var(--primary)' }}>
                      <Edit2 size={16} />
                    </button>
                    <button className="btn btn-icon" onClick={() => handleDelete(cat._id)} style={{ color: 'var(--danger)' }}>
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
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>{editingId ? 'Edit Category' : 'Add New Category'}</h2>
              <button className="btn btn-icon" onClick={handleCloseModal}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="modal-body">
              <div className="form-group">
                <label className="form-label">Category Title</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={formData.title} 
                  onChange={(e) => setFormData({...formData, title: e.target.value})} 
                  placeholder="e.g. ELECTRICITY" 
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
                          // Reset the file input value so the same file can be selected again if needed
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
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={newSubCategory} 
                    onChange={(e) => setNewSubCategory(e.target.value)} 
                    placeholder="Add a sub-category..."
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSubCategory();
                      }
                    }}
                  />
                  <button type="button" className="btn btn-secondary" onClick={handleAddSubCategory}>
                    Add
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
                  {formData.subCategories.map((sub, index) => (
                    <div key={index} style={{ 
                      display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', 
                      backgroundColor: '#EFF6FF', borderRadius: '16px', color: '#1D4ED8', fontSize: '13px' 
                    }}>
                      {sub}
                      <button type="button" onClick={() => handleRemoveSubCategory(index)} style={{ 
                        background: 'none', border: 'none', color: '#1D4ED8', cursor: 'pointer', display: 'flex' 
                      }}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
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
    </div>
  );
}
