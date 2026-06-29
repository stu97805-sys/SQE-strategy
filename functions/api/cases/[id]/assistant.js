import { findCaseById, listReferenceDocs, updateCaseReportById } from '../../../_shared/db.js';
import { improveReportWithConversation } from '../../../_shared/openai.js';

export async function onRequestPost(context) {
  const body = await context.request.json();
  const qualityCase = await findCaseById(context.env.DB, context.params.id);

  if (!qualityCase) {
    return new Response('Case not found.', { status: 404 });
  }

  const referenceDocs = await listReferenceDocs(context.env.DB);
  const relevantReferences = referenceDocs
    .filter((doc) => {
      const haystack = [
        doc.name,
        doc.extractedText,
        qualityCase.supplier,
        qualityCase.partName,
        qualityCase.defectPhenomenon,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return (
        haystack.includes(qualityCase.supplier.toLowerCase()) ||
        haystack.includes(qualityCase.partName.toLowerCase()) ||
        haystack.includes(qualityCase.defectPhenomenon.toLowerCase())
      );
    })
    .slice(0, 8);

  const improved = await improveReportWithConversation({
    apiKey: context.env.OPENAI_API_KEY,
    model: context.env.OPENAI_MODEL || 'gpt-4.1-mini',
    qualityCase,
    referenceDocs: relevantReferences,
    messages: body.messages ?? [],
  });

  const updatedCase = await updateCaseReportById(context.env.DB, qualityCase.id, improved.report);
  return Response.json({
    assistantMessage: improved.assistantMessage,
    updatedCase,
  });
}
