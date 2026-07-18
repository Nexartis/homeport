/**
 * Email templates — waitlist confirmation and waitlist-approved.
 *
 * Assertions cover subject composition, URL construction (approved only),
 * recipient + operator-supplied data interpolation, and HTML escaping.
 */
import { describe, it, expect } from 'vitest';
import { renderWaitlistConfirmationEmail } from '../src/lib/email/templates/waitlist-confirmation';
import { renderWaitlistApprovedEmail } from '../src/lib/email/templates/waitlist-approved';

describe('renderWaitlistConfirmationEmail', () => {
	it('composes subject with nodeName when provided', () => {
		const out = renderWaitlistConfirmationEmail({
			to: 'alice@example.com',
			nodeName: 'Acme Node'
		});
		expect(out.subject).toBe("You're on the waitlist for Acme Node");
		expect(out.html).toContain('Acme Node');
		expect(out.text).toContain('Acme Node');
	});

	it('falls back to generic copy when nodeName missing', () => {
		const out = renderWaitlistConfirmationEmail({ to: 'bob@example.com' });
		expect(out.subject).toBe("You're on the waitlist for a Homeport node");
		expect(out.html).toContain('a Homeport node');
		expect(out.text).toContain('You are on the waitlist');
	});

	it('embeds the recipient email in both bodies', () => {
		const out = renderWaitlistConfirmationEmail({ to: 'alice@example.com' });
		expect(out.html).toContain('alice@example.com');
		expect(out.text).toContain('alice@example.com');
	});

	it('only renders the support contact line when supportEmail is present', () => {
		const without = renderWaitlistConfirmationEmail({ to: 'alice@example.com' });
		expect(without.html).not.toContain('mailto:');
		const withSupport = renderWaitlistConfirmationEmail({
			to: 'alice@example.com',
			supportEmail: 'help@example.com'
		});
		expect(withSupport.html).toContain('mailto:help@example.com');
		expect(withSupport.text).toContain('help@example.com');
	});

	it('escapes HTML-unsafe characters in operator-supplied fields', () => {
		const out = renderWaitlistConfirmationEmail({
			to: 'alice@example.com',
			nodeName: '<script>alert(1)</script>',
			supportEmail: '"&<>'
		});
		expect(out.html).not.toContain('<script>alert(1)</script>');
		expect(out.html).toContain('&lt;script&gt;');
		expect(out.html).toContain('&quot;&amp;&lt;&gt;');
	});
});

describe('renderWaitlistApprovedEmail', () => {
	const BASE = 'https://node.example.com';

	it('composes subject and sign-in URL from baseUrl', () => {
		const out = renderWaitlistApprovedEmail({
			to: 'alice@example.com',
			baseUrl: BASE,
			nodeName: 'Acme Node'
		});
		expect(out.subject).toBe("You're off the waitlist — sign in to Acme Node");
		expect(out.html).toContain('https://node.example.com/auth');
		expect(out.text).toContain('https://node.example.com/auth');
	});

	it('strips trailing slashes from baseUrl before appending /auth', () => {
		const out = renderWaitlistApprovedEmail({
			to: 'alice@example.com',
			baseUrl: 'https://node.example.com////'
		});
		expect(out.html).toContain('https://node.example.com/auth');
		expect(out.html).not.toContain('https://node.example.com////');
	});

	it('falls back to generic copy when nodeName missing', () => {
		const out = renderWaitlistApprovedEmail({ to: 'alice@example.com', baseUrl: BASE });
		expect(out.subject).toBe("You're off the waitlist — sign in to the NANDA Node");
		expect(out.html).toContain('a Homeport node');
		expect(out.text).toContain("You're off the waitlist");
	});

	it('embeds the recipient email into the invitation line', () => {
		const out = renderWaitlistApprovedEmail({
			to: 'alice@example.com',
			baseUrl: BASE
		});
		expect(out.html).toContain('alice@example.com');
		expect(out.text).toContain('alice@example.com');
	});

	it('escapes HTML-unsafe characters in nodeName and supportEmail', () => {
		const out = renderWaitlistApprovedEmail({
			to: 'alice@example.com',
			baseUrl: BASE,
			nodeName: '<b>x</b>',
			supportEmail: '"&<>'
		});
		expect(out.html).not.toContain('<b>x</b>');
		expect(out.html).toContain('&lt;b&gt;x&lt;/b&gt;');
		expect(out.html).toContain('&quot;&amp;&lt;&gt;');
	});

	it('renders an anchor with the constructed login URL', () => {
		const out = renderWaitlistApprovedEmail({
			to: 'alice@example.com',
			baseUrl: BASE,
			nodeName: 'Acme Node'
		});
		expect(out.html).toMatch(/<a href="https:\/\/node.example.com\/auth"/);
	});
});
