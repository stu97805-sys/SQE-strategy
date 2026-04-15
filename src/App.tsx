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
  FileDown
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
import { QualityCase, Severity, ReportType, QualityCaseFile, ReferenceDoc } from './types';
import { cn } from './utils';
import { createCase, createReferenceDoc, deleteReferenceDoc, fetchBootstrap, updateCaseReport } from './api';

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
    status: 'Completed',
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
    status: 'Completed',
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
  Pending: <Clock className="w-4 h-4 text-gray-400" />,
  Analyzing: <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />,
  Completed: <CheckCircle2 className="w-4 h-4 text-green-500" />
};

export default function App() {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedReport, setEditedReport] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<QualityCaseFile[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'cases' | 'new' | 'standards'>('dashboard');
  const [cases, setCases] = useState<QualityCase[]>([]);
  const [referenceDocs, setReferenceDocs] = useState<ReferenceDoc[]>([]);
  const [selectedCase, setSelectedCase] = useState<QualityCase | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [uiError, setUiError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const payload = await fetchBootstrap();
        if (!isMounted) return;
        setCases(payload.cases);
        setReferenceDocs(payload.referenceDocs);
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

  const handleCopy = () => {
    const textToCopy = isEditing ? editedReport : selectedCase?.report;
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setUploadedFiles(prev => [...prev, {
          name: file.name,
          type: file.type,
          data: base64.split(',')[1] // only the base64 part
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
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
    slide1.addText(`Date: ${selectedCase.date}`, { x: 1, y: 2.5, w: '80%', h: 0.5, fontSize: 18, color: '999999' });

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

  const handleStandardUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const base64 = event.target?.result as string;
          const createdDoc = await createReferenceDoc({
            name: file.name,
            type: file.type,
            content: base64.split(',')[1],
          });
          setReferenceDocs(prev => [createdDoc, ...prev]);
          setUiError('');
        } catch (error) {
          setUiError(error instanceof Error ? error.message : 'Failed to upload reference document.');
        }
      };
      reader.readAsDataURL(file);
    });
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

  // Form State
  const [formData, setFormData] = useState({
    supplier: '',
    partName: '',
    defectRate: '',
    defectPhenomenon: '',
    affectedBatches: '',
    severity: 'Medium' as Severity,
    reportType: 'Simple' as ReportType,
    industry: 'General' as 'General' | 'CNC'
  });

  const filteredCases = useMemo(() => {
    return cases.filter(c => 
      c.supplier.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.partName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.defectPhenomenon.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [cases, searchQuery]);

  const stats = useMemo(() => {
    const total = cases.length;
    const completed = cases.filter(c => c.status === 'Completed').length;
    const avgDefect = cases.reduce((acc, c) => acc + c.defectRate, 0) / total || 0;
    const critical = cases.filter(c => c.severity === 'Critical' || c.severity === 'High').length;
    
    return { total, completed, avgDefect: avgDefect.toFixed(2), critical };
  }, [cases]);

  const chartData = [
    { name: 'Mon', rate: 1.2 },
    { name: 'Tue', rate: 1.8 },
    { name: 'Wed', rate: 1.5 },
    { name: 'Thu', rate: 2.1 },
    { name: 'Fri', rate: 1.4 },
    { name: 'Sat', rate: 0.9 },
    { name: 'Sun', rate: 1.1 },
  ];

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setUiError('');

    const newCase: QualityCase = {
      id: Math.random().toString(36).substr(2, 9),
      supplier: formData.supplier,
      partName: formData.partName,
      defectRate: parseFloat(formData.defectRate),
      defectPhenomenon: formData.defectPhenomenon,
      affectedBatches: formData.affectedBatches,
      severity: formData.severity,
      date: new Date().toISOString().split('T')[0],
      status: 'Analyzing',
      reportType: formData.reportType,
      industry: formData.industry,
      files: uploadedFiles
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
        c.id === newCase.id ? { ...c, status: 'Completed', report: "Error generating report with OpenAI." } : c
      ));
      setUiError(error instanceof Error ? error.message : 'Failed to create case.');
    } finally {
      setIsGenerating(false);
      setFormData({
        supplier: '',
        partName: '',
        defectRate: '',
        defectPhenomenon: '',
        affectedBatches: '',
        severity: 'Medium',
        reportType: 'Simple',
        industry: 'General'
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
              onClick={() => setActiveTab('standards')}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                activeTab === 'standards' ? "bg-indigo-50 text-indigo-700 font-medium" : "text-slate-500 hover:bg-slate-50"
              )}
            >
              <ShieldAlert className="w-5 h-5" />
              Reference Standards
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
              <span className="text-sm font-bold text-slate-600">JD</span>
            </div>
            <div>
              <p className="text-sm font-bold">John Doe</p>
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
                  { label: 'Completed', value: stats.completed, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
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
                    <h3 className="font-bold text-lg">Defect Rate Trend</h3>
                    <select className="text-sm border-none bg-slate-50 rounded-lg px-2 py-1 outline-none">
                      <option>Last 7 Days</option>
                      <option>Last 30 Days</option>
                    </select>
                  </div>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
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
                        <Area type="monotone" dataKey="rate" stroke="#4F46E5" strokeWidth={3} fillOpacity={1} fill="url(#colorRate)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="font-bold text-lg mb-6">Severity Distribution</h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[
                        { name: 'Low', count: 5, color: '#3B82F6' },
                        { name: 'Medium', count: 8, color: '#EAB308' },
                        { name: 'High', count: 4, color: '#F97316' },
                        { name: 'Critical', count: 2, color: '#EF4444' },
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 12 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 12 }} />
                        <Tooltip cursor={{fill: '#F8FAFC'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                        <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                          { [0,1,2,3].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={['#3B82F6', '#EAB308', '#F97316', '#EF4444'][index]} />
                          ))}
                        </Bar>
                      </BarChart>
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
              </header>

              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-bottom border-slate-200">
                      <tr>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Case Info</th>
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
                                <p className="font-bold text-slate-900">{c.supplier}</p>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm text-slate-500">{c.partName}</p>
                                  {c.industry === 'CNC' && (
                                    <span className="px-1.5 py-0.5 bg-slate-100 text-[10px] font-bold text-slate-500 rounded border border-slate-200">CNC</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
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
                          </td>
                          <td className="px-6 py-4">
                            <span className={cn("px-3 py-1 rounded-full text-xs font-bold border", SEVERITY_COLORS[c.severity])}>
                              {c.severity}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 text-sm font-medium">
                              {STATUS_ICONS[c.status]}
                              {c.status}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
                              <ChevronRight className="w-5 h-5 text-slate-400" />
                            </button>
                          </td>
                        </tr>
                      ))}
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
              <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Reference Standards</h2>
              <p className="text-slate-500">Manage fixed analysis reference materials and quality standards.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-2 space-y-6">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5 text-indigo-600" />
                      Active Standards
                    </h3>
                    <label className="cursor-pointer bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all flex items-center gap-2">
                      <PlusCircle className="w-4 h-4" /> Add Standard
                      <input type="file" className="hidden" multiple onChange={handleStandardUpload} />
                    </label>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {referenceDocs.map((doc) => (
                      <div key={doc.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                            <FileText className="w-5 h-5 text-indigo-600" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{doc.name}</p>
                            <p className="text-xs text-slate-500">Added on {new Date(doc.addedAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => removeStandard(doc.id)}
                          className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                    {referenceDocs.length === 0 && (
                      <div className="p-12 text-center text-slate-400">
                        No standards added yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-xl shadow-indigo-100">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    AI Context Note
                  </h3>
                  <p className="text-indigo-100 text-sm leading-relaxed mb-4">
                    These standards are automatically included in every AI analysis. The model uses them to verify compliance and suggest corrective actions based on your specific requirements.
                  </p>
                  <div className="bg-white/10 rounded-xl p-4 border border-white/20">
                    <p className="text-xs font-bold uppercase tracking-wider mb-2 opacity-70">Current Primary Standard</p>
                    <p className="font-bold">AQL 0.4 (Incoming Quality)</p>
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
                      Upload Supporting Evidence (Photos, PPT, etc.)
                    </label>
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
                          accept="image/*,.pdf,.ppt,.pptx"
                        />
                      </label>
                    </div>
                  </div>

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
                    <p className="text-sm text-slate-500">{selectedCase.supplier} • {selectedCase.date}</p>
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
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Defect Rate</p>
                    <p className="font-bold text-red-600">{selectedCase.defectRate}%</p>
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
                </div>

                <div className="prose prose-slate max-w-none">
                  {selectedCase.status === 'Analyzing' ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-4">
                      <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
                      <p className="font-medium text-slate-500">AI is generating your report based on AQL 0.4 and reference standards...</p>
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
                          <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <FileUp className="w-4 h-4 text-indigo-600" />
                            Attached Evidence
                          </h4>
                          <div className="flex flex-wrap gap-4">
                            {selectedCase.files.map((file, idx) => (
                              <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
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
                              </div>
                            ))}
                          </div>
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
    </div>
  );
}
