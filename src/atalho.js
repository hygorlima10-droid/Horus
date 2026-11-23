/* Atalho do iPhone: extrato do banco enviado pelo celular, com código e caixa de entrada por pessoa.
   - Cada proprietário/advogado tem o SEU código (guardado em `_atalho`, doc `u:<id>`; o app mostra com o botão "Mostrar"). Estagiário não usa (não tem finanças).
   - POST /api/enviar (público, com o código no cabeçalho) descobre de quem é o código e guarda o arquivo na caixa DESSA pessoa
     (arquivo no R2, até 25 MB; registro em `_recebidos` com `uid`). O app de cada um lê só a caixa dele.
   - O código único antigo (ENVIO_TOKEN) continua valendo para o proprietário até ele gerar o código pessoal; depois é desligado.
   Rotas (sessão):
     GET  /api/atalho            o meu código, último envio, quantos esperam, link do atalho
     POST /api/atalho/gerar      gera (ou troca) o meu código: o anterior deixa de valer na hora
     POST /api/atalho/link       { link }  (proprietário) endereço de compartilhamento do atalho (iCloud)
     GET  /api/atalho/pessoas    (proprietário) quem tem atalho e o último uso
     POST /api/atalho/desligar   { uid }   (proprietário) desliga o código de uma pessoa */
import { COL_USU } from './acesso.js';
import { ehDono, normalizarUsuario } from './politica.js';

const COL = '_atalho', ALFABETO = 'abcdefghjkmnpqrstuvwxyz23456789';
export const MAX_ARQ_EXTRATO = 25 * 1024 * 1024;
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const erro = (status, code, message) => json({ error: { code, message } }, status);
const enc = new TextEncoder();
const sha = async (t) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(t))), (b) => b.toString(16).padStart(2, '0')).join('');
const limpar = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const igual = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
export function novoCodigo() {
  const b = crypto.getRandomValues(new Uint8Array(16)); let s = '';
  for (const x of b) s += ALFABETO[x % ALFABETO.length];
  return s.match(/.{4}/g).join('-');
}
const podeTer = (auth) => ehDono(auth) || normalizarUsuario(auth.usuario).papel === 'advogado';
const uidDe = async (env, auth) => { if (auth && auth.usuario && auth.usuario.id) return auth.usuario.id; const d = await env.DB.prepare("SELECT id FROM docs WHERE colecao = ? AND json_extract(dados, '$.papel') = 'proprietario' LIMIT 1").bind(COL_USU).first(); return d ? d.id : ''; };
async function lerDoc(env, id) { const r = await env.DB.prepare('SELECT dados FROM docs WHERE colecao = ? AND id = ?').bind(COL, id).first(); return r ? JSON.parse(r.dados) : null; }
const gravarDoc = (env, id, d) => env.DB.prepare('INSERT INTO docs (colecao,id,dados,atualizado) VALUES (?,?,?,?) ON CONFLICT(colecao,id) DO UPDATE SET dados=excluded.dados, atualizado=excluded.atualizado').bind(COL, id, JSON.stringify(d), Date.now()).run();

/* de quem é o código do cabeçalho? { uid, legado } ou null */
export async function resolverCodigo(env, request, tokenLegadoConfere) {
  const m = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') || ''); if (!m) return null;
  const h = await sha(limpar(m[1]));
  const { results } = await env.DB.prepare("SELECT id, dados FROM docs WHERE colecao = ? AND id LIKE 'u:%'").bind(COL).all();
  let dono = null;
  for (const r of results) { const d = JSON.parse(r.dados); if (d.hash && igual(d.hash, h)) dono = r.id.slice(2); }
  if (dono) return { uid: dono, legado: false };
  if (await tokenLegadoConfere()) {
    const d = await env.DB.prepare("SELECT id FROM docs WHERE colecao = ? AND json_extract(dados, '$.papel') = 'proprietario' LIMIT 1").bind(COL_USU).first();
    const idDono = d ? d.id : '';
    if (idDono && (await lerDoc(env, 'u:' + idDono))) return null;   // o proprietário já tem o código pessoal: o antigo foi desligado
    return { uid: idDono, legado: true };
  }
  return null;
}
export async function registrarUso(env, uid, nome) {
  if (!uid) return;
  const d = await lerDoc(env, 'u:' + uid); if (!d) return;
  d.ultimoEm = new Date().toISOString(); d.ultimoNome = String(nome || '').slice(0, 120); await gravarDoc(env, 'u:' + uid, d);
}
const esperando = async (env, uid, dono) => {
  const { results } = await env.DB.prepare("SELECT dados FROM docs WHERE colecao = '_recebidos'").all();
  return results.filter((r) => { const d = JSON.parse(r.dados); return d.uid ? d.uid === uid : dono; }).length;
};

