export type Severity = 'Low' | 'Medium' | 'High' | 'Critical';
export type ReportType = '8D' | 'Simple';

export interface QualityCaseFile {
  name: string;
  type: string;
  data: string; // base64
  extractedText?: string;
}

export interface QualityMetrics {
  stage: 'FQC' | 'SI' | 'IQA' | 'Sorting' | 'Line';
  rate: number;
  defectType: string;
}

export interface SortingCase {
  id: string;
  date: string;
  sortingQty: number;
  ngQty: number;
  defectRate: number;
  lfLotNo?: string;
  pn?: string;
  aseRtSch?: string;
}

export interface ReferenceDoc {
  id: string;
  name: string;
  type: string;
  content: string; // base64 or text
  extractedText?: string;
  addedAt: string;
  sourceCaseId?: string;
  sourceKind?: 'manual' | 'case_attachment' | 'generated_report';
  autoArchived?: boolean;
}

export interface QualityCase {
  id: string;
  supplier: string;
  partName: string;
  defectRate: number;
  defectPhenomenon: string;
  affectedBatches: string;
  severity: Severity;
  date: string;
  status: 'Tracking' | 'Analyzing' | 'Complete';
  report?: string;
  reportType?: ReportType;
  reportReference?: string;
  files?: QualityCaseFile[];
  industry?: 'General' | 'CNC';
  metrics?: QualityMetrics[];
}

export interface ReportSection {
  title: string;
  content: string;
}
