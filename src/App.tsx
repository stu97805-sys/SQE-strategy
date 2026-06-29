import React, { useEffect, useMemo, useState } from 'react';
import { 
  LayoutDashboard, 
  PlusCircle, 
  FileText, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ChevronRight, 
  Search,
  ArrowLeft,
  Loader2,
  Download,
  Share2,
  ShieldAlert,
  BarChart3,
  Factory,
  Package,
  Activity,
  Copy,
  Check,
  Edit3,
  Save,
  FileUp,
  X,
  Presentation,
  FileDown,
  Trash2,
  Archive,
  MessageSquare,
  Sparkles,
  Eye,
  TableProperties,
  Upload,
  CalendarDays
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import ReactMarkdown from 'react-markdown';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import pptxgen from 'pptxgenjs';
import { QualityCase, Severity, ReportType, QualityCaseFile, ReferenceDoc, SortingCase } from './types';
import { cn } from './utils';
import { createCase, createReferenceDoc, deleteCase, deleteCaseReport, deleteReferenceDoc, fetchBootstrap, importHistoricalCase, importSortingCases, improveCaseReport, updateCase, updateCaseReport } from './api';
import { prepareCaseFilesForSubmission, prepareHistoricalCaseImport, prepareSortingWorkbookForAi, prepareCaseFile, prepareReferenceDoc } from './fileProcessing';

// Mock initial data
const INITIAL_STANDARDS: ReferenceDoc[] = [
  {
    id: 'std-1',
    name: 'Incoming Quality Standard (AQL 0.4)',
    type: 'text/plain',
    content: 'Standard: AQL 0.4. Acceptance Quality Limit is 0.4%. For major defects, zero acceptance is required if the defect rate exceeds the AQL threshold. Sampling plan should follow ISO 2859-1.',
    addedAt: new Date().toISOString()
  }
];

const INITIAL_CASES: QualityCase[] = [
  {
    id: '1',
    supplier: 'TechCore Electronics',
    partName: 'Main PCB Rev B',
    defectRate: 2.4,
    defectPhenomenon: 'Solder bridge on IC7 pins',
    affectedBatches: 'LOT-2024-03-A',
    severity: 'High',
    date: '2024-03-15',
    status: 'Complete',
    reportType: '8D',
    report: '# 8D Report: Solder Bridge Issue\n\n## D1: Team Formation\nSQE Team, Production Lead, Supplier QA Manager.\n\n## D2: Problem Description\nSolder bridging observed on IC7 pins during AOI inspection.\n\n## D3: Interim Containment\n100% manual inspection for current lot.\n\n## D4: Root Cause Analysis\nStencil aperture size too large for fine-pitch component.\n\n## D5: Chosen Permanent Corrective Actions\nRedesign stencil with reduced aperture.\n\n## D6: Implemented Permanent Corrective Actions\nNew stencil deployed on Line 3.\n\n## D7: Actions to Prevent Recurrence\nUpdate design guidelines for fine-pitch parts.\n\n## D8: Team Recognition\nIssue resolved within 48 hours.'
  },
  {
    id: '3',
    supplier: 'MetalMaster CNC',
    partName: 'Aluminum Housing A1',
    defectRate: 1.5,
    defectPhenomenon: 'Dimensional out of tolerance (0.05mm over)',
    affectedBatches: 'CNC-2024-03-C',
    severity: 'Medium',
    date: '2024-03-17',
    status: 'Complete',
    reportType: '8D',
    industry: 'CNC',
    report: '# 8D Report: Dimensional Deviation\n\n## D1: Team Formation\nSQE lead, CNC process engineer, supplier quality manager, and production supervisor.\n\n## D2: Problem Description\nCustomer assembly reported interference caused by a critical bore diameter exceeding tolerance by up to 0.05 mm on Aluminum Housing A1.\n\n## D3: Interim Containment\nBlocked the affected lot, performed 100% CMM recheck, and sorted suspect inventory before shipment.\n\n## D4: Root Cause Analysis\nFinishing cutter wear was not offset in time, and the tool life monitoring function had been disabled on the machine.\n\n## D5: Permanent Corrective Actions\nRe-enable tool life monitoring, enforce cutter replacement limits, and add in-process probing compensation.\n\n## D6: Implementation and Validation\nUpdated CNC parameters, replaced worn tools, and verified the next 50 samples were within tolerance.\n\n## D7: Prevent Recurrence\nAdded go/no-go gauge checks at shipping inspection and updated preventive maintenance controls.\n\n## D8: Team Recognition\nThe cross-functional team restored dimensional stability and protected customer production continuity.'
  }
];

const END_TO_END_DATA = [
  { stage: 'Supplier FQC', rate: 98.5, loss: 1.5, color: '#4F46E5' },
  { stage: 'Supplier SI', rate: 99.2, loss: 0.8, color: '#6366F1' },
  { stage: 'Client IQA', rate: 97.8, loss: 2.2, color: '#818CF8' },
  { stage: 'Sorting', rate: 99.5, loss: 0.5, color: '#A5B4FC' },
  { stage: 'Production Line', rate: 96.5, loss: 3.5, color: '#C7D2FE' },
];

const CNC_DEFECT_DISTRIBUTION = [
  { name: 'Dimensions', value: 45, color: '#4F46E5' },
  { name: 'Surface Finish', value: 25, color: '#10B981' },
  { name: 'Burrs/Sharp Edges', value: 15, color: '#F59E0B' },
  { name: 'Tool Marks', value: 10, color: '#EF4444' },
  { name: 'Anodizing/Plating', value: 5, color: '#8B5CF6' },
];

const SEVERITY_COLORS = {
  Low: 'bg-blue-100 text-blue-700 border-blue-200',
  Medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  High: 'bg-orange-100 text-orange-700 border-orange-200',
  Critical: 'bg-red-100 text-red-700 border-red-200'
};

const STATUS_ICONS = {
  Tracking: <Clock className="w-4 h-4 text-amber-500" />,
  Analyzing: <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />,
  Complete: <CheckCircle2 className="w-4 h-4 text-green-500" />
};

type TrendRange = 'week' | 'month' | 'quarter' | 'halfYear';

const TREND_RANGE_OPTIONS: Array<{ value: TrendRange; label: string }> = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'halfYear', label: 'Half Year' },
];

function calculateSortingRatePercent(sortingQty: number, ngQty: number) {
  if (!sortingQty || sortingQty <= 0) {
    return 0;
  }

  return (ngQty / sortingQty) * 100;
}

function calculateSortingDppm(sortingQty: number, ngQty: number) {
  if (!sortingQty || sortingQty <= 0) {
    return 0;
  }

  return (ngQty / sortingQty) * 1_000_000;
}

function simplifyDefectPhenomenon(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const separators = [' - ', ' – ', ' — ', ':', '：', ';', '；', ',', '，', '(', '（', '\n'];
  for (const separator of separators) {
    const [head] = trimmed.split(separator);
    if (head?.trim()) {
      return head.trim();
    }
  }

  return trimmed;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function startOfWeek(date: Date) {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return startOfDay(addDays(date, diff));
}

function startOfQuarter(date: Date) {
  return new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1);
}

function formatTrendLabel(date: Date, range: TrendRange) {
  if (range === 'week') {
    return date.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
  }

  if (range === 'month') {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  if (range === 'quarter') {
    return date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
  }

  return date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
}

function buildDateBuckets(range: TrendRange, now = new Date()) {
  if (range === 'week') {
    const today = startOfDay(now);
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(today, index - 6);
      return {
        key: date.toISOString().split('T')[0],
        start: date,
        end: addDays(date, 1),
        name: formatTrendLabel(date, range),
      };
    });
  }

  if (range === 'month') {
    const start = startOfWeek(now);
    return Array.from({ length: 5 }, (_, index) => {
      const bucketStart = addDays(start, index * 7);
      return {
        key: bucketStart.toISOString().split('T')[0],
        start: bucketStart,
        end: addDays(bucketStart, 7),
        name: formatTrendLabel(bucketStart, range),
      };
    });
  }

  if (range === 'quarter') {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return Array.from({ length: 3 }, (_, index) => {
      const bucketStart = addMonths(monthStart, index - 2);
      return {
        key: `${bucketStart.getFullYear()}-${bucketStart.getMonth()}`,
        start: bucketStart,
        end: addMonths(bucketStart, 1),
        name: formatTrendLabel(bucketStart, range),
      };
    });
  }

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return Array.from({ length: 6 }, (_, index) => {
    const bucketStart = addMonths(monthStart, index - 5);
    return {
      key: `${bucketStart.getFullYear()}-${bucketStart.getMonth()}`,
      start: bucketStart,
      end: addMonths(bucketStart, 1),
      name: formatTrendLabel(bucketStart, range),
    };
  });
}

