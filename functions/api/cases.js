import { insertCase, listReferenceDocs, updateCaseReportById } from '../_shared/db.js';
import { generateReport } from '../_shared/openai.js';

export async function onRequestPost(context) {
  const body = await context.request.json();
  const qualityCase = {
    ...body,
    status: 'Analyzing',
  };

  await insertCase(context.env.DB, qualityCase);

  try {
    const referenceDocs = await listReferenceDocs(context.env.DB);
    const report = await generateReport({
      apiKey: context.env.OPENAI_API_KEY,
      model: context.env.OPENAI_MODEL || 'gpt-4.1-mini',
      qualityCase,
      referenceDocs,
    });

    const updatedCase = await updateCaseReportById(context.env.DB, qualityCase.id, report);
    return Response.json(updatedCase, { status: 201 });
  } catch (error) {
    const fallbackReport = `Error generating report with OpenAI.\n\n${error instanceof Error ? error.message : 'Unknown error.'}`;
    const updatedCase = await updateCaseReportById(context.env.DB, qualityCase.id, fallbackReport);
    return Response.json(updatedCase, { status: 201 });
  }
}
