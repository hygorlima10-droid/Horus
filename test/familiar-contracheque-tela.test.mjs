// Contracheque de servidor no perfil familiar (com Finanças): lê o PDF no modelo padrão do Estado de Goiás (exemplo enviado), separa proventos e descontos pela conta,
// mostra consignados e extras, vira o salário previsto do mês e a estimativa do mês seguinte.   Servidor do grupo 'familiar':  node test/rodar.mjs familiar-contracheque-tela
import fs from 'node:fs'; import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8820', TOK = 'tok-fam-fin-0000000000000000000000000007';
const PDFJS = [process.env.PDFJS, '/tmp/claude-0/-home-user/73bc448f-589a-50cb-a941-bd114c59c1e4/scratchpad/pdfjs/package/build/', '/tmp/claude-0/-home-user/73bc448f-589a-50cb-a941-bd114c59c1e4/scratchpad/pdfjs_test/node_modules/pdfjs-dist/build/'].filter(Boolean).find((d) => fs.existsSync(d + 'pdf.min.js'));
if (!PDFJS) { console.log('  (pdf.js local não encontrado: teste ignorado; use PDFJS=/pasta/do/pdfjs/build/)'); process.exit(0); }
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 1280, height: 1000 } }); await ctx.addCookies([{ name: 'sessao', value: TOK, url: B }]);
const page = await ctx.newPage(); const erros = [], recusados = []; page.on('pageerror', (e) => erros.push(e.message)); page.on('response', (r) => { if (r.url().startsWith(B + '/api/') && r.status() >= 400 && r.status() !== 404) recusados.push(r.status() + ' ' + r.url().replace(B, '')); });
await page.route(/fonts\./, (r) => r.abort());
await page.route(/cdnjs.*pdf\.min\.js/, (r) => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(PDFJS + 'pdf.min.js') })); await page.route(/cdnjs.*pdf\.worker\.min\.js/, (r) => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(PDFJS + 'pdf.worker.min.js') }));
// PDF no layout do contracheque (cabeçalho, tabela código/descrição/QTDE/valor e rodapé com os totais)
const T = [['200027', 'SUBSIDIO EFETIVO', '200', '11.167,31'], ['200041', 'ABONO FARDAMENTO', '0', '50,04'], ['200044', 'LOCALIDADE - AC3', '55', '552,00'], ['200042', 'FARDAMENTO', '0', '50,04'], ['200045', 'FAS - MILITAR - ATIVO', '0', '59,29'], ['800004', 'IRRF', '0', '1.852,55'], ['800338', 'CONTRIBUICAO PENSAO E INATIVIDADE', '0', '1.172,57'], ['900044', 'IPASGO BASICO - 6,81%', '0', '680,64'], ['900128', 'BANCO INTERMEDIUM - EMPRESTIMO 01', '25 de 96', '294,00'], ['900235', 'BANCO SAFRA - EMPRESTIMO 01', '31 de 96', '414,70'], ['900236', 'BRB - EMPRESTIMO 01', '13 de 96', '790,05'], ['900378', 'UNIMIL - CONTRIBUICAO', '1', '82,00'], ['900407', 'BRB - EMPRESTIMO 02', '13 de 96', '342,40'], ['900414', 'BRB - EMPRESTIMO 03', '13 de 96', '263,11'], ['900415', 'BRB - EMPRESTIMO 04', '13 de 96', '1.092,60'], ['900424', 'BANCO SAFRA - EMPRESTIMO 02', '15 de 96', '492,90'], ['900507', 'BANCO SANTANDER BRASIL - EMPRESTIMO 02', '10 de 96', '107,74'], ['900508', 'BANCO SANTANDER BRASIL - EMPRESTIMO 03', '6 de 96', '111,00'], ['900685', 'VEMCARD - CARTAO BENEFICIO - SAQUE - LEI 22.449', '1', '1.116,73']];
const cel = [['Nome Órgão', 80, 20], ['Município', 620, 20], ['POLÍCIA MILITAR', 80, 40], ['PLANALTINA', 620, 40], ['Nome Servidor', 20, 90], ['CPF', 620, 90], ['SERVIDOR DE EXEMPLO DA SILVA', 20, 110], ['000.000.000-00', 620, 110], ['PIS/PASEP', 20, 140], ['Cart. Identidade', 160, 140], ['Data Início Exercício', 440, 140], ['Referência', 650, 140], ['000.00000.00-0', 20, 160], ['00000', 160, 160], ['01/04/1996', 440, 160], ['Abril/2024', 650, 160], ['Cargo', 20, 190], ['Diploma Legal', 570, 190], ['Primeiro Sargento - Lei 15.668', 20, 210], ['Lei 15668', 570, 210], ['PROVENTOS/DESCONTOS', 280, 260], ['QTDE', 640, 260], ['VALOR', 790, 260]];
T.forEach(([c, d, q, v], i) => { const y = 290 + i * 22; cel.push([c, 20, y], [d, 75, y], [q, 680, y, 'd'], [v, 850, y, 'd']); });
const yb = 290 + T.length * 22 + 30; cel.push(['Valor FGTS', 20, yb], ['Rendimentos', 220, yb], ['Descontos', 440, yb], ['Líquido', 690, yb], ['0,00', 20, yb + 22], ['11.769,35', 220, yb + 22], ['8.922,32', 440, yb + 22], ['2.847,03', 690, yb + 22], ['Base IRRF', 20, yb + 60], ['9.994,74', 20, yb + 82], ['Valor Limite Consig', 20, yb + 120], ['Valor Limite Cartão', 200, yb + 120], ['Facult', 20, yb + 136], ['Benefício', 200, yb + 136], ['3.908,56', 20, yb + 158], ['1.116,73', 200, yb + 158]);
const gerar = async (arq, celulas) => { const html = '<html><body style="margin:0;font:13px Arial">' + celulas.map(([t, x, y, d]) => '<div style="position:absolute;white-space:nowrap;top:' + y + 'px;' + (d ? 'right:' + (900 - x) + 'px' : 'left:' + x + 'px') + '">' + t.replace(/&/g, '&amp;') + '</div>').join('') + '</body></html>'; const p = await ctx.newPage(); await p.setContent(html); await p.pdf({ path: arq, width: '900px', height: '1000px', printBackground: true }); await p.close(); };
await gerar('/tmp/lg-contracheque.pdf', cel);
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'], fimDe = (mes, n) => { const d = new Date(Date.UTC(+mes.slice(0, 4), +mes.slice(5, 7) - 1 + n, 1)); return MESES[d.getUTCMonth()] + ' de ' + d.getUTCFullYear(); };
const hoje = new Date().toISOString().slice(0, 7), prox = new Date(Date.UTC(+hoje.slice(0, 4), +hoje.slice(5, 7), 1)).toISOString().slice(0, 7);

