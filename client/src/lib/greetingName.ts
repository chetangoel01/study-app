/** Derives a friendly first name from email for dashboard greetings. */
export function greetingName(email: string): string {
  const local = email.split('@')[0]?.trim() ?? '';
  if (!local) return 'there';

  const words = local.replace(/[+._-]+/g, ' ').split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'there';

  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
