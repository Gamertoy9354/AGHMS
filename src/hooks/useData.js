import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  meetingsService, agendaService, documentsService,
  actionItemsService, momService, studentsService,
  resultsService, attendanceService, weakStudentsService,
  placementService, feesService, usersService,
  departmentsService, academicYearsService,
  complianceService, notificationsService,
  auditService, dashboardService, academicEventsService,
  semestersService, agendaTemplatesService, agendaSubmissionsService,
  lmsService
} from '../lib/services';
import { useAuth } from '../contexts/AuthContext';

// ─── Keys factory ─────────────────────────────────────────────────────────────
export const QK = {
  meetings:        (f) => ['meetings', f],
  meeting:         (id) => ['meeting', id],
  agendaItems:     (mId) => ['agenda_items', mId],
  mom:             (mId) => ['mom', mId],
  documents:       (f) => ['documents', f],
  actionItems:     (f) => ['action_items', f],
  students:        (f) => ['students', f],
  results:         (f) => ['results', f],
  attendance:      (f) => ['attendance', f],
  weakStudents:    (f) => ['weak_students', f],
  placement:       (f) => ['placement', f],
  fees:            (f) => ['fees', f],
  users:           (f) => ['users', f],
  departments:     () => ['departments'],
  academicYears:   () => ['academic_years'],
  compliance:      (f) => ['compliance', f],
  notifications:   (uid) => ['notifications', uid],
  dashboard:       () => ['dashboard'],
  auditLogs:       () => ['audit_logs'],
  agendaTemplates: () => ['agenda_templates'],
  agendaTemplate:  (id) => ['agenda_template', id],
  agendaSubmissions:(mId) => ['agenda_submissions', mId],
  lmsActivity:     (f) => ['lms_activity', f],
};

// ─── Meetings ─────────────────────────────────────────────────────────────────
export function useMeetings(filters = {}) {
  return useQuery({ queryKey: QK.meetings(filters), queryFn: () => meetingsService.list(filters), staleTime: 30_000 });
}
export function useMeeting(id) {
  return useQuery({ queryKey: QK.meeting(id), queryFn: () => meetingsService.get(id), enabled: !!id });
}
export function useCreateMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: meetingsService.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meetings'] }),
  });
}
export function useUpdateMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }) => meetingsService.update(id, payload),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['meetings'] });
      qc.invalidateQueries({ queryKey: QK.meeting(id) });
    },
  });
}
export function useApproveMeeting() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (id) => meetingsService.approve(id, user.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meetings'] }),
  });
}
export function useCirculateMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, circularNumber }) => meetingsService.circulate(id, circularNumber),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meetings'] }),
  });
}

// ─── Agenda Items ─────────────────────────────────────────────────────────────
export function useAgendaItems(meetingId) {
  return useQuery({ queryKey: QK.agendaItems(meetingId), queryFn: () => agendaService.listByMeeting(meetingId), enabled: !!meetingId });
}
export function useCreateAgendaItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: agendaService.create,
    onSuccess: (_, { meeting_id }) => qc.invalidateQueries({ queryKey: QK.agendaItems(meeting_id) }),
  });
}

// ─── Documents ────────────────────────────────────────────────────────────────
export function useDocuments(filters = {}) {
  return useQuery({ queryKey: QK.documents(filters), queryFn: () => documentsService.list(filters), staleTime: 30_000 });
}
export function useApproveDocument() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({ id, comments }) => documentsService.approve(id, user.id, comments),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });
}
export function useRequestRevision() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({ id, comments }) => documentsService.requestRevision(id, user.id, comments),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });
}
export function useCreateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: documentsService.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });
}

