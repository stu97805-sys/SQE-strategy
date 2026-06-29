import { clearCaseReportById, updateCaseReportById } from '../../../_shared/db.js';

export async function onRequestPut(context) {
  const body = await context.request.json();
  const updatedCase = await updateCaseReportById(context.env.DB, context.params.id, body.report ?? '');

  if (!updatedCase) {
    return new Response('Case not found.', { status: 404 });
  }

  return Response.json(updatedCase);
}

export async function onRequestDelete(context) {
  const updatedCase = await clearCaseReportById(context.env.DB, context.params.id);

  if (!updatedCase) {
    return new Response('Case not found.', { status: 404 });
  }

  return Response.json(updatedCase);
}
