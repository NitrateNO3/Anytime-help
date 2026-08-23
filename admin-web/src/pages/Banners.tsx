import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Trash2, Upload, Image as ImageIcon } from 'lucide-react';
import '../index.css';

const API_URL = 'https://anytime-help.onrender.com/api';

export default function Banners() {
  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      const res = await axios.get(`${API_URL}/banners`);
      setBanners(res.data);
    } catch (error) {
      console.error(error);
      toast.error('Failed to fetch banners');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('image', file);

    setUploading(true);
    const loadingToast = toast.loading('Uploading banner...');

    try {
      await axios.post(`${API_URL}/banners/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      toast.success('Banner uploaded successfully!', { id: loadingToast });
      fetchBanners();
    } catch (error) {
      console.error(error);
      toast.error('Failed to upload banner', { id: loadingToast });
    } finally {
      setUploading(false);
      // Reset file input
      e.target.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this banner?')) return;

    const loadingToast = toast.loading('Deleting banner...');
    try {
      await axios.delete(`${API_URL}/banners/${id}`);
      toast.success('Banner deleted successfully!', { id: loadingToast });
      fetchBanners();
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete banner', { id: loadingToast });
    }
  };

  return (
    <div className="page-container fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-title">Manage Banners</h1>
          <p className="page-subtitle">Upload and manage banners for the app login screen</p>
        </div>
        
        <div>
          <label className="btn btn-primary" style={{ cursor: uploading ? 'not-allowed' : 'pointer' }}>
            <Upload size={18} />
            {uploading ? 'Uploading...' : 'Upload Banner'}
            <input 
              type="file" 
              accept="image/*" 
              style={{ display: 'none' }} 
              onChange={handleFileChange}
              disabled={uploading}
            />
          </label>
        </div>
      </header>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>Loading banners...</div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {banners.length === 0 ? (
            <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px' }}>
              <ImageIcon size={48} color="#cbd5e1" style={{ margin: '0 auto 16px' }} />
              <h3>No banners found</h3>
              <p style={{ color: 'var(--text-secondary)' }}>Upload your first banner to see it on the app.</p>
            </div>
          ) : (
            banners.map((banner) => (
              <div key={banner._id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <img 
                  src={banner.url} 
                  alt="Banner" 
                  style={{ width: '100%', height: '200px', objectFit: 'cover' }} 
                />
                <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Added on {new Date(banner.createdAt).toLocaleDateString()}
                  </span>
                  <button 
                    className="btn btn-icon" 
                    onClick={() => handleDelete(banner._id)}
                    style={{ color: 'var(--danger)' }}
                    title="Delete Banner"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
