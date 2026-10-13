async function loadHomePricing() {
  const preview = document.querySelector('.pricing-preview');
  if (!preview) return;
  try {
    const data = (await api.getPricing()).sort((a,b) => a.sort_order - b.sort_order || a.id - b.id);
    preview.replaceChildren();
    data.slice(0,4).forEach(service => {
      const row=document.createElement('div'); row.className='price-row';
      const name=document.createElement('span'); name.textContent=service.service;
      const price=document.createElement('span'); price.textContent=service.short_price || '-';
      row.append(name,price); preview.append(row);
    });
  } catch(error) { console.error('Ceník se nepodařilo načíst:',error); preview.textContent='Ceník se nyní nepodařilo načíst.'; }
}
document.addEventListener('DOMContentLoaded', loadHomePricing);
