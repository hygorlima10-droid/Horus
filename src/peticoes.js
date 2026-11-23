/* Petição para correção/revisão (aba Iniciais) — arquivos no R2, controle no banco.
   Tudo passa por /api/peticoes/…: o servidor é quem decide o estado (ninguém grava o estado pela API genérica).
   Os registros ficam em `_peticoes` (reservada: fora da API genérica e do backup; os arquivos do R2 também não entram no backup).

   Estados:  a_corrigir  → está com o revisor
             devolvida   → o revisor comentou e devolveu para quem fez a Inicial
             aprovada    → o revisor aprovou (a Inicial vai para "Aguardando protocolo")
             protocolada → a Inicial foi protocolada; só a versão final fica guardada

   Rotas (todas exigem sessão):
     GET    /api/peticoes                      lista as petições que a pessoa pode ver
     GET    /api/peticoes/uso                  consumo do plano gratuito do R2 (armazenamento e operações do mês)
     GET    /api/peticoes/revisores            quem pode ser escolhido como revisor
     POST   /api/peticoes/enviar/<casoId>?nome=&revisor=&prazo=&recado=   corpo = o arquivo (.docx ou .pdf, até 25 MB): cria a petição ou manda nova versão
     GET    /api/peticoes/<id>/arquivo?v=<n>   baixa a versão
     POST   /api/peticoes/<id>/comentar        { texto, ancora? }   (só o revisor; ancora = trecho do texto)
     POST   /api/peticoes/<id>/resolver        { comentario, acao: propor | resolver | reabrir }   (autor propõe, revisor confirma)
     POST   /api/peticoes/<id>/devolver        { texto? }       (revisor)
     POST   /api/peticoes/<id>/aprovar         (revisor)
     POST   /api/peticoes/<id>/reencaminhar    { revisor }      (quem fez a Inicial)
     DELETE /api/peticoes/<id>                 (quem fez a Inicial ou o proprietário, antes de protocolar) */
import { COL_USU } from './acesso.js';
import { stmtRegistro } from './auditoria.js';
import { participa, ehDono, normalizarUsuario, escopoDoAdvogado, podeVer } from './politica.js';

const COL = '_peticoes', ID_USO = '_uso';
export const MAX_ARQUIVO = 25 * 1024 * 1024;
const LIM = { bytes: 10 * 1024 ** 3, classeA: 1_000_000, classeB: 10_000_000 };   // plano gratuito do R2 (mês)
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const erro = (status, code, message) => json({ error: { code, message } }, status);
const NOME_COL_PROT = 'aguardando protocolo';
const COLUNAS_NOVAS = [{ id: 'a_corrigir', label: 'A corrigir', alerta: true }, { id: 'devolvida', label: 'Devolvida para ajustes', alerta: true }];
const COLUNA_PROTOCOLO = { id: 'aguardando_protocolo', label: 'Aguardando protocolo', alerta: false };   // só é criada se o escritório ainda não tiver uma coluna com esse nome
const PADRAO = [{ id: 'pendente', label: 'Pendente', alerta: false }, { id: 'aguardando_documentacao', label: 'Aguardando documentação', alerta: true }, { id: 'aguardando_cliente', label: 'Aguardando cliente', alerta: true }, { id: 'protocolado', label: 'Protocolado', alerta: false }];
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const aleat = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, '0')).join('');
const mesAtual = () => new Date().toISOString().slice(0, 7);
const eu = (auth) => (auth && auth.usuario ? { id: auth.usuario.id || '', nome: auth.usuario.nome || 'Você' } : { id: '', nome: 'Você' });
const mesmo = (a, id) => !!a && !!id && a.id === id;

async function lerPet(env, id) { const r = await env.DB.prepare('SELECT dados FROM docs WHERE colecao = ? AND id = ?').bind(COL, id).first(); return r ? JSON.parse(r.dados) : null; }
const stmtPet = (env, p) => env.DB.prepare('INSERT INTO docs (colecao,id,dados,atualizado) VALUES (?,?,?,?) ON CONFLICT(colecao,id) DO UPDATE SET dados=excluded.dados, atualizado=excluded.atualizado').bind(COL, p.id, JSON.stringify(p), Date.now());
async function todas(env) { const { results } = await env.DB.prepare('SELECT dados FROM docs WHERE colecao = ? AND id != ?').bind(COL, ID_USO).all(); return results.map((r) => JSON.parse(r.dados)); }
async function lerCaso(env, id) { const r = await env.DB.prepare("SELECT dados FROM docs WHERE colecao = 'casos' AND id = ?").bind(String(id)).first(); return r ? JSON.parse(r.dados) : null; }

