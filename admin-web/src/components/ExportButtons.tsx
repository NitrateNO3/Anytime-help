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
  fetchAllData?: () => Promise<any[]>;
}

export function ExportButtons({ data, columns, filename, fetchAllData }: ExportButtonsProps) {
  
  const getRowData = (row: any) => {
    return columns.map(col => {
      if (typeof col.key === 'function') {
        const val = col.key(row);
        return val ? String(val) : 'N/A';
      }
      return row[col.key] ? String(row[col.key]) : 'N/A';
    });
  };

  const exportExcel = (exportData: any[]) => {
    if (!exportData || exportData.length === 0) throw new Error('No data to export');
    
    const headers = columns.map(c => c.header);
    const rows = exportData.map(getRowData);
    
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    XLSX.writeFile(workbook, `${filename}.xlsx`);
  };

  const handleExcel = () => {
    try {
      if (!data || data.length === 0) return toast.error('No data to export');
      exportExcel(data);
      toast.success('Excel downloaded!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to export Excel');
    }
  };

  const handleExcelAll = async () => {
    if (!fetchAllData) return;
    const loadingId = toast.loading('Fetching all data...');
    try {
      const allData = await fetchAllData();
      if (!allData || allData.length === 0) {
        toast.dismiss(loadingId);
        toast.error('No data found');
        return;
      }
      exportExcel(allData);
      toast.success('All Excel downloaded!', { id: loadingId });
    } catch (err) {
      console.error(err);
      toast.error('Failed to export all data', { id: loadingId });
    }
  };

  const exportPDF = (exportData: any[]) => {
    if (!exportData || exportData.length === 0) throw new Error('No data to export');

    const doc = new jsPDF();
    const headers = columns.map(c => c.header);
    const rows = exportData.map(getRowData);

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
  };

  const handlePDF = () => {
    try {
      if (!data || data.length === 0) return toast.error('No data to export');
      exportPDF(data);
      toast.success('PDF downloaded!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to export PDF');
    }
  };

  const handlePDFAll = async () => {
    if (!fetchAllData) return;
    const loadingId = toast.loading('Fetching all data...');
    try {
      const allData = await fetchAllData();
      if (!allData || allData.length === 0) {
        toast.dismiss(loadingId);
        toast.error('No data found');
        return;
      }
      exportPDF(allData);
      toast.success('All PDF downloaded!', { id: loadingId });
    } catch (err) {
      console.error(err);
      toast.error('Failed to export all data', { id: loadingId });
    }
  };

  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      <button 
        onClick={handleExcel}
        style={{ 
          display: 'flex', alignItems: 'center', gap: '6px', 
          backgroundColor: '#10B981', color: '#FFF', 
          padding: '8px 12px', borderRadius: '6px', 
          border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '13px' 
        }}
        title="Download Excel (Current Page)"
      >
        <Download size={14} /> Excel
      </button>
      
      {fetchAllData && (
        <button 
          onClick={handleExcelAll}
          style={{ 
            display: 'flex', alignItems: 'center', gap: '6px', 
            backgroundColor: '#059669', color: '#FFF', 
            padding: '8px 12px', borderRadius: '6px', 
            border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '13px' 
          }}
          title="Download Excel (All Pages)"
        >
          <Download size={14} /> All Excel
        </button>
      )}

      <button 
        onClick={handlePDF}
        style={{ 
          display: 'flex', alignItems: 'center', gap: '6px', 
          backgroundColor: '#EF4444', color: '#FFF', 
          padding: '8px 12px', borderRadius: '6px', 
          border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '13px' 
        }}
        title="Download PDF (Current Page)"
      >
        <Download size={14} /> PDF
      </button>

      {fetchAllData && (
        <button 
          onClick={handlePDFAll}
          style={{ 
            display: 'flex', alignItems: 'center', gap: '6px', 
            backgroundColor: '#DC2626', color: '#FFF', 
            padding: '8px 12px', borderRadius: '6px', 
            border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '13px' 
          }}
          title="Download PDF (All Pages)"
        >
          <Download size={14} /> All PDF
        </button>
      )}
    </div>
  );
}
