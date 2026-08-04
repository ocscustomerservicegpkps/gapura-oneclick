'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { X, FileText, CheckCircle2, Loader2, Save } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PrismInput } from '@/components/ui/PrismInput';
import { SignaturePad } from '@/components/ui/SignaturePad';
import { generateBriefingWord } from '../../lib/utils/briefing-generator';
import { toLocalYMD } from '@/lib/utils/wib-date';

interface BriefingEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reportData: any;
  uploadType: 'CORRECTIVE' | 'PREVENTIVE';
  divisionName?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSuccess: (updatedReport: any) => void;
}

export function BriefingEditorModal({ isOpen, onClose, reportData, uploadType, divisionName, onSuccess }: BriefingEditorModalProps) {
  const [formData, setFormData] = useState({
    tanggal: toLocalYMD(new Date()),
    waktu: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    tempat: reportData?.location || reportData?.branch || '',
    topik: `Briefing ${uploadType === 'CORRECTIVE' ? 'Corrective Action' : 'Preventive Action'} - ${reportData?.reference_number || 'Report'}`,
    pembicara: reportData?.reporter_name || '',
    notulensi: '',
  });

  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [, setUploadedUrl] = useState<string | null>(null);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDownload = async () => {
    try {
      const docxBlob = await generateBriefingWord(formData, signatureData);
      const url = URL.createObjectURL(docxBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Briefing_${uploadType}_${formData.tanggal}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading DOCX:', error);
      alert('Failed to download briefing form.');
    }
  };

  const handleSaveAndUpload = async () => {
    if (!signatureData) {
      alert("Please provide a signature for the briefing first.");
      return;
    }

    setIsSaving(true);
    try {

      const docxBlob = await generateBriefingWord(formData, signatureData);

      const typeStr = uploadType;
      const uploaderStr = divisionName ? divisionName.replace(/[^a-zA-Z0-9]/g, '-') : 'Unknown';
      const timestamp = new Date().getTime();
      const filename = `${typeStr}__${uploaderStr}__${timestamp}__Briefing-Form.docx`;

      const file = new File([docxBlob], filename, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

      const uploadForm = new FormData();
      uploadForm.append('file', file);

      const uploadResponse = await fetch(`/api/reports/${reportData.id}/evidence`, {
        method: 'POST',
        body: uploadForm,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload briefing form');
      }

      const { url } = await uploadResponse.json();
      setUploadedUrl(url);

      const currentEvidence = [
        ...(reportData.evidence_urls || []),
        ...(reportData.evidence_url ? [reportData.evidence_url] : []),
        ...(reportData.video_urls || []),
        ...(reportData.video_url ? [reportData.video_url] : [])
      ];
      const newEvidence = [...new Set([...currentEvidence, url])].filter(Boolean);

      const patchRes = await fetch(`/api/reports/${reportData.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evidence_urls: newEvidence }),
      });

      if (!patchRes.ok) throw new Error('Failed to save evidence URL to report');

      const patchData = await patchRes.json();

      setIsSuccess(true);
      onSuccess(patchData.data || patchData);
    } catch (error) {
      console.error('Error saving and uploading DOCX:', error);
      alert('An error occurred while saving the briefing form. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <AnimatePresence mode="wait">
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
        />

        <motion.div
          key={isSuccess ? 'success' : 'editor'}
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        >
          {isSuccess ? (
            <div className="flex flex-col items-center justify-center p-12 space-y-6 text-center">
              <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-2">
                <CheckCircle2 size={48} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Successfully Saved!</h2>
                <p className="text-gray-500 max-w-sm">
                  Briefing form has been uploaded to the report and saved as evidence.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm pt-4">
                <Button
                  onClick={handleDownload}
                  variant="outline"
                  className="flex-1 py-6 border-slate-200 hover:bg-slate-50 font-semibold"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Download DOCX
                </Button>
                <Button
                  onClick={onClose}
                  className="flex-1 py-6 bg-slate-900 text-white hover:bg-slate-800 font-semibold"
                >
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <>
              {}
              <div className="flex items-center justify-between p-5 sm:px-8 sm:py-6 border-b border-gray-100 shrink-0 bg-gray-50/80 backdrop-blur-md">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-gray-900">
                    Fill Briefing Form
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Complete briefing data for evidence of {uploadType === 'CORRECTIVE' ? 'Corrective' : 'Preventive'} Action.
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 sm:p-8 custom-scrollbar">
                <div className="space-y-8 max-w-2xl mx-auto">
                  {}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <PrismInput
                      label="Briefing Date"
                      name="tanggal"
                      type="date"
                      value={formData.tanggal}
                      onChange={handleInputChange}
                      placeholder="YYYY-MM-DD"
                      required
                    />
                    <PrismInput
                      label="Briefing Time"
                      name="waktu"
                      type="time"
                      value={formData.waktu}
                      onChange={handleInputChange}
                      placeholder="HH:MM"
                      required
                    />
                    <PrismInput
                      label="Place / Location"
                      name="tempat"
                      value={formData.tempat}
                      onChange={handleInputChange}
                      placeholder="Example: Meeting Room T3"
                      required
                    />
                    <PrismInput
                      label="Speaker Name (Briefer)"
                      name="pembicara"
                      value={formData.pembicara}
                      onChange={handleInputChange}
                      placeholder="Full Name"
                      required
                    />
                    <div className="md:col-span-2">
                      <PrismInput
                        label="Briefing Topic"
                        name="topik"
                        value={formData.topik}
                        onChange={handleInputChange}
                        placeholder="Agenda / Main briefing topic"
                        required
                      />
                    </div>
                  </div>

                  {}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Minutes / Briefing Notes</label>
                    <textarea
                      name="notulensi"
                      value={formData.notulensi}
                      onChange={handleInputChange}
                      placeholder="Write down briefing points..."
                      className="w-full min-h-[150px] p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)] outline-none resize-y transition-all"
                    />
                  </div>

                  {}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold text-gray-700">Speaker Signature</label>
                      {signatureData && <span className="text-xs text-emerald-600 font-medium flex items-center gap-1"><CheckCircle2 size={14} /> Saved</span>}
                    </div>
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                      <SignaturePad onEnd={setSignatureData} />
                    </div>
                  </div>
                </div>
              </div>

              {}
              <div className="p-4 sm:p-5 sm:px-8 border-t border-gray-100 bg-gray-50/80 backdrop-blur-md shrink-0">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <Button
                    variant="outline"
                    onClick={onClose}
                    className="text-gray-600 hover:text-gray-900 font-semibold order-2 sm:order-1"
                  >
                    Cancel
                  </Button>

                  <div className="flex gap-2 sm:gap-3 order-1 sm:order-2">
                    <Button
                      variant="outline"
                      onClick={handleDownload}
                      className="flex-1 sm:flex-none text-[var(--brand-primary)] border-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/5 font-semibold text-xs sm:text-sm"
                    >
                      <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5" />
                      Download
                    </Button>

                    <Button
                      onClick={handleSaveAndUpload}
                      disabled={isSaving || !signatureData}
                      className="flex-1 sm:flex-none bg-[var(--brand-primary)] text-white hover:brightness-110 font-bold px-4 sm:px-6 shadow-sm flex items-center gap-2 text-xs sm:text-sm"
                    >
                      {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      {isSaving ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body,
  );
}