export async function atalhoRotas(request, env, partes, auth) {
  if (!podeTer(auth)) return erro(403, 'forbidden', 'O atalho do iPhone é do proprietário e dos advogados.');
  const m = request.method, sub = partes[1] || '', uid = await uidDe(env, auth), dono = ehDono(auth);
  if (!sub && m === 'GET') {
    const d = uid ? await lerDoc(env, 'u:' + uid) : null, cfg = (await lerDoc(env, 'config')) || {};
    return json({ tem: !!d, codigo: d ? d.codigo : '', criado: d ? d.criado : '', ultimo: d && d.ultimoEm ? { em: d.ultimoEm, nome: d.ultimoNome || '' } : null, esperando: await esperando(env, uid, dono), link: cfg.link || '', dono, maxArquivo: MAX_ARQ_EXTRATO, legado: dono && !d && !!env.ENVIO_TOKEN });
  }
  if (sub === 'gerar' && m === 'POST') {
    if (!uid) return erro(400, 'invalid', 'Não achei a sua conta.');
    const codigo = novoCodigo(), antes = await lerDoc(env, 'u:' + uid);
    await gravarDoc(env, 'u:' + uid, { uid, codigo, hash: await sha(limpar(codigo)), criado: new Date().toISOString(), ultimoEm: '', ultimoNome: '', trocas: ((antes && antes.trocas) || 0) + (antes ? 1 : 0) });
    return json({ ok: true, codigo });
  }
  if (sub === 'link' && m === 'POST') {
    if (!dono) return erro(403, 'forbidden', 'Só o proprietário muda o link do atalho.');
    const b = await request.json().catch(() => null) || {}, link = String(b.link || '').trim().slice(0, 300);
    if (link && !/^https:\/\/[^\s]+$/i.test(link)) return erro(400, 'invalid', 'O link precisa começar com https://');
    const cfg = (await lerDoc(env, 'config')) || {}; cfg.link = link; await gravarDoc(env, 'config', cfg);
    return json({ ok: true, link });
  }
  if (sub === 'pessoas' && m === 'GET') {
    if (!dono) return erro(403, 'forbidden', 'Só o proprietário vê a lista.');
    const { results } = await env.DB.prepare('SELECT id, dados FROM docs WHERE colecao = ?').bind(COL_USU).all();
    const out = [];
    for (const r of results) {
      const u = JSON.parse(r.dados); if (u.ativo === false) continue;
      const papel = normalizarUsuario({ ...u, id: r.id }).papel, d = await lerDoc(env, 'u:' + r.id);
      out.push({ id: r.id, nome: String(u.nome || '').slice(0, 80), papel, aplica: papel !== 'estagiario', tem: !!d, ultimo: d && d.ultimoEm ? d.ultimoEm : '' });
    }
    return json({ pessoas: out.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')) });
  }
  if (sub === 'desligar' && m === 'POST') {
    if (!dono) return erro(403, 'forbidden', 'Só o proprietário desliga o código de outra pessoa.');
    const b = await request.json().catch(() => null) || {}; if (!b.uid || typeof b.uid !== 'string') return erro(400, 'invalid', 'Escolha a pessoa.');
    await env.DB.prepare('DELETE FROM docs WHERE colecao = ? AND id = ?').bind(COL, 'u:' + b.uid).run();
    return json({ ok: true });
  }
  return erro(405, 'method', 'Método não permitido.');
}
