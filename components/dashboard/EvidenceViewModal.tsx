'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { X, Image as ImageIcon, ChevronLeft, ChevronRight, ExternalLink, FileText } from 'lucide-react';
import { useState } from 'react';
import NextImage from 'next/image';
import { Button } from '@/components/ui/button';
import { getEvidencePreviewUrl } from '@/lib/evidence-url';

interface EvidenceViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  evidenceUrls: string[];
}

export function EvidenceViewModal({ isOpen, onClose, evidenceUrls }: EvidenceViewModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const validUrls = evidenceUrls.filter((url) => url && typeof url === 'string');
  const [failedPreviews, setFailedPreviews] = useState<Record<string, boolean>>({});

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  const hasMultiple = validUrls.length > 1;
  const safeCurrentIndex = Math.min(currentIndex, Math.max(validUrls.length - 1, 0));
  const currentUrl = validUrls[safeCurrentIndex];
  const previewUrl = currentUrl ? getEvidencePreviewUrl(currentUrl) : '';
  const previewFailed = Boolean(currentUrl && failedPreviews[currentUrl]);

  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % validUrls.length);
  };

  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + validUrls.length) % validUrls.length);
  };

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-full sm:max-w-4xl w-full overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh]"
        >
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-50 flex items-center justify-center">
                <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
              </div>
              <h2 className="text-base sm:text-xl font-bold text-gray-900">Evidence Files</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 bg-gray-50 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-gray-50 relative min-h-[280px] sm:min-h-[400px]">
            {validUrls.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <ImageIcon className="w-12 h-12 sm:w-16 sm:h-16 mb-4 text-gray-300" />
                <p className="text-sm">No evidence photos available.</p>
              </div>
            ) : (
              <div className="relative w-full h-full flex flex-col items-center justify-center group">
                {}
                <div className="relative w-full h-[50vh] sm:h-[60vh] flex items-center justify-center bg-black/5 rounded-xl sm:rounded-2xl overflow-hidden">
                  {previewFailed || !previewUrl ? (
                    <div className="flex flex-col items-center gap-4 px-6 text-center text-gray-600">
                      <FileText className="h-14 w-14 text-gray-300" />
                      <p className="text-sm font-medium">Preview is not available for this file.</p>
                      {previewUrl && (
                        <a
                          href={previewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Open file
                        </a>
                      )}
                    </div>
                  ) : (
                    <NextImage
                      src={previewUrl}
                      alt={`Evidence ${safeCurrentIndex + 1}`}
                      fill
                      sizes="(max-width: 640px) 100vw, 80vw"
                      className="object-contain"
                      onError={() => setFailedPreviews((prev) => ({ ...prev, [currentUrl]: true }))}
                    />
                  )}
                </div>

                {}
                {hasMultiple && (
                  <>
                    <button
                      onClick={prevImage}
                      className="absolute left-1 sm:left-4 top-1/2 -translate-y-1/2 p-2 sm:p-3 bg-white/80 hover:bg-white backdrop-blur-md rounded-full shadow-lg text-gray-800 transition-all sm:opacity-0 group-hover:sm:opacity-100 disabled:opacity-50"
                    >
                      <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>
                    <button
                      onClick={nextImage}
                      className="absolute right-1 sm:right-4 top-1/2 -translate-y-1/2 p-2 sm:p-3 bg-white/80 hover:bg-white backdrop-blur-md rounded-full shadow-lg text-gray-800 transition-all sm:opacity-0 group-hover:sm:opacity-100 disabled:opacity-50"
                    >
                      <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>

                    {}
                    <div className="absolute bottom-2 sm:bottom-4 left-1/2 -translate-x-1/2 flex items-center space-x-1.5 sm:space-x-2 bg-black/20 backdrop-blur-md px-3 sm:px-4 py-1.5 sm:py-2 rounded-full">
                      {validUrls.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => setCurrentIndex(idx)}
                          className={`w-2 h-2 rounded-full transition-all min-w-[20px] min-h-[20px] flex items-center justify-center ${
                            idx === safeCurrentIndex ? 'bg-white w-4' : 'bg-white/50 hover:bg-white/80'
                          }`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="p-3 sm:p-4 bg-white border-t border-gray-100 flex justify-end">
            <Button
              variant="outline"
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body,
  );
}
