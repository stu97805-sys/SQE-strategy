import { insertCase, replaceAutoArchivedReferencesForCase, updateCaseReportById } from '../../_shared/db.js';
import { extractQualityCaseFromDocument } from '../../_shared/openai.js';

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();

    if (!body?.extractedText && !body?.data) {
      return new Response('Historical report upload did not include readable content.', { status: 400 });
    }

    const extracted = await extractQualityCaseFromDocument({
      apiKey: context.env.OPENAI_API_KEY,
      model: context.env.OPENAI_MODEL || 'gpt-4.1-mini',
      document: body,
    });

    const qualityCase = {
      id: crypto.randomUUID(),
      supplier: extracted.supplier,
      partName: extracted.partName,
      defectRate: extracted.defectRate,
      defectPhenomenon: extracted.defectPhenomenon,
      affectedBatches: extracted.affectedBatches,
      severity: extracted.severity,
      date: extracted.date,
      status: 'Complete',
      reportType: extracted.reportType,
      industry: extracted.industry,
      files: [
        {
          name: body.name,
          type: body.type,
          data: body.data ?? '',
          extractedText: body.extractedText ?? '',
        },
      ],
    };

    await insertCase(context.env.DB, qualityCase);
    const updatedCase = await updateCaseReportById(context.env.DB, qualityCase.id, extracted.report || body.extractedText || '');
    await replaceAutoArchivedReferencesForCase(context.env.DB, qualityCase, extracted.report || body.extractedText || '');
    return Response.json(updatedCase, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to import historical quality case.';
    return new Response(message, { status: 500 });
  }
}
