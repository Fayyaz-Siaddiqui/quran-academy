export type MailTemplate =
  | { template: 'verify-email'; data: { name: string; url: string } }
  | { template: 'reset-password'; data: { name: string; url: string } }
  | { template: 'teacher-application-received'; data: { name: string } }
  | { template: 'teacher-approved'; data: { name: string; loginUrl: string } }
  | { template: 'teacher-rejected'; data: { name: string; reason?: string } }
  | { template: 'account-status'; data: { name: string; status: string; reason?: string } }
  | { template: 'trial-booked'; data: { name: string; course: string; date: string; time: string } }
  | { template: 'staff-new-lead'; data: { kind: string; name: string; email: string; adminUrl: string } }
  | { template: 'child-account-created'; data: { parentName: string; childName: string; url: string } };

export type MailJob = MailTemplate & { to: string };

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function layout(title: string, body: string, cta?: { label: string; url: string }) {
  const button = cta
    ? `<p style="margin:28px 0"><a href="${esc(cta.url)}" style="background:#0f766e;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600">${esc(cta.label)}</a></p>
       <p style="font-size:12px;color:#6b7280">If the button does not work, copy this link:<br>${esc(cta.url)}</p>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#f6f7f5;font-family:Segoe UI,Arial,sans-serif;color:#1f2937">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 12px">
  <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;padding:32px">
  <tr><td><h1 style="font-size:20px;margin:0 0 16px;color:#0f766e">${esc(title)}</h1>${body}${button}
  <p style="margin-top:32px;font-size:12px;color:#9ca3af">Quran Academy · You received this email because of activity on your account.</p>
  </td></tr></table></td></tr></table></body></html>`;
}

export function renderMail(job: MailTemplate): { subject: string; html: string } {
  switch (job.template) {
    case 'verify-email':
      return {
        subject: 'Verify your email address',
        html: layout('Verify your email', `<p>Assalamu alaikum ${esc(job.data.name)},</p><p>Please confirm your email address to activate your account.</p>`, { label: 'Verify email', url: job.data.url }),
      };
    case 'reset-password':
      return {
        subject: 'Reset your password',
        html: layout('Password reset', `<p>Assalamu alaikum ${esc(job.data.name)},</p><p>We received a request to reset your password. This link expires in 60 minutes. If you did not request it, ignore this email.</p>`, { label: 'Reset password', url: job.data.url }),
      };
    case 'teacher-application-received':
      return {
        subject: 'We received your teacher application',
        html: layout('Application received', `<p>Assalamu alaikum ${esc(job.data.name)},</p><p>Thank you for applying to teach with us. Our academic team will review your qualifications and documents and contact you soon.</p>`),
      };
    case 'teacher-approved':
      return {
        subject: 'Your teacher application has been approved',
        html: layout('Welcome to the faculty', `<p>Assalamu alaikum ${esc(job.data.name)},</p><p>Your application has been approved. You can now sign in to your teacher portal.</p>`, { label: 'Sign in', url: job.data.loginUrl }),
      };
    case 'teacher-rejected':
      return {
        subject: 'Update on your teacher application',
        html: layout('Application update', `<p>Assalamu alaikum ${esc(job.data.name)},</p><p>Thank you for your interest. We are unable to approve your application at this time.</p>${job.data.reason ? `<p><strong>Notes:</strong> ${esc(job.data.reason)}</p>` : ''}`),
      };
    case 'account-status':
      return {
        subject: `Your account is now ${job.data.status.toLowerCase()}`,
        html: layout('Account status changed', `<p>Assalamu alaikum ${esc(job.data.name)},</p><p>Your account status is now <strong>${esc(job.data.status)}</strong>.</p>${job.data.reason ? `<p>Reason: ${esc(job.data.reason)}</p>` : ''}<p>Contact support if you have questions.</p>`),
      };
    case 'trial-booked':
      return {
        subject: 'Your free trial class request',
        html: layout('Free trial requested', `<p>Assalamu alaikum ${esc(job.data.name)},</p><p>We received your request for a free <strong>${esc(job.data.course)}</strong> trial on <strong>${esc(job.data.date)}</strong> at <strong>${esc(job.data.time)}</strong> (your time). Our team will confirm the slot with you shortly.</p>`),
      };
    case 'staff-new-lead':
      return {
        subject: `New ${job.data.kind}: ${job.data.name}`,
        html: layout(`New ${job.data.kind}`, `<p>${esc(job.data.name)} (${esc(job.data.email)}) just submitted a ${esc(job.data.kind)}.</p>`, { label: 'Open in admin', url: job.data.adminUrl }),
      };
    case 'child-account-created':
      return {
        subject: `${job.data.childName}'s student account is ready`,
        html: layout('Child account created', `<p>Assalamu alaikum ${esc(job.data.parentName)},</p><p>A student account for <strong>${esc(job.data.childName)}</strong> has been added to your family. You can manage it from your parent portal.</p>`, { label: 'Open parent portal', url: job.data.url }),
      };
  }
}
