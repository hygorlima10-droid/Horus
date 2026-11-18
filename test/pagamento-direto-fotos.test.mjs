// Capturas reais das telas do pagamento separado (para o esboço): ficha, parcela com selos, quadro "Pagamentos por pessoa" e relatório do Murilo da advogada.
// Servidor do grupo 'permissoes':  FOTOS=/tmp/fotos node test/rodar.mjs pagamento-direto-fotos
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8816', TOK = { dono: 'tok-dono-0000000000000000000000000001', ana: 'tok-adv-ana-00000000000000000000000002' };
const F = process.env.FOTOS || '/tmp/fotos';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const api = (n) => async (m, p, b) => { const x = await fetch(B + p, { method: m, headers: { cookie: 'sessao=' + TOK[n], 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined }); let j = null; try { j = await x.json(); } catch (e) { } return { s: x.status, j }; };
const dono = api('dono'), ana = api('ana');
const dia = (n) => new Date(Date.now() - 3 * 3600e3 + n * 86400e3).toISOString().slice(0, 10), ontem = dia(-1), mes = dia(0).slice(0, 7);
await dono('PUT', '/api/usuarios/u1', { oabs: ['60456/GO'] });
for (const c of ['recebimentos', 'repasses', 'casos', 'termosAcordo', 'alvaras']) for (const d of (await dono('GET', '/api/db/' + c)).j.docs || []) await dono('DELETE', '/api/db/' + c + '/' + d.id);
const MUR = { oab: '49308/GO', nome: 'Murilo Falone Rocha' }, HYG = { oab: '60456/GO', nome: 'Dono Teste' }, ANA = { oab: '11111/GO', nome: 'Ana Advogada' };
await dono('PUT', '/api/db/casos/ft1', { tipo: 'inicial', origem: 'murilo', prioridade: 'normal', status: 'pendente', cliente: 'Indenizacao Silva', nomeAcao: 'Ação de indenização', numeroProcesso: '0000851-01.2024.8.09.0851', modalidadeHonorario: 'fixo', formaPagamento: 'parcelado', valorHonorarios: 50000, parcelas: [{ numero: 1, valor: 25000, data: ontem, pago: false }, { numero: 2, valor: 25000, data: dia(30), pago: false }], advogados: [HYG, ANA, MUR], divisao: { modo: 'direto', partes: [{ oab: '60456/GO', nome: 'Dono Teste', pct: 10 }, { oab: '11111/GO', nome: 'Ana Advogada', pct: 5 }, { oab: '49308/GO', nome: 'Murilo Falone Rocha', pct: 85, pagador: true }] }, criadoEm: new Date().toISOString() });
await dono('PUT', '/api/db/casos/ft2', { tipo: 'inicial', origem: 'murilo', prioridade: 'normal', status: 'pendente', cliente: 'Contrato Souza', nomeAcao: 'Ação', numeroProcesso: '0000852-02.2024.8.09.0852', modalidadeHonorario: 'fixo', formaPagamento: 'avista', valorHonorarios: 12000, avista: { data: ontem, pago: false }, advogados: [HYG, ANA, MUR], divisao: { modo: 'direto', partes: [{ oab: '60456/GO', nome: 'Dono Teste', pct: 10 }, { oab: '11111/GO', nome: 'Ana Advogada', pct: 5 }, { oab: '49308/GO', nome: 'Murilo Falone Rocha', pct: 85, pagador: true }] }, criadoEm: new Date().toISOString() });
const br = await chromium.launch();
const nova = async (n, w = 1280) => { const ctx = await br.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 2 }); await ctx.addCookies([{ name: 'sessao', value: TOK[n], url: B }]); const page = await ctx.newPage(); await page.route(/fonts\./, (x) => x.abort()); await page.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { } }); await page.goto(B + '/'); await page.waitForFunction(() => window.__horusEu && window.__horusEu.pronto && window.__horusTeste && window.__horusTeste.pdCarregar && document.getElementById('mainTabs'), null, { timeout: 60000 }); await page.waitForTimeout(2500); return page; };
const pa = await nova('ana'), pd = await nova('dono');
// Murilo recebeu do cliente a parcela 1 do ft1 (marcado pela Ana); a Ana já recebeu a parte dela do ft2
await pa.evaluate(() => window.__horusTeste.pdMarcarCliente(window.__horusTeste.pdUnidade('ft1|parcela|1'), true)); await pa.waitForTimeout(600);
// 1) parcela com selos (Ana)
await pa.click('#drawer [data-tab="peticoes"]'); await pa.waitForTimeout(800);
await pa.getByText('Lista', { exact: true }).first().click().catch(() => { }); await pa.waitForTimeout(600);
await pa.locator('.cliente-cell .nome:visible', { hasText: 'Indenizacao Silva' }).first().click(); await pa.waitForTimeout(800);
const card = pa.locator('.pd-chip').first().locator('xpath=ancestor::*[contains(@class,"parcela-row")]/parent::*').first();
await card.screenshot({ path: F + '/pd-parcela.png' }).catch(async () => { await pa.screenshot({ path: F + '/pd-parcela.png' }); });
check((await pa.locator('.pd-chip').count()) >= 2, 'selos nas parcelas');
// 2) relatório da Ana (com a lista "aguardando")
await pa.evaluate(([m]) => window.__horusTeste.abrirRelMurilo(m, 'murilo'), [mes]); await pa.waitForTimeout(500);
await pa.evaluate(() => { document.getElementById('relSel').style.display = ''; }); await pa.waitForTimeout(300);
await pa.locator('#overlayRelMurilo .modal').screenshot({ path: F + '/pd-relatorio.png' });
// 3) painel do proprietário
await pd.evaluate(() => window.__horusTeste.pdCarregar()); await pd.waitForTimeout(600);
await pd.click('#drawer [data-tab="peticoes"]'); await pd.waitForTimeout(800);
await pd.getByText('Lista', { exact: true }).first().click().catch(() => { }); await pd.waitForTimeout(600);
await pd.locator('.cliente-cell .nome:visible', { hasText: 'Indenizacao Silva' }).first().click(); await pd.waitForTimeout(800);
await pd.locator('[data-pd-painel]').first().click(); await pd.waitForTimeout(500);
await pd.locator('#overlayPdPainel .modal').screenshot({ path: F + '/pd-painel.png' });
await pd.evaluate(() => { document.getElementById('overlayPdPainel').classList.remove('show'); });
// 4) ficha
await pd.evaluate(() => window.__horusTeste.abrirEdicao('ft1')); await pd.waitForTimeout(900);
await pd.locator('#rcDiv_casos').screenshot({ path: F + '/pd-ficha.png' });
await br.close();
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo.'); process.exit(falhas ? 1 : 0);
