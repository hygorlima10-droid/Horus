/* Planilha "Controle de Petições e Tarefas" (Google Sheets) ⇄ Agenda do Horus, nos dois sentidos.
   - Quem conversa é o script da própria planilha (Apps Script): ele chama /api/planilha-sync com uma chave secreta (Authorization: Bearer).
     Nada entra pelo Google; o app não precisa de conta de serviço nem de projeto no Google Cloud.
   - A cada conversa o script manda as linhas da aba Controle; o servidor junta, CAMPO A CAMPO, o que mudou na planilha com o que mudou no app
     (mesmo campo mexido nos dois lados ao mesmo tempo: vale a planilha) e devolve o que a planilha precisa aplicar (linhas novas, IDs e mudanças).
   - Cada item da Agenda ligado à planilha leva `plan` = { id, base, statusRaw, ult, ... }: `base` é o último valor em que os dois lados concordaram.
   - Itens criados no app com `planilha: true` viram linha nova; linhas novas da planilha viram item da Agenda (prazo se tem processo e data, senão tarefa).
   - Fica em coleções reservadas: _planilha/config (chave, estado, mapa de nomes). */
import { lerDoc, stmtDoc } from './acesso.js';
import { usuariosAtivos, avisarAtividade } from './avisos.js';
import { stmtRegistro, mudancas, tituloDe } from './auditoria.js';
import { normNome } from './politica.js';

const COL = '_planilha';
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const erro = (status, code, message) => json({ error: { code, message } }, status);
const hoje = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const aleat = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, n);
const b64u = (u8) => btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const COLUNAS = ['titulo', 'processo', 'resp', 'delegado', 'prio', 'status', 'obs', 'data'];   // campos que andam nos dois sentidos
const STATUS_ROTULOS = ['A fazer', 'Em andamento', 'Aguardando cliente', 'Em revisão', 'Protocolada', 'Concluída'];

/* ---------- configuração ---------- */
const cfgLer = async (env) => ({ nomes: {}, vistos: [], integrantes: [], ...(await lerDoc(env, COL, 'config') || {}) });
const cfgGravar = (env, cfg) => stmtDoc(env, COL, 'config', cfg).run();
const iguais = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

/* ---------- normalização ---------- */
const digitos = (s) => String(s == null ? '' : s).replace(/\D/g, '');
export function formatarProcesso(s) {   // número com quebras de linha, espaços e lixo → formato CNJ quando tem 20 dígitos
  const d = digitos(s); if (d.length !== 20) return String(s == null ? '' : s).replace(/[\r\n]+/g, ' ').trim();
  return d.slice(0, 7) + '-' + d.slice(7, 9) + '.' + d.slice(9, 13) + '.' + d.slice(13, 14) + '.' + d.slice(14, 16) + '.' + d.slice(16);
}
const txt = (s) => String(s == null ? '' : s).replace(/\r\n?/g, '\n').trim();
const dataOk = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? String(s) : '');
const normRot = (s) => normNome(s).replace(/ /g, '');

/* ---------- status ---------- */
export function statusParaDoc(raw) {
  const s = normRot(raw);
  if (s === 'emandamento') return { situacao: 'elaboracao', concluido: false, aguardando: false };
  if (s === 'aguardandocliente') return { situacao: 'afazer', concluido: false, aguardando: true };
  if (s === 'emrevisao') return { situacao: 'pronta', concluido: false, aguardando: false };
  if (s === 'protocolada' || s === 'concluida') return { situacao: 'feito', concluido: true, aguardando: false };
  return { situacao: 'afazer', concluido: false, aguardando: false };
}
export const semDoc = (d) => (d.concluido || d.situacao === 'feito' || d.situacao === 'cancelado' ? 'feito' : (d.situacao || 'afazer') + (d.aguardando ? '+ag' : ''));
const semRaw = (raw) => semDoc(statusParaDoc(raw));
export function rotuloDoDoc(d, raw) {
  const s = semDoc(d); if (raw && semRaw(raw) === s) return raw;
  if (s === 'feito') return d.tipo === 'prazo' ? 'Protocolada' : 'Concluída';
  return { 'afazer+ag': 'Aguardando cliente', afazer: 'A fazer', elaboracao: 'Em andamento', pronta: 'Em revisão' }[s] || 'A fazer';
}

