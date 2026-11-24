// Leitor geral na tela: PDFs de extrato da Caixa e do Nubank (gerados aqui, no layout dos exemplos) entram pela tela "Extratos" e são lidos SEM modelo por banco.
// Servidor do grupo 'leitor':  node test/rodar.mjs leitor-geral-tela     (precisa do pdf.js local: PDFJS=/pasta/do/pdfjs/build/)
import fs from 'node:fs'; import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8822', TOK = 'tok-dono-0000000000000000000000000001';
const PDFJS = [process.env.PDFJS, '/tmp/claude-0/-home-user/73bc448f-589a-50cb-a941-bd114c59c1e4/scratchpad/pdfjs/package/build/', '/tmp/claude-0/-home-user/73bc448f-589a-50cb-a941-bd114c59c1e4/scratchpad/pdfjs_test/node_modules/pdfjs-dist/build/'].filter(Boolean).find((d) => fs.existsSync(d + 'pdf.min.js'));
if (!PDFJS) { console.log('  (pdf.js local não encontrado: teste ignorado; use PDFJS=/pasta/do/pdfjs/build/)'); process.exit(0); }
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const br = await chromium.launch();
const ctx = await br.newContext({ viewport: { width: 1280, height: 900 } }); await ctx.addCookies([{ name: 'sessao', value: TOK, url: B }]);
const page = await ctx.newPage(); const erros = []; page.on('pageerror', (e) => erros.push(e.message)); await page.route(/fonts\./, (r) => r.abort());
await page.route(/cdnjs.*pdf\.min\.js/, (r) => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(PDFJS + 'pdf.min.js') })); await page.route(/cdnjs.*pdf\.worker\.min\.js/, (r) => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(PDFJS + 'pdf.worker.min.js') }));

