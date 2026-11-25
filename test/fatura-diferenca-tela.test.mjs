// Fatura do cartão em PDF em que o TOTAL DA FATURA é maior que as compras (resto da fatura anterior): o app explica a diferença, deixa escolher se a despesa vai pelo total do banco ou só pelas compras, e abre os lançamentos de cada categoria para a última conferência.
// Servidor do grupo 'leitor':  node test/rodar.mjs fatura-diferenca-tela
import fs from 'node:fs'; import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8822', TOK = 'tok-dono-0000000000000000000000000001';
const PDFJS = [process.env.PDFJS, '/tmp/claude-0/-home-user/73bc448f-589a-50cb-a941-bd114c59c1e4/scratchpad/pdfjs/package/build/', '/tmp/claude-0/-home-user/73bc448f-589a-50cb-a941-bd114c59c1e4/scratchpad/pdfjs_test/node_modules/pdfjs-dist/build/'].filter(Boolean).find((d) => fs.existsSync(d + 'pdf.min.js'));
if (!PDFJS) { console.log('  (pdf.js local não encontrado: teste ignorado; use PDFJS=/pasta/build/)'); process.exit(0); }
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 1280, height: 1000 } }); await ctx.addCookies([{ name: 'sessao', value: TOK, url: B }]);
const page = await ctx.newPage(); const erros = []; page.on('pageerror', (e) => erros.push(e.message)); await page.route(/fonts\./, (r) => r.abort());
await page.route(/cdnjs.*pdf\.min\.js/, (r) => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(PDFJS + 'pdf.min.js') })); await page.route(/cdnjs.*pdf\.worker\.min\.js/, (r) => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(PDFJS + 'pdf.worker.min.js') }));
const linhas = ['Resumo da fatura em R$', 'Total da fatura anterior 1.000,00', 'Pagamento efetuado em 09/10/2026 -1.000,00', 'Saldo financiado 0,00', 'Lançamentos atuais 500,00', 'Total desta fatura 800,00', 'Pagamento mínimo: R$ 80,00', 'Com vencimento em:', '09/11/2026', 'Titular FULANO DE TESTE', 'Cartão 1111.XXXX.XXXX.2222', 'Postagem: 02/11/2026', 'Vencimento: 09/11/2026', 'Previsão próx. Fechamento: 02/12/2026',
  'Pagamentos efetuados', 'DATA VALOR EM R$', '09/10 Pagamento via conta -700,00', 'Total dos pagamentos -1.000,00',
  'Lançamentos: compras e saques', 'DATA ESTABELECIMENTO VALOR EM R$', '03/10 SUPERMERCADO TESTE 300,00', 'compras  GOIANIA', '05/10 FARMACIA TESTE 150,00', 'saude  GOIANIA', '06/10 LOJA SEM NOME 50,00', 'outros  GOIANIA', 'Lançamentos no cartão 500,00',
  'Total dos lançamentos atuais 500,00', 'Limites de crédito Valor em R$', 'Limite total de crédito 5.000,00'];
