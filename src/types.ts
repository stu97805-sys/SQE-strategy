export type Severity = 'Low' | 'Medium' | 'High' | 'Critical';
export type ReportType = '8D' | 'Simple';

export interface QualityCaseFile {
  name: string;
  type: string;
  data: string; // base64
}

export interface QualityMetrics {
  stage: 'FQC' | 'SI' | 'IQA' | 'Sorting' | 'Line';
  rate: number;
  defectType: string;
}

export interface ReferenceDoc {
  id: string;
  name: string;
  type: string;
  content: string; // base64 or text
  addedAt: string;
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
  status: 'Pending' | 'Analyzing' | 'Completed';
  report?: string;
  reportType?: ReportType;
  files?: QualityCaseFile[];
  industry?: 'General' | 'CNC';
  metrics?: QualityMetrics[];
}

export interface ReportSection {
  title: string;
  content: string;
}
