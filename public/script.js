// public/script.js
document.addEventListener('DOMContentLoaded', () => {
  // ====================
  // Mobile Navigation Toggle
  // ====================
  const burger = document.getElementById('burger');
  const navLinks = document.getElementById('nav-links');

  if (burger && navLinks) {
    const toggleMenu = () => {
      const isOpen = navLinks.classList.toggle('show');
      burger.setAttribute('aria-expanded', isOpen);
    };

    burger.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent outside click handler from closing immediately
      toggleMenu();
    });

    // Close menu when clicking a nav link
    navLinks.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('show');
        burger.setAttribute('aria-expanded', 'false');
      });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!navLinks.contains(e.target) && !burger.contains(e.target)) {
        navLinks.classList.remove('show');
        burger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // ====================
  // Smooth Scrolling for Anchor Links
  // ====================
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href === '#') return; // Ignore empty anchors

      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });

        // Update URL without jumping
        history.pushState(null, null, href);

        // Close mobile menu if open
        if (navLinks && navLinks.classList.contains('show')) {
          navLinks.classList.remove('show');
          if (burger) burger.setAttribute('aria-expanded', 'false');
        }
      }
    });
  });

  // ====================
  // Contact Form Submission
  // ====================
  const contactForm = document.querySelector('.contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const submitBtn = contactForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;

      // Loading state
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Sending... <i class="fa-solid fa-spinner fa-spin"></i>';

      try {
        // TODO: Replace with real backend endpoint when ready
        // const response = await fetch('/api/contact', {
        //   method: 'POST',
        //   body: new FormData(contactForm)
        // });
        // if (!response.ok) throw new Error('Network error');

        // Simulated success (remove in production)
        await new Promise(resolve => setTimeout(resolve, 1000));

        alert('Thank you! Your message has been sent successfully. We’ll get back to you soon.');
        contactForm.reset();
      } catch (error) {
        console.error('Contact form error:', error);
        alert('Sorry, there was a problem sending your message. Please try again or email us directly at karumandelinkschool@gmail.com');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    });
  }

  // ====================
  // Admin Panel Link (Only for Logged-in Admins)
  // ====================
  const token = localStorage.getItem('token');
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.role === 'admin') {
        // Avoid duplicate links if script runs multiple times
        if (document.querySelector('.admin-link')) return;

        const adminLink = document.createElement('a');
        adminLink.href = '/admin/dashboard.html';
        adminLink.textContent = 'Admin Panel';
        adminLink.className = 'nav-link nav-pill admin-link';
        adminLink.style.background = '#083070';
        adminLink.style.color = 'white';
        adminLink.style.marginLeft = '12px';
        adminLink.style.fontWeight = '600';

        const loginLink = document.querySelector('a[href="/login.html"]');
        if (loginLink && loginLink.parentNode) {
          loginLink.parentNode.insertBefore(adminLink, loginLink.nextSibling);
        }
      }
    } catch (err) {
      console.warn('Invalid or expired token:', err);
      // Optionally clear invalid token
      // localStorage.removeItem('token');
    }
  }
});