/* ---------- quem é quem ---------- */
const chaveDe = (u) => (u.norm.oabs[0] || 'u:' + u.id);
const primeiroNome = (n) => normNome(String(n || '').split(/\s+/)[0]);
function mapaAuto(nomes, us, existentes) {   // sugere o usuário cujo primeiro nome é igual ao da planilha (só preenche o que ainda não foi escolhido)
  const m = { ...existentes };
  for (const n of nomes) {
    if (m[n] !== undefined) continue;
    const ach = us.filter((u) => primeiroNome(u.nome) === normNome(n));
    if (ach.length === 1) m[n] = chaveDe(ach[0]);
  }
  return m;
}
const chaveParaNome = (mapa, chave) => Object.keys(mapa).find((n) => mapa[n] === chave) || '';
const nomeDaChave = (us, chave) => { const u = us.find((x) => chaveDe(x) === chave || x.norm.oabs.includes(chave) || ('u:' + x.id) === chave); return u ? u.nome : ''; };

/* ---------- campos ---------- */
function camposApp(d, ctx) {
  const chaves = Array.isArray(d.resp) ? d.resp : [];
  let resp = '';
  for (const k of chaves) { const n = chaveParaNome(ctx.mapa, k); if (n) { resp = n; break; } }
  if (!resp) resp = d.respNome || '';
  let delegado = d.delegadoPor || '';
  if (!delegado && d.criadoPor) { delegado = chaveParaNome(ctx.mapa, 'u:' + d.criadoPor) || ''; if (!delegado) { const u = ctx.us.find((x) => x.id === d.criadoPor); if (u) delegado = chaveParaNome(ctx.mapa, chaveDe(u)) || String(u.nome || '').split(/\s+/)[0]; } }
  return { titulo: txt(d.titulo), processo: digitos(d.processo), resp: normNome(resp), delegado: normNome(delegado), prio: txt(d.prioridade), status: semDoc(d), obs: txt(d.obs), data: dataOk(d.data), _resp: resp, _delegado: delegado };
}
const camposPlanilha = (l) => ({ titulo: txt(l.titulo), processo: digitos(l.processo), resp: normNome(l.resp), delegado: normNome(l.delegado), prio: txt(l.prio), status: semRaw(l.status), obs: txt(l.obs), data: dataOk(l.fatal) });

/* cliente do processo (para a linha vinda da planilha, que quase sempre vem sem cliente) */
async function clienteDoProcesso(env, proc) {
  const d = digitos(proc); if (d.length < 15) return '';
  const { results } = await env.DB.prepare("SELECT colecao, dados FROM docs WHERE colecao IN ('casos','processos','termosAcordo','alvaras')").all();
  for (const r of results) {
    const x = JSON.parse(r.dados);
    if (digitos(x.numeroProcesso || x.numero) === d) return txt(x.cliente || x.partes || '');
  }
  return '';
}

