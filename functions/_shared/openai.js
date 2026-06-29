function decodeBase64Text(content) {
  try {
    return atob(content);
  } catch {
    return content;
  }
}

function truncateText(value, maxLength = 4000) {
  if (!value) {
    return '';
  }

  return value.length > maxLength ? `${value.slice(0, maxLength)}\n...[truncated]` : value;
}

function buildInputItems({ qualityCase, referenceDocs, previousReports }) {
  const promptLines = [
    'You are a senior supplier quality engineer and customer quality engineer.',
    `Generate a professional ${qualityCase.reportType || 'Simple'} quality report in Markdown.`,
    `Industry: ${qualityCase.industry || 'General'}`,
    `Supplier: ${qualityCase.supplier}`,
    `Part Name: ${qualityCase.partName}`,
    `Defect Rate: ${qualityCase.defectRate}%`,
    `Defect Phenomenon: ${qualityCase.defectPhenomenon}`,
    `Affected Batches: ${qualityCase.affectedBatches}`,
    `Issue Date: ${qualityCase.date}`,
    `Severity: ${qualityCase.severity}`,
    'Primary standard: AQL 0.4 (Acceptance Quality Limit 0.4%).',
    qualityCase.industry === 'CNC'
      ? 'Include machining-specific analysis such as tolerance stack-up, tool wear, fixture alignment, burrs, thermal drift, and surface finish control where relevant.'
      : 'Focus on manufacturing quality containment, root cause, corrective action, and prevention.',
    qualityCase.reportType === '8D'
      ? 'Use the standard 8D structure from D1 through D8.'
      : '',
    qualityCase.reportType === 'Simple'
      ? 'Use sections for Issue, Root Cause, Action, and Status.'
      : '',
    qualityCase.reportReference
      ? 'Follow the user-provided report format reference when it does not conflict with the actual case facts.'
      : '',
    qualityCase.files?.length
      ? 'Use the attached photos and supporting materials as direct case evidence, and reflect relevant observations in the report.'
      : '',
    'Be specific, practical, and technically credible.',
    'Use the uploaded reference library and previous completed reports as style and content guidance when they are relevant.',
    'Reference the supplied standards when appropriate.',
  ].filter(Boolean);

  const items = [
    {
      role: 'user',
      content: [{ type: 'input_text', text: promptLines.join('\n') }],
    },
  ];

  for (const doc of referenceDocs) {
    if (doc.extractedText) {
      items[0].content.push({
        type: 'input_text',
        text: `Reference library document [${doc.name}]:\n${truncateText(doc.extractedText)}`,
      });
      continue;
    }

    if (doc.type === 'text/plain' || doc.type === 'text/csv' || doc.type === 'text/markdown') {
      items[0].content.push({
        type: 'input_text',
        text: `Reference library document [${doc.name}]:\n${truncateText(decodeBase64Text(doc.content))}`,
      });
      continue;
    }

    if (doc.type.startsWith('image/')) {
      items[0].content.push({
        type: 'input_image',
        image_url: `data:${doc.type};base64,${doc.content}`,
      });
      items[0].content.push({
        type: 'input_text',
        text: `Image reference attached: ${doc.name}`,
      });
      continue;
    }

    items[0].content.push({
      type: 'input_text',
      text: `Stored reference document attached in database but not directly parsed by the model: ${doc.name} (${doc.type})`,
    });
  }

  for (const report of previousReports || []) {
    items[0].content.push({
      type: 'input_text',
      text: `Previous completed report reference:
Supplier: ${report.supplier}
Part: ${report.partName}
Phenomenon: ${report.defectPhenomenon}
Severity: ${report.severity}
Report Type: ${report.reportType || 'Unknown'}
Date: ${report.date}
Report Content:
${truncateText(report.report, 5000)}`,
    });
  }

  if (qualityCase.reportReference?.trim()) {
    items[0].content.push({
      type: 'input_text',
      text: `User-supplied report format reference:\n${truncateText(qualityCase.reportReference, 5000)}`,
    });
  }

  for (const file of qualityCase.files || []) {
    if (file.extractedText) {
      items[0].content.push({
        type: 'input_text',
        text: `Attachment [${file.name}]:\n${truncateText(file.extractedText)}`,
      });
      continue;
    }

    if (file.type === 'text/plain' || file.type === 'text/csv' || file.type === 'text/markdown') {
      items[0].content.push({
        type: 'input_text',
        text: `Attachment [${file.name}]:\n${truncateText(decodeBase64Text(file.data))}`,
      });
      continue;
    }

    if (file.type.startsWith('image/')) {
      items[0].content.push({
        type: 'input_image',
        image_url: `data:${file.type};base64,${file.data}`,
      });
      items[0].content.push({
        type: 'input_text',
        text: `Image evidence attached: ${file.name}`,
      });
      continue;
    }

    items[0].content.push({
      type: 'input_text',
      text: `Attachment stored in database: ${file.name} (${file.type})`,
    });
  }

  return items;
}

