/**
 * Generates a concise SMS message for newly created parent accounts
 * @param {Object} params
 * @param {string} params.email - Parent's login email
 * @param {string} params.password - Temporary password
 * @param {string} [params.schoolName='Karumande School'] - Optional school name
 * @returns {string} Plain text SMS body (keep under 160 characters for single SMS)
 */
function generateParentSMS({
  email,
  password,
  schoolName = 'Karumande School',
}) {
  // Sanitize and trim inputs
  const safeEmail = String(email || '').trim();
  const safePassword = String(password || '').trim();
  const safeSchool = String(schoolName).trim();

  // Keep SMS short and clear — aim for < 160 characters
  return `${safeSchool} Parent Portal

Login Details:
Email: ${safeEmail}
Temp Password: ${safePassword}

Please change your password immediately after logging in.

Login: ${process.env.FRONTEND_URL || 'school-portal.com'}`;
}

module.exports = { generateParentSMS };