/* aplica no item da Agenda o que veio da planilha (por campo) */
function aplicarNoDoc(d, campos, linha, ctx) {
  for (const f of campos) {
    if (f === 'titulo') d.titulo = txt(linha.titulo);
    else if (f === 'processo') d.processo = formatarProcesso(linha.processo);
    else if (f === 'resp') {
      const n = txt(linha.resp), chave = ctx.mapa[n]; d.respNome = n;
      d.resp = chave ? [chave] : [];
    } else if (f === 'delegado') d.delegadoPor = txt(linha.delegado);
    else if (f === 'prio') d.prioridade = txt(linha.prio);
    else if (f === 'obs') d.obs = txt(linha.obs);
    else if (f === 'data') d.data = dataOk(linha.fatal);
    else if (f === 'status') {
      const novo = statusParaDoc(linha.status); const antes = semDoc(d);
      Object.assign(d, novo);
      if (novo.concluido && antes !== 'feito') { d.concluidoEm = hoje(); if (normRot(linha.status) === 'protocolada') d.protocoladoEm = hoje(); }
      if (!novo.concluido) { delete d.concluidoEm; delete d.protocoladoEm; }
      if (novo.situacao === 'pronta' && antes !== 'pronta') { d.prontaEm = hoje(); d.prontaPor = txt(linha.resp); }
      if (novo.situacao !== 'pronta') { delete d.prontaEm; delete d.prontaPor; }
    }
  }
  if (linha.interno && dataOk(linha.interno)) d.trabalhar = dataOk(linha.interno);   // o prazo interno é calculado pela planilha
}
/* valores que a planilha precisa receber (só dos campos escolhidos) */
function valoresParaPlanilha(d, campos, ctx, raw) {
  const a = camposApp(d, ctx), v = {};
  for (const f of campos) {
    if (f === 'titulo') v.titulo = txt(d.titulo);
    else if (f === 'processo') v.processo = formatarProcesso(d.processo);
    else if (f === 'resp') v.resp = a._resp;
    else if (f === 'delegado') v.delegado = a._delegado;
    else if (f === 'prio') v.prio = txt(d.prioridade);
    else if (f === 'obs') v.obs = txt(d.obs);
    else if (f === 'data') v.fatalManual = dataOk(d.data);
    else if (f === 'status') v.status = rotuloDoDoc(d, raw);
  }
  return v;
}
const baseDe = (c) => { const b = {}; for (const f of COLUNAS) b[f] = c[f]; return b; };

/* ---------- o que o app tem de novo para a planilha (também serve para o "ping" leve) ---------- */
async function itensAgenda(env) {
  const { results } = await env.DB.prepare("SELECT id, dados FROM docs WHERE colecao = 'agenda'").all();
  return results.map((r) => ({ id: r.id, d: JSON.parse(r.dados) }));
}
function pendenciasDoApp(itens, ctx) {
  let n = 0;
  for (const { d } of itens) {
    if (d.planilha === true && (!d.plan || d.plan.pendente)) { n++; continue; }
    if (d.plan && d.plan.base && !d.plan.removida) { const a = camposApp(d, ctx); if (COLUNAS.some((f) => a[f] !== d.plan.base[f])) n++; }
  }
  return n;
}

