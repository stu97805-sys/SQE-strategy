import { deleteCaseById, findCaseById, updateCaseById } from '../../_shared/db.js';

export async function onRequestPut(context) {
  const body = await context.request.json();
  const currentCase = await findCaseById(context.env.DB, context.params.id);

  if (!currentCase) {
    return new Response('Case not found.', { status: 404 });
  }

  const updatedCase = await updateCaseById(context.env.DB, context.params.id, {
    ...currentCase,
    ...body,
  });

  return Response.json(updatedCase);
}

export async function onRequestDelete(context) {
  const deletedCase = await deleteCaseById(context.env.DB, context.params.id);

  if (!deletedCase) {
    return new Response('Case not found.', { status: 404 });
  }

  return Response.json(deletedCase);
}
