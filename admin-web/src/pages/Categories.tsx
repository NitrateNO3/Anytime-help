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
    icon: 'water',
    color: '#06B6D4',
    bgColor: '#CFFAFE',
    subCategories: [] as string[]
  });
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
        icon: category.icon,
        color: category.color,
        bgColor: category.bgColor,
        subCategories: category.subCategories || []
      });
    } else {
      setEditingId(null);
      setFormData({
        title: '',
        icon: 'water',
        color: '#3B82F6',
        bgColor: '#DBEAFE',
        subCategories: []
      });
    }
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

    const loadingToast = toast.loading(editingId ? 'Updating category...' : 'Adding category...');
    try {
      const token = localStorage.getItem('token') || '';
      
      if (editingId) {
        await axios.put(`${API_URL}/categories/${editingId}`, formData, {
          headers: { 'x-auth-token': token }
        });
        toast.success('Category updated successfully!', { id: loadingToast });
      } else {
        await axios.post(`${API_URL}/categories`, formData, {
          headers: { 'x-auth-token': token }
        });
        toast.success('Category added successfully!', { id: loadingToast });
      }
      
      handleCloseModal();
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
      const token = localStorage.getItem('token') || '';
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
    <div className="page-container fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-title">Manage Categories</h1>
          <p className="page-subtitle">Configure grievance categories and sub-categories</p>
        </div>
        
        <button className="btn btn-primary" onClick={() => handleOpenModal()}>
          <Plus size={18} /> Add Category
        </button>
      </header>

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
                      width: '40px', height: '40px', borderRadius: '8px', 
                      backgroundColor: cat.bgColor || '#DBEAFE', color: cat.color || '#3B82F6',
                      display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold'
                    }}>
                      {cat.icon ? cat.icon.substring(0, 2).toUpperCase() : 'C'}
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

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {cat.subCategories?.map((sub: string, index: number) => (
                      <span key={index} style={{ 
                        fontSize: '12px', padding: '4px 8px', backgroundColor: '#F3F4F6', 
                        borderRadius: '16px', color: '#4B5563' 
                      }}>
                        {sub}
                      </span>
                    ))}
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

              <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Icon Name</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={formData.icon} 
                    onChange={(e) => setFormData({...formData, icon: e.target.value})} 
                    placeholder="e.g. flash" 
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Color (Hex)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={formData.color} 
                    onChange={(e) => setFormData({...formData, color: e.target.value})} 
                    placeholder="#3B82F6" 
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Bg Color (Hex)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={formData.bgColor} 
                    onChange={(e) => setFormData({...formData, bgColor: e.target.value})} 
                    placeholder="#DBEAFE" 
                  />
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
