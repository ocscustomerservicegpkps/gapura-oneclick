
'use client';
/* eslint-disable react/no-unescaped-entities */

import { useState } from 'react';
import { useDropzone } from 'react-dropzone';

import { Upload, FileUp, AlertCircle, CheckCircle, Loader2, X, Database, Truck, Plane, FileSpreadsheet } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type ImportType = 'NON_CARGO' | 'CARGO';

const HEADER_MAPPING: Record<string, string> = {

  'Date of Event': 'date_of_event',
  'Date': 'date_of_event',
  'Tanggal': 'date_of_event',
  'Bulan': 'date_of_event',
  'Incident Date': 'date_of_event',

  'Jenis Maskapai': 'jenis_maskapai',
  'Airlines': 'airline',
  'Airline': 'airline',
  'Flight Number': 'flight_number',
  'Route': 'route',

  'Reporting Branch': 'reporting_branch',
  'Branch': 'branch',
  'Branch ': 'branch',
  'Station': 'branch',
  'HUB': 'hub',
  'KODE CABANG (VLOOKUP)': 'kode_cabang',
  'KODE HUB (VLOOKUP)': 'kode_hub',

  'Report Category': 'main_category',
  'Irregularity/Complain Category': 'irregularity_complain_category',
  'Main Category': 'main_category',
  'Case Category': 'case_category',

  'Report': 'description',
  'Description': 'description',
  'Root Caused': 'root_caused',
  'Action Taken': 'action_taken',
  'Gapura KPS Remarks': 'kps_remarks',
  'Final Remarks': 'kps_remarks',
  'Gapura KPS Action Taken': 'gapura_kps_action_taken',
  'Preventive Action': 'preventive_action',
  'Remarks Case': 'remarks_case',
  'Accident / Incident': 'accident_incident',
  'Case Classification': 'case_classification',
  'Identification of Root': 'identification_of_root',
  'Issue Caused': 'issue_caused',
  'Breakdown Caused': 'breakdown_caused',

  'Remarks Gapura KPS': 'sub_category_note',
  'Sub Category Note': 'sub_category_note',
  'Primary Tag': 'primary_tag',
  'ESKLASI DIVISI': 'esklasi_divisi',

  'Report By': 'reporter_name',
  'Upload Irregularity Photo': 'evidence_url',
  'Status': 'status',
  'Per Week in Month': 'week_in_month',
  'Severity Level': 'severity',

  'Area': 'area',
  'Terminal Area Category': 'terminal_area_category',
  'Apron Area Category': 'apron_area_category',
  'General Category': 'general_category',
  'Location of Incident': 'specific_location',
  'Service Business Type': 'service_business_type',

  'MASKAPAI (VLOOKUP)': 'maskapai_lookup',
  'Lokal / MPA (VLOOKUP)': 'lokal_mpa_lookup',

  'GSE Available & Requirement': 'gse_available_requirement',
  'GSE Requirement': 'gse_requirement',
  'Delay Code': 'delay_code',
  'Delay Duration': 'delay_duration',
};

