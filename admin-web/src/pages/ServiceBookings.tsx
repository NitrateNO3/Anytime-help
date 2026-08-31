import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ClipboardList, Clock, CheckCircle, AlertCircle, PlayCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const API_URL = 'https://anytime-help.onrender.com/api';

export default function ServiceBookings() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');
      const res = await axios.get(`${API_URL}/service-bookings/me`, {
        headers: { 'x-auth-token': token }
      });
      setBookings(res.data);
    } catch (error) {
      console.error(error);
      toast.error('Failed to fetch service bookings');
    } finally {
      setLoading(false);
    }
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
          <div style={{ textAlign: 'center', padding: '20px' }}>Loading...</div>
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
