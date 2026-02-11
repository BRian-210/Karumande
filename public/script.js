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
  // Load and Display Announcements
  // ====================
  async function loadAnnouncements() {
    try {
      const response = await fetch('/api/announcements?limit=5');
      if (!response.ok) throw new Error('Failed to fetch announcements');

      const data = await response.json();
      const announcements = data.data || [];

      const container = document.getElementById('announcementsContainer');
      if (!container) return;

      if (announcements.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--muted);"><p>No announcements at the moment.</p></div>';
        return;
      }

      container.innerHTML = announcements.map(announcement => `
        <div class="announcement">
          <strong>${announcement.title}</strong>
          <p>${announcement.body}</p>
          <small style="color: var(--muted);">${new Date(announcement.createdAt).toLocaleDateString()}</small>
        </div>
      `).join('');
    } catch (err) {
      console.error('Error loading announcements:', err);
      const container = document.getElementById('announcementsContainer');
      if (container) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--muted);"><p>Could not load announcements.</p></div>';
      }
    }
  }

  loadAnnouncements();

  // ====================
  // Load and Display Gallery
  // ====================
  async function loadGallery() {
    try {
      const response = await fetch('/api/gallery');
      if (!response.ok) throw new Error('Failed to fetch gallery');

      const data = await response.json();
      const images = data.data || [];

      const grid = document.getElementById('galleryGrid');
      if (!grid) return;

      if (images.length === 0) {
        grid.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--muted); grid-column: 1 / -1;"><p>No gallery images yet.</p></div>';
        return;
      }

      grid.innerHTML = images.map(image => `
        <div class="gallery-item" data-id="${image._id}">
          <img src="${image.imageUrl}" alt="${image.title || 'Gallery image'}" loading="lazy" />
          ${image.title ? `<p class="gallery-title">${image.title}</p>` : ''}
          ${image.description ? `<p class="gallery-desc">${image.description}</p>` : ''}
          <button class="gallery-delete-btn" data-id="${image._id}" style="display: none;">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      `).join('');

      // Attach delete handlers
      document.querySelectorAll('.gallery-delete-btn').forEach(btn => {
        btn.addEventListener('click', () => deleteGalleryImage(btn.dataset.id));
      });
    } catch (err) {
      console.error('Error loading gallery:', err);
      const grid = document.getElementById('galleryGrid');
      if (grid) {
        grid.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--muted); grid-column: 1 / -1;"><p>Could not load gallery.</p></div>';
      }
    }
  }

  loadGallery();

  // ====================
  // Admin Gallery Management
  // ====================
  async function initializeGalleryAdmin() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.role !== 'admin') return;

      const adminBtn = document.getElementById('galleryAdminBtn');
      const formContainer = document.getElementById('galleryFormContainer');
      const submitBtn = document.getElementById('galleryFormSubmit');
      const cancelBtn = document.getElementById('galleryFormCancel');
      const imageUrlInput = document.getElementById('galleryImageUrl');
      const imageTitleInput = document.getElementById('galleryImageTitle');
      const imageDescInput = document.getElementById('galleryImageDesc');

      if (!adminBtn) return;

      // Show admin button
      adminBtn.style.display = 'inline-block';

      // Show gallery delete buttons on hover
      document.addEventListener('mouseover', (e) => {
        if (e.target.closest('.gallery-item')) {
          e.target.closest('.gallery-item').querySelector('.gallery-delete-btn').style.display = 'block';
        }
      });

      document.addEventListener('mouseout', (e) => {
        if (e.target.closest('.gallery-item')) {
          e.target.closest('.gallery-item').querySelector('.gallery-delete-btn').style.display = 'none';
        }
      });

      // Toggle form
      adminBtn.addEventListener('click', () => {
        formContainer.style.display = formContainer.style.display === 'none' ? 'block' : 'none';
        if (formContainer.style.display === 'block') {
          imageUrlInput.focus();
        }
      });

      cancelBtn.addEventListener('click', () => {
        formContainer.style.display = 'none';
        imageUrlInput.value = '';
        imageTitleInput.value = '';
        imageDescInput.value = '';
      });

      // Submit form
      submitBtn.addEventListener('click', async () => {
        const imageUrl = imageUrlInput.value.trim();
        if (!imageUrl) {
          alert('Please enter an image URL');
          return;
        }

        try {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Adding...';

          const response = await fetch('/api/gallery', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              imageUrl,
              title: imageTitleInput.value.trim(),
              description: imageDescInput.value.trim()
            })
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to add image');
          }

          // Clear form and reload gallery
          imageUrlInput.value = '';
          imageTitleInput.value = '';
          imageDescInput.value = '';
          formContainer.style.display = 'none';
          loadGallery();
          alert('Image added successfully!');
        } catch (err) {
          console.error('Error adding image:', err);
          alert(`Error: ${err.message}`);
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerHTML = 'Add to Gallery';
        }
      });
    } catch (err) {
      console.warn('Gallery admin not initialized:', err);
    }
  }

  async function deleteGalleryImage(imageId) {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('You must be logged in as admin');
      return;
    }

    if (!confirm('Are you sure you want to delete this image?')) {
      return;
    }

    try {
      const response = await fetch(`/api/gallery/${imageId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete image');
      }

      loadGallery();
      alert('Image deleted successfully!');
    } catch (err) {
      console.error('Error deleting image:', err);
      alert(`Error: ${err.message}`);
    }
  }
  initializeGalleryAdmin();
});



 