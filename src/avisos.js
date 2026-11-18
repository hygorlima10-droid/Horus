/* Avisos no celular de cada pessoa e rastro da equipe (Fase 5, etapa 5.8).
   - Cada pessoa liga os avisos no próprio aparelho; o que ela quer receber fica em `config` (ver PREFS_PADRAO) e, para o proprietário, também as chaves de equipe (EQUIPE_PADRAO).
   - "Fui indicado como responsável": quando alguém entra como responsável (agenda) ou advogado (Inicial, Acordo, Alvará, Processo) de um registro, esse alguém recebe o aviso.
   - Atividade da equipe para o proprietário: recebimento desfeito, exclusão e alteração de honorários feitos por outra pessoa (cada um com a sua chave; o proprietário liga e desliga).
   Este arquivo só decide QUEM recebe e O QUÊ; quem de fato envia é a função `enviar(env, aviso, uid, pref)` do index.js. */
import { COL_USU } from './acesso.js';
import { normalizarUsuario, oabsDoRegistro, ehDono } from './politica.js';
import { canon, tituloDe, ROTULOS } from './auditoria.js';

export const PREFS_PADRAO = { resumo: true, prazos: true, indicado: true, publicacoes: true, repasses: true };
export const EQUIPE_PADRAO = { convite: true, aparelho: true, recebeu: true, desfeito: true, exclusao: true, honorarios: false, pronta: true, agenda: true, semanal: false };
export const prefsDe = (config) => ({ ...PREFS_PADRAO, ...((config && config.avisos) || {}) });
export const equipeDe = (config) => ({ ...EQUIPE_PADRAO, ...((config && config.equipe) || {}) });
export const limparPrefs = (b, padrao) => { const o = {}; if (b && typeof b === 'object') for (const k of Object.keys(padrao)) if (typeof b[k] === 'boolean') o[k] = b[k]; return o; };
const primeiro = (n) => String(n || 'Alguém').trim().split(/\s+/)[0] || 'Alguém';
const brl = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function usuariosAtivos(env) {
  const { results } = await env.DB.prepare('SELECT id, dados FROM docs WHERE colecao = ?').bind(COL_USU).all();
  return results.map((r) => ({ id: r.id, ...JSON.parse(r.dados) })).filter((u) => u.ativo !== false).map((u) => ({ ...u, norm: normalizarUsuario(u) }));
}
const usuariosDaChave = (us, chave) => us.filter((u) => (String(chave).startsWith('u:') ? chave === 'u:' + u.id : u.norm.oabs.includes(chave)));
const ehEstagiario = (auth) => !!(auth && auth.usuario && normalizarUsuario(auth.usuario).papel === 'estagiario');
const ATOR = (auth) => ({ id: auth && auth.usuario ? auth.usuario.id : '', nome: auth && auth.usuario ? auth.usuario.nome : '' });

/* quem está como responsável no registro (chaves "60456/GO" ou "u:<id>") */
export function chavesDeResponsaveis(colecao, d) {
  if (!d) return [];
  if (colecao === 'agenda') return Array.isArray(d.resp) ? d.resp.filter(Boolean) : [];
  if (colecao === 'delegadas') return typeof d.resp === 'string' && d.resp ? [d.resp] : (Array.isArray(d.resp) ? d.resp.filter(Boolean) : []);   // a tarefa delegada tem um responsável só (texto)
  return oabsDoRegistro(d);
}
const COLS_INDICADO = new Set(['agenda', 'delegadas', 'casos', 'termosAcordo', 'alvaras', 'processos']);

