/* ============================================================
   ATENDIMENTOS: gravação da reunião com o cliente (áudio no R2) + transcrição (src/transcricao.js).
   Registros em `_atendimentos` (reservada: fora da API genérica e do backup; o áudio fica no R2 em aten/<dono>/<id>/<trecho>).
   O áudio chega em TRECHOS independentes (cada um é um arquivo de áudio completo, de poucos minutos): se o app fechar no meio, o que já subiu não se perde,
   e cada trecho é transcrito sozinho (o limite de tamanho por chamada do reconhecimento não depende da duração da reunião).

   Quem usa: proprietário (vê todos) e advogado (só os que ele mesmo gravou). Estagiário e familiar: nada.

   Rotas (todas exigem sessão):
     GET    /api/atendimentos?cliente=&caso=        lista (sem o texto)
     POST   /api/atendimentos                       { clienteId?, casoId?, titulo?, data? }  → cria o atendimento
     GET    /api/atendimentos/<id>                  o atendimento com a transcrição na ordem (tempos absolutos)
     PUT    /api/atendimentos/<id>                  { titulo?, clienteId?, casoId?, data?, falantes?: { "0": "Cliente" } }
     PUT    /api/atendimentos/<id>/trecho/<n>?dur=<segundos>   corpo = o áudio do trecho n (até 25 MB); refazer o mesmo n substitui
     GET    /api/atendimentos/<id>/trecho/<n>       o áudio (aceita Range: o Safari exige)
     POST   /api/atendimentos/<id>/transcrever      { trecho?, refazer?, provedor? }  → transcreve UM trecho pendente por chamada; devolve quanto falta
     POST   /api/atendimentos/<id>/resumir          { provedor? }  → a "Ficha de atendimento" (resumo da transcrição, com o horário de cada item)
     GET    /api/atendimentos/config                { apagarAudioDias, uso }   ·   PUT (só o proprietário): { apagarAudioDias: 0 | dias }
     DELETE /api/atendimentos/<id>?soAudio=1        apaga o áudio (e mantém a transcrição) ou, sem soAudio, tudo
   ============================================================ */
import { ehDono } from './politica.js';
import { somarOp, r2Bloqueado, MAX_ARQUIVO } from './peticoes.js';
import { transcrever, provedoresDisponiveis, PROVEDORES, ORDEM_PADRAO } from './transcricao.js';
import { resumir, resumosDisponiveis, PROVEDORES_RESUMO, ORDEM_RESUMO } from './resumo-atendimento.js';

const COL = '_atendimentos';
const MAX_TRECHOS = 400, LIM_AUDIO = 8 * 1024 ** 3;
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const erro = (status, code, message) => json({ error: { code, message } }, status);
const aleat = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');
const hoje = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const txt = (v, n) => String(v == null ? '' : v).slice(0, n);
const quem = (auth) => (auth && auth.usuario ? { id: auth.usuario.id || '', papel: auth.usuario.papel || '' } : { id: '', papel: 'proprietario' });

async function ler(env, id) { const r = await env.DB.prepare('SELECT dados FROM docs WHERE colecao = ? AND id = ?').bind(COL, id).first(); return r ? JSON.parse(r.dados) : null; }
async function gravar(env, d) { await env.DB.prepare('INSERT INTO docs (colecao,id,dados,atualizado) VALUES (?,?,?,?) ON CONFLICT(colecao,id) DO UPDATE SET dados=excluded.dados, atualizado=excluded.atualizado').bind(COL, d.id, JSON.stringify(d), Date.now()).run(); }
async function todos(env) { const { results } = await env.DB.prepare("SELECT dados FROM docs WHERE colecao = ? AND id != '_cfg'").bind(COL).all(); return results.map((r) => JSON.parse(r.dados)); }
async function lerCfg(env) { const c = await ler(env, '_cfg'); return { apagarAudioDias: Math.max(0, Math.min(Number(c && c.apagarAudioDias) || 0, 3650)) }; }
const listaProv = (env) => ({ provedores: provedoresDisponiveis(env).filter((k) => k !== 'teste').map((k) => ({ id: k, nome: PROVEDORES[k].nome })), resumoProvedores: resumosDisponiveis(env).filter((k) => k !== 'teste').map((k) => ({ id: k, nome: PROVEDORES_RESUMO[k].nome })) });

export function podeUsarAtendimentos(auth) { return ehDono(auth) || quem(auth).papel === 'advogado'; }
const podeVer = (auth, d) => ehDono(auth) || (quem(auth).papel === 'advogado' && d.uid === quem(auth).id);
const chaveR2 = (d, n) => `aten/${d.uid || 'dono'}/${d.id}/${n}`;

