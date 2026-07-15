export const BOOTSTRAP_ADMIN_EMAILS = [
  "jeromeitable37@gmail.com",
  // Kept for compatibility with the earlier misspelled configuration.
  "jerometable37@gmail.com",
];

export function isBootstrapAdminEmail(email: string): boolean {
  return BOOTSTRAP_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}
