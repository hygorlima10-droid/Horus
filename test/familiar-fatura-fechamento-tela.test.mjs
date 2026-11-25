// Fatura de cartão no PERFIL FAMILIAR: entra no mês do FECHAMENTO (25 ou 26, muda de mês a mês): lido do PDF ou perguntado na conferência.
// A despesa da fatura e as compras ficam no mês do fechamento (mesmo que a compra seja do mês anterior). Servidor do grupo 'familiar':  node test/rodar.mjs familiar-fatura-fechamento-tela
import fs from 'node:fs'; import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8820', TOK = 'tok-fam-fin-0000000000000000000000000007';
const PDFJS = [process.env.PDFJS, '/tmp/claude-0/-home-user/73bc448f-589a-50cb-a941-bd114c59c1e4/scratchpad/pdfjs/package/build/', '/tmp/claude-0/-home-user/73bc448f-589a-50cb-a941-bd114c59c1e4/scratchpad/pdfjs_test/node_modules/pdfjs-dist/build/'].filter(Boolean).find((d) => fs.existsSync(d + 'pdf.min.js'));
if (!PDFJS) { console.log('  (pdf.js local não encontrado: teste ignorado; use PDFJS=/pasta/build/)'); process.exit(0); }
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 1280, height: 1000 } }); await ctx.addCookies([{ name: 'sessao', value: TOK, url: B }]);
const page = await ctx.newPage(); const erros = []; page.on('pageerror', (e) => erros.push(e.message)); await page.route(/fonts\./, (r) => r.abort());
await page.route(/cdnjs.*pdf\.min\.js/, (r) => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(PDFJS + 'pdf.min.js') })); await page.route(/cdnjs.*pdf\.worker\.min\.js/, (r) => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(PDFJS + 'pdf.worker.min.js') }));
const linhas = ['Resumo da fatura em R$', 'Total da fatura anterior 100,00', 'Pagamento efetuado em 09/11/2026 -100,00', 'Lançamentos atuais 330,00', 'Total desta fatura 330,00', 'Com vencimento em:', '02/12/2026', 'Titular FULANO DE TESTE', 'Cartão 1111.XXXX.XXXX.2222', 'Vencimento: 02/12/2026', 'Fechamento da fatura: 25/11/2026', 'Previsão próx. Fechamento: 26/12/2026',
  'Pagamentos efetuados', 'DATA VALOR EM R$', '09/11 Pagamento via conta -100,00', 'Total dos pagamentos -100,00',
  'Lançamentos: compras e saques', 'DATA ESTABELECIMENTO VALOR EM R$', '18/10 SUPERMERCADO TESTE 120,00', 'compras  GOIANIA', '05/11 FARMACIA TESTE 80,00', 'saude  GOIANIA', '20/11 LOJA DA CASA 130,00', 'casa  GOIANIA', 'Total dos lançamentos atuais 330,00', 'Limites de crédito Valor em R$', 'Limite total de crédito 5.000,00'];
