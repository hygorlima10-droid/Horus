// GET /api/sync?c=a,b,c: a "ficha" (quantidade + última alteração) de várias coleções num pedido só.  Tem de dar EXATAMENTE o mesmo que os pedidos separados
// (/api/db/<coleção>?resumo=1) para cada papel (proprietário, advogados, estagiários): mesmas permissões e mesmo filtro.  Use: node test/rodar.mjs sync-resumo
const B = process.env.BASE || 'http://127.0.0.1:8816';
const TOK = { dono: 'tok-dono-0000000000000000000000000001', ana: 'tok-adv-ana-00000000000000000000000002', bruno: 'tok-adv-bruno-000000000000000000000003', caio: 'tok-est-caio-0000000000000000000000004', dani: 'tok-est-dani-0000000000000000000000005' };
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const get = async (q, p) => { const r = await fetch(B + p, { headers: q ? { cookie: 'sessao=' + TOK[q] } : {}, redirect: 'manual' }); let j = null; try { j = await r.json(); } catch (e) { } return { s: r.status, j }; };
const COLS = ['casos', 'termosAcordo', 'alvaras', 'clientes', 'processos', 'agenda', 'despesas', 'receitasManuais', 'metas', 'saldos', 'extratos', 'obraMov', 'config', 'delegadas', 'recebimentos', 'repasses', 'inexistente'];
await fetch(B + '/api/db/delegadas', { method: 'POST', headers: { cookie: 'sessao=' + TOK.dono, 'content-type': 'application/json' }, body: JSON.stringify({ titulo: 'SYNC teste', resp: 'u:u4' }) });
for (const q of Object.keys(TOK)) {
  const sep = {}; for (const c of COLS) { const r = await get(q, '/api/db/' + c + '?resumo=1'); sep[c] = r.s === 200 && r.j && typeof r.j.n === 'number' ? { n: r.j.n, t: r.j.t } : null; }
  const r = await get(q, '/api/sync?c=' + COLS.join(','));
  const igual = r.s === 200 && COLS.every((c) => JSON.stringify(r.j.c[c] || null) === JSON.stringify(sep[c]));
  check(igual, q + ': a ficha de ' + COLS.length + ' coleções num pedido só é idêntica à dos pedidos separados' + (igual ? '' : ' — ' + JSON.stringify(r.j && r.j.c) + ' x ' + JSON.stringify(sep)));
}
const ad = await get('ana', '/api/sync?c=despesas,metas,casos'), ad1 = await get('ana', '/api/db/despesas?resumo=1');
check(ad.s === 200 && ad.j.c.despesas && ad.j.c.despesas.n === ad1.j.n, 'advogada: as coleções do cofre dela (despesas) vêm do cofre dela, não as do proprietário');
const es = await get('caio', '/api/sync?c=despesas,metas');
check(es.s === 200 && es.j.c.despesas === null && es.j.c.metas === null, 'estagiário: coleção financeira do proprietário vem como null (sem acesso), sem erro');
const rs = await get('dono', '/api/sync?c=_pub,_sessoes,_usuarios,casos,%20x,a/b,..');
check(rs.s === 200 && Object.keys(rs.j.c).join() === 'casos', 'nomes reservados (_x) e inválidos são ignorados: ' + Object.keys(rs.j.c).join());
const muitos = Array.from({ length: 45 }, (_, i) => 'col' + i).join(',');
check(Object.keys((await get('dono', '/api/sync?c=' + muitos)).j.c).length === 30, 'no máximo 30 coleções por pedido');
check((await get('dono', '/api/sync')).j.c && Object.keys((await get('dono', '/api/sync')).j.c).length === 0, 'sem lista, devolve vazio');
check((await get(null, '/api/sync?c=casos')).s === 303 || (await get(null, '/api/sync?c=casos')).s === 401, 'sem login não responde (' + (await get(null, '/api/sync?c=casos')).s + ')');
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