/* ---------- a conversa com a planilha ---------- */
async function sincronizar(env, deps, corpo, cfg) {
  const us = await usuariosAtivos(env), vistos = new Set((corpo.integrantes || []).map((x) => txt(x.nome)).filter(Boolean));
  const linhasTodas = Array.isArray(corpo.linhas) ? corpo.linhas : [];
  for (const l of linhasTodas) { if (txt(l.resp)) vistos.add(txt(l.resp)); if (txt(l.delegado)) vistos.add(txt(l.delegado)); }
  cfg.integrantes = (corpo.integrantes || []).map((x) => ({ nome: txt(x.nome), funcao: txt(x.funcao) })).filter((x) => x.nome);
  cfg.vistos = [...vistos].sort();
  cfg.nomes = mapaAuto(cfg.vistos, us, cfg.nomes);
  const ctx = { mapa: cfg.nomes, us };
  const itens = await itensAgenda(env), porPlan = new Map(itens.filter((x) => x.d.plan && x.d.plan.id).map((x) => [x.d.plan.id, x]));
  const resp = { ok: true, ids: [], aplicar: [], novas: [] };
  const idsNaPlanilha = new Set(linhasTodas.map((l) => txt(l.id)).filter(Boolean));
  const stmts = [], avisos = [], primeira = !cfg.importacaoFeita;
  let conflitos = 0, removidas = 0, ligadas = 0;
  const vistosIds = new Set();
  const salvar = (id, antes, depois, acao) => {
    stmts.push(stmtDoc(env, 'agenda', id, depois));
    stmts.push(stmtRegistro(env, { op: acao, colecao: 'agenda', id, titulo: tituloDe('agenda', depois), dados: depois, por: 'Planilha', ...(antes ? { mud: mudancas(antes, depois) } : {}) }));
    if (!primeira) avisos.push({ colecao: 'agenda', id, antes, depois, acao: acao === 'criou' ? 'criou' : 'alterou' });
  };

  for (const l of linhasTodas) {
    const proc = txt(l.processo), tit = txt(l.titulo); if (!tit && !digitos(proc)) continue;   // linha vazia
    const pid = txt(l.id);
    const achado = pid ? porPlan.get(pid) : null;
    if (pid && achado) vistosIds.add(pid);
    if (!achado) {
      if (pid) continue;   // a linha tem ID de um item que foi apagado no app: não recria
      const sem = semRaw(l.status); if (sem === 'feito') continue;   // histórico já concluído não entra
      const dup = itens.find((x) => x.d.plan && x.d.plan.origem === 'planilha' && !idsNaPlanilha.has(x.d.plan.id) && !x.d.plan.removida && txt(x.d.titulo) === tit && digitos(x.d.processo) === digitos(proc) && normNome(x.d.respNome) === normNome(l.resp));
      if (dup) { resp.ids.push({ linha: l.linha, id: dup.d.plan.id }); ligadas++; continue; }   // a resposta anterior se perdeu: devolve o mesmo ID, sem criar outro item
      const novoPid = 'h-' + aleat(6), idDoc = aleat(20), proc2 = formatarProcesso(proc);
      const d = { tipo: digitos(proc).length >= 15 && dataOk(l.fatal) ? 'prazo' : 'tarefa', titulo: tit, processo: proc2, cliente: txt(l.cliente) || await clienteDoProcesso(env, proc), data: dataOk(l.fatal), hora: '', trabalhar: dataOk(l.interno), situacao: 'afazer', concluido: false, avisos: [5, 2, 1, 0], resp: [], criadoEm: new Date().toISOString() };
      const c = camposPlanilha(l); aplicarNoDoc(d, COLUNAS, l, ctx);
      d.plan = { id: novoPid, base: baseDe(c), statusRaw: txt(l.status), ult: new Date().toISOString(), origem: 'planilha' };
      if (!d.data) d.data = '';
      salvar(idDoc, null, d, 'criou'); resp.ids.push({ linha: l.linha, id: novoPid }); ligadas++; continue;
    }
    const { id: idDoc, d } = achado, antes = JSON.parse(JSON.stringify(d)), s = camposPlanilha(l), a = camposApp(d, ctx), base = (d.plan && d.plan.base) || s;
    const paraApp = [], paraPlan = []; let conflito = '';
    for (const f of COLUNAS) {
      if (s[f] === a[f]) continue;
      if (a[f] === base[f]) paraApp.push(f);                 // só a planilha mudou
      else if (s[f] === base[f]) paraPlan.push(f);           // só o app mudou
      else { paraApp.push(f); conflito = conflito || f; }    // os dois: vale a planilha
    }
    ligadas++;
    if (d.plan && d.plan.removida) { delete d.plan.removida; }
    if (paraApp.length) {
      aplicarNoDoc(d, paraApp, l, ctx);
      if (conflito) { d.plan.conflito = { campo: conflito, em: new Date().toISOString() }; conflitos++; }
    } else if (l.interno && dataOk(l.interno) && d.trabalhar !== dataOk(l.interno)) d.trabalhar = dataOk(l.interno);
    const nb = { ...base };
    const c = camposPlanilha(l);
    for (const f of COLUNAS) nb[f] = paraPlan.includes(f) ? base[f] : (paraApp.includes(f) ? c[f] : (s[f] === a[f] ? s[f] : base[f]));
    d.plan.base = nb; d.plan.statusRaw = txt(l.status) || d.plan.statusRaw || ''; d.plan.ult = new Date().toISOString();
    if (paraPlan.length) resp.aplicar.push({ id: pid, campos: valoresParaPlanilha(d, paraPlan, ctx, d.plan.statusRaw) });
    if (JSON.stringify(antes) !== JSON.stringify(d)) salvar(idDoc, antes, d, 'alterou');
  }

  /* itens do app ligados a uma linha que não veio mais: arquivada (já concluída) ou removida à mão */
  if (corpo.completo && (linhasTodas.length > 0 || ![...porPlan.values()].length)) {
    for (const [pid, { id: idDoc, d }] of porPlan) {
      if (vistosIds.has(pid) || (d.plan && d.plan.pendente)) continue;
      const antes = JSON.parse(JSON.stringify(d));
      if (semDoc(d) === 'feito') continue;
      if (semRaw(d.plan.statusRaw || '') === 'feito') Object.assign(d, statusParaDoc('Concluída'), { concluidoEm: hoje() });   // arquivada pelo menu da planilha (já estava concluída)
      else if (!d.plan.removida) { d.plan.removida = true; removidas++; }
      else continue;
      salvar(idDoc, antes, d, 'alterou');
    }
  }
  /* itens criados no app e ainda sem linha (ou com linha ainda não vista) */
  for (const { id: idDoc, d } of itens) {
    if (d.planilha !== true) continue;
    if (d.plan && d.plan.id && vistosIds.has(d.plan.id)) { if (d.plan.pendente) { const antes = JSON.parse(JSON.stringify(d)); delete d.plan.pendente; salvar(idDoc, antes, d, 'alterou'); } continue; }
    if (semDoc(d) === 'feito') continue;
    const antes = JSON.parse(JSON.stringify(d));
    if (!d.plan) d.plan = { id: 'h-' + aleat(6), base: {}, statusRaw: '', ult: new Date().toISOString(), origem: 'app', pendente: true };
    if (!d.delegadoPor) { const a = camposApp(d, ctx); d.delegadoPor = a._delegado; }
    const ca = camposApp(d, ctx); d.plan.base = baseDe(ca); d.plan.statusRaw = rotuloDoDoc(d, '');
    resp.novas.push({ id: d.plan.id, campos: valoresParaPlanilha(d, COLUNAS, ctx, '') });
    if (JSON.stringify(antes) !== JSON.stringify(d)) { stmts.push(stmtDoc(env, 'agenda', idDoc, d)); }
  }
  cfg.importacaoFeita = true; cfg.ultimaConversa = new Date().toISOString(); cfg.ultimaErro = ''; cfg.contagem = { ligadas, conflitos, removidas, pendentesApp: resp.aplicar.length + resp.novas.length };
  cfg.planilha = txt(corpo.planilha) || cfg.planilha || '';
  stmts.push(stmtDoc(env, COL, 'config', cfg));
  for (let i = 0; i < stmts.length; i += 50) await env.DB.batch(stmts.slice(i, i + 50));
  for (const av of avisos) await avisarAtividade(env, deps.enviarAviso, { ...av, auth: { usuario: { id: '', nome: (av.depois.delegadoPor || 'Planilha') } } });
  return resp;
}

