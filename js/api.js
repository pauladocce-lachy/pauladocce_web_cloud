// Same-origin API client; all writes and authentication happen on the server.
const api = {
  async request(url, options = {}) {
    const response = await fetch(url, {credentials:'same-origin', ...options, headers:{'Accept':'application/json', ...(options.body ? {'Content-Type':'application/json'} : {}), ...(options.headers||{})}});
    let payload;
    try { payload = await response.json(); } catch { payload = {}; }
    if (!response.ok) { const error = new Error(payload.error || `Požadavek selhal (${response.status}).`); error.status=response.status; throw error; }
    return payload;
  },
  async getPricing() { return (await this.request('/api/pricing')).data; },
  async session() { return this.request('/api/auth/session'); },
  async login(email,password) { return this.request('/api/auth/login',{method:'POST',body:JSON.stringify({email,password})}); },
  async logout() { return this.request('/api/auth/logout',{method:'POST',body:'{}'}); },
  async createPricing(item) { return (await this.request('/api/pricing',{method:'POST',body:JSON.stringify(item)})).data; },
  async updatePricing(id,item) { return (await this.request(`/api/pricing/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify(item)})).data; },
  async deletePricing(id) { return this.request(`/api/pricing/${encodeURIComponent(id)}`,{method:'DELETE'}); },
  async getFeedback() { return (await this.request('/api/feedback')).data; },
  async createFeedback(message) { return (await this.request('/api/feedback',{method:'POST',body:JSON.stringify({message})})).data; }
};