/* resumo para a lista (sem o texto) */
function resumo(d) {
  const trechos = (d.trechos || []).filter((t) => t.r2), durTotal = (d.trechos || []).reduce((s, t) => s + (t.dur || 0), 0), feitos = Object.keys(d.transc || {}).length;
  return { id: d.id, titulo: d.titulo, data: d.data, clienteId: d.clienteId || '', casoId: d.casoId || '', criadoEm: d.criadoEm, nTrechos: (d.trechos || []).length, nComAudio: trechos.length, dur: durTotal,
    tam: (d.trechos || []).reduce((s, t) => s + (t.tam || 0), 0), nTranscritos: feitos, status: statusDe(d), temTexto: feitos > 0 };
}
function statusDe(d) {
  const n = (d.trechos || []).length, f = Object.keys(d.transc || {}).length;
  if (!n) return 'gravando';
  return f >= n ? 'pronto' : (f > 0 ? 'parcial' : 'enviado');
}
/* a transcrição inteira, com os tempos absolutos (início do trecho = soma da duração dos anteriores) */
function textoCompleto(d) {
  const ordem = [...(d.trechos || [])].sort((a, b) => a.i - b.i); let t0 = 0; const itens = [];
  for (const t of ordem) {
    const tr = (d.transc || {})[t.i];
    if (tr) for (const it of tr.itens || []) itens.push({ trecho: t.i, ini: Math.round((t0 + (it.ini || 0)) * 10) / 10, fim: Math.round((t0 + (it.fim || 0)) * 10) / 10, texto: it.texto, falante: it.falante });
    t0 += t.dur || 0;
  }
  return itens;
}
const completo = (d, env) => ({ ...resumo(d), trechos: (d.trechos || []).map((t) => ({ i: t.i, dur: t.dur, tam: t.tam, mime: t.mime, temAudio: !!t.r2, provedor: (d.transc && d.transc[t.i] && d.transc[t.i].provedor) || '' })), itens: textoCompleto(d), falantes: d.falantes || {}, erro: d.erro || '', resumo: d.resumo || null, ...listaProv(env) });

async function bytesGuardados(env) { return (await todos(env)).reduce((s, d) => s + (d.trechos || []).reduce((a, t) => a + (t.r2 ? t.tam || 0 : 0), 0), 0); }

