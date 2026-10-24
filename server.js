const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const store = require('./lib/store');
const auth = require('./lib/auth');

const PORT = process.env.PORT || 3000;
const DIST = path.join(__dirname, 'dist');
const RELEASES = path.join(DIST, 'releases');
const EXPO = '/.vibekit/expo';
const RELEASE_ID_RE = /^r\d{14}-[0-9a-f]{8}$/;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
};

const DEFAULT_LETTER_TEMPLATES = [
  {
    id: 'education-funding',
    title: 'Education funding',
    topic: 'Education funding',
    opening: 'I am writing as a constituent to ask for your support on education funding legislation that directly affects students, teachers, and families.',
    talkingPoints: [
      'State the funding gap or service problem in plain English.',
      'Connect the bill to concrete outcomes for classrooms and local districts.',
      'Ask for sponsorship, co-sponsorship, or public support in committee.',
    ],
    closing: 'Thank you for your consideration and for representing our community during this legislative session.',
  },
  {
    id: 'public-health',
    title: 'Public health',
    topic: 'Public health oversight',
    opening: 'I am asking you to support legislation that improves public health oversight and public access to agency information.',
    talkingPoints: [
      'Describe the health risk or administrative gap that needs attention.',
      'Mention any records, inspections, or reporting data that justify action.',
      'Ask for a response on whether the office will sponsor or move the bill forward.',
    ],
    closing: 'Please stand with constituents who need transparent and accountable public health policy.',
  },
  {
    id: 'housing',
    title: 'Housing',
    topic: 'Housing stability',
    opening: 'I am reaching out to request your support for legislation that protects housing stability and improves tenant outcomes.',
    talkingPoints: [
      'Name the local impact on rent, supply, displacement, or code enforcement.',
      'Tie the bill to measurable protections or delivery timelines.',
      'Request a meeting or written response from the office.',
    ],
    closing: 'Your leadership on housing would make a real difference for constituents who are already under pressure.',
  },
];

const DEFAULT_FOIA_RESOURCES = [
  {
    id: 'basic-request',
    title: 'Basic FOIA request',
    description: 'Use this when you need inspection reports, contracts, emails, or complaint logs relevant to a legislative packet.',
    steps: [
      'Identify the exact agency that holds the record.',
      'Describe the records narrowly enough that staff can find them without guessing.',
      'Ask for fee waivers if the request supports public understanding or legislative review.',
      'Track deadlines, denials, and appeal rights in writing.',
    ],
    template: 'Pursuant to the applicable public records law, I request copies of the records described below. I request electronic production where available and ask that any fees be waived because disclosure will contribute to public understanding of government activity.',
    link: 'https://www.senate.gov/senators/senators-contact.htm',
  },
  {
    id: 'appeal-denial',
    title: 'Denial appeal',
    description: 'Use this when an agency rejects a request, heavily redacts records, or misses its deadline.',
    steps: [
      'Quote the denial reason and the date it was issued.',
      'Explain why the exemption does not apply or why segregable material should still be produced.',
      'Request a written explanation and appeal determination by the statutory deadline.',
    ],
    template: 'I am appealing the denial of my records request. Please review the withheld material, release all reasonably segregable portions, and provide the legal basis for any remaining redactions or withholding.',
  },
];

const SUBSCRIPTION_PLANS = {
  weekly: { id: 'weekly', name: 'Weekly', amount: 900, interval: 'week' },
  monthly: { id: 'monthly', name: 'Monthly', amount: 2900, interval: 'month' },
  yearly: { id: 'yearly', name: 'Yearly', amount: 24900, interval: 'year' },
};

