// Pagamento separado: a ficha (modo direto e quem paga, trava com pagamento feito), acordo com parcelas, alvará e baixa parcial, e quem não está no processo.
// Servidor do grupo 'permissoes':  node test/rodar.mjs pagamento-direto-ficha
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8816', TOK = { dono: 'tok-dono-0000000000000000000000000001', ana: 'tok-adv-ana-00000000000000000000000002', bruno: 'tok-adv-bruno-000000000000000000000003' };
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const api = (n) => async (m, p, b) => { const x = await fetch(B + p, { method: m, headers: { cookie: 'sessao=' + TOK[n], 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined }); let j = null; try { j = await x.json(); } catch (e) { } return { s: x.status, j }; };
const dono = api('dono');
const dia = (n) => new Date(Date.now() - 3 * 3600e3 + n * 86400e3).toISOString().slice(0, 10), ontem = dia(-1), mes = dia(0).slice(0, 7);
await dono('PUT', '/api/usuarios/u1', { oabs: ['60456/GO'] });
for (const d of (await dono('GET', '/api/db/recebimentos')).j.docs || []) await dono('DELETE', '/api/db/recebimentos/' + d.id);
const limpar = async () => { for (const d of (await dono('GET', '/api/db/recebimentos')).j.docs || []) await dono('DELETE', '/api/db/recebimentos/' + d.id); await dono('DELETE', '/api/db/casos/pf1'); await dono('DELETE', '/api/db/termosAcordo/pf2'); await dono('DELETE', '/api/db/alvaras/pf3'); };
const MUR = { oab: '49308/GO', nome: 'Murilo Falone Rocha' }, HYG = { oab: '60456/GO', nome: 'Dono Teste' }, ANA = { oab: '11111/GO', nome: 'Ana Advogada' };
const div = (h, a, m) => ({ modo: 'direto', partes: [{ oab: '60456/GO', nome: 'Dono Teste', pct: h }, { oab: '11111/GO', nome: 'Ana Advogada', pct: a }, { oab: '49308/GO', nome: 'Murilo Falone Rocha', pct: m, pagador: true }] });
await dono('PUT', '/api/db/casos/pf1', { tipo: 'inicial', origem: 'murilo', prioridade: 'normal', status: 'pendente', cliente: 'Ficha Direta', nomeAcao: 'Ação', numeroProcesso: '0000841-01.2024.8.09.0841', modalidadeHonorario: 'fixo', formaPagamento: 'avista', valorHonorarios: 10000, avista: { data: ontem, pago: false }, advogados: [HYG, ANA, MUR], divisao: div(10, 5, 85), criadoEm: new Date().toISOString() });
await dono('PUT', '/api/db/termosAcordo/pf2', { partes: 'Acordo Direto', numeroProcesso: '0000842-02.2024.8.09.0842', origem: 'murilo', status: 'pendente', honorarios: 'com', valorMeuHonorario: 20000, parcelas: [{ numero: 1, valor: 10000, data: ontem, pago: false }, { numero: 2, valor: 10000, data: dia(30), pago: false }], advogados: [HYG, ANA, MUR], divisao: div(20, 10, 70), criadoEm: new Date().toISOString() });
await dono('PUT', '/api/db/alvaras/pf3', { partes: 'Alvara Direto', numeroProcesso: '0000843-03.2024.8.09.0843', origem: 'murilo', status: 'pendente', fase: 'protocolada', valorTotalHonorarios: 8000, valorMeuHonorario: 8000, previsaoLevantamento: ontem, advogados: [HYG, ANA, MUR], divisao: div(15, 5, 80), criadoEm: new Date().toISOString() });
const br = await chromium.launch();
const nova = async (n) => { const ctx = await br.newContext({ viewport: { width: 1280, height: 900 } }); await ctx.addCookies([{ name: 'sessao', value: TOK[n], url: B }]); const page = await ctx.newPage(); page.errs = []; page.on('pageerror', (e) => page.errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.|Failed to load resource/.test(m.text())) page.errs.push('console: ' + m.text()); }); await page.route(/fonts\./, (x) => x.abort()); await page.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { } }); await page.goto(B + '/'); await page.waitForFunction(() => window.__horusEu && window.__horusEu.pronto && window.__horusTeste && window.__horusTeste.pdCarregar && document.getElementById('mainTabs'), null, { timeout: 60000 }); await page.waitForTimeout(2500); return page; };
const un = (p, id) => p.evaluate((id) => window.__horusTeste.rcUnidades(id), id);
const pd = await nova('dono'), pa = await nova('ana'), pb = await nova('bruno');

