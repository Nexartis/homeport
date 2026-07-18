/**
 * Invitation email template — operator-originated notification sent via Resend.
 *
 * The body does NOT embed a token. It simply invites the recipient to sign in
 * at /auth; the allowlist lookup in hooks.server.ts gates access at login time.
 * Sentinel handles the actual magic-link delivery on form submit.
 */

export interface InvitationTemplateVars {
	baseUrl: string;
	nodeName?: string;
	invitedByEmail?: string;
	note?: string;
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

export function renderInvitationEmail(vars: InvitationTemplateVars): {
	subject: string;
	html: string;
	text: string;
} {
	const node = esc(vars.nodeName) || 'a Homeport node';
	const inviter = esc(vars.invitedByEmail);
	const note = esc(vars.note);
	const support = esc(vars.supportEmail);
	const loginUrl = `${vars.baseUrl.replace(/\/+$/, '')}/auth`;
	const subject = `You've been invited to ${vars.nodeName ?? 'a NANDA Node'}`;

	const html = `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#0b0b10;color:#e5e7eb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0b0b10;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="600" cellspacing="0" cellpadding="0"
           style="max-width:600px;width:100%;background:#13131a;border:1px solid #1f1f2b;border-radius:12px;overflow:hidden;">
      <tr><td style="padding:28px 32px;border-bottom:1px solid #1f1f2b;">
        <h1 style="margin:0;font-size:20px;font-weight:600;color:#f9fafb;">You've been invited</h1>
      </td></tr>
      <tr><td style="padding:28px 32px;font-size:15px;line-height:1.55;color:#d1d5db;">
        <p style="margin:0 0 16px 0;">
          ${inviter ? `<strong>${inviter}</strong> invited you to` : "You've been invited to"}
          join <strong style="color:#f9fafb;">${node}</strong>.
        </p>
        ${note ? `<p style="margin:0 0 16px 0;padding:12px 16px;background:#0f0f16;border-left:3px solid #7c3aed;border-radius:4px;color:#cbd5e1;"><em>${note}</em></p>` : ''}
        <p style="margin:0 0 24px 0;">
          To accept, sign in with this email address. A magic link will be sent
          so you can log in without a password.
        </p>
        <p style="margin:0 0 24px 0;">
          <a href="${esc(loginUrl)}" style="display:inline-block;padding:12px 24px;background:#7c3aed;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:500;">
            Sign in to ${node}
          </a>
        </p>
        <p style="margin:0;font-size:13px;color:#9ca3af;">
          Or copy and paste this URL into your browser:<br/>
          <span style="color:#7c3aed;word-break:break-all;">${esc(loginUrl)}</span>
        </p>
      </td></tr>
      <tr><td style="padding:20px 32px;background:#0f0f16;border-top:1px solid #1f1f2b;font-size:12px;color:#6b7280;">
        ${support ? `Questions? Reply to this email or contact <a href="mailto:${support}" style="color:#9ca3af;">${support}</a>.<br/>` : ''}
        If you weren't expecting this invitation, you can safely ignore this email.
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

	const text = [
		vars.nodeName ? `You have been invited to ${vars.nodeName}` : 'You have been invited',
		'',
		vars.invitedByEmail ? `Invited by: ${vars.invitedByEmail}` : '',
		vars.note ? `Note: ${vars.note}` : '',
		'',
		`Sign in here: ${loginUrl}`,
		'',
		vars.supportEmail ? `Questions? ${vars.supportEmail}` : '',
		'If you were not expecting this invitation, you can safely ignore this email.'
	]
		.filter(Boolean)
		.join('\n');

	return { subject, html, text };
}