/* ---------- consumo do plano gratuito ---------- */
async function lerUso(env) { const r = await env.DB.prepare('SELECT dados FROM docs WHERE colecao = ? AND id = ?').bind(COL, ID_USO).first(); const u = r ? JSON.parse(r.dados) : {}; return u.mes === mesAtual() ? u : { mes: mesAtual(), classeA: 0, classeB: 0, avisos: {} }; }
export async function somarOp(env, campo, n = 1) {
  const u = await lerUso(env); u[campo] = (u[campo] || 0) + n;
  await env.DB.prepare('INSERT INTO docs (colecao,id,dados,atualizado) VALUES (?,?,?,?) ON CONFLICT(colecao,id) DO UPDATE SET dados=excluded.dados, atualizado=excluded.atualizado').bind(COL, ID_USO, JSON.stringify(u), Date.now()).run();
  return u;
}
/* o limite gratuito do R2 foi atingido? (vale também para os extratos recebidos pelo Atalho) */
export async function r2Bloqueado(env) { return calcularUso(await todas(env), await lerUso(env)).bloqueado; }
export function calcularUso(lista, uso) {
  let bytes = 0, arquivos = 0;
  for (const p of lista) for (const v of p.versoes || []) { bytes += v.tam || 0; arquivos++; }
  const pct = { bytes: bytes / LIM.bytes, classeA: (uso.classeA || 0) / LIM.classeA, classeB: (uso.classeB || 0) / LIM.classeB };
  const maior = Math.max(pct.bytes, pct.classeA, pct.classeB);
  const nivel = maior >= 1 ? 'bloqueado' : maior >= 0.95 ? 'critico' : maior >= 0.8 ? 'atencao' : 'ok';
  const qual = pct.bytes >= pct.classeA && pct.bytes >= pct.classeB ? 'armazenamento' : (pct.classeA >= pct.classeB ? 'gravacoes' : 'leituras');
  return { mes: uso.mes, bytes, arquivos, limiteBytes: LIM.bytes, classeA: uso.classeA || 0, limiteA: LIM.classeA, classeB: uso.classeB || 0, limiteB: LIM.classeB, pct: Math.round(maior * 1000) / 10, nivel, qual, bloqueado: nivel === 'bloqueado', maxArquivo: MAX_ARQUIVO };
}


/* ---------- tarefas em Delegadas (só quando quem fez a Inicial é ESTAGIÁRIO; advogado e proprietário usam a Central de atenção) ----------
   Uma linha por petição e por etapa (id fixo): "ajuste" (devolvida para ajustes) e "protocolo" (aprovada). Conclui sozinha ao reenviar a versão,
   ao aprovar (o ajuste), ao protocolar a Inicial (o protocolo); some se a petição é apagada. */