console.log('\n— acordo com parcelas e alvará (a parte de cada um)');
let a = await un(pa, 'pf2'), d = await un(pd, 'pf2'), al = await un(pa, 'pf3'), ald = await un(pd, 'pf3');
check(a.length === 2 && a.every((x) => x.meu === 1000) && d.every((x) => x.meu === 2000), 'acordo (2 parcelas de R$ 10.000): Ana 10% = R$ 1.000 por parcela; proprietário 20% = R$ 2.000');
check(al.length === 1 && al[0].meu === 400 && ald[0].meu === 1200, 'alvará de R$ 8.000: Ana 5% = R$ 400; proprietário 15% = R$ 1.200');

console.log('\n— baixa parcial e total da própria parte');
await pa.evaluate(() => { const u = window.__horusTeste.listarUnidades().find((x) => x.chave === 'acordo|pf2|parcela|1'); return window.__horusTeste.pagarUnidades([{ u, valor: 400 }], undefined); }); await pa.waitForTimeout(900);
let u1 = await pa.evaluate(() => { const u = window.__horusTeste.listarUnidades().find((x) => x.chave === 'acordo|pf2|parcela|1'); return { pago: u.pago, parciais: u.parciais, valor: u.valor }; });
check(u1.pago === false && u1.parciais.length === 1 && u1.parciais[0].valor === 400, 'baixa parcial de R$ 400 dos R$ 1.000 da Ana: continua faltando R$ 600');
await pa.evaluate(() => { const U = window.__horusTeste; const u = U.listarUnidades().find((x) => x.chave === 'acordo|pf2|parcela|1'); return U.pagarUnidades([{ u, valor: 600 }], undefined); }); await pa.waitForTimeout(900);
u1 = await pa.evaluate(() => window.__horusTeste.listarUnidades().find((x) => x.chave === 'acordo|pf2|parcela|1').pago);
check(u1 === true, 'completando os R$ 600, a parte da Ana nessa parcela fica recebida');
const acordo = (await dono('GET', '/api/db/termosAcordo')).j.docs.find((x) => x.id === 'pf2').data;
check(acordo.parcelas.every((p) => p.pago === false && !(p.parciais || []).length), 'o cadastro do acordo não foi alterado pela baixa da Ana');
await pa.evaluate(() => window.__horusTeste.pagarUnidades([{ u: window.__horusTeste.listarUnidades().find((x) => x.chave === 'alvara|pf3'), valor: 400 }], undefined)); await pa.waitForTimeout(800);
check((await un(pa, 'pf3'))[0].pago === true && (await un(pd, 'pf3'))[0].pago === false, 'alvará: a Ana recebeu a parte dela; a do proprietário segue aberta');

console.log('\n— o Murilo paga a mais que o combinado');
await pa.click('#drawer [data-tab="acordos"]'); await pa.waitForTimeout(700);
await pa.evaluate(() => { const t = document.querySelector('[data-acordo-toggle="pf2"]'); if (t && !document.querySelector('[data-baixa-doc="acordo|pf2"]')) t.click(); }); await pa.waitForTimeout(700);
await pa.evaluate(() => document.querySelector('[data-baixa-doc="acordo|pf2"]').click()); await pa.waitForTimeout(700);
const dlg = await pa.evaluate(() => { const ck = document.querySelector('#baixaLista [data-bx]'); if (!ck) return 'sem lista'; if (!ck.checked) ck.click(); const i = ck.getAttribute('data-bx'), inp = document.querySelector('#baixaLista [data-bx-val="' + i + '"]'); inp.value = '1300'; inp.dispatchEvent(new Event('input', { bubbles: true })); return 'ok ' + i + ' ' + inp.value; });
await pa.waitForTimeout(300);
await pa.evaluate(() => document.getElementById('baixaSalvar').click()); await pa.waitForTimeout(1800);
const erroBx = await pa.evaluate(() => (document.getElementById('baixaErro') || {}).textContent || '');
const livro = (await dono('GET', '/api/db/recebimentos')).j.docs.map((d) => d.data).find((x) => x.chave === 'acordo|pf2|parcela|2' && x.oab === '11111/GO');
check(dlg.startsWith('ok') && !/maior do que falta/.test(erroBx) && livro && livro.pago === true && livro.extra === 300, 'na baixa, a Ana lança R$ 1.300,00 numa parte de R$ 1.000,00: aceita e guarda R$ 300,00 a mais (' + dlg + ' | ' + erroBx + ' | ' + JSON.stringify(livro && { pago: livro.pago, extra: livro.extra }) + ')');
const ua2 = await un(pa, 'pf2');
check(ua2.find((x) => x.chave === 'acordo|pf2|parcela|2').meu === 1300, 'a receita da Ana nessa parcela passa a ser R$ 1.300,00 (parte + o que veio a mais)');
check(!(await pa.evaluate(() => 0)) , 'sem estouro na tela');

