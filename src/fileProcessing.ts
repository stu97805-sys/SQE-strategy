import JSZip from 'jszip';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import * as XLSX from 'xlsx';
import type { QualityCaseFile, ReferenceDoc } from './types';

GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();

const MAX_BINARY_FILE_SIZE = 1.5 * 1024 * 1024;
const MAX_PDF_FILE_SIZE = 10 * 1024 * 1024;
const MAX_DOCUMENT_BINARY_FILE_SIZE = 8 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1800;
const IMAGE_QUALITY_STEPS = [0.9, 0.82, 0.72, 0.6];

function stripDataUrlPrefix(value: string) {
  const parts = value.split(',');
  return parts.length > 1 ? parts[1] : value;
}

async function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(stripDataUrlPrefix(reader.result as string));
    reader.onerror = () => reject(reader.error ?? new Error(`Failed to read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

function shouldInlineBinary(file: File) {
  return !isPdfFile(file) && file.size <= MAX_BINARY_FILE_SIZE;
}

function isPdfFile(file: File) {
  return file.type === 'application/pdf' || file.name.match(/\.pdf$/i);
}

function isPresentationFile(file: File) {
  return (
    file.type === 'application/vnd.ms-powerpoint' ||
    file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    file.name.match(/\.(ppt|pptx)$/i)
  );
}

function shouldStoreOriginalDocumentBinary(file: File) {
  return (isPdfFile(file) || isPresentationFile(file)) && file.size <= MAX_DOCUMENT_BINARY_FILE_SIZE;
}

function isImageFile(file: File) {
  return file.type.startsWith('image/') || file.name.match(/\.(png|jpg|jpeg|webp)$/i);
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

async function extractPptxText(file: File) {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const slideNames = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const slides = await Promise.all(
    slideNames.map(async (name, index) => {
      const xml = await zip.files[name].async('text');
      const matches = [...xml.matchAll(/<a:t>(.*?)<\/a:t>/g)].map((match) => decodeXmlEntities(match[1]));
      const text = matches.join(' ').replace(/\s+/g, ' ').trim();
      return text ? `Slide ${index + 1}: ${text}` : '';
    })
  );

  return slides.filter(Boolean).join('\n');
}

async function extractPdfText(file: File) {
  if (file.size > MAX_PDF_FILE_SIZE) {
    throw new Error(`PDF ${file.name} is too large. Please keep PDF files under ${Math.round(MAX_PDF_FILE_SIZE / 1024 / 1024)} MB.`);
  }

  const loadingTask = getDocument({
    data: await file.arrayBuffer(),
    useWorkerFetch: false,
    isEvalSupported: false,
  });
  const pdf = await loadingTask.promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const text = textContent.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (text) {
      pages.push(`Page ${pageNumber}: ${text}`);
    }
  }

  return pages.join('\n');
}

async function extractText(file: File) {
  if (
    file.type === 'text/plain' ||
    file.type === 'text/csv' ||
    file.type === 'text/markdown' ||
    file.name.match(/\.(txt|csv|md)$/i)
  ) {
    return file.text();
  }

  if (file.name.endsWith('.pptx')) {
    return extractPptxText(file);
  }

  if (isPdfFile(file)) {
    return extractPdfText(file);
  }

  return '';
}

async function loadImageElement(file: File) {
  const objectUrl = URL.createObjectURL(file);

  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Failed to load image ${file.name}.`));
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function imageFileToBase64(file: File) {
  if (!isImageFile(file)) {
    return { data: await fileToBase64(file), mimeType: file.type || inferMimeType(file.name) };
  }

  if (file.size <= MAX_BINARY_FILE_SIZE) {
    return { data: await fileToBase64(file), mimeType: file.type || inferMimeType(file.name) };
  }

  const image = await loadImageElement(file);
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error(`Failed to process image ${file.name}.`);
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  for (const quality of IMAGE_QUALITY_STEPS) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    const base64 = stripDataUrlPrefix(dataUrl);
    const estimatedSize = base64.length * 0.75;
    if (estimatedSize <= MAX_BINARY_FILE_SIZE) {
      return { data: base64, mimeType: 'image/jpeg' };
    }
  }

  throw new Error(`Image ${file.name} is too large. Please upload an image under ${Math.round(MAX_BINARY_FILE_SIZE / 1024 / 1024)} MB or use a smaller resolution.`);
}

