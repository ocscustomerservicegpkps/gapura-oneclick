
'use client';

import { useEffect, useRef, useState, useMemo, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { WizardStep } from '@/components/ui/WizardStep';
import GuestNav from '@/components/GuestNav';
import { SEVERITY_CONFIG } from '@/lib/constants/report-status';
import { AIRLINES } from '@/lib/constants/airlines';
import { GSE_TYPES, GSE_EQUIPMENT } from '@/lib/constants/incident-areas';
import {
  PUBLIC_SEVERITY_OPTIONS,
  AREA_OPTIONS,
  AREA_CATEGORIES,
  ROOT_CAUSE_CLASSIFICATIONS,
  REPORT_CATEGORY_OPTIONS,
  getAirlineType,
  getHubForStation,
  getWeekInMonth,
  type QuickAccessLink,
  type QRLink,
  type QuickAccessCategory,
  type FormData,
  type CreatedReport,
  type DocEdits,
  type EvidenceUploadStatus,
  type DuplicateCandidate,
} from './wizard-shared';
import { AlertTriangle, Calendar, CheckCircle, MessageSquare, X, ChevronRight, ChevronLeft, ArrowRight, Upload, Loader2, QrCode, ClipboardCheck, ExternalLink, BookOpen, Activity, Bot, PenLine, Eye, EyeOff, Shirt } from 'lucide-react';
import { LazyMotion, domAnimation, m, AnimatePresence } from 'framer-motion';
import { GlassCard } from '@/components/ui/GlassCard';
import { NoiseTexture } from '@/components/ui/NoiseTexture';
import { PrismButton } from '@/components/ui/PrismButton';
import { queueOfflineReport } from '@/lib/pwa/offline-queue';
import { useExternalLinks } from '@/lib/hooks/useExternalLinks';
import { getLinkUrl } from '@/lib/external-links';
import { SignaturePad } from '@/components/public-report/SignaturePad';
import PublicJoumpaForm from '@/components/public-report/PublicJoumpaForm';
import PublicIrregularityForm from '@/components/public-report/PublicIrregularityForm';
import { generatePDF, generateWord } from '@/lib/utils/document-generator';
import { finalizeReportDocuments } from '@/lib/report-documents-client';
import { toLocalDateInput } from './apple-form-shell';
import {
  validatePublicReportFlightStation,
  type PublicReportValidationErrors,
} from '@/lib/validations/public-report';

const QRCodeWithLogo = dynamic(
  () => import('@/components/ui/QRCodeWithLogo').then((mod) => mod.QRCodeWithLogo),
  {
    ssr: false,
    loading: () => (
      <div className="h-[256px] w-[256px] animate-pulse rounded-[40px] bg-[oklch(0.96_0.01_200)]" />
    ),
  }
);

export function PublicReportWizard() {
  const router = useRouter();

  
  useEffect(() => {
    const ssrGrid = document.getElementById('bento-grid-ssr');
    if (ssrGrid) ssrGrid.style.display = 'none';
    return () => { if (ssrGrid) ssrGrid.style.display = ''; };
  }, []);

  const initialFormData: FormData = {
    incident_date: toLocalDateInput(new Date()),
    airline: '',
    flight_number: '',
    station_id: '',
    route: '',
    main_category: '',
    delay_code: '',
    area: '',
    area_category: '',
    area_category_other: '',
    description: '',
    root_cause: '',
    root_cause_classification: '',
    root_cause_classification_other: '',
    action_taken: '',
    preventive_action: '',
    airline_other: '',
    gse_type: '',
    gse_equipment: '',
    gse_equipment_other: '',
    severity: 'MEDIUM',
    reporter_name: '',
    reporter_email: '',
    evidence_urls: [],
  };
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [stations, setStations] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [evidenceUploadStatuses, setEvidenceUploadStatuses] = useState<Record<string, EvidenceUploadStatus>>({});
  const [evidenceSubmissionId, setEvidenceSubmissionId] = useState(() => crypto.randomUUID());
  const [evidenceFileIds, setEvidenceFileIds] = useState<string[]>([]);
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateCandidate[]>([]);
  const [duplicateCheckLoading, setDuplicateCheckLoading] = useState(false);
  const [duplicateCheckDone, setDuplicateCheckDone] = useState(false);
  const [uploadToken, setUploadToken] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // ponytail: synchronous re-entry guard — disabled={loading} flips a tick too late
  // to stop a same-tick second submit from creating a duplicate report.
  const submittingRef = useRef(false);
  const [createdReport, setCreatedReport] = useState<CreatedReport | null>(null);
  const [submissionMode, setSubmissionMode] = useState<'submitted' | 'queued'>('submitted');
  const [pendingProtectedCategory, setPendingProtectedCategory] = useState<QuickAccessCategory | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [loginPromptUrl, setLoginPromptUrl] = useState<string | null>(null);
  const [pendingLoginCategory, setPendingLoginCategory] = useState<QuickAccessCategory | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [showJoumpaForm, setShowJoumpaForm] = useState(false);
  const [showIrregularityForm, setShowIrregularityForm] = useState(false);
  const [quickAccessCheckingId, setQuickAccessCheckingId] = useState<string | null>(null);
  const [quickAccessSessionId, setQuickAccessSessionId] = useState<string | null>(null);
  const externalLinks = useExternalLinks();
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const finalizingDocumentsRef = useRef(false);
  const [exportLoading, setExportLoading] = useState<'pdf' | 'docx' | 'finish' | null>(null);
  const [documentFinalizationToken, setDocumentFinalizationToken] = useState<string | null>(null);
  const [docEdits, setDocEdits] = useState<DocEdits>({
    reference_no: '',
    to: '',
    from: '',
    cc: '',
    subject: '',
    attachment: '',
    incident_date: '',
    branch: '',
    flight_number: '',
    aircraft_reg: '',
    route: '',
    std_atd: '',
    pax: '',
    bge: '',
    gate_stand: '',
    delay: '',
    officers: [],
    chronology: [],
    root_cause: '',
    action_taken: '',
    preventive_action: '',
    reporter_name: '',
    reporter_title: 'Controller Operation Airside',
  });

  const addChronologyEntry = () => {
    setDocEdits(prev => ({
      ...prev,
      chronology: [...prev.chronology, { 
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }), 
        description: '' 
      }]
    }));
  };

  const removeChronologyEntry = (index: number) => {
    setDocEdits(prev => ({
      ...prev,
      chronology: prev.chronology.filter((_, i) => i !== index)
    }));
  };

  const addOfficerEntry = () => {
    setDocEdits(prev => ({
      ...prev,
      officers: [...prev.officers, { name: '', company: '', function: '' }]
    }));
  };

  const removeOfficerEntry = (index: number) => {
    setDocEdits(prev => ({
      ...prev,
      officers: prev.officers.filter((_, i) => i !== index)
    }));
  };

  const CATEGORIES = useMemo<QuickAccessCategory[]>(() => [
    {
      id: 'AIChatbot',
      title: "I'm in Charge Virtual Assistant",
      description: 'Ask the AI assistant for operational help.',
      icon: Bot,
      color: 'oklch(0.60 0.18 260)',
      span: 'col-span-1 row-span-1 sm:col-span-2 sm:row-span-2 lg:col-span-2 lg:row-span-2',
      redirectUrl: '/virtual-assistant',
      requiresLogin: true,
    },
    {
      id: 'Irregularity',
      title: 'Ground Handling Irregularity Report',
      description: 'Report ground handling operational issues, damage, or irregularities.',
      icon: AlertTriangle,
      color: 'oklch(0.55 0.22 30)',
      span: 'col-span-1 row-span-1 sm:col-span-2 sm:row-span-2 lg:col-span-2 lg:row-span-2'
    },
    {
      id: 'JOUMPA',
      title: 'Joumpa Irregularity Report',
      description: 'Report operational issues, damage, or irregularities related to JOUMPA service.',
      icon: AlertTriangle,
      color: 'oklch(0.50 0.15 190)',
      span: 'col-span-1 row-span-1 sm:col-span-2 sm:row-span-2 lg:col-span-2 lg:row-span-2',
    },
    {
      id: 'CustomerAirlineSurvey',
      title: 'Customer Airline Passenger Survey',
      description: 'Help us improve our service via passenger survey.',
      icon: QrCode,
      color: 'oklch(0.60 0.20 340)',
      span: 'col-span-1 sm:col-span-2 lg:col-span-2 row-span-1',
      qrLinks: [
        { label: 'Passenger Survey', url: getLinkUrl(externalLinks, 'survey-penumpang') }
      ]
    },
    {
      id: 'JoumpaSurvey',
      title: 'Joumpa Customer Survey',
      description: 'Help us improve JOUMPA service via customer survey.',
      icon: QrCode,
      color: 'oklch(0.52 0.17 300)',
      span: 'col-span-1 sm:col-span-2 lg:col-span-2 row-span-1',
      qrLinks: [
        { label: 'JOUMPA Customer Survey', url: getLinkUrl(externalLinks, 'customer-joumpa') }
      ]
    },
    {
      id: 'DOS',
      title: '[DOS] Direct Observation Form',
      description: 'Quick access to the Direct Observation Form submission.',
      icon: Eye,
      color: 'oklch(0.50 0.18 250)',
      span: 'col-span-1 sm:col-span-2 lg:col-span-2 row-span-1',
      loginProtected: true,
      qrLinks: [
        { label: 'Direct Observation Form', url: 'https://forms.gle/HScxeQyiSLVdyYWe6' }
      ]
    },
    {
      id: 'SLA',
      title: 'Form SLA Report',
      description: 'Quick access to SLA report submission.',
      icon: ClipboardCheck,
      color: 'oklch(0.45 0.18 240)',
      span: 'col-span-1 sm:col-span-2 lg:col-span-2 row-span-1',
      loginProtected: true,
      qrLinks: [
        { label: 'SLA Landside Submission', url: getLinkUrl(externalLinks, 'sla-landside') },
        { label: 'SLA Airside Submission', url: getLinkUrl(externalLinks, 'sla-airside') }
      ]
    },
    {
      id: 'HSSE',
      title: 'Form Inspeksi Health, Safety & Environment',
      description: 'HEALTH, SAFETY & ENVIRONMENT (HSE)',
      icon: AlertTriangle,
      color: 'oklch(0.62 0.22 28)',
      span: 'col-span-1 sm:col-span-2 lg:col-span-2 row-span-1',
      loginProtected: true,
      qrLinks: [
        { label: 'HSSE Report Form', url: getLinkUrl(externalLinks, 'hsse-report') }
      ]
    },
    {
      id: 'HSSEReport',
      title: 'HSSE Report',
      description: 'Quick QR access and redirect to the HSSE Report portal.',
      icon: AlertTriangle,
      color: 'oklch(0.58 0.2 35)',
      span: 'col-span-1 sm:col-span-2 lg:col-span-2 row-span-1',
      loginProtected: true,
      qrLinks: [
        { label: 'HSSE Report', url: 'https://linktr.ee/HSSE_GP#538968339' }
      ]
    },
    {
      id: 'SAM',
      title: 'Standard Appearance Manual (SAM)',
      description: 'Operational standard appearance guideline.',
      icon: Shirt,
      color: 'oklch(0.50 0.16 200)',
      span: 'col-span-1 sm:col-span-2 lg:col-span-2 row-span-1',
      loginProtected: true,
      qrLinks: [
        { label: 'Standard Appearance Manual (SAM)', url: 'https://gapura-my.sharepoint.com/:b:/g/personal/unitserviceskps_gapura_id/IQBewqRkUXZ5TK3Q6VYSi7WSAdM275R3brwefrVQDnxsC28?e=RZG93D' }
      ]
    },
    {
      id: 'WSN',
      title: 'Weekly Service Notice',
      description: 'Access the Weekly Service Notice in one link.',
      icon: Activity,
      color: 'oklch(0.55 0.18 180)',
      span: 'col-span-1 sm:col-span-2 lg:col-span-2 row-span-1',
      loginProtected: true,
      qrLinks: [
        { label: 'Weekly Service Notice', url: getLinkUrl(externalLinks, 'wsn-weekly') }
      ]
    },
    {
      id: 'Handbook',
      title: 'Handbook SLA',
      description: 'Operational service standards handbook.',
      icon: BookOpen,
      color: 'oklch(0.45 0.20 160)',
      span: 'col-span-1 sm:col-span-2 lg:col-span-2 row-span-1',
      loginProtected: true,
      links: [
        { label: 'Open Handbook SLA', sublabel: 'SIS Apps Dev', url: getLinkUrl(externalLinks, 'handbook-sla') }
      ]
    }
  ], [externalLinks]);

  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [delayChoice, setDelayChoice] = useState<'no' | 'other'>('no');

  const formValidationErrors = useMemo<PublicReportValidationErrors>(() => (
    validatePublicReportFlightStation({
      airline: formData.airline,
      flight_number: formData.flight_number,
      station_id: formData.station_id,
      route: formData.route,
    }, stations)
  ), [formData.airline, formData.flight_number, formData.station_id, formData.route, stations]);

  const selectedStation = useMemo(
    () => stations.find((station) => station.id === formData.station_id || station.code === formData.station_id),
    [formData.station_id, stations]
  );

  useEffect(() => {
    setDuplicateCandidates([]);
    setDuplicateCheckDone(false);
  }, [
    formData.incident_date,
    formData.station_id,
    formData.airline,
    formData.flight_number,
    formData.area,
    formData.area_category,
    formData.description,
  ]);

  useEffect(() => {
    if (formData.main_category !== 'Irregularity' || stations.length > 0) {
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;

    const fetchStations = async () => {
      try {
        const res = await fetch('/api/master-data?type=stations', { signal });
        const data = await res.json();
        if (Array.isArray(data)) setStations(data);
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        console.error('Failed to load stations', e);
      }
    };
    fetchStations();

    return () => controller.abort();
  }, [formData.main_category, stations.length]);

  

  const getUploadToken = async () => {
    if (uploadToken) return uploadToken;

    const res = await fetch('/api/uploads/evidence/token');
    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.token) {
      throw new Error(data?.error || 'Failed to get upload token');
    }

    setUploadToken(data.token);
    return data.token as string;
  };

  
  const compressImage = (file: File, opts: { maxWidth?: number; maxHeight?: number; quality?: number; mimeType?: string } = {}) => {
    const { maxWidth = 1600, maxHeight = 1600, quality = 0.8, mimeType = 'image/webp' } = opts;
    return new Promise<File>((resolve, reject) => {
      const img = document.createElement('img');
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          return reject(new Error('Canvas not supported'));
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(url);
          if (!blob) return reject(new Error('Compression failed'));
          const ext = mimeType.includes('webp') ? 'webp' : 'jpg';
          const compressed = new File([blob], file.name.replace(/\.[^.]+$/, `.${ext}`), { type: blob.type });
          resolve(compressed);
        }, mimeType, quality);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Image load error'));
      };
      img.src = url;
    });
  };

  const evidenceFileKey = (file: File) => `${file.name}:${file.size}:${file.lastModified}`;

  /**
   * Menangani file yang dipilih untuk diunggah
   */
  const uploadingFilesRef = useRef(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const handleFilesSelected = async () => {
    if (!selectedFiles.length) return;
    if (uploadingFilesRef.current) return;
    if (!navigator.onLine) {
      setError('You are offline. Files will be queued when the report is submitted.');
      return;
    }
    uploadingFilesRef.current = true;
    setUploadingFiles(true);
    try {
      const { uploadedUrls, failedKeys, successKeys } = await uploadEvidenceFiles(selectedFiles);
      setFormData((prev) => ({ ...prev, evidence_urls: [...prev.evidence_urls, ...uploadedUrls] }));
      setSelectedFiles((prev) => prev.filter((file) => !successKeys.includes(evidenceFileKey(file))));
      setError(failedKeys.length > 0 ? 'Some evidence failed to upload. Please retry the failed files.' : '');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload evidence';
      setError(message);
    } finally {
      uploadingFilesRef.current = false;
      setUploadingFiles(false);
    }
  };

  /**
   * Mengunggah file bukti ke server
   * @param files - Array file yang akan diunggah
   * @returns Promise<string[]> Array URL file yang berhasil diunggah
   */
  const uploadEvidenceFiles = async (files: File[]) => {
    const uploadedUrls: string[] = [];
    const uploadedFileIds: string[] = [];
    const failedKeys: string[] = [];
    const successKeys: string[] = [];
    const token = await getUploadToken();
    for (const file of files) {
      const key = evidenceFileKey(file);
      if (!file.type.startsWith('image/')) {
        failedKeys.push(key);
        setEvidenceUploadStatuses((prev) => ({ ...prev, [key]: { status: 'failed', message: 'File harus berupa gambar.' } }));
        continue;
      }

      setEvidenceUploadStatuses((prev) => ({ ...prev, [key]: { status: 'uploading' } }));
      try {
        const compressed = await compressImage(file);
        const fd = new FormData();
        fd.append('file', compressed);
        fd.append('evidence_submission_id', evidenceSubmissionId);
        fd.append('reporter_name', formData.reporter_name.trim());
        fd.append('reporter_email', formData.reporter_email.trim());
        fd.append('station_id', formData.station_id);
        fd.append('station_code', selectedStation?.code || formData.station_id);
        if (quickAccessSessionId) fd.append('quick_access_session_id', quickAccessSessionId);
        const res = await fetch('/api/uploads/evidence/public', {
          method: 'POST',
          headers: { 'X-Upload-Token': token },
          body: fd,
        });
        if (!res.ok) {
          if (res.status === 403) {
            setUploadToken(null);
          }
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || 'Failed to upload evidence');
        }
        const data = await res.json();
        uploadedUrls.push(data.url);
        if (data.evidence_file_id || data.evidenceFileId) {
          uploadedFileIds.push(data.evidence_file_id || data.evidenceFileId);
        }
        successKeys.push(key);
        setEvidenceUploadStatuses((prev) => ({ ...prev, [key]: { status: 'uploaded', url: data.url } }));
      } catch (err) {
        failedKeys.push(key);
        setEvidenceUploadStatuses((prev) => ({
          ...prev,
          [key]: { status: 'failed', message: err instanceof Error ? err.message : 'Failed to upload evidence' },
        }));
      }
    }
    if (uploadedFileIds.length > 0) {
      setEvidenceFileIds((prev) => [...new Set([...prev, ...uploadedFileIds])]);
    }
    return { uploadedUrls, uploadedFileIds, failedKeys, successKeys };
  };

  /**
   * Menghapus bukti pada indeks tertentu
   * @param index - Indeks bukti yang akan dihapus
   */
  const removeEvidenceAt = (index: number) => {
    setFormData((prev) => ({ ...prev, evidence_urls: prev.evidence_urls.filter((_, i) => i !== index) }));
    setEvidenceFileIds((prev) => prev.filter((_, i) => i !== index));
  };

  const removeSelectedFileAt = (index: number) => {
    setSelectedFiles((prev) => {
      const target = prev[index];
      if (target) {
        const key = evidenceFileKey(target);
        setEvidenceUploadStatuses((current) => {
          const next = { ...current };
          delete next[key];
          return next;
        });
      }
      return prev.filter((_, i) => i !== index);
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const checkPotentialDuplicates = async () => {
    if (!navigator.onLine) {
      setDuplicateCandidates([]);
      setDuplicateCheckDone(false);
      return;
    }

    setDuplicateCheckLoading(true);
    try {
      const res = await fetch('/api/reports/duplicates/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incident_date: formData.incident_date,
          station_id: formData.station_id,
          airline: formData.airline,
          flight_number: formData.flight_number,
          area: formData.area,
          area_category: formData.area_category,
          category: formData.main_category,
          description: formData.description,
        }),
      });
      const data = await res.json().catch(() => null);
      setDuplicateCandidates(Array.isArray(data?.candidates) ? data.candidates : []);
      setDuplicateCheckDone(true);
    } catch {
      setDuplicateCandidates([]);
      setDuplicateCheckDone(false);
    } finally {
      setDuplicateCheckLoading(false);
    }
  };

  /**
   * Berpindah ke langkah berikutnya
   */
  const nextStep = async () => {
    setError('');
    if (step === 1 && Object.keys(formValidationErrors).length > 0) {
      setError(Object.values(formValidationErrors)[0] || 'Mohon periksa data penerbangan dan station.');
      return;
    }
    if (step === 5) {
      await checkPotentialDuplicates();
    }
    setStep((prev) => Math.min(prev + 1, 6));
  };

  /**
   * Berpindah ke langkah sebelumnya
   */
  const prevStep = () => setStep((prev) => Math.max(prev - 1, 1));

  const selectedCategory = CATEGORIES.find(c => c.id === formData.main_category);
  const showWizardFooter = selectedCategory?.id === 'Irregularity';

  /**
   * Type guard untuk mengecek apakah kategori memiliki QR links
   * @param c - Kategori akses cepat
   * @returns True jika memiliki qrLinks
   */
  const hasQrLinks = (c: QuickAccessCategory): c is QuickAccessCategory & { qrLinks: QRLink[] } => {
    return Array.isArray(c.qrLinks);
  };

  /**
   * Type guard untuk mengecek apakah kategori memiliki links
   * @param c - Kategori akses cepat
   * @returns True jika memiliki links
   */
  const hasLinks = (c: QuickAccessCategory): c is QuickAccessCategory & { links: QuickAccessLink[] } => {
    return Array.isArray(c.links);
  };

  /**
   * Menutup panel akses cepat
   */
  const closeQuickAccess = () => {
    setFormData(prev => ({ ...prev, main_category: '' }));
    setStep(1);
  };

  /**
   * Menutup prompt password
   */
  const closePasswordPrompt = () => {
    setPendingProtectedCategory(null);
    setPasswordInput('');
    setShowPasswordInput(false);
    setPasswordError('');
  };

  const closeLoginPrompt = () => {
    if (loginLoading) return;
    setLoginPromptUrl(null);
    setPendingLoginCategory(null);
    setLoginPassword('');
    setShowLoginPassword(false);
    setLoginError('');
  };

  const openLoginProtectedCategory = async (category: QuickAccessCategory) => {
    setQuickAccessCheckingId(category.id);
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      if (res.ok) {
        setFormData(prev => ({ ...prev, main_category: category.id }));
        return;
      }
    } catch { /* fall through */ } finally {
      setQuickAccessCheckingId(null);
    }
    setPendingLoginCategory(category);
    setLoginEmail('');
    setLoginPassword('');
    setLoginError('');
    setShowLoginPassword(false);
  };

  const openLoginProtectedRedirect = async (category: QuickAccessCategory) => {
    if (!category.redirectUrl) return;

    setQuickAccessCheckingId(category.id);
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      if (res.ok) {
        router.push(category.redirectUrl);
        return;
      }
    } catch {
      // Fall through to the inline login prompt.
    } finally {
      setQuickAccessCheckingId(null);
    }

    setLoginPromptUrl(category.redirectUrl);
    setLoginError('');
    setLoginPassword('');
    setShowLoginPassword(false);
  };

  const submitLoginPrompt = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if ((!loginPromptUrl && !pendingLoginCategory) || loginLoading) return;

    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json().catch(() => null) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(data?.error || 'Login gagal');
      }

      if (pendingLoginCategory) {
        const cat = pendingLoginCategory;
        setPendingLoginCategory(null);
        setLoginEmail('');
        setLoginPassword('');
        setShowLoginPassword(false);
        setLoginError('');
        setFormData(prev => ({ ...prev, main_category: cat.id }));
      } else {
        window.location.assign(loginPromptUrl!);
      }
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Login gagal');
    } finally {
      setLoginLoading(false);
    }
  };

  /**
   * Membuka redirect kategori yang dilindungi password
   * @param category - Kategori akses cepat
   */
  const openProtectedRedirect = (category: QuickAccessCategory) => {
    if (!category.redirectUrl) {
      return;
    }

    closePasswordPrompt();

    if (category.externalRedirect ?? /^https?:\/\//i.test(category.redirectUrl)) {
      window.open(category.redirectUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    router.push(category.redirectUrl);
  };

  /**
   * Membuka kategori akses cepat
   * @param category - Kategori akses cepat
   */
  const openCategory = (category: QuickAccessCategory) => {
    if (category.id === 'JOUMPA') {
      setQuickAccessSessionId(crypto.randomUUID());
      setShowJoumpaForm(true);
      return;
    }
    if (category.id === 'Irregularity') {
      setQuickAccessSessionId(crypto.randomUUID());
      setShowIrregularityForm(true);
      return;
    }
    if (category.loginProtected) {
      void openLoginProtectedCategory(category);
      return;
    }

    if (category.passwordProtected) {
      setPendingProtectedCategory(category);
      setPasswordInput('');
      setShowPasswordInput(false);
      setPasswordError('');
      return;
    }

    if (category.comingSoon) {
      setShowComingSoon(true);
      return;
    }

    if (category.requiresLogin) {
      void openLoginProtectedRedirect(category);
      return;
    }

    if (category.redirectUrl) {
      if (category.externalRedirect ?? /^https?:\/\//i.test(category.redirectUrl)) {
        window.open(category.redirectUrl, '_blank', 'noopener,noreferrer');
      } else {
        router.push(category.redirectUrl);
      }
      return;
    }

    setQuickAccessSessionId(crypto.randomUUID());
    setFormData(prev => ({ ...prev, main_category: category.id }));
    setStep(1);
  };

  /**
   * Mengirim password untuk verifikasi akses
   */
  const submitPassword = async () => {
    if (!pendingProtectedCategory) return;
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-quick-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.valid) {
          if (pendingProtectedCategory.redirectUrl) {
            openProtectedRedirect(pendingProtectedCategory);
            return;
          }
          setQuickAccessSessionId(data.quick_access_session_id || crypto.randomUUID());
          setFormData(prev => ({ ...prev, main_category: pendingProtectedCategory.id }));
          setPendingProtectedCategory(null);
          setPasswordInput('');
          setShowPasswordInput(false);
          setPasswordError('');
          setStep(1);
          return;
        }
      }
    } catch {
      // Fall through to error
    } finally {
      setLoading(false);
    }
    setPasswordError('Kata sandi salah.');
  };

  /**
   * Validasi langkah formulir saat ini
   * @returns True jika langkah valid
   */
  const isStepValid = (): boolean => {
    switch (step) {
      case 1:
        return !!(
          formData.incident_date &&
          formData.airline &&
          formData.flight_number &&
          formData.station_id &&
          formData.route &&
          formData.main_category &&
          Object.keys(formValidationErrors).length === 0
        );
      case 2:
        return !!formData.area;
      case 3:
        return formData.area === 'GSE' ? !!formData.gse_equipment : !!formData.area_category;
      case 4:
        return !!(
          formData.description &&
          formData.root_cause &&
          formData.action_taken &&
          (formData.area !== 'GSE' || formData.area_category) &&
          (!ROOT_CAUSE_CLASSIFICATIONS[formData.area] || formData.root_cause_classification)
        );
      case 5:
        return !!(
          formData.reporter_name &&
          formData.reporter_email &&
          (formData.evidence_urls.length > 0 || selectedFiles.length > 0)
        );
      case 6:
        return true;
      default:
        return false;
    }
  };

  /**
   * Menangani submit formulir
   * @param e - Event form atau mouse
   */
  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    if (submittingRef.current) return;
    if (createdReport) {
      // A report was already successfully created in this session. Never
      // re-submit (which would create a duplicate) — just make sure the
      // user is back on the success step and reuse the existing result.
      setStep(7);
      return;
    }
    submittingRef.current = true;
    setLoading(true);
    setError('');
    try {
      const reporterName = formData.reporter_name.trim();
      const reporterEmail = formData.reporter_email.trim();

      if (!reporterName) {
        throw new Error('Reporter name wajib diisi');
      }

      if (!reporterEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reporterEmail)) {
        throw new Error('Invalid contact email');
      }

      const stationCode = selectedStation?.code || formData.station_id || '';
      const eventDate = new Date(formData.incident_date);
      let evidenceUrls = [...formData.evidence_urls];
      let currentEvidenceFileIds = [...evidenceFileIds];

      if (navigator.onLine && selectedFiles.length > 0) {
        const { uploadedUrls, uploadedFileIds, failedKeys, successKeys } = await uploadEvidenceFiles(selectedFiles);
        evidenceUrls = [...evidenceUrls, ...uploadedUrls];
        currentEvidenceFileIds = [...new Set([...currentEvidenceFileIds, ...uploadedFileIds])];
        setFormData((prev) => ({ ...prev, evidence_urls: [...prev.evidence_urls, ...uploadedUrls] }));
        setSelectedFiles((prev) => prev.filter((file) => !successKeys.includes(evidenceFileKey(file))));
        if (failedKeys.length > 0) {
          throw new Error('Some evidence failed to upload. Retry the failed files before the final submission.');
        }
      }

      const airlineValue = formData.airline === 'Other'
        ? (formData.airline_other.trim() || 'Other')
        : formData.airline;
      const areaCategoryValue = formData.area_category === 'Other'
        ? (formData.area_category_other.trim() || 'Other')
        : formData.area_category;
      const gseEquipmentValue = formData.gse_equipment === 'Other'
        ? (formData.gse_equipment_other.trim() || 'Other')
        : formData.gse_equipment;
      const rootCauseClassificationValue = formData.root_cause_classification === 'Other'
        ? (formData.root_cause_classification_other.trim() || 'Other')
        : formData.root_cause_classification;
      const payload = {
        ...formData,
        airline: airlineValue,
        area_category: areaCategoryValue,
        gse_equipment: gseEquipmentValue,
        case_classification: rootCauseClassificationValue || undefined,
        reporter_name: reporterName,
        reporter_email: reporterEmail,
        evidence_urls: evidenceUrls,
        evidence_url: evidenceUrls[0],
        evidence_file_ids: currentEvidenceFileIds,
        evidence_submission_id: evidenceSubmissionId,
        quick_access_session_id: quickAccessSessionId,
        preventive_action: formData.preventive_action,
        gse_available_requirement: formData.area === 'GSE' ? formData.gse_type : undefined,
        gse_motorized: formData.gse_type === 'GSE MOTORIZED' ? gseEquipmentValue : undefined,
        gse_non_motorized: formData.gse_type === 'GSE NON - MOTORIZED' ? gseEquipmentValue : undefined,
        category_case_gse: formData.area === 'GSE' ? areaCategoryValue : undefined,
        title: `${airlineValue} ${formData.flight_number} - ${formData.main_category}`,
        station_id: formData.station_id,
        category: formData.main_category,
        station_code: stationCode,
        hub: getHubForStation(stationCode),
        jenis_maskapai: getAirlineType(formData.airline),
        report: formData.description,
        reporting_branch: stationCode,
        week_in_month: getWeekInMonth(eventDate),
        form_submitted_at: new Date().toISOString(),
        form_completed_at: new Date().toISOString(),
        area: formData.area,
        incident_type_id: areaCategoryValue,
        delay_code: formData.delay_code,
        terminal_area_category: formData.area === 'TERMINAL' ? areaCategoryValue : undefined,
        apron_area_category: formData.area === 'APRON' ? areaCategoryValue : undefined,
        general_category: formData.area === 'GENERAL' ? areaCategoryValue : undefined,
        category_case_cargo: formData.area === 'CARGO' ? areaCategoryValue : undefined,
      };

      if (!navigator.onLine) {
        const queuedItem = await queueOfflineReport({
          kind: 'public-report',
          endpoint: '/api/reports/public',
          uploadEndpoint: '/api/uploads/evidence/public',
          reportPayload: payload,
          attachments: selectedFiles,
        });

        setSubmissionMode('queued');
        setCreatedReport({
          ...payload,
          id: `QUEUE-${queuedItem.id.slice(0, 8).toUpperCase()}`,
          offline_queue_id: queuedItem.id,
        });
        setSuccess(true);
        return;
      }

      const res = await fetch('/api/reports/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        await res.text();
        throw new Error('Invalid server response. Please try again.');
      }
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to submit report');
      }
      setDocumentFinalizationToken(
        typeof data?.document_finalization_token === 'string'
          ? data.document_finalization_token
          : null,
      );

      const month = new Date(formData.incident_date).toLocaleDateString('id-ID', { month: 'short' }).toUpperCase();
      const year = new Date(formData.incident_date).getFullYear();

      setDocEdits({
        reference_no: `CABANG ${stationCode}/LK/       /       / ${month}/${year}`,
        to: `SQC ${formData.airline} on duty`,
        from: 'GAPURA OPERATION STAFF',
        cc: '',
        subject: `${formData.airline} ${formData.flight_number} - ${formData.area} (${formData.area_category})`,
        attachment: selectedFiles.length > 0 ? `${selectedFiles.length} Files` : '',
        incident_date: formData.incident_date,
        branch: stationCode,
        flight_number: formData.flight_number,
        aircraft_reg: '-',
        route: formData.route,
        std_atd: '',
        pax: '',
        bge: '',
        gate_stand: '-',
        delay: formData.delay_code || '-',
        officers: [
          { name: formData.reporter_name, company: 'Gapura Angkasa', function: 'Reporter' }
        ],
        chronology: [
          { 
            time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }), 
            description: formData.description 
          }
        ],
        root_cause: formData.root_cause,
        action_taken: formData.action_taken,
        preventive_action: formData.preventive_action,
        reporter_name: formData.reporter_name,
        reporter_title: 'Controller Operation Airside',
      });
      setCreatedReport({
        ...formData,
        ...data.data,
        id: data.data?.id || 'DRAFT',
      });
      setStep(7);
      // setSuccess(true); // Success now handled by step 7 and final export
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan';
      setError(message);
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  /**
   * Menangani ekspor laporan ke format PDF
   */
  const handleExportPDF = async () => {
    if (!createdReport) return;
    setExportLoading('pdf');
    try {
      const reportToExport = {
        ...createdReport,
        ...docEdits,
      };
      
      await generatePDF(reportToExport, signatureDataUrl);
    } catch (err) {
      console.error('PDF Export failed', err);
      setError('Failed to create PDF. Please try again.');
    } finally {
      setExportLoading(null);
    }
  };

  /**
   * Menangani ekspor laporan ke format Word (.docx)
   */
  const handleExportWord = async () => {
    if (!createdReport) return;
    setExportLoading('docx');
    try {
      const reportToExport = {
        ...createdReport,
        ...docEdits,
      };

      await generateWord(reportToExport, signatureDataUrl);
    } catch (err) {
      console.error('Word Export failed', err);
      setError('Failed to create Word document. Please try again.');
    } finally {
      setExportLoading(null);
    }
  };

  const handleFinishDocuments = async () => {
    if (finalizingDocumentsRef.current || !createdReport?.id) return;
    finalizingDocumentsRef.current = true;
    setExportLoading('finish');
    setError('');
    try {
      await finalizeReportDocuments({
        reportId: String(createdReport.id),
        reportType: 'IRREGULARITY',
        editedSnapshot: structuredClone(docEdits),
        signatureDataUrl,
        finalizationToken: documentFinalizationToken,
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save final report documents.');
    } finally {
      finalizingDocumentsRef.current = false;
      setExportLoading(null);
    }
  };

  /**
   * Menyalin teks ke clipboard
   * @param text - Teks yang akan disalin
   * @param key - Kunci identifikasi untuk status copied
   */
  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1200);
    } catch {}
  };

  const resetToQuickAccess = () => {
    setSuccess(false);
    setError('');
    setStep(1);
    setSelectedFiles([]);
    setEvidenceUploadStatuses({});
    setEvidenceFileIds([]);
    setEvidenceSubmissionId(crypto.randomUUID());
    setQuickAccessSessionId(null);
    setDuplicateCandidates([]);
    setDuplicateCheckDone(false);
    setUploadToken(null);
    setCreatedReport(null);
    setDocumentFinalizationToken(null);
    setSubmissionMode('submitted');
    setFormData(initialFormData);
    setDelayChoice('no');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (success) {
    return (
      <LazyMotion features={domAnimation}>
        <div className="min-h-screen relative overflow-hidden bg-[#0A0A0A] selection:bg-emerald-500/30">
          <NoiseTexture opacity={0.03} />
          <GuestNav hideSidebar={true} hideMobileNav={true} />
          <div className="flex items-center justify-center min-h-[90vh] p-6">
            <m.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center p-12 relative z-10"
            >
              <div className="w-32 h-32 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-8 relative">
                <m.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 12, stiffness: 200 }}
                >
                  <CheckCircle className="w-16 h-16 text-emerald-400" />
                </m.div>
                <div className="absolute inset-0 rounded-full border border-emerald-500/20 animate-ping opacity-20" />
              </div>
              <h2 className="text-4xl md:text-6xl font-display font-black mb-4 text-[oklch(0.15_0.05_200)] tracking-tight">
                {submissionMode === 'queued' ? 'Report Queued Offline' : 'Report Submitted'}
              </h2>
              <p className="text-[oklch(0.40_0.02_200)] text-lg mb-8 max-w-sm mx-auto font-bold opacity-80">
                ID: {createdReport?.id || 'SUBMITTED'}<br/>
                {submissionMode === 'queued'
                  ? 'Report will be sent automatically when connection is restored.'
                  : 'Thank you for your contribution to maintaining operational service quality.'}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <PrismButton
                  onClick={resetToQuickAccess}
                  className="bg-white text-[oklch(0.15_0.05_200)] px-8 h-14 text-base border border-white/10 shadow-spatial-md"
                >
                  Close
                </PrismButton>
                <PrismButton
                  onClick={resetToQuickAccess}
                  className="bg-emerald-600 text-white px-8 h-14 text-base shadow-spatial-md"
                >
                  Back to Quick Access
                </PrismButton>
              </div>
            </m.div>
          </div>
        </div>
      </LazyMotion>
    );
  }

  return (
    <LazyMotion features={domAnimation}>
    <div className="relative overflow-x-hidden p-6 md:p-12 font-body">
      <NoiseTexture opacity={0.02} />
      <GuestNav hideSidebar={true} hideMobileNav={true} />

      {/* Bento Grid */}
      <main className="max-w-7xl mx-auto mb-32 relative z-10">
        {/* Card renderer shared between mobile + desktop */}
        {(() => {
          const renderCard = (cat: typeof CATEGORIES[number], idx: number, solo = false) => (
            <m.div
              key={cat.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1, type: 'spring', damping: 20 }}
              className={`${solo ? 'col-span-full' : cat.span} group relative cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 rounded-[var(--radius-2xl)]`}
              onClick={() => openCategory(cat)}
              role="button"
              tabIndex={0}
              aria-label={cat.title}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openCategory(cat);
                }
              }}
            >
              <GlassCard
                variant="frosted"
                className="h-full border-[oklch(0.15_0.02_200_/_0.05)] hover:border-emerald-500/30 transition-all duration-500 shadow-spatial-sm hover:shadow-spatial-lg"
              >
                <div className="p-5 md:p-7 h-full flex flex-col justify-between relative z-10 overflow-hidden">
                  <div className="space-y-1.5 md:space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="p-2 md:p-3 rounded-xl md:rounded-2xl bg-[oklch(1_0_0_/_0.4)] border border-white/40 shadow-inner-rim">
                        <cat.icon className="w-4 h-4 md:w-6 md:h-6" style={{ color: cat.color }} />
                      </div>
                      {quickAccessCheckingId === cat.id && (
                        <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin text-emerald-600" />
                      )}
                    </div>
                    <div className="space-y-0.5 md:space-y-2">
                      <h3 className="text-base md:text-2xl font-display font-black tracking-tight text-[oklch(0.15_0.05_200)] group-hover:translate-x-1 transition-transform leading-tight">
                        {cat.title}
                      </h3>
                      <p className="hidden md:block text-sm text-[oklch(0.45_0.02_200)] leading-relaxed font-medium">{cat.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[oklch(0.15_0.02_200_/_0.2)] group-hover:text-emerald-600 transition-colors mt-auto">
                    <span className="text-[9px] md:text-xs font-bold tracking-wide uppercase">{('qrLinks' in cat) ? 'Quick Access' : 'Launch'}</span>
                    <ArrowRight className="w-4 h-4 md:w-5 md:h-5 -translate-x-2 group-hover:translate-x-0 opacity-0 group-hover:opacity-100 transition-all" />
                  </div>
                </div>
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              </GlassCard>
            </m.div>
          );

          const SECTIONS: { label: string; ids: string[] }[] = [
            { label: 'AI Assistant', ids: ['AIChatbot'] },
            { label: 'Irregularity, Complaint & Compliment Reports', ids: ['Irregularity', 'JOUMPA'] },
            { label: 'Passenger Survey Reports', ids: ['CustomerAirlineSurvey', 'JoumpaSurvey'] },
            { label: 'Form & Reports', ids: ['DOS', 'SLA', 'HSSE', 'HSSEReport'] },
            { label: 'Documents / Guideline', ids: ['SAM', 'WSN', 'Handbook'] },
          ];

          return (
            <div className="px-4 md:px-0">
              {SECTIONS.map((section) => {
                const cats = section.ids.map((id) => CATEGORIES.find((c) => c.id === id)).filter(Boolean) as typeof CATEGORIES;
                if (!cats.length) return null;
                const solo = cats.length === 1;
                return (
                  <div key={section.label} className="mb-6">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="flex-1 h-px bg-[oklch(0.15_0.02_200_/_0.12)]" />
                      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[oklch(0.50_0.02_200)]">{section.label}</span>
                      <span className="flex-1 h-px bg-[oklch(0.15_0.02_200_/_0.12)]" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 auto-rows-[minmax(140px,auto)] sm:auto-rows-[minmax(180px,auto)] lg:auto-rows-[minmax(220px,auto)] grid-flow-row-dense">
                      {cats.map((cat, idx) => renderCard(cat, idx, solo))}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </main>

      {/* Portal Dialog */}
      <AnimatePresence mode="wait">
        {formData.main_category && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[oklch(0.15_0.02_200_/_0.2)] backdrop-blur-sm"
              onClick={closeQuickAccess}
            />
            
            <m.div
              initial={{ opacity: 0, y: '100%' }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-4xl bg-[oklch(1_0_0_/_0.95)] border-t md:border border-[oklch(0.15_0.02_200_/_0.05)] rounded-t-[32px] md:rounded-[32px] overflow-hidden shadow-spatial-lg h-[90vh] md:h-auto max-h-[95vh] flex flex-col backdrop-blur-2xl"
            >
              <NoiseTexture opacity={0.015} />
              
              {/* Mobile Drawer Handle */}
              <div className="md:hidden flex justify-center py-3">
                <div className="w-12 h-1.5 rounded-full bg-[oklch(0.15_0.02_200_/_0.1)]" />
              </div>

              {/* Modal Header */}
              <div className="p-6 md:p-8 pb-4 flex items-center justify-between relative z-10 border-b border-[oklch(0.15_0.02_200_/_0.05)]">
                <div>
                  <h2 className="text-2xl md:text-3xl font-display font-black tracking-tight text-[oklch(0.15_0.05_200)]">
                    {CATEGORIES.find(c => c.id === formData.main_category)?.title ?? formData.main_category}
                  </h2>
                </div>
                <button 
                  onClick={() => {
                    closeQuickAccess();
                  }}
                  className="p-3 rounded-full bg-[oklch(0.15_0.02_200_/_0.03)] hover:bg-[oklch(0.15_0.02_200_/_0.08)] transition-colors"
                >
                  <X className="w-6 h-6 text-[oklch(0.15_0.02_200_/_0.4)]" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-8 relative z-10 custom-scrollbar">
                {selectedCategory && hasQrLinks(selectedCategory) ? (
                  <div className="py-12 flex flex-col items-center justify-center space-y-12 animate-in zoom-in-95 duration-500">
                    <div className="text-center space-y-3">
                      <h3 className="text-4xl font-display font-black tracking-tight text-[oklch(0.15_0.05_200)]">
                        {selectedCategory?.title || 'Access'}
                      </h3>
                      <p className="text-[oklch(0.40_0.02_200)] text-lg font-medium">Scan the QR, copy the link, or click the card to open the link directly.</p>
                    </div>
                    <div
                      className={`grid gap-12 w-full max-w-3xl px-4 ${
                        (selectedCategory.qrLinks?.length ?? 0) > 1
                          ? 'grid-cols-1 md:grid-cols-2'
                          : 'grid-cols-1'
                      } place-items-center justify-center`}
                    >
                      {selectedCategory.qrLinks?.map((item: QRLink, idx: number) => (
                        <div
                          key={idx}
                          className="w-full max-w-md space-y-4 rounded-[28px] border border-[oklch(0.15_0.02_200_/_0.06)] bg-white p-6 shadow-spatial-md"
                        >
                          <div className="aspect-square rounded-[24px] overflow-hidden bg-white border border-[oklch(0.15_0.02_200_/_0.06)] p-6 shadow-spatial-sm flex items-center justify-center">
                            <QRCodeWithLogo value={item.url} size={256} fgColor="#0ea5a6" />
                          </div>
                          <div className="text-center">
                            <h4 className="text-xl font-display font-black text-[oklch(0.15_0.05_200)]">{item.label}</h4>
                          </div>
                          <div className="space-y-2 rounded-2xl border border-cyan-100 bg-cyan-50/60 p-3">
                            <label className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">Link {item.label}</label>
                            <input
                              readOnly
                              value={item.url}
                              className="w-full px-3 py-2 rounded-xl border border-[oklch(0.15_0.02_200_/_0.08)] bg-white text-sm font-semibold"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => copyToClipboard(item.url, item.label)}
                                className="px-4 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold active:scale-95"
                              >
                                {copied === item.label ? 'Copied' : 'Copy Link'}
                              </button>
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-3 rounded-xl bg-white text-[oklch(0.15_0.02_200)] text-sm font-bold border border-[oklch(0.15_0.02_200_/_0.08)] active:scale-95 text-center"
                              >
                                Click Here
                              </a>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : selectedCategory && hasLinks(selectedCategory) ? (
                  <div className="py-12 flex flex-col items-center justify-center space-y-8 animate-in zoom-in-95 duration-500">
                    <div className="text-center space-y-3 max-w-2xl">
                      <h3 className="text-4xl font-display font-black tracking-tight text-[oklch(0.15_0.05_200)]">
                        {selectedCategory.title}
                      </h3>
                      <p className="text-[oklch(0.40_0.02_200)] text-lg font-medium">{selectedCategory.description}</p>
                    </div>
                    <div className="w-full max-w-2xl space-y-4">
                      {selectedCategory.links.map((link, idx) => (
                        <a
                          key={idx}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-center gap-4 p-5 rounded-2xl bg-white border border-[oklch(0.15_0.02_200_/_0.08)] hover:border-emerald-500/40 transition"
                        >
                          <selectedCategory.icon className="w-6 h-6 text-emerald-600" />
                          <div className="flex-1">
                            <div className="text-base font-extrabold text-[oklch(0.15_0.05_200)]">{link.label}</div>
                            {link.sublabel ? <div className="text-xs text-[oklch(0.40_0.02_200)] font-bold">{link.sublabel}</div> : null}
                          </div>
                          <ExternalLink className="w-5 h-5 text-[oklch(0.15_0.02_200_/_0.25)] group-hover:text-emerald-600" />
                        </a>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    {error && (
                  <m.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mb-8 p-4 rounded-2xl bg-red-400/10 border border-red-400/20 text-red-400 flex items-start gap-3 text-sm"
                  >
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    {error}
                  </m.div>
                )}

                <WizardStep isActive={step === 1}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-[oklch(0.15_0.02_200_/_0.6)] uppercase tracking-widest">Date of Event</label>
                        <div className="relative group">
                          <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[oklch(0.15_0.02_200_/_0.2)] group-focus-within:text-emerald-600 transition-colors" />
                          <input
                            type="date"
                            className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white border border-[oklch(0.15_0.02_200_/_0.1)] focus:border-emerald-500/50 outline-none transition-all text-[oklch(0.15_0.05_200)] font-bold shadow-spatial-sm"
                            value={formData.incident_date}
                            onChange={(e) => setFormData({ ...formData, incident_date: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-[oklch(0.15_0.02_200_/_0.6)] uppercase tracking-widest">Airlines</label>
                        <select
                          className="w-full px-5 py-4 rounded-2xl bg-white border border-[oklch(0.15_0.02_200_/_0.1)] focus:border-emerald-500/50 appearance-none outline-none transition-all text-[oklch(0.15_0.05_200)] font-bold shadow-spatial-sm"
	                          value={formData.airline}
	                          onChange={(e) => setFormData({ ...formData, airline: e.target.value })}
	                        >
                          <option value="">Select Airline...</option>
                          {AIRLINES.map((airline) => (
                            <option key={airline.code} value={airline.name}>
                              {airline.name} ({airline.code})
                            </option>
	                          ))}
	                        </select>
                        {formData.airline === 'Other' && (
                          <input
                            type="text"
                            placeholder="Enter airline name"
                            className="mt-2 w-full px-5 py-4 rounded-2xl bg-white border border-[oklch(0.15_0.02_200_/_0.1)] focus:border-emerald-500/50 outline-none transition-all text-[oklch(0.15_0.05_200)] font-bold shadow-spatial-sm placeholder-[oklch(0.15_0.02_200_/_0.3)]"
                            value={formData.airline_other ?? ''}
                            onChange={(e) => setFormData({ ...formData, airline_other: e.target.value })}
                          />
                        )}
	                        {formValidationErrors.airline && (
	                          <p className="text-xs font-semibold text-red-600">{formValidationErrors.airline}</p>
	                        )}
	                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-[oklch(0.15_0.02_200_/_0.6)] uppercase tracking-widest">Flight Number</label>
                        <input
                          type="text"
                          placeholder="e.g. GA101"
	                          className="w-full px-5 py-4 rounded-2xl bg-white border border-[oklch(0.15_0.02_200_/_0.1)] focus:border-emerald-500/50 outline-none transition-all uppercase text-[oklch(0.15_0.05_200)] font-bold shadow-spatial-sm placeholder-[oklch(0.15_0.02_200_/_0.3)]"
	                          value={formData.flight_number}
	                          onChange={(e) => setFormData({ ...formData, flight_number: e.target.value })}
	                        />
	                        {formValidationErrors.flight_number && (
	                          <p className="text-xs font-semibold text-red-600">{formValidationErrors.flight_number}</p>
	                        )}
	                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-[oklch(0.15_0.02_200_/_0.6)] uppercase tracking-widest">Station Location</label>
                        <select
                          className="w-full px-5 py-4 rounded-2xl bg-white border border-[oklch(0.15_0.02_200_/_0.1)] focus:border-emerald-500/50 appearance-none outline-none transition-all text-[oklch(0.15_0.05_200)] font-bold shadow-spatial-sm"
                          value={formData.station_id}
                          onChange={(e) => setFormData({ ...formData, station_id: e.target.value })}
                        >
                          <option value="">Select Station...</option>
	                          {stations.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.code} - {s.name}
                            </option>
	                          ))}
	                        </select>
	                        {formValidationErrors.station_id && (
	                          <p className="text-xs font-semibold text-red-600">{formValidationErrors.station_id}</p>
	                        )}
	                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-[oklch(0.15_0.02_200_/_0.6)] uppercase tracking-widest">Route (Sector)</label>
                        <input
                          type="text"
                          placeholder="e.g. CGK-SUB"
	                          className="w-full px-5 py-4 rounded-2xl bg-white border border-[oklch(0.15_0.02_200_/_0.1)] focus:border-emerald-500/50 outline-none transition-all text-[oklch(0.15_0.05_200)] font-bold shadow-spatial-sm placeholder-[oklch(0.15_0.02_200_/_0.3)]"
	                          value={formData.route}
	                          onChange={(e) => setFormData({ ...formData, route: e.target.value })}
	                        />
	                        {formValidationErrors.route && (
	                          <p className="text-xs font-semibold text-red-600">{formValidationErrors.route}</p>
	                        )}
	                      </div>

                      <div className="space-y-3">
                        <label className="text-xs font-bold text-[oklch(0.15_0.02_200_/_0.6)] uppercase tracking-widest">Delay Code</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => { setDelayChoice('no'); setFormData({ ...formData, delay_code: '' }); }}
                            className={`px-5 py-4 rounded-2xl border font-bold transition-all ${delayChoice === 'no' ? 'bg-emerald-600 text-white border-emerald-600 shadow-spatial-md' : 'bg-white border-[oklch(0.15_0.02_200_/_0.1)] text-[oklch(0.15_0.05_200)]'}`}
                          >
                            No Delay
                          </button>
                          <button
                            type="button"
                            onClick={() => setDelayChoice('other')}
                            className={`px-5 py-4 rounded-2xl border font-bold transition-all ${delayChoice === 'other' ? 'bg-emerald-600 text-white border-emerald-600 shadow-spatial-md' : 'bg-white border-[oklch(0.15_0.02_200_/_0.1)] text-[oklch(0.15_0.05_200)]'}`}
                          >
                            Lainnya
                          </button>
                        </div>
                        {delayChoice === 'other' && (
                          <input
                            type="text"
                            placeholder="Input if Delayed (Code/Duration)"
                            className="w-full px-5 py-4 rounded-2xl bg-white border border-[oklch(0.15_0.02_200_/_0.1)] outline-none transition-all text-[oklch(0.15_0.05_200)] font-bold shadow-spatial-sm placeholder-[oklch(0.15_0.02_200_/_0.3)]"
                            value={formData.delay_code}
                            onChange={(e) => setFormData({ ...formData, delay_code: e.target.value })}
                          />
                        )}
                      </div>

                      <div className="space-y-3">
                        <label className="text-xs font-bold text-[oklch(0.15_0.02_200_/_0.6)] uppercase tracking-widest">Report Category</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {REPORT_CATEGORY_OPTIONS.map((cat) => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setFormData({ ...formData, main_category: cat })}
                              className={`px-5 py-4 rounded-2xl border font-bold text-sm transition-all ${formData.main_category === cat ? 'bg-emerald-600 text-white border-emerald-600 shadow-spatial-md' : 'bg-white border-[oklch(0.15_0.02_200_/_0.1)] text-[oklch(0.15_0.05_200)]'}`}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </WizardStep>

                <WizardStep isActive={step === 2}>
                  <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                    <div className="text-center space-y-2 mb-10">
                      <h3 className="text-3xl font-display font-black text-[oklch(0.15_0.05_200)]">Select Area</h3>
                      <p className="text-[oklch(0.40_0.02_200)] font-bold">Specify where the incident occurred</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {AREA_OPTIONS.map((area) => (
                        <button
                          key={area.id}
                          onClick={() => setFormData({ ...formData, area: area.id, area_category: '', area_category_other: '', gse_type: '', gse_equipment: '', gse_equipment_other: '', root_cause_classification: '', root_cause_classification_other: '' })}
                          className={`group p-8 rounded-[24px] border transition-all duration-300 flex items-center justify-between text-left
                            ${formData.area === area.id 
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-spatial-md' 
                              : 'bg-white border-[oklch(0.15_0.02_200_/_0.05)] hover:border-emerald-500/30 hover:bg-white/50 text-[oklch(0.15_0.05_200)]'}`}
                        >
                          <div className="flex items-center gap-6">
                            <div className={`p-4 rounded-2xl transition-colors ${formData.area === area.id ? 'bg-white/20 text-white' : 'bg-[oklch(0.15_0.02_200_/_0.05)] text-[oklch(0.15_0.02_200_/_0.4)] group-hover:text-emerald-600'}`}>
                              <area.icon className="w-6 h-6" />
                            </div>
                            <span className="text-xl font-display font-black tracking-tight">{area.label}</span>
                          </div>
                          {formData.area === area.id && (
                            <m.div layoutId="area-check" className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                              <CheckCircle className="w-5 h-5 text-white" />
                            </m.div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </WizardStep>

                <WizardStep isActive={step === 3}>
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                    <div className="text-center space-y-2 mb-8">
                      <h3 className="text-3xl font-display font-black text-[oklch(0.15_0.05_200)]">Refine Category</h3>
                      <p className="text-[oklch(0.40_0.02_200)] font-bold">Select specific type for {formData.area}</p>
                    </div>

                    {formData.area === 'GSE' ? (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {GSE_TYPES.map((t) => (
                            <button
                              key={t}
                              onClick={() => setFormData({ ...formData, gse_type: t, gse_equipment: '', gse_equipment_other: '' })}
                              className={`flex items-center gap-4 p-5 rounded-2xl border transition-all
                                ${formData.gse_type === t
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-spatial-sm'
                                  : 'bg-white border-[oklch(0.15_0.02_200_/_0.05)] hover:border-emerald-500/30 text-[oklch(0.15_0.05_200)]/60 hover:text-[oklch(0.15_0.05_200)]'}`}
                            >
                              <div className={`w-3 h-3 rounded-full border-2 transition-all ${formData.gse_type === t ? 'bg-white border-white' : 'border-[oklch(0.15_0.02_200_/_0.1)]'}`} />
                              <span className="text-sm font-bold">{t}</span>
                            </button>
                          ))}
                        </div>

                        {formData.gse_type && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {GSE_EQUIPMENT[formData.gse_type].map((eq) => (
                              <button
                                key={eq}
                                onClick={() => setFormData({ ...formData, gse_equipment: eq })}
                                className={`flex items-center gap-4 p-5 rounded-2xl border transition-all
                                  ${formData.gse_equipment === eq
                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-spatial-sm'
                                    : 'bg-white border-[oklch(0.15_0.02_200_/_0.05)] hover:border-emerald-500/30 text-[oklch(0.15_0.05_200)]/60 hover:text-[oklch(0.15_0.05_200)]'}`}
                              >
                                <div className={`w-3 h-3 rounded-full border-2 transition-all ${formData.gse_equipment === eq ? 'bg-white border-white' : 'border-[oklch(0.15_0.02_200_/_0.1)]'}`} />
                                <span className="text-sm font-bold">{eq}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {formData.gse_equipment === 'Other' && (
                          <input
                            type="text"
                            placeholder="Describe the equipment"
                            className="w-full px-5 py-4 rounded-2xl bg-white border border-[oklch(0.15_0.02_200_/_0.1)] focus:border-emerald-500/50 outline-none transition-all text-[oklch(0.15_0.05_200)] font-bold shadow-spatial-sm placeholder-[oklch(0.15_0.02_200_/_0.3)]"
                            value={formData.gse_equipment_other}
                            onChange={(e) => setFormData({ ...formData, gse_equipment_other: e.target.value })}
                          />
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {AREA_CATEGORIES[formData.area]?.map((cat, idx) => (
                            <button
                              key={idx}
                              onClick={() => setFormData({ ...formData, area_category: cat })}
                              className={`flex items-center gap-4 p-5 rounded-2xl border transition-all
                                ${formData.area_category === cat
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-spatial-sm'
                                  : 'bg-white border-[oklch(0.15_0.02_200_/_0.05)] hover:border-emerald-500/30 text-[oklch(0.15_0.05_200)]/60 hover:text-[oklch(0.15_0.05_200)]'}`}
                            >
                              <div className={`w-3 h-3 rounded-full border-2 transition-all ${formData.area_category === cat ? 'bg-white border-white' : 'border-[oklch(0.15_0.02_200_/_0.1)]'}`} />
                              <span className="text-sm font-bold">{cat}</span>
                            </button>
                          ))}
                        </div>
                        {formData.area_category === 'Other' && (
                          <input
                            type="text"
                            placeholder="Describe the category"
                            className="w-full px-5 py-4 rounded-2xl bg-white border border-[oklch(0.15_0.02_200_/_0.1)] focus:border-emerald-500/50 outline-none transition-all text-[oklch(0.15_0.05_200)] font-bold shadow-spatial-sm placeholder-[oklch(0.15_0.02_200_/_0.3)]"
                            value={formData.area_category_other}
                            onChange={(e) => setFormData({ ...formData, area_category_other: e.target.value })}
                          />
                        )}
                      </>
                    )}
                  </div>
                </WizardStep>

                <WizardStep isActive={step === 4}>
                  <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
                    <div className="grid grid-cols-1 gap-8">
                      <div className="space-y-4">
                        <label className="text-xs font-bold text-[oklch(0.15_0.02_200_/_0.6)] uppercase tracking-widest flex items-center gap-2">
                          <MessageSquare className="w-4 h-4 text-emerald-600" /> Comprehensive Report
                        </label>
                        <textarea
                          placeholder="Describe exactly what happened..."
                          className="w-full px-6 py-6 rounded-3xl bg-white border border-[oklch(0.15_0.02_200_/_0.1)] focus:border-emerald-500/50 outline-none transition-all min-h-[160px] resize-none leading-relaxed text-[oklch(0.15_0.05_200)] font-medium shadow-spatial-sm placeholder-[oklch(0.15_0.02_200_/_0.3)]"
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <label className="text-xs font-bold text-[oklch(0.15_0.02_200_/_0.6)] uppercase tracking-widest text-emerald-800">Root Cause</label>
                          <textarea
                            placeholder="What caused this?"
                            className="w-full px-6 py-6 rounded-3xl bg-white border border-[oklch(0.15_0.02_200_/_0.1)] focus:border-emerald-500/50 outline-none transition-all min-h-[120px] resize-none text-[oklch(0.15_0.05_200)] font-medium shadow-spatial-sm placeholder-[oklch(0.15_0.02_200_/_0.3)]"
                            value={formData.root_cause}
                            onChange={(e) => setFormData({ ...formData, root_cause: e.target.value })}
                          />
                        </div>
                        <div className="space-y-4">
                          <label className="text-xs font-bold text-[oklch(0.15_0.02_200_/_0.6)] uppercase tracking-widest text-emerald-800">Corrective Action</label>
                          <textarea
                            placeholder="What resolve was taken?"
                            className="w-full px-6 py-6 rounded-3xl bg-white border border-[oklch(0.15_0.02_200_/_0.1)] focus:border-emerald-500/50 outline-none transition-all min-h-[120px] resize-none text-[oklch(0.15_0.05_200)] font-medium shadow-spatial-sm placeholder-[oklch(0.15_0.02_200_/_0.3)]"
                            value={formData.action_taken}
                            onChange={(e) => setFormData({ ...formData, action_taken: e.target.value })}
                          />
                        </div>
                      </div>

                      {ROOT_CAUSE_CLASSIFICATIONS[formData.area] && (
                        <div className="space-y-4">
                          <label className="text-xs font-bold text-[oklch(0.15_0.02_200_/_0.6)] uppercase tracking-widest text-emerald-800">Root Cause Classification</label>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {ROOT_CAUSE_CLASSIFICATIONS[formData.area]!.map((cause) => (
                              <button
                                key={cause}
                                type="button"
                                onClick={() => setFormData({ ...formData, root_cause_classification: cause })}
                                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all text-left
                                  ${formData.root_cause_classification === cause
                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-spatial-sm'
                                    : 'bg-white border-[oklch(0.15_0.02_200_/_0.05)] hover:border-emerald-500/30 text-[oklch(0.15_0.05_200)]/60 hover:text-[oklch(0.15_0.05_200)]'}`}
                              >
                                <div className={`w-3 h-3 rounded-full border-2 transition-all shrink-0 ${formData.root_cause_classification === cause ? 'bg-white border-white' : 'border-[oklch(0.15_0.02_200_/_0.1)]'}`} />
                                <span className="text-sm font-bold">{cause}</span>
                              </button>
                            ))}
                          </div>
                          {formData.root_cause_classification === 'Other' && (
                            <input
                              type="text"
                              placeholder="Describe the root cause classification"
                              className="w-full px-5 py-4 rounded-2xl bg-white border border-[oklch(0.15_0.02_200_/_0.1)] focus:border-emerald-500/50 outline-none text-[oklch(0.15_0.05_200)] font-bold shadow-spatial-sm placeholder-[oklch(0.15_0.02_200_/_0.3)]"
                              value={formData.root_cause_classification_other}
                              onChange={(e) => setFormData({ ...formData, root_cause_classification_other: e.target.value })}
                            />
                          )}
                        </div>
                      )}

                      <div className="space-y-4">
                        <label className="text-xs font-bold text-[oklch(0.15_0.02_200_/_0.6)] uppercase tracking-widest text-emerald-800">Preventive Action (Optional)</label>
                        <textarea
                          placeholder="How can this be prevented in the future?"
                          className="w-full px-6 py-6 rounded-3xl bg-white border border-[oklch(0.15_0.02_200_/_0.1)] focus:border-emerald-500/50 outline-none transition-all min-h-[120px] resize-none text-[oklch(0.15_0.05_200)] font-medium shadow-spatial-sm placeholder-[oklch(0.15_0.02_200_/_0.3)]"
                          value={formData.preventive_action}
                          onChange={(e) => setFormData({ ...formData, preventive_action: e.target.value })}
                        />
                      </div>

                      {formData.area === 'GSE' && (
                        <div className="space-y-4 p-6 rounded-3xl bg-emerald-50/40 border border-emerald-200">
                          <label className="text-xs font-bold text-emerald-800 uppercase tracking-widest">Category Case GSE</label>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {AREA_CATEGORIES.GSE.map((cat) => (
                              <button
                                key={cat}
                                type="button"
                                onClick={() => setFormData({ ...formData, area_category: cat })}
                                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all
                                  ${formData.area_category === cat
                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-spatial-sm'
                                    : 'bg-white border-[oklch(0.15_0.02_200_/_0.1)] hover:border-emerald-500/30 text-[oklch(0.15_0.05_200)]/60 hover:text-[oklch(0.15_0.05_200)]'}`}
                              >
                                <div className={`w-3 h-3 rounded-full border-2 transition-all shrink-0 ${formData.area_category === cat ? 'bg-white border-white' : 'border-[oklch(0.15_0.02_200_/_0.1)]'}`} />
                                <span className="text-sm font-bold">{cat}</span>
                              </button>
                            ))}
                          </div>
                          {formData.area_category === 'Other' && (
                            <input
                              type="text"
                              placeholder="Describe the category"
                              className="w-full px-5 py-4 rounded-2xl bg-white border border-[oklch(0.15_0.02_200_/_0.1)] focus:border-emerald-500/50 outline-none text-[oklch(0.15_0.05_200)] font-bold shadow-spatial-sm placeholder-[oklch(0.15_0.02_200_/_0.3)]"
                              value={formData.area_category_other}
                              onChange={(e) => setFormData({ ...formData, area_category_other: e.target.value })}
                            />
                          )}
                        </div>
                      )}

                      <div className="space-y-6 p-8 rounded-3xl bg-white border border-[oklch(0.15_0.02_200_/_0.05)] shadow-spatial-sm">
                        <label className="text-xs font-bold text-[oklch(0.15_0.02_200_/_0.6)] uppercase tracking-widest block mb-4">Severity Assessment</label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {PUBLIC_SEVERITY_OPTIONS.map((key) => {
                            const config = SEVERITY_CONFIG[key];
                            const label = key.toUpperCase();
                            return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setFormData({ ...formData, severity: key })}
                              className={`relative group p-4 rounded-2xl border-2 transition-all transition-all duration-300 overflow-hidden ${formData.severity === key ? 'scale-[1.05] shadow-spatial-md' : 'opacity-40 grayscale hover:opacity-100 hover:grayscale-0'}`}
                              style={{ 
                                borderColor: formData.severity === key ? config.color : 'transparent',
                                background: formData.severity === key ? `${config.color}20` : 'transparent'
                              }}
                            >
                              <div className="relative z-10">
                                <span className="text-xs font-black uppercase" style={{ color: config.color }}>{label}</span>
                              </div>
                              {formData.severity === key && (
                                <m.div layoutId="severity-active" className="absolute inset-0 bg-white/10 pointer-events-none" />
                              )}
                            </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </WizardStep>

                <WizardStep isActive={step === 5}>
                  <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      <div className="space-y-6">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-[oklch(0.15_0.02_200_/_0.6)] uppercase tracking-widest">Reporter Name</label>
                          <div className="relative group">
                            <input
                              type="text"
                              placeholder="Full Name"
                              className="w-full px-6 py-5 rounded-2xl bg-white border border-[oklch(0.15_0.02_200_/_0.1)] focus:border-emerald-500/50 outline-none transition-all text-[oklch(0.15_0.05_200)] font-bold shadow-spatial-sm placeholder-[oklch(0.15_0.02_200_/_0.3)]"
                              value={formData.reporter_name}
                              onChange={(e) => setFormData({ ...formData, reporter_name: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-[oklch(0.15_0.02_200_/_0.6)] uppercase tracking-widest">Email Contact</label>
                          <input
                            type="email"
                            placeholder="email@gapura.id"
                            className="w-full px-6 py-5 rounded-2xl bg-white border border-[oklch(0.15_0.02_200_/_0.1)] focus:border-emerald-500/50 outline-none transition-all text-[oklch(0.15_0.05_200)] font-bold shadow-spatial-sm placeholder-[oklch(0.15_0.02_200_/_0.3)]"
                            value={formData.reporter_email}
                            onChange={(e) => setFormData({ ...formData, reporter_email: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-[oklch(0.15_0.02_200_/_0.6)] uppercase tracking-widest">Evidence</label>
                          <div className="flex-1">
                            <div className="relative flex min-h-[220px] items-center justify-center p-8 rounded-2xl border-2 border-dashed border-[oklch(0.15_0.02_200_/_0.15)] bg-[oklch(0.15_0.02_200_/_0.02)] hover:border-emerald-500/30 hover:bg-[oklch(0.60_0.18_260_/_0.05)] transition-all cursor-pointer group overflow-hidden has-[:focus-visible]:border-emerald-500 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-emerald-500 has-[:focus-visible]:ring-offset-2">
                              <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                aria-label="Upload evidence photos"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                onChange={(e) => {
                                  const incomingFiles = Array.from(e.target.files || []);
                                  if (!incomingFiles.length) return;
                                  setSelectedFiles((prev) => {
                                    const next = [...prev];
                                    for (const file of incomingFiles) {
                                      const duplicate = next.some(
                                        (existing) =>
                                          existing.name === file.name &&
                                          existing.size === file.size &&
                                          existing.lastModified === file.lastModified
	                                      );
	                                      if (!duplicate) {
	                                        next.push(file);
	                                        const key = evidenceFileKey(file);
	                                        setEvidenceUploadStatuses((current) => ({
	                                          ...current,
	                                          [key]: { status: navigator.onLine ? 'pending' : 'pending', message: navigator.onLine ? undefined : 'Will be sent when online.' },
	                                        }));
	                                      }
	                                    }
                                    return next;
                                  });
                                }}
                              />
                              <div className="text-center space-y-3 relative z-10 pointer-events-none">
                                <Upload className="w-8 h-8 text-[oklch(0.15_0.02_200_/_0.3)] group-hover:text-emerald-600 mx-auto transition-colors" />
                                <div>
                                  <p className="text-sm font-bold text-[oklch(0.15_0.02_200_/_0.6)]">Click to upload</p>
                                  <p className="text-xs text-[oklch(0.15_0.02_200_/_0.3)]">Images only (auto-compressed, multiple files supported)</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {formData.evidence_urls.length > 0 && (
                      <div className="space-y-3 p-6 rounded-2xl bg-[oklch(0.60_0.18_260_/_0.05)] border border-emerald-500/10">
                        <label className="text-xs font-bold text-[oklch(0.60_0.18_260)] uppercase tracking-widest">Uploaded Evidence</label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {formData.evidence_urls.map((url, idx) => (
                            <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden bg-white border border-[oklch(0.15_0.02_200_/_0.08)]">
                              <Image src={url} alt={`Evidence ${idx + 1}`} width={800} height={600} className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => removeEvidenceAt(idx)}
                                aria-label="Remove evidence photo"
                                className="absolute top-2 right-2 p-2.5 bg-red-500 text-white rounded-lg opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shadow-lg"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedFiles.length > 0 && (
                      <div className="space-y-3 p-6 rounded-2xl bg-blue-50 border border-blue-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold text-blue-700 uppercase tracking-widest">Pending Upload</p>
                            <p className="text-sm text-blue-600 font-medium">{selectedFiles.length} file(s) selected</p>
                          </div>
                          <PrismButton
                            onClick={handleFilesSelected}
                            disabled={uploadingFiles}
                            className="bg-blue-600 text-white px-6 py-2.5 text-sm font-bold shadow-sm active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {uploadingFiles ? 'Uploading...' : 'Upload Now'}
                          </PrismButton>
                        </div>
	                        <div className="grid gap-2">
	                          {selectedFiles.map((file, index) => (
	                            <div key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-white px-4 py-3">
	                              <div className="min-w-0">
	                                <p className="truncate text-sm font-semibold text-[oklch(0.15_0.05_200)]">{file.name}</p>
	                                <p className="text-xs text-blue-600">
	                                  {(file.size / 1024 / 1024).toFixed(2)} MB · {
	                                    evidenceUploadStatuses[evidenceFileKey(file)]?.status === 'uploading' ? 'Uploading...' :
	                                    evidenceUploadStatuses[evidenceFileKey(file)]?.status === 'uploaded' ? 'Uploaded successfully' :
	                                    evidenceUploadStatuses[evidenceFileKey(file)]?.status === 'failed' ? (evidenceUploadStatuses[evidenceFileKey(file)]?.message || 'Failed') :
	                                    navigator.onLine ? 'Pending upload' : 'Waiting for connection'
	                                  }
	                                </p>
	                              </div>
	                              <div className="flex items-center gap-2">
	                                {evidenceUploadStatuses[evidenceFileKey(file)]?.status === 'failed' && navigator.onLine && (
	                                  <button
	                                    type="button"
	                                    onClick={async () => {
	                                      const { uploadedUrls, successKeys } = await uploadEvidenceFiles([file]);
	                                      if (uploadedUrls.length > 0) {
	                                        setFormData((prev) => ({ ...prev, evidence_urls: [...prev.evidence_urls, ...uploadedUrls] }));
	                                        setSelectedFiles((prev) => prev.filter((item) => !successKeys.includes(evidenceFileKey(item))));
	                                      }
	                                    }}
	                                    className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-700"
	                                  >
	                                    Retry
	                                  </button>
	                                )}
	                                <button
	                                  type="button"
	                                  onClick={() => removeSelectedFileAt(index)}
	                                  className="rounded-lg p-2 text-red-500 transition hover:bg-red-50"
	                                  aria-label={`Remove ${file.name}`}
	                                >
	                                  <X size={14} />
	                                </button>
	                              </div>
	                            </div>
	                          ))}
                        </div>
                      </div>
                    )}
	                  </div>
	                </WizardStep>

	                <WizardStep isActive={step === 6}>
	                  <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
	                    <div className="text-center space-y-2">
	                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-xs font-bold uppercase tracking-wider">
	                        <ClipboardCheck className="w-4 h-4" /> Review Before Submit
	                      </div>
	                      <h3 className="text-3xl font-display font-black text-[oklch(0.15_0.05_200)]">Review Report Summary</h3>
	                      <p className="text-sm font-medium text-[oklch(0.40_0.02_200)]">Make sure all data is correct before the final submission.</p>
	                    </div>

	                    {duplicateCheckLoading && (
	                      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-700">
	                        Checking for possible report duplication...
	                      </div>
	                    )}

	                    {duplicateCheckDone && duplicateCandidates.length === 0 && (
	                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
	                        No strong duplicate report candidates found.
	                      </div>
	                    )}

	                    {duplicateCandidates.length > 0 && (
	                      <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-5">
	                        <div className="flex items-start gap-3">
	                          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
	                          <div>
	                            <p className="text-sm font-black text-amber-800">Possible duplicate report found</p>
	                            <p className="text-xs font-medium text-amber-700">This warning does not block submission. Review again if the reports are the same.</p>
	                          </div>
	                        </div>
	                        <div className="grid gap-2">
	                          {duplicateCandidates.map((candidate) => (
	                            <div key={candidate.id} className="rounded-xl border border-amber-200 bg-white px-4 py-3">
	                              <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
	                                <p className="text-sm font-bold text-[oklch(0.15_0.05_200)]">{candidate.title}</p>
	                                <span className="text-xs font-black uppercase text-amber-700">{Math.round(candidate.similarity * 100)}% similar</span>
	                              </div>
	                              <p className="mt-1 text-xs font-medium text-amber-700">
	                                {candidate.date_of_event?.slice(0, 10) || '-'} · {candidate.station_id || '-'} · {candidate.airline || '-'} {candidate.flight_number || ''} · {candidate.status}
	                              </p>
	                            </div>
	                          ))}
	                        </div>
	                      </div>
	                    )}

	                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
	                      {[
	                        ['Date of Incident', formData.incident_date],
	                        ['Station', selectedStation ? `${selectedStation.code} - ${selectedStation.name}` : formData.station_id],
	                        ['Airline', formData.airline],
	                        ['Flight Number', formData.flight_number],
	                        ['Route', formData.route],
	                        ['Category', `${formData.main_category} / ${formData.area} / ${formData.area_category}`],
	                        ['Severity', formData.severity.toUpperCase()],
	                        ['Reporter', `${formData.reporter_name} (${formData.reporter_email})`],
	                      ].map(([label, value]) => (
	                        <div key={label} className="rounded-2xl border border-[oklch(0.15_0.02_200_/_0.08)] bg-white p-4 shadow-spatial-sm">
	                          <p className="text-[10px] font-black uppercase tracking-widest text-[oklch(0.15_0.02_200_/_0.45)]">{label}</p>
	                          <p className="mt-1 break-words text-sm font-bold text-[oklch(0.15_0.05_200)]">{value || '-'}</p>
	                        </div>
	                      ))}
	                    </div>

	                    <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
	                      {[
	                        ['Chronology', formData.description],
	                        ['Root Cause', formData.root_cause],
	                        ['Corrective Action', formData.action_taken],
	                      ].map(([label, value]) => (
	                        <div key={label} className="rounded-2xl border border-[oklch(0.15_0.02_200_/_0.08)] bg-white p-4 shadow-spatial-sm">
	                          <p className="text-[10px] font-black uppercase tracking-widest text-[oklch(0.15_0.02_200_/_0.45)]">{label}</p>
	                          <p className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-sm font-medium leading-relaxed text-[oklch(0.25_0.03_200)]">{value || '-'}</p>
	                        </div>
	                      ))}
	                    </div>

	                    <div className="rounded-2xl border border-[oklch(0.15_0.02_200_/_0.08)] bg-white p-5 shadow-spatial-sm">
	                      <p className="text-[10px] font-black uppercase tracking-widest text-[oklch(0.15_0.02_200_/_0.45)]">Evidence</p>
	                      <p className="mt-1 text-sm font-bold text-[oklch(0.15_0.05_200)]">
	                        {formData.evidence_urls.length} uploaded · {selectedFiles.length} pending upload
	                      </p>
	                      {selectedFiles.length > 0 && (
	                        <p className="mt-2 text-xs font-medium text-blue-700">
	                          Unuploaded files will be processed on final submit. If offline, files are queued with the report.
	                        </p>
	                      )}
	                    </div>
	                  </div>
	                </WizardStep>

	                <WizardStep isActive={step === 7}>
	                  <div className="py-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="flex flex-col items-center space-y-8">
                      <div className="text-center space-y-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs font-bold uppercase tracking-wider mb-2">
                          <span aria-hidden="true">DOC</span> Live Preview & Editor
                        </div>
                        <h3 className="text-3xl font-display font-black text-[oklch(0.15_0.05_200)]">Finalize Report</h3>
                        <p className="text-[oklch(0.40_0.02_200)] font-medium max-w-md">Your report has been submitted. You can edit the details below and add an electronic signature before downloading the PDF/Word file.</p>
                      </div>

                      {/* A4-like Document Container */}
                      <div className="w-full max-w-[850px] bg-white shadow-2xl rounded-sm border border-slate-200 p-4 sm:p-8 md:p-16 min-h-0 sm:min-h-[1200px] text-slate-800 font-sans leading-relaxed relative group overflow-x-auto">
                        {/* Silk Ribbon / Watermark for "Digital Document" */}
                        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none select-none">
                          <p className="text-[60px] font-black -rotate-12">DIGITAL</p>
                        </div>

                        {/* Logo & Title */}
                        <div className="flex justify-between items-start mb-12 border-b-2 border-slate-100 pb-8">
                          <div className="relative w-32 h-16 grayscale">
                            <Image src="/logo.png" alt="Logo" fill className="object-contain" />
                          </div>
                          <div className="text-right">
                            <h1 className="text-xl font-bold tracking-tighter uppercase mb-1">Irregularity Report Form</h1>
                            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Digital Generated Doc • {createdReport?.id || 'DRAFT'}</p>
                          </div>
                        </div>

                        {/* Header Info */}
                        <div className="grid grid-cols-[100px_1fr] sm:grid-cols-[140px_1fr] gap-y-3 text-xs sm:text-sm mb-12">
                          {[
                            { label: 'Reference No', key: 'reference_no' as const },
                            { label: 'To', key: 'to' as const },
                            { label: 'From', key: 'from' as const },
                            { label: 'CC', key: 'cc' as const },
                            { label: 'Subject', key: 'subject' as const },
                            { label: 'Attachment', key: 'attachment' as const },
                          ].map((field) => (
                            <div key={field.key} className="contents group/edit">
                              <div className="font-bold text-slate-400 uppercase text-[10px] tracking-wider self-center">{field.label}</div>
                              <div className="relative">
                                <input 
                                  className="w-full font-bold text-slate-900 bg-transparent hover:bg-slate-50 border-b border-dashed border-transparent hover:border-slate-300 focus:border-emerald-500 focus:bg-emerald-50/30 outline-none py-1 px-2 transition-all rounded"
                                  value={docEdits[field.key]}
                                  onChange={(e) => setDocEdits({...docEdits, [field.key]: e.target.value})}
                                />
                                <PenLine className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-300 opacity-0 group-hover/edit:opacity-100 pointer-events-none" />
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Section I: Flight Data */}
                        <div className="mb-10">
                          <h4 className="font-black text-xs uppercase tracking-[0.2em] mb-4 text-emerald-800 border-l-4 border-emerald-500 pl-3">I. Flight Data</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 bg-slate-50/50 p-6 rounded-xl border border-slate-100">
                            {[
                              { label: 'Date Of Occurrence', key: 'incident_date' as const },
                              { label: 'Station', key: 'branch' as const },
                              { label: 'Flight Number', key: 'flight_number' as const },
                              { label: 'Aircraft Registration', key: 'aircraft_reg' as const },
                              { label: 'Route', key: 'route' as const },
                              { label: 'STD/ATD', key: 'std_atd' as const },
                              { label: 'PAX', key: 'pax' as const },
                              { label: 'BGE', key: 'bge' as const },
                              { label: 'Gate/Parking Stand', key: 'gate_stand' as const },
                              { label: 'Delay (Code/Duration)*', key: 'delay' as const },
                            ].map((field) => (
                              <div key={field.key} className="flex flex-col gap-1 group/edit relative">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">{field.label}</span>
                                <input 
                                  className="text-xs font-black text-slate-700 bg-transparent hover:bg-white border-b border-dashed border-transparent hover:border-slate-300 focus:border-emerald-500 outline-none py-1 px-1 transition-all rounded"
                                  value={docEdits[field.key]}
                                  onChange={(e) => setDocEdits({...docEdits, [field.key]: e.target.value})}
                                />
                                <PenLine className="absolute right-1 bottom-2 w-3 h-3 text-slate-200 opacity-0 group-hover/edit:opacity-100 pointer-events-none" />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Section II: Officers */}
                        <div className="mb-10">
                          <div className="flex justify-between items-center mb-4">
                            <h4 className="font-black text-xs uppercase tracking-[0.2em] text-emerald-800 border-l-4 border-emerald-500 pl-3">II. Officer(s) on Duty</h4>
                            <button 
                              onClick={addOfficerEntry}
                              className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-colors bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100"
                            >
                              <span aria-hidden="true">+</span> Add Officer
                            </button>
                          </div>
                          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                            <table className="w-full text-xs">
                              <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                  <th className="px-3 py-2 text-left font-bold text-slate-400 uppercase tracking-wider w-12">NO</th>
                                  <th className="px-3 py-2 text-left font-bold text-slate-400 uppercase tracking-wider">NAME</th>
                                  <th className="px-3 py-2 text-left font-bold text-slate-400 uppercase tracking-wider">COMPANY</th>
                                  <th className="px-3 py-2 text-left font-bold text-slate-400 uppercase tracking-wider">FUNCTION</th>
                                  <th className="px-3 py-2 w-8"></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {docEdits.officers.map((officer, idx) => (
                                  <tr key={idx} className="group/row hover:bg-slate-50/50 transition-colors">
                                    <td className="px-3 py-2 text-slate-400 font-mono">{idx + 1}</td>
                                    <td className="px-2 py-1">
                                      <input 
                                        className="w-full bg-transparent border-none focus:ring-1 focus:ring-emerald-500/30 rounded px-1 py-1 font-bold text-slate-800"
                                        value={officer.name}
                                        onChange={(e) => {
                                          const newOfficers = [...docEdits.officers];
                                          newOfficers[idx].name = e.target.value;
                                          setDocEdits({...docEdits, officers: newOfficers});
                                        }}
                                      />
                                    </td>
                                    <td className="px-2 py-1">
                                      <input 
                                        className="w-full bg-transparent border-none focus:ring-1 focus:ring-emerald-500/30 rounded px-1 py-1 text-slate-600"
                                        value={officer.company}
                                        onChange={(e) => {
                                          const newOfficers = [...docEdits.officers];
                                          newOfficers[idx].company = e.target.value;
                                          setDocEdits({...docEdits, officers: newOfficers});
                                        }}
                                      />
                                    </td>
                                    <td className="px-2 py-1">
                                      <input 
                                        className="w-full bg-transparent border-none focus:ring-1 focus:ring-emerald-500/30 rounded px-1 py-1 text-slate-600"
                                        value={officer.function}
                                        onChange={(e) => {
                                          const newOfficers = [...docEdits.officers];
                                          newOfficers[idx].function = e.target.value;
                                          setDocEdits({...docEdits, officers: newOfficers});
                                        }}
                                      />
                                    </td>
                                    <td className="px-2 py-1">
                                      <button
                                        onClick={() => removeOfficerEntry(idx)}
                                        className="p-1.5 text-slate-300 hover:text-red-500 opacity-70 sm:opacity-0 sm:group-hover/row:opacity-100 transition-all"
                                        aria-label={`Remove officer ${idx + 1}`}
                                      >
                                        <span aria-hidden="true">×</span>
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                                {docEdits.officers.length === 0 && (
                                  <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic">No officers added. Click Add Officer to list personnel on duty.</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Section III: Chronology */}
                        <div className="mb-10">
                          <div className="flex justify-between items-center mb-4">
                            <h4 className="font-black text-xs uppercase tracking-[0.2em] text-emerald-800 border-l-4 border-emerald-500 pl-3">III. Chronology of Event</h4>
                            <button 
                              onClick={addChronologyEntry}
                              className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-colors bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100"
                            >
                              <span aria-hidden="true">+</span> Add Entry
                            </button>
                          </div>
                          
                          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                            <table className="w-full text-xs">
                              <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                  <th className="px-3 py-2 text-left font-bold text-slate-400 uppercase tracking-wider w-32">TIME (LOCAL)</th>
                                  <th className="px-3 py-2 text-left font-bold text-slate-400 uppercase tracking-wider">DESCRIPTION/REMARK</th>
                                  <th className="px-3 py-2 w-8"></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {docEdits.chronology.map((entry, idx) => (
                                  <tr key={idx} className="group/row hover:bg-slate-50/50 transition-colors">
                                    <td className="px-2 py-1 align-top">
                                      <input 
                                        className="w-full bg-transparent border-none focus:ring-1 focus:ring-emerald-500/30 rounded px-2 py-2 font-mono font-bold text-emerald-600"
                                        value={entry.time}
                                        onChange={(e) => {
                                          const newChron = [...docEdits.chronology];
                                          newChron[idx].time = e.target.value;
                                          setDocEdits({...docEdits, chronology: newChron});
                                        }}
                                      />
                                    </td>
                                    <td className="px-2 py-1">
                                      <textarea 
                                        className="w-full bg-transparent border-none focus:ring-1 focus:ring-emerald-500/30 rounded px-2 py-2 font-medium text-slate-800 min-h-[60px] resize-none"
                                        value={entry.description}
                                        onChange={(e) => {
                                          const newChron = [...docEdits.chronology];
                                          newChron[idx].description = e.target.value;
                                          setDocEdits({...docEdits, chronology: newChron});
                                        }}
                                      />
                                    </td>
                                    <td className="px-2 py-1 align-top pt-3">
                                      <button
                                        onClick={() => removeChronologyEntry(idx)}
                                        className="p-1.5 text-slate-300 hover:text-red-500 opacity-70 sm:opacity-0 sm:group-hover/row:opacity-100 transition-all"
                                        aria-label={`Remove chronology ${idx + 1}`}
                                      >
                                        <span aria-hidden="true">×</span>
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                                {docEdits.chronology.length === 0 && (
                                  <tr>
                                    <td colSpan={3} className="px-4 py-8 text-center text-slate-400 italic">No chronology entries. Click Add Entry to document events.</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Sections IV, V, VI */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
                          {[
                            { title: 'IV. Potential/Root Cause(s)', key: 'root_cause' as const },
                            { title: 'V. Corrective Action(s)', key: 'action_taken' as const },
                            { title: 'VI. Preventive Action(s)', key: 'preventive_action' as const },
                          ].map((sec, idx) => (
                            <div key={idx} className={idx === 2 ? 'md:col-span-2' : ''}>
                              <h4 className="font-black text-xs uppercase tracking-[0.2em] mb-3 text-emerald-800 border-l-4 border-emerald-500 pl-3">{sec.title}</h4>
                              <div className="relative group/edit">
                                <textarea 
                                  className="w-full text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-100 hover:border-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 outline-none py-3 px-4 transition-all rounded-xl min-h-[100px] resize-none shadow-sm"
                                  value={docEdits[sec.key]}
                                  onChange={(e) => setDocEdits({...docEdits, [sec.key]: e.target.value})}
                                  placeholder={`Input ${sec.title.toLowerCase()}...`}
                                />
                                <PenLine className="absolute right-3 top-3 w-3 h-3 text-slate-300 opacity-0 group-hover/edit:opacity-100 pointer-events-none" />
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Signature Area */}
                        <div className="grid grid-cols-2 gap-12 pt-12 border-t border-slate-100">
                          <div className="space-y-6">
                            <div className="flex flex-col gap-1">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Location</span>
                                <input 
                                  className="text-sm font-bold text-slate-900 bg-slate-50 px-2 py-1 rounded border border-slate-200/50 w-full"
                                  value={docEdits.branch}
                                  onChange={(e) => setDocEdits({...docEdits, branch: e.target.value})}
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Date of Prepared</span>
                                <input 
                                  type="date"
                                  className="text-sm font-bold text-slate-900 bg-slate-50 px-2 py-1 rounded border border-slate-200/50 w-full"
                                  value={docEdits.incident_date}
                                  onChange={(e) => setDocEdits({...docEdits, incident_date: e.target.value})}
                                />
                            </div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest pt-4">Prepared by,</p>
                            <div className="w-full h-32 bg-slate-50 rounded-xl border border-slate-200/50 p-2 overflow-hidden">
                              <SignaturePad 
                                onChange={setSignatureDataUrl} 
                                height={100}
                                className="w-full h-full"
                              />
                            </div>
                            <div>
                              <input 
                                className="w-full text-sm font-black text-slate-900 border-b border-slate-900 pb-1 bg-transparent focus:bg-emerald-50 transition-all outline-none"
                                value={docEdits.reporter_name}
                                onChange={(e) => setDocEdits({...docEdits, reporter_name: e.target.value})}
                              />
                              <input 
                                className="w-full text-[10px] text-slate-400 uppercase font-bold mt-1 bg-transparent focus:bg-slate-50 transition-all outline-none"
                                value={docEdits.reporter_title}
                                onChange={(e) => setDocEdits({...docEdits, reporter_title: e.target.value})}
                              />
                            </div>
                          </div>
                          
                          <div className="text-right space-y-6 opacity-30 select-none grayscale">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Acknowledged by,</p>
                            <div className="w-full h-32 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-xl">
                              <span className="text-[10px] font-black uppercase text-slate-300">Manager Signature Area</span>
                            </div>
                            <div>
                              <p className="text-sm font-black text-slate-400 border-b border-slate-200 pb-1 inline-block min-w-[200px]">...................</p>
                              <p className="text-[10px] text-slate-400 uppercase font-bold mt-1">Manager of Airside Service</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </WizardStep>
	              </>
	            )}
	              </div>

              {/* Modal Footer */}
              {showWizardFooter && (
              <div className="p-6 md:p-8 border-t border-[oklch(0.15_0.02_200_/_0.05)] relative z-10 bg-white/50 backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[oklch(0.15_0.02_200_/_0.4)] uppercase tracking-widest">Step</span>
                    <div className="flex gap-1.5">
	                      {[1, 2, 3, 4, 5, 6, 7].map((s) => (
                        <div
                          key={s}
                          className={`w-6 h-1.5 rounded-full transition-all duration-300 ${
                            step >= s ? 'bg-emerald-600' : 'bg-[oklch(0.15_0.02_200_/_0.1)]'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-3">
	                    {step > 1 && step < 7 && (
                      <PrismButton
                        onClick={prevStep}
                        className="bg-white text-[oklch(0.15_0.05_200)] px-6 py-3 rounded-2xl text-sm font-bold border border-[oklch(0.15_0.02_200_/_0.1)] hover:border-emerald-500/30 transition-all shadow-spatial-sm"
                      >
                        <ChevronLeft size={16} className="mr-1" />
                        Back
                      </PrismButton>
                    )}
                    
	                    {step === 7 && (
	                      <PrismButton
	                        onClick={() => setStep(5)}
                        className="bg-white text-[oklch(0.15_0.05_200)] px-6 py-3 rounded-2xl text-sm font-bold border border-[oklch(0.15_0.02_200_/_0.1)] hover:border-emerald-500/30 transition-all shadow-spatial-sm"
                      >
                        <ChevronLeft size={16} className="mr-1" />
                        Edit Form
                      </PrismButton>
                    )}

                    {step < 5 ? (
                      <PrismButton
                        onClick={nextStep}
                        disabled={!isStepValid()}
                        className="bg-emerald-600 text-white px-6 py-3 rounded-2xl text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed shadow-spatial-sm active:scale-95 transition-all"
                      >
                        Next
                        <ChevronRight size={16} className="ml-1" />
                      </PrismButton>
	                    ) : step === 5 ? (
	                      <PrismButton
	                        onClick={nextStep}
	                        disabled={!isStepValid() || duplicateCheckLoading}
	                        className="bg-emerald-600 text-white px-8 py-3 rounded-2xl text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed shadow-spatial-sm active:scale-95 transition-all flex items-center gap-2"
	                      >
	                        {duplicateCheckLoading ? (
	                          <>
	                            <Loader2 size={16} className="animate-spin" />
	                            Checking...
	                          </>
	                        ) : (
	                          <>
	                            <ClipboardCheck size={16} />
	                            Review
	                          </>
	                        )}
	                      </PrismButton>
	                    ) : step === 6 ? (
	                      <PrismButton
	                        onClick={(e) => handleSubmit(e)}
	                        disabled={!isStepValid() || loading}
	                        className="bg-emerald-600 text-white px-8 py-3 rounded-2xl text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed shadow-spatial-sm active:scale-95 transition-all flex items-center gap-2"
	                      >
	                        {loading ? (
	                          <>
	                            <Loader2 size={16} className="animate-spin" />
	                            Submitting...
	                          </>
	                        ) : (
	                          <>
	                            <CheckCircle size={16} />
	                            Submit Final
	                          </>
	                        )}
	                      </PrismButton>
	                    ) : (
                      <div className="flex gap-3">
                        <PrismButton
                          onClick={handleExportWord}
                          disabled={exportLoading !== null}
                          className="bg-white text-blue-600 border border-blue-100 px-6 py-3 rounded-2xl text-sm font-bold shadow-spatial-sm active:scale-95 transition-all flex items-center gap-2"
                        >
                          {exportLoading === 'docx' ? <Loader2 size={16} className="animate-spin" /> : <span aria-hidden="true">↓</span>}
                          Word
                        </PrismButton>
                        <PrismButton
                          onClick={handleExportPDF}
                          disabled={exportLoading !== null}
                          className="bg-emerald-600 text-white px-8 py-3 rounded-2xl text-sm font-bold shadow-spatial-sm active:scale-95 transition-all flex items-center gap-2"
                        >
                          {exportLoading === 'pdf' ? <Loader2 size={16} className="animate-spin" /> : <span aria-hidden="true">↓</span>}
                          PDF
                        </PrismButton>
                        <PrismButton
                          onClick={handleFinishDocuments}
                          disabled={exportLoading !== null || !createdReport?.id}
                          className="bg-emerald-700 text-white px-8 py-3 rounded-2xl text-sm font-bold shadow-spatial-sm active:scale-95 transition-all flex items-center gap-2"
                        >
                          {exportLoading === 'finish' ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                          {exportLoading === 'finish' ? 'Saving…' : 'Finish'}
                        </PrismButton>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              )}

            </m.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pendingProtectedCategory && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
              onClick={closePasswordPrompt}
            />
            <m.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-spatial-xl border border-[oklch(0.15_0.02_200_/_0.08)] p-8"
            >
              <h3 className="text-xl font-display font-black text-[oklch(0.15_0.05_200)] mb-2">
                Password Required
              </h3>
              <p className="text-[oklch(0.40_0.02_200)] text-sm mb-6">
                Enter password to access {pendingProtectedCategory.title}
              </p>
              <div className="space-y-4">
                <div className="relative">
                  <input
                    type={showPasswordInput ? 'text' : 'password'}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Enter password..."
                    className="w-full px-5 py-4 pr-12 rounded-2xl bg-[oklch(0.15_0.02_200_/_0.02)] border border-[oklch(0.15_0.02_200_/_0.1)] focus:border-emerald-500/50 outline-none transition-all text-[oklch(0.15_0.05_200)] font-bold shadow-spatial-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        submitPassword();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordInput((current) => !current)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[oklch(0.40_0.02_200)] hover:text-[oklch(0.15_0.05_200)]"
                    aria-label={showPasswordInput ? 'Hide password' : 'Show password'}
                  >
                    {showPasswordInput ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {passwordError && (
                  <p className="text-sm text-red-500 font-medium flex items-center gap-2">
                    <AlertTriangle size={16} />
                    {passwordError}
                  </p>
                )}
              </div>
              <div className="flex gap-3 mt-6">
                <PrismButton
                  onClick={closePasswordPrompt}
                  className="flex-1 bg-white text-[oklch(0.15_0.05_200)] px-6 py-3 rounded-2xl text-sm font-bold border border-[oklch(0.15_0.02_200_/_0.1)] hover:border-red-500/30 transition-all"
                >
                  Cancel
                </PrismButton>
                <PrismButton
                  onClick={submitPassword}
                  disabled={!passwordInput || loading}
                  className="flex-1 bg-emerald-600 text-white px-6 py-3 rounded-2xl text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed shadow-spatial-sm active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                    </>
                  ) : (
                    'Access'
                  )}
                </PrismButton>
              </div>
            </m.div>
          </div>
        )}
      </AnimatePresence>

      {showJoumpaForm && (
        <PublicJoumpaForm
          onClose={() => setShowJoumpaForm(false)}
          quickAccessSessionId={quickAccessSessionId}
        />
      )}

      {showIrregularityForm && (
        <PublicIrregularityForm
          onClose={() => setShowIrregularityForm(false)}
          quickAccessSessionId={quickAccessSessionId}
        />
      )}

      <AnimatePresence>
        {showComingSoon && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/25 backdrop-blur-sm" onClick={() => setShowComingSoon(false)} />
            <div className="relative w-full max-w-sm rounded-3xl border border-[oklch(0.15_0.02_200_/_0.08)] bg-white p-7 shadow-xl text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 mx-auto">
                <Bot size={22} className="text-amber-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Feature Not Available</h2>
              <p className="text-sm text-gray-500 mb-6">I&apos;m in Charge Virtual Assistant is currently under development. Please check back later.</p>
              <button
                onClick={() => setShowComingSoon(false)}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        )}

        {(loginPromptUrl || pendingLoginCategory) && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/25 backdrop-blur-sm"
              onClick={closeLoginPrompt}
            />
            <m.form
              initial={{ opacity: 0, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.96 }}
              onSubmit={submitLoginPrompt}
              className="relative w-full max-w-md rounded-3xl border border-[oklch(0.15_0.02_200_/_0.08)] bg-white p-7 shadow-spatial-xl"
            >
              <div className="mb-6">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[oklch(0.60_0.18_260_/_0.12)] text-[oklch(0.50_0.18_260)]">
                  <Bot size={22} />
                </div>
                <h3 className="text-xl font-display font-black text-[oklch(0.15_0.05_200)]">
                  Login Diperlukan
                </h3>
                <p className="mt-1 text-sm font-medium text-[oklch(0.40_0.02_200)]">
                  {pendingLoginCategory
                    ? `Gunakan akun Gapura untuk mengakses ${pendingLoginCategory.title}.`
                    : 'Gunakan akun Gapura untuk membuka I\'m in Charge.'}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={loginEmail}
                    onChange={(event) => setLoginEmail(event.target.value)}
                    className="w-full rounded-2xl border border-[oklch(0.15_0.02_200_/_0.1)] bg-[oklch(0.98_0.01_200)] px-4 py-3 text-sm font-bold text-[oklch(0.15_0.05_200)] outline-none transition focus:border-emerald-500/50 focus:bg-white"
                    placeholder="email@company.com"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={loginPassword}
                      onChange={(event) => setLoginPassword(event.target.value)}
                      className="w-full rounded-2xl border border-[oklch(0.15_0.02_200_/_0.1)] bg-[oklch(0.98_0.01_200)] px-4 py-3 pr-12 text-sm font-bold text-[oklch(0.15_0.05_200)] outline-none transition focus:border-emerald-500/50 focus:bg-white"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword((current) => !current)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700"
                      aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                    >
                      {showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {loginError && (
                  <p className="flex items-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-sm font-bold text-red-600">
                    <AlertTriangle size={16} />
                    {loginError}
                  </p>
                )}
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <PrismButton
                  type="button"
                  onClick={closeLoginPrompt}
                  disabled={loginLoading}
                  className="bg-white px-5 py-3 text-sm font-bold text-[oklch(0.15_0.05_200)] border border-[oklch(0.15_0.02_200_/_0.1)]"
                >
                  Batal
                </PrismButton>
                <PrismButton
                  type="submit"
                  disabled={!loginEmail || !loginPassword || loginLoading}
                  className="bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-spatial-sm"
                >
                  {loginLoading ? <Loader2 size={16} className="animate-spin" /> : 'Masuk'}
                </PrismButton>
              </div>
            </m.form>
          </div>
        )}
      </AnimatePresence>
    </div>
    </LazyMotion>
  );
}
