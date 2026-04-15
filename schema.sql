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
  added_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