export async function prepareCaseFile(file: File): Promise<QualityCaseFile> {
  const extractedText = await extractText(file);
  const imagePayload = isImageFile(file) ? await imageFileToBase64(file) : null;
  const data = imagePayload
    ? imagePayload.data
    : shouldStoreOriginalDocumentBinary(file)
      ? await fileToBase64(file)
      : shouldInlineBinary(file)
        ? await fileToBase64(file)
        : '';

  if (!data && !extractedText) {
    throw new Error(`Unable to read useful content from ${file.name}. Please upload a smaller file, images, or a text-based PDF.`);
  }

  return {
    name: file.name,
    type: imagePayload?.mimeType || file.type || inferMimeType(file.name),
    data,
    extractedText: extractedText || undefined,
  };
}

export async function prepareReferenceDoc(file: File): Promise<Omit<ReferenceDoc, 'id' | 'addedAt'>> {
  const extractedText = await extractText(file);
  const imagePayload = isImageFile(file) ? await imageFileToBase64(file) : null;
  const content = imagePayload
    ? imagePayload.data
    : shouldStoreOriginalDocumentBinary(file)
      ? await fileToBase64(file)
      : shouldInlineBinary(file)
        ? await fileToBase64(file)
        : '';

  if (!content && !extractedText) {
    throw new Error(`Unable to extract readable content from ${file.name}. Please upload a text-based PDF, image, or smaller source file.`);
  }

  return {
    name: file.name,
    type: imagePayload?.mimeType || file.type || inferMimeType(file.name),
    content,
    extractedText: extractedText || undefined,
  };
}

export async function prepareHistoricalCaseImport(file: File): Promise<{
  name: string;
  type: string;
  data: string;
  extractedText?: string;
}> {
  const prepared = await prepareReferenceDoc(file);
  const isDocumentWithText = (isPdfFile(file) || isPresentationFile(file)) && Boolean(prepared.extractedText);

  return {
    name: prepared.name,
    type: prepared.type,
    // Historical import only needs stable AI-readable content; omit large document binaries.
    data: isDocumentWithText ? '' : prepared.content,
    extractedText: prepared.extractedText,
  };
}

export function prepareCaseFilesForSubmission(files: QualityCaseFile[]): QualityCaseFile[] {
  return files.map((file) => {
    const hasReadableDocumentText = Boolean(file.extractedText) &&
      (file.type === 'application/pdf' ||
        file.type === 'application/vnd.ms-powerpoint' ||
        file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
        file.name.match(/\.(pdf|ppt|pptx)$/i));

    return {
      ...file,
      // Keep extracted text for AI, but omit large document binaries from the case creation payload.
      data: hasReadableDocumentText ? '' : file.data,
    };
  });
}

function inferMimeType(fileName: string) {
  if (fileName.endsWith('.pptx')) {
    return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  }

  if (fileName.endsWith('.ppt')) {
    return 'application/vnd.ms-powerpoint';
  }

  if (fileName.endsWith('.md')) {
    return 'text/markdown';
  }

  if (fileName.endsWith('.txt')) {
    return 'text/plain';
  }

  if (fileName.endsWith('.csv')) {
    return 'text/csv';
  }

  if (fileName.endsWith('.pdf')) {
    return 'application/pdf';
  }

  return 'application/octet-stream';
}

function truncateForAi(text: string, maxLength = 60_000) {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}\n...[truncated]`;
}

function normalizeCellForAi(value: unknown, maxLength = 80) {
  const text = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) {
    return '';
  }

  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

export async function prepareSortingWorkbookForAi(file: File): Promise<{ sourceFileName: string; workbookText: string }> {
  const workbook = XLSX.read(await file.arrayBuffer(), {
    type: 'array',
    cellDates: true,
  });

  if (!workbook.SheetNames.length) {
    throw new Error('No worksheet found in the uploaded Excel file.');
  }

  const workbookText = workbook.SheetNames.slice(0, 4).map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: false,
      defval: '',
      blankrows: false,
    });

    const compactRows = rows
      .map((row) => Array.isArray(row) ? row.slice(0, 16).map((cell) => normalizeCellForAi(cell)) : [])
      .filter((row) => row.some(Boolean))
      .slice(0, 160)
      .map((row) => row.join('\t'))
      .filter(Boolean);

    if (!compactRows.length) {
      return '';
    }

    return [
      `Sheet: ${sheetName}`,
      `Visible rows sent to AI: ${compactRows.length}`,
      compactRows.join('\n'),
    ].join('\n');
  })
    .filter(Boolean)
    .join('\n\n');

  if (!workbookText.trim()) {
    throw new Error('Sorting Excel file does not contain readable rows.');
  }

  return {
    sourceFileName: file.name,
    workbookText: truncateForAi(workbookText, 24_000),
  };
}
