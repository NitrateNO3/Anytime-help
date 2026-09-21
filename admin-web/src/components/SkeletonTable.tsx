import React from 'react';

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
}

export const SkeletonTable: React.FC<SkeletonTableProps> = ({ rows = 5, columns = 4 }) => {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ height: 16, width: '60%', background: '#E2E8F0', borderRadius: 4, animation: 'pulse 1.5s infinite ease-in-out' }} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rIndex) => (
            <tr key={rIndex}>
              {Array.from({ length: columns }).map((_, cIndex) => (
                <td key={cIndex} style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ height: 14, width: cIndex === columns - 1 ? '30%' : '80%', background: '#F1F5F9', borderRadius: 4, animation: 'pulse 1.5s infinite ease-in-out' }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <style>
        {`
          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
          }
        `}
      </style>
    </div>
  );
};
