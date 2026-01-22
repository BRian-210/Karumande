 if (!localStorage.getItem('token')) {
      window.location.href = 'login.html';
    }

    function logout() {
      if (confirm('Are you sure you want to log out?')) {
        localStorage.removeItem('token');
        // Optional: localStorage.clear();
        window.location.href = 'login.html';
      }
    }