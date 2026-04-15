import { updateCaseReportById } from '../../../_shared/db.js';

export async function onRequestPut(context) {
  const body = await context.request.json();
  const updatedCase = await updateCaseReportById(context.env.DB, context.params.id, body.report ?? '');

  if (!updatedCase) {
    return new Response('Case not found.', { status: 404 });
  }

  return Response.json(updatedCase);
}
