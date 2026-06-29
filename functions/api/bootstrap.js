import { listCases, listReferenceDocs, listSortingCases } from '../_shared/db.js';

export async function onRequestGet(context) {
  const [cases, referenceDocs, sortingCases] = await Promise.all([
    listCases(context.env.DB),
    listReferenceDocs(context.env.DB),
    listSortingCases(context.env.DB),
  ]);

  return Response.json({ cases, referenceDocs, sortingCases });
}
