'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { X, FileText, Upload, CheckCircle2, Loader2, Save } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { PrismInput } from '@/components/ui/PrismInput';
import { SignaturePad } from '@/components/ui/SignaturePad';
import {
  EDITED_IRREGULARITY_DOCX_MARKER,
  generateWord,
  persistEditedWordDocument,
} from '@/lib/utils/document-generator';

interface DocxEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reportData: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSuccess: (updatedReport: any) => void;
}

export function DocxEditorModal({ isOpen, onClose, reportData, onSuccess }: DocxEditorModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    description: reportData?.description || '',
    root_cause: reportData?.root_caused || reportData?.root_cause || '',
    action_taken: reportData?.action_taken || '',
    preventive_action: reportData?.preventive_action || '',
    location: reportData?.location || reportData?.branch || '',
    reporter_name: reportData?.reporter_name || '',
  });

  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  useEffect(() => {
    if (isOpen && reportData) {
      setFormData({
        description: reportData.description || '',
        root_cause: reportData.root_caused || reportData.root_cause || '',
        action_taken: reportData.action_taken || '',
        preventive_action: reportData.preventive_action || '',
        location: reportData.location || reportData.branch || '',
        reporter_name: reportData.reporter_name || '',
      });
      setSignatureData(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, reportData?.id]);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveAndDownload = async () => {
    setIsSaving(true);
    try {
      const patchId = String(reportData.original_id || reportData.id);
      const response = await fetch(`/api/reports/${encodeURIComponent(patchId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to update report data');
      }

      const { data } = await response.json();

      const updatedReportBase = {
        ...reportData,
        ...data,

        description: formData.description || data?.description || reportData?.description,
        root_cause: formData.root_cause || data?.root_caused || data?.root_cause || reportData?.root_caused,
        root_caused: formData.root_cause || data?.root_caused || reportData?.root_caused,
        action_taken: formData.action_taken || data?.action_taken || reportData?.action_taken,
        preventive_action: formData.preventive_action || data?.preventive_action || reportData?.preventive_action,
        reporter_name: formData.reporter_name || data?.reporter_name || reportData?.reporter_name,
        location: formData.location || data?.location || reportData?.location,
        branch: formData.location || data?.branch || reportData?.branch,
      };
      let updatedReport = updatedReportBase;
      const reportId = updatedReport.original_id || updatedReport.id;
      const safeReportId = String(reportId || 'report').replace(/[^a-zA-Z0-9._-]+/g, '_');
      const filename = `${EDITED_IRREGULARITY_DOCX_MARKER}__${safeReportId}.docx`;
      const blob = await generateWord(updatedReport, signatureData, { filename });

      if (reportId) {
        const url = await persistEditedWordDocument(reportId, blob, filename);
        updatedReport = {
          ...updatedReport,
          evidence_urls: [...new Set([...(updatedReport.evidence_urls || []), url])],
        };
      }

      onSuccess(updatedReport);
      onClose();
    } catch (error) {
      console.error('Error saving and downloading DOCX:', error);
      alert('An error occurred while saving changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      alert('Maximum file size is 20MB');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadSuccess(false);

    try {

      const uploadForm = new FormData();
      uploadForm.append('file', file);

      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      const uploadResponse = await fetch('/api/uploads/document', {
        method: 'POST',
        body: uploadForm,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload document');
      }

      const { url, size } = await uploadResponse.json();

      const newAttachment = {
        name: file.name,
        url: url,
        size: size,
        type: file.type,
        uploadedAt: new Date().toISOString()
      };

      const existingAttachments = Array.isArray(reportData.attachments) ? reportData.attachments : [];
      const updatedAttachments = [...existingAttachments, newAttachment];

      const patchResponse = await fetch(`/api/reports/${reportData.original_id || reportData.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attachments: updatedAttachments }),
      });

      if (!patchResponse.ok) {
        throw new Error('Failed to save document reference');
      }

      setUploadSuccess(true);

      const { data } = await patchResponse.json();
      onSuccess({ ...reportData, ...data });

      setTimeout(() => {
        setUploadSuccess(false);
        setUploadProgress(0);
      }, 3000);

    } catch (error) {
      console.error('Upload error:', error);
      alert(error instanceof Error ? error.message : 'Terjadi kesalahan saat upload');
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[90vh] overflow-hidden"
        >
          <div className="flex items-center justify-between p-6 border-b border-gray-100 shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Edit & Download Document</h2>
                <p className="text-sm text-gray-500">Adjust data before downloading the report as a Word file</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 bg-gray-50 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-gray-50/50">

            {}
            <div className="space-y-6">
              <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400"/> DOCX Fill Form
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {}
                 {(reportData?.evidence_url || (reportData?.evidence_urls && reportData.evidence_urls.length > 0)) && (
                  <div className="col-span-full space-y-2">
                    <label className="text-sm font-medium text-gray-700">Evidence Photo Links</label>
                    <div className="flex flex-wrap gap-2">
                      {reportData?.evidence_url && (
                        <a 
                          href={reportData.evidence_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
                        >
                          View Evidence Photo
                        </a>
                      )}
                      {reportData?.evidence_urls?.map((url: string, i: number) => (
                        <a 
                          key={i}
                          href={url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
                        >
                          View Evidence Photo {i + 1}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                 {}
                <div className="col-span-full space-y-2">
                  <label className="text-sm font-medium text-gray-700">Chronology of Event</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Explain the chronology of the event..."
                    className="min-h-[120px] bg-white text-base resize-y w-full rounded-md border border-gray-300 p-3 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>

                {}
                <div className="col-span-full space-y-2">
                  <label className="text-sm font-medium text-gray-700">Potential / Root Cause</label>
                  <textarea
                    name="root_cause"
                    value={formData.root_cause}
                    onChange={handleInputChange}
                    placeholder="Explain the root cause..."
                    className="min-h-[100px] bg-white text-base resize-y w-full rounded-md border border-gray-300 p-3 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>

                {}
                <div className="col-span-full space-y-2">
                  <label className="text-sm font-medium text-gray-700">Corrective Action (Immediate Action)</label>
                  <textarea
                    name="action_taken"
                    value={formData.action_taken}
                    onChange={handleInputChange}
                    placeholder="Explain the immediate corrective action taken..."
                    className="min-h-[100px] bg-white text-base resize-y w-full rounded-md border border-gray-300 p-3 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>

                {}
                <div className="col-span-full space-y-2">
                  <label className="text-sm font-medium text-gray-700">Preventive Action</label>
                  <textarea
                    name="preventive_action"
                    value={formData.preventive_action}
                    onChange={handleInputChange}
                    placeholder="Explain the preventive action for the future..."
                    className="min-h-[100px] bg-white text-base resize-y w-full rounded-md border border-gray-300 p-3 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>

                {}
                <div className="space-y-4 pt-2">
                  <PrismInput
                    type="text"
                    name="reporter_name"
                    value={formData.reporter_name}
                    onChange={handleInputChange}
                    label="Prepared By (Signed By)"
                    placeholder="Signatory Name..."
                    className="bg-white"
                  />
                </div>

                {}
                <div className="space-y-4 pt-2">
                  <PrismInput
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleInputChange}
                    label="Location (City/Station shown on signature)"
                    placeholder="e.g. Cengkareng / CGK"
                    className="bg-white"
                  />
                </div>

                {}
                <div className="col-span-full space-y-2">
                  <SignaturePad 
                    onEnd={(dataUrl) => setSignatureData(dataUrl)}
                    label="Reporter Signature / Prepared By"
                  />
                </div>
              </div>
            </div>

            <hr className="border-gray-200" />

            {}
            <div className="space-y-4">
               <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                <Upload className="w-4 h-4 text-gray-400"/> Upload Latest Document
              </h3>
                <p className="text-sm text-gray-500">
                If you have downloaded, filled manually, or have a signed document, you can upload it back here.
              </p>

              <div 
                className={`relative overflow-hidden border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                  isUploading ? 'bg-blue-50/50 border-blue-200' : 
                  uploadSuccess ? 'bg-green-50/50 border-green-200' :
                  'bg-gray-50/50 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden" 
                />

                {!isUploading && !uploadSuccess && (
                  <div className="space-y-4 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                    <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mx-auto border border-gray-100">
                      <Upload className="w-6 h-6 text-gray-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Click to select document</p>
                      <p className="text-sm text-gray-500 mt-1">PDF or DOCX format (Max 20MB)</p>
                    </div>
                  </div>
                )}

                {isUploading && (
                  <div className="space-y-4">
                    <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto" />
                    <p className="font-medium text-blue-900">Uploading Document...</p>
                    <div className="w-full max-w-xs mx-auto h-2 bg-blue-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 transition-all duration-300 ease-out"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {uploadSuccess && (
                  <div className="space-y-4">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-8 h-8 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-green-900">Document Successfully Uploaded!</p>
                      <p className="text-sm text-green-600/70 mt-1">Has been attached to this report.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>

          <div className="p-4 bg-white border-t border-gray-100 flex justify-between shrink-0">
             <Button
              variant="outline"
              onClick={onClose}
              disabled={isSaving || isUploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveAndDownload}
              disabled={isSaving || isUploading}
              className="bg-blue-600 hover:bg-blue-700 text-white min-w-[200px]"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing DOCX...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save & Download DOCX
                </>
              )}
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body,
  );
}
