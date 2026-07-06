import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'AGHMS <onboarding@resend.dev>';
const APP_URL = Deno.env.get('APP_URL') ?? 'https://aghms.rngpitai.com';
const INSTITUTE = 'R.N.G. Patel Institute of Technology';
const INSTITUTE_SHORT = 'RNGPIT';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── HTML email template builder ──────────────────────────────────────────────
function buildEmail({
  recipientName,
  subject,
  heading,
  subheading = '',
  bodyHtml,
  ctaUrl = '',
  ctaText = '',
  footerNote = '',
}: {
  recipientName: string;
  subject: string;
  heading: string;
  subheading?: string;
  bodyHtml: string;
  ctaUrl?: string;
  ctaText?: string;
  footerNote?: string;
}) {
  const cta = ctaUrl && ctaText
    ? `<div style="text-align:center;margin:32px 0">
        <a href="${ctaUrl}" style="background:#4f46e5;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;display:inline-block">
          ${ctaText} &rarr;
        </a>
       </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);border-radius:16px 16px 0 0;padding:32px 40px;text-align:center">
          <p style="margin:0;color:rgba(255,255,255,0.7);font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase">${INSTITUTE_SHORT} · Academic Governance</p>
          <h1 style="margin:8px 0 0;color:#fff;font-size:22px;font-weight:700;line-height:1.3">${heading}</h1>
          ${subheading ? `<p style="margin:6px 0 0;color:rgba(255,255,255,0.75);font-size:13px">${subheading}</p>` : ''}
        </td></tr>

        <!-- Body -->
        <tr><td style="background:#fff;padding:36px 40px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0">
          <p style="margin:0 0 20px;color:#475569;font-size:14px">Dear <strong style="color:#1e293b">${recipientName}</strong>,</p>
          ${bodyHtml}
          ${cta}
          ${footerNote ? `<p style="margin:24px 0 0;color:#94a3b8;font-size:12px;border-top:1px solid #f1f5f9;padding-top:16px">${footerNote}</p>` : ''}
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f8fafc;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 16px 16px;padding:20px 40px;text-align:center">
          <p style="margin:0;color:#94a3b8;font-size:11px">${INSTITUTE} · Academic Governance &amp; HOD Meeting System</p>
          <p style="margin:4px 0 0;color:#cbd5e1;font-size:10px">This is an automated notification. Please do not reply to this email.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`;
}

// ── Send via Resend ──────────────────────────────────────────────────────────
async function sendViaResend(to: string, subject: string, html: string, text: string) {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — email not sent to', to);
    return { skipped: true };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html, text }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `Resend error ${res.status}`);
  return data;
}

// ── Template builders ────────────────────────────────────────────────────────
function buildMeetingCreatedEmail(p: any) {
  const body = `
    <p style="color:#475569;font-size:14px;line-height:1.6">A new HOD meeting agenda has been scheduled and submitted for approval. Please review it in the AGHMS portal.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:20px;margin:20px 0">
      <tr><td style="padding:6px 0"><span style="color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase">Title</span><br><strong style="color:#1e293b;font-size:14px">${p.title}</strong></td></tr>
      <tr><td style="padding:6px 0"><span style="color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase">Date</span><br><strong style="color:#1e293b;font-size:14px">${p.date}</strong></td></tr>
      <tr><td style="padding:6px 0"><span style="color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase">Time</span><br><strong style="color:#1e293b;font-size:14px">${p.time || '10:00 AM'}</strong></td></tr>
      <tr><td style="padding:6px 0"><span style="color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase">Venue</span><br><strong style="color:#1e293b;font-size:14px">${p.venue}</strong></td></tr>
    </table>`;
  return buildEmail({ recipientName: p.recipientName, subject: `New Agenda: ${p.title}`, heading: '📋 New Meeting Agenda Created', subheading: 'Submitted for Approval', bodyHtml: body, ctaUrl: `${APP_URL}/meetings/agendas/${p.meetingId}`, ctaText: 'Review Agenda', footerNote: 'You are receiving this because you are an approver in the AGHMS system.' });
}