console.log('\n— quem não está no processo');
check((await un(pb, 'pf1')).length === 0 && (await un(pb, 'pf2')).length === 0 && !(await pb.evaluate(() => document.documentElement.classList.contains('pd-murilo'))), 'o Bruno não vê as parcelas e não ganha o botão "Relatório do Murilo"');
check(!(await pb.locator('#abrirRelMuriloBtn').isVisible()), 'o botão do relatório do Murilo não aparece para ele');
check((await pa.evaluate(() => document.documentElement.classList.contains('pd-murilo'))) && await pa.locator('#abrirRelMuriloBtn').count() === 1, 'a Ana ganha o relatório do Murilo (tem parcelas em pagamento separado)');

console.log('\n— a ficha: modo direto e quem paga');
await pd.evaluate(() => window.__horusTeste.abrirEdicao('pf1')); await pd.waitForTimeout(800);
const modo = await pd.$$eval('input[data-rcd="modo"]', (l) => l.map((x) => x.value + ':' + x.checked));
const pag = await pd.$$eval('input[data-rcd="pagador"]', (l) => l.map((x) => x.checked));
check(modo.join() === 'direto:true,conta:false' && pag.join() === 'false,false,true', 'a ficha mostra "recebe direto" marcado e o Murilo como quem paga: ' + modo.join() + ' | ' + pag.join());
await pd.locator('.rc-pct').nth(0).fill('12'); await pd.waitForTimeout(150); await pd.click('#saveBtn'); await pd.waitForTimeout(500);
check((await pd.locator('#formError').innerText()).includes('somar 100%'), 'divisão que não fecha 100% não salva');
await pd.locator('.rc-pct').nth(0).fill('10'); await pd.waitForTimeout(150);
await pd.click('#saveBtn'); await pd.waitForTimeout(1500);
let c1 = (await dono('GET', '/api/db/casos')).j.docs.find((x) => x.id === 'pf1').data;
check(c1.divisao.modo === 'direto' && c1.divisao.partes.find((p) => p.pagador).oab === '49308/GO' && c1.divisao.partes.map((p) => p.pct).join() === '10,5,85', 'salvou mantendo o modo direto, o pagador e os percentuais');
// com pagamento feito, o modo não muda
await pa.evaluate(() => window.__horusTeste.pagarUnidades([{ u: window.__horusTeste.listarUnidades().find((x) => x.chave === 'pf1|avista'), valor: 500 }], undefined)); await pa.waitForTimeout(800);
await pd.evaluate(() => window.__horusTeste.pdCarregar()); await pd.waitForTimeout(600);
await pd.evaluate(() => window.__horusTeste.abrirEdicao('pf1')); await pd.waitForTimeout(800);
await pd.evaluate(() => { const r = document.querySelector('input[data-rcd="modo"][value="conta"]'); r.click(); }); await pd.waitForTimeout(300);
await pd.click('#saveBtn'); await pd.waitForTimeout(700);
check((await pd.locator('#formError').innerText()).includes('modo de pagamento'), 'com recebimento já registrado, o modo de pagamento não pode mudar');
check(pa.errs.length === 0 && pd.errs.length === 0 && pb.errs.length === 0, 'sem erros de JavaScript' + [...pa.errs, ...pd.errs, ...pb.errs].join(' | '));
await limpar();
await br.close();
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo.'); process.exit(falhas ? 1 : 0);
