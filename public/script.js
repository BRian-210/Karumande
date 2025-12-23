// Mobile navigation toggle
const burger = document.getElementById("burger");
const nav = document.getElementById("nav-links");
if (burger && nav) {
  burger.addEventListener("click", () => nav.classList.toggle("show"));
}

// Simple contact form handler (demo only)
const contactForm = document.querySelector(".contact-form");
if (contactForm) {
  contactForm.addEventListener("submit", (e) => {
    e.preventDefault();
    alert("Thank you! We'll get back to you shortly.");
    contactForm.reset();
  });
}
