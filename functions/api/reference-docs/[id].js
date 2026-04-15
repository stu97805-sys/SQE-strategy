import { deleteReferenceDocById } from '../../_shared/db.js';

export async function onRequestDelete(context) {
  await deleteReferenceDocById(context.env.DB, context.params.id);
  return new Response(null, { status: 204 });
}
