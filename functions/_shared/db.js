export async function listCases(db) {
  const { results } = await db
    .prepare(
      `SELECT id, supplier, part_name, defect_rate, defect_phenomenon, affected_batches, severity, date, status, report, report_type, industry, files_json, metrics_json
       FROM quality_cases
       ORDER BY date DESC, created_at DESC`
    )
    .all();

  return results.map(mapCaseRow);
}

export async function listReferenceDocs(db) {
  const { results } = await db
    .prepare(
      `SELECT id, name, type, content, added_at
       FROM reference_docs
       ORDER BY added_at DESC`
    )
    .all();

  return results.map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    content: row.content,
    addedAt: row.added_at,
  }));
}

export async function insertReferenceDoc(db, doc) {
  await db
    .prepare(
      `INSERT INTO reference_docs (id, name, type, content, added_at)
       VALUES (?1, ?2, ?3, ?4, ?5)`
    )
    .bind(doc.id, doc.name, doc.type, doc.content, doc.addedAt)
    .run();

  return doc;
}

export async function deleteReferenceDocById(db, id) {
  await db.prepare(`DELETE FROM reference_docs WHERE id = ?1`).bind(id).run();
}

export async function insertCase(db, qualityCase) {
  await db
    .prepare(
      `INSERT INTO quality_cases (
        id, supplier, part_name, defect_rate, defect_phenomenon, affected_batches, severity, date, status, report, report_type, industry, files_json, metrics_json
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`
    )
    .bind(
      qualityCase.id,
      qualityCase.supplier,
      qualityCase.partName,
      qualityCase.defectRate,
      qualityCase.defectPhenomenon,
      qualityCase.affectedBatches,
      qualityCase.severity,
      qualityCase.date,
      qualityCase.status,
      qualityCase.report ?? null,
      qualityCase.reportType ?? null,
      qualityCase.industry ?? null,
      JSON.stringify(qualityCase.files ?? []),
      JSON.stringify(qualityCase.metrics ?? [])
    )
    .run();

  return qualityCase;
}

export async function updateCaseReportById(db, id, report) {
  await db
    .prepare(
      `UPDATE quality_cases
       SET report = ?1, status = 'Completed', updated_at = CURRENT_TIMESTAMP
       WHERE id = ?2`
    )
    .bind(report, id)
    .run();

  const row = await db
    .prepare(
      `SELECT id, supplier, part_name, defect_rate, defect_phenomenon, affected_batches, severity, date, status, report, report_type, industry, files_json, metrics_json
       FROM quality_cases
       WHERE id = ?1`
    )
    .bind(id)
    .first();

  return row ? mapCaseRow(row) : null;
}

function mapCaseRow(row) {
  return {
    id: row.id,
    supplier: row.supplier,
    partName: row.part_name,
    defectRate: Number(row.defect_rate),
    defectPhenomenon: row.defect_phenomenon,
    affectedBatches: row.affected_batches,
    severity: row.severity,
    date: row.date,
    status: row.status,
    report: row.report ?? undefined,
    reportType: row.report_type ?? undefined,
    industry: row.industry ?? undefined,
    files: safeParseJson(row.files_json, []),
    metrics: safeParseJson(row.metrics_json, []),
  };
}

function safeParseJson(value, fallback) {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