export async function generateReport({ apiKey, model, qualityCase, referenceDocs, previousReports }) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: buildInputItems({ qualityCase, referenceDocs, previousReports }),
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenAI request failed: ${details}`);
  }

  const payload = await response.json();
  const text = payload.output_text || extractText(payload.output);
  if (!text) {
    throw new Error('OpenAI response did not include report text.');
  }

  return text;
}

export async function improveReportWithConversation({ apiKey, model, qualityCase, referenceDocs, messages }) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: buildImproveReportInput({ qualityCase, referenceDocs, messages }),
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenAI request failed: ${details}`);
  }

  const payload = await response.json();
  const text = payload.output_text || extractText(payload.output);
  if (!text) {
    throw new Error('OpenAI response did not include report improvement text.');
  }

  const parsed = parseImprovedReportText(text);
  if (!parsed.report) {
    throw new Error('AI response did not include an updated report block.');
  }

  return parsed;
}

export async function extractQualityCaseFromDocument({ apiKey, model, document }) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: buildHistoricalCaseExtractionInput(document),
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenAI request failed: ${details}`);
  }

  const payload = await response.json();
  const text = payload.output_text || extractText(payload.output);
  if (!text) {
    throw new Error('OpenAI response did not include historical case extraction text.');
  }

  const parsed = parseHistoricalCaseExtraction(text);
  if (!parsed) {
    throw new Error('AI response did not include valid historical case JSON.');
  }

  return parsed;
}

export async function extractSortingCasesFromWorkbook({ apiKey, model, workbookText, sourceFileName }) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: buildSortingCaseExtractionInput({ workbookText, sourceFileName }),
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenAI request failed: ${details}`);
  }

  const payload = await response.json();
  const text = payload.output_text || extractText(payload.output);
  if (!text) {
    throw new Error('OpenAI response did not include sorting extraction text.');
  }

  const rows = parseSortingCaseExtraction(text);
  if (!rows.length) {
    throw new Error('AI could not extract valid sorting rows from this Excel file.');
  }

  return rows;
}

function buildHistoricalCaseExtractionInput(document) {
  const content = [
    {
      type: 'input_text',
      text: [
        'You are extracting a historical supplier quality case from an uploaded report file.',
        'Read the report and return only JSON.',
        'Use this exact schema:',
        '{"supplier":"string","partName":"string","defectRate":number,"defectPhenomenon":"string","affectedBatches":"string","severity":"Low|Medium|High|Critical","date":"YYYY-MM-DD","reportType":"8D|Simple","industry":"General|CNC","report":"markdown string"}',
        'If a field is missing, infer cautiously from the document or use a reasonable fallback.',
        'The "report" field should be a clean markdown version or concise reconstruction of the uploaded report content.',
      ].join('\n'),
    },
  ];

  if (document.extractedText) {
    content.push({
      type: 'input_text',
      text: `Document text extracted from [${document.name}]:\n${truncateText(document.extractedText, 20000)}`,
    });
  }

  if (document.type.startsWith('image/') && document.data) {
    content.push({
      type: 'input_image',
      image_url: `data:${document.type};base64,${document.data}`,
    });
  }

  return [
    {
      role: 'user',
      content,
    },
  ];
}

