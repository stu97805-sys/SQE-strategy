CREATE TABLE IF NOT EXISTS quality_cases (
  id TEXT PRIMARY KEY,
  supplier TEXT NOT NULL,
  part_name TEXT NOT NULL,
  defect_rate REAL NOT NULL,
  defect_phenomenon TEXT NOT NULL,
  affected_batches TEXT NOT NULL,
  severity TEXT NOT NULL,
  date TEXT NOT NULL,
  status TEXT NOT NULL,
  report TEXT,
  report_type TEXT,
  report_reference TEXT,
  industry TEXT,
  files_json TEXT NOT NULL DEFAULT '[]',
  metrics_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reference_docs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  extracted_text TEXT,
  source_case_id TEXT,
  source_kind TEXT,
  auto_archived INTEGER NOT NULL DEFAULT 0,
  added_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sorting_cases (
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
);
