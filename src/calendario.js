/* Audiências no calendário do iPhone (e Google Agenda / Outlook): um link de calendário (.ics) só de leitura, por pessoa.
   - A pessoa liga em "Minha conta / Configurações": o app gera um link secreto (/cal/<token>.ics). O iPhone assina uma vez e passa a atualizar sozinho.
   - Só audiências (prazos e tarefas não vão). "Só as minhas" (padrão) ou "todas do escritório" (as que a pessoa pode ver).
   - Opções: nome do cliente no título (ligado) e alertas de 1 dia e 1 hora antes (ligados). "Gerar um link novo" invalida o anterior.
   - O link deixa de funcionar quando a pessoa é desativada ou desliga o recurso. A rota /cal/ é pública (o token é a credencial); tudo o mais exige sessão. */
import { proprietario } from './acesso.js';
import { usuariosAtivos } from './avisos.js';
import { ehDono, normalizarUsuario, ehResponsavel, escopoDoAdvogado, podeVer } from './politica.js';

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const erro = (status, code, message) => json({ error: { code, message } }, status);
const PADRAO = { ativo: false, escopo: 'minhas', cliente: true, alertas: true };
const ler = async (env, id) => { const r = await env.DB.prepare("SELECT dados FROM docs WHERE colecao = '_notif' AND id = ?").bind(id).first(); return r ? JSON.parse(r.dados) : null; };
const gravar = (env, id, d) => env.DB.prepare("INSERT INTO docs (colecao, id, dados, atualizado) VALUES ('_notif', ?, ?, ?) ON CONFLICT(colecao, id) DO UPDATE SET dados = excluded.dados, atualizado = excluded.atualizado").bind(id, JSON.stringify(d), Date.now()).run();
const apagar = (env, id) => env.DB.prepare("DELETE FROM docs WHERE colecao = '_notif' AND id = ?").bind(id).run();
const b64u = (u8) => btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const sha = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('');
const novoToken = () => b64u(crypto.getRandomValues(new Uint8Array(24)));
const chaveDe = (auth) => (ehDono(auth) ? 'dono' : auth.usuario.id);
const indice = async (token) => 'calt-' + (await sha('cal:' + token)).slice(0, 32);
const urls = (request, token) => { const u = new URL(request.url); return { url: u.origin + '/cal/' + token + '.ics', webcal: 'webcal://' + u.host + '/cal/' + token + '.ics' }; };

async function estado(request, env, auth) {
  const cfg = { ...PADRAO, ...((await ler(env, 'cal-' + chaveDe(auth))) || {}) };
  return { ativo: !!cfg.ativo && !!cfg.token, escopo: cfg.escopo === 'escritorio' ? 'escritorio' : 'minhas', cliente: cfg.cliente !== false, alertas: cfg.alertas !== false, ...(cfg.token ? urls(request, cfg.token) : {}) };
}
/* /api/calendario (sessão): GET estado · PUT { ativo, escopo, cliente, alertas } · POST /novo gera um link novo */
export async function calendarioRotas(request, env, partes, auth) {
  const key = chaveDe(auth), id = 'cal-' + key, m = request.method;
  if (m === 'GET' && !partes[1]) return json(await estado(request, env, auth));
  const cfg = { ...PADRAO, ...((await ler(env, id)) || {}) };
  if (m === 'PUT' && !partes[1]) {
    const c = await request.json().catch(() => null);
    if (!c || typeof c !== 'object') return erro(400, 'invalid', 'Configuração inválida.');
    if (typeof c.escopo === 'string' && ['minhas', 'escritorio'].includes(c.escopo)) cfg.escopo = c.escopo;
    if (typeof c.cliente === 'boolean') cfg.cliente = c.cliente;
    if (typeof c.alertas === 'boolean') cfg.alertas = c.alertas;
    if (typeof c.ativo === 'boolean') { cfg.ativo = c.ativo; if (c.ativo && !cfg.token) { cfg.token = novoToken(); await gravar(env, await indice(cfg.token), { key }); } }
    await gravar(env, id, cfg);
    return json(await estado(request, env, auth));
  }
  if (m === 'POST' && partes[1] === 'novo') {
    if (cfg.token) await apagar(env, await indice(cfg.token));
    cfg.token = novoToken(); await gravar(env, await indice(cfg.token), { key }); await gravar(env, id, cfg);
    return json(await estado(request, env, auth));
  }
  return erro(404, 'not_found', 'Não encontrado.');
}

