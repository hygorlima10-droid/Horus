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
const lidos = () => page.evaluate(async () => (await (await fetch('/api/db/extratos')).json()).docs.filter((d) => d.data.tipo === 'arquivo').map((d) => d.data));
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
check(erros.length === 0, 'sem erros de script' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close();
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
