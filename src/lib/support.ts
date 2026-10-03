/** Where a teacher reaches a person: for help, ideas, or privacy questions. */
export const supportEmail = 'support@teacher.dev';

/** A link that starts an email to support, with the subject filled in. */
export function supportMailto(subject: string) {
  return `mailto:${supportEmail}?subject=${encodeURIComponent(subject)}`;
}