const hojeISO = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
async function usuarioDe(env, id) { if (!id) return null; const r = await env.DB.prepare('SELECT dados FROM docs WHERE colecao = ? AND id = ?').bind(COL_USU, id).first(); return r ? { id, ...JSON.parse(r.dados) } : null; }
const chaveDe = (u) => { const n = normalizarUsuario(u); return n.papel === 'estagiario' ? 'u:' + u.id : (n.oabs[0] || 'n:' + String(u.nome || '').slice(0, 60)); };
const primeiroNome = (n) => String(n || '').replace(/^(dr|dra)\.?\s+/i, '').split(/\s+/)[0] || 'o revisor';
const plural = (n, a, b) => n + ' ' + (n === 1 ? a : b);
async function tarefasDaPeticao(env, petId, etapa) {
  const { results } = await env.DB.prepare("SELECT id, dados FROM docs WHERE colecao = 'delegadas' AND json_extract(dados, '$.peticaoId') = ?").bind(petId).all();
  return results.map((r) => ({ id: r.id, d: JSON.parse(r.dados) })).filter((x) => !etapa || x.d.etapa === etapa);
}
async function abrirTarefa(env, p, etapa) {
  const autor = await usuarioDe(env, p.criadoPor.id); if (!autor || normalizarUsuario(autor).papel !== 'estagiario') return;
  const rev = await usuarioDe(env, p.revisor.id), caso = await lerCaso(env, p.casoId) || {}, nomeRev = primeiroNome(p.revisor.nome);
  const v = p.versoes[p.versoes.length - 1].n, nCom = p.comentarios.filter((c) => c.papel === 'revisor' && c.v === v).length;
  const titulo = etapa === 'ajuste' ? 'Ajustar petição (' + plural(nCom, 'comentário', 'comentários') + ' de ' + nomeRev + ')' : 'Protocolar petição aprovada (' + nomeRev + ' aprovou)';
  const obs = (etapa === 'ajuste' ? p.revisor.nome + ' revisou a petição e devolveu com ' + plural(nCom, 'comentário', 'comentários') + '. ' : p.revisor.nome + ' aprovou a petição. ') + 'Abra o botão "Abrir petição" (ou Iniciais › cartão › Petição para revisão).' + (etapa === 'protocolo' ? ' Ao protocolar, mova a Inicial para Protocolado informando o número do processo.' : '');
  const id = (etapa === 'ajuste' ? 'pt-aj-' : 'pt-pr-') + p.id, antes = (await tarefasDaPeticao(env, p.id, etapa)).find((x) => x.id === id), agora = new Date().toISOString();
  const doc = { ...(antes ? antes.d : {}), titulo, cliente: p.cliente, clienteId: (caso.clienteIds && caso.clienteIds[0]) || '', processo: caso.numeroProcesso || '', resp: (antes && antes.d.resp) || 'u:' + p.criadoPor.id, delegadoPor: rev ? chaveDe(rev) : '', prioridade: (antes && antes.d.prioridade) || 'Alta', status: 'afazer', trabalhar: '', fatal: p.prazo || '', obs, peticaoId: p.id, casoId: p.casoId, etapa, auto: true, concluidoEm: '', concluidoPor: '', criadoPor: (antes && antes.d.criadoPor) || p.revisor.id, criadoEm: (antes && antes.d.criadoEm) || agora, atualizadoEm: agora };
  await env.DB.prepare('INSERT INTO docs (colecao,id,dados,atualizado) VALUES (?,?,?,?) ON CONFLICT(colecao,id) DO UPDATE SET dados=excluded.dados, atualizado=excluded.atualizado').bind('delegadas', id, JSON.stringify(doc), Date.now()).run();
}
async function concluirTarefas(env, petId, etapa) {
  for (const t of await tarefasDaPeticao(env, petId, etapa)) {
    if (t.d.status === 'concluida' || t.d.status === 'protocolada') continue;
    const d = { ...t.d, status: 'concluida', concluidoEm: hojeISO(), concluidoPor: t.d.resp || '', atualizadoEm: new Date().toISOString() };
    await env.DB.prepare('UPDATE docs SET dados = ?, atualizado = ? WHERE colecao = ? AND id = ?').bind(JSON.stringify(d), Date.now(), 'delegadas', t.id).run();
  }
}
/* petições que já estavam devolvidas/aprovadas antes das linhas automáticas (ou cuja linha faltou): cria a que falta, uma vez só */
async function sincronizarTarefas(env, lista) {
  const pend = lista.filter((p) => p.estado === 'devolvida' || p.estado === 'aprovada'); if (!pend.length) return;
  const { results } = await env.DB.prepare("SELECT dados FROM docs WHERE colecao = 'delegadas' AND json_extract(dados, '$.peticaoId') IS NOT NULL").all();
  const tem = new Set(results.map((r) => { const d = JSON.parse(r.dados); return d.peticaoId + '|' + d.etapa; }));
  for (const p of pend) {
    if (p.estado === 'devolvida' && !tem.has(p.id + '|ajuste')) await abrirTarefa(env, p, 'ajuste');
    if (p.estado === 'aprovada' && !tem.has(p.id + '|protocolo')) await abrirTarefa(env, p, 'protocolo');
  }
}
async function apagarTarefasAuto(env, petId) {
  for (const t of await tarefasDaPeticao(env, petId)) if (t.d.auto === true) await env.DB.prepare("DELETE FROM docs WHERE colecao = 'delegadas' AND id = ?").bind(t.id).run();
}