/* ---------- o arquivo .ics ---------- */
const esc = (t) => String(t == null ? '' : t).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
function dobrar(linha) {   // linhas de no máximo 75 bytes (UTF-8), continuação começa com um espaço
  const enc = new TextEncoder(); if (enc.encode(linha).length <= 75) return linha;
  const partes = []; let atual = '', n = 0, lim = 75;
  for (const ch of linha) { const b = enc.encode(ch).length; if (n + b > lim) { partes.push(atual); atual = ' '; n = 1; lim = 75; } atual += ch; n += b; }
  partes.push(atual); return partes.join('\r\n');
}
const ymd = (iso) => iso.replace(/-/g, '');
const soma = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
function fim1h(data, hora) { const [h, mi] = hora.split(':').map(Number); const t = Date.UTC(+data.slice(0, 4), +data.slice(5, 7) - 1, +data.slice(8, 10), h + 1, mi); return new Date(t).toISOString().replace(/[-:]/g, '').slice(0, 15); }
const stamp = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

export function montarIcs(audiencias, opc, nomes) {
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Horus//Audiencias//PT-BR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Audiências · Horus', 'X-WR-TIMEZONE:America/Sao_Paulo', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H',
    'BEGIN:VTIMEZONE', 'TZID:America/Sao_Paulo', 'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:-0300', 'TZOFFSETTO:-0300', 'TZNAME:-03', 'END:STANDARD', 'END:VTIMEZONE'];
  for (const { id, d, atualizado } of audiencias) {
    const hora = /^\d{2}:\d{2}$/.test(d.hora || '') ? d.hora : '';
    const titulo = opc.cliente && d.cliente ? 'Audiência · ' + String(d.cliente).slice(0, 80) : 'Audiência' + (hora ? ' · ' + hora : '');
    const desc = [d.processo ? 'Processo ' + d.processo : '', d.audTipo ? 'Audiência de ' + String(d.audTipo).toLowerCase() : '', d.modalidade ? 'Modalidade: ' + ({ presencial: 'presencial', online: 'online', hibrida: 'híbrida' }[d.modalidade] || d.modalidade) : '', /^https?:\/\//i.test(d.link || '') ? 'Entrar: ' + d.link : '',
      Array.isArray(d.resp) && d.resp.length ? 'Responsável: ' + d.resp.map((k) => nomes[k] || '').filter(Boolean).join(', ') : '', d.obs ? 'Obs.: ' + String(d.obs).slice(0, 400) : ''].filter(Boolean).join('\n');
    L.push('BEGIN:VEVENT', 'UID:aud-' + id + '@horus', 'DTSTAMP:' + stamp(atualizado || Date.now()), 'LAST-MODIFIED:' + stamp(atualizado || Date.now()));
    if (hora) L.push('DTSTART;TZID=America/Sao_Paulo:' + ymd(d.data) + 'T' + hora.replace(':', '') + '00', 'DTEND;TZID=America/Sao_Paulo:' + fim1h(d.data, hora));
    else L.push('DTSTART;VALUE=DATE:' + ymd(d.data), 'DTEND;VALUE=DATE:' + ymd(soma(d.data, 1)));
    L.push('SUMMARY:' + esc(titulo));
    const local = d.local || (d.modalidade === 'online' ? 'Online' : '');
    if (local) L.push('LOCATION:' + esc(local));
    if (/^https?:\/\//i.test(d.link || '')) L.push('URL:' + d.link.replace(/[\r\n]/g, ''));
    if (desc) L.push('DESCRIPTION:' + esc(desc));
    L.push('STATUS:CONFIRMED', 'TRANSP:OPAQUE');
    if (opc.alertas) {
      if (hora) L.push('BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:Audiência amanhã', 'END:VALARM', 'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', 'DESCRIPTION:Audiência em 1 hora', 'END:VALARM');
      else L.push('BEGIN:VALARM', 'TRIGGER:-PT15H', 'ACTION:DISPLAY', 'DESCRIPTION:Audiência amanhã', 'END:VALARM');
    }
    L.push('END:VEVENT');
  }
  L.push('END:VCALENDAR');
  return L.map(dobrar).join('\r\n') + '\r\n';
}