const excelSerialToDate = (val: string | number): Date | null => {
  if (!val || val === '#N/A' || val === 'N/A') return null;
  if (typeof val === 'number') {

    return new Date((val - 25569) * 86400 * 1000);
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

const parseDateOnly = (val: string | number): string | null => {

  if (typeof val === 'string' && val.match(/^\d{1,2}\/\d{1,2}\/\d{4}/)) {
      const d = new Date(val);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }

  const d = excelSerialToDate(val);
  if (!d) return null;
  return d.toISOString().split('T')[0];
};

const normalizeStatus = (raw: string | undefined | null): string => {
  if (!raw) return 'OPEN';
  const upper = raw.toString().trim().toUpperCase();
  if (['SELESAI', 'CLOSED', 'DONE', 'RESOLVED', 'CLOSE'].includes(upper)) return 'CLOSED';
  if (['SUDAH_DIVERIFIKASI', 'VERIFIED', 'ON PROGRESS', 'ON_PROGRESS', 'SUDAH DIVERIFIKASI'].includes(upper)) return 'ON PROGRESS';
  return 'OPEN';
};

const normalizeSeverity = (raw: string | undefined | null): string => {
  if (!raw) return 'LOW';
  const upper = raw.toString().trim().toUpperCase();
  if (['TOP RISK', 'URGENT', 'CRITICAL'].includes(upper)) return 'TOP RISK';
  if (['HIGH', 'HIGH RISK'].includes(upper)) return 'HIGH RISK';
  if (['MEDIUM'].includes(upper)) return 'MEDIUM';
  return 'LOW';
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapRowToReport = (row: any, importType: ImportType) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const report: any = {};

  Object.keys(row).forEach((csvHeader) => {

    let dbKey = HEADER_MAPPING[csvHeader.trim()];

    if (!dbKey) {
       const norm = csvHeader.trim().toLowerCase();
       const found = Object.keys(HEADER_MAPPING).find(k => k.toLowerCase() === norm);
       if (found) dbKey = HEADER_MAPPING[found];
    }

    if (dbKey) {
        report[dbKey] = row[csvHeader];
    }
  });

  if (report.date_of_event) {
      report.date_of_event = parseDateOnly(report.date_of_event);
  }
  if (!report.date_of_event) {

      report.created_at = new Date().toISOString(); 

  } else {
      report.created_at = new Date(report.date_of_event).toISOString();
  }

  report.updated_at = new Date().toISOString();

  report.status = normalizeStatus(report.status);
  report.severity = normalizeSeverity(report.severity);

  if (importType === 'CARGO') {
      report.area = 'CARGO';
      report.source_sheet = 'CGO';

  } else if (importType === 'NON_CARGO') {
      report.source_sheet = 'NON CARGO';

      if (!report.area && report.terminal_area_category) report.area = 'TERMINAL';
      if (!report.area && report.apron_area_category) report.area = 'APRON';
  }

  if (row['Id'] || row['ID'] || row['No']) {
      const id = row['Id'] || row['ID'] || row['No'];
      report.reference_number = `IMP-${importType}-${id}`;
      report.csv_id = Number(id) || null;
  } else {

      report.reference_number = `IMP-${Date.now()}-${Math.floor(Math.random()*1000)}`;
  }

  if (!report.title) {
      report.title = `${report.main_category || 'Report'} - ${report.airline || 'Unknown'}`;
  }

  return report;
};

export default function ImportDataPage() {
  const [importType, setImportType] = useState<ImportType>('NON_CARGO');
  const [file, setFile] = useState<File | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [successCount, setSuccessCount] = useState(0);

  const onDrop = (acceptedFiles: File[]) => {
    const uploadedFile = acceptedFiles[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      parseFile(uploadedFile);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    },
    multiple: false
  });

  const parseFile = async (file: File) => {
    try {
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const arrayBuffer = await file.arrayBuffer();

      if (file.name.endsWith('.csv')) {

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await workbook.csv.read(new Response(arrayBuffer).body! as any);
      } else {
        await workbook.xlsx.load(arrayBuffer);
      }

      const worksheet = workbook.worksheets[0];
      if (!worksheet) throw new Error("File kosong");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const jsonData: any[] = [];
      const fileHeaders: string[] = [];

      const firstRow = worksheet.getRow(1);
      firstRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const val = cell.text || (typeof cell.value === 'string' ? cell.value : '');
        fileHeaders[colNumber - 1] = val.trim();
      });
      setHeaders(fileHeaders.filter(Boolean));

      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
         if (rowNumber === 1) return;
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         const rowData: any = {};
         row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            const header = fileHeaders[colNumber - 1];
            if (header) {
                rowData[header] = cell.value;
            }
         });
         jsonData.push(rowData);
      });

      setPreviewData(jsonData);
      setUploadStatus('idle');
    } catch (err) {
      console.error('Parse Error:', err);
      setErrorMessage("Failed to read file. Make sure it's a valid Excel/CSV format.");
      setUploadStatus('error');
    }
  };

  const handleImport = async () => {
    if (!previewData.length) return;

    setIsUploading(true);
    setUploadStatus('idle');
    setErrorMessage('');
    setSuccessCount(0);

    try {

      const mappedData = previewData.map((row) => mapRowToReport(row, importType));

      const response = await fetch('/api/reports/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reports: mappedData })
      });

      const result = await response.json();

      if (!response.ok) {
          throw new Error(result.error || 'Failed to import to Google Sheets');
      }

      setSuccessCount(result.count || mappedData.length);
      setUploadStatus('success');
    } catch (error) {
      console.error('Import Error:', error);
      setUploadStatus('error');
      const message = error instanceof Error ? error.message : 'Failed to import data.';
      setErrorMessage(message);
    } finally {
      setIsUploading(false);
    }
  };

  const reset = () => {
      setFile(null);
      setPreviewData([]);
      setHeaders([]);
      setUploadStatus('idle');
      setSuccessCount(0);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 pb-32">
      {}
      {}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Import Report Data</h1>
          <p className="text-gray-500 mt-1">
              Administrator mode for bulk data import from Google Sheets/Excel.
          </p>
        </div>

        <a 
            href={`https://docs.google.com/spreadsheets/d/${process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID || '1TFPZOAWAKubPl7iaUk8BXt2BabY1N-AcLgi-_zBQGzk'}/edit`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl font-bold hover:bg-emerald-100 transition-colors"
        >
            <FileSpreadsheet size={18} />
            Open in Excel
        </a>
      </div>

      {}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
          <div>
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Database size={18} className="text-blue-600" />
                1. Select Data Type
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
                <button
                    onClick={() => setImportType('NON_CARGO')}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                        importType === 'NON_CARGO' ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-100' : 'border-gray-200 hover:border-gray-300'
                    }`}
                >
                    <div className="flex items-center gap-3 mb-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${importType === 'NON_CARGO' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                            <Plane size={16} />
                        </div>
                        <span className="font-bold text-gray-900">Landside & Airside</span>
                    </div>
                    <p className="text-xs text-gray-500">Regular reports (Terminal, Apron, General). Sheet: 'NON CARGO'</p>
                </button>

                <button
                    onClick={() => setImportType('CARGO')}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                        importType === 'CARGO' ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-100' : 'border-gray-200 hover:border-gray-300'
                    }`}
                >
                     <div className="flex items-center gap-3 mb-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${importType === 'CARGO' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                            <Truck size={16} />
                        </div>
                        <span className="font-bold text-gray-900">Cargo</span>
                    </div>
                    <p className="text-xs text-gray-500">Cargo-specific reports. Sheet: 'CGO'</p>
                </button>

            </div>
          </div>
      </div>

      {}
      {!file ? (
         <div 
            {...getRootProps()} 
            className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center cursor-pointer transition-colors bg-white
                ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'}
            `}
         >
            <input {...getInputProps()} />
            <div className="w-16 h-16 bg-blue-100/50 rounded-full flex items-center justify-center mb-4 text-blue-600">
               <Upload size={32} />
            </div>
            <p className="text-lg font-semibold text-gray-700">
                {isDragActive ? 'Lepaskan file di sini...' : 'Drag & drop file di sini'}
            </p>
            <p className="text-sm text-gray-500 mt-2">atau klik untuk memilih file (.csv, .xlsx)</p>
            <p className="text-xs text-blue-600 mt-4 font-medium px-3 py-1 bg-blue-50 rounded-full">
                Target: {importType}
            </p>
         </div>
      ) : (
          <div className="space-y-6">
              {}
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-green-600">
                          <FileUp size={24} />
                      </div>
                      <div>
                          <p className="font-semibold text-gray-900">{file.name}</p>
                          <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(2)} KB • {previewData.length} Baris Data</p>
                      </div>
                  </div>
                  <button onClick={reset} disabled={isUploading} className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-full transition-colors">
                      <X size={20} />
                  </button>
              </div>

              {}
              <AnimatePresence>
                {uploadStatus === 'success' && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-green-50 text-green-700 rounded-xl flex items-center gap-3 border border-green-200">
                        <CheckCircle size={20} />
                        <span className="font-medium">Successfully imported {successCount} report records!</span>
                    </motion.div>
                )}
                {uploadStatus === 'error' && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-red-50 text-red-700 rounded-xl flex items-center gap-3 border border-red-200">
                        <AlertCircle size={20} />
                        <span className="font-medium">Error: {errorMessage}</span>
                    </motion.div>
                )}
              </AnimatePresence>

              {}
              {previewData.length > 0 && (
                  <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
                      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                          <h3 className="font-semibold text-gray-700">Preview Mapping (Top 5)</h3>
                          <span className="text-xs bg-gray-200 px-2 py-1 rounded text-gray-600">Total: {previewData.length}</span>
                      </div>
                      <div className="overflow-x-auto">
                          <table className="w-full text-sm text-left">
                              <thead className="bg-gray-50 text-gray-500">
                                  <tr>
                                      <th className="px-6 py-3 font-medium">Original Header</th>
                                      <th className="px-6 py-3 font-medium">Mapped To DB Field</th>
                                      <th className="px-6 py-3 font-medium">Preview Value</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                  {}
                                  {headers.slice(0, 10).map((header, i) => {
                                      const dbField = HEADER_MAPPING[header] || HEADER_MAPPING[header.trim()] || '-';
                                      const val = previewData[0][header];
                                      return (
                                          <tr key={i} className="hover:bg-gray-50/50">
                                              <td className="px-6 py-3 text-gray-900 font-medium">{header}</td>
                                              <td className="px-6 py-3 text-blue-600 font-mono text-xs">
                                                  {dbField !== '-' ? dbField : <span className="text-red-400">Not Mapped</span>}
                                              </td>
                                              <td className="px-6 py-3 text-gray-500 max-w-[200px] truncate">
                                                  {String(val || '')}
                                              </td>
                                          </tr>
                                      )
                                  })}
                              </tbody>
                          </table>
                      </div>
                  </div>
              )}

              {}
              <div className="flex justify-end pt-4">
                  <button
                      onClick={uploadStatus === 'success' ? reset : handleImport}
                      disabled={isUploading}
                      className={`
                          flex items-center gap-2 px-8 py-3 rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all
                          ${isUploading
                             ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                             : uploadStatus === 'success'
                                ? 'bg-green-600 text-white hover:bg-green-700'
                                : 'bg-blue-600 text-white hover:bg-blue-700 hover:-translate-y-0.5 active:translate-y-0'
                          }
                      `}
                  >
                      {isUploading && <Loader2 size={18} className="animate-spin" />}
                      {uploadStatus === 'success' ? 'Done' : isUploading ? 'Importing...' : 'Import Data Now'}
                  </button>
              </div>
          </div>
      )}
    </div>
  );
}
