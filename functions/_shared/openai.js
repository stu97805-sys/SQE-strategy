function decodeBase64Text(content) {
  try {
    return atob(content);
  } catch {
    return content;
  }
}

function buildInputItems({ qualityCase, referenceDocs }) {
  const promptLines = [
    'You are a senior supplier quality engineer and customer quality engineer.',
    `Generate a professional ${qualityCase.reportType || 'Simple'} quality report in Markdown.`,
    `Industry: ${qualityCase.industry || 'General'}`,
    `Supplier: ${qualityCase.supplier}`,
    `Part Name: ${qualityCase.partName}`,
    `Defect Rate: ${qualityCase.defectRate}%`,
    `Defect Phenomenon: ${qualityCase.defectPhenomenon}`,
    `Affected Batches: ${qualityCase.affectedBatches}`,
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
    'Be specific, practical, and technically credible.',
    'Reference the supplied standards when appropriate.',
  ].filter(Boolean);

  const items = [
    {
      role: 'user',
      content: [{ type: 'input_text', text: promptLines.join('\n') }],
    },
  ];

  for (const doc of referenceDocs) {
    if (doc.type === 'text/plain' || doc.type === 'text/csv') {
      items[0].content.push({
        type: 'input_text',
        text: `Reference document [${doc.name}]:\n${decodeBase64Text(doc.content)}`,
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

  for (const file of qualityCase.files || []) {
    if (file.type === 'text/plain' || file.type === 'text/csv') {
      items[0].content.push({
        type: 'input_text',
        text: `Attachment [${file.name}]:\n${decodeBase64Text(file.data)}`,
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

export async function generateReport({ apiKey, model, qualityCase, referenceDocs }) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: buildInputItems({ qualityCase, referenceDocs }),
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

function extractText(output = []) {
  return output
    .flatMap((item) => item.content || [])
    .filter((content) => content.type === 'output_text')
    .map((content) => content.text)
    .join('\n')
    .trim();
}
