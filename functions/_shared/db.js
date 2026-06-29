let schemaReady;

async function ensureSchema(db) {
  if (!schemaReady) {
    schemaReady = (async () => {
      try {
        await db.prepare(`ALTER TABLE quality_cases ADD COLUMN report_reference TEXT`).run();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes('duplicate column name')) {
          throw error;
        }
      }

      try {
        await db.prepare(`ALTER TABLE reference_docs ADD COLUMN source_case_id TEXT`).run();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes('duplicate column name')) {
          throw error;
        }
      }

      try {
        await db.prepare(`ALTER TABLE reference_docs ADD COLUMN source_kind TEXT`).run();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes('duplicate column name')) {
          throw error;
        }
      }

      try {
        await db.prepare(`ALTER TABLE reference_docs ADD COLUMN auto_archived INTEGER NOT NULL DEFAULT 0`).run();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes('duplicate column name')) {
          throw error;
        }
      }

      await db
        .prepare(
          `CREATE TABLE IF NOT EXISTS sorting_cases (
            sorting_date TEXT PRIMARY KEY,
            sorting_qty INTEGER NOT NULL,
            ng_qty INTEGER NOT NULL,
            defect_rate REAL NOT NULL,
            lf_lot_no TEXT,
            pn TEXT,
            ase_rt_sch TEXT,
            source_file_name TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )`
        )
        .run();

      try {
        await db.prepare(`ALTER TABLE sorting_cases ADD COLUMN lf_lot_no TEXT`).run();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes('duplicate column name')) {
          throw error;
        }
      }

      try {
        await db.prepare(`ALTER TABLE sorting_cases ADD COLUMN pn TEXT`).run();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes('duplicate column name')) {
          throw error;
        }
      }

      try {
        await db.prepare(`ALTER TABLE sorting_cases ADD COLUMN ase_rt_sch TEXT`).run();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes('duplicate column name')) {
          throw error;
        }
      }
    })();
  }

  return schemaReady;
}

export async function listCases(db) {
  await ensureSchema(db);
  const { results } = await db
    .prepare(
      `SELECT id, supplier, part_name, defect_rate, defect_phenomenon, affected_batches, severity, date, status, report, report_type, report_reference, industry, files_json, metrics_json
       FROM quality_cases
       ORDER BY date DESC, created_at DESC`
    )
    .all();

  return results.map(mapCaseRow);
}

export async function listReferenceDocs(db) {
  await ensureSchema(db);
  const { results } = await db
    .prepare(
      `SELECT id, name, type, content, extracted_text, added_at, source_case_id, source_kind, auto_archived
       FROM reference_docs
       ORDER BY added_at DESC`
    )
    .all();

  return results.map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    content: row.content,
    extractedText: row.extracted_text ?? undefined,
    addedAt: row.added_at,
    sourceCaseId: row.source_case_id ?? undefined,
    sourceKind: row.source_kind ?? undefined,
    autoArchived: Boolean(row.auto_archived),
  }));
}

export async function listSortingCases(db) {
  await ensureSchema(db);
  const { results } = await db
    .prepare(
      `SELECT sorting_date, sorting_qty, ng_qty, defect_rate, lf_lot_no, pn, ase_rt_sch, source_file_name
       FROM sorting_cases
       ORDER BY sorting_date DESC`
    )
    .all();

  return results.map((row) => {
    const identifiers = normalizeSortingIdentifiers({
      lfLotNo: row.lf_lot_no ?? row.source_file_name ?? '',
      pn: row.pn ?? 'NA',
    });

    return {
      id: row.sorting_date,
      date: row.sorting_date,
      sortingQty: Number(row.sorting_qty),
      ngQty: Number(row.ng_qty),
      defectRate: Number(row.defect_rate),
      lfLotNo: identifiers.lfLotNo || undefined,
      pn: identifiers.pn,
      aseRtSch: row.ase_rt_sch ?? undefined,
    };
  });
}

export async function upsertSortingCases(db, rows) {
  await ensureSchema(db);

  for (const row of rows) {
    await db
      .prepare(
        `INSERT INTO sorting_cases (sorting_date, sorting_qty, ng_qty, defect_rate, lf_lot_no, pn, ase_rt_sch, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, CURRENT_TIMESTAMP)
         ON CONFLICT(sorting_date) DO UPDATE SET
           sorting_qty = excluded.sorting_qty,
           ng_qty = excluded.ng_qty,
           defect_rate = excluded.defect_rate,
           lf_lot_no = excluded.lf_lot_no,
           pn = excluded.pn,
           ase_rt_sch = excluded.ase_rt_sch,
           updated_at = CURRENT_TIMESTAMP`
      )
      .bind(
        row.date,
        row.sortingQty,
        row.ngQty,
        row.defectRate,
        row.lfLotNo ?? null,
        row.pn ?? 'NA',
        row.aseRtSch ?? null
      )
      .run();
  }

  return listSortingCases(db);
}