/* rota pública /api/planilha-sync (chave no cabeçalho; GET ?ping=1 é só uma pergunta barata "há algo do app para a planilha?") */
export async function planilhaSync(request, env, deps) {
  const cfg = await cfgLer(env), m = /^Bearer (.+)$/.exec(request.headers.get('authorization') || '');
  if (!cfg.token || !m || !iguais(m[1], cfg.token)) return erro(401, 'not_granted', 'Chave inválida.');
  try {
    if (request.method === 'GET') {
      const us = await usuariosAtivos(env); const ctx = { mapa: cfg.nomes, us };
      return json({ ok: true, pendente: pendenciasDoApp(await itensAgenda(env), ctx) > 0 });
    }
    if (request.method !== 'POST') return erro(405, 'method', 'Método não permitido.');
    const txtCorpo = await request.text(); if (txtCorpo.length > 3e6) return erro(413, 'too_large', 'Pedido grande demais.');
    const corpo = JSON.parse(txtCorpo);
    return json(await sincronizar(env, deps, corpo, cfg));
  } catch (e) {
    console.error('planilha', e); cfg.ultimaErro = String(e && e.message || e).slice(0, 200); cfg.ultimaTentativa = new Date().toISOString(); await cfgGravar(env, cfg).catch(() => {});
    return erro(500, 'server', 'Erro ao sincronizar.');
  }
}

