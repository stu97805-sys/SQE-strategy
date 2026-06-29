import { upsertSortingCases } from '../../_shared/db.js';
import { extractSortingCasesFromWorkbook } from '../../_shared/openai.js';

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const workbookText = typeof body.workbookText === 'string' ? body.workbookText.trim() : '';

    if (!workbookText) {
      return new Response('Sorting workbook text is empty. Please upload a readable Excel file.', { status: 400 });
    }

    const sortingRows = await extractSortingCasesFromWorkbook({
      apiKey: context.env.OPENAI_API_KEY,
      model: context.env.OPENAI_MODEL || 'gpt-4.1-mini',
      workbookText,
      sourceFileName: body.sourceFileName ?? 'sorting-upload.xlsx',
    });

    const sortingCases = await upsertSortingCases(context.env.DB, sortingRows);
    return Response.json(sortingCases, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to import sorting Excel.';
    return new Response(message, { status: 500 });
  }
}