function buildMeetingCirculatedEmail(p: any) {
  const body = `
    <p style="color:#475569;font-size:14px;line-height:1.6">A meeting agenda has been approved and formally circulated to your department. Please prepare your department data and upload it before the meeting date.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:20px;margin:20px 0">
      <tr><td style="padding:6px 0"><span style="color:#16a34a;font-size:12px;font-weight:600;text-transform:uppercase">Meeting Title</span><br><strong style="color:#1e293b;font-size:14px">${p.title}</strong></td></tr>
      <tr><td style="padding:6px 0"><span style="color:#16a34a;font-size:12px;font-weight:600;text-transform:uppercase">Date &amp; Time</span><br><strong style="color:#1e293b;font-size:14px">${p.date} at ${p.time || '10:00 AM'}</strong></td></tr>
      <tr><td style="padding:6px 0"><span style="color:#16a34a;font-size:12px;font-weight:600;text-transform:uppercase">Venue</span><br><strong style="color:#1e293b;font-size:14px">${p.venue}</strong></td></tr>
      ${p.circularNumber ? `<tr><td style="padding:6px 0"><span style="color:#16a34a;font-size:12px;font-weight:600;text-transform:uppercase">Circular No.</span><br><strong style="color:#1e293b;font-size:14px">${p.circularNumber}</strong></td></tr>` : ''}
    </table>
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px;margin:16px 0">
      <p style="margin:0;color:#92400e;font-size:13px">⚠️ <strong>Action Required:</strong> Please upload your department's data sheet through the AGHMS portal before the meeting date.</p>
    </div>`;
  return buildEmail({ recipientName: p.recipientName, subject: `Meeting Circulated: ${p.title}`, heading: '✅ Meeting Approved & Circulated', subheading: `Circular No. ${p.circularNumber || 'Issued'}`, bodyHtml: body, ctaUrl: `${APP_URL}/meetings/agendas/${p.meetingId}`, ctaText: 'Open Agenda & Upload Data', footerNote: 'You are receiving this because your department has been invited to this meeting.' });
}

function buildMeetingStartedEmail(p: any) {
  const body = `
    <p style="color:#475569;font-size:14px;line-height:1.6">The HOD meeting is now <strong style="color:#4f46e5">LIVE</strong>. Join the active workspace to participate, view AI-analyzed dashboards, and take notes.</p>
    <div style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:10px;padding:20px;margin:20px 0;text-align:center">
      <p style="margin:0;color:#3730a3;font-size:16px;font-weight:700">${p.title}</p>
      <p style="margin:4px 0 0;color:#6366f1;font-size:13px">Live since ${new Date().toLocaleTimeString('en-IN')}</p>
    </div>`;
  return buildEmail({ recipientName: p.recipientName, subject: `🔴 LIVE: ${p.title}`, heading: '🔴 Meeting is Now Live', subheading: 'Join the active workspace now', bodyHtml: body, ctaUrl: `${APP_URL}/meetings/agendas/${p.meetingId}/workspace`, ctaText: 'Join Live Workspace' });
}

function buildMeetingConcludedAdminEmail(p: any) {
  const body = `
    <p style="color:#475569;font-size:14px;line-height:1.6">The HOD meeting has concluded. The AI has synthesized all notes and uploaded data into an executive MOM report.</p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:20px;margin:20px 0">
      <p style="margin:0 0 8px;color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase">AI Executive Summary</p>
      <p style="margin:0;color:#334155;font-size:13px;line-height:1.7">${p.adminNote?.replace(/[*#]/g, '').slice(0, 600) || 'See full MOM in AGHMS portal.'}...</p>
    </div>`;
  return buildEmail({ recipientName: p.recipientName, subject: `MOM Ready: ${p.title}`, heading: '🎉 Meeting Concluded — MOM Ready', subheading: 'AI-generated executive summary attached', bodyHtml: body, ctaUrl: `${APP_URL}/meetings/agendas/${p.meetingId}`, ctaText: 'Download Full MOM PDF', footerNote: 'This MOM was auto-generated by the AGHMS AI engine.' });
}