/* gera o PDF a partir de células posicionadas: [texto, x, y, 'd'?] (d = alinhado à direita em x) */
const gerar = async (arq, celulas) => {
  const html = '<html><body style="margin:0;font:13px Arial">' + celulas.map(([t, x, y, d]) => '<div style="position:absolute;white-space:nowrap;top:' + y + 'px;' + (d ? 'right:' + (1210 - x) + 'px' : 'left:' + x + 'px') + '">' + t.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</div>').join('') + '</body></html>';
  const p = await ctx.newPage(); await p.setContent(html); await p.pdf({ path: arq, width: '1210px', height: '900px', printBackground: true }); await p.close();
};
const moeda = (c) => (c / 100).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
// Caixa: Data Mov. | Nr. Doc. | Histórico | Valor | Saldo (C/D)
const caixa = (coerente) => {
  const L = [['18/11/2022', 145, 20], ['Internet Banking____CAIXA', 574, 20], ['Extrato por período', 159, 110], ['Cliente: LEONARDO ALVES ALMEIDA', 169, 150], ['Conta: 3596 / 013 / 00018498-7', 169, 180], ['Data:', 169, 210], ['18/11/2022- 14:27', 233, 210], ['Mês:', 169, 240], ['Novembro/2022', 233, 240], ['Período: 18 - 29', 169, 270], ['Extrato', 169, 320],
    ['Data Mov.', 169, 345], ['Nr. Doc.', 273, 345], ['Histórico', 386, 345], ['Valor', 803, 345, 'd'], ['Saldo', 1015, 345, 'd'], ['000000', 273, 380], ['SALDO ANTERIOR', 386, 380], ['0,00', 803, 380, 'd'], ['2.839,34 C', 1012, 380, 'd']];
  const lin = [['18/11/2022', '000000', 'REM BASICA', 0, '+'], ['19/11/2022', '000000', 'CRED JUROS', 1002, '+'], ['20/11/2022', '022703', 'PAG BOLETO', 25239, '-'], ['20/11/2022', '495598', 'PAG BOLETO', 8294, '-'], ['21/11/2022', '041431', 'ENVIO TEV', 15900, '-'], ['22/11/2022', '050746', 'ENVIO TEV', 7000, '-'], ['23/11/2022', '127135', 'PAG BOLETO', 5615, '-'], ['23/11/2022', '061304', 'ENVIO TEV', 1800, '-'], ['24/11/2022', '081553', 'ENVIO TEV', 750, '-'], ['25/11/2022', '009386', 'PAG BOLETO', 8294, '-']];
  let saldo = 283934; const pdfSaldo = coerente ? null : { 2: 259096 };   // o exemplo mostra 2.590,96 onde a conta dá 2.596,96
  lin.forEach(([d, nd, h, v, s], i) => { const y = 415 + i * 32; saldo += (s === '+' ? 1 : -1) * v; const sv = pdfSaldo && pdfSaldo[i] ? pdfSaldo[i] : saldo; if (pdfSaldo && pdfSaldo[i]) saldo = sv; L.push([d, 169, y], [nd, 273, y], [h, 386, y], [moeda(v) + (s === '+' ? ' C' : ' D'), 803, y, 'd'], [moeda(sv) + ' C', 1012, y, 'd']); });
  L.push(['https://internetbanking.caixa.gov.br/SIIBC/imprime_ext_periodo', 144, 850]);
  return L;
};
// Nubank: seções por dia (Total de entradas / Total de saídas), uma coluna de valor
const nubank = () => {
  const L = [['Vinicius Bernardes Basile Stopa', 770, 90], ['CPF  218.718.568-09  Agência  0001  Conta  5992345-8', 612, 120], ['01 DE OUTUBRO DE 2021 a 31 DE OUTUBRO DE 2021', 196, 200], ['VALORES EM R$', 1009, 200, 'd'],
    ['Saldo inicial', 597, 250], ['1.000,00', 1005, 250, 'd'], ['Rendimento líquido', 597, 280], ['+0,00', 1005, 280, 'd'], ['Total de entradas', 597, 310], ['+3.000,00', 1005, 310, 'd'], ['Total de saídas', 597, 340], ['-2.800,00', 1005, 340, 'd'], ['Saldo final do período', 597, 370], ['1.200,00', 1005, 370, 'd'], ['Movimentações', 196, 420],
    ['01 OUT 2021', 198, 460], ['Total de entradas', 303, 460], ['+ 2.000,00', 1005, 460, 'd'],
    ['Transferência recebida pelo Pix', 303, 500], ['Gisele Vitinilla 366.571.852-00 -', 543, 500], ['1180,00', 1005, 500, 'd'], ['Transferência recebida pelo Pix', 303, 540], ['Rodrigo Viana - 230.087.568', 543, 540], ['820,00', 1005, 540, 'd'],
    ['Total de saídas', 303, 580], ['- 1.500,00', 1005, 580, 'd'], ['Compra no débito', 303, 620], ['Raia', 543, 620], ['1000,00', 1005, 620, 'd'], ['Compra no débito', 303, 660], ['Jatobah Espetaria', 543, 660], ['500,00', 1005, 660, 'd'],
    ['02 OUT 2021', 198, 700], ['Total de entradas', 303, 700], ['+ 1.000,00', 1005, 700, 'd'], ['Transferência recebida pelo Pix', 303, 740], ['Laura Mendes - 526.940.798-14 - NU', 543, 740], ['1000,00', 1005, 740, 'd'],
    ['Total de saídas', 303, 780], ['- 1.300,00', 1005, 780, 'd'], ['Transferência enviada pelo Pix', 303, 820], ['Vinicius Bernardes Basile Stopa - 218.718.568-09 -', 543, 820], ['1300,00', 1005, 820, 'd'],
    ['Nu Pagamentos S.A. - Instituição de Pagamento', 196, 870], ['Extrato gerado dia 15 de dezembro de 2021 às 09:10', 614, 880]];
  return L;
};
await gerar('/tmp/lg-caixa-ok.pdf', caixa(true)); await gerar('/tmp/lg-caixa-exemplo.pdf', caixa(false)); await gerar('/tmp/lg-nubank.pdf', nubank());

await page.goto(B + '/'); await page.waitForTimeout(2500);
await page.evaluate(() => document.querySelector('#drawer [data-tab="extratos"]').click()); await page.waitForTimeout(1200);
await page.evaluate(() => { document.getElementById('impArq').style.display = 'block'; });
const lidos = () => page.evaluate(async () => (await (await fetch('/api/db/extratos')).json()).docs.filter((d) => d.data.tipo === 'arquivo' || d.data.tipo === 'documento').map((d) => d.data));
await page.setInputFiles('#impArq', ['/tmp/lg-caixa-ok.pdf', '/tmp/lg-nubank.pdf']); await page.waitForTimeout(7000);
let docs = await lidos(); const cx = docs.find((d) => d.banco === 'Caixa'), nu = docs.find((d) => d.banco === 'Nubank');
check(!!cx && cx.geral === true && cx.chave === 'caixa-3596-00018498-7' && cx.titular.nome === 'LEONARDO ALVES ALMEIDA', 'PDF da Caixa lido sem modelo: conta caixa-3596-00018498-7 e titular');
check(cx && cx.nTotal === 9 && cx.lanc.some((l) => l.v === -25239 && l.s === 'PAG BOLETO') && cx.lanc.some((l) => l.v === 1002 && l.d === '2022-11-19'), 'Caixa: 9 lançamentos com sinais certos (C/D) e datas');
check(cx && cx.selo === 'verde' && cx.saldoFecha && cx.saldoAtual === 212044, 'Caixa: selo VERDE (saldo fecha linha a linha), saldo final R$ 2.120,44');
check(!!nu && nu.geral === true && nu.chave === 'nubank-0001-5992345-8' && nu.titular.doc === '218.718.568-09', 'PDF do Nubank lido sem modelo: conta nubank-0001-5992345-8 e CPF do titular');
check(nu && nu.nTotal === 6 && nu.lanc.some((l) => l.v === 118000 && l.n === 'Gisele Vitinilla' && l.o === '366.571.852-00' && l.d === '2021-10-01') && nu.lanc.some((l) => l.v === -130000 && l.d === '2021-10-02'), 'Nubank: 6 lançamentos (entradas e saídas pelo dia), contraparte e CPF separados');
check(nu && nu.selo === 'verde' && nu.saldoAtual === 120000, 'Nubank: selo VERDE (saldo inicial + entradas − saídas = saldo final) e saldo R$ 1.200,00');
// um extrato que não fecha: aviso, não erro calado
await page.setInputFiles('#impArq', '/tmp/lg-caixa-exemplo.pdf'); await page.waitForTimeout(4000);
docs = await lidos(); const ex = docs.find((d) => d.titulo === 'lg-caixa-exemplo.pdf');
check(!!ex && ex.selo === 'amarelo' && ex.nDiverg >= 1 && ex.saldoFecha === false, 'o extrato com saldo errado entra, mas com selo AMARELO apontando onde não fecha');
// conferência: o chip aparece
await page.evaluate(() => document.getElementById('extConferir') && document.getElementById('extConferir').click()); await page.waitForTimeout(1500);
const tx = await page.evaluate(() => document.getElementById('extCorpo').innerText.replace(/\s+/g, ' '));
check(/lido sem modelo · saldo fecha/.test(tx) && /lido sem modelo · o saldo não fecha/.test(tx), 'a conferência mostra "lido sem modelo · saldo fecha" e o aviso do que não fecha');
check(/PAG BOLETO/.test(tx) && /Gisele Vitinilla|Transfer/.test(tx), 'as linhas lidas aparecem para conferir');

// ---- boleto, comprovante, Pix copia e cola e foto ----
await page.evaluate(() => { document.querySelectorAll('.overlay.show').forEach((o) => o.classList.remove('show')); if (typeof window.__horusTeste === 'object') { /* fecha a conferência aberta acima */ } }); await page.waitForTimeout(300);
const hoje = new Date().toISOString().slice(0, 10), venc = new Date(Date.now() + 18 * 86400000).toISOString().slice(0, 10);
const linhaBoleto = (() => {   // boleto do Bradesco (237) com fator do calendário novo, R$ 412,87, vencimento daqui a 18 dias
  const fator = String(1000 + Math.round((Date.parse(venc) - Date.parse('2025-02-22')) / 86400000)), valor = '0000041287', livre = '1234567890123456789012345';
  const mod10 = (t) => { let s = 0, p = 2; for (let i = t.length - 1; i >= 0; i--) { const x = +t[i] * p; s += x > 9 ? x - 9 : x; p = p === 2 ? 1 : 2; } return (10 - s % 10) % 10; };
  const mod11 = (t) => { let s = 0, p = 2; for (let i = t.length - 1; i >= 0; i--) { s += +t[i] * p; p = p === 9 ? 2 : p + 1; } const d = 11 - s % 11; return (d === 0 || d === 10 || d === 11) ? 1 : d; };
  const sem = '2379' + fator + valor + livre, dv = mod11(sem), b = '2379' + dv + fator + valor + livre;
  const c1 = b.slice(0, 4) + b.slice(19, 24), c2 = b.slice(24, 34), c3 = b.slice(34, 44);
  return c1 + mod10(c1) + c2 + mod10(c2) + c3 + mod10(c3) + dv + fator + valor;
})();
const fmtL = (d) => d.slice(0, 5) + '.' + d.slice(5, 10) + ' ' + d.slice(10, 15) + '.' + d.slice(15, 21) + ' ' + d.slice(21, 26) + '.' + d.slice(26, 32) + ' ' + d[32] + ' ' + d.slice(33);
const dd = (iso) => iso.split('-').reverse().join('/');
const par = (arr, y0 = 80) => arr.flatMap(([r, v], i) => v === undefined ? [[r, 100, y0 + i * 34]] : [[r, 100, y0 + i * 34], [v, 420, y0 + i * 34]]);
await gerar('/tmp/lg-boleto.pdf', par([['Banco Bradesco S.A.'], [fmtL(linhaBoleto)], ['Beneficiário', 'EQUATORIAL GOIAS DISTRIBUIDORA'], ['CPF/CNPJ do beneficiário', '01.543.032/0001-04'], ['Pagador', 'FULANO DE TAL'], ['Vencimento', dd(venc)], ['Valor do documento', 'R$ 412,87'], ['Nosso número', '99887766']]));
const espera = (cond, ms = 12000) => page.waitForFunction(cond, null, { timeout: ms }).catch(() => null);
await page.setInputFiles('#impArq', '/tmp/lg-boleto.pdf'); await page.waitForTimeout(4500);
let dcs = await lidos(); const bo = dcs.find((d) => d.kind === 'boleto'); if (process.env.DEBUG_LG) console.log('DEBUG', JSON.stringify(dcs.map((d) => ({ k: d.kind, t: d.titulo, st: d.status, e: d.motivo, dados: d.dados }))).slice(0, 1500), fmtL(linhaBoleto), venc);
check(!!bo && bo.status === 'pendente' && bo.dados.valor === 41287 && bo.dados.vencimento === venc && bo.dados.bancoNome === 'Bradesco' && bo.dados.beneficiario === 'EQUATORIAL GOIAS DISTRIBUIDORA', 'boleto em PDF: Bradesco, R$ 412,87, vencimento em ' + dd(venc) + ' (fator do calendário novo) e beneficiário');
check(bo && bo.dados.selo === 'verde', 'boleto: selo VERDE (linha digitável confere nos dígitos verificadores)');
const tela = () => page.evaluate(() => document.getElementById('extPend').innerText.replace(/\s+/g, ' '));
check(/Documentos para conferir/.test(await tela()) && /Boleto · EQUATORIAL/.test(await tela()) && /Categoria sugerida: Energia elétrica/.test(await tela()), 'a tela mostra o boleto em "Documentos para conferir" com a categoria sugerida (Energia elétrica)');
await page.click('[data-dcm="pagar"]'); await page.waitForTimeout(1800);
const despesas = () => page.evaluate(async () => (await (await fetch('/api/db/despesas')).json()).docs.map((d) => d.data));
let ds = await despesas(); const eq = ds.find((d) => d.nome === 'EQUATORIAL GOIAS DISTRIBUIDORA');
check(!!eq && eq.valor === 412.87 && eq.data === venc && eq.pago === false && eq.categoria === 'energia' && eq.origemDocumento === true, 'um toque lançou a despesa a pagar: R$ 412,87 em ' + dd(venc) + ', categoria energia, ainda não paga');
// comprovante de Pix: dá baixa na despesa que já existe
await page.evaluate(async () => { await fetch('/api/db/despesas/cons1', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome: 'Parcela do consórcio', coluna: 'pf', tipo: 'unica', categoria: 'outros', valor: 1350, data: new Date().toISOString().slice(0, 8) + '10', mesReferencia: new Date().toISOString().slice(0, 7), pago: false, dataPagamento: null, parciais: [], ativa: true, pagamentos: {} }) }); });
const d10 = hoje.slice(0, 8) + '10', e2e = 'E18236120' + d10.replace(/-/g, '') + '0942' + 'aB3dE5gH7jK';
await gerar('/tmp/lg-comprovante.pdf', par([['Comprovante de transferência'], [dd(d10) + ' 09:42:10'], ['Valor', 'R$ 1.350,00'], ['Tipo de transferência', 'Pix'], ['Destino'], ['Nome', 'Parcela do consórcio Caixa Consórcios'], ['CPF/CNPJ', '00.360.305/****-**'], ['Instituição', 'CAIXA ECONOMICA FEDERAL'], ['Origem'], ['Nome', 'Hygor L A'], ['ID da transação', e2e]]));
await page.reload(); await page.waitForTimeout(2500); await page.evaluate(() => document.querySelector('#drawer [data-tab="extratos"]').click()); await page.waitForTimeout(1000); await page.evaluate(() => { document.getElementById('impArq').style.display = 'block'; });
await page.setInputFiles('#impArq', '/tmp/lg-comprovante.pdf'); await page.waitForTimeout(4500);
dcs = await lidos(); const cp = dcs.find((d) => d.kind === 'comprovante');
check(!!cp && cp.dados.valor === 135000 && cp.dados.data === d10 && cp.dados.sentido === 'saida' && cp.dados.tipo === 'pix' && cp.dados.selo === 'verde', 'comprovante de Pix em PDF: R$ 1.350,00 em ' + dd(d10) + ', saída, selo VERDE (o ID confere com a data)');
check(/Combina com: Parcela do consórcio/.test(await tela()), 'o comprovante combina com a despesa "Parcela do consórcio" (mesmo valor)');
await page.click('[data-dcm="baixa"]'); await page.waitForTimeout(1800);
ds = await despesas(); const cons = ds.find((d) => d.nome === 'Parcela do consórcio');
check(cons && cons.pago === true && cons.dataPagamento === d10 && cons.valor === 1350, 'um toque deu baixa: a parcela ficou paga em ' + dd(d10));
// Pix copia e cola colado na tela
const brcode = '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D';
await page.fill('#dcmColar', brcode); await page.click('[data-dcm="colar"]'); await page.waitForTimeout(1500);
dcs = await lidos(); const px = dcs.find((d) => d.kind === 'pix');
check(!!px && px.dados.chave === '123e4567-e12b-12d1-a456-426655440000' && px.dados.nome === 'Fulano de Tal' && px.dados.selo === 'verde', 'Pix copia e cola colado: chave, nome e CRC conferem');
await page.fill('[id$="_valor"]', '55.50'); await page.click('[data-dcm="pagar"]'); await page.waitForTimeout(1800);
ds = await despesas(); check(ds.some((d) => d.nome === 'Fulano de Tal' && d.valor === 55.5 && d.pago === false), 'Pix sem valor: você informa R$ 55,50 e ele vira despesa a pagar');
// Pix recebido: vira receita
await gerar('/tmp/lg-recebido.pdf', par([['Você recebeu um Pix'], ['Valor', 'R$ 200,00'], ['Data', dd(hoje) + ' 08:15'], ['De'], ['Nome', 'MARIA SOUZA'], ['ID da transação', 'E18236120' + hoje.replace(/-/g, '') + '0815' + 'zY9xW8vU7tS']]));
await page.setInputFiles('#impArq', '/tmp/lg-recebido.pdf'); await page.waitForTimeout(4500);
check(/Lançar como receita/.test(await tela()), 'Pix recebido: oferece "Lançar como receita"');
await page.click('[data-dcm="receita"]'); await page.waitForTimeout(1800);
const rec = await page.evaluate(async () => (await (await fetch('/api/db/receitasManuais')).json()).docs.map((d) => d.data));
check(rec.some((r) => r.descricao === 'MARIA SOUZA' && r.valor === 200 && r.origemDocumento), 'a receita de R$ 200,00 de MARIA SOUZA foi lançada');
// foto: o motor de leitura é simulado (devolve o texto que a foto teria)
await page.evaluate((txt) => { window.__dcmOcrTeste = () => txt; }, ['Comprovante de pagamento', 'Pagamento de boleto', 'Beneficiário EQUATORIAL GOIAS', 'Valor R$ 412,87', 'Data do pagamento ' + dd(hoje), 'Autenticação 9A8B7C6D5E4F3G2H1I0J'].join('\n'));
fs.writeFileSync('/tmp/lg-foto.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'));
await page.setInputFiles('#impArq', '/tmp/lg-foto.png'); await page.waitForTimeout(3000);
dcs = await lidos(); const ft = dcs.find((d) => d.dados && d.dados.viaFoto);
check(!!ft && ft.kind === 'comprovante' && ft.dados.valor === 41287 && ft.dados.selo === 'amarelo', 'foto: lida pelo OCR e classificada como comprovante, sempre com selo AMARELO (confira os valores)');
check(erros.length === 0, 'sem erros de script' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close();
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
