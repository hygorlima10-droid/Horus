// Prova que a divisão dos honorários funciona com MAIS DE DUAS pessoas (proprietário, Ana e Bruno), no cadastro, nos repasses e na parte de cada um.
// Servidor individual com banco semeado (grupo 'permissoes'):  node test/rodar.mjs divisao-varios
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8816', TOK = { dono: 'tok-dono-0000000000000000000000000001', ana: 'tok-adv-ana-00000000000000000000000002', bruno: 'tok-adv-bruno-000000000000000000000003' };
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const api = (n) => async (m, p, b) => { const x = await fetch(B + p, { method: m, headers: { cookie: 'sessao=' + TOK[n], 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined }); let j = null; try { j = await x.json(); } catch (e) { } return { s: x.status, j }; };
const dono = api('dono');
const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
await dono('PUT', '/api/usuarios/u1', { oabs: ['60456/GO'] });
for (const d of (await dono('GET', '/api/db/repasses')).j.docs) await dono('DELETE', '/api/db/repasses/' + d.id);
const A = [{ oab: '60456/GO', nome: 'Dono Teste' }, { oab: '11111/GO', nome: 'Ana Advogada' }, { oab: '22222/GO', nome: 'Bruno Advogado' }];
await dono('PUT', '/api/db/casos/dv3', { tipo: 'inicial', origem: 'murilo', prioridade: 'normal', status: 'pendente', cliente: 'Cliente Tres Partes', nomeAcao: 'Ação', numeroProcesso: '0000811-11.2024.8.09.0811', modalidadeHonorario: 'fixo', formaPagamento: 'parcelado', valorHonorarios: 1000, parcelas: [{ numero: 1, valor: 1000, data: hoje, pago: false }], advogados: A, divisao: { partes: [{ oab: '60456/GO', nome: 'Dono Teste', pct: 50 }, { oab: '11111/GO', nome: 'Ana Advogada', pct: 30 }, { oab: '22222/GO', nome: 'Bruno Advogado', pct: 20 }] }, criadoEm: new Date().toISOString() });
const br = await chromium.launch();
const nova = async (n) => { const ctx = await br.newContext({ viewport: { width: 1280, height: 900 } }); await ctx.addCookies([{ name: 'sessao', value: TOK[n], url: B }]); const page = await ctx.newPage(); page.errs = []; page.on('pageerror', (e) => page.errs.push(e.message)); await page.route(/fonts\./, (x) => x.abort()); await page.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { } }); await page.goto(B + '/'); await page.waitForFunction(() => window.__horusEu && window.__horusEu.pronto && window.__horusTeste && window.__horusTeste.abrirEdicao, null, { timeout: 60000 }); await page.waitForTimeout(2500); return page; };

console.log('\n— cadastro com 3 pessoas');
const pd = await nova('dono');
await pd.evaluate(() => window.__horusTeste.abrirEdicao('dv3')); await pd.waitForTimeout(800);
const dv = await pd.locator('#rcDiv_casos').innerText(), pcts = await pd.$$eval('.rc-pct', (l) => l.map((x) => x.value)).catch(() => []);
check(/Dono Teste/.test(dv) && /Ana Advogada/.test(dv) && /Bruno Advogado/.test(dv) && /Soma 100%/.test(dv) && pcts.join() === '50,30,20', 'a ficha mostra as 3 linhas (50% + 30% + 20%) e soma 100%: ' + pcts.join() + ' · ' + dv.replace(/\n/g, ' ').slice(0, 110));
if (process.env.FOTOS) await pd.locator('#rcDiv_casos').screenshot({ path: process.env.FOTOS + '/div3-ficha.png' }).catch(() => { });
await pd.evaluate(() => { const o = document.querySelector('#overlay'); o && o.classList.remove('show'); });

console.log('\n— a parte de cada um');
const partes = {};
for (const q of ['dono', 'ana', 'bruno']) { const p = q === 'dono' ? pd : await nova(q); partes[q] = await p.evaluate(() => window.__horusTeste.rcUnidades('dv3')); if (q !== 'dono') await p.context().close(); }
check(partes.dono[0].meu === 500 && partes.ana[0].meu === 300 && partes.bruno[0].meu === 200, 'cada um enxerga a parte dele: proprietário R$ 500, Ana R$ 300, Bruno R$ 200 (' + ['dono', 'ana', 'bruno'].map((q) => partes[q][0].meu).join(' / ') + ')');

console.log('\n— a Ana recebe tudo: repasse para os outros dois');
const pa = await nova('ana');
await pa.evaluate(() => window.__horusTeste.marcarParcela('dv3', 1, true));
await pa.waitForSelector('#overlayRcConta.show', { timeout: 6000 }).catch(() => { });
const t = await pa.locator('#overlayRcContaC').innerText().catch(() => '');
check(/Bruno Advogado · 20%/.test(t) && /Dono Teste · 50%/.test(t) && /Você repassa\s*R\$\s*700,00/.test(t), 'o app pergunta em que conta entrou e mostra as 3 partes (Ana repassa R$ 700): ' + t.replace(/\n/g, ' ').slice(0, 160));
if (process.env.FOTOS) await pa.locator('#overlayRcContaC').screenshot({ path: process.env.FOTOS + '/div3-conta.png' }).catch(() => { });
await pa.click('[data-rcq="ok"]').catch(() => { }); await pa.waitForTimeout(2500);
const rs = (await dono('GET', '/api/db/repasses')).j.docs.map((d) => d.data);
const v = (oab) => (rs.find((r) => r.para.oab === oab && r.de.oab === '11111/GO') || {}).valor;
check(rs.length === 2 && v('60456/GO') === 500 && v('22222/GO') === 200, 'nascem 2 repasses a partir da Ana: R$ 500 para o proprietário e R$ 200 para o Bruno (' + rs.map((r) => r.para.nome + ' ' + r.valor).join(' · ') + ')');
check(pd.errs.length === 0 && pa.errs.length === 0, 'sem erros de JavaScript' + [...pd.errs, ...pa.errs].join(' | '));
await br.close();
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo.'); process.exit(falhas ? 1 : 0);
