-- ============================================================
-- RNGPIT AGHMS - Complete Database Schema
-- Run this in your Supabase SQL Editor or via migration
-- ============================================================

-- ── Extensions ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";      -- full-text search

-- ── Enums ───────────────────────────────────────────────────
CREATE TYPE user_role AS ENUM (
  'director', 'principal', 'hod', 'faculty', 'tpo', 'accounts', 'exam_cell', 'admin'
);

CREATE TYPE meeting_status AS ENUM (
  'draft', 'pending_approval', 'approved', 'circulated', 'conducted', 'cancelled'
);

CREATE TYPE document_status AS ENUM (
  'pending', 'submitted', 'submitted_late', 'approved', 'revision_requested', 'overdue'
);

CREATE TYPE action_item_status AS ENUM (
  'pending', 'in_progress', 'completed', 'delayed'
);

CREATE TYPE notification_priority AS ENUM ('low', 'medium', 'high', 'critical');

-- ── Core Tables ──────────────────────────────────────────────

-- Departments
CREATE TABLE IF NOT EXISTS departments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  code        TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Users (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS users (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT NOT NULL UNIQUE,
  full_name    TEXT NOT NULL,
  role         user_role NOT NULL DEFAULT 'faculty',
  department_id UUID REFERENCES departments(id),
  phone        TEXT,
  employee_id  TEXT UNIQUE,
  designation  TEXT,
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Academic Years
CREATE TABLE IF NOT EXISTS academic_years (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  year_name   TEXT NOT NULL,          -- e.g. "2024-25"
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  is_current  BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Semesters
CREATE TABLE IF NOT EXISTS semesters (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  academic_year_id  UUID REFERENCES academic_years(id) ON DELETE CASCADE,
  semester_number   INT NOT NULL,      -- 1-8
  semester_type     TEXT NOT NULL,     -- 'odd' | 'even'
  start_date        DATE,
  end_date          DATE,
  is_current        BOOLEAN DEFAULT FALSE
);

-- ── Meeting Management ───────────────────────────────────────

-- Annual Meeting Calendar
CREATE TABLE IF NOT EXISTS meeting_calendar (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  academic_year_id  UUID REFERENCES academic_years(id),
  month             INT NOT NULL,
  meeting_date      DATE NOT NULL,
  semester_focus    TEXT,             -- 'odd' | 'even'
  notes             TEXT,
  created_by        UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Meetings (HOD Meetings)
CREATE TABLE IF NOT EXISTS meetings (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  calendar_id      UUID REFERENCES meeting_calendar(id),
  agenda_title     TEXT NOT NULL,
  meeting_date     DATE NOT NULL,
  meeting_time     TIME,
  venue            TEXT,
  status           meeting_status NOT NULL DEFAULT 'draft',
  circular_number  TEXT UNIQUE,
  circular_pdf_url TEXT,
  circulated_at    TIMESTAMPTZ,
  created_by       UUID REFERENCES users(id),
  approved_by      UUID REFERENCES users(id),
  approved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Agenda Items
CREATE TABLE IF NOT EXISTS agenda_items (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id              UUID REFERENCES meetings(id) ON DELETE CASCADE,
  category                TEXT NOT NULL,
  title                   TEXT NOT NULL,
  description             TEXT,
  responsible_department_id UUID REFERENCES departments(id),
  priority_level          INT DEFAULT 2,     -- 1=low, 2=medium, 3=high, 4=critical
  deadline                DATE,
  required_documents      TEXT[],
  order_number            INT DEFAULT 1,
  is_carryforward         BOOLEAN DEFAULT FALSE,
  carried_from_item_id    UUID REFERENCES agenda_items(id),
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Minutes of Meeting
CREATE TABLE IF NOT EXISTS meeting_mom (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id     UUID REFERENCES meetings(id) ON DELETE CASCADE,
  mom_content    JSONB,              -- structured discussion notes
  attendees      JSONB,              -- [{user_id, name, dept, status}]
  created_by     UUID REFERENCES users(id),
  pdf_url        TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Action Items
CREATE TABLE IF NOT EXISTS action_items (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id              UUID REFERENCES meetings(id),
  mom_id                  UUID REFERENCES meeting_mom(id),
  description             TEXT NOT NULL,
  assigned_to_user_id     UUID REFERENCES users(id),
  assigned_to_department_id UUID REFERENCES departments(id),
  deadline                DATE,
  status                  action_item_status DEFAULT 'pending',
  completion_percentage   INT DEFAULT 0,
  completion_proof_url    TEXT,
  completed_at            TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ATR Updates
CREATE TABLE IF NOT EXISTS atr_updates (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action_item_id      UUID REFERENCES action_items(id) ON DELETE CASCADE,
  update_date         DATE DEFAULT CURRENT_DATE,
  progress_description TEXT,
  obstacles           TEXT,
  updated_by          UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── Document Management ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS documents (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id      UUID REFERENCES meetings(id),
  agenda_item_id  UUID REFERENCES agenda_items(id),
  department_id   UUID REFERENCES departments(id) NOT NULL,
  uploaded_by     UUID REFERENCES users(id),
  document_type   TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  file_url        TEXT,
  file_size       BIGINT,            -- bytes
  mime_type       TEXT,
  version_number  INT DEFAULT 1,
  status          document_status DEFAULT 'pending',
  submitted_at    TIMESTAMPTZ,
  reviewed_by     UUID REFERENCES users(id),
  reviewed_at     TIMESTAMPTZ,
  review_comments TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Document versions
CREATE TABLE IF NOT EXISTS document_versions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id      UUID REFERENCES documents(id) ON DELETE CASCADE,
  version_number   INT NOT NULL,
  file_url         TEXT NOT NULL,
  uploaded_by      UUID REFERENCES users(id),
  change_description TEXT,
  uploaded_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Academic Performance ──────────────────────────────────────

-- Students
CREATE TABLE IF NOT EXISTS students (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enrollment_number  TEXT NOT NULL UNIQUE,
  full_name          TEXT NOT NULL,
  department_id      UUID REFERENCES departments(id),
  admission_year     INT,
  current_semester   INT,
  email              TEXT,
  phone              TEXT,
  parent_phone       TEXT,
  category           TEXT DEFAULT 'General',  -- General/SC/ST/OBC/EWS
  is_active          BOOLEAN DEFAULT TRUE,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Subjects
CREATE TABLE IF NOT EXISTS subjects (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_code   TEXT NOT NULL UNIQUE,
  subject_name   TEXT NOT NULL,
  department_id  UUID REFERENCES departments(id),
  semester       INT NOT NULL,
  credits        INT DEFAULT 4,
  theory_marks   INT DEFAULT 70,
  practical_marks INT DEFAULT 30,
  is_active      BOOLEAN DEFAULT TRUE
);

-- Results
CREATE TABLE IF NOT EXISTS results (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id       UUID REFERENCES students(id),
  subject_id       UUID REFERENCES subjects(id),
  academic_year_id UUID REFERENCES academic_years(id),
  exam_type        TEXT NOT NULL,   -- 'midsem' | 'endsem' | 'external'
  marks_obtained   NUMERIC(5,2),
  total_marks      NUMERIC(5,2),
  grade            TEXT,
  sgpa             NUMERIC(4,2),
  cgpa             NUMERIC(4,2),
  exam_date        DATE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- CO Attainment
CREATE TABLE IF NOT EXISTS co_attainment (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id            UUID REFERENCES subjects(id),
  co_number             INT NOT NULL,
  co_description        TEXT,
  attainment_percentage NUMERIC(5,2),
  semester              INT,
  academic_year_id      UUID REFERENCES academic_years(id),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Weak Students
CREATE TABLE IF NOT EXISTS weak_students (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id         UUID REFERENCES students(id),
  academic_year_id   UUID REFERENCES academic_years(id),
  identified_date    DATE DEFAULT CURRENT_DATE,
  reason             TEXT,
  subjects_affected  TEXT[],
  assigned_faculty_id UUID REFERENCES users(id),
  status             TEXT DEFAULT 'identified',  -- identified/under_remedial/improved/unchanged
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Attendance Summary
CREATE TABLE IF NOT EXISTS attendance_summary (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id           UUID REFERENCES students(id),
  subject_id           UUID REFERENCES subjects(id),
  academic_year_id     UUID REFERENCES academic_years(id),
  semester             INT,
  total_classes        INT DEFAULT 0,
  attended_classes     INT DEFAULT 0,
  attendance_percentage NUMERIC(5,2),
  last_updated         TIMESTAMPTZ DEFAULT NOW()
);

-- ── Placement ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS companies (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name TEXT NOT NULL,
  industry     TEXT,
  company_type TEXT,           -- 'core' | 'IT' | 'consulting' | 'startup'
  hr_contact   TEXT,
  email        TEXT,
  phone        TEXT,
  website      TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS placement_drives (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id         UUID REFERENCES companies(id),
  drive_date         DATE,
  roles_offered      TEXT,
  package_range      TEXT,
  eligibility_criteria TEXT,
  selection_process  TEXT,
  visit_type         TEXT DEFAULT 'on_campus',  -- 'on_campus' | 'virtual'
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS placement_offers (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id        UUID REFERENCES students(id),
  company_id        UUID REFERENCES companies(id),
  drive_id          UUID REFERENCES placement_drives(id),
  role              TEXT,
  package_ctc       NUMERIC(10,2),
  joining_date      DATE,
  offer_letter_url  TEXT,
  acceptance_status TEXT DEFAULT 'pending',
  joining_confirmed BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── Fees ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS student_fee_records (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id       UUID REFERENCES students(id),
  academic_year_id UUID REFERENCES academic_years(id),
  semester         INT,
  total_fee        NUMERIC(10,2),
  scholarship_amount NUMERIC(10,2) DEFAULT 0,
  net_payable      NUMERIC(10,2),
  total_paid       NUMERIC(10,2) DEFAULT 0,
  balance          NUMERIC(10,2),
  last_payment_date DATE,
  status           TEXT DEFAULT 'pending',  -- paid/partial/pending/defaulter
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── Notifications ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID REFERENCES users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  title             TEXT NOT NULL,
  message           TEXT,
  priority          notification_priority DEFAULT 'medium',
  read_status       BOOLEAN DEFAULT FALSE,
  read_at           TIMESTAMPTZ,
  action_url        TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── Compliance ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS compliance_documents (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  criterion_name   TEXT NOT NULL,    -- NBA/NAAC criterion
  sub_criterion    TEXT,
  document_title   TEXT NOT NULL,
  document_url     TEXT,
  uploaded_by      UUID REFERENCES users(id),
  department_id    UUID REFERENCES departments(id),
  uploaded_date    DATE DEFAULT CURRENT_DATE,
  academic_year_id UUID REFERENCES academic_years(id),
  approval_status  TEXT DEFAULT 'pending',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Program Outcomes
CREATE TABLE IF NOT EXISTS program_outcomes (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  department_id  UUID REFERENCES departments(id),
  po_number      INT NOT NULL,
  po_description TEXT NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Course Outcomes
CREATE TABLE IF NOT EXISTS course_outcomes (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id     UUID REFERENCES subjects(id),
  co_number      INT NOT NULL,
  co_description TEXT NOT NULL,
  po_mapping     INT[],    -- array of PO numbers
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Audit Logs ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_logs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES users(id),
  action_type  TEXT NOT NULL,
  entity_type  TEXT,
  entity_id    UUID,
  changes      JSONB,
  ip_address   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ─────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_meetings_status    ON meetings(status);
CREATE INDEX IF NOT EXISTS idx_meetings_date      ON meetings(meeting_date);
CREATE INDEX IF NOT EXISTS idx_documents_dept     ON documents(department_id);
CREATE INDEX IF NOT EXISTS idx_documents_meeting  ON documents(meeting_id);
CREATE INDEX IF NOT EXISTS idx_documents_status   ON documents(status);
CREATE INDEX IF NOT EXISTS idx_students_dept      ON students(department_id);
CREATE INDEX IF NOT EXISTS idx_results_student    ON results(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance_summary(student_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read_status);
CREATE INDEX IF NOT EXISTS idx_audit_user         ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity       ON audit_logs(entity_type, entity_id);

-- ── Seed Data: Departments ──────────────────────────────────

INSERT INTO departments (code, name) VALUES
  ('CE', 'Computer Engineering'),
  ('ME', 'Mechanical Engineering'),
  ('EE', 'Electrical Engineering'),
  ('EC', 'Electronics & Communication Engineering'),
  ('CV', 'Civil Engineering'),
  ('IT', 'Information Technology'),
  ('CH', 'Chemical Engineering'),
  ('IC', 'Instrumentation & Control Engineering')
ON CONFLICT (code) DO NOTHING;

-- Seed academic year 2024-25
INSERT INTO academic_years (year_name, start_date, end_date, is_current)
VALUES ('2024-25', '2024-07-01', '2025-05-31', TRUE)
ON CONFLICT DO NOTHING;

-- ── Row Level Security ──────────────────────────────────────
-- Enable RLS on all tables
ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_mom        ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents          ENABLE ROW LEVEL SECURITY;
ALTER TABLE students           ENABLE ROW LEVEL SECURITY;
ALTER TABLE results            ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE placement_offers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_fee_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE weak_students      ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's role
CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS TEXT AS $$
  SELECT role::TEXT FROM users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

-- Helper function to get current user's department
CREATE OR REPLACE FUNCTION auth_user_department()
RETURNS UUID AS $$
  SELECT department_id FROM users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

-- ── RLS Policies ────────────────────────────────────────────

-- Users: can read all, only update own
CREATE POLICY "users_read_all"   ON users FOR SELECT USING (TRUE);
CREATE POLICY "users_update_own" ON users FOR UPDATE USING (id = auth.uid());
CREATE POLICY "admin_manage_users" ON users FOR ALL
  USING (auth_user_role() IN ('admin', 'director', 'principal'));

-- Departments: everyone reads, admin manages
CREATE POLICY "depts_read_all"  ON departments FOR SELECT USING (TRUE);
CREATE POLICY "depts_manage"    ON departments FOR ALL
  USING (auth_user_role() IN ('admin', 'director', 'principal'));

-- Meetings: all auth users read; directors/principals/admin create/edit
CREATE POLICY "meetings_read_all"   ON meetings FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "meetings_manage"     ON meetings FOR ALL
  USING (auth_user_role() IN ('director', 'principal', 'admin', 'tpo'));

-- Agenda items: all auth read
CREATE POLICY "agenda_read_all" ON agenda_items FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "agenda_manage"   ON agenda_items FOR ALL
  USING (auth_user_role() IN ('director', 'principal', 'admin', 'tpo'));

-- Documents: HODs see their dept; super users see all
CREATE POLICY "docs_superuser"   ON documents FOR SELECT
  USING (auth_user_role() IN ('director', 'principal', 'admin', 'exam_cell'));
CREATE POLICY "docs_hod_dept"    ON documents FOR SELECT
  USING (auth_user_role() = 'hod' AND department_id = auth_user_department());
CREATE POLICY "docs_hod_upload"  ON documents FOR INSERT
  USING (auth_user_role() IN ('hod', 'faculty') AND department_id = auth_user_department());
CREATE POLICY "docs_review"      ON documents FOR UPDATE
  USING (auth_user_role() IN ('director', 'principal', 'admin'));

-- Students: HODs see their dept; super users all
CREATE POLICY "students_superuser" ON students FOR SELECT
  USING (auth_user_role() IN ('director', 'principal', 'admin', 'tpo', 'accounts', 'exam_cell'));
CREATE POLICY "students_hod_dept"  ON students FOR SELECT
  USING (auth_user_role() IN ('hod', 'faculty') AND department_id = auth_user_department());

-- Notifications: users see only their own
CREATE POLICY "notifs_own" ON notifications FOR ALL
  USING (user_id = auth.uid());

-- Audit logs: admin only
CREATE POLICY "audit_admin" ON audit_logs FOR SELECT
  USING (auth_user_role() IN ('director', 'principal', 'admin'));

-- Compliance docs: all auth read; super user manage
CREATE POLICY "compliance_read" ON compliance_documents FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "compliance_manage" ON compliance_documents FOR ALL
  USING (auth_user_role() IN ('director', 'principal', 'admin', 'hod'));

-- Placement: TPO + super users
CREATE POLICY "placement_read" ON placement_offers FOR SELECT
  USING (auth_user_role() IN ('director', 'principal', 'admin', 'tpo', 'hod'));
CREATE POLICY "placement_manage" ON placement_offers FOR ALL
  USING (auth_user_role() IN ('tpo', 'admin', 'director', 'principal'));

-- Fees: accounts + super users
CREATE POLICY "fees_read" ON student_fee_records FOR SELECT
  USING (auth_user_role() IN ('director', 'principal', 'admin', 'accounts', 'hod'));
CREATE POLICY "fees_manage" ON student_fee_records FOR ALL
  USING (auth_user_role() IN ('accounts', 'admin', 'director', 'principal'));

-- Weak students: faculty + hod in dept; super users all
CREATE POLICY "weak_superuser" ON weak_students FOR SELECT
  USING (auth_user_role() IN ('director', 'principal', 'admin'));
CREATE POLICY "weak_hod_dept"  ON weak_students FOR SELECT
  USING (auth_user_role() IN ('hod', 'faculty'));

-- Results: all auth read
CREATE POLICY "results_read" ON results FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "results_manage" ON results FOR ALL
  USING (auth_user_role() IN ('exam_cell', 'admin', 'director', 'principal', 'hod'));

-- Attendance: all auth read
CREATE POLICY "attendance_read" ON attendance_summary FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "attendance_manage" ON attendance_summary FOR ALL
  USING (auth_user_role() IN ('admin', 'director', 'principal', 'hod', 'faculty'));

-- Action items: all auth read
CREATE POLICY "actions_read" ON action_items FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "actions_manage" ON action_items FOR ALL
  USING (auth_user_role() IN ('director', 'principal', 'admin', 'tpo'));
CREATE POLICY "actions_update_own" ON action_items FOR UPDATE
  USING (assigned_to_user_id = auth.uid() OR auth_user_department() = assigned_to_department_id);
