import { useState, useEffect } from 'react';
import axios from 'axios';
import { ClipboardList, Clock, CheckCircle, AlertCircle, PlayCircle, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { io } from 'socket.io-client';

const API_URL = 'https://anytime-help.onrender.com/api';
const SOCKET_URL = 'https://anytime-help.onrender.com';

export default function ServiceBookings() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBookings();
    
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socket.on('booking_updated', () => fetchBookings(false));
    socket.on('new_service_booking', () => fetchBookings(false));

    return () => {
      socket.disconnect();
    };
  }, []);

  const fetchBookings = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const token = localStorage.getItem('adminToken');
      const res = await axios.get(`${API_URL}/service-bookings/me`, {
        headers: { 'x-auth-token': token }
      });
      setBookings(res.data);
    } catch (error) {
      console.error(error);
      toast.error('Failed to fetch service bookings');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const handleDelete = (id: string) => {
    toast((t) => (
      <div>
        <p style={{ fontWeight: 600, marginBottom: 12, color: 'var(--text-main)' }}>Are you sure you want to delete this booking?</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button 
            onClick={() => toast.dismiss(t.id)} 
            style={{ padding: '6px 16px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'white', cursor: 'pointer', fontWeight: 500, color: 'var(--text-main)' }}
          >
            Cancel
          </button>
          <button 
            onClick={async () => {
              toast.dismiss(t.id);
              const loadingToast = toast.loading('Deleting booking...');
              try {
                const token = localStorage.getItem('adminToken');
                await axios.delete(`${API_URL}/service-bookings/${id}`, {
                  headers: { 'x-auth-token': token }
                });
                toast.success('Booking deleted successfully!', { id: loadingToast });
                setBookings(prev => prev.filter(b => b._id !== id));
              } catch (error) {
                console.error(error);
                toast.error('Failed to delete booking', { id: loadingToast });
              }
            }} 
            style={{ padding: '6px 16px', borderRadius: 8, border: 'none', background: 'var(--danger)', color: 'white', cursor: 'pointer', fontWeight: 600 }}
          >
            Delete
          </button>
        </div>
      </div>
    ), { duration: Infinity, style: { minWidth: '300px' } });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <span style={{ background: '#fef3c7', color: '#d97706', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Clock size={12} /> Pending</span>;
      case 'ACCEPTED':
        return <span style={{ background: '#dbeafe', color: '#2563eb', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}><AlertCircle size={12} /> Accepted</span>;
      case 'IN_PROGRESS':
        return <span style={{ background: '#f3e8ff', color: '#9333ea', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}><PlayCircle size={12} /> In Progress</span>;
      case 'COMPLETED':
        return <span style={{ background: '#d1fae5', color: '#059669', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle size={12} /> Completed</span>;
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <header className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="page-title">Service Bookings</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>View and manage all resident service requests.</p>
        </div>
      </header>

      <div className="glass table-container">
        {loading ? (
          <table style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Service</th>
                <th>Resident</th>
                <th>Address</th>
                <th>Preferred Time</th>
                <th>Staff Assigned</th>
                <th>Status</th>
                <th>Requested At</th>
                <th style={{ width: 80, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, idx) => (
                <tr key={`skeleton-${idx}`}>
                  <td><div className="skeleton skeleton-row" style={{ width: '80%' }}></div></td>
                  <td>
                    <div className="skeleton skeleton-row" style={{ height: 16, width: '80%', marginBottom: 4 }}></div>
                    <div className="skeleton skeleton-row" style={{ height: 12, width: '60%' }}></div>
                  </td>
                  <td><div className="skeleton skeleton-row" style={{ width: '70%' }}></div></td>
                  <td><div className="skeleton skeleton-row" style={{ width: '60%' }}></div></td>
                  <td><div className="skeleton skeleton-row" style={{ width: '80%' }}></div></td>
                  <td><div className="skeleton skeleton-row" style={{ width: 80, height: 24, borderRadius: 12 }}></div></td>
                  <td><div className="skeleton skeleton-row" style={{ width: '70%' }}></div></td>
                  <td><div className="skeleton skeleton-row" style={{ width: 30, margin: '0 auto' }}></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : bookings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            <ClipboardList size={40} color="var(--border-color)" style={{ margin: '0 auto 16px' }} />
            No service bookings found.
          </div>
        ) : (
          <table style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Service</th>
                <th>Resident</th>
                <th>Address</th>
                <th>Preferred Time</th>
                <th>Staff Assigned</th>
                <th>Status</th>
                <th>Requested At</th>
                <th style={{ width: 80, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map(booking => (
                <tr key={booking._id}>
                  <td style={{ fontWeight: 600 }}>{booking.service?.name || 'Unknown'}</td>
                  <td>
                    <div>{booking.resident?.name || 'Unknown'}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{booking.resident?.phone_number}</div>
                  </td>
                  <td>{booking.address}</td>
                  <td>{booking.preferred_time}</td>
                  <td>
                    {booking.assigned_staff ? (
                      booking.assigned_staff.name
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>
                    )}
                  </td>
                  <td>{getStatusBadge(booking.status)}</td>
                  <td>{new Date(booking.createdAt).toLocaleDateString()}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button 
                      onClick={() => handleDelete(booking._id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, borderRadius: 8 }}
                      title="Delete Booking"
                    >
                      <Trash2 size={18} color="var(--danger)" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