export async function insertReferenceDoc(db, doc) {
  await ensureSchema(db);
  await db
    .prepare(
      `INSERT INTO reference_docs (id, name, type, content, extracted_text, added_at, source_case_id, source_kind, auto_archived)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
    )
    .bind(
      doc.id,
      doc.name,
      doc.type,
      doc.content,
      doc.extractedText ?? null,
      doc.addedAt,
      doc.sourceCaseId ?? null,
      doc.sourceKind ?? 'manual',
      doc.autoArchived ? 1 : 0
    )
    .run();

  return doc;
}

export async function replaceAutoArchivedReferencesForCase(db, qualityCase, report) {
  await ensureSchema(db);

  await db
    .prepare(`DELETE FROM reference_docs WHERE source_case_id = ?1 AND auto_archived = 1`)
    .bind(qualityCase.id)
    .run();

  const docs = [];
  const addedAt = new Date().toISOString();

  for (const file of qualityCase.files ?? []) {
    if (!file.data && !file.extractedText) {
      continue;
    }

    docs.push({
      id: crypto.randomUUID(),
      name: `[AUTO][Attachment] ${qualityCase.supplier} - ${qualityCase.partName} - ${file.name}`,
      type: file.type || 'application/octet-stream',
      content: file.data ?? '',
      extractedText: file.extractedText ?? null,
      addedAt,
      sourceCaseId: qualityCase.id,
      sourceKind: 'case_attachment',
      autoArchived: true,
    });
  }

  if (report?.trim()) {
    docs.push({
      id: crypto.randomUUID(),
      name: `[AUTO][Report] ${qualityCase.supplier} - ${qualityCase.partName} - ${qualityCase.date}`,
      type: 'text/markdown',
      content: report,
      extractedText: report,
      addedAt,
      sourceCaseId: qualityCase.id,
      sourceKind: 'generated_report',
      autoArchived: true,
    });
  }

  for (const doc of docs) {
    await insertReferenceDoc(db, doc);
  }

  return docs;
}

export async function deleteReferenceDocById(db, id) {
  await ensureSchema(db);
  await db.prepare(`DELETE FROM reference_docs WHERE id = ?1`).bind(id).run();
}

export async function insertCase(db, qualityCase) {
  await ensureSchema(db);
  await db
    .prepare(
      `INSERT INTO quality_cases (
        id, supplier, part_name, defect_rate, defect_phenomenon, affected_batches, severity, date, status, report, report_type, report_reference, industry, files_json, metrics_json
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)`
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
      qualityCase.reportReference ?? null,
      qualityCase.industry ?? null,
      JSON.stringify(qualityCase.files ?? []),
      JSON.stringify(qualityCase.metrics ?? [])
    )
    .run();

  return qualityCase;
}

export async function deleteCaseById(db, id) {
  await ensureSchema(db);

  const row = await db
    .prepare(
      `SELECT id, supplier, part_name, defect_rate, defect_phenomenon, affected_batches, severity, date, status, report, report_type, report_reference, industry, files_json, metrics_json
       FROM quality_cases
       WHERE id = ?1`
    )
    .bind(id)
    .first();

  if (!row) {
    return null;
  }

  await db.prepare(`DELETE FROM quality_cases WHERE id = ?1`).bind(id).run();
  return mapCaseRow(row);
}

export async function findCaseById(db, id) {
  await ensureSchema(db);

  const row = await db
    .prepare(
      `SELECT id, supplier, part_name, defect_rate, defect_phenomenon, affected_batches, severity, date, status, report, report_type, report_reference, industry, files_json, metrics_json
       FROM quality_cases
       WHERE id = ?1`
    )
    .bind(id)
    .first();

  return row ? mapCaseRow(row) : null;
}

export async function updateCaseById(db, id, updates) {
  await ensureSchema(db);

  await db
    .prepare(
      `UPDATE quality_cases
       SET supplier = ?1,
           part_name = ?2,
           defect_rate = ?3,
           defect_phenomenon = ?4,
           affected_batches = ?5,
           severity = ?6,
           date = ?7,
           status = ?8,
           report_type = ?9,
           report_reference = ?10,
           industry = ?11,
           files_json = ?12,
           metrics_json = ?13,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?14`
    )
    .bind(
      updates.supplier,
      updates.partName,
      updates.defectRate,
      updates.defectPhenomenon,
      updates.affectedBatches,
      updates.severity,
      updates.date,
      normalizeCaseStatus(updates.status),
      updates.reportType ?? null,
      updates.reportReference ?? null,
      updates.industry ?? null,
      JSON.stringify(updates.files ?? []),
      JSON.stringify(updates.metrics ?? []),
      id
    )
    .run();

  return findCaseById(db, id);
}

export async function updateCaseReportById(db, id, report) {
  await ensureSchema(db);
  const normalizedReport = typeof report === 'string' ? report : null;
  const currentCase = await findCaseById(db, id);
  const currentStatus = normalizeCaseStatus(currentCase?.status);
  const nextStatus = normalizedReport && normalizedReport.trim()
    ? currentStatus === 'Analyzing'
      ? 'Tracking'
      : currentStatus === 'Complete'
        ? 'Complete'
        : 'Tracking'
    : 'Tracking';

  await db
    .prepare(
      `UPDATE quality_cases
       SET report = ?1, status = ?2, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?3`
    )
    .bind(normalizedReport, nextStatus, id)
    .run();

  const row = await db
    .prepare(
      `SELECT id, supplier, part_name, defect_rate, defect_phenomenon, affected_batches, severity, date, status, report, report_type, report_reference, industry, files_json, metrics_json
       FROM quality_cases
       WHERE id = ?1`
    )
    .bind(id)
    .first();

  return row ? mapCaseRow(row) : null;
}

export async function clearCaseReportById(db, id) {
  return updateCaseReportById(db, id, null);
}

export async function listCompletedCaseReferences(db, limit = 3) {
  await ensureSchema(db);
  const { results } = await db
    .prepare(
      `SELECT supplier, part_name, defect_phenomenon, severity, report_type, report, date
       FROM quality_cases
       WHERE status IN ('Complete', 'Completed') AND report IS NOT NULL AND TRIM(report) != ''
       ORDER BY date DESC, updated_at DESC
       LIMIT ?1`
    )
    .bind(limit)
    .all();

  return results.map((row) => ({
    supplier: row.supplier,
    partName: row.part_name,
    defectPhenomenon: row.defect_phenomenon,
    severity: row.severity,
    reportType: row.report_type,
    date: row.date,
    report: row.report,
  }));
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
    status: normalizeCaseStatus(row.status),
    report: row.report ?? undefined,
    reportType: row.report_type ?? undefined,
    reportReference: row.report_reference ?? undefined,
    industry: row.industry ?? undefined,
    files: safeParseJson(row.files_json, []),
    metrics: safeParseJson(row.metrics_json, []),
  };
}

function normalizeCaseStatus(status) {
  if (status === 'Completed') return 'Complete';
  if (status === 'Pending') return 'Tracking';
  if (status === 'Analyzing') return 'Analyzing';
  if (status === 'Complete') return 'Complete';
  return 'Tracking';
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

function normalizeSortingIdentifiers({ lfLotNo, pn }) {
  const normalizedLfLotNo = String(lfLotNo || '').trim();
  const normalizedPn = String(pn || 'NA').trim() || 'NA';

  const lfLooksLikePn = looksLikePn(normalizedLfLotNo);
  const pnLooksLikeLfLot = looksLikeLfLotNo(normalizedPn);

  if (lfLooksLikePn && pnLooksLikeLfLot) {
    return {
      lfLotNo: normalizedPn,
      pn: normalizedLfLotNo,
    };
  }

  if (lfLooksLikePn && normalizedPn === 'NA') {
    return {
      lfLotNo: '',
      pn: normalizedLfLotNo,
    };
  }

  if (pnLooksLikeLfLot && !normalizedLfLotNo) {
    return {
      lfLotNo: normalizedPn,
      pn: 'NA',
    };
  }

  return {
    lfLotNo: normalizedLfLotNo,
    pn: normalizedPn,
  };
}

function looksLikePn(value) {
  return /^\d{10}$/.test(String(value || '').trim());
}

function looksLikeLfLotNo(value) {
  return /^\d{8}[A-Z0-9]+$/i.test(String(value || '').trim());
}