const routes = {
  'GET /health': (req, res) => json(res, { status: 'ok', uptime: process.uptime(), release: currentRelease() }),
  'GET /api/state-legislators': async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const state = String(url.searchParams.get('state') || '').trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(state)) return json(res, { error: 'Choose a valid two-letter state code' }, 400);
    try {
      json(res, await loadStateLegislators(state));
    } catch (e) {
      json(res, { error: e.message || 'Could not load state legislators' }, 500);
    }
  },
  'GET /api/letter-templates': (req, res) => json(res, store.read('letterTemplates', DEFAULT_LETTER_TEMPLATES)),
  'GET /api/letters': (req, res) => {
    const user = requireUser(req);
    if (!user.ok) return json(res, { error: user.error }, 401);
    json(res, store.read('letters', []).filter((letter) => letter.userId === user.user.id));
  },
  'POST /api/letters/generate': async (req, res) => {
    const current = requireUser(req);
    if (!current.ok) return json(res, { error: current.error }, 401);
    const body = await readBody(req);
    const recipient = String(body.recipient || '').trim();
    const topic = String(body.topic || '').trim();
    const tone = String(body.tone || '').trim();
    const state = String(body.state || '').trim().toUpperCase();
    const notes = String(body.notes || '').trim();
    const template = store.read('letterTemplates', DEFAULT_LETTER_TEMPLATES).find((item) => item.id === body.templateId) || DEFAULT_LETTER_TEMPLATES[0];
    if (!recipient || !topic) return json(res, { error: 'Recipient and topic are required' }, 400);
    const text = await generateLetter({ recipient, topic, tone, state, notes, template, user: current.user });
    const saved = {
      id: crypto.randomUUID(),
      userId: current.user.id,
      recipient,
      topic,
      tone,
      state,
      content: text,
      createdAt: new Date().toISOString(),
    };
    store.write('letters', [saved, ...store.read('letters', [])]);
    json(res, { text, saved }, 201);
  },
  'GET /api/packets': (req, res) => {
    const current = requireUser(req);
    if (!current.ok) return json(res, { error: current.error }, 401);
    json(res, store.read('packets', []).filter((packet) => packet.userId === current.user.id));
  },
  'POST /api/packets': async (req, res) => {
    const current = requireUser(req);
    if (!current.ok) return json(res, { error: current.error }, 401);
    const body = await readBody(req);
    const packet = {
      id: crypto.randomUUID(),
      userId: current.user.id,
      title: String(body.title || '').trim(),
      billName: String(body.billName || '').trim(),
      state: String(body.state || '').trim().toUpperCase(),
      summary: String(body.summary || '').trim(),
      foiaNeed: String(body.foiaNeed || '').trim(),
      sponsorTarget: String(body.sponsorTarget || '').trim(),
      nextStep: String(body.nextStep || '').trim(),
      createdAt: new Date().toISOString(),
    };
    if (!packet.title || !packet.summary) return json(res, { error: 'Title and summary are required' }, 400);
    store.write('packets', [packet, ...store.read('packets', [])]);
    json(res, packet, 201);
  },
  'GET /api/foia/resources': (req, res) => json(res, store.read('foiaResources', DEFAULT_FOIA_RESOURCES)),
  'POST /api/foia/template': async (req, res) => {
    const body = await readBody(req);
    const recordType = String(body.recordType || '').trim();
    const agency = String(body.agency || '').trim();
    const purpose = String(body.purpose || '').trim();
    if (!recordType || !agency) return json(res, { error: 'Record type and agency are required' }, 400);
    json(res, { template: `To the records officer at ${agency}:\n\nUnder the applicable public records law, I request ${recordType}. ${purpose}\n\nPlease provide electronic copies, identify any withheld material with the legal basis for withholding, and let me know about any fees before processing.\n\nSincerely,\n[Your name]` });
  },
  'GET /api/payments/status': async (req, res) => {
    try {
      const status = await vkPayments('/status');
      json(res, { connected: !!status.connected });
    } catch {
      json(res, { connected: false });
    }
  },
  'POST /api/payments/checkout': async (req, res) => {
    const current = requireUser(req);
    if (!current.ok) return json(res, { error: current.error }, 401);
    const body = await readBody(req);
    const plan = SUBSCRIPTION_PLANS[String(body.planId || '')];
    if (!plan) return json(res, { error: 'Unknown plan' }, 400);
    try {
      const { origin } = publicOrigin(req);
      const response = await vkPayments('/checkout', {
        ui_mode: 'hosted_page',
        mode: 'subscription',
        billing_address_collection: 'auto',
        phone_number_collection: { enabled: true },
        automatic_tax: { enabled: false },
        allow_promotion_codes: false,
        payment_method_collection: 'always',
        submit_type: 'auto',
        consent_collection: { terms_of_service: 'required', promotions: 'auto' },
        name_collection: { individual: { enabled: true, optional: true }, business: { enabled: true, optional: true } },
        saved_payment_method_options: { payment_method_save: 'enabled' },
        integration_identifier: 'hosted_mobile_app_0001',
        origin_context: 'mobile_app',
        items: [{ name: `Legislative Packet ${plan.name}`, amount: plan.amount, currency: 'usd', interval: plan.interval }],
        successUrl: `${origin}/?paid=1&plan=${plan.id}`,
        cancelUrl: `${origin}/?billing=cancelled`,
        metadata: { userId: current.user.id, planId: plan.id },
      });
      json(res, response);
    } catch (e) {
      json(res, { error: e.message || 'Payments are not available yet.' }, 500);
    }
  },
  'POST /api/payments/confirm': async (req, res) => {
    const current = requireUser(req);
    if (!current.ok) return json(res, { error: current.error }, 401);
    const body = await readBody(req);
    const sessionId = String(body.sessionId || '');
    if (!sessionId) return json(res, { error: 'Missing session id' }, 400);
    try {
      const checkout = await vkPayments(`/checkout/${sessionId}`);
      if (!checkout.paid) return json(res, { error: 'Payment not completed' }, 400);
      const subscriptions = store.read('subscriptions', []);
      const next = subscriptions.filter((item) => item.sessionId !== sessionId);
      next.push({ sessionId, userId: current.user.id, planId: checkout.metadata?.planId || null, paid: true, subscriptionId: checkout.subscriptionId || null, active: true, currentPeriodEnd: checkout.currentPeriodEnd || null, updatedAt: new Date().toISOString() });
      store.write('subscriptions', next);
      json(res, { ok: true });
    } catch (e) {
      json(res, { error: e.message || 'Could not confirm payment' }, 500);
    }
  },
  'POST /api/auth/signup': async (req, res) => {
    try { json(res, auth.signup(await readBody(req)), 201); } catch (e) { json(res, { error: e.message }, e.status || 400); }
  },
  'POST /api/auth/login': async (req, res) => {
    try { json(res, auth.login(await readBody(req))); } catch (e) { json(res, { error: e.message }, e.status || 401); }
  },
  'POST /api/auth/logout': (req, res) => { auth.logout(req); json(res, { ok: true }); },
  'GET /api/auth/me': (req, res) => {
    const user = auth.userFor(req);
    if (!user) return json(res, { error: 'Not signed in' }, 401);
    const subscription = store.read('subscriptions', []).filter((item) => item.userId === user.id && item.active).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0] || null;
    return json(res, { user, subscription });
  },
};