/* ---- recebimentos: o que estava recebido e deixou de estar ---- */
function nosPagos(d) {
  const m = {}; if (!d) return m;
  if (d.avista && typeof d.avista === 'object') m.avista = !!d.avista.pago;
  for (const p of Array.isArray(d.parcelas) ? d.parcelas : []) if (p) m['p' + p.numero] = !!p.pago;
  if (d.exito && typeof d.exito === 'object') { if (d.exito.avista) m.exitoAvista = !!d.exito.avista.pago; for (const p of Array.isArray(d.exito.parcelas) ? d.exito.parcelas : []) if (p) m['e' + p.numero] = !!p.pago; }
  if (d.status === 'recebido' || d.status === 'pendente' || d.status === 'recebida') m.status = d.status === 'recebido' || d.status === 'recebida';
  return m;
}
export function recebimentosDesfeitos(antes, depois) {
  const a = nosPagos(antes), b = nosPagos(depois);
  return Object.keys(a).filter((k) => a[k] === true && b[k] === false);
}
const HONOR = ['modalidadeHonorario', 'valorHonorarios', 'percentualExito', 'valorExitoFixo', 'valorMeuHonorario', 'formaPagamento', 'divisao', 'repasse'];
const assinaturaHonorarios = (d) => canon([HONOR.map((k) => (d || {})[k]), (Array.isArray(d && d.parcelas) ? d.parcelas : []).map((p) => [p && p.numero, p && p.valor, p && p.data]), d && d.exito ? [d.exito.valor, d.exito.formaPagamento] : null]);
export const honorariosMudaram = (antes, depois) => !!antes && assinaturaHonorarios(antes) !== assinaturaHonorarios(depois);
const COLS_HONORARIOS = new Set(['casos', 'termosAcordo', 'alvaras']);