/* ---------- colunas do quadro de Iniciais ---------- */
async function lerConfigPers(env) { const r = await env.DB.prepare("SELECT dados FROM docs WHERE colecao = 'config' AND id = 'personalizacao'").first(); return r ? JSON.parse(r.dados) : {}; }
/* garante "A corrigir" e "Devolvida para ajustes" no quadro, antes de "Aguardando protocolo" (ou de "Protocolado") */
export async function garantirColunas(env) {
  const p = await lerConfigPers(env);
  let cols = Array.isArray(p.colunasPeticao) && p.colunasPeticao.length ? p.colunasPeticao.slice() : PADRAO.map((c) => ({ ...c }));
  let mudou = false;
  if (!cols.some((c) => norm(c.label) === NOME_COL_PROT)) { let i = cols.findIndex((c) => c.id === 'protocolado'); if (i < 0) i = cols.length; cols.splice(i, 0, { ...COLUNA_PROTOCOLO }); mudou = true; }
  for (const nova of COLUNAS_NOVAS) {
    if (cols.some((c) => c && c.id === nova.id)) continue;
    let i = cols.findIndex((c) => norm(c.label) === NOME_COL_PROT); if (i < 0) i = cols.findIndex((c) => c.id === 'protocolado'); if (i < 0) i = cols.length;
    cols.splice(i, 0, { ...nova }); mudou = true;
  }
  if (mudou) { p.colunasPeticao = cols; await env.DB.prepare("INSERT INTO docs (colecao,id,dados,atualizado) VALUES ('config','personalizacao',?,?) ON CONFLICT(colecao,id) DO UPDATE SET dados=excluded.dados, atualizado=excluded.atualizado").bind(JSON.stringify(p), Date.now()).run(); }
  return cols;
}
const colunaProtocolo = (cols) => (cols.find((c) => norm(c.label) === NOME_COL_PROT) || {}).id;
async function moverCaso(env, casoId, status, auth, extra) {
  const caso = await lerCaso(env, casoId); if (!caso || caso.status === status) return;
  const antes = caso.status || '';
  const novo = { ...caso, status, statusDesde: new Date().toISOString(), ...(extra || {}) };
  const a = eu(auth);
  await env.DB.batch([
    env.DB.prepare('INSERT INTO docs (colecao,id,dados,atualizado) VALUES (?,?,?,?) ON CONFLICT(colecao,id) DO UPDATE SET dados=excluded.dados, atualizado=excluded.atualizado').bind('casos', String(casoId), JSON.stringify(novo), Date.now()),
    stmtRegistro(env, { op: 'alterou', por: a.nome, uid: a.id, colecao: 'casos', id: String(casoId), titulo: String(caso.cliente || '').slice(0, 90), mud: [{ c: 'status', a: antes, d: status }], dados: novo }),
  ]);
}

