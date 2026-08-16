// Onboarding wizard — intercepts the site's existing "Start free" / "Get
// started" / "Log in" anchors and opens an in-page modal instead of jumping
// down the page. One flow for both: magic-link auth creates the account on
// first sign-in, so there's no separate "log in" vs "sign up" form.

(function () {
  const overlay = document.getElementById('wizOverlay');
  const panelRequest = document.getElementById('wizPanelRequest');
  const panelSent = document.getElementById('wizPanelSent');
  const form = document.getElementById('wizForm');
  const emailInput = document.getElementById('wizEmail');
  const submitBtn = document.getElementById('wizSubmit');
  const errorEl = document.getElementById('wizError');
  const sentEmailEl = document.getElementById('wizSentEmail');
  const dots = overlay ? overlay.querySelectorAll('.wiz-dots span') : [];

  if (!overlay || !form) return; // markup not present on this page

  function setStep(n) {
    dots.forEach((d, i) => d.classList.toggle('on', i < n));
  }

  function open() {
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    showPanel(panelRequest);
    setStep(1);
    setTimeout(() => emailInput && emailInput.focus(), 250);
  }

  function close() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  function showPanel(panel) {
    [panelRequest, panelSent].forEach((p) => p && p.classList.remove('active'));
    panel.classList.add('active');
  }

  // Any existing CTA that pointed at #start or #log now opens the wizard.
  document.querySelectorAll('a[href="#start"], a[href="#log"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      open();
    });
  });

  document.getElementById('wizClose').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) close();
  });

  document.getElementById('wizBack').addEventListener('click', (e) => {
    e.preventDefault();
    showPanel(panelRequest);
    setStep(1);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    if (!email) return;

    errorEl.classList.remove('show');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';
    setStep(2);

    try {
      const result = await window.Auth.requestMagicLink(email, '/dashboard/');
      if (!result || result.success === false) {
        throw new Error((result && result.error) || 'Failed to send link');
      }
      setStep(3);
      sentEmailEl.textContent = email;
      showPanel(panelSent);
    } catch (err) {
      errorEl.textContent = 'Could not send the link — check the address and try again.';
      errorEl.classList.add('show');
      setStep(1);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send my magic link →';
    }
  });
})();
