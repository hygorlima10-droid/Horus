/* Tabela de coleções do banco: quem pode abrir cada uma pela API /api/db (e /api/lote).
   - "juridico": qualquer pessoa com acesso (depois, conforme perfil e permissão);
   - "dono": só o proprietário (finanças pessoais e da PJ, patrimônio, Construção, extratos, configurações financeiras);
   - fora da tabela: recusada.
   Coleções que começam com _ nunca passam por aqui (o nome é recusado antes). */
export const NIVEL = {
  repasses: 'juridico', recebimentos: 'juridico', casos: 'juridico', termosAcordo: 'juridico', alvaras: 'juridico', clientes: 'juridico', processos: 'juridico', agenda: 'juridico', pecasAprendidas: 'juridico', delegadas: 'juridico', prazosPub: 'juridico', diasSemExpediente: 'juridico', config: 'juridico',
  despesas: 'dono', receitasManuais: 'dono', saldos: 'dono', metas: 'dono', extratos: 'dono', obraMov: 'dono', configDono: 'dono',
};
/* documentos de `config` que são do proprietário: ficam na coleção configDono. O endereço antigo (/api/db/config/<id>) continua valendo
   para o aplicativo já aberto em outro aparelho: o servidor leva a leitura e a gravação para configDono. */
export const CONFIG_DONO = new Set(['planejamento', 'obra', 'extratos', 'relatorioMurilo', 'alertasDispensados', 'backup', 'fechamentos', 'orcamento', 'futuro']);
export const resolverColecao = (colecao, id) => (colecao === 'config' && id && CONFIG_DONO.has(id) ? 'configDono' : colecao);
const erro = (status, code, message) => new Response(JSON.stringify({ error: { code, message } }), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
/* devolve null se pode, ou a resposta de recusa; "auth" nulo = modo antigo (uma pessoa só, o proprietário) */
export function checarColecao(colecao, auth) {
  const nivel = NIVEL[colecao];
  if (!nivel) return erro(404, 'not_found', 'Coleção desconhecida.');
  if (nivel === 'dono' && auth && auth.usuario && auth.usuario.papel !== 'proprietario') return erro(403, 'forbidden', 'Só o proprietário pode abrir isto.');
  return null;
}
export const ehProprietario = (auth) => !auth || !auth.usuario || auth.usuario.papel === 'proprietario';

/* ---------- cofre financeiro de cada advogado ----------
   As coleções financeiras do proprietário (despesas, receitas, saldos, metas, extratos e os documentos de configuração financeira) continuam onde sempre estiveram.
   O advogado usa as mesmas rotas, mas o servidor troca o nome para uma área só dele (`despesas@<id>`): ele só enxerga o que é dele, ninguém lê o cofre do outro
   (nem o proprietário pelo app) e o cofre fica de fora do backup, da lixeira e do registro de ações do proprietário. Construção (obraMov) continua só do proprietário;
   estagiários não têm cofre. */
export const PESSOAL = new Set(['despesas', 'receitasManuais', 'saldos', 'metas', 'extratos', 'configDono']);
export const ehAdvogadoAuth = (auth) => !!(auth && auth.usuario && auth.usuario.papel === 'advogado');
export const ehCofre = (colecao) => String(colecao).includes('@');
export const baseDoCofre = (colecao) => String(colecao).split('@')[0];
/* Familiar (ex.: irmão do proprietário): conta própria SÓ com os módulos que o proprietário liberou (Construção e/ou Finanças pessoais). Tudo fica no cofre dele
   (`<coleção>@<id>`): ele não abre nada do escritório nem do proprietário, e o proprietário não lê o cofre dele pelo app. */
export const ehFamiliarAuth = (auth) => !!(auth && auth.usuario && auth.usuario.papel === 'familiar');
const modulosDe = (auth) => (Array.isArray(auth.usuario.modulos) ? auth.usuario.modulos : ['obra']);
export const COL_OBRA = new Set(['obraMov']);
/* coleções que o familiar pode usar, conforme os módulos (o documento `config` guarda as preferências e a personalização dele) */
export function colecoesDoFamiliar(auth) {
  const m = modulosDe(auth), s = new Set(['config', 'configDono']);
  if (m.includes('obra')) for (const c of COL_OBRA) s.add(c);
  if (m.includes('financas')) for (const c of PESSOAL) s.add(c);
  return s;
}
export const familiarPodeUsar = (colecao, auth) => colecoesDoFamiliar(auth).has(String(colecao).split('@')[0]);
export const ehCofreAuth = (auth) => ehAdvogadoAuth(auth) || ehFamiliarAuth(auth);
export const doCofre = (colecao, auth) => {
  if (ehAdvogadoAuth(auth) && PESSOAL.has(colecao)) return colecao + '@' + auth.usuario.id;
  if (ehFamiliarAuth(auth) && familiarPodeUsar(colecao, auth)) return colecao + '@' + auth.usuario.id;
  return colecao;
};
