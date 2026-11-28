// App aberto e parado: a vigia das coleções faz UM pedido (/api/sync) a cada 15 s, não um por coleção; e uma mudança feita por outra pessoa continua chegando.  Use: node test/rodar.mjs repouso-pedidos
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8816', TOK = 'tok-dono-0000000000000000000000000001';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const br = await chromium.launch(), ctx = await br.newContext({ viewport: { width: 390, height: 844 } }); await ctx.addCookies([{ name: 'sessao', value: TOK, url: B }]);
const p = await ctx.newPage(); await p.route(/fonts\./, (r) => r.abort()); await p.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { } });
const pedidos = []; p.on('request', (r) => { const u = new URL(r.url()); if (u.pathname.startsWith('/api/')) pedidos.push(u.pathname + u.search); });
await p.goto(B + '/'); await p.waitForFunction(() => window.__horusEu && window.__horusEu.pronto, null, { timeout: 60000 }); await p.waitForLoadState('networkidle'); await p.waitForTimeout(1500);
const n0 = pedidos.length; await p.waitForTimeout(32000);
const rep = pedidos.slice(n0);
check(!rep.some((u) => /resumo=1/.test(u)), 'em repouso não há mais um pedido de resumo por coleção');
const sync = rep.filter((u) => u.startsWith('/api/sync')).length;
check(sync >= 1 && sync <= 3, 'em 32 s a vigia fez ' + sync + ' pedido(s) /api/sync (esperado 2)');
check(rep.length <= 6, 'ao todo, ' + rep.length + ' pedidos em 32 s parado (antes eram ~25)');
// uma mudança de outra pessoa chega: cria um cliente por fora e espera a vigia reler a coleção
const antes = pedidos.filter((u) => u.startsWith('/api/db/clientes?limit')).length;
await fetch(B + '/api/db/clientes', { method: 'POST', headers: { cookie: 'sessao=' + TOK, 'content-type': 'application/json' }, body: JSON.stringify({ nome: 'Cliente da vigia ' + Date.now() }) });
await p.waitForTimeout(19000);
check(pedidos.filter((u) => u.startsWith('/api/db/clientes?limit')).length > antes, 'a coleção alterada por outra pessoa foi relida em até 19 s');
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