const html = '<html><body style="margin:20px;font:13px Arial;width:900px">' + linhas.map((l) => { const m = /^(\d{2}\/\d{2}) (.+?) (-?[\d.]+,\d{2})$/.exec(l); return m ? `<div style="display:flex;gap:40px"><span style="width:60px">${m[1]}</span><span style="width:360px">${m[2]}</span><span>${m[3]}</span></div>` : `<div>${l}</div>`; }).join('') + '</body></html>';
const pg = await ctx.newPage(); await pg.setContent(html); await pg.pdf({ path: '/tmp/fatura-familiar-fecha.pdf', width: '1000px', printBackground: true }); await pg.close();
fs.writeFileSync('/tmp/fatura-familiar-sem-fecha.csv', ['date,title,amount', '2026-10-30,Mercado Teste,"200,00"', '2026-11-12,Padaria Teste,"40,00"', '2026-11-20,Farmacia Teste,"60,00"'].join('\n'));
await page.goto(B + '/'); await page.waitForTimeout(2500);
await page.evaluate(() => document.querySelector('#drawer [data-tab="extratos"]').click()); await page.waitForTimeout(1200);
await page.evaluate(() => { document.getElementById('impArq').style.display = 'block'; });
const txt = () => page.evaluate(() => (document.getElementById('fatCartao') || { innerText: '' }).innerText.replace(/\s+/g, ' '));
const dados = () => page.evaluate(async () => { const e = (await (await fetch('/api/db/extratos')).json()).docs.map((d) => ({ id: d.id, ...d.data })), d = (await (await fetch('/api/db/despesas')).json()).docs.map((x) => ({ id: x.id, ...x.data })); return { dd: e.filter((x) => x.tipo === 'diaadia' && x.origem === 'cartao'), desp: d.filter((x) => x.faturaId) }; });
// (A) PDF com a data de fechamento
await page.setInputFiles('#impArq', '/tmp/fatura-familiar-fecha.pdf'); await page.waitForTimeout(5000);
let t = await txt();
if (process.env.DEBUG_FT) console.log('DEBUG', t.slice(0, 900));
check(/Dia de fechamento lido no arquivo: 25\/11\/2026/.test(t) && /novembro de 2026/.test(t), 'PDF: o dia de fechamento (25/11/2026) é lido e a fatura entra em novembro');
check(await page.evaluate(() => document.querySelectorAll('#fatCartao input[type=date]')[1].value) === '2026-11-25', 'o campo do dia de fechamento já vem preenchido com 25/11/2026 (e não com o do próximo fechamento)');
check(/Dia em que o cartão fechou/.test(t), 'no familiar o campo se chama "Dia em que o cartão fechou"');
await page.click('#fatCartao [data-fat="confirmar"]'); await page.waitForTimeout(2500);
let D = await dados();
check(D.desp.length === 1 && D.desp[0].mesReferencia === '2026-11' && D.desp[0].data === '2026-12-02', 'a despesa da fatura entra no mês do fechamento (novembro) e guarda o VENCIMENTO (02/12) como data, para a Central de atenção');
check(D.dd.length === 1 && D.dd[0].mes === '2026-11' && D.dd[0].linhas.length === 3 && D.dd[0].linhas.some((l) => l.d === '2026-10-18'), 'as compras ficam no mês do fechamento (inclusive a de 18/10), cada uma com a data verdadeira');
// (B) CSV: não traz o fechamento, o app pergunta
await page.evaluate(async () => { const e = (await (await fetch('/api/db/extratos')).json()).docs; for (const d of e.filter((x) => x.data.tipo === 'diaadia' || (x.data.tipo === 'documento' && x.data.kind === 'fatura'))) await fetch('/api/db/extratos/' + d.id, { method: 'DELETE' }); const s = (await (await fetch('/api/db/despesas')).json()).docs; for (const d of s.filter((x) => x.data.faturaId)) await fetch('/api/db/despesas/' + d.id, { method: 'DELETE' }); });
await page.reload(); await page.waitForTimeout(2500);
await page.evaluate(() => document.querySelector('#drawer [data-tab="extratos"]').click()); await page.waitForTimeout(1200);
await page.evaluate(() => { document.getElementById('impArq').style.display = 'block'; });
await page.setInputFiles('#impArq', '/tmp/fatura-familiar-sem-fecha.csv'); await page.waitForTimeout(3500); t = await txt();
check(/Não achei o dia de fechamento no arquivo/.test(t) && /Informe o dia em que o cartão fechou/.test(t), 'CSV: o app pergunta o dia em que o cartão fechou');
await page.fill('#fatCartao input[type=date] >> nth=0', '2026-12-02'); await page.dispatchEvent('#fatCartao input[type=date] >> nth=0', 'change'); await page.waitForTimeout(500);
check(await page.evaluate(() => document.querySelectorAll('#fatCartao input[type=date]')[1].value) === '2026-11-26', 'sem a data no arquivo, sugere o dia 26 anterior ao vencimento (26/11/2026)');
await page.fill('#fatCartao input[type=date] >> nth=1', '2026-11-25'); await page.dispatchEvent('#fatCartao input[type=date] >> nth=1', 'change'); await page.waitForTimeout(400);
await page.click('#fatCartao [data-fat="confirmar"]'); await page.waitForTimeout(2500); D = await dados();
if (process.env.DEBUG_FT) console.log('DEBUG-D', JSON.stringify({ d: D.desp.map((x) => [x.mesReferencia, x.data, x.valor]), dd: D.dd.map((x) => [x.id, x.mes]) }));
check(D.desp.length === 1 && D.desp[0].mesReferencia === '2026-11' && D.desp[0].data === '2026-12-02' && D.dd.every((d) => d.mes === '2026-11'), 'a pessoa informou o fechamento 25/11 e o vencimento 02/12: despesa e compras em novembro, vencimento guardado');
// (C) lançamentos de cartão que JÁ existiam: seguem a regra do fechamento sozinhos (sem reenviar nada)
const mes0 = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 7), ant = (() => { const d = new Date(Date.now() - 3 * 3600e3); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 7); })();
await page.evaluate(async ({ mes0, ant }) => {
  const put = (id, b) => fetch('/api/db/extratos/' + id, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
  await put('dcm_antiga', { tipo: 'documento', kind: 'fatura', status: 'concluido', titulo: 'antiga', dados: { vencimento: mes0 + '-28', fechamento: mes0 + '-25', total: 20000, soma: 20000 } });
  await put('dd_' + ant + '_cartao_antiga', { tipo: 'diaadia', mes: ant, conta: 'cartao:dcm_antiga', coluna: 'pf', origem: 'cartao', fatura: 'dcm_antiga', cats: { Outros: { v: 80, n: 1 } }, linhas: [{ id: 'ant1', d: ant + '-28', t: 'COMPRA ANTIGA DO MES ANTERIOR', v: 80, c: 'Outros', h: 'ant1' }], atualizadoEm: Date.now() });
  await put('dd_' + mes0 + '_cartao_antiga', { tipo: 'diaadia', mes: mes0, conta: 'cartao:dcm_antiga', coluna: 'pf', origem: 'cartao', fatura: 'dcm_antiga', cats: { Outros: { v: 120, n: 1 } }, linhas: [{ id: 'ant2', d: mes0 + '-10', t: 'COMPRA ANTIGA DO MES', v: 120, c: 'Outros', h: 'ant2' }], atualizadoEm: Date.now() });
}, { mes0, ant });
await page.evaluate(async ({ mes0 }) => { await fetch('/api/db/despesas/dcmantiga', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome: 'Fatura Antiga final 0001', coluna: 'pf', tipo: 'unica', categoria: 'cartao', valor: 200, data: mes0 + '-25', mesReferencia: mes0, pago: false, faturaId: 'dcm_antiga', faturaChave: 'a', origemDocumento: true, criadoEm: '2026-01-01T00:00:00.000Z' }) }); }, { mes0 });
await page.reload(); await page.waitForTimeout(2500);
await page.evaluate(() => document.querySelector('#drawer .dr-it[data-fin="despesas"]').click()); await page.waitForTimeout(1000);
await page.evaluate(() => document.querySelector('[data-dsp-f="origem"][data-v="cartao"]').click()); await page.waitForTimeout(500);
const dl = await page.evaluate(() => (document.getElementById('dspLin') || { innerText: '' }).innerText.replace(/\s+/g, ' '));
const venc = await page.evaluate(() => window.__horusTeste && window.__horusTeste.despesaVenc ? window.__horusTeste.despesaVenc('dcmantiga') : null);
check(venc === mes0 + '-28', 'a despesa da fatura já lançada com a data do fechamento passa a mostrar o vencimento (dia 28)');
check(/COMPRA ANTIGA DO MES ANTERIOR/i.test(dl) && /COMPRA ANTIGA DO MES/i.test(dl), 'faturas já lançadas: as compras (inclusive as do mês anterior) aparecem no mês do fechamento, sem reenviar a fatura');
check(erros.length === 0, 'sem erros de script' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
