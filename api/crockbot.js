// CrockBot server-side AI gateway for Vercel Node Functions.
// Keep OPENAI_API_KEY in Vercel Project Settings -> Environment Variables.

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 24;
const buckets = new Map(); // Best-effort per-instance limit; use an edge/WAF limiter for public production.

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function cleanSources(output) {
  const found = [];
  for (const item of output || []) {
    if (item.type !== 'web_search_call') continue;
    const action = item.action || {};
    const list = [...(action.sources || []), ...(action.results || []), ...(item.sources || [])];
    for (const source of list) {
      const url = source.url || source.link;
      if (!url || !/^https:\/\//i.test(url)) continue;
      if (!found.some(x => x.url === url)) {
        found.push({ title: String(source.title || source.name || url).slice(0, 180), url });
      }
    }
  }
  return found.slice(0, 12);
}

function outputText(response) {
  if (typeof response.output_text === 'string') return response.output_text;
  const chunks = [];
  for (const item of response.output || []) {
    if (item.type !== 'message') continue;
    for (const part of item.content || []) {
      if (part.type === 'output_text' && part.text) chunks.push(part.text);
    }
  }
  return chunks.join('\n').trim();
}

function parseJson(text) {
  const cleaned = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(cleaned);
}

function rateLimit(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : String(forwarded || 'unknown').split(',')[0]).trim();
  const now = Date.now();
  const current = buckets.get(ip);
  if (!current || now - current.start > WINDOW_MS) {
    buckets.set(ip, { start: now, count: 1 });
    return true;
  }
  current.count += 1;
  return current.count <= MAX_REQUESTS_PER_WINDOW;
}

function validImage(dataUrl) {
  return typeof dataUrl === 'string' &&
    dataUrl.length <= 4_000_000 &&
    /^data:image\/(jpeg|jpg|png|webp);base64,[a-z0-9+/=]+$/i.test(dataUrl);
}

function makeDeveloperPrompt(task, profile, location) {
  const cookLevel = ['beginner', 'intermediate', 'advanced'].includes(profile?.level) ? profile.level : 'intermediate';
  const diet = ['balanced', 'vegetarian', 'vegan', 'high-protein'].includes(profile?.diet) ? profile.diet : 'balanced';
  const region = String(location || '').slice(0, 100);
  return `You are CrockBot, a practical, friendly cooking assistant. The user's cooking level is ${cookLevel}; their stated food preference is ${diet}. Shopping region, if supplied: ${region || 'not supplied'}. Be clear, useful, and honest. Never invent live prices, store inventory, product availability, recipe sources, or citations. If web results do not verify a price, say it could not be verified. Nutrition values from photos or generic recipes are estimates, not precise measurements. Do not moralize food, prescribe restrictive diets, or set weight-loss targets. Do not help the user find, buy, compare, or use knives or other blades; avoid instructions requiring blades and suggest pre-cut ingredients or asking an adult to handle that step instead. For food photos, never infer internal temperature or food safety from appearance; recommend a food thermometer where relevant. For allergies, warn that ingredient labels and cross-contact must be checked. Task: ${task}.`;
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    return json(res, 200, { ok: true, configured: Boolean(process.env.OPENAI_API_KEY), model: process.env.OPENAI_MODEL || 'gpt-6.2-sol' });
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });
  if (!process.env.OPENAI_API_KEY) return json(res, 503, { error: 'The CrockBot AI service is not configured yet. Add OPENAI_API_KEY to the server environment.' });
  if (!rateLimit(req)) return json(res, 429, { error: 'CrockBot is receiving too many requests. Please wait a few minutes and try again.' });

  try {
    const body = req.body || {};
    const task = ['chat', 'recipe', 'scan', 'paper', 'prices'].includes(body.task) ? body.task : 'chat';
    const profile = body.profile || {};
    const location = body.location || '';
    const useWebSearch = Boolean(body.useWebSearch) || task === 'recipe' || task === 'prices';
    const images = Array.isArray(body.images) ? body.images : [];
    if (images.length > 2 || images.some(x => !validImage(x))) {
      return json(res, 400, { error: 'Please use a JPEG, PNG, or WebP image smaller than 3 MB.' });
    }

    const input = [{ role: 'developer', content: makeDeveloperPrompt(task, profile, location) }];
    if (task === 'chat') {
      const messages = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
      if (!messages.length) return json(res, 400, { error: 'A chat message is required.' });
      for (const message of messages) {
        const role = message.role === 'assistant' ? 'assistant' : 'user';
        const content = String(message.content || '').slice(0, 5000);
        if (content.trim()) input.push({ role, content });
      }
    } else {
      const prompt = String(body.prompt || '').slice(0, 12000);
      if (!prompt.trim()) return json(res, 400, { error: 'A prompt is required.' });
      const content = [{ type: 'input_text', text: prompt }];
      for (const image of images) content.push({ type: 'input_image', image_url: image, detail: 'high' });
      input.push({ role: 'user', content });
    }

    const payload = {
      model: process.env.OPENAI_MODEL || 'gpt-6.2-sol',
      input,
      max_output_tokens: task === 'chat' ? 1200 : 2200,
      store: false
    };
    if (task !== 'chat') payload.text = { format: { type: 'json_object' } };
    if (useWebSearch) {
      payload.tools = [{ type: 'web_search' }];
      payload.include = ['web_search_call.action.sources'];
    }

    const upstream = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const result = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const message = result?.error?.message || 'OpenAI could not complete the request.';
      const status = upstream.status === 429 ? 429 : 502;
      return json(res, status, { error: message.slice(0, 300) });
    }

    const text = outputText(result);
    if (!text) return json(res, 502, { error: 'The AI returned an empty response. Please try again.' });
    const sources = cleanSources(result.output);
    if (task === 'chat') return json(res, 200, { text, sources });

    let data;
    try { data = parseJson(text); }
    catch { return json(res, 502, { error: 'The AI response could not be read. Please try again.' }); }
    if (!data || typeof data !== 'object' || Array.isArray(data)) return json(res, 502, { error: 'The AI returned an invalid result.' });

    // A price is only displayed as source-backed by the UI if its URL is one of the actual web-search sources.
    if (task === 'prices') {
      const sourceUrls = new Set(sources.map(x => x.url));
      data.items = Array.isArray(data.items) ? data.items.map(item => ({
        ...item,
        price: item.source_url && sourceUrls.has(item.source_url) && Number.isFinite(Number(item.price)) ? Number(item.price) : null,
        price_status: item.source_url && sourceUrls.has(item.source_url) && Number.isFinite(Number(item.price)) ? 'source_listed' : 'not_found'
      })) : [];
      data.stores = Array.isArray(data.stores) ? data.stores.map(store => ({
        ...store,
        total: store.source_url && sourceUrls.has(store.source_url) && Number.isFinite(Number(store.total)) ? Number(store.total) : null,
        status: store.source_url && sourceUrls.has(store.source_url) && Number.isFinite(Number(store.total)) ? 'source_listed' : 'not_found'
      })) : [];
    }
    return json(res, 200, { data, sources });
  } catch (error) {
    return json(res, 500, { error: 'CrockBot encountered an unexpected server error. Please try again.' });
  }
};
