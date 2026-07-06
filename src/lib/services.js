import { supabase } from './supabase';
import { insertRow, updateRow, fetchAll, fetchOne, upsertRow, deleteRow } from './supabaseHelpers';

// ─── Meetings ─────────────────────────────────────────────────────────────────

export const meetingsService = {
  async list({ status, from, to, limit } = {}) {
    let q = supabase
      .from('meetings')
      .select(`
        *,
        created_by_user:users!meetings_created_by_fkey(id, full_name, role),
        approved_by_user:users!meetings_approved_by_fkey(id, full_name),
        agenda_items(id, category, title, deadline),
        documents(id, status)
      `)
      .order('meeting_date', { ascending: false });
    if (status)  q = q.eq('status', status);
    if (from)    q = q.gte('meeting_date', from);
    if (to)      q = q.lte('meeting_date', to);
    if (limit)   q = q.limit(limit);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },

  async get(id) {
    const { data, error } = await supabase
      .from('meetings')
      .select(`
        *,
        created_by_user:users!meetings_created_by_fkey(id, full_name, role),
        approved_by_user:users!meetings_approved_by_fkey(id, full_name),
        agenda_items(*, responsible_department:departments(id, code, name)),
        documents(*, department:departments(id, code, name), uploaded_by_user:users!documents_uploaded_by_fkey(full_name)),
        meeting_mom(*)
      `)
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async create(payload) {
    return insertRow('meetings', { ...payload, created_at: new Date().toISOString() });
  },

  async update(id, payload) {
    return updateRow('meetings', id, { ...payload, updated_at: new Date().toISOString() });
  },

  async updateStatus(id, status, extra = {}) {
    return updateRow('meetings', id, { status, updated_at: new Date().toISOString(), ...extra });
  },

  async approve(id, userId) {
    return updateRow('meetings', id, {
      status: 'approved',
      approved_by: userId,
      approved_at: new Date().toISOString(),
      updated_at:  new Date().toISOString(),
    });
  },

  async circulate(id, circularNumber) {
    return updateRow('meetings', id, {
      status: 'circulated',
      circular_number: circularNumber,
      circulated_at:   new Date().toISOString(),
      updated_at:      new Date().toISOString(),
    });
  },

  async upcomingCount() {
    const today = new Date().toISOString().split('T')[0];
    const { count, error } = await supabase
      .from('meetings')
      .select('id', { count: 'exact', head: true })
      .gte('meeting_date', today)
      .in('status', ['approved', 'circulated']);
    if (error) throw error;
    return count ?? 0;
  },
};

// ─── Agenda Items ─────────────────────────────────────────────────────────────

export const agendaService = {
  async listByMeeting(meetingId) {
    const { data, error } = await supabase
      .from('agenda_items')
      .select('*, responsible_department:departments(id, code, name)')
      .eq('meeting_id', meetingId)
      .order('order_number');
    if (error) throw error;
    return data ?? [];
  },

  async create(payload) { return insertRow('agenda_items', payload); },
  async update(id, payload) { return updateRow('agenda_items', id, payload); },
  async bulkCreate(items) {
    const { data, error } = await supabase.from('agenda_items').insert(items).select();
    if (error) throw error;
    return data;
  },
};

// ─── Agenda Templates ─────────────────────────────────────────────────────────

export const agendaTemplatesService = {
  async list() {
    const { data, error } = await supabase
      .from('agenda_templates')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async get(id) {
    const { data, error } = await supabase
      .from('agenda_templates')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async create(payload) {
    return insertRow('agenda_templates', payload);
  },

  async update(id, payload) {
    return updateRow('agenda_templates', id, payload);
  },

  async delete(id) {
    return deleteRow('agenda_templates', id);
  },
};

// ─── Agenda Submissions ────────────────────────────────────────────────────────

export const agendaSubmissionsService = {
  async listByMeeting(meetingId) {
    const { data, error } = await supabase
      .from('agenda_submissions')
      .select(`
        *,
        user:users(id, full_name, role),
        department:departments(id, code, name)
      `)
      .eq('meeting_id', meetingId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async submit(payload) {
    const { data: existing } = await supabase
      .from('agenda_submissions')
      .select('id')
      .eq('meeting_id', payload.meeting_id)
      .eq('department_id', payload.department_id)
      .maybeSingle();

    if (existing?.id) {
      return updateRow('agenda_submissions', existing.id, {
        ...payload,
        updated_at: new Date().toISOString()
      });
    } else {
      return insertRow('agenda_submissions', {
        ...payload,
        created_at: new Date().toISOString()
      });
    }
  },

  async delete(id) {
    return deleteRow('agenda_submissions', id);
  },
};


// ─── Documents ────────────────────────────────────────────────────────────────

export const documentsService = {
  async list({ meetingId, departmentId, status } = {}) {
    let q = supabase
      .from('documents')
      .select(`
        *,
        department:departments(id, code, name),
        uploaded_by_user:users!documents_uploaded_by_fkey(full_name),
        reviewed_by_user:users!documents_reviewed_by_fkey(full_name),
        meeting:meetings(id, agenda_title, meeting_date)
      `)
      .order('created_at', { ascending: false });
    if (meetingId)    q = q.eq('meeting_id', meetingId);
    if (departmentId) q = q.eq('department_id', departmentId);
    if (status)       q = q.eq('status', status);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },

  async submit(id, fileUrl, fileSize) {
    return updateRow('documents', id, {
      status: 'submitted',
      file_url: fileUrl,
      file_size: fileSize,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  },

  async approve(id, reviewerId, comments = '') {
    return updateRow('documents', id, {
      status: 'approved',
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      review_comments: comments,
      updated_at: new Date().toISOString(),
    });
  },

  async requestRevision(id, reviewerId, comments) {
    return updateRow('documents', id, {
      status: 'revision_requested',
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      review_comments: comments,
      updated_at: new Date().toISOString(),
    });
  },

  async create(payload) { return insertRow('documents', payload); },
  async pendingCount() {
    const { count, error } = await supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'overdue']);
    if (error) throw error;
    return count ?? 0;
  },
};

// ─── Action Items / ATR ───────────────────────────────────────────────────────

export const actionItemsService = {
  async list({ meetingId, departmentId, status, assignedTo } = {}) {
    let q = supabase
      .from('action_items')
      .select(`
        *,
        meeting:meetings(id, agenda_title, meeting_date),
        assigned_user:users!action_items_assigned_to_user_id_fkey(id, full_name, role),
        assigned_dept:departments!action_items_assigned_to_department_id_fkey(id, code, name),
        atr_updates(*)
      `)
      .order('deadline', { ascending: true });
    if (meetingId)    q = q.eq('meeting_id', meetingId);
    if (departmentId) q = q.eq('assigned_to_department_id', departmentId);
    if (status)       q = q.eq('status', status);
    if (assignedTo)   q = q.eq('assigned_to_user_id', assignedTo);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },

  async updateStatus(id, status, pct, proofUrl = null) {
    const patch = { status, completion_percentage: pct, updated_at: new Date().toISOString() };
    if (status === 'completed') { patch.completed_at = new Date().toISOString(); }
    if (proofUrl) patch.completion_proof_url = proofUrl;
    return updateRow('action_items', id, patch);
  },

  async addUpdate(payload) { return insertRow('atr_updates', payload); },
  async create(payload) { return insertRow('action_items', payload); },
};

// ─── MOM ──────────────────────────────────────────────────────────────────────

export const momService = {
  async getByMeeting(meetingId) {
    const { data, error } = await supabase
      .from('meeting_mom')
      .select('*, created_by_user:users!meeting_mom_created_by_fkey(full_name)')
      .eq('meeting_id', meetingId)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async create(payload) { return insertRow('meeting_mom', payload); },
  async update(id, payload) { return updateRow('meeting_mom', id, payload); },
};

// ─── Students ─────────────────────────────────────────────────────────────────

export const studentsService = {
  async list({ departmentId, semester, isActive = true } = {}) {
    let q = supabase
      .from('students')
      .select('*, department:departments(id, code, name)')
      .order('full_name');
    if (departmentId) q = q.eq('department_id', departmentId);
    if (semester)     q = q.eq('current_semester', semester);
    if (isActive !== null) q = q.eq('is_active', isActive);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },

  async get(id) { return fetchOne('students', id, '*, department:departments(id,code,name)'); },
  async create(payload) { return insertRow('students', payload); },
  async update(id, payload) { return updateRow('students', id, payload); },
  async bulkImport(rows) {
    const { data, error } = await supabase.from('students').upsert(rows, { onConflict: 'enrollment_number' }).select();
    if (error) throw error;
    return data;
  },
  async count() {
    const { count, error } = await supabase.from('students').select('id', { count: 'exact', head: true }).eq('is_active', true);
    if (error) throw error;
    return count ?? 0;
  },
};

// ─── Results ──────────────────────────────────────────────────────────────────

export const resultsService = {
  async list({ studentId, departmentId, examType, academicYearId } = {}) {
    let selectStr = '*, student:students';
    if (departmentId) {
      selectStr += '!inner';
    }
    selectStr += '(id, full_name, enrollment_number, department_id, department:departments(code, name)), subject:subjects(id, subject_name, subject_code, semester)';
    
    let q = supabase.from('results').select(selectStr);
    if (studentId) q = q.eq('student_id', studentId);
    if (departmentId) q = q.eq('student.department_id', departmentId);
    if (examType) q = q.eq('exam_type', examType);
    if (academicYearId) q = q.eq('academic_year_id', academicYearId);
    
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },

  async listByDept(departmentId, academicYearId) {
    const { data, error } = await supabase
      .from('results')
      .select('*, student:students(id, full_name, enrollment_number, department_id), subject:subjects(id, subject_name, subject_code, semester)')
      .eq('students.department_id', departmentId)
      .eq('academic_year_id', academicYearId);
    if (error) throw error;
    return data ?? [];
  },

  async deptSummary(academicYearId) {
    const { data, error } = await supabase.rpc('dept_result_summary', { p_year_id: academicYearId });
    if (error) {
      // Fallback: manual aggregation
      return [];
    }
    return data ?? [];
  },

  async create(payload) { return insertRow('results', payload); },
  async bulkImport(rows) {
    const { data, error } = await supabase.from('results').upsert(rows).select();
    if (error) throw error;
    return data;
  },
};

// ─── Attendance ───────────────────────────────────────────────────────────────

export const attendanceService = {
  async listSummary({ departmentId, semester, academicYearId, belowThreshold } = {}) {
    let studentSelect = 'student:students';
    if (departmentId) {
      studentSelect += '!inner';
    }
    studentSelect += '(id, full_name, enrollment_number, phone, parent_phone, department_id, department:departments(code,name))';
    let q = supabase
      .from('attendance_summary')
      .select(`*, ${studentSelect}`)
      .order('attendance_percentage', { ascending: true });
    if (departmentId)   q = q.eq('student.department_id', departmentId);
    if (semester)       q = q.eq('semester', semester);
    if (academicYearId) q = q.eq('academic_year_id', academicYearId);
    if (belowThreshold) q = q.lt('attendance_percentage', belowThreshold);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },

  async upsert(payload) {
    return upsertRow('attendance_summary', payload, 'student_id,subject_id,academic_year_id');
  },
  async bulkUpsert(rows) {
    const { data, error } = await supabase.from('attendance_summary').upsert(rows, { onConflict: 'student_id,subject_id,academic_year_id' }).select();
    if (error) throw error;
    return data;
  },
};

// ─── Weak Students ────────────────────────────────────────────────────────────

export const weakStudentsService = {
  async list({ academicYearId, departmentId, status } = {}) {
    let studentSelect = 'student:students';
    if (departmentId) {
      studentSelect += '!inner';
    }
    studentSelect += '(id, full_name, enrollment_number, phone, department_id, department:departments(code,name))';
    let q = supabase
      .from('weak_students')
      .select(`*, ${studentSelect}, assigned_faculty:users!weak_students_assigned_faculty_id_fkey(full_name)`)
      .order('identified_date', { ascending: false });
    if (academicYearId) q = q.eq('academic_year_id', academicYearId);
    if (departmentId)   q = q.eq('student.department_id', departmentId);
    if (status)         q = q.eq('status', status);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },
  async create(payload) { return insertRow('weak_students', payload); },
  async update(id, payload) { return updateRow('weak_students', id, payload); },
};

// ─── Placement ────────────────────────────────────────────────────────────────

export const placementService = {
  async listDrives() {
    const { data, error } = await supabase
      .from('placement_drives')
      .select('*, company:companies(*), offers:placement_offers(id, student_id, acceptance_status)')
      .order('drive_date', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async listOffers({ departmentId, companyId, driveId } = {}) {
    let studentSelect = 'student:students';
    if (departmentId) {
      studentSelect += '!inner';
    }
    studentSelect += '(id, full_name, enrollment_number, department_id, department:departments(code,name))';
    let q = supabase
      .from('placement_offers')
      .select(`*, ${studentSelect}, company:companies(*), drive:placement_drives(roles_offered, drive_date)`)
      .order('created_at', { ascending: false });
    if (companyId) q = q.eq('company_id', companyId);
    if (driveId)   q = q.eq('drive_id', driveId);
    if (departmentId) q = q.eq('student.department_id', departmentId);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },

  async createCompany(payload) { return insertRow('companies', payload); },
  async createDrive(payload) { return insertRow('placement_drives', payload); },
  async createOffer(payload) { return insertRow('placement_offers', payload); },
  async updateOffer(id, payload) { return updateRow('placement_offers', id, payload); },

  async stats() {
    const { data: offers, error } = await supabase
      .from('placement_offers')
      .select('id, package_ctc, acceptance_status, joining_confirmed, student_id');
    if (error) throw error;
    const placed = offers?.filter(o => o.acceptance_status === 'accepted').length ?? 0;
    const pkgs   = offers?.filter(o => o.package_ctc).map(o => o.package_ctc) ?? [];
    const avg    = pkgs.length ? pkgs.reduce((s,p) => s+p, 0) / pkgs.length : 0;
    const max    = pkgs.length ? Math.max(...pkgs) : 0;
    return { total: offers?.length ?? 0, placed, avgPackage: avg, highestPackage: max };
  },
};

// ─── Fees ─────────────────────────────────────────────────────────────────────

export const feesService = {
  async list({ departmentId, academicYearId, status, semester } = {}) {
    let q = supabase
      .from('student_fee_records')
      .select('*, student:students(id, full_name, enrollment_number, phone, parent_phone, department:departments(code,name)), academic_year:academic_years(year_name)')
      .order('created_at', { ascending: false });
    if (academicYearId) q = q.eq('academic_year_id', academicYearId);
    if (status)         q = q.eq('status', status);
    if (semester)       q = q.eq('semester', semester);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },
  async create(payload) { return insertRow('student_fee_records', payload); },
  async update(id, payload) { return updateRow('student_fee_records', id, payload); },
};

// ─── Users ────────────────────────────────────────────────────────────────────

export const usersService = {
  async list({ role, departmentId, isActive = true } = {}) {
    let q = supabase
      .from('users')
      .select('*, department:departments(id, code, name)')
      .order('full_name');
    if (role)         q = q.eq('role', role);
    if (departmentId) q = q.eq('department_id', departmentId);
    if (isActive !== null) q = q.eq('is_active', isActive);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },
  async get(id) { return fetchOne('users', id, '*, department:departments(id,code,name)'); },
  async update(id, payload) { return updateRow('users', id, { ...payload, updated_at: new Date().toISOString() }); },
  async create(payload) {
    const { data, error } = await supabase.rpc('admin_create_user', {
      p_email:         payload.email,
      p_password:      payload.password,
      p_full_name:     payload.full_name,
      p_role:          payload.role,
      p_department_id: payload.department_id || null,
      p_employee_id:   payload.employee_id || null,
      p_designation:   payload.designation || null,
      p_phone:         payload.phone || null
    });
    if (error) throw error;
    return data;
  },
  async updateCredentials(userId, email, password) {
    const { data, error } = await supabase.rpc('admin_update_user_credentials', {
      p_user_id:  userId,
      p_email:    email,
      p_password: password || null
    });
    if (error) throw error;
    return data;
  },
  async delete(userId) {
    const { data, error } = await supabase.rpc('admin_delete_user', {
      p_user_id: userId
    });
    if (error) throw error;
    return data;
  },
  async hods() {
    const { data, error } = await supabase
      .from('users')
      .select('*, department:departments(id,code,name)')
      .eq('role', 'hod')
      .eq('is_active', true);
    if (error) throw error;
    return data ?? [];
  },
};

// ─── Departments ──────────────────────────────────────────────────────────────

export const departmentsService = {
  async list() {
    const { data, error } = await supabase.from('departments').select('*').order('code');
    if (error) throw error;
    return data ?? [];
  },
  async get(id) { return fetchOne('departments', id); },
  async create(payload) { return insertRow('departments', payload); },
  async update(id, payload) { return updateRow('departments', id, { ...payload, updated_at: new Date().toISOString() }); },
};

// ─── Academic Years ───────────────────────────────────────────────────────────

export const academicYearsService = {
  async list() {
    const { data, error } = await supabase.from('academic_years').select('*').order('start_date', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  async current() {
    const { data, error } = await supabase.from('academic_years').select('*').eq('is_current', true).single();
    if (error) return null;
    return data;
  },
};

// ─── Compliance ───────────────────────────────────────────────────────────────

export const complianceService = {
  async list({ criterion, departmentId, academicYearId } = {}) {
    let q = supabase
      .from('compliance_documents')
      .select('*, department:departments(code,name), uploaded_by_user:users!compliance_documents_uploaded_by_fkey(full_name)')
      .order('uploaded_date', { ascending: false });
    if (criterion)      q = q.eq('criterion_name', criterion);
    if (departmentId)   q = q.eq('department_id', departmentId);
    if (academicYearId) q = q.eq('academic_year_id', academicYearId);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },
  async create(payload) { return insertRow('compliance_documents', payload); },
  async update(id, payload) { return updateRow('compliance_documents', id, payload); },
};

// ─── Notifications ────────────────────────────────────────────────────────────

export const notificationsService = {
  async list(userId) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return data ?? [];
  },
  async markRead(id) {
    return updateRow('notifications', id, { read_status: true, read_at: new Date().toISOString() });
  },
  async markAllRead(userId) {
    const { error } = await supabase
      .from('notifications')
      .update({ read_status: true, read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('read_status', false);
    if (error) throw error;
  },
  async create(payload) { return insertRow('notifications', payload); },
  async bulkCreate(payloads) {
    const { data, error } = await supabase.from('notifications').insert(payloads).select();
    if (error) throw error;
    return data;
  },
};

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export const auditService = {
  async log(userId, actionType, entityType, entityId, changes = {}) {
    try {
      await insertRow('audit_logs', { user_id: userId, action_type: actionType, entity_type: entityType, entity_id: entityId, changes });
    } catch { /* silent fail */ }
  },
  async list({ limit = 100 } = {}) {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*, user:users(full_name, role)')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  },
};

// ─── Academic Events ──────────────────────────────────────────────────────────

export const academicEventsService = {
  async list({ semester_type, academic_year_id } = {}) {
    let q = supabase
      .from('academic_events')
      .select('*')
      .order('start_date', { ascending: true });
    if (semester_type) q = q.eq('semester_type', semester_type);
    if (academic_year_id) q = q.eq('academic_year_id', academic_year_id);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },

  async create(payload) {
    return insertRow('academic_events', payload);
  },

  async update(id, payload) {
    return updateRow('academic_events', id, payload);
  },

  async delete(id) {
    return deleteRow('academic_events', id);
  },

  async bulkImport(rows) {
    const { data, error } = await supabase.from('academic_events').insert(rows).select();
    if (error) throw error;
    return data;
  },
};

// ─── Semesters ────────────────────────────────────────────────────────────────

export const semestersService = {
  async list({ academic_year_id } = {}) {
    let q = supabase.from('semesters').select('*').order('semester_number', { ascending: true });
    if (academic_year_id) q = q.eq('academic_year_id', academic_year_id);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },
  async update(id, payload) {
    return updateRow('semesters', id, payload);
  }
};

// ─── Dashboard aggregates ─────────────────────────────────────────────────────


export const dashboardService = {
  async kpis() {
    const [upcomingMeetings, pendingDocs, activeStudents] = await Promise.allSettled([
      meetingsService.upcomingCount(),
      documentsService.pendingCount(),
      studentsService.count(),
    ]);
    return {
      upcomingMeetings: upcomingMeetings.value ?? 0,
      pendingDocuments: pendingDocs.value ?? 0,
      activeStudents:   activeStudents.value ?? 0,
    };
  },

  async recentActivity(limit = 10) {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*, user:users(full_name, role)')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) return [];
    return data ?? [];
  },
};

// ─── LMS Service ─────────────────────────────────────────────────────────────

export const lmsService = {
  async list({ departmentId, academicYearId } = {}) {
    let q = supabase
      .from('lms_activity')
      .select('*, department:departments(id, code, name), user:users(id, full_name, role)')
      .order('last_upload_date', { ascending: false });
    if (departmentId) q = q.eq('department_id', departmentId);
    if (academicYearId) q = q.eq('academic_year_id', academicYearId);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },
};