function buildSortingCaseExtractionInput({ workbookText, sourceFileName }) {
  return [
    {
      role: 'user',
      content: [
        {
          type: 'input_text',
          text: [
            'You are extracting sorting inspection history rows from an uploaded Excel workbook.',
            'Return only JSON.',
            'Use this exact schema:',
            '{"rows":[{"date":"YYYY-MM-DD","sortingQty":number,"ngQty":number,"defectRate":number,"lfLotNo":"string","pn":"string","aseRtSch":"string"}]}',
            'Read the provided workbook excerpts and extract every valid row that contains a date plus sorting quantity and NG quantity.',
            'If defect rate is missing, calculate it as (ngQty / sortingQty) * 100.',
            'If defect rate is shown as a decimal less than or equal to 1, convert it to a percentage number.',
            'lfLotNo should come only from the LF lot / LF lot No. / lot identifier column. Do not confuse LF lot No. with PN.',
            'pn should come from the PN / Part Number column. If PN is missing, return "NA".',
            'aseRtSch should come from the ASE RT/SCH column when present. If missing, use an empty string.',
            'Examples: "5601056101" is a PN. "20260305H01V" is an LF lot No.',
            'Ignore summary rows, blank rows, subtotal rows, and rows without a usable date.',
            'Column names may be in English or Chinese.',
            'The workbook content may be trimmed for size, so focus on explicit row data instead of asking for missing context.',
            `Source file name: ${sourceFileName}`,
            'Workbook content:',
            workbookText,
          ].join('\n'),
        },
      ],
    },
  ];
}

function parseHistoricalCaseExtraction(text) {
  const jsonText = text.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonText) {
    return null;
  }

  try {
    const parsed = JSON.parse(jsonText);
    return {
      supplier: parsed.supplier || 'Unknown Supplier',
      partName: parsed.partName || 'Unknown Part',
      defectRate: Number(parsed.defectRate ?? 0),
      defectPhenomenon: parsed.defectPhenomenon || 'Historical quality issue',
      affectedBatches: parsed.affectedBatches || 'Historical batch',
      severity: ['Low', 'Medium', 'High', 'Critical'].includes(parsed.severity) ? parsed.severity : 'Medium',
      date: parsed.date || new Date().toISOString().split('T')[0],
      reportType: parsed.reportType === '8D' ? '8D' : 'Simple',
      industry: parsed.industry === 'CNC' ? 'CNC' : 'General',
      report: typeof parsed.report === 'string' ? parsed.report : '',
    };
  } catch {
    return null;
  }
}

function parseSortingCaseExtraction(text) {
  const jsonText = text.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonText) {
    return [];
  }

  try {
    const parsed = JSON.parse(jsonText);
    const rows = Array.isArray(parsed.rows) ? parsed.rows : [];

    return rows
      .map((row) => normalizeSortingRow(row))
      .filter((row) => Boolean(row));
  } catch {
    return [];
  }
}

function normalizeSortingRow(row) {
  const date = normalizeIsoDate(row?.date);
  const sortingQty = Number(row?.sortingQty ?? 0);
  const ngQty = Number(row?.ngQty ?? 0);
  const rawDefectRate = Number(row?.defectRate ?? Number.NaN);
  const normalizedIdentifiers = normalizeSortingIdentifiers({
    lfLotNo: typeof row?.lfLotNo === 'string' ? row.lfLotNo.trim() : '',
    pn: typeof row?.pn === 'string' && row.pn.trim() ? row.pn.trim() : 'NA',
  });
  const defectRate = Number.isFinite(rawDefectRate)
    ? rawDefectRate <= 1
      ? Number((rawDefectRate * 100).toFixed(4))
      : Number(rawDefectRate.toFixed(4))
    : sortingQty > 0
      ? Number(((ngQty / sortingQty) * 100).toFixed(4))
      : 0;

  if (!date || !Number.isFinite(sortingQty) || !Number.isFinite(ngQty) || !Number.isFinite(defectRate)) {
    return null;
  }

  return {
    id: date,
    date,
    sortingQty,
    ngQty,
    defectRate,
    lfLotNo: normalizedIdentifiers.lfLotNo,
    pn: normalizedIdentifiers.pn,
    aseRtSch: typeof row?.aseRtSch === 'string' ? row.aseRtSch.trim() : '',
  };
}

