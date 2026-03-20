// Frontend JS
document.addEventListener('DOMContentLoaded', () => {

  // 1. Initialize Animate On Scroll (AOS)
  if (typeof AOS !== 'undefined') {
    AOS.init({
      once: true,  // whether animation should happen only once - while scrolling down
      offset: 50,  // offset (in px) from the original trigger point
      duration: 600, // values from 0 to 3000, with step 50ms
    });
  }

  // 2. Initialize Lucide Icons
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  // Helper for SweetAlert
  const showToast = (title, icon = 'success') => {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        icon: icon,
        title: title
      });
    } else {
      alert(title);
    }
  };

  const contactForm = document.getElementById('contact-form');
  const registerForm = document.getElementById('register-form');
  const newsletterForms = document.querySelectorAll('form[data-newsletter]');

  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = contactForm.querySelector('button');
      const originalText = btn.innerHTML;
      btn.innerHTML = '<i data-lucide="loader" style="margin-right:8px; width:18px;"></i> Sending...';
      if (typeof lucide !== 'undefined') lucide.createIcons();
      btn.disabled = true;

      try {
        const data = Object.fromEntries(new FormData(contactForm));
        const resp = await fetch('/api/contact', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
        const j = await resp.json();
        showToast(j.message || 'Message sent', 'success');
        contactForm.reset();
      } catch (err) {
        showToast('An error occurred. Please try again.', 'error');
        console.error(err);
      } finally {
        btn.innerHTML = originalText;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        btn.disabled = false;
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = registerForm.querySelector('button');
      const originalText = btn.innerHTML;
      btn.innerHTML = '<i data-lucide="loader" style="margin-right:8px; width:18px;"></i> Registering...';
      if (typeof lucide !== 'undefined') lucide.createIcons();
      btn.disabled = true;

      try {
        const data = Object.fromEntries(new FormData(registerForm));
        const resp = await fetch('/api/register', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
        const j = await resp.json();
        showToast(j.message || 'Registered', 'success');
        registerForm.reset();
      } catch (err) {
        showToast('An error occurred. Please try again.', 'error');
        console.error(err);
      } finally {
        btn.innerHTML = originalText;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        btn.disabled = false;
      }
    });
  }

  newsletterForms.forEach(f => {
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = f.querySelector('button');
      const originalText = btn.innerText;
      btn.innerText = 'Sending...';
      btn.disabled = true;
      try {
        const data = Object.fromEntries(new FormData(f));
        const resp = await fetch('/api/newsletter', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
        const j = await resp.json();
        showToast(j.message || 'Subscribed successfully', 'success');
        f.reset();
      } catch(err) {
        showToast('An error occurred.', 'error');
      } finally {
        btn.innerText = originalText;
        btn.disabled = false;
      }
    })
  });
});