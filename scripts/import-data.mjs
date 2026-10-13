#!/usr/bin/env node
// Import a one-time Supabase table export without putting credentials in the application.
// Usage: node scripts/import-data.mjs /secure/path/export.json
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..');
const input=process.argv[2];
if(!input){console.error('Použití: node scripts/import-data.mjs /cesta/k/export.json');process.exit(2);}
const target=path.join(root,'storage','db.json');
const exportData=JSON.parse(await fs.readFile(path.resolve(input),'utf8'));
const pricingRaw=Array.isArray(exportData.pricing)?exportData.pricing:[];
const feedbackRaw=Array.isArray(exportData.feedback)?exportData.feedback:[];
if(!pricingRaw.length && !feedbackRaw.length){console.error('Export neobsahuje neprázdné pole pricing ani feedback; nic nebylo změněno.');process.exit(2);}
const pricing=pricingRaw.map((r,i)=>{
  const category=String(r.category||'');
  if(!['damske','panske','detske'].includes(category))throw new Error(`pricing[${i}]: neplatná kategorie`);
  return {id:Number.isSafeInteger(Number(r.id))&&Number(r.id)>0?Number(r.id):i+1,category,service:String(r.service??''),short_price:String(r.short_price??''),medium_price:String(r.medium_price??''),long_price:String(r.long_price??''),sort_order:Number.isSafeInteger(Number(r.sort_order))?Number(r.sort_order):i+1};
});
const feedback=feedbackRaw.map((r,i)=>({id:Number.isSafeInteger(Number(r.id))&&Number(r.id)>0?Number(r.id):i+1,message:String(r.message??''),status:String(r.status??'Nová'),created_at:r.created_at&& !Number.isNaN(Date.parse(r.created_at))?new Date(r.created_at).toISOString():new Date().toISOString()}));
await fs.mkdir(path.dirname(target),{recursive:true,mode:0o700});
try{const current=await fs.readFile(target);const backup=target+'.backup-'+new Date().toISOString().replace(/[:.]/g,'-');await fs.writeFile(backup,current,{flag:'wx',mode:0o600});console.log(`Záloha: ${backup}`);}catch(e){if(e.code!=='ENOENT')throw e;}
const db={pricing,feedback,nextPricingId:Math.max(0,...pricing.map(x=>x.id))+1,nextFeedbackId:Math.max(0,...feedback.map(x=>x.id))+1};
const temp=target+'.'+crypto.randomBytes(6).toString('hex')+'.tmp';await fs.writeFile(temp,JSON.stringify(db,null,2)+'\n',{flag:'wx',mode:0o600});await fs.rename(temp,target);
console.log(`Import dokončen: ${pricing.length} položek ceníku, ${feedback.length} připomínek.`);
console.log('Ujistěte se, že server byl během importu zastaven a že jste ověřili úplnost exportu.');
