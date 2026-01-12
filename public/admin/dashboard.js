
  const burger   = document.getElementById('burger');
  const sidebar  = document.getElementById('sidebar');
  const main     = document.querySelector('main.content');

  function toggleSidebar() {
    const isActive = sidebar.classList.toggle('active');
    burger.setAttribute('aria-expanded', isActive);
    // Optional: prevent body scroll when sidebar is open on mobile
    document.body.classList.toggle('sidebar-open', isActive);
  }

  burger.addEventListener('click', toggleSidebar);

  // Close sidebar when clicking main content (good for mobile)
  main.addEventListener('click', () => {
    if (sidebar.classList.contains('active')) {
      toggleSidebar();
    }
  });