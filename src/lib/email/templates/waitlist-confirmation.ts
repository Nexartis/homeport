/**
 * Waitlist confirmation email — sent after a visitor submits
 * `POST /api/public/waitlist`. Confirms their request has been logged
 * without promising an invitation timeline.
 */

export interface WaitlistConfirmationVars {
	to: string;
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

export function renderWaitlistConfirmationEmail(vars: WaitlistConfirmationVars): {
	subject: string;
	html: string;
	text: string;
} {
	const node = esc(vars.nodeName) || 'a Homeport node';
	const support = esc(vars.supportEmail);
	const subject = `You're on the waitlist for ${vars.nodeName ?? 'a Homeport node'}`;

	const html = `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#0b0b10;color:#e5e7eb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0b0b10;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="600" cellspacing="0" cellpadding="0"
           style="max-width:600px;width:100%;background:#13131a;border:1px solid #1f1f2b;border-radius:12px;overflow:hidden;">
      <tr><td style="padding:28px 32px;border-bottom:1px solid #1f1f2b;">
        <h1 style="margin:0;font-size:20px;font-weight:600;color:#f9fafb;">You're on the waitlist</h1>
      </td></tr>
      <tr><td style="padding:28px 32px;font-size:15px;line-height:1.55;color:#d1d5db;">
        <p style="margin:0 0 16px 0;">
          Thanks for your interest in <strong style="color:#f9fafb;">${node}</strong>.
        </p>
        <p style="margin:0 0 16px 0;">
          We've added <strong style="color:#f9fafb;">${esc(vars.to)}</strong> to the
          waitlist. You'll receive a separate email with a sign-in link as soon as
          the operator opens a seat for you.
        </p>
        <p style="margin:0;font-size:13px;color:#9ca3af;">
          No action is required from you right now.
        </p>
      </td></tr>
      <tr><td style="padding:20px 32px;background:#0f0f16;border-top:1px solid #1f1f2b;font-size:12px;color:#6b7280;">
        ${support ? `Questions? Contact <a href="mailto:${support}" style="color:#9ca3af;">${support}</a>.<br/>` : ''}
        If you didn't request this, you can safely ignore this email.
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

	const text = [
		vars.nodeName ? `You are on the waitlist for ${vars.nodeName}` : 'You are on the waitlist',
		'',
		`We've logged a request for ${vars.to}.`,
		"You'll receive a sign-in link once a seat opens.",
		'',
		vars.supportEmail ? `Questions? ${vars.supportEmail}` : '',
		"If you didn't request this, you can safely ignore this email."
	]
		.filter(Boolean)
		.join('\n');

	return { subject, html, text };
}
