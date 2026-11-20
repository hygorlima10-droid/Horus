// Testa na tela e na API (auditoria de 19/11): a OAB da própria pessoa nunca fica escondida na tela dela, mesmo com "só processos em conjunto",
// e o selo "fora da sua visão" do proprietário. Banco semeado do grupo 'permissoes':  node test/rodar.mjs publicacoes-seguranca
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8816', TOK = { dono: 'tok-dono-0000000000000000000000000001', ana: 'tok-adv-ana-00000000000000000000000002', caio: 'tok-est-caio-0000000000000000000000004' };
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const api = async (n, m, pth, b) => { const x = await fetch(B + pth, { method: m, headers: { cookie: 'sessao=' + TOK[n], 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined }); let j = null; try { j = await x.json(); } catch (e) { /* sem corpo */ } return { s: x.status, j }; };
for (const n of ['dono', 'ana', 'caio']) await api(n, 'POST', '/api/djen/marcar', { ids: ['100', '101', '102', '103', '104'], lida: null, semPrazo: null, tratada: false });
await api('dono', 'PUT', '/api/usuarios/u1', { oabs: [] });   // testes anteriores do grupo indicaram outra OAB para o proprietário: volta ao ponto de partida (vale a principal)
const orig = (await api('dono', 'GET', '/api/djen/estado')).j.oabs;
const escopar = (e) => api('dono', 'PUT', '/api/djen/oabs', { oabs: orig.map(o => ({ id: o.id, nome: o.nome, numero: o.numero, uf: o.uf, ativo: o.ativo, escopo: o.numero === '11111' ? e : o.escopo, avisar: o.avisar, principal: o.principal })) });

console.log('\n— selo "fora da sua visão" (proprietário em Minhas)');
const m = (await api('dono', 'GET', '/api/djen/lista?escopo=meus')).j;
check(m.pubs.map(p => p.id).join(',') === '103' && m.fora === 4, 'em "Minhas" o proprietário vê a 103 e 4 publicações do escritório (100, 101, 102 e 104) ainda ninguém abriu: ' + m.fora);
await api('ana', 'POST', '/api/djen/marcar', { ids: ['100'], lida: true });
check((await api('dono', 'GET', '/api/djen/lista?escopo=meus')).j.fora === 3, 'quando alguém abre uma, ela sai da conta do selo (3)');
await api('ana', 'POST', '/api/djen/marcar', { ids: ['100'], lida: null });
check((await api('dono', 'GET', '/api/djen/lista')).j.fora === 0 && (await api('ana', 'GET', '/api/djen/lista')).j.fora === 0, 'sem pedir "Minhas", e para a advogada, o selo não existe (0)');

console.log('\n— a OAB da própria advogada nunca é escondida (escopo "só processos em conjunto")');
check((await escopar('conjunto')).s === 200, 'proprietário muda a OAB da Ana para "só processos em conjunto"');
const br = await chromium.launch();
const ctx = await br.newContext({ viewport: { width: 1280, height: 900 } }); await ctx.addCookies([{ name: 'sessao', value: TOK.ana, url: B }]);
const page = await ctx.newPage(); await page.route(/fonts\./, (r) => r.abort());
await page.addInitScript(() => { try { localStorage.setItem('horus.subaba.v1', JSON.stringify({ sub: { publicacoes: 'todas' }, per: 6 })); } catch (e) { /* sem armazenamento */ } });
await page.goto(B + '/'); await page.waitForTimeout(2500);
await page.evaluate(() => document.querySelector('[data-tab="publicacoes"]').click()); await page.waitForTimeout(1400);
const ids = await page.evaluate(() => window.__horusTeste.pbVisiveisIds());
check(ids.split(',').includes('100') && ids.split(',').includes('102'), 'a Ana continua vendo as publicações da OAB dela na tela (100 e 102), mesmo com o escopo "conjunto": ' + ids);
check(await page.evaluate(() => window.__horusTeste.pbNaoLidasN()) >= 2, 'e a contagem de "Não lidas" dela inclui essas publicações');
// agrupamento: tipos diferentes nunca viram um cartão só (testado direto na função da tela)
const g = await page.evaluate(() => {
  var base = { processo: '00000099920248090009', data: '2026-11-10', th: 'abc123', orgao: 'Vara', oabs: ['o2'], lida: false };
  return window.__horusTeste.pbAgruparTeste([Object.assign({ id: 'x1', tipo: 'Decisão' }, base), Object.assign({ id: 'x2', tipo: 'Outros' }, base), Object.assign({ id: 'x3', tipo: 'Decisão' }, base)]);
});
check(g[0] === 2 && g[1] === 1 && g[2] === 2, 'mesmo texto e dia: duas "Decisão" juntam; a "Outros" fica separada: ' + g);
await br.close();
await escopar('tudo');   // volta ao escopo original da semente
check((await api('dono', 'GET', '/api/djen/estado')).j.oabs.find(o => o.numero === '11111').escopo === 'tudo', 'escopo da OAB da Ana restaurado');
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