export async function atendimentosRotas(request, env, partes, auth) {
  if (!podeUsarAtendimentos(auth)) return erro(403, 'forbidden', 'Só o proprietário e os advogados usam os atendimentos.');
  if (!env.ARQUIVOS) return erro(503, 'sem_r2', 'O armazenamento de arquivos (R2) ainda não está ligado.');
  const m = request.method, id = partes[1] || '', sub = partes[2] || '', url = new URL(request.url);
  const eu = quem(auth);

  if (!id) {
    if (m === 'GET') {
      const cli = url.searchParams.get('cliente') || '', caso = url.searchParams.get('caso') || '';
      const lista = (await todos(env)).filter((d) => podeVer(auth, d) && (!cli || d.clienteId === cli) && (!caso || d.casoId === caso)).map(resumo);
      lista.sort((a, b) => String(b.data).localeCompare(String(a.data)) || String(b.criadoEm).localeCompare(String(a.criadoEm)));
      return json({ itens: lista, ...listaProv(env) });
    }
    if (m === 'POST') {
      const b = await request.json().catch(() => ({}));
      const d = { id: aleat(), uid: eu.id, titulo: txt(b.titulo, 120) || 'Atendimento', data: /^\d{4}-\d{2}-\d{2}$/.test(b.data || '') ? b.data : hoje(), clienteId: txt(b.clienteId, 60), casoId: txt(b.casoId, 60), criadoEm: new Date().toISOString(), trechos: [], transc: {}, falantes: {} };
      await gravar(env, d); return json(completo(d, env), 201);
    }
    return erro(405, 'method', 'Método não permitido.');
  }

  if (id === 'config') {
    if (m === 'PUT') {
      if (!ehDono(auth)) return erro(403, 'forbidden', 'Só o proprietário muda isto.');
      const b = await request.json().catch(() => ({})); const dias = Math.max(0, Math.min(parseInt(b.apagarAudioDias, 10) || 0, 3650));
      await gravar(env, { id: '_cfg', apagarAudioDias: dias }); return json({ apagarAudioDias: dias });
    }
    if (m !== 'GET') return erro(405, 'method', 'Método não permitido.');
    const meus = (await todos(env)).filter((d) => podeVer(auth, d));
    return json({ ...(await lerCfg(env)), uso: { nAtend: meus.length, bytes: meus.reduce((s2, d) => s2 + (d.trechos || []).reduce((a, t) => a + (t.r2 ? t.tam || 0 : 0), 0), 0) }, ...listaProv(env) });
  }

  const d = await ler(env, id);
  if (!d || id === '_cfg' || !podeVer(auth, d)) return erro(404, 'not_found', 'Atendimento não encontrado.');

  if (!sub) {
    if (m === 'GET') return json(completo(d, env));
    if (m === 'PUT') {
      const b = await request.json().catch(() => ({}));
      if (b.titulo !== undefined) d.titulo = txt(b.titulo, 120) || 'Atendimento';
      if (b.clienteId !== undefined) d.clienteId = txt(b.clienteId, 60);
      if (b.casoId !== undefined) d.casoId = txt(b.casoId, 60);
      if (/^\d{4}-\d{2}-\d{2}$/.test(b.data || '')) d.data = b.data;
      if (b.falantes && typeof b.falantes === 'object') { d.falantes = {}; for (const k of Object.keys(b.falantes).slice(0, 10)) d.falantes[txt(k, 20)] = txt(b.falantes[k], 40); }
      await gravar(env, d); return json(completo(d, env));
    }
    if (m === 'DELETE') {
      const soAudio = url.searchParams.get('soAudio') === '1';
      for (const t of d.trechos || []) if (t.r2) { await env.ARQUIVOS.delete(t.r2); await somarOp(env, 'classeA'); t.r2 = ''; }
      if (soAudio) { d.audioApagadoEm = new Date().toISOString(); await gravar(env, d); return json(completo(d, env)); }
      await env.DB.prepare('DELETE FROM docs WHERE colecao = ? AND id = ?').bind(COL, d.id).run();
      return json({ ok: true });
    }
    return erro(405, 'method', 'Método não permitido.');
  }

  if (sub === 'trecho') {
    const n = parseInt(partes[3], 10);
    if (!Number.isInteger(n) || n < 0 || n >= MAX_TRECHOS) return erro(400, 'invalid', 'Número de trecho inválido.');
    if (m === 'PUT') {
      const mime = String(request.headers.get('content-type') || '').split(';')[0].trim();
      if (!/^(audio|video)\//.test(mime)) return erro(415, 'tipo', 'Envie o áudio (audio/mp4, audio/webm, audio/mpeg, audio/wav).');
      if (Number(request.headers.get('content-length') || 0) > MAX_ARQUIVO) return erro(413, 'quota_exceeded', 'O trecho passa de 25 MB.');
      if (await r2Bloqueado(env) || (await bytesGuardados(env)) > LIM_AUDIO) return erro(507, 'limite_gratuito', 'O limite de armazenamento foi atingido. Apague áudios antigos para liberar espaço.');
      const bytes = await request.arrayBuffer();
      if (!bytes.byteLength) return erro(400, 'invalid', 'O trecho veio vazio.');
      if (bytes.byteLength > MAX_ARQUIVO) return erro(413, 'quota_exceeded', 'O trecho passa de 25 MB.');
      const dur = Math.max(0, Math.min(Number(url.searchParams.get('dur')) || 0, 3 * 3600));
      const chave = chaveR2(d, n);
      await env.ARQUIVOS.put(chave, bytes, { httpMetadata: { contentType: mime } }); await somarOp(env, 'classeA');
      const reg = { i: n, dur, tam: bytes.byteLength, mime, r2: chave, em: new Date().toISOString() };
      d.trechos = (d.trechos || []).filter((t) => t.i !== n).concat([reg]).sort((a, b) => a.i - b.i);
      delete (d.transc || {})[n];   // áudio novo: a transcrição antiga deste trecho deixa de valer
      await gravar(env, d); return json({ ok: true, trecho: n, tam: reg.tam, status: statusDe(d) });
    }
    if (m === 'GET') {
      const t = (d.trechos || []).find((x) => x.i === n); if (!t || !t.r2) return erro(404, 'not_found', 'O áudio deste trecho não está mais guardado.');
      const cab = request.headers.get('range'), mr = cab && /^bytes=(\d*)-(\d*)$/.exec(cab);
      await somarOp(env, 'classeB');
      if (mr && (mr[1] !== '' || mr[2] !== '')) {
        const total = t.tam; let ini = mr[1] === '' ? Math.max(0, total - Number(mr[2])) : Number(mr[1]), fim = mr[1] === '' || mr[2] === '' ? total - 1 : Math.min(Number(mr[2]), total - 1);
        if (ini > fim || ini >= total) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${total}` } });
        const o = await env.ARQUIVOS.get(t.r2, { range: { offset: ini, length: fim - ini + 1 } }); if (!o) return erro(404, 'not_found', 'O áudio não está mais guardado.');
        return new Response(o.body, { status: 206, headers: { 'content-type': t.mime, 'content-range': `bytes ${ini}-${fim}/${total}`, 'content-length': String(fim - ini + 1), 'accept-ranges': 'bytes', 'cache-control': 'private, no-store' } });
      }
      const o = await env.ARQUIVOS.get(t.r2); if (!o) return erro(404, 'not_found', 'O áudio não está mais guardado.');
      return new Response(o.body, { status: 200, headers: { 'content-type': t.mime, 'content-length': String(t.tam), 'accept-ranges': 'bytes', 'cache-control': 'private, no-store' } });
    }
    return erro(405, 'method', 'Método não permitido.');
  }

  if (sub === 'transcrever' && m === 'POST') {
    const b = await request.json().catch(() => ({}));
    const pend = (d.trechos || []).filter((t) => t.r2 && (b.refazer ? (b.trecho === undefined || t.i === Number(b.trecho)) : !(d.transc || {})[t.i] && (b.trecho === undefined || t.i === Number(b.trecho))));
    if (!pend.length) return json({ ok: true, feito: null, faltam: 0, status: statusDe(d) });
    const t = pend[0];
    const o = await env.ARQUIVOS.get(t.r2); await somarOp(env, 'classeB');
    if (!o) return erro(404, 'not_found', 'O áudio deste trecho não está mais guardado.');
    let r;
    try { r = await transcrever(env, await o.arrayBuffer(), t.mime, { ordem: b.provedor && PROVEDORES[b.provedor] ? [b.provedor, ...ORDEM_PADRAO.filter((k) => k !== b.provedor)] : ORDEM_PADRAO }); }
    catch (e) {
      d.erro = e && e.semProvedor ? 'Nenhum serviço de transcrição está ligado.' : 'Não consegui transcrever agora. O áudio está guardado; tente de novo daqui a pouco.';
      await gravar(env, d); return json({ ok: false, trecho: t.i, faltam: pend.length, status: statusDe(d), erro: d.erro }, e && e.semProvedor ? 503 : 502);
    }
    d.transc = d.transc || {}; d.transc[t.i] = { provedor: r.provedor, idioma: r.idioma, itens: r.itens, em: new Date().toISOString() }; d.erro = '';
    await gravar(env, d);
    return json({ ok: true, feito: t.i, provedor: r.provedor, faltam: pend.length - 1, status: statusDe(d) });
  }
  if (sub === 'resumir' && m === 'POST') {
    const b = await request.json().catch(() => ({}));
    const itens = textoCompleto(d); if (!itens.length) return erro(409, 'sem_texto', 'Primeiro é preciso ter a transcrição.');
    const durTotal = (d.trechos || []).reduce((s2, t) => s2 + (t.dur || 0), 0);
    try { d.resumo = await resumir(env, itens, durTotal, { falantes: d.falantes, ordem: b.provedor && PROVEDORES_RESUMO[b.provedor] ? [b.provedor, ...ORDEM_RESUMO.filter((k) => k !== b.provedor)] : ORDEM_RESUMO }); }
    catch (e) {
      const msg = e && e.curto ? 'A transcrição é curta demais para resumir.' : (e && e.semProvedor ? 'Nenhum serviço de resumo está ligado.' : 'Não consegui montar a ficha agora. A transcrição continua guardada; tente de novo daqui a pouco.');
      return erro(e && e.semProvedor ? 503 : (e && e.curto ? 409 : 502), 'resumo', msg);
    }
    await gravar(env, d); return json(completo(d, env));
  }
  return erro(404, 'not_found', 'Rota não encontrada.');
}

/* uma vez por dia (cron): apaga o ÁUDIO dos atendimentos mais antigos que o prazo escolhido pelo proprietário (a transcrição fica). Sem prazo (padrão), não apaga nada. */
export async function limparAudiosAntigos(env, agora = Date.now()) {
  if (!env.ARQUIVOS) return 0;
  const { apagarAudioDias } = await lerCfg(env); if (!apagarAudioDias) return 0;
  const corte = agora - apagarAudioDias * 86400000; let n = 0;
  for (const d of await todos(env)) {
    if (!(d.trechos || []).some((t) => t.r2)) continue;
    const ref = Date.parse(d.criadoEm || '') || 0; if (!ref || ref > corte) continue;
    for (const t of d.trechos) if (t.r2) { await env.ARQUIVOS.delete(t.r2); await somarOp(env, 'classeA'); t.r2 = ''; }
    d.audioApagadoEm = new Date(agora).toISOString(); await gravar(env, d); n++;
  }
  return n;
}