await page.goto(B + '/'); await page.waitForTimeout(2500);
await page.evaluate(() => document.querySelector('#drawer .dr-it[data-fin="pf"]').click()); await page.waitForTimeout(1200);
const card = () => page.evaluate(() => (document.getElementById('ccqCard') || { innerText: '' }).innerText.replace(/\s+/g, ' '));
check(/Ainda não há contracheque/.test(await card()) && /Ler contracheque/.test(await card()), 'em "Salário e fixos" aparece o cartão "Contracheque" pedindo o PDF ou a foto');
await page.setInputFiles('#ccqArq', '/tmp/lg-contracheque.pdf'); await page.waitForTimeout(5000);
let t = await card();
check(/Contracheque lido · abril de 2024/i.test(t) && /Bruto R\$ 11\.769,35/.test(t) && /Descontos em folha R\$ 8\.922,32/.test(t) && /Líquido R\$ 2\.847,03/.test(t), 'o PDF foi lido: abril/2024, bruto R$ 11.769,35, descontos R$ 8.922,32 e líquido R$ 2.847,03 (' + t.slice(0, 140) + ')');
check(/19 linhas · 9 consignados/.test(t) && /lido sem modelo · confere/.test(t), '19 linhas, 9 consignados e selo VERDE (fecha com os totais)');
check(!/000\.000\.000|SERVIDOR DE EXEMPLO/.test(t), 'o cartão não mostra CPF nem nome do servidor');
// REGRA: o contracheque é de um mês (referência) e cai no MÊS SEGUINTE. Confirmo com a referência do mês passado: o salário cai no mês atual.
const prev = (() => { const d = new Date(Date.UTC(+hoje.slice(0, 4), +hoje.slice(5, 7) - 2, 1)); return d.toISOString().slice(0, 7); })();
await page.fill('[id^="ccq_"][id$="_ref"]', prev); await page.click('[data-ccq="confirmar"]'); await page.waitForTimeout(2200);
t = await card();
check(/Contracheque · /.test(t) && /Proventos · bruto R\$ 11\.769,35/i.test(t) && /SUBSIDIO EFETIVO/.test(t) && /Descontos em folha · R\$ 8\.922,32 \(inclui R\$ 3\.908,50 de consignados\)/i.test(t), 'confirmado: proventos, descontos em folha e a soma dos consignados (R$ 3.908,50)');
if (process.env.DEBUG_CQ) console.log('DEBUG2', t.slice(900, 1900));
check(/Líquido \(cai na conta\) R\$ 2\.847,03/.test(t) && /Salário de [a-zç]+ de \d{4} \(contracheque de [a-zç]+ de \d{4}\): previsto/.test(t) && /Recebido em /.test(t), 'líquido R$ 2.847,03 e o salário do mês SEGUINTE à referência como PREVISTO');
check(/Consignados · 9 contratos · R\$ 3\.908,50\/mês/i.test(t) && t.includes('BANCO INTERMEDIUM - EMPRESTIMO 01 parcela 25 de 96 · restam 71, termina em ' + fimDe(prev, 71)) && /Falta pagar no total/.test(t) && /margem consignável: R\$ 3\.908,56/.test(t), 'consignados: 9 contratos, parcela 25 de 96 (restam 71), total que falta e margem consignável');
check(t.indexOf('BANCO SAFRA - EMPRESTIMO 01') < t.indexOf('BANCO SANTANDER BRASIL - EMPRESTIMO 03') && /BANCO SANTANDER BRASIL - EMPRESTIMO 03 parcela 6 de 96/.test(t), 'os consignados vêm na ordem do término: o que termina primeiro (Safra 01, parcela 31 de 96) em cima');
const receitas = () => page.evaluate(async () => (await (await fetch('/api/db/receitasManuais')).json()).docs.map((d) => d.data));
let rs = await receitas(); const sal = rs.find((r) => r.ccqSalario);
check(sal && sal.recorrente === true && sal.coluna === 'pf' && sal.recebimentos[hoje].valor === 2847.03 && sal.recebimentos[hoje].recebido === false && !sal.recebimentos[prev], 'o líquido virou a receita recorrente "Salário (contracheque)" no mês SEGUINTE à referência (' + hoje + '), não no mês do contracheque (' + prev + ')');
const docs = await page.evaluate(async () => (await (await fetch('/api/db/extratos')).json()).docs.map((d) => ({ id: d.id, tipo: d.data.tipo, d: d.data })));
const cc = docs.find((d) => d.id === 'cc_' + prev); check(cc && cc.tipo === 'contracheque' && !JSON.stringify(cc.d).match(/000\.000|EXEMPLO DA SILVA|00000/), 'o contracheque ficou guardado pela referência (id cc_' + prev + ') sem CPF, PIS, identidade nem nome do servidor');
// marcar como recebido
await page.click('[data-ccq="recebido"]'); await page.waitForTimeout(1500);
rs = await receitas(); check(rs.find((r) => r.ccqSalario).recebimentos[hoje].recebido === true && /\): recebido/.test(await card()), 'um toque marcou o salário como recebido');
// divisão do salário usa o líquido
await page.evaluate(() => document.querySelector('#drawer .dr-it[data-fin="geral"]').click()); await page.waitForTimeout(1200);
const dv = await page.evaluate(() => document.getElementById('bodyFinanceiro').innerText.replace(/\s+/g, ' '));
check(/Contracheque de/i.test(dv) && /Líquido \(base da divisão\) R\$ 2\.847,03/.test(dv) && /SALÁRIO E ENTRADAS DO MÊS R\$ 2\.847,03/i.test(dv), '"Divisão do salário": mostra o contracheque e usa o líquido de R$ 2.847,03 como base');
// mês seguinte: estimativa copiada
await page.evaluate(() => document.getElementById('mesProximo').click()); await page.waitForTimeout(600);
await page.evaluate(() => document.querySelector('#drawer .dr-it[data-fin="pf"]').click()); await page.waitForTimeout(1200);
t = await card(); check(/Ainda não há contracheque/.test(t) && /Copiar de/.test(t), 'no mês seguinte (o contracheque de ' + hoje + ' cai nele): oferece "Copiar do mês passado (estimativa)"');
await page.click('[data-ccq="copiar"]'); await page.waitForTimeout(2000); t = await card();
if (process.env.DEBUG_CQ) console.log('DEBUG', t.slice(0, 900));
check(/estimativa do mês passado/.test(t) && /Líquido \(cai na conta\) R\$ 2\.847,03/.test(t) && /Consignados · 9 contratos/i.test(t), 'estimativa criada com o mesmo líquido (sem extras no exemplo) e os consignados, marcada como "estimativa do mês passado"');
check(erros.length === 0, 'sem erros de script' + (erros.length ? ': ' + erros.join(' | ') : ''));
check(recusados.length === 0, 'nenhum pedido recusado' + (recusados.length ? ': ' + [...new Set(recusados)].join(' | ') : ''));
await br.close();
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
