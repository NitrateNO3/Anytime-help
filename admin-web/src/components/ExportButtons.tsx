import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Download } from 'lucide-react';
import toast from 'react-hot-toast';

export interface ExportColumn {
  header: string;
  key: string | ((row: any) => string);
}

interface ExportButtonsProps {
  data: any[];
  columns: ExportColumn[];
  filename: string;
}

export function ExportButtons({ data, columns, filename }: ExportButtonsProps) {
  
  const getRowData = (row: any) => {
    return columns.map(col => {
      if (typeof col.key === 'function') {
        const val = col.key(row);
        return val ? String(val) : 'N/A';
      }
      return row[col.key] ? String(row[col.key]) : 'N/A';
    });
  };

  const handleExcel = () => {
    try {
      if (!data || data.length === 0) return toast.error('No data to export');
      
      const headers = columns.map(c => c.header);
      const rows = data.map(getRowData);
      
      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
      XLSX.writeFile(workbook, `${filename}.xlsx`);
      toast.success('Excel downloaded!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to export Excel');
    }
  };

  const handlePDF = () => {
    try {
      if (!data || data.length === 0) return toast.error('No data to export');

      const doc = new jsPDF();
      const headers = columns.map(c => c.header);
      const rows = data.map(getRowData);

      // Add Title
      doc.setFontSize(16);
      doc.text(filename.replace(/_/g, ' ').toUpperCase(), 14, 15);
      doc.setFontSize(10);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);

      autoTable(doc, {
        head: [headers],
        body: rows,
        startY: 28,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [59, 130, 246] }
      });

      doc.save(`${filename}.pdf`);
      toast.success('PDF downloaded!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to export PDF');
    }
  };

  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      <button 
        onClick={handleExcel}
        style={{ 
          display: 'flex', alignItems: 'center', gap: '6px', 
          backgroundColor: '#10B981', color: '#FFF', 
          padding: '8px 12px', borderRadius: '6px', 
          border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '13px' 
        }}
        title="Download Excel"
      >
        <Download size={14} /> Excel
      </button>
      <button 
        onClick={handlePDF}
        style={{ 
          display: 'flex', alignItems: 'center', gap: '6px', 
          backgroundColor: '#EF4444', color: '#FFF', 
          padding: '8px 12px', borderRadius: '6px', 
          border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '13px' 
        }}
        title="Download PDF"
      >
        <Download size={14} /> PDF
      </button>
    </div>
  );
}