/* chamado depois de gravar/excluir (a partir de /api/db e /api/lote).  acao: 'criou' | 'alterou' | 'excluiu'  */
export async function avisarAtividade(env, enviar, { colecao, id, antes, depois, acao, auth }) {
  try {
    const ator = ATOR(auth), titulo = tituloDe(colecao, depois || antes || {}), rotulo = ROTULOS[colecao] || colecao, quem = primeiro(ator.nome || 'Você');
    /* fui indicado: só para quem passou a constar como responsável agora */
    if (acao !== 'excluiu' && depois && COLS_INDICADO.has(colecao)) {
      const antigos = new Set(chavesDeResponsaveis(colecao, antes)), novas = chavesDeResponsaveis(colecao, depois).filter((k) => !antigos.has(k));
      if (novas.length) {
        const us = await usuariosAtivos(env), alvos = new Set(), lancouEstagiario = colecao === 'agenda' && acao === 'criou' && ehEstagiario(auth);   // quando a estagiária lança na agenda, advogados e proprietário recebem o aviso "lançou" (abaixo), não este
        for (const k of novas) for (const u of usuariosDaChave(us, k)) if (u.id !== ator.id && !(lancouEstagiario && u.norm.papel !== 'estagiario')) alvos.add(u.id);
        for (const uid of alvos) await enviar(env, { tag: 'indicado-' + colecao + '-' + id + '-' + uid, titulo: 'Você foi indicado', corpo: quem + ' colocou você como responsável: ' + rotulo + ' · ' + titulo, url: '/' }, uid, 'indicado');
      }
    }
    /* a estagiária lançou (ou mudou data/hora de) prazo, audiência ou tarefa na agenda: não precisa conferir — o proprietário e os advogados responsáveis só são avisados */
    if (colecao === 'agenda' && depois && ehEstagiario(auth) && (acao === 'criou' || (acao === 'alterou' && antes && (antes.data !== depois.data || (antes.hora || '') !== (depois.hora || ''))))) {
      const tipo = { audiencia: ['uma audiência', 'a audiência'], prazo: ['um prazo', 'o prazo'], tarefa: ['uma tarefa', 'a tarefa'] }[depois.tipo] || ['um item', 'o item'];
      const quando = depois.data ? depois.data.split('-').reverse().join('/') + (depois.hora ? ' às ' + depois.hora : '') : '';
      const corpo = [depois.titulo || depois.tipo, quando, depois.processo ? 'Proc. ' + depois.processo : (depois.cliente || '')].filter(Boolean).join(' · ');
      const titulo2 = acao === 'criou' ? quem + ' lançou ' + tipo[0] + ' na agenda' : quem + ' alterou ' + tipo[1] + ' na agenda';
      await enviar(env, { tag: 'agenda-' + acao + '-' + id + '-' + (depois.data || '') + (depois.hora || ''), titulo: titulo2, corpo, url: '/', equipe: 'agenda' }, undefined);   // proprietário (chave da equipe "agenda")
      const us = await usuariosAtivos(env), alvos = new Set();
      for (const k of chavesDeResponsaveis(colecao, depois)) for (const u of usuariosDaChave(us, k)) if (u.id !== ator.id && u.norm.papel === 'advogado') alvos.add(u.id);
      for (const uid of alvos) await enviar(env, { tag: 'agenda-' + acao + '-' + id + '-' + (depois.data || '') + (depois.hora || '') + '-' + uid, titulo: titulo2, corpo, url: '/' }, uid, 'prazos');
    }
    /* peça pronta: quem terminou a peça avisa o proprietário e os advogados responsáveis, para conferirem e protocolarem */
    if (colecao === 'agenda' && acao === 'alterou' && antes && depois && depois.situacao === 'pronta' && antes.situacao !== 'pronta' && !depois.concluido) {
      const aviso = { tag: 'pronta-' + id, titulo: 'Peça pronta por ' + quem, corpo: titulo + '. Falta conferir e protocolar.', url: '/' };
      if (!ehDono(auth)) await enviar(env, { ...aviso, equipe: 'pronta' }, undefined);
      const us = await usuariosAtivos(env), alvos = new Set();
      for (const k of chavesDeResponsaveis(colecao, depois)) for (const u of usuariosDaChave(us, k)) if (u.id !== ator.id && u.norm.papel === 'advogado') alvos.add(u.id);
      for (const uid of alvos) await enviar(env, aviso, uid, 'prazos');
    }
    /* avisos da equipe para o proprietário: só o que outra pessoa fez */
    if (!ehDono(auth)) {
      if (acao === 'excluiu' && antes) await enviar(env, { tag: 'excluiu-' + colecao + '-' + id, titulo: 'Registro excluído por ' + quem, corpo: rotulo + ' · ' + titulo + '. Dá para restaurar na Lixeira.', url: '/', equipe: 'exclusao' }, undefined);
      if (acao === 'alterou' && antes && depois) {
        const d = recebimentosDesfeitos(antes, depois);
        if (d.length) await enviar(env, { tag: 'desfeito-' + colecao + '-' + id, titulo: 'Recebimento desfeito por ' + quem, corpo: rotulo + ' · ' + titulo, url: '/', equipe: 'desfeito' }, undefined);
        if (COLS_HONORARIOS.has(colecao) && honorariosMudaram(antes, depois)) await enviar(env, { tag: 'honorarios-' + colecao + '-' + id, titulo: 'Honorários alterados por ' + quem, corpo: rotulo + ' · ' + titulo, url: '/', equipe: 'honorarios' }, undefined);
      }
    }
  } catch (e) { console.error('avisos de atividade', e); }
}

/* ---- repasses: quem tem a receber (proprietário ou outro advogado) recebe o aviso ---- */
export async function avisarRepasseA(env, enviar, id, antes, depois) {
  try {
    if (!depois || !depois.para || (antes && antes.status === depois.status)) return;
    const us = await usuariosAtivos(env), alvos = usuariosDaChave(us, depois.para.oab); if (!alvos.length) return;
    const quem = primeiro(depois.de && depois.de.nome || 'Um advogado'), onde = [depois.cliente, depois.label].filter(Boolean).join(' · ');
    const msg = { pendente: [quem + ' recebeu honorários', 'Seu repasse: ' + brl(depois.valor) + ' a receber. ' + onde], feito: [quem + ' diz que repassou ' + brl(depois.valor), onde + '. Confirme o recebimento no app.'], cancelado: ['Recebimento desfeito por ' + quem, onde + ' · ' + brl(depois.valor) + ' deixou de ser a receber.'] }[depois.status];
    if (!msg || (antes && depois.status === 'pendente')) return;
    for (const u of alvos) {
      const dono = u.norm.papel === 'proprietario', equipe = dono ? (depois.status === 'pendente' ? 'recebeu' : depois.status === 'cancelado' ? 'desfeito' : '') : '';
      await enviar(env, { tag: 'repasse-' + id + '-' + depois.status, titulo: msg[0], corpo: msg[1], url: '/', ...(equipe ? { equipe } : {}) }, u.id, equipe ? undefined : 'repasses');
    }
  } catch (e) { console.error('aviso de repasse', e); }
}

