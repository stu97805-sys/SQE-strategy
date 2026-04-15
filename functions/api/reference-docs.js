import { insertReferenceDoc } from '../_shared/db.js';

export async function onRequestPost(context) {
  const body = await context.request.json();
  const doc = {
    id: crypto.randomUUID(),
    name: body.name,
    type: body.type,
    content: body.content,
    addedAt: new Date().toISOString(),
  };

  await insertReferenceDoc(context.env.DB, doc);
  return Response.json(doc, { status: 201 });
}
