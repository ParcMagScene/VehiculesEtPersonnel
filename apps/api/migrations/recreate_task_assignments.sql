-- Recreate task_assignments with expanded schema for Google event task workflow
-- Safe because table has 0 rows

DROP TABLE IF EXISTS task_assignments;

CREATE TABLE task_assignments (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    display_event_id TEXT REFERENCES dynamic_display_events(id) ON DELETE SET NULL,
    person_id INTEGER REFERENCES persons(id) ON DELETE SET NULL,
    date TEXT NOT NULL,
    period TEXT CHECK(period IN ('AM', 'PM') OR period IS NULL),
    time TEXT,
    end_time TEXT,
    section TEXT NOT NULL DEFAULT 'manual',
    title TEXT,
    notes TEXT DEFAULT '',
    source_type TEXT DEFAULT 'manual' CHECK(source_type IN ('display_event', 'manual', 'google_event')),
    source_id TEXT,
    google_event_title TEXT,
    affaire_num TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'done', 'cancelled')),
    created_by INTEGER REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now')),
    modified_by INTEGER,
    modified_at TEXT
);

CREATE INDEX idx_ta_date ON task_assignments(date);
CREATE INDEX idx_ta_person ON task_assignments(person_id);
CREATE INDEX idx_ta_display ON task_assignments(display_event_id);
CREATE INDEX idx_ta_section ON task_assignments(section);
CREATE INDEX idx_ta_status ON task_assignments(status);
CREATE INDEX idx_ta_source ON task_assignments(source_type, source_id);