/* ---------- quem vê / quem pode ---------- */
async function podeVerPet(env, auth, p) {
  if (ehDono(auth)) return true;
  const u = normalizarUsuario(auth.usuario);
  if (u.papel === 'estagiario') return true;   // estagiário vê as petições do escritório (inclusive de outros estagiários)
  if (mesmo(p.criadoPor, u.id) || mesmo(p.revisor, u.id)) return true;
  const caso = await lerCaso(env, p.casoId); if (!caso) return false;
  return participa(auth, caso);
}
const souAutor = (auth, p) => ehDono(auth) || mesmo(p.criadoPor, eu(auth).id);
const souRevisor = (auth, p) => ehDono(auth) || mesmo(p.revisor, eu(auth).id);
async function revisoresValidos(env) {
  const { results } = await env.DB.prepare('SELECT id, dados FROM docs WHERE colecao = ?').bind(COL_USU).all();
  return results.map((r) => ({ id: r.id, ...JSON.parse(r.dados) })).filter((u) => u.ativo !== false && ['advogado', 'proprietario'].includes(u.papel)).map((u) => ({ id: u.id, nome: String(u.nome || '').slice(0, 80), papel: u.papel })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}
function vista(p, auth) {
  const f = (v) => ({ n: v.n, nome: v.nome, tam: v.tam, tipo: v.tipo, por: v.por, em: v.em });
  return { id: p.id, casoId: p.casoId, titulo: p.titulo, cliente: p.cliente, estado: p.estado, criadoPor: p.criadoPor, revisor: p.revisor, criadoEm: p.criadoEm, atualizadoEm: p.atualizadoEm, enviadaEm: p.enviadaEm, prazo: p.prazo || '', versoes: (p.versoes || []).map(f), comentarios: p.comentarios || [], eventos: (p.eventos || []).slice(-40), souAutor: souAutor(auth, p), souRevisor: souRevisor(auth, p) };
}
function aviso(env, deps, uid, titulo, corpo, tag) { if (!deps || !deps.enviarAviso || !uid) return Promise.resolve(); return deps.enviarAviso(env, { tag, titulo, corpo, url: '/' }, uid).catch((e) => console.error('aviso da petição', e)); }
const evento = (p, auth, txt) => { (p.eventos = p.eventos || []).push({ em: new Date().toISOString(), por: eu(auth).nome, txt }); };
const tipoDe = (nome, bytes) => {
  const ext = (String(nome).toLowerCase().match(/\.(docx|pdf)$/) || [])[1]; if (!ext) return '';
  const b = new Uint8Array(bytes.slice(0, 5));
  if (ext === 'pdf' && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'pdf';
  if (ext === 'docx' && b[0] === 0x50 && b[1] === 0x4b && b[2] === 3 && b[3] === 4) return 'docx';
  return '';
};
const MIME = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
const limparNome = (s) => String(s || 'peticao').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 120);

/* petição aprovada cuja Inicial já foi protocolada: guarda só a última versão e libera o espaço */
async function fecharProtocoladas(env, lista) {
  for (const p of lista) {
    if (p.estado !== 'aprovada') continue;
    const caso = await lerCaso(env, p.casoId); if (!caso || caso.status !== 'protocolado') continue;
    const ult = p.versoes[p.versoes.length - 1], antigas = p.versoes.slice(0, -1);
    if (antigas.length) { await env.ARQUIVOS.delete(antigas.map((v) => v.chave)); await somarOp(env, 'classeA', antigas.length); }
    p.versoes = [ult]; p.estado = 'protocolada'; p.atualizadoEm = new Date().toISOString();
    (p.eventos = p.eventos || []).push({ em: p.atualizadoEm, por: 'Horus', txt: 'Inicial protocolada: ficou guardada só a versão final.' });
    await stmtPet(env, p).run(); await concluirTarefas(env, p.id, 'protocolo');
  }
}

/* âncora de um comentário no texto: só números e textos curtos, nada além do necessário */
function limparAncora(a) {
  if (!a || typeof a !== 'object') return null;
  const inteiro = (x, max) => (Number.isInteger(x) && x >= 0 && x <= max ? x : null);
  const p = inteiro(a.p, 20000), ini = inteiro(a.ini, 100000), fim = inteiro(a.fim, 100000), quote = typeof a.quote === 'string' ? a.quote.slice(0, 600) : '';
  if (p === null || ini === null || fim === null || fim <= ini || !quote.trim()) return null;
  const o = { p, ini, fim, quote, antes: String(a.antes || '').slice(0, 40), depois: String(a.depois || '').slice(0, 40), paragrafo: String(a.paragrafo || '').slice(0, 1500) };
  if (Number.isInteger(a.pag) && a.pag >= 1 && a.pag <= 5000) o.pag = a.pag;   // PDF: página
  if (a.pagina === true) o.pagina = true;   // comentário da página inteira (PDF escaneado)
  return o;
}

export async function peticoesRotas(request, env, partes, auth, deps) {
  if (!env.ARQUIVOS) return erro(503, 'sem_r2', 'O armazenamento de arquivos (R2) ainda não está ligado.');
  const m = request.method, sub = partes[1] || '';
  if (sub === '' && m === 'GET') {
    const lista = await todas(env); await fecharProtocoladas(env, lista);
    try { await sincronizarTarefas(env, lista); } catch (e) { console.error('tarefas das petições', e); }
    const vis = []; for (const p of lista) if (await podeVerPet(env, auth, p)) vis.push(vista(p, auth));
    vis.sort((a, b) => String(b.atualizadoEm).localeCompare(String(a.atualizadoEm)));
    return json({ itens: vis, uso: calcularUso(lista, await lerUso(env)) });
  }
  if (sub === 'uso' && m === 'GET') { const lista = await todas(env); return json(calcularUso(lista, await lerUso(env))); }
  if (sub === 'revisores' && m === 'GET') return json({ revisores: await revisoresValidos(env) });

  /* ----- enviar (nova petição ou nova versão) ----- */
  if (sub === 'enviar' && m === 'POST') {
    const casoId = partes[2]; if (!casoId) return erro(400, 'invalid', 'Falta a Inicial.');
    const caso = await lerCaso(env, casoId); if (!caso || caso.tipo !== 'inicial') return erro(404, 'not_found', 'Inicial não encontrada.');
    const esc = !ehDono(auth) && auth.usuario.papel === 'advogado' ? await escopoDoAdvogado(env, auth) : null;
    if (!podeVer('casos', caso, auth, esc)) return erro(403, 'forbidden', 'Você não tem acesso a esta Inicial.');
    const url = new URL(request.url), nome = limparNome(url.searchParams.get('nome') || '');
    const tam = Number(request.headers.get('content-length') || 0);
    if (tam > MAX_ARQUIVO) return erro(413, 'quota_exceeded', 'O arquivo passa de 25 MB. Salve o PDF reduzido ou o Word sem imagens pesadas.');
    const lista = await todas(env), uso = calcularUso(lista, await lerUso(env));
    if (uso.bloqueado) return erro(507, 'limite_gratuito', 'O limite gratuito do armazenamento foi atingido. Peça ao proprietário para liberar espaço ou ampliar o plano.');
    const bytes = await request.arrayBuffer();
    if (bytes.byteLength > MAX_ARQUIVO) return erro(413, 'quota_exceeded', 'O arquivo passa de 25 MB.');
    const tipo = tipoDe(nome, bytes); if (!tipo) return erro(400, 'invalid', 'Envie um arquivo .docx ou .pdf válido.');
    const a = eu(auth), agora = new Date().toISOString();
    let p = lista.find((x) => x.casoId === String(casoId) && x.estado !== 'protocolada'), reenvio = false;
    const revId = url.searchParams.get('revisor') || '';
    let rev = null;
    if (revId) { rev = (await revisoresValidos(env)).find((r) => r.id === revId); if (!rev) return erro(400, 'invalid', 'Escolha um revisor da equipe.'); }
    if (!p) {
      if (!rev) return erro(400, 'invalid', 'Escolha quem vai revisar a petição.');
      p = { id: 'pt_' + Date.now().toString(36) + aleat(), casoId: String(casoId), cliente: String(caso.cliente || '').slice(0, 90), titulo: nome.replace(/\.(docx|pdf)$/i, ''), criadoPor: a, revisor: { id: rev.id, nome: rev.nome }, estado: 'a_corrigir', criadoEm: agora, atualizadoEm: agora, enviadaEm: agora, versoes: [], comentarios: [], eventos: [] };
    } else {
      const autor = souAutor(auth, p), revisor = souRevisor(auth, p);
      if (p.estado === 'aprovada') return erro(409, 'state', 'A petição já foi aprovada. Peça ao revisor para reabrir ou comece outra.');
      if (p.estado === 'devolvida' && !autor) return erro(403, 'forbidden', 'A petição está com quem fez a Inicial.');
      if (p.estado === 'a_corrigir' && !revisor && !autor) return erro(403, 'forbidden', 'Só o autor ou o revisor enviam nova versão.');
      if (p.estado === 'devolvida') { if (!rev) rev = p.revisor; p.revisor = { id: rev.id, nome: rev.nome }; p.estado = 'a_corrigir'; p.enviadaEm = agora; reenvio = true; }
    }
    const n = (p.versoes.length ? p.versoes[p.versoes.length - 1].n : 0) + 1;
    const chave = `pet/${p.id}/v${n}-${aleat()}.${tipo}`;
    await env.ARQUIVOS.put(chave, bytes, { httpMetadata: { contentType: MIME[tipo] } });
    p.versoes.push({ n, chave, nome, tam: bytes.byteLength, tipo, por: a, em: agora });
    const prazo = String(url.searchParams.get('prazo') || ''); if (/^\d{4}-\d{2}-\d{2}$/.test(prazo)) p.prazo = prazo;
    const recado = String(url.searchParams.get('recado') || '').trim().slice(0, 500);
    if (recado) p.comentarios.push({ id: aleat(), por: a, papel: 'autor', texto: recado, em: agora, v: n });
    p.atualizadoEm = agora; evento(p, auth, n === 1 ? 'Enviou a petição para ' + p.revisor.nome + '.' : 'Enviou a versão ' + n + (p.estado === 'a_corrigir' ? ' para ' + p.revisor.nome + '.' : '.'));
    await stmtPet(env, p).run();
    if (reenvio) await concluirTarefas(env, p.id, 'ajuste');   // quem fez a Inicial mandou a versão ajustada: a linha em Delegadas se conclui
    const u2 = await somarOp(env, 'classeA');
    const cols = await garantirColunas(env);
    await moverCaso(env, casoId, 'a_corrigir', auth);
    if (p.estado === 'a_corrigir' && !mesmo(p.revisor, a.id)) await aviso(env, deps, p.revisor.id, 'Petição para revisar', (a.nome + ' enviou "' + p.titulo + '" (' + p.cliente + ') para você revisar.'), 'pet-' + p.id);
    /* aviso ao proprietário quando o consumo cruza 80% (uma vez por mês) */
    const novo = calcularUso(await todas(env), u2);
    if (novo.nivel !== 'ok' && !(u2.avisos || {})[novo.nivel] && deps && deps.donoId) {
      u2.avisos = { ...(u2.avisos || {}), [novo.nivel]: true };
      await env.DB.prepare('INSERT INTO docs (colecao,id,dados,atualizado) VALUES (?,?,?,?) ON CONFLICT(colecao,id) DO UPDATE SET dados=excluded.dados, atualizado=excluded.atualizado').bind(COL, ID_USO, JSON.stringify(u2), Date.now()).run();
      await aviso(env, deps, await deps.donoId(env), 'Arquivos das petições: limite gratuito', 'Você já usou ' + novo.pct + '% do limite gratuito do mês (' + novo.qual + ').', 'pet-uso-' + novo.nivel);
    }
    return json({ ok: true, peticao: vista(p, auth), colunas: cols.length });
  }

  /* ----- ações sobre uma petição ----- */
  const id = sub; if (!/^pt_[a-z0-9]+$/.test(id)) return erro(404, 'not_found', 'Não encontrado.');
  const p = await lerPet(env, id); if (!p) return erro(404, 'not_found', 'Petição não encontrada.');
  if (!(await podeVerPet(env, auth, p))) return erro(403, 'forbidden', 'Você não tem acesso a esta petição.');
  const acao = partes[2] || '', a = eu(auth), agora = new Date().toISOString();

  if (acao === 'arquivo' && m === 'GET') {
    const n = Number(new URL(request.url).searchParams.get('v')) || (p.versoes[p.versoes.length - 1] || {}).n;
    const v = p.versoes.find((x) => x.n === n); if (!v) return erro(404, 'not_found', 'Versão não encontrada.');
    const obj = await env.ARQUIVOS.get(v.chave); if (!obj) return erro(404, 'not_found', 'O arquivo não está mais guardado.');
    await somarOp(env, 'classeB');
    return new Response(obj.body, { headers: { 'content-type': MIME[v.tipo] || 'application/octet-stream', 'content-length': String(v.tam), 'cache-control': 'no-store', 'content-disposition': "attachment; filename*=UTF-8''" + encodeURIComponent(v.nome), 'x-content-type-options': 'nosniff' } });
  }
  if (acao === 'comentar' && m === 'POST') {
    if (p.estado !== 'a_corrigir') return erro(409, 'state', 'A petição precisa estar com o revisor para receber comentários.');
    if (!souRevisor(auth, p)) return erro(403, 'forbidden', 'Só o revisor comenta.');
    const b = await request.json().catch(() => null) || {}, texto = String(b.texto || '').trim().slice(0, 2000);
    if (!texto) return erro(400, 'invalid', 'Escreva o comentário.');
    const v = p.versoes[p.versoes.length - 1].n, ancora = limparAncora(b.ancora);
    if (b.ancora && !ancora) return erro(400, 'invalid', 'Trecho inválido.');
    const com = { id: aleat(), por: a, papel: 'revisor', texto, em: agora, v, estado: 'aberto' };
    if (ancora) com.ancora = ancora;
    p.comentarios.push(com);
    p.atualizadoEm = agora; await stmtPet(env, p).run();
    return json({ ok: true, peticao: vista(p, auth), comentario: com.id });
  }
  if (acao === 'resolver' && m === 'POST') {
    if (!['a_corrigir', 'devolvida'].includes(p.estado)) return erro(409, 'state', 'Esta petição não aceita mais mudanças nos comentários.');
    const b = await request.json().catch(() => null) || {}, c = p.comentarios.find((x) => x.id === b.comentario);
    if (!c) return erro(404, 'not_found', 'Comentário não encontrado.');
    const est = c.estado || 'aberto';
    if (b.acao === 'propor') {   // quem fez a Inicial diz que corrigiu; o revisor confirma
      if (!souAutor(auth, p)) return erro(403, 'forbidden', 'Só quem fez a Inicial propõe como resolvido.');
      if (est !== 'aberto') return erro(409, 'state', 'O comentário já foi tratado.');
      c.estado = 'proposto'; c.propostoPor = a; c.propostoEm = agora;
    } else if (b.acao === 'resolver') {
      if (!souRevisor(auth, p)) return erro(403, 'forbidden', 'Só o revisor confirma que está resolvido.');
      if (est === 'resolvido') return erro(409, 'state', 'O comentário já está resolvido.');
      c.estado = 'resolvido'; c.resolvidoPor = a; c.resolvidoEm = agora;
    } else if (b.acao === 'reabrir') {
      if (!souRevisor(auth, p)) return erro(403, 'forbidden', 'Só o revisor reabre.');
      if (est === 'aberto') return erro(409, 'state', 'O comentário já está aberto.');
      c.estado = 'aberto'; delete c.resolvidoPor; delete c.resolvidoEm; delete c.propostoPor; delete c.propostoEm;
    } else return erro(400, 'invalid', 'Ação desconhecida.');
    p.atualizadoEm = agora; await stmtPet(env, p).run();
    return json({ ok: true, peticao: vista(p, auth) });
  }
  if (acao === 'devolver' && m === 'POST') {
    if (p.estado !== 'a_corrigir') return erro(409, 'state', 'A petição não está com o revisor.');
    if (!souRevisor(auth, p)) return erro(403, 'forbidden', 'Só o revisor devolve a petição.');
    const b = await request.json().catch(() => null) || {}, texto = String(b.texto || '').trim().slice(0, 2000), v = p.versoes[p.versoes.length - 1].n;
    if (texto) p.comentarios.push({ id: aleat(), por: a, papel: 'revisor', texto, em: agora, v, estado: 'aberto' });
    if (!p.comentarios.some((c) => c.v === v && c.papel === 'revisor')) return erro(400, 'invalid', 'Escreva ao menos um comentário antes de devolver.');
    p.estado = 'devolvida'; p.atualizadoEm = agora; evento(p, auth, 'Devolveu para ajustes.');
    await stmtPet(env, p).run(); await garantirColunas(env); await moverCaso(env, p.casoId, 'devolvida', auth); await abrirTarefa(env, p, 'ajuste');
    if (!mesmo(p.criadoPor, a.id)) await aviso(env, deps, p.criadoPor.id, 'Petição devolvida para ajustes', a.nome + ' comentou "' + p.titulo + '" (' + p.cliente + ') e devolveu para você.', 'pet-' + p.id);
    return json({ ok: true, peticao: vista(p, auth) });
  }
  if (acao === 'aprovar' && m === 'POST') {
    if (p.estado !== 'a_corrigir') return erro(409, 'state', 'A petição não está com o revisor.');
    if (!souRevisor(auth, p)) return erro(403, 'forbidden', 'Só o revisor aprova.');
    p.estado = 'aprovada'; p.atualizadoEm = agora; evento(p, auth, 'Aprovou a petição.');
    await stmtPet(env, p).run();
    const col = colunaProtocolo(await garantirColunas(env)); if (col) await moverCaso(env, p.casoId, col, auth);
    await concluirTarefas(env, p.id, 'ajuste'); await abrirTarefa(env, p, 'protocolo');
    if (!mesmo(p.criadoPor, a.id)) await aviso(env, deps, p.criadoPor.id, 'Petição aprovada', a.nome + ' aprovou "' + p.titulo + '" (' + p.cliente + '). Já pode protocolar.', 'pet-' + p.id);
    return json({ ok: true, peticao: vista(p, auth) });
  }
  if (acao === 'reencaminhar' && m === 'POST') {
    if (!['a_corrigir', 'devolvida'].includes(p.estado)) return erro(409, 'state', 'A petição não pode mudar de revisor agora.');
    if (!souAutor(auth, p)) return erro(403, 'forbidden', 'Só quem fez a Inicial escolhe o revisor.');
    const b = await request.json().catch(() => null) || {}, rev = (await revisoresValidos(env)).find((r) => r.id === b.revisor);
    if (!rev) return erro(400, 'invalid', 'Escolha um revisor da equipe.');
    if (p.estado === 'devolvida') { /* reenvia a mesma versão corrigida só se o autor já mandou nova versão; sem versão nova, só troca o revisor e continua devolvida */ }
    p.revisor = { id: rev.id, nome: rev.nome }; p.atualizadoEm = agora; evento(p, auth, 'Passou a revisão para ' + rev.nome + '.');
    await stmtPet(env, p).run();
    if (!mesmo(p.revisor, a.id)) await aviso(env, deps, rev.id, 'Petição para revisar', a.nome + ' passou "' + p.titulo + '" (' + p.cliente + ') para você revisar.', 'pet-' + p.id);
    return json({ ok: true, peticao: vista(p, auth) });
  }
  if (!acao && m === 'DELETE') {
    if (!souAutor(auth, p)) return erro(403, 'forbidden', 'Só quem fez a Inicial ou o proprietário apaga.');
    if (p.estado === 'protocolada') return erro(409, 'state', 'A petição protocolada fica guardada com a Inicial.');
    if (p.versoes.length) { await env.ARQUIVOS.delete(p.versoes.map((v) => v.chave)); await somarOp(env, 'classeA', p.versoes.length); }
    await env.DB.prepare('DELETE FROM docs WHERE colecao = ? AND id = ?').bind(COL, p.id).run(); await apagarTarefasAuto(env, p.id);
    return json({ ok: true });
  }
  return erro(405, 'method', 'Método não permitido.');
}
