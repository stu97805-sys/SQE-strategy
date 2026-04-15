import type { QualityCase, ReferenceDoc } from './types';

export interface BootstrapResponse {
  cases: QualityCase[];
  referenceDocs: ReferenceDoc[];
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const message = await response.text();
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
