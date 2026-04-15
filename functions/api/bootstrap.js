import { listCases, listReferenceDocs } from '../_shared/db.js';

export async function onRequestGet(context) {
  const [cases, referenceDocs] = await Promise.all([
    listCases(context.env.DB),
    listReferenceDocs(context.env.DB),
  ]);

  return Response.json({ cases, referenceDocs });
}
