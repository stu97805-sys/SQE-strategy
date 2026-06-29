import type { QualityCase, ReferenceDoc, SortingCase } from './types';

export interface BootstrapResponse {
  cases: QualityCase[];
  referenceDocs: ReferenceDoc[];
  sortingCases: SortingCase[];
}

export interface ImproveReportMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ImproveReportResponse {
  assistantMessage: string;
  updatedCase: QualityCase;
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const message = await response.text();

    if (message.includes('cf-error-code') || message.includes('Worker threw exception')) {
      throw new Error('Cloudflare upload failed while processing this file. Please try a smaller file or a text-based PDF.');
    }

    if (message.trim().startsWith('<!DOCTYPE html')) {
      throw new Error(`Server returned an HTML error page (status ${response.status}).`);
    }

    throw new Error(message || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function fetchBootstrap(): Promise<BootstrapResponse> {
  const response = await fetch('/api/bootstrap');
  return parseResponse<BootstrapResponse>(response);
}

export async function createReferenceDoc(payload: Omit<ReferenceDoc, 'id' | 'addedAt'>): Promise<ReferenceDoc> {
  const response = await fetch('/api/reference-docs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return parseResponse<ReferenceDoc>(response);
}

export async function deleteReferenceDoc(id: string): Promise<void> {
  const response = await fetch(`/api/reference-docs/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Delete failed with status ${response.status}`);
  }
}

export async function createCase(payload: Omit<QualityCase, 'status' | 'report'>): Promise<QualityCase> {
  const response = await fetch('/api/cases', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return parseResponse<QualityCase>(response);
}

export async function deleteCase(id: string): Promise<QualityCase> {
  const response = await fetch(`/api/cases/${id}`, {
    method: 'DELETE',
  });

  return parseResponse<QualityCase>(response);
}

export async function updateCase(id: string, payload: Partial<QualityCase>): Promise<QualityCase> {
  const response = await fetch(`/api/cases/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return parseResponse<QualityCase>(response);
}

export async function updateCaseReport(id: string, report: string): Promise<QualityCase> {
  const response = await fetch(`/api/cases/${id}/report`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ report }),
  });

  return parseResponse<QualityCase>(response);
}

export async function deleteCaseReport(id: string): Promise<QualityCase> {
  const response = await fetch(`/api/cases/${id}/report`, {
    method: 'DELETE',
  });

  return parseResponse<QualityCase>(response);
}

export async function improveCaseReport(id: string, messages: ImproveReportMessage[]): Promise<ImproveReportResponse> {
  const response = await fetch(`/api/cases/${id}/assistant`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages }),
  });

  return parseResponse<ImproveReportResponse>(response);
}

export async function importSortingCases(payload: { workbookText: string; sourceFileName: string }): Promise<SortingCase[]> {
  const response = await fetch('/api/sorting-cases/import', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return parseResponse<SortingCase[]>(response);
}

export async function importHistoricalCase(payload: {
  name: string;
  type: string;
  data: string;
  extractedText?: string;
}): Promise<QualityCase> {
  const response = await fetch('/api/cases/import', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return parseResponse<QualityCase>(response);
}