// ─── Action Items ─────────────────────────────────────────────────────────────
export function useActionItems(filters = {}) {
  return useQuery({ queryKey: QK.actionItems(filters), queryFn: () => actionItemsService.list(filters), staleTime: 30_000 });
}
export function useCreateActionItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: actionItemsService.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['action_items'] }),
  });
}
export function useUpdateActionStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, pct, proofUrl }) => actionItemsService.updateStatus(id, status, pct, proofUrl),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['action_items'] }),
  });
}
export function useAddAtrUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: actionItemsService.addUpdate,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['action_items'] }),
  });
}

// ─── MOM ──────────────────────────────────────────────────────────────────────
export function useMOM(meetingId) {
  return useQuery({ queryKey: QK.mom(meetingId), queryFn: () => momService.getByMeeting(meetingId), enabled: !!meetingId });
}
export function useCreateMOM() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: momService.create,
    onSuccess: (_, { meeting_id }) => qc.invalidateQueries({ queryKey: QK.mom(meeting_id) }),
  });
}

// ─── Students ─────────────────────────────────────────────────────────────────
export function useStudents(filters = {}) {
  return useQuery({ queryKey: QK.students(filters), queryFn: () => studentsService.list(filters), staleTime: 60_000 });
}

// ─── Results ──────────────────────────────────────────────────────────────────
export function useResults(filters = {}) {
  return useQuery({ queryKey: QK.results(filters), queryFn: () => resultsService.deptSummary(filters.academicYearId), staleTime: 60_000 });
}
export function useResultsList(filters = {}) {
  return useQuery({ queryKey: ['results_list', filters], queryFn: () => resultsService.list(filters), staleTime: 60_000 });
}

// ─── Attendance ───────────────────────────────────────────────────────────────
export function useAttendance(filters = {}) {
  return useQuery({ queryKey: QK.attendance(filters), queryFn: () => attendanceService.listSummary(filters), staleTime: 60_000 });
}

// ─── LMS Activity ─────────────────────────────────────────────────────────────
export function useLmsActivity(filters = {}) {
  return useQuery({ queryKey: QK.lmsActivity(filters), queryFn: () => lmsService.list(filters), staleTime: 60_000 });
}

// ─── Weak Students ────────────────────────────────────────────────────────────
export function useWeakStudents(filters = {}) {
  return useQuery({ queryKey: QK.weakStudents(filters), queryFn: () => weakStudentsService.list(filters) });
}
export function useUpdateWeakStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }) => weakStudentsService.update(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['weak_students'] }),
  });
}

// ─── Placement ────────────────────────────────────────────────────────────────
export function usePlacementDrives() {
  return useQuery({ queryKey: QK.placement('drives'), queryFn: placementService.listDrives });
}
export function usePlacementOffers(filters = {}) {
  return useQuery({ queryKey: QK.placement(filters), queryFn: () => placementService.listOffers(filters) });
}
export function usePlacementStats() {
  return useQuery({ queryKey: QK.placement('stats'), queryFn: placementService.stats });
}
export function useCreateDrive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: placementService.createDrive,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['placement'] }),
  });
}

// ─── Fees ─────────────────────────────────────────────────────────────────────
export function useFees(filters = {}) {
  return useQuery({ queryKey: QK.fees(filters), queryFn: () => feesService.list(filters), staleTime: 60_000 });
}
export function useUpdateFee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }) => feesService.update(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fees'] }),
  });
}

// ─── Users ────────────────────────────────────────────────────────────────────
export function useUsers(filters = {}) {
  return useQuery({ queryKey: QK.users(filters), queryFn: () => usersService.list(filters), staleTime: 120_000 });
}
export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }) => usersService.update(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}
export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => usersService.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}
export function useUpdateUserCredentials() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, email, password }) => usersService.updateCredentials(id, email, password),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}
export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => usersService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

// ─── Departments ──────────────────────────────────────────────────────────────
export function useDepartments() {
  return useQuery({ queryKey: QK.departments(), queryFn: departmentsService.list, staleTime: 300_000 });
}

