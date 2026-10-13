CREATE TABLE IF NOT EXISTS pauladocce_pozadavky (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Nová',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_paula_pozadavky_created_at
  ON pauladocce_pozadavky (created_at DESC);