function buildMeetingConcludedDeptEmail(p: any) {
  const body = `
    <p style="color:#475569;font-size:14px;line-height:1.6">The HOD meeting has concluded. Here is your department's personalized brief with action points assigned to <strong>${p.deptName}</strong>.</p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:20px;margin:20px 0">
      <p style="margin:0 0 8px;color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase">${p.deptName} — Action Brief</p>
      <p style="margin:0;color:#334155;font-size:13px;line-height:1.7;white-space:pre-wrap">${p.brief?.replace(/[*#\`]/g, '').slice(0, 800) || 'See full brief in AGHMS portal.'}...</p>
    </div>
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px;margin:16px 0">
      <p style="margin:0;color:#92400e;font-size:13px">⚠️ Please complete all assigned action items within the deadline mentioned in the portal.</p>
    </div>`;
  return buildEmail({ recipientName: p.recipientName, subject: `Your Dept Brief: ${p.title}`, heading: `📋 ${p.deptName} — Meeting Brief`, subheading: 'Personalized action points from the AI', bodyHtml: body, ctaUrl: `${APP_URL}/dashboard`, ctaText: 'View Full Brief & Download PDF', footerNote: 'This brief was auto-generated by the AGHMS AI engine from your department notes.' });
}

function buildActionItemEmail(p: any) {
  const body = `
    <p style="color:#475569;font-size:14px;line-height:1.6">A new action item has been assigned to you from the HOD meeting.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:20px;margin:20px 0">
      <tr><td style="padding:6px 0"><span style="color:#ea580c;font-size:12px;font-weight:600;text-transform:uppercase">Action Item</span><br><strong style="color:#1e293b;font-size:14px">${p.description}</strong></td></tr>
      <tr><td style="padding:6px 0"><span style="color:#ea580c;font-size:12px;font-weight:600;text-transform:uppercase">Meeting</span><br><strong style="color:#1e293b;font-size:14px">${p.meetingTitle}</strong></td></tr>
      <tr><td style="padding:6px 0"><span style="color:#ea580c;font-size:12px;font-weight:600;text-transform:uppercase">Deadline</span><br><strong style="color:#dc2626;font-size:14px">${p.deadline}</strong></td></tr>
    </table>`;
  return buildEmail({ recipientName: p.recipientName, subject: `Action Assigned: ${p.description.slice(0,60)}`, heading: '📌 New Action Item Assigned', subheading: `Due: ${p.deadline}`, bodyHtml: body, ctaUrl: `${APP_URL}/meetings/action-items`, ctaText: 'View Action Items' });
}

// ── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { type, recipients, data } = await req.json();

    if (!recipients?.length) {
      return new Response(JSON.stringify({ sent: 0, skipped: true, reason: 'No recipients' }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const results = await Promise.allSettled(
      recipients.map(async (r: { email: string; name: string; deptCode?: string; brief?: string }) => {
        let html = '';
        let subject = '';
        let text = `Dear ${r.name},\n\nPlease check AGHMS for updates.\n\n— ${INSTITUTE_SHORT} AGHMS`;

        const base = { ...data, recipientName: r.name };

        switch (type) {
          case 'meeting_created':
            html = buildMeetingCreatedEmail(base);
            subject = `New Agenda: ${data.title}`;
            break;
          case 'meeting_circulated':
            html = buildMeetingCirculatedEmail(base);
            subject = `Meeting Circulated: ${data.title}`;
            break;
          case 'meeting_started':
            html = buildMeetingStartedEmail(base);
            subject = `🔴 LIVE: ${data.title}`;
            break;
          case 'meeting_concluded_admin':
            html = buildMeetingConcludedAdminEmail(base);
            subject = `MOM Ready: ${data.title}`;
            break;
          case 'meeting_concluded_dept':
            html = buildMeetingConcludedDeptEmail({ ...base, deptName: r.deptCode, brief: r.brief });
            subject = `Your Dept Brief: ${data.title}`;
            break;
          case 'action_item_assigned':
            html = buildActionItemEmail(base);
            subject = `Action Assigned: ${data.description?.slice(0, 60)}`;
            break;
          default:
            return { email: r.email, status: 'skipped', reason: 'Unknown type' };
        }

        const result = await sendViaResend(r.email, subject, html, text);
        return { email: r.email, status: 'sent', id: result.id };
      })
    );

    const sent = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return new Response(JSON.stringify({ sent, failed, results }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('send-email error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }
});