const html = '<html><body style="margin:20px;font:13px Arial;width:900px">' + linhas.map((l) => { const m = /^(\d{2}\/\d{2}) (.+?) (-?[\d.]+,\d{2})$/.exec(l); return m ? `<div style="display:flex;gap:40px"><span style="width:60px">${m[1]}</span><span style="width:500px">${m[2]}</span><span style="width:100px;text-align:right">${m[3]}</span></div>` : `<div>${l}</div>`; }).join('') + '</body></html>';
const pg = await ctx.newPage(); await pg.setContent(html); await pg.pdf({ path: '/tmp/fatura-diferenca.pdf', width: '1000px', printBackground: true }); await pg.close();
await page.goto(B + '/'); await page.waitForTimeout(2500);
await page.evaluate(() => document.querySelector('#drawer [data-tab="extratos"]').click()); await page.waitForTimeout(1200);
await page.evaluate(() => { document.getElementById('impArq').style.display = 'block'; });
await page.setInputFiles('#impArq', '/tmp/fatura-diferenca.pdf'); await page.waitForTimeout(5000);
const txt = () => page.evaluate(() => (document.getElementById('fatCartao') || { innerText: '' }).innerText.replace(/\s+/g, ' '));
let t = await txt();
check(/R\$ 500,00 total lido/.test(t) && /fatura R\$ 800,00/.test(t), 'lê as compras (R$ 500,00) e o total da fatura (R$ 800,00) separadamente');
check(/O total da fatura \(R\$ 800,00\) é maior que as compras lidas \(R\$ 500,00\)/.test(t) && /Resto da fatura anterior R\$ 300,00/.test(t), 'explica a diferença de R$ 300,00 como resto da fatura anterior');
check(/A fatura anterior foi de R\$ 1\.000,00 e o pagamento listado nesta fatura é de R\$ 700,00/.test(t) && /resumo do banco indica R\$ 1\.000,00/.test(t), 'mostra de onde vem: fatura anterior R$ 1.000,00 menos o pagamento listado de R$ 700,00');
check(/Total a pagar \(como o banco cobra\) R\$ 800,00/.test(t), 'mostra o total a pagar como o banco cobra');
// categorias: abrir para ver o que o app reconheceu
check(!/03\/10 · SUPERMERCADO TESTE/i.test(t), 'as categorias começam fechadas');
await page.click('[data-fat="cats-todas"]'); await page.waitForTimeout(500); t = await txt();
check(/03\/10(\/2026)? · SUPERMERCADO TESTE R\$ 300,00/i.test(t) && /05\/10(\/2026)? · FARMACIA TESTE R\$ 150,00/i.test(t), '"Ver todos os lançamentos" abre cada categoria com data, estabelecimento e valor');
await page.click('[data-fat="cats-todas"]'); await page.waitForTimeout(400); t = await txt();
check(!/03\/10 · SUPERMERCADO TESTE/i.test(t), '"Fechar todas" recolhe de novo');
await page.click('[data-fat="cat"]'); await page.waitForTimeout(400); t = await txt();
check(/ · (SUPERMERCADO|FARMACIA) TESTE R\$/i.test(t), 'tocar numa categoria abre só os lançamentos dela');
// despesa pelo total do banco (padrão)
await page.fill('#fatCartao input[type=date] >> nth=0', '2026-11-09').catch(() => {});
await page.click('[data-fat="confirmar"]'); await page.waitForTimeout(2500);
const despesas = () => page.evaluate(async () => (await (await fetch('/api/db/despesas')).json()).docs.map((d) => ({ id: d.id, ...d.data })));
let ds = (await despesas()).filter((d) => d.faturaId);
check(ds.length === 1 && ds[0].valor === 800, 'por padrão a despesa da fatura é pelo total do banco (R$ 800,00)');
// desmarcar a diferença: a despesa fica só com as compras
await page.evaluate(async () => { const j = await (await fetch('/api/db/despesas')).json(); for (const d of j.docs.filter((x) => x.data.faturaId)) await fetch('/api/db/despesas/' + d.id, { method: 'DELETE' }); const e = await (await fetch('/api/db/extratos')).json(); for (const d of e.docs.filter((x) => x.data.tipo === 'diaadia' || (x.data.tipo === 'documento' && x.data.kind === 'fatura'))) await fetch('/api/db/extratos/' + d.id, { method: 'DELETE' }); });
await page.reload(); await page.waitForTimeout(2500);
await page.evaluate(() => document.querySelector('#drawer [data-tab="extratos"]').click()); await page.waitForTimeout(1200);
await page.evaluate(() => { document.getElementById('impArq').style.display = 'block'; });
await page.setInputFiles('#impArq', '/tmp/fatura-diferenca.pdf'); await page.waitForTimeout(5000);
await page.uncheck('[data-fat-dif]'); await page.waitForTimeout(300);
await page.click('[data-fat="confirmar"]'); await page.waitForTimeout(2500);
ds = (await despesas()).filter((d) => d.faturaId);
check(ds.length === 1 && ds[0].valor === 500, 'com a diferença desmarcada a despesa da fatura fica só com as compras (R$ 500,00)');
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