function parseIsoDate(dateText: string) {
  const [year, month, day] = dateText.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export default function App() {
  const [selectedDocument, setSelectedDocument] = useState<{
    name: string;
    type: string;
    content?: string;
    extractedText?: string;
    sourceLabel?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedReport, setEditedReport] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<QualityCaseFile[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'cases' | 'sorting' | 'new' | 'standards'>('dashboard');
  const [cases, setCases] = useState<QualityCase[]>([]);
  const [referenceDocs, setReferenceDocs] = useState<ReferenceDoc[]>([]);
  const [sortingCases, setSortingCases] = useState<SortingCase[]>([]);
  const [selectedCase, setSelectedCase] = useState<QualityCase | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isArchivingReport, setIsArchivingReport] = useState(false);
  const [isImprovingReport, setIsImprovingReport] = useState(false);
  const [isUpdatingEvidence, setIsUpdatingEvidence] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [uiError, setUiError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [referenceSearchQuery, setReferenceSearchQuery] = useState('');
  const [dateSortOrder, setDateSortOrder] = useState<'desc' | 'asc'>('desc');
  const [issueTrendRange, setIssueTrendRange] = useState<TrendRange>('halfYear');
  const [sortingTrendRange, setSortingTrendRange] = useState<TrendRange>('halfYear');
  const [selectedSortingYear, setSelectedSortingYear] = useState<'2024' | '2025' | '2026'>('2026');
  const [chatInput, setChatInput] = useState('');
  const [reportChat, setReportChat] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [editingCaseDateId, setEditingCaseDateId] = useState<string | null>(null);
  const [editingCaseDefectRateId, setEditingCaseDefectRateId] = useState<string | null>(null);
  const [isUploadingSorting, setIsUploadingSorting] = useState(false);
  const [isImportingHistoricalCase, setIsImportingHistoricalCase] = useState(false);
  const [userName, setUserName] = useState('John Doe');
  const [isEditingUserName, setIsEditingUserName] = useState(false);
  const [userNameDraft, setUserNameDraft] = useState('John Doe');

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const payload = await fetchBootstrap();
        if (!isMounted) return;
        setCases(payload.cases);
        setReferenceDocs(payload.referenceDocs);
        setSortingCases(payload.sortingCases);
      } catch (error) {
        if (!isMounted) return;
        setUiError(error instanceof Error ? error.message : 'Failed to load data from Cloudflare.');
      } finally {
        if (isMounted) {
          setIsBootstrapping(false);
        }
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setReportChat([]);
    setChatInput('');
  }, [selectedCase?.id]);

  useEffect(() => {
    const storedUserName = window.localStorage.getItem('sqe-user-name');
    if (storedUserName?.trim()) {
      setUserName(storedUserName);
      setUserNameDraft(storedUserName);
    }
  }, []);

  const handleCopy = () => {
    const textToCopy = isEditing ? editedReport : selectedCase?.report;
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    try {
      const preparedFiles = await Promise.all(Array.from(files).map((file) => prepareCaseFile(file)));
      setUploadedFiles(prev => [...prev, ...preparedFiles]);
      setUiError('');
    } catch (error) {
      setUiError(error instanceof Error ? error.message : 'Failed to process uploaded evidence files.');
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleIssueDateChange = async (qualityCase: QualityCase, issueDate: string) => {
    try {
      const updatedCase = await updateCase(qualityCase.id, { date: issueDate });
      setCases(prev => prev.map(c => c.id === qualityCase.id ? updatedCase : c));
      setSelectedCase(prev => prev?.id === qualityCase.id ? updatedCase : prev);
      setEditingCaseDateId(null);
      setUiError('');
    } catch (error) {
      setUiError(error instanceof Error ? error.message : 'Failed to update issue date.');
    }
  };

  const handleDefectRateChange = async (qualityCase: QualityCase, defectRateText: string) => {
    const defectRate = Number(defectRateText);

    if (!defectRateText.trim() || Number.isNaN(defectRate) || defectRate < 0) {
      setUiError('Please enter a valid defect rate.');
      return;
    }

    try {
      const updatedCase = await updateCase(qualityCase.id, { defectRate });
      setCases(prev => prev.map(c => c.id === qualityCase.id ? updatedCase : c));
      setSelectedCase(prev => prev?.id === qualityCase.id ? updatedCase : prev);
      setEditingCaseDefectRateId(null);
      setUiError('');
    } catch (error) {
      setUiError(error instanceof Error ? error.message : 'Failed to update defect rate.');
    }
  };

  const persistCaseFiles = async (qualityCase: QualityCase, files: QualityCaseFile[]) => {
    try {
      setIsUpdatingEvidence(true);
      const updatedCase = await updateCase(qualityCase.id, { files });
      setCases(prev => prev.map(c => c.id === qualityCase.id ? updatedCase : c));
      setSelectedCase(prev => prev?.id === qualityCase.id ? updatedCase : prev);
      setUiError('');
    } catch (error) {
      setUiError(error instanceof Error ? error.message : 'Failed to update attached evidence.');
    } finally {
      setIsUpdatingEvidence(false);
    }
  };

  const handleAddCaseEvidence = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !selectedCase) return;

    try {
      const preparedFiles = await Promise.all(Array.from(files).map((file) => prepareCaseFile(file)));
      await persistCaseFiles(selectedCase, [...(selectedCase.files ?? []), ...preparedFiles]);
    } catch (error) {
      setUiError(error instanceof Error ? error.message : 'Failed to add attached evidence.');
    } finally {
      e.target.value = '';
    }
  };

  const handleRemoveCaseEvidence = async (index: number) => {
    if (!selectedCase) return;
    const nextFiles = (selectedCase.files ?? []).filter((_, fileIndex) => fileIndex !== index);
    await persistCaseFiles(selectedCase, nextFiles);
  };

  const handleStatusChange = async (qualityCase: QualityCase, status: 'Tracking' | 'Complete') => {
    try {
      const updatedCase = await updateCase(qualityCase.id, { status });
      setCases(prev => prev.map(c => c.id === qualityCase.id ? updatedCase : c));
      setSelectedCase(prev => prev?.id === qualityCase.id ? updatedCase : prev);
      setUiError('');
    } catch (error) {
      setUiError(error instanceof Error ? error.message : 'Failed to update case status.');
    }
  };

  const handleSaveUserName = () => {
    const nextName = userNameDraft.trim() || 'John Doe';
    setUserName(nextName);
    setUserNameDraft(nextName);
    window.localStorage.setItem('sqe-user-name', nextName);
    setIsEditingUserName(false);
  };

  const handleExportPDF = async () => {
    if (!selectedCase) return;
    const element = document.getElementById('report-content');
    if (!element) return;

    const canvas = await html2canvas(element);
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`${selectedCase.supplier}_${selectedCase.reportType}_Report.pdf`);
  };

  const handleExportPPT = () => {
    if (!selectedCase) return;
    const pres = new pptxgen();
    
    // Title Slide
    const slide1 = pres.addSlide();
    slide1.addText(`${selectedCase.reportType} Quality Report`, { x: 1, y: 1, w: '80%', h: 1, fontSize: 36, bold: true, color: '363636' });
    slide1.addText(`Supplier: ${selectedCase.supplier}`, { x: 1, y: 2, w: '80%', h: 0.5, fontSize: 24, color: '666666' });
    slide1.addText(`Issue Date: ${selectedCase.date}`, { x: 1, y: 2.5, w: '80%', h: 0.5, fontSize: 18, color: '999999' });

    // Content Slides (split by sections)
    const sections = (isEditing ? editedReport : selectedCase.report || '').split('##');
    sections.forEach((section, i) => {
      if (!section.trim()) return;
      const slide = pres.addSlide();
      const lines = section.trim().split('\n');
      const title = lines[0].replace(/#/g, '').trim();
      const content = lines.slice(1).join('\n').trim();
      
      slide.addText(title, { x: 0.5, y: 0.5, w: '90%', h: 0.5, fontSize: 24, bold: true, color: '4F46E5' });
      slide.addText(content, { x: 0.5, y: 1.2, w: '90%', h: '70%', fontSize: 14, color: '333333', align: 'left', valign: 'top' });
    });

    pres.writeFile({ fileName: `${selectedCase.supplier}_Report.pptx` });
  };

  const handleSendToGamma = () => {
    const reportText = isEditing ? editedReport : selectedCase?.report;
    if (!reportText) return;
    
    const gammaPrompt = `Please create a professional presentation based on this quality report:\n\n${reportText}`;
    navigator.clipboard.writeText(gammaPrompt);
    alert("Gamma prompt copied to clipboard! You can now paste this into Gamma's 'Generate with AI' feature.");
    window.open('https://gamma.app/create', '_blank');
  };

  const handleSaveEdit = async () => {
    if (!selectedCase) return;

    try {
      const updatedCase = await updateCaseReport(selectedCase.id, editedReport);
      setCases(prev => prev.map(c =>
        c.id === selectedCase.id ? updatedCase : c
      ));
      setSelectedCase(updatedCase);
      setIsEditing(false);
      setUiError('');
    } catch (error) {
      setUiError(error instanceof Error ? error.message : 'Failed to save report changes.');
    }
  };

  const handleDeleteReport = async () => {
    if (!selectedCase) return;
    const confirmed = window.confirm(`Delete the full report for ${selectedCase.supplier} / ${selectedCase.partName}?`);
    if (!confirmed) return;

    try {
      const updatedCase = await deleteCaseReport(selectedCase.id);
      setCases(prev => prev.map(c =>
        c.id === selectedCase.id ? updatedCase : c
      ));
      setSelectedCase(updatedCase);
      setEditedReport('');
      setIsEditing(false);
      setUiError('');
    } catch (error) {
      setUiError(error instanceof Error ? error.message : 'Failed to delete report.');
    }
  };

  const handleDeleteCase = async (qualityCase: QualityCase) => {
    const confirmed = window.confirm(`Delete the full quality case for ${qualityCase.supplier} / ${qualityCase.partName}? This will also remove the stored report and attachments from D1.`);
    if (!confirmed) return;

    try {
      await deleteCase(qualityCase.id);
      setCases(prev => prev.filter(c => c.id !== qualityCase.id));
      setSelectedCase(prev => prev?.id === qualityCase.id ? null : prev);
      setIsEditing(false);
      setEditedReport('');
      setUiError('');
    } catch (error) {
      setUiError(error instanceof Error ? error.message : 'Failed to delete quality case.');
    }
  };

  const openReferencePreview = (doc: ReferenceDoc) => {
    setSelectedDocument({
      name: doc.name,
      type: doc.type,
      content: doc.content,
      extractedText: doc.extractedText,
      sourceLabel: doc.sourceKind ? `Reference · ${doc.sourceKind}` : 'Reference',
    });
  };

  const base64ToBlob = (base64: string, mimeType: string) => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i += 1) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
  };

  const handleOpenStoredDocument = (name: string, type: string, content?: string) => {
    if (!content) {
      setUiError('This archived file does not include the original binary, so it cannot be reopened as the original document.');
      return;
    }

    const blob = base64ToBlob(content, type);
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  };

  const handleDownloadStoredDocument = (name: string, type: string, content?: string) => {
    if (!content) {
      setUiError('This archived file does not include the original binary, so it cannot be downloaded as the original document.');
      return;
    }

    const blob = base64ToBlob(content, type);
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  };

  const openCaseFilePreview = (file: QualityCaseFile) => {
    setSelectedDocument({
      name: file.name,
      type: file.type,
      content: file.data,
      extractedText: file.extractedText,
      sourceLabel: 'Case Attachment',
    });
  };

  const handleArchiveCurrentReport = async () => {
    if (!selectedCase?.report?.trim()) return;

    try {
      setIsArchivingReport(true);
      const archivedDoc = await createReferenceDoc({
        name: `[Manual][Final Report] ${selectedCase.supplier} - ${selectedCase.partName} - ${selectedCase.date}.md`,
        type: 'text/markdown',
        content: selectedCase.report,
        extractedText: selectedCase.report,
        sourceCaseId: selectedCase.id,
        sourceKind: 'generated_report',
        autoArchived: true,
      });
      setReferenceDocs(prev => [archivedDoc, ...prev]);
      setUiError('');
    } catch (error) {
      setUiError(error instanceof Error ? error.message : 'Failed to archive current report.');
    } finally {
      setIsArchivingReport(false);
    }
  };

  const handleArchiveUploadedReport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !selectedCase) return;

    try {
      setIsArchivingReport(true);
      const preparedDocs = await Promise.all(Array.from(files).map((file) => prepareReferenceDoc(file)));
      const createdDocs = await Promise.all(preparedDocs.map((doc) =>
        createReferenceDoc({
          ...doc,
          name: `[Manual][Uploaded Final Report] ${selectedCase.supplier} - ${selectedCase.partName} - ${doc.name}`,
          sourceCaseId: selectedCase.id,
          sourceKind: 'generated_report',
          autoArchived: true,
        })
      ));
      setReferenceDocs(prev => [...createdDocs.reverse(), ...prev]);
      setUiError('');
    } catch (error) {
      setUiError(error instanceof Error ? error.message : 'Failed to archive uploaded final report.');
    } finally {
      setIsArchivingReport(false);
      e.target.value = '';
    }
  };

  const handleImproveReport = async () => {
    if (!selectedCase || !chatInput.trim()) return;

    const nextMessages = [...reportChat, { role: 'user' as const, content: chatInput.trim() }];
    setReportChat(nextMessages);
    setChatInput('');
    setIsImprovingReport(true);

    try {
      const payload = await improveCaseReport(selectedCase.id, nextMessages);
      setReportChat(prev => [...prev, { role: 'assistant', content: payload.assistantMessage }]);
      setCases(prev => prev.map(c => c.id === payload.updatedCase.id ? payload.updatedCase : c));
      setSelectedCase(payload.updatedCase);
      setEditedReport(payload.updatedCase.report || '');
      setIsEditing(false);
      setUiError('');
    } catch (error) {
      setReportChat(prev => prev.slice(0, -1));
      setUiError(error instanceof Error ? error.message : 'Failed to improve report with AI.');
    } finally {
      setIsImprovingReport(false);
    }
  };

  const handleStandardUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    try {
      const preparedDocs = await Promise.all(Array.from(files).map((file) => prepareReferenceDoc(file)));
      const createdDocs = await Promise.all(preparedDocs.map((doc) => createReferenceDoc(doc)));
      setReferenceDocs(prev => [...createdDocs.reverse(), ...prev]);
      setUiError('');
    } catch (error) {
      setUiError(error instanceof Error ? error.message : 'Failed to upload reference document.');
    }
  };

  const removeStandard = async (id: string) => {
    try {
      await deleteReferenceDoc(id);
      setReferenceDocs(prev => prev.filter(doc => doc.id !== id));
      setUiError('');
    } catch (error) {
      setUiError(error instanceof Error ? error.message : 'Failed to delete reference document.');
    }
  };

  const handleSortingUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingSorting(true);
      const workbookPayload = await prepareSortingWorkbookForAi(file);
      const updatedSortingCases = await importSortingCases({
        workbookText: workbookPayload.workbookText,
        sourceFileName: workbookPayload.sourceFileName,
      });
      setSortingCases(updatedSortingCases);
      setUiError('');
      setActiveTab('sorting');
    } catch (error) {
      setUiError(error instanceof Error ? error.message : 'Failed to import sorting Excel.');
    } finally {
      setIsUploadingSorting(false);
      e.target.value = '';
    }
  };

  const handleHistoricalCaseUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsImportingHistoricalCase(true);
      const preparedDoc = await prepareHistoricalCaseImport(file);
      const importedCase = await importHistoricalCase({
        name: preparedDoc.name,
        type: preparedDoc.type,
        data: preparedDoc.data,
        extractedText: preparedDoc.extractedText,
      });
      setCases(prev => [importedCase, ...prev]);
      setUiError('');
      setActiveTab('cases');
    } catch (error) {
      setUiError(error instanceof Error ? error.message : 'Failed to import historical quality case.');
    } finally {
      setIsImportingHistoricalCase(false);
      e.target.value = '';
    }
  };

  // Form State
  const [formData, setFormData] = useState({
    supplier: '',
    partName: '',
    issueDate: new Date().toISOString().split('T')[0],
    defectRate: '',
    defectPhenomenon: '',
    affectedBatches: '',
    severity: 'Medium' as Severity,
    reportType: 'Simple' as ReportType,
    industry: 'General' as 'General' | 'CNC',
    reportReference: ''
  });

  const filteredCases = useMemo(() => {
    return [...cases]
      .filter(c => 
        c.supplier.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.partName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.defectPhenomenon.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => {
        const left = new Date(a.date).getTime();
        const right = new Date(b.date).getTime();
        return dateSortOrder === 'asc' ? left - right : right - left;
      });
  }, [cases, searchQuery, dateSortOrder]);

  const filteredReferenceDocs = useMemo(() => {
    const keyword = referenceSearchQuery.trim().toLowerCase();
    if (!keyword) return referenceDocs;

    return referenceDocs.filter((doc) =>
      [
        doc.name,
        doc.sourceCaseId,
        doc.sourceKind,
        doc.extractedText,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword))
    );
  }, [referenceDocs, referenceSearchQuery]);

  const stats = useMemo(() => {
    const total = cases.length;
    const completed = cases.filter(c => c.status === 'Complete').length;
    const avgDefect = cases.reduce((acc, c) => acc + c.defectRate, 0) / total || 0;
    const critical = cases.filter(c => c.severity === 'Critical' || c.severity === 'High').length;
    
    return { total, completed, avgDefect: avgDefect.toFixed(2), critical };
  }, [cases]);

  const issueTrendData = useMemo(() => {
    const buckets = buildDateBuckets(issueTrendRange);

    return buckets.map((bucket) => ({
      name: bucket.name,
      issues: cases.filter((item) => {
        const itemDate = parseIsoDate(item.date);
        return itemDate >= bucket.start && itemDate < bucket.end;
      }).length,
    }));
  }, [cases, issueTrendRange]);

  const sortingTrendData = useMemo(() => {
    const buckets = buildDateBuckets(sortingTrendRange);

    return buckets.map((bucket) => {
      const rows = sortingCases.filter((item) => {
        const itemDate = parseIsoDate(item.date);
        return itemDate >= bucket.start && itemDate < bucket.end;
      });
      const sortingQty = rows.reduce((sum, row) => sum + row.sortingQty, 0);
      const ngQty = rows.reduce((sum, row) => sum + row.ngQty, 0);

      return {
        name: bucket.name,
        dppm: Number(calculateSortingDppm(sortingQty, ngQty).toFixed(0)),
        sortingQty,
        ngQty,
      };
    });
  }, [sortingCases, sortingTrendRange]);

  const filteredSortingCases = useMemo(() => {
    return sortingCases.filter((row) => row.date.startsWith(selectedSortingYear));
  }, [selectedSortingYear, sortingCases]);

  const sortingSummary = useMemo(() => {
    const totalSortingQty = filteredSortingCases.reduce((sum, row) => sum + row.sortingQty, 0);
    const totalNgQty = filteredSortingCases.reduce((sum, row) => sum + row.ngQty, 0);

    return {
      totalSortingQty,
      totalNgQty,
      defectRatePercent: calculateSortingRatePercent(totalSortingQty, totalNgQty),
    };
  }, [filteredSortingCases]);

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setUiError('');
    const submissionFiles = prepareCaseFilesForSubmission(uploadedFiles);

    const newCase: QualityCase = {
      id: Math.random().toString(36).substr(2, 9),
      supplier: formData.supplier,
      partName: formData.partName,
      defectRate: parseFloat(formData.defectRate),
      defectPhenomenon: formData.defectPhenomenon,
      affectedBatches: formData.affectedBatches,
      severity: formData.severity,
      date: formData.issueDate,
      status: 'Analyzing',
      reportType: formData.reportType,
      reportReference: formData.reportReference.trim() || undefined,
      industry: formData.industry,
      files: submissionFiles
    };

    setActiveTab('cases');

    try {
      setCases(prev => [{ ...newCase, status: 'Analyzing' }, ...prev]);
      const createdCase = await createCase(newCase);
      setCases(prev => prev.map(c =>
        c.id === newCase.id ? createdCase : c
      ));
    } catch (error) {
      setCases(prev => prev.map(c => 
        c.id === newCase.id ? { ...c, status: 'Tracking', report: "Error generating report with OpenAI." } : c
      ));
      setUiError(error instanceof Error ? error.message : 'Failed to create case.');
    } finally {
      setIsGenerating(false);
      setFormData({
        supplier: '',
        partName: '',
        issueDate: new Date().toISOString().split('T')[0],
        defectRate: '',
        defectPhenomenon: '',
        affectedBatches: '',
        severity: 'Medium',
        reportType: 'Simple',
        industry: 'General',
        reportReference: ''
      });
      setUploadedFiles([]);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-900 font-sans">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-slate-200 z-20 hidden md:block">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <ShieldAlert className="text-white w-5 h-5" />
            </div>
            <h1 className="font-bold text-xl tracking-tight">SQE Strategy</h1>
          </div>

          <nav className="space-y-1">
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                activeTab === 'dashboard' ? "bg-indigo-50 text-indigo-700 font-medium" : "text-slate-500 hover:bg-slate-50"
              )}
            >
              <LayoutDashboard className="w-5 h-5" />
              Dashboard
            </button>
            <button 
              onClick={() => setActiveTab('cases')}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                activeTab === 'cases' ? "bg-indigo-50 text-indigo-700 font-medium" : "text-slate-500 hover:bg-slate-50"
              )}
            >
              <FileText className="w-5 h-5" />
              Quality Cases
            </button>
            <button 
              onClick={() => setActiveTab('sorting')}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                activeTab === 'sorting' ? "bg-indigo-50 text-indigo-700 font-medium" : "text-slate-500 hover:bg-slate-50"
              )}
            >
              <TableProperties className="w-5 h-5" />
              Sorting Cases
            </button>
            <button 
              onClick={() => setActiveTab('standards')}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                activeTab === 'standards' ? "bg-indigo-50 text-indigo-700 font-medium" : "text-slate-500 hover:bg-slate-50"
              )}
            >
              <ShieldAlert className="w-5 h-5" />
              Report References
            </button>
            <button 
              onClick={() => setActiveTab('new')}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                activeTab === 'new' ? "bg-indigo-50 text-indigo-700 font-medium" : "text-slate-500 hover:bg-slate-50"
              )}
            >
              <PlusCircle className="w-5 h-5" />
              New Analysis
            </button>
          </nav>
        </div>

        <div className="absolute bottom-0 left-0 w-full p-6 border-t border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
              <span className="text-sm font-bold text-slate-600">
                {userName
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part[0]?.toUpperCase() || '')
                  .join('') || 'JD'}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              {isEditingUserName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={userNameDraft}
                    onChange={(e) => setUserNameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSaveUserName();
                      }
                      if (e.key === 'Escape') {
                        setUserNameDraft(userName);
                        setIsEditingUserName(false);
                      }
                    }}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveUserName}
                    className="rounded-lg bg-indigo-600 p-2 text-white transition-colors hover:bg-indigo-700"
                    aria-label="Save user name"
                  >
                    <Save className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-bold">{userName}</p>
                  <button
                    onClick={() => {
                      setUserNameDraft(userName);
                      setIsEditingUserName(true);
                    }}
                    className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                    aria-label="Edit user name"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>
              )}
              <p className="text-xs text-slate-500">Senior SQE</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="md:ml-64 p-4 md:p-8">
        {uiError && (
          <div className="mx-auto mb-6 max-w-6xl rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {uiError}
          </div>
        )}
        {isBootstrapping && (
          <div className="mx-auto mb-6 max-w-6xl rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
            Syncing data from Cloudflare D1...
          </div>
        )}
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight">Quality Overview</h2>
                  <p className="text-slate-500 mt-1">Real-time supplier performance and defect monitoring.</p>
                </div>
                <button 
                  onClick={() => setActiveTab('new')}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all active:scale-95"
                >
                  <PlusCircle className="w-5 h-5" />
                  New Analysis
                </button>
              </header>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: 'Total Cases', value: stats.total, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: 'Avg Defect Rate', value: `${stats.avgDefect}%`, icon: Activity, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                  { label: 'Critical Issues', value: stats.critical, icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50' },
                  { label: 'Complete', value: stats.completed, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                ].map((stat, i) => (
                  <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mb-4", stat.bg)}>
                      <stat.icon className={cn("w-6 h-6", stat.color)} />
                    </div>
                    <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                    <p className="text-2xl font-bold mt-1">{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="font-bold text-lg">Issue Count Trend</h3>
                      <p className="text-xs text-slate-400">Switch between week, month, quarter, and half-year issue trends</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="inline-flex rounded-xl bg-slate-100 p-1">
                        {TREND_RANGE_OPTIONS.map((option) => (
                          <button
                            key={`issue-${option.value}`}
                            onClick={() => setIssueTrendRange(option.value)}
                            className={cn(
                              'rounded-lg px-3 py-1.5 text-xs font-bold transition-colors',
                              issueTrendRange === option.value
                                ? 'bg-white text-indigo-700 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                            )}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      <CalendarDays className="w-5 h-5 text-indigo-500" />
                    </div>
                  </div>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={issueTrendData}>
                        <defs>
                          <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 12 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 12 }} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                        <Area type="monotone" dataKey="issues" stroke="#4F46E5" strokeWidth={3} fillOpacity={1} fill="url(#colorRate)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="font-bold text-lg">Sorting DPPM Trend</h3>
                      <p className="text-xs text-slate-400">Switch between week, month, quarter, and half-year sorting DPPM</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="inline-flex rounded-xl bg-slate-100 p-1">
                        {TREND_RANGE_OPTIONS.map((option) => (
                          <button
                            key={`sorting-${option.value}`}
                            onClick={() => setSortingTrendRange(option.value)}
                            className={cn(
                              'rounded-lg px-3 py-1.5 text-xs font-bold transition-colors',
                              sortingTrendRange === option.value
                                ? 'bg-white text-emerald-700 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                            )}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      <Upload className="w-5 h-5 text-emerald-500" />
                    </div>
                  </div>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={sortingTrendData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 12 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 12 }} />
                        <Tooltip
                          cursor={{ stroke: '#E2E8F0' }}
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          formatter={(value: number) => [`${Number(value).toLocaleString()} DPPM`, 'DPPM']}
                        />
                        <Line type="monotone" dataKey="dppm" stroke="#10B981" strokeWidth={3} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* End-to-End Tracking & CNC Analysis */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="font-bold text-lg">End-to-End Quality Funnel</h3>
                      <p className="text-xs text-slate-400">Tracking yield from Supplier FQC to Client Line</p>
                    </div>
                    <Activity className="w-5 h-5 text-indigo-500" />
                  </div>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={END_TO_END_DATA} layout="vertical" margin={{ left: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                        <XAxis type="number" domain={[0, 5]} axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                        <YAxis dataKey="stage" type="category" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 11, fontWeight: 600 }} width={100} />
                        <Tooltip 
                          cursor={{fill: '#F8FAFC'}} 
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-white p-3 rounded-xl shadow-xl border border-slate-100">
                                  <p className="font-bold text-slate-900">{payload[0].payload.stage}</p>
                                  <p className="text-sm text-red-600">Defect Rate: {payload[0].value}%</p>
                                  <p className="text-xs text-indigo-500">Yield: {payload[0].payload.rate}%</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="loss" radius={[0, 6, 6, 0]} barSize={30}>
                          {END_TO_END_DATA.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="font-bold text-lg">CNC Defect Distribution</h3>
                      <p className="text-xs text-slate-400">Top failure modes in precision metal CNC</p>
                    </div>
                    <Factory className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={CNC_DEFECT_DISTRIBUTION}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 12 }} />
                        <Tooltip cursor={{fill: '#F8FAFC'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                          {CNC_DEFECT_DISTRIBUTION.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'cases' && (
            <motion.div 
              key="cases"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight">Quality Cases</h2>
                  <p className="text-slate-500 mt-1">Manage and review all supplier quality incidents.</p>
                </div>
                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition-all hover:bg-slate-800">
                    {isImportingHistoricalCase ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {isImportingHistoricalCase ? 'Importing Historical Case...' : 'Import Historical Case'}
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.ppt,.pptx"
                      onChange={handleHistoricalCaseUpload}
                    />
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Search cases..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl w-full md:w-80 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                  <select
                    value={dateSortOrder}
                    onChange={(e) => setDateSortOrder(e.target.value as 'asc' | 'desc')}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  >
                    <option value="desc">Issue Date: Newest First</option>
                    <option value="asc">Issue Date: Oldest First</option>
                  </select>
                </div>
              </header>

              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-bottom border-slate-200">
                      <tr>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Case Info</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Issue Date</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Defect Rate</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Severity</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredCases.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => setSelectedCase(c)}>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                                <Factory className="w-5 h-5 text-slate-500" />
                              </div>
                              <div>
                                <p className="font-bold text-slate-900">{simplifyDefectPhenomenon(c.defectPhenomenon)}</p>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm text-slate-500">{c.supplier}</p>
                                  <span className="text-slate-300">/</span>
                                  <p className="text-sm text-slate-500">{c.partName}</p>
                                  {c.industry === 'CNC' && (
                                    <span className="px-1.5 py-0.5 bg-slate-100 text-[10px] font-bold text-slate-500 rounded border border-slate-200">CNC</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {editingCaseDateId === c.id ? (
                              <input
                                type="date"
                                defaultValue={c.date}
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                                onBlur={(e) => handleIssueDateChange(c, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleIssueDateChange(c, (e.target as HTMLInputElement).value);
                                  }
                                  if (e.key === 'Escape') {
                                    setEditingCaseDateId(null);
                                  }
                                }}
                                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                              />
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingCaseDateId(c.id);
                                }}
                                className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
                              >
                                {c.date}
                              </button>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {editingCaseDefectRateId === c.id ? (
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                defaultValue={c.defectRate}
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                                onBlur={(e) => handleDefectRateChange(c, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.currentTarget.blur();
                                  }
                                  if (e.key === 'Escape') {
                                    setEditingCaseDefectRateId(null);
                                  }
                                }}
                                className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                              />
                            ) : (
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingCaseDefectRateId(c.id);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setEditingCaseDefectRateId(c.id);
                                  }
                                }}
                                className="inline-flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 transition-colors hover:bg-slate-100"
                              >
                                <span className={cn(
                                  "font-mono font-bold",
                                  c.defectRate > 2 ? "text-red-600" : "text-slate-700"
                                )}>
                                  {c.defectRate}%
                                </span>
                                <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                                  <div 
                                    className={cn(
                                      "h-full rounded-full",
                                      c.defectRate > 2 ? "bg-red-500" : "bg-indigo-500"
                                    )}
                                    style={{ width: `${Math.min(c.defectRate * 10, 100)}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className={cn("px-3 py-1 rounded-full text-xs font-bold border", SEVERITY_COLORS[c.severity])}>
                              {c.severity}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {c.status === 'Analyzing' ? (
                              <div className="flex items-center gap-2 text-sm font-medium">
                                {STATUS_ICONS[c.status]}
                                {c.status}
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                {STATUS_ICONS[c.status]}
                                <select
                                  value={c.status}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => handleStatusChange(c, e.target.value as 'Tracking' | 'Complete')}
                                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                                >
                                  <option value="Tracking">Tracking</option>
                                  <option value="Complete">Complete</option>
                                </select>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteCase(c);
                                }}
                                className="p-2 hover:bg-red-50 rounded-lg transition-colors text-red-600"
                                aria-label={`Delete case ${c.supplier} ${c.partName}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                              <button className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
                                <ChevronRight className="w-5 h-5 text-slate-400" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'sorting' && (
            <motion.div
              key="sorting"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight">Sorting Cases</h2>
                  <p className="mt-1 text-slate-500">Upload sorting Excel records and let AI fill in date, sorting quantity, NG quantity, LF lot No., PN, and ASE RT/SCH.</p>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-medium text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700">
                  {isUploadingSorting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                  {isUploadingSorting ? 'Importing...' : 'Upload Sorting Excel'}
                  <input
                    type="file"
                    className="hidden"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleSortingUpload}
                  />
                </label>
              </header>

              <div className="inline-flex rounded-2xl bg-slate-100 p-1">
                {(['2024', '2025', '2026'] as const).map((year) => (
                  <button
                    key={year}
                    onClick={() => setSelectedSortingYear(year)}
                    className={cn(
                      'rounded-xl px-4 py-2 text-sm font-bold transition-colors',
                      selectedSortingYear === year
                        ? 'bg-white text-indigo-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    )}
                  >
                    {year}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <p className="text-sm font-medium text-slate-500">Uploaded Rows</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">{filteredSortingCases.length}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <p className="text-sm font-medium text-slate-500">Sorting Defect Rate</p>
                  <p className="mt-2 text-3xl font-bold text-emerald-600">
                    {filteredSortingCases.length ? `${sortingSummary.defectRatePercent.toFixed(2)}%` : '0.00%'}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <p className="text-sm font-medium text-slate-500">Total NG Qty</p>
                  <p className="mt-2 text-3xl font-bold text-red-600">{sortingSummary.totalNgQty}</p>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="border-b border-slate-200 bg-slate-50">
                      <tr>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Date</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Sorting Qty</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">NG Qty</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Defect Rate</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">LF Lot No.</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">PN</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">ASE RT/SCH</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredSortingCases.map((row) => {
                        const defectRatePercent = calculateSortingRatePercent(row.sortingQty, row.ngQty);

                        return (
                        <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-6 py-4 font-medium text-slate-900">{row.date}</td>
                          <td className="px-6 py-4 text-slate-700">{row.sortingQty}</td>
                          <td className="px-6 py-4 text-slate-700">{row.ngQty}</td>
                          <td className="px-6 py-4">
                            <span
                              className={cn(
                                "rounded-full px-3 py-1 text-xs font-bold",
                                defectRatePercent > 0.4 ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
                              )}
                            >
                              {defectRatePercent.toFixed(2)}%
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500">{row.lfLotNo || '-'}</td>
                          <td className="px-6 py-4 text-sm text-slate-500">{row.pn || 'NA'}</td>
                          <td className="px-6 py-4 text-sm text-slate-500">{row.aseRtSch || '-'}</td>
                        </tr>
                      )})}
                      {filteredSortingCases.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                            No sorting data uploaded for {selectedSortingYear} yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'standards' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-8 max-w-5xl mx-auto"
          >
            <header className="mb-8">
              <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Report Reference Library</h2>
              <p className="text-slate-500">Upload partial reports, slides, images, or text notes for AI to reuse as future report references.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-2 space-y-6">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <div className="flex min-w-0 flex-1 flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="font-bold text-slate-900 flex items-center gap-2">
                          <ShieldAlert className="w-5 h-5 text-indigo-600" />
                          Stored References
                        </h3>
                      </div>
                      <div className="flex flex-col gap-3 md:flex-row md:items-center">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            value={referenceSearchQuery}
                            onChange={(e) => setReferenceSearchQuery(e.target.value)}
                            placeholder="Search references..."
                            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 md:w-72"
                          />
                        </div>
                        <label className="cursor-pointer bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all flex items-center gap-2">
                          <PlusCircle className="w-4 h-4" /> Add Reference
                          <input type="file" className="hidden" multiple onChange={handleStandardUpload} accept="image/*,.txt,.md,.csv,.ppt,.pptx,.pdf" />
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {filteredReferenceDocs.map((doc) => (
                      <div key={doc.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                            <FileText className="w-5 h-5 text-indigo-600" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{doc.name}</p>
                            <p className="text-xs text-slate-500">
                              Added on {new Date(doc.addedAt).toLocaleDateString()}
                              {doc.sourceCaseId ? ` · Linked to case ${doc.sourceCaseId}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openReferencePreview(doc)}
                            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDownloadStoredDocument(doc.name, doc.type, doc.content)}
                            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
                          >
                            <Download className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => removeStandard(doc.id)}
                            className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {filteredReferenceDocs.length === 0 && (
                      <div className="p-12 text-center text-slate-400">
                        {referenceSearchQuery ? 'No matching reference files found.' : 'No reference files added yet.'}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-xl shadow-indigo-100">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    AI Reference Logic
                  </h3>
                  <p className="text-indigo-100 text-sm leading-relaxed mb-4">
                    Uploaded reference files are stored in Cloudflare D1. When you generate a new report, AI will use these files together with previously completed reports as reusable examples and guidance.
                  </p>
                  <div className="bg-white/10 rounded-xl p-4 border border-white/20">
                    <p className="text-xs font-bold uppercase tracking-wider mb-2 opacity-70">Supported Reference Types</p>
                    <p className="font-bold">Images, text files, and PPT/PPTX uploads</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
        {activeTab === 'new' && (
          <motion.div 
            key="new"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="max-w-3xl mx-auto"
            >
              <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
                <div className="bg-indigo-600 p-8 text-white">
                  <h2 className="text-2xl font-bold">New Quality Analysis</h2>
                  <p className="text-indigo-100 mt-2">Input defect details to generate an AI-powered response strategy.</p>
                </div>
                
                <form onSubmit={handleCreateCase} className="p-8 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                        <Factory className="w-4 h-4" /> Supplier Name
                      </label>
                      <input 
                        required
                        type="text" 
                        value={formData.supplier}
                        onChange={(e) => setFormData({...formData, supplier: e.target.value})}
                        placeholder="e.g. TechCore Electronics"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                        <Package className="w-4 h-4" /> Part Name / Number
                      </label>
                      <input 
                        required
                        type="text" 
                        value={formData.partName}
                        onChange={(e) => setFormData({...formData, partName: e.target.value})}
                        placeholder="e.g. PCB-A-102"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <Clock className="w-4 h-4" /> Issue Date
                    </label>
                    <input
                      required
                      type="date"
                      value={formData.issueDate}
                      onChange={(e) => setFormData({...formData, issueDate: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                        <Activity className="w-4 h-4" /> Defect Rate (%)
                      </label>
                      <input 
                        required
                        type="number" 
                        step="0.01"
                        value={formData.defectRate}
                        onChange={(e) => setFormData({...formData, defectRate: e.target.value})}
                        placeholder="e.g. 2.5"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      />
                      <p className="text-sm leading-relaxed text-slate-500">
                        如果說反饋的數量就一顆不良在那批次，一lot就是六萬，六萬分之一大概就是0.001%。
                      </p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                        <Clock className="w-4 h-4" /> Affected Batches
                      </label>
                      <input 
                        required
                        type="text" 
                        value={formData.affectedBatches}
                        onChange={(e) => setFormData({...formData, affectedBatches: e.target.value})}
                        placeholder="e.g. LOT-2024-03-A"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" /> Defect Phenomenon
                    </label>
                    <textarea 
                      required
                      value={formData.defectPhenomenon}
                      onChange={(e) => setFormData({...formData, defectPhenomenon: e.target.value})}
                      placeholder="Describe the issue in detail..."
                      rows={4}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Severity Level</label>
                    <div className="grid grid-cols-4 gap-2">
                      {(['Low', 'Medium', 'High', 'Critical'] as Severity[]).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setFormData({...formData, severity: s})}
                          className={cn(
                            "px-4 py-2 rounded-xl text-sm font-bold border transition-all",
                            formData.severity === s 
                              ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100" 
                              : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300"
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Industry Context</label>
                      <div className="grid grid-cols-2 gap-2">
                        {(['General', 'CNC'] as const).map((i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setFormData({...formData, industry: i})}
                            className={cn(
                              "px-4 py-2 rounded-xl text-sm font-bold border transition-all",
                              formData.industry === i 
                                ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100" 
                                : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300"
                            )}
                          >
                            {i}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Report Type</label>
                      <div className="grid grid-cols-2 gap-2">
                        {(['Simple', '8D'] as ReportType[]).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setFormData({...formData, reportType: t})}
                            className={cn(
                              "px-4 py-2 rounded-xl text-sm font-bold border transition-all",
                              formData.reportType === t 
                                ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100" 
                                : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300"
                            )}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* File Upload */}
                  <div className="space-y-3">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <FileUp className="w-4 h-4 text-indigo-600" />
                      Upload Supporting Evidence (Photos, PPT, PDF, etc.)
                    </label>
                    <p className="text-sm text-slate-500">
                      These files stay attached to this case and are sent directly to AI as generation evidence.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {uploadedFiles.map((file, idx) => (
                        <div key={idx} className="relative group">
                          {file.type.startsWith('image/') ? (
                            <img 
                              src={`data:${file.type};base64,${file.data}`} 
                              alt={file.name}
                              className="w-20 h-20 object-cover rounded-xl border border-slate-200"
                            />
                          ) : (
                            <div className="w-20 h-20 bg-slate-100 rounded-xl border border-slate-200 flex flex-col items-center justify-center p-2">
                              <FileText className="w-8 h-8 text-slate-400" />
                              <span className="text-[10px] text-slate-500 truncate w-full text-center">{file.name}</span>
                            </div>
                          )}
                          <button 
                            onClick={() => removeFile(idx)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      <label className="w-20 h-20 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 transition-all text-slate-400 hover:text-indigo-600 hover:border-indigo-300">
                        <PlusCircle className="w-6 h-6" />
                        <span className="text-[10px] font-bold mt-1">Add File</span>
                        <input 
                          type="file" 
                          multiple 
                          className="hidden" 
                          onChange={handleFileUpload}
                          accept="image/*,.txt,.md,.csv,.pdf,.ppt,.pptx"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Report Format Reference</label>
                    <textarea 
                      value={formData.reportReference}
                      onChange={(e) => setFormData({...formData, reportReference: e.target.value})}
                      placeholder="Paste the structure, headings, tone, or sample format you want AI to follow. You can also mention which uploaded file is the preferred example."
                      rows={5}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                    />
                    <p className="text-sm text-slate-500">
                      Example: Follow this order: issue summary, photo observations, containment, root cause, corrective action, verification, owner/date.
                    </p>
                  </div>

                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium leading-relaxed text-amber-800">
                    若case沒有準確的信息來源說是多少不良率(客戶未必提供)，可以直接key in 低於0,4%的數字，以做參考
                  </p>

                  <button 
                    disabled={isGenerating}
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white py-4 rounded-2xl font-bold text-lg shadow-xl shadow-indigo-200 transition-all active:scale-[0.99] flex items-center justify-center gap-3"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-6 h-6 animate-spin" />
                        Analyzing with AI...
                      </>
                    ) : (
                      <>
                        <BarChart3 className="w-6 h-6" />
                        Generate Analysis Report
                      </>
                    )}
                  </button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Report Modal */}
      <AnimatePresence>
        {selectedCase && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedCase(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <header className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setSelectedCase(null)}
                    className="p-2 hover:bg-white rounded-full transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5 text-slate-600" />
                  </button>
                  <div>
                    <h3 className="font-bold text-xl">{selectedCase.reportType} Quality Report</h3>
                    <p className="text-sm text-slate-500">{selectedCase.supplier} • Quality Case</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleCopy}
                    className="p-2 hover:bg-white rounded-xl transition-colors text-slate-600 flex items-center gap-2 text-sm font-medium"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                  
                  <div className="h-4 w-px bg-slate-200 mx-1" />

                  <button 
                    onClick={() => {
                      setIsEditing(!isEditing);
                      setEditedReport(selectedCase.report || '');
                    }}
                    className={cn(
                      "p-2 rounded-xl transition-colors flex items-center gap-2 text-sm font-medium",
                      isEditing ? "bg-indigo-50 text-indigo-600" : "hover:bg-white text-slate-600"
                    )}
                  >
                    <Edit3 className="w-4 h-4" />
                    {isEditing ? 'Editing' : 'Edit'}
                  </button>

                  <button 
                    onClick={handleDeleteReport}
                    disabled={selectedCase.status === 'Analyzing'}
                    className="p-2 hover:bg-white rounded-xl transition-colors text-red-600 disabled:text-slate-300 disabled:hover:bg-transparent flex items-center gap-2 text-sm font-medium"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Report
                  </button>

                  <button 
                    onClick={() => handleDeleteCase(selectedCase)}
                    className="p-2 hover:bg-white rounded-xl transition-colors text-red-700 flex items-center gap-2 text-sm font-medium"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Case
                  </button>

                  <div className="relative group">
                    <button className="p-2 hover:bg-white rounded-xl transition-colors text-slate-600 flex items-center gap-2 text-sm font-medium">
                      <Download className="w-4 h-4" /> Export
                    </button>
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-30">
                      <button 
                        onClick={handleExportPDF}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                      >
                        <FileDown className="w-4 h-4 text-red-500" /> PDF Document
                      </button>
                      <button 
                        onClick={handleExportPPT}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                      >
                        <Presentation className="w-4 h-4 text-orange-500" /> PPT Presentation
                      </button>
                    </div>
                  </div>

                  <button 
                    onClick={handleSendToGamma}
                    className="p-2 hover:bg-white rounded-xl transition-colors text-slate-600 flex items-center gap-2 text-sm font-medium"
                  >
                    <Share2 className="w-4 h-4" /> Send to Gamma
                  </button>
                </div>
              </header>

              <div className="p-8 overflow-y-auto flex-1 bg-white">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Part Name</p>
                    <p className="font-bold text-slate-900">{selectedCase.partName}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Issue Date</p>
                    <input
                      type="date"
                      value={selectedCase.date}
                      onChange={(e) => {
                        const nextDate = e.target.value;
                        setSelectedCase(prev => prev ? { ...prev, date: nextDate } : prev);
                      }}
                      onBlur={(e) => handleIssueDateChange(selectedCase, e.target.value)}
                      className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                    />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Defect Rate</p>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={selectedCase.defectRate}
                        onBlur={(e) => handleDefectRateChange(selectedCase, e.target.value)}
                        className="w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-red-600 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                      />
                      <span className="text-sm font-bold text-slate-500">%</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Severity</p>
                    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold border", SEVERITY_COLORS[selectedCase.severity])}>
                      {selectedCase.severity}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Batch ID</p>
                    <p className="font-bold text-slate-900">{selectedCase.affectedBatches}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status</p>
                    {selectedCase.status === 'Analyzing' ? (
                      <div className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-700">
                        {STATUS_ICONS[selectedCase.status]}
                        {selectedCase.status}
                      </div>
                    ) : (
                      <div className="mt-1 flex items-center gap-2">
                        {STATUS_ICONS[selectedCase.status]}
                        <select
                          value={selectedCase.status}
                          onChange={(e) => handleStatusChange(selectedCase, e.target.value as 'Tracking' | 'Complete')}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                        >
                          <option value="Tracking">Tracking</option>
                          <option value="Complete">Complete</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                {selectedCase.reportReference && (
                  <div className="mb-8 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5">
                    <p className="text-xs font-bold uppercase tracking-wider text-indigo-500">Format Reference</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{selectedCase.reportReference}</p>
                  </div>
                )}

                <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <div className="flex items-center gap-2 text-slate-900">
                      <Archive className="h-4 w-4 text-indigo-600" />
                      <h4 className="text-sm font-bold">Archive Final Report</h4>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">
                      Archive the finished report into the reference library so similar future cases can reuse it.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        onClick={handleArchiveCurrentReport}
                        disabled={!selectedCase.report || isArchivingReport}
                        className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white transition-all hover:bg-indigo-700 disabled:bg-indigo-300"
                      >
                        {isArchivingReport ? 'Archiving...' : 'Archive Current Report'}
                      </button>
                      <label className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition-all hover:border-indigo-300 hover:text-indigo-700">
                        Upload Final Report File
                        <input
                          type="file"
                          className="hidden"
                          onChange={handleArchiveUploadedReport}
                          accept="image/*,.txt,.md,.csv,.pdf,.ppt,.pptx"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <div className="flex items-center gap-2 text-slate-900">
                      <MessageSquare className="h-4 w-4 text-indigo-600" />
                      <h4 className="text-sm font-bold">Improve Report With AI</h4>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">
                      Ask AI to revise tone, structure, root-cause logic, action items, or customer-facing wording for this case.
                    </p>
                    <div className="mt-4 space-y-3">
                      <div className="max-h-44 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3">
                        {reportChat.length === 0 ? (
                          <p className="text-sm text-slate-400">Try: "Strengthen the containment action and make the report more customer-facing."</p>
                        ) : (
                          reportChat.map((message, index) => (
                            <div
                              key={`${message.role}-${index}`}
                              className={cn(
                                'rounded-xl px-3 py-2 text-sm leading-6',
                                message.role === 'user' ? 'bg-indigo-50 text-slate-700' : 'bg-emerald-50 text-slate-700'
                              )}
                            >
                              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">
                                {message.role === 'user' ? 'You' : 'AI'}
                              </p>
                              <p className="whitespace-pre-wrap">{message.content}</p>
                            </div>
                          ))
                        )}
                      </div>
                      <textarea
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        rows={3}
                        placeholder="Tell AI what to improve in this report..."
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                      />
                      <button
                        onClick={handleImproveReport}
                        disabled={!chatInput.trim() || isImprovingReport || selectedCase.status === 'Analyzing'}
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white transition-all hover:bg-slate-800 disabled:bg-slate-300"
                      >
                        {isImprovingReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        {isImprovingReport ? 'Improving...' : 'Ask AI To Revise'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="prose prose-slate max-w-none">
                  {selectedCase.status === 'Analyzing' ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-4">
                      <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
                      <p className="font-medium text-slate-500">AI is generating your report based on your reference library and previous completed reports...</p>
                      <p className="text-xs text-slate-400">This may take up to 60 seconds depending on file complexity.</p>
                    </div>
                  ) : (
                    <div id="report-content" className="space-y-8">
                      {isEditing ? (
                        <textarea
                          value={editedReport}
                          onChange={(e) => setEditedReport(e.target.value)}
                          className="w-full min-h-[500px] p-6 rounded-2xl border border-indigo-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none font-mono text-sm leading-relaxed bg-indigo-50/30"
                        />
                      ) : (
                        <div className="markdown-body prose prose-slate max-w-none">
                          <ReactMarkdown>{selectedCase.report || "No report content available."}</ReactMarkdown>
                        </div>
                      )}

                      {/* Attachments Display */}
                      {selectedCase.files && selectedCase.files.length > 0 && (
                        <div className="pt-8 border-t border-slate-100">
                          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                              <FileUp className="w-4 h-4 text-indigo-600" />
                              Attached Evidence
                            </h4>
                            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition-all hover:border-indigo-300 hover:text-indigo-700">
                              {isUpdatingEvidence ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                              {isUpdatingEvidence ? 'Updating...' : 'Add Evidence'}
                              <input
                                type="file"
                                className="hidden"
                                multiple
                                accept="image/*,.txt,.md,.csv,.pdf,.ppt,.pptx"
                                onChange={handleAddCaseEvidence}
                              />
                            </label>
                          </div>
                          <div className="flex flex-wrap gap-4">
                            {selectedCase.files.map((file, idx) => (
                              <div key={idx} className="group relative">
                                <button
                                  onClick={() => openCaseFilePreview(file)}
                                  className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-left transition-colors hover:bg-slate-100"
                                >
                                  {file.type.startsWith('image/') ? (
                                    <img 
                                      src={`data:${file.type};base64,${file.data}`} 
                                      alt={file.name}
                                      className="w-12 h-12 object-cover rounded-lg"
                                    />
                                  ) : (
                                    <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center">
                                      <FileText className="w-6 h-6 text-slate-400" />
                                    </div>
                                  )}
                                  <div className="text-xs">
                                    <p className="font-bold text-slate-700 truncate max-w-[120px]">{file.name}</p>
                                    <p className="text-slate-400">{(file.data.length * 0.75 / 1024).toFixed(1)} KB</p>
                                  </div>
                                </button>
                                <button
                                  onClick={() => handleRemoveCaseEvidence(idx)}
                                  disabled={isUpdatingEvidence}
                                  className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white shadow-md transition-opacity group-hover:opacity-100 disabled:bg-red-300 md:opacity-0"
                                  aria-label={`Remove evidence ${file.name}`}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {selectedCase.files && selectedCase.files.length === 0 && (
                        <div className="pt-8 border-t border-slate-100">
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                              <FileUp className="w-4 h-4 text-indigo-600" />
                              Attached Evidence
                            </h4>
                            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition-all hover:border-indigo-300 hover:text-indigo-700">
                              {isUpdatingEvidence ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                              {isUpdatingEvidence ? 'Updating...' : 'Add Evidence'}
                              <input
                                type="file"
                                className="hidden"
                                multiple
                                accept="image/*,.txt,.md,.csv,.pdf,.ppt,.pptx"
                                onChange={handleAddCaseEvidence}
                              />
                            </label>
                          </div>
                          <p className="mt-4 text-sm text-slate-400">No evidence attached yet.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <footer className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                {isEditing && (
                  <button 
                    onClick={handleSaveEdit}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" /> Save Changes
                  </button>
                )}
                <button 
                  onClick={() => {
                    setSelectedCase(null);
                    setIsEditing(false);
                  }}
                  className="px-6 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-all"
                >
                  Close
                </button>
              </footer>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedDocument && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
            onClick={() => setSelectedDocument(null)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 12 }}
              className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <header className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{selectedDocument.sourceLabel || 'Document'}</p>
                  <h3 className="mt-1 text-lg font-bold text-slate-900">{selectedDocument.name}</h3>
                </div>
                <div className="flex items-center gap-2">
                  {(selectedDocument.type === 'application/pdf' || selectedDocument.type.includes('powerpoint') || selectedDocument.name.match(/\.(pdf|ppt|pptx)$/i)) && (
                    <>
                      {selectedDocument.type === 'application/pdf' && (
                        <button
                          onClick={() => handleOpenStoredDocument(selectedDocument.name, selectedDocument.type, selectedDocument.content)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-100"
                        >
                          Open
                        </button>
                      )}
                      <button
                        onClick={() => handleDownloadStoredDocument(selectedDocument.name, selectedDocument.type, selectedDocument.content)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-100"
                      >
                        Download
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setSelectedDocument(null)}
                    className="rounded-full p-2 text-slate-500 transition-colors hover:bg-white"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </header>

              <div className="overflow-y-auto p-6">
                {selectedDocument.type.startsWith('image/') && selectedDocument.content ? (
                  <img
                    src={`data:${selectedDocument.type};base64,${selectedDocument.content}`}
                    alt={selectedDocument.name}
                    className="max-h-[68vh] w-full rounded-2xl border border-slate-200 object-contain bg-slate-50"
                  />
                ) : selectedDocument.extractedText ? (
                  selectedDocument.type === 'text/markdown' ? (
                    <div className="prose prose-slate max-w-none">
                      <ReactMarkdown>{selectedDocument.extractedText}</ReactMarkdown>
                    </div>
                  ) : (
                    <pre className="whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 p-5 font-mono text-sm leading-6 text-slate-700">
                      {selectedDocument.extractedText}
                    </pre>
                  )
                ) : selectedDocument.content && selectedDocument.type === 'text/markdown' ? (
                  <div className="prose prose-slate max-w-none">
                    <ReactMarkdown>{selectedDocument.content}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                    Preview is not available for this file type yet, but the document is still archived in D1 and can be used by AI as a reference.
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
