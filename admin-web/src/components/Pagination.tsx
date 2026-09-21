import React from 'react';

interface PaginationProps {
  page: number;
  totalPages: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
}

export const Pagination: React.FC<PaginationProps> = ({ page, totalPages, setPage }) => {
  if (totalPages <= 1) return null;

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, padding: '0 10px' }}>
      <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>
        Showing page {page} of {totalPages}
      </span>
      <div style={{ display: 'flex', gap: 10 }}>
        <button 
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          style={{ 
            padding: '6px 12px', 
            borderRadius: 8, 
            border: '1px solid var(--border-color)', 
            background: page === 1 ? '#f3f4f6' : 'white', 
            cursor: page === 1 ? 'not-allowed' : 'pointer' 
          }}
        >
          Previous
        </button>
        <button 
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
          style={{ 
            padding: '6px 12px', 
            borderRadius: 8, 
            border: '1px solid var(--border-color)', 
            background: page === totalPages ? '#f3f4f6' : 'white', 
            cursor: page === totalPages ? 'not-allowed' : 'pointer' 
          }}
        >
          Next
        </button>
      </div>
    </div>
  );
};