function normalizeSortingIdentifiers({ lfLotNo, pn }) {
  const normalizedLfLotNo = lfLotNo || '';
  const normalizedPn = pn || 'NA';

  const lfLooksLikePn = looksLikePn(normalizedLfLotNo);
  const pnLooksLikeLfLot = looksLikeLfLotNo(normalizedPn);

  if (lfLooksLikePn && pnLooksLikeLfLot) {
    return {
      lfLotNo: normalizedPn,
      pn: normalizedLfLotNo,
    };
  }

  if (lfLooksLikePn && normalizedPn === 'NA') {
    return {
      lfLotNo: '',
      pn: normalizedLfLotNo,
    };
  }

  if (pnLooksLikeLfLot && !normalizedLfLotNo) {
    return {
      lfLotNo: normalizedPn,
      pn: 'NA',
    };
  }

  return {
    lfLotNo: normalizedLfLotNo,
    pn: normalizedPn,
  };
}

function looksLikePn(value) {
  return /^\d{10}$/.test(String(value || '').trim());
}

function looksLikeLfLotNo(value) {
  return /^\d{8}[A-Z0-9]+$/i.test(String(value || '').trim());
}

function normalizeIsoDate(value) {
  if (!value) {
    return '';
  }

  const text = String(value).trim();
  if (!text) {
    return '';
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  const normalized = text.replace(/[./]/g, '-');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toISOString().split('T')[0];
}

function buildImproveReportInput({ qualityCase, referenceDocs, messages }) {
  const intro = [
    'You are improving an existing supplier quality report together with a user.',
    'Revise the report based on the conversation while preserving correct case facts.',
    'Return the result in exactly this format:',
    '<<<ASSISTANT_MESSAGE>>>',
    'short explanation to the user',
    '<<<REPORT>>>',
    'full updated markdown report',
    `Supplier: ${qualityCase.supplier}`,
    `Part Name: ${qualityCase.partName}`,
    `Defect Phenomenon: ${qualityCase.defectPhenomenon}`,
    `Issue Date: ${qualityCase.date}`,
    `Severity: ${qualityCase.severity}`,
    `Report Type: ${qualityCase.reportType || 'Simple'}`,
    'Current report:',
    qualityCase.report || 'No report yet.',
  ].join('\n');

  const content = [{ type: 'input_text', text: intro }];

  if (qualityCase.reportReference?.trim()) {
    content.push({
      type: 'input_text',
      text: `Report format reference:\n${truncateText(qualityCase.reportReference, 5000)}`,
    });
  }

  for (const doc of referenceDocs || []) {
    if (doc.extractedText) {
      content.push({
        type: 'input_text',
        text: `Relevant reference [${doc.name}]:\n${truncateText(doc.extractedText, 2500)}`,
      });
      continue;
    }

    if (doc.type.startsWith('image/') && doc.content) {
      content.push({
        type: 'input_image',
        image_url: `data:${doc.type};base64,${doc.content}`,
      });
      content.push({
        type: 'input_text',
        text: `Relevant image reference attached: ${doc.name}`,
      });
    }
  }

  for (const file of qualityCase.files || []) {
    if (file.extractedText) {
      content.push({
        type: 'input_text',
        text: `Case attachment [${file.name}]:\n${truncateText(file.extractedText, 2500)}`,
      });
      continue;
    }

    if (file.type.startsWith('image/') && file.data) {
      content.push({
        type: 'input_image',
        image_url: `data:${file.type};base64,${file.data}`,
      });
      content.push({
        type: 'input_text',
        text: `Case image attachment: ${file.name}`,
      });
    }
  }

  for (const message of messages || []) {
    content.push({
      type: 'input_text',
      text: `${message.role === 'assistant' ? 'Assistant' : 'User'}: ${message.content}`,
    });
  }

  return [
    {
      role: 'user',
      content,
    },
  ];
}

function parseImprovedReportText(text) {
  const assistantMatch = text.match(/<<<ASSISTANT_MESSAGE>>>\s*([\s\S]*?)<<<REPORT>>>/);
  const reportMatch = text.match(/<<<REPORT>>>\s*([\s\S]*)$/);

  return {
    assistantMessage: assistantMatch?.[1]?.trim() || 'Report updated based on your request.',
    report: reportMatch?.[1]?.trim() || '',
  };
}

function extractText(output = []) {
  return output
    .flatMap((item) => item.content || [])
    .filter((content) => content.type === 'output_text')
    .map((content) => content.text)
    .join('\n')
    .trim();
}