/* ---- pagamento separado (coleção `recebimentos`) ----
   - uma pessoa recebeu a parte dela / desfez: o proprietário é avisado (chaves da equipe "recebeu" e "desfeito"), quando foi outra pessoa;
   - o pagador (ex.: Murilo) recebeu do cliente: avisa os advogados do processo (e o proprietário, se não foi ele) de que já dá para cobrar a parte. */
export async function avisarRecebimentoA(env, enviar, id, antes, depois, auth) {
  try {
    if (!depois || typeof depois !== 'object') return;
    const souDono = ehDono(auth), ator = auth && auth.usuario ? auth.usuario.id : 'dono', quem = primeiro((auth && auth.usuario && auth.usuario.nome) || 'Proprietário');
    const onde = [depois.cliente, depois.label].filter(Boolean).join(' · ');
    if (depois.tipo === 'parte') {
      if (souDono) return;
      const antesPago = !!(antes && antes.pago), agoraPago = !!depois.pago;
      if (agoraPago && !antesPago) await enviar(env, { tag: 'receb-' + id + '-ok', titulo: quem + ' recebeu a parte dele(a)', corpo: onde + (depois.valorBase ? ' · ' + brl(depois.valorBase) : ''), url: '/', equipe: 'recebeu' }, undefined);
      else if (!agoraPago && antesPago) await enviar(env, { tag: 'receb-' + id + '-desfeito', titulo: 'Recebimento desfeito por ' + quem, corpo: onde, url: '/', equipe: 'desfeito' }, undefined);
      return;
    }
    if (depois.tipo === 'cliente' && !depois.desfeito && !(antes && !antes.desfeito)) {
      const us = await usuariosAtivos(env), alvos = new Map();
      for (const k of Array.isArray(depois.advs) ? depois.advs : []) for (const u of usuariosDaChave(us, k)) if (u.id !== ator) alvos.set(u.id, u);
      for (const u of alvos.values()) {
        const dono = u.norm.papel === 'proprietario';
        await enviar(env, { tag: 'receb-cli-' + id + '-' + u.id, titulo: 'O pagador recebeu do cliente', corpo: (onde ? onde + '. ' : '') + 'Já dá para cobrar a sua parte.', url: '/', ...(dono ? { equipe: 'recebeu' } : {}) }, u.id, dono ? undefined : 'repasses');
      }
    }
  } catch (e) { console.error('aviso de recebimento', e); }
}

/* ---- resumo semanal da equipe (segunda 08:00, se o proprietário ligou): quem fez quantas ações nos últimos 7 dias ---- */
export async function textoSemanal(env) {
  const desde = new Date(Date.now() - 7 * 864e5).toISOString().replace(/\D/g, '').slice(0, 17);
  const { results } = await env.DB.prepare("SELECT dados FROM docs WHERE colecao = '_auditoria' AND id >= ? LIMIT 5000").bind(desde).all();
  const por = {}; for (const r of results) { const d = JSON.parse(r.dados); if (!d.colecao || d.rotulo === 'Acesso') continue; por[d.por || 'Você'] = (por[d.por || 'Você'] || 0) + 1; }
  const linhas = Object.entries(por).sort((x, y) => y[1] - x[1]).slice(0, 6).map(([n, q]) => primeiro(n) + ' ' + q);
  return linhas.length ? linhas.join(' · ') : 'Nenhuma ação registrada nos últimos 7 dias.';
}
