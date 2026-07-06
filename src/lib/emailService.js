/**
 * Email Service — routes all email sends through the `send-email` Supabase Edge Function.
 *
 * Usage:
 *   import { emailService } from './emailService';
 *   await emailService.meetingCreated(meeting, principalUsers);
 */

import { supabase } from './supabase';

const EDGE_FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`;

/**
 * Core sender — fire-and-forget safe. Logs errors but never throws.
 */
async function sendEmail(type, recipients, data) {
  if (!recipients || recipients.length === 0) return;

  try {
    const res = await fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, recipients, data }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn(`[emailService] Send failed (${type}):`, err);
    } else {
      const result = await res.json();
      console.log(`[emailService] ${type} → ${result.sent} sent, ${result.failed || 0} failed`);
    }
  } catch (err) {
    // Never block UI — email is best-effort
    console.warn('[emailService] Network error sending email:', err?.message);
  }
}

/**
 * Fetch user emails from the users table for given IDs or roles.
 */
async function getUsersByIds(ids) {
  if (!ids?.length) return [];
  const { data } = await supabase
    .from('users')
    .select('id, full_name, email, role, department:departments(code, name)')
    .in('id', ids)
    .eq('is_active', true);
  return data || [];
}

async function getUsersByRoles(roles) {
  const { data } = await supabase
    .from('users')
    .select('id, full_name, email, role, department:departments(code, name)')
    .in('role', roles)
    .eq('is_active', true);
  return data || [];
}

async function getUsersByDeptIds(deptIds) {
  if (!deptIds?.length) return [];
  const { data } = await supabase
    .from('users')
    .select('id, full_name, email, role, department:departments(code, name)')
    .in('department_id', deptIds)
    .in('role', ['hod', 'faculty'])
    .eq('is_active', true);
  return data || [];
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const emailService = {
  /**
   * Event 1: Meeting agenda created/submitted for approval
   * → Notify: principal, director, admin
   */
  async meetingCreated(meeting) {
    const users = await getUsersByRoles(['principal', 'director', 'admin']);
    if (!users.length) return;

    const recipients = users.map(u => ({ email: u.email, name: u.full_name }));
    await sendEmail('meeting_created', recipients, {
      meetingId: meeting.id,
      title:     meeting.agenda_title,
      date:      new Date(meeting.meeting_date).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      time:      meeting.meeting_time || '10:00 AM',
      venue:     meeting.venue || 'Conference Hall',
    });
  },

  /**
   * Event 2: Meeting approved & circulated
   * → Notify: all HODs/faculty in invited departments
   */
  async meetingCirculated(meeting, circularNumber) {
    const invitedDeptIds = meeting.invited_departments || [];
    const users = invitedDeptIds.length
      ? await getUsersByDeptIds(invitedDeptIds)
      : await getUsersByRoles(['hod', 'faculty']);

    // Also notify admin/principal
    const adminUsers = await getUsersByRoles(['admin', 'principal']);
    const allUsers = [...users, ...adminUsers].filter(
      (u, i, arr) => arr.findIndex(x => x.id === u.id) === i // dedupe
    );

    if (!allUsers.length) return;

    const recipients = allUsers.map(u => ({ email: u.email, name: u.full_name }));
    await sendEmail('meeting_circulated', recipients, {
      meetingId:      meeting.id,
      title:          meeting.agenda_title,
      date:           new Date(meeting.meeting_date).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      time:           meeting.meeting_time || '10:00 AM',
      venue:          meeting.venue || 'Conference Hall',
      circularNumber: circularNumber || meeting.circular_number,
    });
  },

  /**
   * Event 3: Meeting started (live workspace opened)
   * → Notify: all participants (invited dept users + admin)
   */
  async meetingStarted(meeting) {
    const invitedDeptIds = meeting.invited_departments || [];
    const deptUsers   = invitedDeptIds.length ? await getUsersByDeptIds(invitedDeptIds) : [];
    const adminUsers  = await getUsersByRoles(['admin', 'principal', 'director']);
    const allUsers = [...deptUsers, ...adminUsers].filter(
      (u, i, arr) => arr.findIndex(x => x.id === u.id) === i
    );
    if (!allUsers.length) return;

    const recipients = allUsers.map(u => ({ email: u.email, name: u.full_name }));
    await sendEmail('meeting_started', recipients, {
      meetingId: meeting.id,
      title:     meeting.agenda_title,
    });
  },

  /**
   * Event 4: Meeting concluded — Admin gets executive MOM
   * → Notify: admin, principal, director
   */
  async meetingConcludedAdmin(meeting, adminNote) {
    const users = await getUsersByRoles(['admin', 'principal', 'director']);
    if (!users.length) return;

    const recipients = users.map(u => ({ email: u.email, name: u.full_name }));
    await sendEmail('meeting_concluded_admin', recipients, {
      meetingId: meeting.id,
      title:     meeting.agenda_title,
      adminNote: adminNote,
    });
  },

  /**
   * Event 5: Meeting concluded — Each dept HOD gets their personalized brief
   * → Notify: HODs per department, with their specific brief text
   */
  async meetingConcludedDeptBriefs(meeting, departmentBriefs) {
    if (!departmentBriefs || Object.keys(departmentBriefs).length === 0) return;

    // Get all HODs and match by dept code
    const { data: hods } = await supabase
      .from('users')
      .select('id, full_name, email, role, department:departments(code, name)')
      .eq('role', 'hod')
      .eq('is_active', true);

    if (!hods?.length) return;

    // Build per-dept recipients list including their brief
    const recipients = hods
      .filter(h => h.department?.code && departmentBriefs[h.department.code])
      .map(h => ({
        email:    h.email,
        name:     h.full_name,
        deptCode: h.department.code,
        brief:    departmentBriefs[h.department.code],
      }));

    if (!recipients.length) return;

    await sendEmail('meeting_concluded_dept', recipients, {
      meetingId: meeting.id,
      title:     meeting.agenda_title,
    });
  },

  /**
   * Event 6: Action item assigned
   * → Notify: the assigned user (by user_id or department HOD)
   */
  async actionItemAssigned(actionItem) {
    let users = [];

    if (actionItem.assigned_user_id) {
      users = await getUsersByIds([actionItem.assigned_user_id]);
    } else if (actionItem.assigned_department_id) {
      users = await getUsersByDeptIds([actionItem.assigned_department_id]);
      users = users.filter(u => u.role === 'hod'); // Only notify HOD
    }

    if (!users.length) return;

    const recipients = users.map(u => ({ email: u.email, name: u.full_name }));
    await sendEmail('action_item_assigned', recipients, {
      description:  actionItem.description,
      meetingTitle: actionItem.meeting?.agenda_title || 'HOD Meeting',
      deadline:     actionItem.deadline
        ? new Date(actionItem.deadline).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
        : 'As directed',
    });
  },
};
