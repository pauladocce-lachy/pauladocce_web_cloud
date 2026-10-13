const http = require('node:http');
const fs = require('node:fs/promises');
const fsNative = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

loadEnv(path.join(__dirname, '.env'));
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 3000);
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';
const ROOT = __dirname;
const STORE_DIR = path.join(ROOT, 'storage');
const DB_FILE = path.join(STORE_DIR, 'db.json');
const SESSION_MS = 8 * 60 * 60 * 1000;
const sessions = new Map();
const loginAttempts = new Map();
let writeQueue = Promise.resolve();

function loadEnv(file) {
  try {
    const contents = require('node:fs').readFileSync(file, 'utf8');
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (match && !Object.hasOwn(process.env, match[1])) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
function json(res, status, value, extraHeaders = {}) {
  const body = JSON.stringify(value);
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Length':Buffer.byteLength(body),...extraHeaders});
  res.end(body);
}
function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('='); if (i > 0) out[part.slice(0,i).trim()] = decodeURIComponent(part.slice(i+1).trim());
  }
  return out;
}
function sessionFor(req) {
  const token = parseCookies(req).pd_session;
  if (!token) return null;
  const session = sessions.get(token);
  if (!session || session.expires < Date.now()) { sessions.delete(token); return null; }
  session.expires = Date.now() + SESSION_MS;
  return {token, session};
}
function requireAuth(req, res) {
  const current = sessionFor(req);
  if (!current) { json(res, 401, {error:'Přihlášení vypršelo. Přihlaste se znovu.'}); return null; }
  return current;
}
async function readDb() {
  try { return JSON.parse(await fs.readFile(DB_FILE, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; return {pricing:[],feedback:[],nextPricingId:1,nextFeedbackId:1}; }
}
function updateDb(mutator) {
  const task = writeQueue.then(async () => {
    const db = await readDb();
    const result = await mutator(db);
    const temp = `${DB_FILE}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
    await fs.writeFile(temp, JSON.stringify(db, null, 2) + '\n', {mode:0o600});
    await fs.rename(temp, DB_FILE);
    return result;
  });
  writeQueue = task.catch(() => {});
  return task;
}
async function bodyJson(req) {
  let raw = ''; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > 64 * 1024) { const e = new Error('Požadavek je příliš velký.'); e.status=413; throw e; } raw += chunk; }
  try { return raw ? JSON.parse(raw) : {}; } catch { const e = new Error('Neplatný JSON.'); e.status=400; throw e; }
}
function text(value, max, field) {
  if (typeof value !== 'string') throw Object.assign(new Error(`Pole ${field} musí být text.`), {status:400});
  const v = value.trim(); if (v.length > max) throw Object.assign(new Error(`Pole ${field} je příliš dlouhé.`), {status:400});
  return v;
}
function normalizePricing(input, existing = {}) {
  const category = text(input.category ?? existing.category, 30, 'category');
  if (!['damske','panske','detske'].includes(category)) throw Object.assign(new Error('Neplatná kategorie.'), {status:400});
  const sort = Number(input.sort_order ?? existing.sort_order ?? 999);
  if (!Number.isSafeInteger(sort) || sort < 0 || sort > 1000000) throw Object.assign(new Error('Neplatné pořadí.'), {status:400});
  return {category, service:text(input.service ?? existing.service ?? '',160,'service'), short_price:text(input.short_price ?? existing.short_price ?? '',80,'short_price'), medium_price:text(input.medium_price ?? existing.medium_price ?? '',80,'medium_price'), long_price:text(input.long_price ?? existing.long_price ?? '',80,'long_price'), sort_order:sort};
}
function safeEqual(a,b) { const aa=Buffer.from(String(a)); const bb=Buffer.from(String(b)); return aa.length===bb.length && crypto.timingSafeEqual(aa,bb); }
function mime(file) { return ({'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8','.xml':'application/xml; charset=utf-8'})[path.extname(file).toLowerCase()] || 'application/octet-stream'; }
async function serveStatic(req,res,urlPath) {
  let decoded; try { decoded=decodeURIComponent(urlPath); } catch { json(res,400,{error:'Neplatná cesta.'}); return; }
  if (decoded.includes('\0') || decoded.split('/').some(s=>s==='..') || decoded.startsWith('/storage') || decoded==='/server.js' || decoded.startsWith('/.env') || decoded.startsWith('/.git') || decoded==='/package.json' || decoded==='/package-lock.json') { json(res,404,{error:'Nenalezeno.'}); return; }
  if (decoded==='/') decoded='/index.html';
  const file=path.resolve(ROOT,'.'+decoded);
  if (!file.startsWith(ROOT+path.sep)) { json(res,404,{error:'Nenalezeno.'}); return; }
 try { const stat=await fs.stat(file); if (!stat.isFile()) throw Object.assign(new Error(),{code:'ENOENT'}); res.writeHead(200,{'Content-Type':mime(file),'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",'Content-Length':stat.size}); fsNative.createReadStream(file).pipe(res); }
  catch (error) { if (res.headersSent) { res.destroy(error); return; } json(res,404,{error:'Nenalezeno.'}); }
}
async function handle(req,res) {
  const url=new URL(req.url,`http://${req.headers.host || 'localhost'}`); const p=url.pathname;
  if (req.method==='GET' && p==='/api/health') return json(res,200,{ok:true,storage:'json-file'});
  if (p.startsWith('/api/')) {
    if (req.method==='GET' && p==='/api/pricing') { const db=await readDb(); const data=[...db.pricing].sort((a,b)=>a.category.localeCompare(b.category)||a.sort_order-b.sort_order||a.id-b.id); return json(res,200,{data}); }
    if (p==='/api/auth/session' && req.method==='GET') { const s=sessionFor(req); return json(res,200,{authenticated:!!s,user:s?{email:ADMIN_EMAIL,role:'admin'}:null}); }
    if (p==='/api/auth/login' && req.method==='POST') {
      const ip=req.socket.remoteAddress || 'unknown'; const attempts=loginAttempts.get(ip) || {count:0,until:0};
      if (attempts.until>Date.now() && attempts.count>=8) return json(res,429,{error:'Příliš mnoho pokusů. Zkuste to později.'},{'Retry-After':String(Math.ceil((attempts.until-Date.now())/1000))});
      const body=await bodyJson(req); const email=text(body.email||'',254,'email'); const password=typeof body.password==='string'?body.password:'';
      if (!ADMIN_EMAIL || !ADMIN_PASSWORD) return json(res,503,{error:'Administrace není nakonfigurována. Nastavte ADMIN_EMAIL a ADMIN_PASSWORD na serveru.'});
      if (!safeEqual(email.toLowerCase(),ADMIN_EMAIL.toLowerCase()) || !safeEqual(password,ADMIN_PASSWORD)) { attempts.count++; if (attempts.count>=8) attempts.until=Date.now()+15*60*1000; loginAttempts.set(ip,attempts); return json(res,401,{error:'Neplatný e-mail nebo heslo.'}); }
      loginAttempts.delete(ip); const token=crypto.randomBytes(32).toString('base64url'); sessions.set(token,{expires:Date.now()+SESSION_MS});
      const cookie=`pd_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(SESSION_MS/1000)}${COOKIE_SECURE?'; Secure':''}`;
      return json(res,200,{ok:true,user:{email:ADMIN_EMAIL,role:'admin'}},{'Set-Cookie':cookie});
    }
    if (p==='/api/auth/logout' && req.method==='POST') { const s=sessionFor(req); if(s)sessions.delete(s.token); return json(res,200,{ok:true},{'Set-Cookie':`pd_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${COOKIE_SECURE?'; Secure':''}`}); }
    if (p==='/api/feedback' && req.method==='GET') { if(!requireAuth(req,res))return; const db=await readDb(); return json(res,200,{data:[...db.feedback].sort((a,b)=>b.created_at.localeCompare(a.created_at))}); }
    if (p==='/api/feedback' && req.method==='POST') { if(!requireAuth(req,res))return; const b=await bodyJson(req); const message=text(b.message||'',4000,'message'); if(!message) return json(res,400,{error:'Napište připomínku.'}); const item=await updateDb(db=>{const item={id:db.nextFeedbackId++,message,status:'Nová',created_at:new Date().toISOString()};db.feedback.push(item);return item;}); return json(res,201,{data:item}); }
    if (p==='/api/pricing' && req.method==='POST') { if(!requireAuth(req,res))return; const b=await bodyJson(req); const record=normalizePricing(b); if(!record.service) return json(res,400,{error:'Název služby je povinný.'}); const item=await updateDb(db=>{const item={id:db.nextPricingId++,...record};db.pricing.push(item);return item;}); return json(res,201,{data:item}); }
    const pricingMatch=p.match(/^\/api\/pricing\/(\d+)$/);
    if (pricingMatch && req.method==='PUT') { if(!requireAuth(req,res))return; const id=Number(pricingMatch[1]); const b=await bodyJson(req); const item=await updateDb(db=>{const i=db.pricing.findIndex(x=>x.id===id);if(i<0)return null;db.pricing[i]={id,...normalizePricing(b,db.pricing[i])};return db.pricing[i];}); if(!item)return json(res,404,{error:'Služba nebyla nalezena.'}); return json(res,200,{data:item}); }
    if (pricingMatch && req.method==='DELETE') { if(!requireAuth(req,res))return; const id=Number(pricingMatch[1]); const removed=await updateDb(db=>{const i=db.pricing.findIndex(x=>x.id===id);if(i<0)return false;db.pricing.splice(i,1);return true;}); if(!removed)return json(res,404,{error:'Služba nebyla nalezena.'}); return json(res,200,{ok:true}); }
    return json(res,404,{error:'API endpoint nenalezen.'});
  }
  if (!['GET','HEAD'].includes(req.method)) return json(res,405,{error:'Metoda není povolena.'});
  return serveStatic(req,res,p);
}
async function main() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD || ADMIN_PASSWORD.length<16) console.warn('VAROVÁNÍ: Nastavte ADMIN_EMAIL a heslo ADMIN_PASSWORD o délce alespoň 16 znaků v .env. Administrace jinak nebude dostupná.');
  await fs.mkdir(STORE_DIR,{recursive:true,mode:0o700});
  try { await fs.access(DB_FILE); } catch { const seed=path.join(STORE_DIR,'db.json'); await fs.writeFile(seed,JSON.stringify({pricing:[],feedback:[],nextPricingId:1,nextFeedbackId:1},null,2)+'\n',{flag:'wx',mode:0o600}); }
  const server=http.createServer((req,res)=>{handle(req,res).catch(err=>{console.error(err);if(!res.headersSent)json(res,err.status||500,{error:err.status?err.message:'Interní chyba serveru.'});else res.destroy();});});
  server.listen(PORT,HOST,()=>console.log(`Paula Docce běží na http://${HOST}:${PORT}`));
}
main().catch(err=>{console.error(err);process.exit(1);});
