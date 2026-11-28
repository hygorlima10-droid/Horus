// Fatura do cartão em PDF (modelo parecido com o de bancos grandes): vencimento lido do campo, seções (compras, internacionais, próximas faturas), parcelas, prova pela soma.
// Servidor do grupo 'leitor':  node test/rodar.mjs fatura-pdf-tela
import fs from 'node:fs'; import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8822', TOK = 'tok-dono-0000000000000000000000000001';
const PDFJS = [process.env.PDFJS, '/tmp/claude-0/-home-user/73bc448f-589a-50cb-a941-bd114c59c1e4/scratchpad/pdfjs/package/build/', '/tmp/claude-0/-home-user/73bc448f-589a-50cb-a941-bd114c59c1e4/scratchpad/pdfjs_test/node_modules/pdfjs-dist/build/'].filter(Boolean).find((d) => fs.existsSync(d + 'pdf.min.js'));
if (!PDFJS) { console.log('  (pdf.js local não encontrado: teste ignorado; use PDFJS=/pasta/build/)'); process.exit(0); }
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 1280, height: 1000 } }); await ctx.addCookies([{ name: 'sessao', value: TOK, url: B }]);
const page = await ctx.newPage(); const erros = []; page.on('pageerror', (e) => erros.push(e.message)); await page.route(/fonts\./, (r) => r.abort());
await page.route(/cdnjs.*pdf\.min\.js/, (r) => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(PDFJS + 'pdf.min.js') })); await page.route(/cdnjs.*pdf\.worker\.min\.js/, (r) => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(PDFJS + 'pdf.worker.min.js') }));
const linhas = ['Resumo da fatura em R$', 'Total da fatura anterior 100,00', 'Pagamento efetuado em 09/10/2026 -100,00', 'Lançamentos atuais 330,00', 'Total desta fatura 330,00', 'Pagamento mínimo: R$ 50,00', 'Com vencimento em:', '09/11/2026', 'Titular FULANO DE TESTE', 'Cartão 1111.XXXX.XXXX.2222', 'Postagem: 02/11/2026', 'Vencimento: 09/11/2026', 'Previsão próx. Fechamento: 02/12/2026',
  'Pagamentos efetuados', 'DATA VALOR EM R$', '09/10 Pagamento via conta -100,00', 'Total dos pagamentos -100,00',
  'Lançamentos: compras e saques', 'DATA ESTABELECIMENTO VALOR EM R$', '03/10 SUPERMERCADO TESTE 120,00', 'compras  GOIANIA', '05/10 FARMACIA TESTE 80,00', 'saude  GOIANIA', '20/01 LOJA DA CASA 10/10 60,00', 'casa  GOIANIA', '06/10 ESTORNO PARCIAL -20,00', 'outros  GOIANIA', 'Lançamentos no cartão 240,00',
  'Lançamentos internacionais', 'DATA ESTABELECIMENTO US$ R$', '08/10 SERVICO ONLINE EXTERIOR 86,00', '16,00 BRL 17,00', 'Total transações inter. em R$ 86,00', 'Repasse de IOF em R$ 4,00', 'Total lançamentos inter. em R$ 90,00', 'Total dos lançamentos atuais 330,00',
  'Compras parceladas - próximas faturas', 'DATA ESTABELECIMENTO VALOR EM R$', '20/01 LOJA DA CASA 11/10 60,00', 'Próxima fatura 60,00', 'Total para próximas faturas 60,00', 'Limites de crédito Valor em R$', 'Limite total de crédito 5.000,00'];
// cada linha em seu bloco; a data, o estabelecimento e o valor em células separadas (como no PDF de banco)
const html = '<html><body style="margin:20px;font:13px Arial;width:900px">' + linhas.map((l) => { const m = /^(\d{2}\/\d{2}) (.+?) (-?[\d.]+,\d{2})$/.exec(l); return m ? `<div style="display:flex;gap:40px"><span style="width:60px">${m[1]}</span><span style="width:500px">${m[2]}</span><span style="width:100px;text-align:right">${m[3]}</span></div>` : `<div>${l}</div>`; }).join('') + '</body></html>';
const pg = await ctx.newPage(); await pg.setContent(html); await pg.pdf({ path: '/tmp/fatura-teste.pdf', width: '1000px', printBackground: true }); await pg.close();
await page.goto(B + '/'); await page.waitForTimeout(2500);
await page.evaluate(() => document.querySelector('#drawer [data-tab="extratos"]').click()); await page.waitForTimeout(1200);
await page.evaluate(() => { document.getElementById('impArq').style.display = 'block'; });
page.on('console', (m) => { if (/^DCM-PDF/.test(m.text())) fs.writeFileSync('/tmp/dcm-pdf-fatura.txt', m.text()); }); await page.evaluate(() => { window.__dcmDebug = true; });
await page.setInputFiles('#impArq', process.env.FATURA_REAL || '/tmp/fatura-teste.pdf'); await page.waitForTimeout(5000);
const t = await page.evaluate(() => (document.getElementById('fatCartao') || { innerText: '' }).innerText.replace(/\s+/g, ' '));
if (process.env.DEBUG_FT) console.log('DEBUG-T', t.slice(0, 1800));
if (process.env.FATURA_REAL) { console.log('REAL:', t.slice(0, 2500)); await br.close(); process.exit(0); }
check(/Faturas para conferir \(1\)/.test(t) && /soma confere/.test(t), 'a fatura em PDF é lida como fatura de cartão (não como extrato nem boleto) e a soma confere com o "Total dos lançamentos atuais"');
check(await page.evaluate(() => document.querySelector('#fatCartao input[type=date]').value) === '2026-11-09', 'o vencimento vem do campo "Vencimento: 09/11/2026" (não da previsão do próximo fechamento, 02/12/2026)');
check(/final 2222/.test(t) && /6 compras|5 compras|4 compras/.test(t), 'final do cartão e quantidade de compras lidos');
check(/Supermercado/.test(t) && /Farmácia/.test(t), 'categorias reconhecidas por palavras (Supermercado, Farmácia)');
check(/Comprometido nas próximas faturas: R\$ 60,00/.test(t), 'as parcelas das próximas faturas (R$ 60,00) aparecem como comprometidas e não entram no gasto');
check(!/Pagamento via conta/.test(t) && /R\$ 330,00 total lido/.test(t), 'pagamentos efetuados não entram como compra (total lido R$ 330,00 = Total dos lançamentos atuais)');
check(/Estorno parcial/i.test(t) && /-R\$ 20,00/.test(t), 'estorno (valor negativo) abate da fatura');
check(erros.length === 0, 'sem erros de script' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