/* GET /cal/<token>.ics (pública) */
export async function calendarioFeed(request, env) {
  const m = /^\/cal\/([A-Za-z0-9_-]{20,64})\.ics$/.exec(new URL(request.url).pathname);
  const nao = () => new Response('Calendário não encontrado.', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
  if (!m || request.method !== 'GET') return nao();
  const ind = await ler(env, await indice(m[1])); if (!ind) return nao();
  const cfg = await ler(env, 'cal-' + ind.key); if (!cfg || !cfg.ativo || cfg.token !== m[1]) return nao();
  const us = await usuariosAtivos(env), dId = (await proprietario(env) || {}).id;
  let u = ind.key === 'dono' ? us.find((x) => x.id === dId) : us.find((x) => x.id === ind.key);
  if (ind.key !== 'dono' && !u) return nao();   // pessoa desativada ou removida: o link para de valer
  const dono = ind.key === 'dono';
  if (!u) u = { id: dId || '', papel: 'proprietario', oabs: [], norm: normalizarUsuario({ id: dId || '', papel: 'proprietario' }) };
  const auth = dono ? null : { usuario: u }, norm = normalizarUsuario(u), esc0 = !dono && norm.papel === 'advogado' ? await escopoDoAdvogado(env, auth) : null;
  const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10), desde = soma(hoje, -7), ate = soma(hoje, 400);
  const { results } = await env.DB.prepare("SELECT id, dados, atualizado FROM docs WHERE colecao = 'agenda'").all();
  const lista = [];
  for (const r of results) {
    const d = JSON.parse(r.dados);
    if (d.tipo !== 'audiencia' || d.cancelado || !/^\d{4}-\d{2}-\d{2}$/.test(d.data || '') || d.data < desde || d.data > ate) continue;
    const reg = { ...d, id: r.id };
    if (cfg.escopo === 'escritorio') { if (!dono && !podeVer('agenda', reg, auth, esc0)) continue; }
    else {
      const meu = d.criadoPor === norm.id || ehResponsavel(d, norm) || (dono && !d.criadoPor && !(Array.isArray(d.resp) && d.resp.length)) || (!dono && norm.papel === 'advogado' && !(Array.isArray(d.resp) && d.resp.length) && !!esc0 && !!d.processo && esc0.processos.has(String(d.processo).replace(/\D/g, '')));
      if (!meu) continue;
    }
    lista.push({ id: r.id, d, atualizado: r.atualizado });
  }
  lista.sort((a, b) => (a.d.data + (a.d.hora || '')).localeCompare(b.d.data + (b.d.hora || '')));
  const nomes = {}; for (const x of us) { nomes['u:' + x.id] = x.nome; for (const o of x.norm.oabs) nomes[o] = x.nome; }
  return new Response(montarIcs(lista, { cliente: cfg.cliente !== false, alertas: cfg.alertas !== false }, nomes), { headers: { 'content-type': 'text/calendar; charset=utf-8', 'cache-control': 'private, max-age=300', 'content-disposition': 'inline; filename="audiencias.ics"' } });
}
