/**
 * Generates a welcome email for a newly created parent account
 * @param {Object} params
 * @param {string} params.parentName - Full name of the parent
 * @param {string} params.email - Parent's login email
 * @param {string} params.password - Temporary password (plain text - use cautiously)
 * @param {string} [params.schoolName='Karumande School'] - Optional school name override
 * @returns {string} HTML email body
 */
function generateParentWelcomeEmail({
  parentName,
  email,
  password,
  schoolName = 'Karumande School',
}) {
  // Sanitize inputs lightly (in real apps, use a proper HTML sanitizer)
  const safeName = String(parentName || 'Parent').trim();
  const safeEmail = String(email || '').trim();
  const safeSchool = String(schoolName).trim();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to ${safeSchool}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333333;
      background-color: #f4f4f4;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
    .header {
      background-color: #1e40af;
      color: #ffffff;
      padding: 30px;
      text-align: center;
    }
    .content {
      padding: 30px;
    }
    h1, h3 {
      color: #1e40af;
    }
    ul {
      padding-left: 20px;
    }
    li {
      margin-bottom: 8px;
    }
    .credentials {
      background-color: #f0f9ff;
      border-left: 4px solid #1e40af;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .warning {
      background-color: #fffbeb;
      border: 1px solid #fcd34d;
      color: #92400e;
      padding: 12px;
      border-radius: 4px;
      margin: 20px 0;
      font-size: 14px;
    }
    .footer {
      background-color: #f8fafc;
      padding: 20px;
      text-align: center;
      font-size: 14px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to ${safeSchool}</h1>
    </div>

    <div class="content">
      <h3>Dear ${safeName},</h3>

      <p>We're excited to welcome you to the <strong>${safeSchool} Parent Portal</strong>!</p>

      <p>Your account has been successfully created. You can now log in to view your child's academic progress, attendance, announcements, and more.</p>

      <div class="credentials">
        <p><strong>Your Login Details:</strong></p>
        <ul>
          <li><strong>Email:</strong> ${safeEmail}</li>
          <li><strong>Temporary Password:</strong> ${password}</li>
        </ul>
      </div>

      <div class="warning">
        <strong>Security Notice:</strong> For your safety, please change your password immediately after logging in for the first time.
      </div>

      <p><a href="${process.env.FRONTEND_URL || 'https://your-school-portal.com'}/login" style="background-color: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 10px 0;">
        Log In to Parent Portal
      </a></p>

      <p>If you have any questions, feel free to contact the school administration.</p>

      <p>Best regards,<br><strong>${safeSchool} Administration</strong></p>
    </div>

    <div class="footer">
      &copy; ${new Date().getFullYear()} ${safeSchool}. All rights reserved.<br>
      This is an automated message — please do not reply directly to this email.
    </div>
  </div>
</body>
</html>
  `.trim();
}

module.exports = { generateParentWelcomeEmail };