function json(res, data, status = 200, headers = {}) {
  const payload = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), ...headers });
  res.end(payload);
}

const MAX_BODY_BYTES = 10 * 1024 * 1024;

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let tooLarge = false;
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      if (tooLarge) return;
      raw += chunk;
      if (raw.length > MAX_BODY_BYTES) {
        tooLarge = true;
        raw = '';
        reject(Object.assign(new Error('Body too large'), { status: 413 }));
      }
    });
    req.on('end', () => {
      if (tooLarge) return;
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(Object.assign(new Error('Invalid JSON body'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

function requireUser(req) {
  const user = auth.userFor(req);
  return user ? { ok: true, user } : { ok: false, error: 'Sign in first' };
}

const STATE_NAMES = { AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming' };

async function loadStateLegislators(state) {
  const name = STATE_NAMES[state];
  const jurisdiction = `ocd-jurisdiction/country:us/state:${state.toLowerCase()}`;
  const directoryUrl = `https://openstates.org/${state.toLowerCase()}/legislators/`;
  if (!process.env.OPENSTATES_API_KEY) {
    return { state, name, directoryUrl, legislatureUrl: directoryUrl, source: 'official-directory', legislators: [] };
  }
  const cache = store.read(`state-legislators-${state}`, null);
  const fresh = cache && cache.updatedAt && Date.now() - new Date(cache.updatedAt).getTime() < 12 * 60 * 60 * 1000;
  if (fresh && Array.isArray(cache.legislators)) return cache;
  const response = await fetch(`https://v3.openstates.org/people?jurisdiction=${encodeURIComponent(jurisdiction)}&per_page=100`, {
    headers: { 'X-API-KEY': process.env.OPENSTATES_API_KEY, 'User-Agent': 'Legislative Packet directory' },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error((data && data.detail) || 'State legislator directory is unavailable');
  const legislators = (data.results || []).map((person) => ({
    id: person.id,
    name: person.name,
    party: person.party || '',
    state,
    chamber: person.current_role?.org_classification === 'upper' ? 'State Senate' : 'State House',
    district: person.current_role?.district || '',
    email: person.email ? `mailto:${person.email}` : '',
    phone: person.current_role?.phone || person.phone || '',
    website: person.links?.find((link) => link.note === 'homepage')?.url || person.links?.[0]?.url || '',
    image: person.image || '',
  }));
  const result = { state, name, directoryUrl, legislatureUrl: directoryUrl, source: 'openstates', legislators };
  store.write(`state-legislators-${state}`, { ...result, updatedAt: new Date().toISOString() });
  return result;
}

async function generateLetter({ recipient, topic, tone, state, notes, template, user }) {
  if (process.env.VIBEKIT_AI_URL && process.env.VIBEKIT_AI_TOKEN) {
    const r = await fetch(process.env.VIBEKIT_AI_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.VIBEKIT_AI_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'You draft concise, persuasive sponsor letters for legislative outreach. Keep them specific, respectful, and easy to customize.' },
          { role: 'user', content: `Write a sponsor letter to ${recipient} about ${topic}. Tone: ${tone || 'respectful'}. State: ${state || 'not specified'}. Use this template guidance: ${template.opening} Talking points: ${template.talkingPoints.join('; ')} Closing: ${template.closing}. Context from the user: ${notes}. Signed by ${user.name || user.email}.` },
        ],
      }),
    });
    const data = await r.json().catch(() => null);
    if (!r.ok) throw new Error((data && (data.error || data.message)) || 'AI letter generation failed');
    if (data && typeof data.text === 'string' && data.text.trim()) return data.text.trim();
  }
  return `${template.opening}\n\nI am asking for your support regarding ${topic}${state ? ` in ${state}` : ''}. ${notes}\n\n${template.talkingPoints.map((point) => `- ${point}`).join('\n')}\n\n${template.closing}\n\nSincerely,\n${user.name || user.email}`;
}

async function vkPayments(route, body) {
  if (!process.env.VIBEKIT_PAYMENTS_URL || !process.env.VIBEKIT_AI_TOKEN) throw new Error('Payments are not configured yet.');
  const response = await fetch(process.env.VIBEKIT_PAYMENTS_URL + route, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${process.env.VIBEKIT_AI_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error((data && (data.error || data.message)) || `Payment request failed (${response.status})`);
  return data;
}

function safeDecode(p) {
  try { return decodeURIComponent(p); } catch { return null; }
}

function currentRelease() {
  try {
    const id = fs.readFileSync(path.join(DIST, 'CURRENT'), 'utf8').trim();
    return RELEASE_ID_RE.test(id) ? id : null;
  } catch {
    return null;
  }
}

function releaseFile(id, rel) {
  const root = path.join(RELEASES, id);
  const file = path.join(root, rel);
  return file.startsWith(root + path.sep) ? file : null;
}

function publicOrigin(req) {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  const local = /^(localhost|127\.|\[::1\])/.test(host);
  const proto = String(req.headers['x-forwarded-proto'] || (local ? 'http' : 'https')).split(',')[0].trim();
  return { host, origin: `${proto}://${host}` };
}

const uuidFrom = (s) => {
  const h = crypto.createHash('sha256').update(s).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
};
const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function releaseTime(id) {
  const m = /^r(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/.exec(id);
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])).toISOString();
}

function buildManifest(req, platform) {
  const id = currentRelease();
  if (!id) return { status: 404, error: 'This app is not ready to open yet. When its chat says it is live, open it again.' };
  const meta = JSON.parse(fs.readFileSync(path.join(RELEASES, id, 'metadata.json'), 'utf8'));
  const cfg = JSON.parse(fs.readFileSync(path.join(RELEASES, id, 'expo-config.json'), 'utf8'));
  const fm = meta.fileMetadata && meta.fileMetadata[platform];
  if (!fm) return { status: 404, error: `This app has no ${platform} build.` };
  const runtime = `exposdk:${cfg.sdkVersion}`;
  const wants = req.headers['expo-runtime-version'];
  if (wants && wants !== runtime) {
    const major = (v) => parseInt(String(v).replace('exposdk:', ''), 10);
    if (major(wants) > major(cfg.sdkVersion)) {
      return { status: 404, error: `This app is on Expo SDK ${major(cfg.sdkVersion)}; your Expo Go runs a newer SDK ${major(wants)}. VibeKit is updating it; try again in a little while.` };
    }
    return { status: 404, error: `This app is built for Expo SDK ${cfg.sdkVersion}, and this Expo Go runs ${String(wants).replace('exposdk:', 'SDK ')}. Update Expo Go from the App Store.` };
  }
  const { host, origin } = publicOrigin(req);
  const asset = (rel, ext, isLaunch) => {
    const buf = fs.readFileSync(path.join(RELEASES, id, rel));
    return {
      hash: b64url(crypto.createHash('sha256').update(buf).digest()),
      key: crypto.createHash('md5').update(buf).digest('hex'),
      fileExtension: isLaunch ? '.bundle' : `.${ext}`,
      contentType: isLaunch ? 'application/javascript' : (MIME[`.${ext}`] || 'application/octet-stream'),
      url: `${origin}${EXPO}/r/${id}/${rel}`,
    };
  };
  const body = {
    runtimeVersion: runtime,
    launchAsset: asset(fm.bundle, 'js', true),
    assets: fm.assets.map((a) => asset(a.path, a.ext, false)),
    metadata: {},
    extra: {
      expoClient: { ...cfg, runtimeVersion: runtime, extra: { ...(cfg.extra || {}), apiOrigin: origin } },
      scopeKey: `@anonymous/${cfg.slug}-${uuidFrom(`scope:${host}`)}`,
      eas: {},
    },
  };
  const manifest = { id: uuidFrom(JSON.stringify(body) + platform), createdAt: releaseTime(id), ...body };
  if (!manifest.launchAsset.url || !manifest.extra.scopeKey || !manifest.extra.expoClient.sdkVersion) {
    return { status: 500, error: 'This build is incomplete. Deploy it again.' };
  }
  return { status: 200, manifest };
}

function serveManifest(req, res, url) {
  const common = { 'expo-protocol-version': '1', 'expo-sfv-version': '0', 'Cache-Control': 'private, max-age=0' };
  const platform = req.headers['expo-platform'] || url.searchParams.get('platform') || 'ios';
  const r = buildManifest(req, platform === 'android' ? 'android' : 'ios');
  if (r.status !== 200) return json(res, { error: r.error, message: r.error }, r.status, common);
  const body = JSON.stringify(r.manifest);
  if (/multipart\/mixed/.test(req.headers.accept || '')) {
    const b = `vk${crypto.randomBytes(8).toString('hex')}`;
    const part = (name, content) => `--${b}\r\ncontent-disposition: form-data; name="${name}"\r\ncontent-type: application/json; charset=utf-8\r\n\r\n${content}\r\n`;
    const out = part('manifest', body) + part('extensions', JSON.stringify({ assetRequestHeaders: {} })) + `--${b}--\r\n`;
    res.writeHead(200, { ...common, 'Content-Type': `multipart/mixed; boundary=${b}` });
    return res.end(out);
  }
  res.writeHead(200, { ...common, 'Content-Type': 'application/json' });
  res.end(body);
}

function serveReleaseAsset(res, id, rel) {
  if (!RELEASE_ID_RE.test(id)) return json(res, { error: 'Not found' }, 404);
  const file = releaseFile(id, rel);
  if (!file) return json(res, { error: 'Not found' }, 404);
  fs.readFile(file, (err, data) => {
    if (err) return json(res, { error: 'Not found' }, 404);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'public, max-age=31536000, immutable' });
    res.end(data);
  });
}

const BUILDING_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Building…</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font:16px -apple-system,system-ui,sans-serif;background:#0f0f14;color:#e8e8f0;text-align:center;padding:24px}p{color:#9a9ab0}</style></head>
<body><div><h1>First build in progress</h1><p>This app appears here, and on your phone in Expo Go, once its first version is built.</p></div></body></html>`;

function serveWeb(req, res, pathname) {
  const id = currentRelease();
  if (!id) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(BUILDING_PAGE);
  }
  const decoded = pathname === '/' ? 'index.html' : safeDecode(pathname);
  if (decoded === null) return json(res, { error: 'Bad request' }, 400);
  const rel = decoded.replace(/^\/+/, '');
  if (rel === 'metadata.json' || rel === 'expo-config.json') return json(res, { error: 'Not found' }, 404);
  const file = releaseFile(id, rel);
  if (!file) return json(res, { error: 'Not found' }, 404);
  fs.readFile(file, (err, data) => {
    if (!err) {
      const immutable = rel.startsWith('_expo/static/') || rel.startsWith('assets/');
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache' });
      return res.end(data);
    }
    if (path.extname(rel)) return json(res, { error: 'Not found' }, 404);
    fs.readFile(path.join(RELEASES, id, 'index.html'), (e, html) => {
      if (e) return json(res, { error: 'Not found' }, 404);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
      res.end(html);
    });
  });
}

http.createServer(async (req, res) => {
  let pathname = req.url || '/';
  try {
    const url = new URL(req.url, 'http://localhost');
    pathname = url.pathname;
    const handler = routes[`${req.method} ${pathname}`];
    if (handler) return await handler(req, res);
    if (pathname === `${EXPO}/manifest`) return serveManifest(req, res, url);
    if (pathname.startsWith(`${EXPO}/r/`)) {
      const rest = safeDecode(pathname.slice(`${EXPO}/r/`.length));
      if (rest === null) return json(res, { error: 'Bad request' }, 400);
      const slash = rest.indexOf('/');
      if (slash < 1) return json(res, { error: 'Not found' }, 404);
      return serveReleaseAsset(res, rest.slice(0, slash), rest.slice(slash + 1));
    }
    if (pathname.startsWith(`${EXPO}/`) || pathname.startsWith('/api/')) return json(res, { error: 'Not found' }, 404);
    serveWeb(req, res, pathname);
  } catch (err) {
    console.error(`${req.method} ${pathname} failed:`, err.message);
    if (res.headersSent) return;
    if (err.status === 413) json(res, { error: 'Too large: the limit is 10 MB.' }, 413);
    else if (err.status === 400) json(res, { error: err.message }, 400);
    else json(res, { error: 'Server error' }, 500);
  }
}).listen(PORT, '0.0.0.0', () => console.log(`Listening on port ${PORT}`));
