/**
 * Waitlist-approved email — sent when an operator promotes a waitlisted
 * row to `invited`. Copy variant of the standard invitation email that
 * opens with "you're off the waitlist" before pointing to the sign-in URL.
 *
 * Workstream A's admin approval flow calls `sendWaitlistApprovedEmail`
 * instead of `sendInvitationEmail` when the originating status was
 * `waitlisted`.
 */

export interface WaitlistApprovedVars {
	to: string;
	baseUrl: string;
	nodeName?: string;
	supportEmail?: string;
}

function esc(raw: string | undefined): string {
	if (!raw) return '';
	return raw
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

export function renderWaitlistApprovedEmail(vars: WaitlistApprovedVars): {
	subject: string;
	html: string;
	text: string;
} {
	const node = esc(vars.nodeName) || 'a Homeport node';
	const support = esc(vars.supportEmail);
	const loginUrl = `${vars.baseUrl.replace(/\/+$/, '')}/auth`;
	const subject = `You're off the waitlist — sign in to ${vars.nodeName ?? 'the NANDA Node'}`;

	const html = `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#0b0b10;color:#e5e7eb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0b0b10;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="600" cellspacing="0" cellpadding="0"
           style="max-width:600px;width:100%;background:#13131a;border:1px solid #1f1f2b;border-radius:12px;overflow:hidden;">
      <tr><td style="padding:28px 32px;border-bottom:1px solid #1f1f2b;">
        <h1 style="margin:0;font-size:20px;font-weight:600;color:#f9fafb;">You're off the waitlist</h1>
      </td></tr>
      <tr><td style="padding:28px 32px;font-size:15px;line-height:1.55;color:#d1d5db;">
        <p style="margin:0 0 16px 0;">
          Great news — a seat has opened on <strong style="color:#f9fafb;">${node}</strong>
          and your invitation is now active.
        </p>
        <p style="margin:0 0 24px 0;">
          Sign in with <strong style="color:#f9fafb;">${esc(vars.to)}</strong>. A magic
          link will be emailed to you so you can log in without a password.
        </p>
        <p style="margin:0 0 24px 0;">
          <a href="${esc(loginUrl)}" style="display:inline-block;padding:12px 24px;background:#7c3aed;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:500;">
            Sign in to ${node}
          </a>
        </p>
        <p style="margin:0;font-size:13px;color:#9ca3af;">
          Or paste this URL into your browser:<br/>
          <span style="color:#7c3aed;word-break:break-all;">${esc(loginUrl)}</span>
        </p>
      </td></tr>
      <tr><td style="padding:20px 32px;background:#0f0f16;border-top:1px solid #1f1f2b;font-size:12px;color:#6b7280;">
        ${support ? `Questions? Contact <a href="mailto:${support}" style="color:#9ca3af;">${support}</a>.<br/>` : ''}
        If this message reached you in error, you can safely ignore it.
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

	const text = [
		vars.nodeName ? `You're off the waitlist for ${vars.nodeName}` : "You're off the waitlist",
		'',
		`A seat has opened for ${vars.to}.`,
		`Sign in here: ${loginUrl}`,
		'',
		vars.supportEmail ? `Questions? ${vars.supportEmail}` : '',
		'If this message reached you in error, you can safely ignore it.'
	]
		.filter(Boolean)
		.join('\n');

	return { subject, html, text };
}
