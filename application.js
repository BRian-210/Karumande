// public/application.js
// Enhanced file upload with preview, validation, drag-drop, remove button + better UX

document.addEventListener('DOMContentLoaded', () => {
    // Configuration – easy to extend later
    const uploadFields = [
      {
        name: 'photo',
        containerId: 'photoUpload',
        previewId: 'photoPreview',
        maxSizeMB: 5,
        acceptedTypes: ['image/jpeg', 'image/png', 'image/jpg'],
        allowPreview: true // show image thumbnail
      },
      {
        name: 'birthCertificate',
        containerId: 'birthCertUpload',
        previewId: 'birthCertPreview',
        maxSizeMB: 10,
        acceptedTypes: ['application/pdf', 'image/jpeg', 'image/png'],
        allowPreview: false
      },
      {
        name: 'transferLetter',
        containerId: 'transferUpload',
        previewId: 'transferPreview',
        maxSizeMB: 10,
        acceptedTypes: ['application/pdf', 'image/jpeg', 'image/png'],
        allowPreview: false
      }
    ];
  
    // Reusable file upload setup
    function setupFileUpload(config) {
      const { name, containerId, previewId, maxSizeMB, acceptedTypes, allowPreview } = config;
  
      const input = document.querySelector(`input[name="${name}"]`);
      const container = document.getElementById(containerId);
      const preview = document.getElementById(previewId);
  
      if (!input || !container || !preview) return;
  
      const maxSizeBytes = maxSizeMB * 1024 * 1024;
  
      // Reset preview
      const resetPreview = () => {
        preview.innerHTML = '';
        preview.style.display = 'none';
        input.value = '';
      };
  
      // Show file info + optional thumbnail
      const showPreview = (file) => {
        const sizeMB = (file.size / 1024 / 1024).toFixed(2);
  
        let previewHTML = `
          <div class="file-info">
            <div class="file-name">${file.name}</div>
            <div class="file-meta">${sizeMB} MB • ${file.type}</div>
          </div>
          <button type="button" class="remove-file" aria-label="Remove file">×</button>
        `;
  
        if (allowPreview && file.type.startsWith('image/')) {
          const img = document.createElement('img');
          img.src = URL.createObjectURL(file);
          img.alt = 'Preview of ' + file.name;
          img.className = 'file-preview-img';
          previewHTML = `<div class="preview-wrapper">${img.outerHTML}</div>` + previewHTML;
        }
  
        preview.innerHTML = previewHTML;
        preview.style.display = 'block';
  
        // Remove button functionality
        preview.querySelector('.remove-file')?.addEventListener('click', resetPreview);
      };
  
      // Validate & handle selected/dropped files
      const handleFiles = (files) => {
        if (files.length === 0) return;
  
        const file = files[0];
  
        // Type check
        if (!acceptedTypes.includes(file.type)) {
          alert(`Invalid file type. Allowed: ${acceptedTypes.join(', ')}`);
          return;
        }
  
        // Size check
        if (file.size > maxSizeBytes) {
          alert(`File too large. Maximum allowed: ${maxSizeMB} MB`);
          return;
        }
  
        input.files = files;
        showPreview(file);
      };
  
      // Drag & Drop
      const preventDefaults = (e) => e.preventDefault();
  
      ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        container.addEventListener(eventName, preventDefaults);
      });
  
      ['dragenter', 'dragover'].forEach(eventName => {
        container.addEventListener(eventName, () => container.classList.add('dragover'));
      });
  
      ['dragleave', 'drop'].forEach(eventName => {
        container.addEventListener(eventName, () => container.classList.remove('dragover'));
      });
  
      container.addEventListener('drop', (e) => {
        handleFiles(e.dataTransfer.files);
      });
  
      input.addEventListener('change', () => {
        handleFiles(input.files);
      });
    }
  
    // Initialize all upload fields
    uploadFields.forEach(setupFileUpload);
  
    // Form submission
    const form = document.getElementById('admissionForm');
    if (!form) return;
  
    const submitBtn = document.getElementById('submitBtn');
    const btnText = document.getElementById('btnText');
    const loadingText = document.getElementById('loadingText');
    const successMessage = document.getElementById('successMessage');
  
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
  
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
  
      // Disable button & show loading
      submitBtn.disabled = true;
      if (btnText) btnText.style.display = 'none';
      if (loadingText) loadingText.style.display = 'inline';
  
      const formData = new FormData(form);
  
      try {
        const response = await fetch('/api/admissions', {
          method: 'POST',
          body: formData,
        });
  
        const result = await response.json();
  
        if (!response.ok) {
          throw new Error(result.message || 'Failed to submit application. Please try again.');
        }
  
        // Success
        form.style.opacity = '0.6';
        form.style.pointerEvents = 'none';
        if (successMessage) {
          successMessage.style.display = 'block';
          successMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
  
      } catch (err) {
        alert('Error: ' + err.message);
        submitBtn.disabled = false;
        if (btnText) btnText.style.display = 'inline';
        if (loadingText) loadingText.style.display = 'none';
      }
    });
  });