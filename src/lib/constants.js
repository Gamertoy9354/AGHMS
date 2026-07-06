// ============================================================
// RNGPIT AGHMS - Application Constants
// ============================================================

export const INSTITUTE = {
  name: 'R.N.G. Patel Institute of Technology',
  shortName: 'RNGPIT',
  location: 'Bardoli, Gujarat',
  affiliation: 'Gujarat Technological University (GTU)',
  circular_prefix: 'RNGPIT',
};

export const ROLES = {
  DIRECTOR: 'director',
  PRINCIPAL: 'principal',
  HOD: 'hod',
  FACULTY: 'faculty',
  TPO: 'tpo',
  ACCOUNTS: 'accounts',
  EXAM_CELL: 'exam_cell',
  ADMIN: 'admin',
};

export const ROLE_LABELS = {
  director:   'Director',
  principal:  'Principal',
  hod:        'Head of Department',
  faculty:    'Faculty',
  tpo:        'TPO',
  accounts:   'Accounts',
  exam_cell:  'Exam Cell',
  admin:      'Administrator',
};

export const ROLE_COLORS = {
  director:   'bg-purple-100 text-purple-700',
  principal:  'bg-blue-100 text-blue-700',
  hod:        'bg-emerald-100 text-emerald-700',
  faculty:    'bg-sky-100 text-sky-700',
  tpo:        'bg-orange-100 text-orange-700',
  accounts:   'bg-yellow-100 text-yellow-700',
  exam_cell:  'bg-rose-100 text-rose-700',
  admin:      'bg-gray-100 text-gray-700',
};

export const DEPARTMENTS = [
  { code: 'CSE',      name: 'Computer Science & Engineering' },
  { code: 'MECH',     name: 'Mechanical Engineering' },
  { code: 'ELE',      name: 'Electrical Engineering' },
  { code: 'EC',       name: 'Electronics & Communication Engineering' },
  { code: 'CIV',      name: 'Civil Engineering' },
  { code: 'IT',       name: 'Information Technology' },
  { code: 'CHEM',     name: 'Chemical Engineering' },
  { code: 'IC',       name: 'Instrumentation & Control Engineering' },
  { code: 'IMSCIT',   name: 'Integrated M.Sc. Information Technology' },
  { code: 'SCI.HUM',  name: 'Science & Humanities' },
  { code: 'MBA',      name: 'Master of Business Administration' },
];

export const MEETING_STATUS = {
  DRAFT:            'draft',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED:         'approved',
  CIRCULATED:       'circulated',
  IN_PROGRESS:      'in_progress',
  CONDUCTED:        'conducted',
  CANCELLED:        'cancelled',
};

export const MEETING_STATUS_LABELS = {
  draft:            'Draft',
  pending_approval: 'Pending Approval',
  approved:         'Approved',
  circulated:       'Circulated',
  in_progress:      'In Progress',
  conducted:        'Conducted',
  cancelled:        'Cancelled',
};

export const MEETING_STATUS_COLORS = {
  draft:            'badge-surface',
  pending_approval: 'badge-warning',
  approved:         'badge-primary',
  circulated:       'badge-accent',
  in_progress:      'bg-indigo-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full animate-pulse',
  conducted:        'badge-success',
  cancelled:        'badge-danger',
};

export const DOCUMENT_STATUS = {
  PENDING:           'pending',
  SUBMITTED:         'submitted',
  SUBMITTED_LATE:    'submitted_late',
  APPROVED:          'approved',
  REVISION_REQUESTED:'revision_requested',
  OVERDUE:           'overdue',
};

export const DOC_STATUS_LABELS = {
  pending:            'Pending',
  submitted:          'Submitted',
  submitted_late:     'Late Submission',
  approved:           'Approved',
  revision_requested: 'Revision Needed',
  overdue:            'Overdue',
};

export const DOC_STATUS_STYLES = {
  pending:            { badge: 'badge-surface',  dot: 'status-blue' },
  submitted:          { badge: 'badge-success',  dot: 'status-green' },
  submitted_late:     { badge: 'badge-warning',  dot: 'status-yellow' },
  approved:           { badge: 'badge-primary',  dot: 'status-blue' },
  revision_requested: { badge: 'badge-accent',   dot: 'status-yellow' },
  overdue:            { badge: 'badge-danger',   dot: 'status-red' },
};

export const ACTION_ITEM_STATUS = {
  PENDING:     'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED:   'completed',
  DELAYED:     'delayed',
};

export const MEETING_CATEGORIES = [
  'Academic Review',
  'NBA Compliance',
  'Fees Monitoring',
  'Placement Review',
  'Admission Activities',
  'Website / ERP Updates',
  'Scholarship Monitoring',
  'CO/PO Attainment',
  'Internship Tracking',
  'LMS Compliance',
  'Attendance Review',
  'General Administration',
  'Exam & Results',
  'Research & Development',
  'Student Welfare',
  'Infrastructure',
];

export const DOCUMENT_TYPES = [
  'CO Attainment Sheet',
  'Attendance Report',
  'Result Analysis',
  'Lesson Plan',
  'Placement Proof',
  'Fees Report',
  'Internship List',
  'Audit Compliance',
  'Feedback Report',
  'Scholarship Report',
  'ERP/LMS Activity Report',
  'BoS Meeting Minutes',
  'Academic Calendar',
  'Syllabus Completion Report',
  'Weak Student Report',
  'Remedial Report',
  'ATR Report',
  'Other',
];

export const PRIORITY_LABELS = {
  1: 'Low',
  2: 'Medium',
  3: 'High',
  4: 'Critical',
};

export const PRIORITY_COLORS = {
  1: 'badge-surface',
  2: 'badge-primary',
  3: 'badge-warning',
  4: 'badge-danger',
};

export const ATTENDANCE_THRESHOLDS = {
  GOOD:     80,
  WARNING:  75,
  CRITICAL: 60,
};

export const PERFORMANCE_COLORS = {
  good:     { bg: 'bg-success-100', text: 'text-success-700', border: 'border-success-200' },
  warning:  { bg: 'bg-warning-100', text: 'text-warning-700', border: 'border-warning-200' },
  danger:   { bg: 'bg-danger-100',  text: 'text-danger-700',  border: 'border-danger-200' },
  neutral:  { bg: 'bg-surface-100', text: 'text-surface-600', border: 'border-surface-200' },
};
