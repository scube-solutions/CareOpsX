async function submitForm() {
  const name   = document.getElementById('f-name').value.trim();
  const phone  = document.getElementById('f-phone').value.trim();
  const email  = document.getElementById('f-email').value.trim();
  const clinic = document.getElementById('f-clinic').value.trim();
  const plan   = document.getElementById('f-plan').value;
  const size   = document.getElementById('f-size').value;
  const msg    = document.getElementById('f-msg').value.trim();

  if (!name)                        { highlight('f-name',  'Please enter your name');          return; }
  if (!phone)                       { highlight('f-phone', 'Please enter your phone number');  return; }
  if (!email || !email.includes('@')){ highlight('f-email', 'Please enter a valid email');     return; }

  const btn = document.getElementById('f-btn');
  btn.textContent   = 'Sending…';
  btn.disabled      = true;
  btn.style.opacity = '.7';

  try {

    /* ── 1. Send email via Web3Forms ── */
    const emailRes = await fetch('https://api.web3forms.com/submit', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body   : JSON.stringify({
        access_key : 'f0808f47-edd0-427e-95ce-d559f497b234',
        subject    : 'New Demo Request — CareOpsX',
        from_name  : 'CareOpsX Website',
        name,
        email,
        phone,
        clinic : clinic || 'Not provided',
        plan   : plan   || 'Not selected',
        size   : size   || 'Not selected',
        message: msg    || 'No message'
      })
    });

    const emailData = await emailRes.json();
    if (!emailData.success) throw new Error('Email failed');

    // /* ── 2. Log to Google Sheet (fire and forget) ── */
    // fetch('YOUR_APPS_SCRIPT_URL_HERE', {
    //   method : 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body   : JSON.stringify({
    //     name,
    //     email,
    //     phone,
    //     clinic : clinic || 'Not provided',
    //     plan   : plan   || 'Not selected',
    //     size   : size   || 'Not selected',
    //     message: msg    || 'No message'
    //   })
    // }).catch(() => {}); // never blocks the user even if sheet fails

    /* ── 3. Show success message ── */
    document.getElementById('form-main').style.display = 'none';
    const s = document.getElementById('form-success');
    s.style.display = 'block';

  } catch (err) {
    btn.textContent   = 'Request Demo →';
    btn.disabled      = false;
    btn.style.opacity = '1';
    highlight('f-email', 'Something went wrong — please email demo@careopsx.com');
  }
}

function highlight(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.borderColor = '#ef4444';
  el.style.boxShadow   = '0 0 0 3px rgba(239,68,68,.15)';
  el.placeholder       = msg;
  el.focus();
  setTimeout(() => {
    el.style.borderColor = '';
    el.style.boxShadow   = '';
  }, 3000);
}