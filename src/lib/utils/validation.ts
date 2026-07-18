/**
 * Shared form-validation helpers used by auth pages.
 */

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface EmailValidation {
	emailError: string;
	isFormValid: boolean;
}

/** Validate an email field value, returning error message and validity. */
export function validateEmail(email: string): EmailValidation {
	const trimmed = email.trim();
	if (!trimmed) {
		return { emailError: 'Email is required', isFormValid: false };
	}
	if (!EMAIL_REGEX.test(trimmed)) {
		return { emailError: 'Please enter a valid email address', isFormValid: false };
	}
	return { emailError: '', isFormValid: true };
}
