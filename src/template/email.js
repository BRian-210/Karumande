function parentEmail({ parentName, email, password }) {
    return `
      <h3>Welcome to Karumande School</h3>
      <p>Dear ${parentName},</p>
  
      <p>Your parent portal account has been created.</p>
  
      <p><b>Login details:</b></p>
      <ul>
        <li>Email: ${email}</li>
        <li>Password: ${password}</li>
      </ul>
  
      <p>Please change your password after login.</p>
  
      <p>Regards,<br>Karumande School</p>
    `;
  }
  