// public/admin/icons-replace.js
// Replaces Font Awesome <i class="fa-solid fa-..."> with lightweight inline SVGs
// CSP-friendly: no inline <style> injection

(function () {
  // Icon SVG definitions (unchanged from your original)
  const icons = {
    'fa-spinner': `<svg class="svg-icon svg-spin" width="20" height="20" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg"><circle cx="25" cy="25" r="20" stroke="#0d47a1" stroke-width="5" stroke-linecap="round" fill="none" stroke-dasharray="31.4 31.4"/></svg>`,
    'fa-clock-rotate-left': `<svg class="svg-icon" width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#0d47a1" d="M12 8v5l4 2"/><path fill="#0d47a1" d="M21 12a9 9 0 1 1-3-6.36"/></svg>`,
    'fa-inbox': `<svg class="svg-icon" width="28" height="28" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#0f172a" d="M19 3H4.99C3.89 3 3 3.9 3 5l.01 11c0 1.1.89 2 1.99 2H9l2-3h2l2 3h4.01c1.1 0 1.99-.9 1.99-2L21 5c0-1.1-.9-2-2-2z"/></svg>`,
    'fa-eye': `<svg class="svg-icon" width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#0d47a1" d="M12 5c-7 0-11 7-11 7s4 7 11 7 11-7 11-7-4-7-11-7zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8z"/></svg>`,
    'fa-check': `<svg class="svg-icon" width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#059669" d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>`,
    'fa-times': `<svg class="svg-icon" width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#ef4444" d="M18.3 5.71L12 12l6.3 6.29-1.41 1.42L10.59 13.41 4.29 19.71 2.88 18.29 9.18 12 2.88 5.71 4.29 4.29 10.59 10.59 16.88 4.29z"/></svg>`,
    'fa-bars': `<svg class="svg-icon" width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect width="18" height="2" y="5" x="3" fill="#fff" rx="1"/><rect width="18" height="2" y="11" x="3" fill="#fff" rx="1"/><rect width="18" height="2" y="17" x="3" fill="#fff" rx="1"/></svg>`,
    'fa-chart-line': `<svg class="svg-icon" width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#0d47a1" d="M3 17h2l4-8 3 6 5-10 4 8v2H3z"/></svg>`,
    'fa-home': `<svg class="svg-icon" width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#0d47a1" d="M12 3l9 8h-3v8h-12v-8h-3z"/></svg>`,
    'fa-user-plus': `<svg class="svg-icon" width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#0d47a1" d="M15 14c2.76 0 5 2.24 5 5v1H4v-1c0-2.76 2.24-5 5-5h6zM12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM3 7h4v2H3z"/></svg>`,
    'fa-users': `<svg class="svg-icon" width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#0d47a1" d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zM8 11c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zM8 13c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zM16 13c-.29 0-.62.02-.97.05 1.16.84 1.97 2 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>`,
    'fa-money-bill-wave': `<svg class="svg-icon" width="18" height="18" viewBox="0 0 24 24"><rect width="18" height="12" x="3" y="6" fill="#0d47a1" rx="2"/></svg>`,
    'fa-credit-card': `<svg class="svg-icon" width="18" height="18" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2" fill="#0d47a1"/><rect x="4" y="9" width="8" height="2" fill="#fff"/></svg>`,
    'fa-graduation-cap': `<svg class="svg-icon" width="18" height="18" viewBox="0 0 24 24"><path fill="#0d47a1" d="M12 2L1 7l11 5 9-4.09V17h2V7z"/></svg>`,
    'fa-bullhorn': `<svg class="svg-icon" width="18" height="18" viewBox="0 0 24 24"><path fill="#0d47a1" d="M3 10v4h2l7 3V7L5 10H3z"/></svg>`,
    'fa-file-lines': `<svg class="svg-icon" width="18" height="18" viewBox="0 0 24 24"><path fill="#0d47a1" d="M6 2h7l5 5v13a2 2 0 0 1-2 2H6z"/></svg>`,
    'fa-arrow-right-from-bracket': `<svg class="svg-icon" width="18" height="18" viewBox="0 0 24 24"><path fill="#0d47a1" d="M10 17l5-5-5-5v3H3v4h7v3z"/></svg>`,
    'fa-user-clock': `<svg class="svg-icon" width="18" height="18" viewBox="0 0 24 24"><path fill="#0d47a1" d="M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm6 2v6H6v-6c0-2.2 4-3 6-3s6 .8 6 3z"/></svg>`
  };

  // Replace all matching icons
  function replaceIcons() {
    const iconsToReplace = document.querySelectorAll('i.fa-solid');

    iconsToReplace.forEach((iconEl) => {
      // Find the first matching fa- class
      const faClass = Array.from(iconEl.classList).find(cls => cls.startsWith('fa-') && icons[cls]);

      if (faClass) {
        const wrapper = document.createElement('span');
        wrapper.className = 'icon-replaced';
        wrapper.innerHTML = icons[faClass];

        // Preserve any additional classes from original <i> (e.g. fa-lg, fa-fw)
        iconEl.classList.forEach(cls => {
          if (cls !== 'fa-solid' && !cls.startsWith('fa-')) {
            wrapper.classList.add(cls);
          }
        });

        iconEl.replaceWith(wrapper);
      }
    });
  }

  // Run on DOM ready
  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', replaceIcons);
    } else {
      replaceIcons();
    }
  }

  init();

  // Optional: Re-run when content is dynamically added (e.g., after AJAX load)
  // Uncomment if you load tables/forms dynamically
  // document.addEventListener('content-loaded', replaceIcons); // or use MutationObserver
})();