// ─── Academic Years ───────────────────────────────────────────────────────────
export function useAcademicYears() {
  return useQuery({ queryKey: QK.academicYears(), queryFn: academicYearsService.list, staleTime: 600_000 });
}
export function useCurrentYear() {
  return useQuery({ queryKey: ['current_year'], queryFn: academicYearsService.current, staleTime: 600_000 });
}

// ─── Compliance ───────────────────────────────────────────────────────────────
export function useCompliance(filters = {}) {
  return useQuery({ queryKey: QK.compliance(filters), queryFn: () => complianceService.list(filters) });
}
export function useCreateComplianceDoc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: complianceService.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['compliance'] }),
  });
}

// ─── Notifications ────────────────────────────────────────────────────────────
export function useNotificationsList() {
  const { user } = useAuth();
  return useQuery({
    queryKey: QK.notifications(user?.id),
    queryFn: () => notificationsService.list(user.id),
    enabled: !!user?.id,
    refetchInterval: 30_000,
  });
}
export function useMarkNotificationRead() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: notificationsService.markRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.notifications(user?.id) }),
  });
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export function useDashboard() {
  return useQuery({ queryKey: QK.dashboard(), queryFn: dashboardService.kpis, staleTime: 60_000 });
}

// ─── Audit ────────────────────────────────────────────────────────────────────
export function useAuditLogs() {
  return useQuery({ queryKey: QK.auditLogs(), queryFn: () => auditService.list({ limit: 200 }) });
}

// ─── Academic Calendar Events ────────────────────────────────────────────────
export function useAcademicEvents(filters = {}) {
  return useQuery({
    queryKey: ['academic_events', filters],
    queryFn: () => academicEventsService.list(filters),
    staleTime: 30_000,
  });
}

export function useCreateAcademicEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: academicEventsService.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['academic_events'] }),
  });
}

export function useUpdateAcademicEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }) => academicEventsService.update(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['academic_events'] }),
  });
}

export function useDeleteAcademicEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: academicEventsService.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['academic_events'] }),
  });
}

// ─── Semesters ──────────────────────────────────────────────────────────────
export function useSemesters(academicYearId) {
  return useQuery({
    queryKey: ['semesters', academicYearId],
    queryFn: () => semestersService.list({ academic_year_id: academicYearId }),
    enabled: !!academicYearId,
    staleTime: 60_000,
  });
}

export function useUpdateSemester() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }) => semestersService.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['semesters'] });
    },
  });
}

// ─── Agenda Templates ─────────────────────────────────────────────────────────
export function useAgendaTemplates() {
  return useQuery({ queryKey: QK.agendaTemplates(), queryFn: agendaTemplatesService.list, staleTime: 30_000 });
}

export function useAgendaTemplate(id) {
  return useQuery({ queryKey: QK.agendaTemplate(id), queryFn: () => agendaTemplatesService.get(id), enabled: !!id });
}

export function useCreateAgendaTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: agendaTemplatesService.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.agendaTemplates() }),
  });
}

export function useUpdateAgendaTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }) => agendaTemplatesService.update(id, payload),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: QK.agendaTemplates() });
      qc.invalidateQueries({ queryKey: QK.agendaTemplate(id) });
    },
  });
}

export function useDeleteAgendaTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: agendaTemplatesService.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.agendaTemplates() }),
  });
}

// ─── Agenda Submissions ────────────────────────────────────────────────────────
export function useAgendaSubmissions(meetingId) {
  return useQuery({
    queryKey: QK.agendaSubmissions(meetingId),
    queryFn: () => agendaSubmissionsService.listByMeeting(meetingId),
    enabled: !!meetingId
  });
}

export function useSubmitAgendaData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: agendaSubmissionsService.submit,
    onSuccess: (_, { meeting_id }) => {
      qc.invalidateQueries({ queryKey: QK.agendaSubmissions(meeting_id) });
      qc.invalidateQueries({ queryKey: ['meetings'] });
      qc.invalidateQueries({ queryKey: QK.meeting(meeting_id) });
    },
  });
}
