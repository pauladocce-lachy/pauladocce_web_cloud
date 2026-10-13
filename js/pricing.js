async function loadPricing() {
  const categories={damske:'Dámské',panske:'Pánské',detske:'Dětské'};
  try {
    const data=await api.getPricing();
    Object.entries(categories).forEach(([category,label])=>{
      const container=document.querySelector(`#pricing-${category} .pricing-table-container`); if(!container)return;
      const table=document.createElement('table');table.className='pricing-table';
      const thead=document.createElement('thead'),hr=document.createElement('tr');
      ['Služba','Krátké','Střední','Dlouhé'].forEach(t=>{const th=document.createElement('th');th.textContent=t;hr.append(th);});thead.append(hr);table.append(thead);
      const tbody=document.createElement('tbody');
      data.filter(x=>x.category===category).forEach(item=>{const tr=document.createElement('tr');[item.service,item.short_price||'-',item.medium_price||'-',item.long_price||'-'].forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.append(td);});tbody.append(tr);});
      table.append(tbody);container.replaceChildren(table);
    });
  } catch(error) { console.error('Ceník se nepodařilo načíst:',error); document.querySelectorAll('.pricing-table-container').forEach(el=>{el.textContent='Ceník se nyní nepodařilo načíst.';}); }
}
document.addEventListener('DOMContentLoaded',loadPricing);
