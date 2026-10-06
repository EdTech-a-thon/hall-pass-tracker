/** Where a teacher reaches a person: for help, ideas, or privacy questions. */
export const supportEmail = 'support@teacher.dev';

/** A link that starts an email to support, with the subject (and optionally the message) filled in. */
export function supportMailto(subject: string, body?: string) {
  const query = `subject=${encodeURIComponent(subject)}` + (body ? `&body=${encodeURIComponent(body)}` : '');
  return `mailto:${supportEmail}?${query}`;
}
