document.addEventListener('DOMContentLoaded', async () => {
  // Keep the existing admin login check. This requires the project's Node.js backend.
  try {
    const state = await api.session();
    if (!state.authenticated) { window.location.href = 'index.html'; return; }
  } catch {
    window.location.href = 'index.html';
    return;
  }
  const sendBtn = document.getElementById('sendFeedbackBtn');
  if (sendBtn) sendBtn.addEventListener('click', sendFeedback);
  await loadFeedback();
});

async function sendFeedback() {
  const textarea = document.getElementById('feedbackMessage');
  const button = document.getElementById('sendFeedbackBtn');
  const message = textarea.value.trim();
  if (!message) { alert('Napište připomínku.'); return; }
  if (message.length > 5000) { alert('Připomínka může mít nejvýše 5000 znaků.'); return; }
  button.disabled = true;
  try {
    await requestsApi.create(message);
    textarea.value = '';
    await loadFeedback();
    alert('Požadavek byl uložen do Cloudflare databáze.');
  } catch (error) {
    console.error(error);
    alert(error.message || 'Požadavek se nepodařilo odeslat.');
  } finally {
    button.disabled = false;
  }
}

async function loadFeedback() {
  const list = document.getElementById('feedbackList');
  if (!list) return;
  list.textContent = 'Načítám požadavky…';
  try {
    const data = await requestsApi.list();
    list.replaceChildren();
    if (!Array.isArray(data) || data.length === 0) {
      list.textContent = 'Zatím zde nejsou žádné požadavky.';
      return;
    }
    data.forEach(item => {
      const card = document.createElement('div');
      card.className = 'feedback-item';
      const top = document.createElement('div');
      top.className = 'feedback-top';
      const status = document.createElement('strong');
      status.textContent = item.status || 'Nová';
      const date = document.createElement('span');
      const parsedDate = item.created_at ? new Date(item.created_at) : null;
      date.textContent = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toLocaleString('cs-CZ') : '';
      const message = document.createElement('p');
      message.textContent = item.message || '';
      top.append(status, date);
      card.append(top, message);
      list.append(card);
    });
  } catch (error) {
    console.error(error);
    list.replaceChildren();
    const message = document.createElement('p');
    message.textContent = `Požadavky se nepodařilo načíst: ${error.message}`;
    list.append(message);
  }
}