/* ---------- rotas da sessão: /api/planilha ---------- */
export async function planilhaRotas(request, env, partes, auth) {
  const m = request.method, ehDono = !auth || !auth.usuario || auth.usuario.papel === 'proprietario';
  const cfg = await cfgLer(env);
  if (m === 'GET' && partes[1] === 'ligada') return json({ ligada: !!cfg.token && !!cfg.ultimaConversa });   // qualquer pessoa logada (o editor da Agenda usa)
  if (!ehDono) return erro(403, 'forbidden', 'Só o proprietário pode usar isto.');
  const origem = new URL(request.url).origin;
  if (m === 'GET' && !partes[1]) {
    const us = await usuariosAtivos(env), opcoes = us.map((u) => ({ chave: chaveDe(u), nome: u.nome, papel: u.norm.papel }));
    const nomes = (cfg.vistos.length ? cfg.vistos : []).map((n) => ({ planilha: n, chave: cfg.nomes[n] || '', usuario: cfg.nomes[n] ? (opcoes.find((o) => o.chave === cfg.nomes[n]) || null) : null, funcao: ((cfg.integrantes || []).find((x) => x.nome === n) || {}).funcao || '' }));
    const itens = await itensAgenda(env);
    return json({ ligada: !!cfg.token, conectada: !!cfg.ultimaConversa, planilha: cfg.planilha || '', ultimaConversa: cfg.ultimaConversa || '', ultimaTentativa: cfg.ultimaTentativa || '', erro: cfg.ultimaErro || '', contagem: { ...(cfg.contagem || {}), ligadas: itens.filter((x) => x.d.plan && x.d.plan.id && !x.d.plan.removida && semDoc(x.d) !== 'feito').length }, nomes, opcoes, origem });
  }
  if (m === 'POST' && partes[1] === 'ligar') { if (!cfg.token) { cfg.token = b64u(crypto.getRandomValues(new Uint8Array(24))); cfg.ligadoEm = new Date().toISOString(); await cfgGravar(env, cfg); } return json({ ok: true }); }
  if (m === 'POST' && partes[1] === 'novachave') { cfg.token = b64u(crypto.getRandomValues(new Uint8Array(24))); cfg.ultimaConversa = ''; await cfgGravar(env, cfg); return json({ ok: true }); }
  if (m === 'POST' && partes[1] === 'desligar') { delete cfg.token; cfg.ultimaConversa = ''; await cfgGravar(env, cfg); return json({ ok: true }); }
  if (m === 'PUT' && partes[1] === 'nomes') {
    const c = await request.json().catch(() => null); if (!c || typeof c.mapa !== 'object') return erro(400, 'invalid', 'Mapa inválido.');
    const us = await usuariosAtivos(env), validas = new Set(us.map(chaveDe));
    for (const [n, chave] of Object.entries(c.mapa)) { if (!cfg.vistos.includes(n)) continue; if (chave === '') cfg.nomes[n] = ''; else if (validas.has(chave)) cfg.nomes[n] = chave; }
    await cfgGravar(env, cfg);
    /* os itens já ligados passam a ter (ou perder) o responsável do app conforme o novo mapa */
    const itens = await itensAgenda(env), stmts = [];
    for (const { id, d } of itens) {
      if (!d.plan || !d.respNome) continue;
      const chave = cfg.nomes[d.respNome] || ''; const novo = chave ? [chave] : [];
      if (JSON.stringify(d.resp || []) !== JSON.stringify(novo)) { const dd = { ...d, resp: novo }; stmts.push(stmtDoc(env, 'agenda', id, dd)); }
    }
    for (let i = 0; i < stmts.length; i += 50) await env.DB.batch(stmts.slice(i, i + 50));
    return json({ ok: true, atualizados: stmts.length });
  }
  if (m === 'GET' && partes[1] === 'script') {
    if (!cfg.token) return erro(409, 'conflict', 'Ligue a planilha primeiro.');
    return new Response(scriptTexto(origem, cfg.token), { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
  }
  return erro(404, 'not_found', 'Não encontrado.');
}

/* ---------- o script que vai dentro da planilha (Extensões › Apps Script) ---------- */
export function scriptTexto(origem, token) {
  return `/* Horus · ligação da planilha "Controle de Petições e Tarefas" com o app (duas vias).
   Gerado pelo próprio app. NÃO compartilhe este texto: ele contém a chave secreta da ligação.
   Como usar: cole tudo em Extensões › Apps Script, salve, escolha a função "ligarAoHorus" e clique em Executar (autorize quando pedir). */
var HORUS_URL = '${origem}/api/planilha-sync';
var HORUS_CHAVE = '${token}';
var ABA = 'Controle', PRIMEIRA = 4, COLUNAS = 17;   // A..Q (P = ID Horus, Q = Atualizado em)

function ligarAoHorus() {
  var ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName(ABA);
  if (!sh) { SpreadsheetApp.getUi().alert('Não achei a aba "' + ABA + '".'); return; }
  sh.getRange('O3').copyTo(sh.getRange('P3:Q3'), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
  sh.getRange('P3').setValue('ID Horus'); sh.getRange('Q3').setValue('Atualizado em');
  sh.setColumnWidth(16, 90); sh.setColumnWidth(17, 120);
  var pr = sh.getRange(PRIMEIRA, 16, sh.getMaxRows() - PRIMEIRA + 1, 2).protect().setDescription('Colunas do Horus: não digitar');
  pr.setWarningOnly(true);
  ScriptApp.getProjectTriggers().forEach(function (t) { var f = t.getHandlerFunction(); if (f === 'sincronizarHorus' || f === 'aoEditarHorus') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('sincronizarHorus').timeBased().everyMinutes(1).create();
  ScriptApp.newTrigger('aoEditarHorus').forSpreadsheet(ss).onEdit().create();
  sincronizarHorus({ forcar: true });
  SpreadsheetApp.getUi().alert('Ligado ao Horus. A planilha e o app agora conversam sozinhos (pode fechar esta janela).');
}

function aoEditarHorus(e) { if (e && e.range && e.range.getSheet().getName() === ABA) sincronizarHorus({ forcar: true }); }

function sincronizarHorus(op) {
  op = op || {};
  var lock = LockService.getScriptLock(); if (!lock.tryLock(25000)) return;
  try {
    var props = PropertiesService.getScriptProperties(), agora = Date.now(), ult = Number(props.getProperty('ultimaCompleta') || 0);
    if (!op.forcar && agora - ult < 5 * 60000) {   // a cada minuto só pergunta se há algo do app; a leitura completa é de 5 em 5 minutos ou ao editar
      var p = UrlFetchApp.fetch(HORUS_URL, { method: 'get', headers: { Authorization: 'Bearer ' + HORUS_CHAVE }, muteHttpExceptions: true });
      if (p.getResponseCode() !== 200 || !JSON.parse(p.getContentText()).pendente) return;
    }
    var sh = SpreadsheetApp.getActive().getSheetByName(ABA), tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
    var corpo = { versao: 1, planilha: SpreadsheetApp.getActive().getName(), completo: true, integrantes: integrantes_(), linhas: lerLinhas_(sh, tz) };
    var r = UrlFetchApp.fetch(HORUS_URL, { method: 'post', contentType: 'application/json', headers: { Authorization: 'Bearer ' + HORUS_CHAVE }, payload: JSON.stringify(corpo), muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) { console.error('Horus respondeu ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 200)); return; }
    props.setProperty('ultimaCompleta', String(agora));
    var resp = JSON.parse(r.getContentText()), carimbo = Utilities.formatDate(new Date(), tz, 'dd/MM HH:mm');
    (resp.ids || []).forEach(function (x) { sh.getRange(x.linha, 16, 1, 2).setValues([[x.id, carimbo]]); });
    var mapa = mapaIds_(sh);
    (resp.aplicar || []).forEach(function (x) { var linha = mapa[x.id]; if (linha) escrever_(sh, linha, x.campos, carimbo); });
    (resp.novas || []).forEach(function (x) { if (mapa[x.id]) return; var linha = proximaLinha_(sh); sh.getRange(linha, 16, 1, 2).setValues([[x.id, carimbo]]); escrever_(sh, linha, x.campos, carimbo); mapa[x.id] = linha; });
  } catch (err) { console.error('Horus: ' + err); } finally { lock.releaseLock(); }
}

function integrantes_() {
  var sh = SpreadsheetApp.getActive().getSheetByName('Listas'); if (!sh) return [];
  return sh.getRange('A2:B9').getValues().filter(function (l) { return l[0] && l[0] !== 'Todos' && String(l[0]).indexOf('Como editar') < 0; }).map(function (l) { return { nome: String(l[0]).trim(), funcao: String(l[1] || '').trim() }; });
}
function data_(v, tz) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  var m = /^(\\d{1,2})\\/(\\d{1,2})\\/(\\d{4})$/.exec(String(v).trim()); return m ? m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2) : '';
}
function ultimaLinha_(sh) {
  var v = sh.getRange(PRIMEIRA, 3, sh.getMaxRows() - PRIMEIRA + 1, 1).getValues(), u = PRIMEIRA - 1;
  for (var i = v.length - 1; i >= 0; i--) if (String(v[i][0]).trim() !== '') { u = PRIMEIRA + i; break; }
  return u;
}
function proximaLinha_(sh) { return ultimaLinha_(sh) + 1; }
function lerLinhas_(sh, tz) {
  var ult = ultimaLinha_(sh); if (ult < PRIMEIRA) return [];
  var rg = sh.getRange(PRIMEIRA, 1, ult - PRIMEIRA + 1, COLUNAS), v = rg.getValues(), f = sh.getRange(PRIMEIRA, 11, ult - PRIMEIRA + 1, 1).getFormulas(), out = [];
  for (var i = 0; i < v.length; i++) {
    var l = v[i];
    out.push({ linha: PRIMEIRA + i, cliente: String(l[0]), processo: String(l[1]), titulo: String(l[2]), resp: String(l[3]).trim(), delegado: String(l[4]).trim(), prio: String(l[5]).trim(), status: String(l[6]).trim(),
      fatal: data_(l[11], tz), interno: data_(l[12], tz), fixa: String(f[i][0] || '').charAt(0) === '=', obs: String(l[14]), id: String(l[15]).trim() });
  }
  return out;
}
function mapaIds_(sh) {
  var ult = ultimaLinha_(sh), m = {}; if (ult < PRIMEIRA) return m;
  sh.getRange(PRIMEIRA, 16, ult - PRIMEIRA + 1, 1).getValues().forEach(function (l, i) { var id = String(l[0]).trim(); if (id) m[id] = PRIMEIRA + i; });
  return m;
}
function escrever_(sh, linha, c, carimbo) {
  if (c.processo !== undefined) sh.getRange(linha, 2).setValue(c.processo);
  if (c.titulo !== undefined) sh.getRange(linha, 3).setValue(c.titulo);
  if (c.resp !== undefined) sh.getRange(linha, 4).setValue(c.resp);
  if (c.delegado !== undefined) sh.getRange(linha, 5).setValue(c.delegado);
  if (c.prio !== undefined) sh.getRange(linha, 6).setValue(c.prio);
  if (c.status !== undefined) sh.getRange(linha, 7).setValue(c.status);
  if (c.obs !== undefined) sh.getRange(linha, 15).setValue(c.obs);
  if (c.fatalManual !== undefined) {   // não sobrescreve uma fórmula (ex.: tarefa fixa semanal)
    var k = sh.getRange(linha, 11);
    if (String(k.getFormula() || '').charAt(0) !== '=') { if (c.fatalManual) { var p = c.fatalManual.split('-'); k.setValue(new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]))); } else k.clearContent(); }
  }
  sh.getRange(linha, 17).setValue(carimbo);
}
`;
}
