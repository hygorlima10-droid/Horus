// Contracheques em lote (familiar): PDF com várias páginas + vários arquivos → tabela de conferência → só histórico; mês já guardado vem desmarcado; conferência dos consignados.
// Servidor do grupo 'familiar':  node test/rodar.mjs familiar-contracheque-lote-tela
import fs from 'node:fs'; import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8820', TOK = 'tok-fam-fin-0000000000000000000000000007';
const PDFJS = [process.env.PDFJS, '/tmp/claude-0/-home-user/73bc448f-589a-50cb-a941-bd114c59c1e4/scratchpad/pdfjs/package/build/', '/tmp/claude-0/-home-user/73bc448f-589a-50cb-a941-bd114c59c1e4/scratchpad/pdfjs_test/node_modules/pdfjs-dist/build/'].filter(Boolean).find((d) => fs.existsSync(d + 'pdf.min.js'));
if (!PDFJS) { console.log('  (pdf.js local não encontrado: teste ignorado; use PDFJS=/pasta/build/)'); process.exit(0); }
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 1280, height: 1100 } }); await ctx.addCookies([{ name: 'sessao', value: TOK, url: B }]);
const page = await ctx.newPage(); const erros = []; page.on('pageerror', (e) => erros.push(e.message)); await page.route(/fonts\./, (r) => r.abort());
await page.route(/cdnjs.*pdf\.min\.js/, (r) => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(PDFJS + 'pdf.min.js') })); await page.route(/cdnjs.*pdf\.worker\.min\.js/, (r) => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(PDFJS + 'pdf.worker.min.js') }));
const brl = (c) => (c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
// um contracheque sintético (dados inventados): subsídio + localidade (+ extra), IRRF, plano e um consignado "n de 96"
const folha = (mesNome, n, extra) => {
  const prov = [['200027', 'SUBSIDIO EFETIVO', '200', 1000000], ['200044', 'LOCALIDADE - AC3', '55', 50000]]; if (extra) prov.push(['200100', 'SERV EXTRAORDINARIO', '10', extra]);
  const desc = [['800004', 'IRRF', '0', 100000], ['900044', 'PLANO DE SAUDE BASICO', '0', 70000], ['900128', 'BANCO EXEMPLO - EMPRESTIMO 01', n + ' de 96', 30000]];
  const r = prov.reduce((t, x) => t + x[3], 0), d = desc.reduce((t, x) => t + x[3], 0);
  return `<div style="page-break-after:always;font:11.5px Arial;width:860px;padding:6px"><div style="border:1px solid #000;padding:2px"><b>Nome Servidor</b><br>SERVIDOR DE EXEMPLO &nbsp; <b>CPF</b> 000.000.000-00</div><div style="border:1px solid #000;padding:2px;margin-top:4px"><b>Cargo</b> Sargento &nbsp; <b>Referência</b> ${mesNome}/2024</div><table style="width:100%;border-collapse:collapse;border:1px solid #000;margin-top:6px"><tr><td colspan="4" style="text-align:center;border:1px solid #000"><b>PROVENTOS/DESCONTOS</b></td></tr>${[...prov, ...desc].map(([c, ds, q, v]) => `<tr><td style="width:60px">${c}</td><td>${ds}</td><td style="width:70px;text-align:right">${q}</td><td style="width:110px;text-align:right">${brl(v)}</td></tr>`).join('')}</table><table style="width:100%;border-collapse:collapse;border:1px solid #000;margin-top:6px"><tr><td style="border:1px solid #000"><b>Valor FGTS</b><br>0,00</td><td style="border:1px solid #000"><b>Rendimentos</b><br>${brl(r)}</td><td style="border:1px solid #000"><b>Descontos</b><br>${brl(d)}</td><td style="border:1px solid #000"><b>Líquido</b><br>${brl(r - d)}</td></tr></table></div>`;
};
const gerar = async (htmls, arq) => { const p = await ctx.newPage(); await p.setContent('<html><body style="margin:0">' + htmls.join('') + '</body></html>'); await p.pdf({ path: arq, width: '900px', printBackground: true }); await p.close(); };
await gerar([folha('Janeiro', 25), folha('Fevereiro', 26, 40000), folha('Março', 28)], '/tmp/lg-cc-lote-1a3.pdf');   // março "pulou" a parcela 27 de propósito
await gerar([folha('Abril', 29)], '/tmp/lg-cc-lote-abr.pdf');
await page.goto(B + '/'); await page.waitForTimeout(2500);
await page.evaluate(() => document.querySelector('#drawer .dr-it[data-fin="pf"]').click()); await page.waitForTimeout(1200);
const lote = () => page.evaluate(() => (document.getElementById('ccqLote') || { innerText: '' }).innerText.replace(/\s+/g, ' '));
const esperar = async () => { let t = ''; for (let i = 0; i < 20; i++) { await page.waitForTimeout(1000); t = await lote(); if (/Guardar \d+ no histórico|Fechar/.test(t)) break; } return t; };
check(await page.evaluate(() => document.getElementById('ccqArq').multiple), 'o seletor de arquivo aceita vários arquivos');

await page.setInputFiles('#ccqArq', '/tmp/lg-cc-lote-1a3.pdf'); let t = await esperar();
console.log('LOTE 1:', t.slice(0, 420));
check(await page.evaluate(() => document.querySelectorAll('#ccqLote tr[data-ccq-lin]').length) === 3, 'um PDF de 3 páginas virou 3 linhas na tabela de conferência');
check(/Guardar 3 no histórico/.test(t) && /R\$ 10\.500,00/.test(t) && /R\$ 10\.900,00/.test(t) && /R\$ 8\.500,00/.test(t) && /R\$ 8\.900,00/.test(t), 'os 3 vêm marcados, com bruto e líquido de cada mês (extras do fevereiro incluídos)');
check(await page.evaluate(() => [...document.querySelectorAll('#ccqLote [data-ccq-mes]')].map((i) => i.value).join(',') === '2024-01,2024-02,2024-03'), 'meses de referência lidos: jan, fev e mar de 2024');
check(/R\$ 400,00/.test(t) && /confere/.test(t), 'mostra os serviços extras (R$ 400,00) e o selo "confere"');
await page.click('[data-ccq="lote-guardar"]'); await page.waitForTimeout(2500);
const docs = () => page.evaluate(async () => (await (await fetch('/api/db/extratos')).json()).docs.filter((x) => x.data.tipo === 'contracheque').map((x) => ({ id: x.id, ...x.data })));
const rec = () => page.evaluate(async () => (await (await fetch('/api/db/receitasManuais')).json()).docs.filter((x) => x.data.ccqSalario).length);
let ds = await docs();
check(ds.map((d) => d.id).sort().join(',') === 'cc_2024-01,cc_2024-02,cc_2024-03' && ds.every((d) => d.soHistorico === true), 'guardou os 3 no histórico (cc_2024-01..03, marcados "só histórico")');
check(await rec() === 0, 'NÃO lançou salário recebido nem previsto (nenhuma receita criada)');
await page.reload(); await page.waitForTimeout(2500); await page.evaluate(() => document.querySelector('#drawer .dr-it[data-fin="pf"]').click()); await page.waitForTimeout(1200);
check(await page.evaluate(() => !document.getElementById('ccqHist')), 'o histórico não fica mais em Salário e fixos');
await page.evaluate(() => document.querySelector('#drawer .dr-it[data-tab="analises"]').click()); await page.waitForTimeout(1200);
await page.evaluate(() => document.querySelector('[data-an-periodo="hist"]').click()); await page.waitForTimeout(1200);
const an = () => page.evaluate(() => (document.getElementById('ccqAnalises') || { innerText: '' }).innerText.replace(/\s+/g, ' '));
let h = await an();
check(/Nenhum contracheque guardado neste período/.test(h) && /4 guardados|3 guardados/.test(h), 'Análises › Histórico (6 meses): avisa que os contracheques de 2024 estão fora do período e oferece "Tudo"');
await page.click('[data-an-recorte="tudo"]'); await page.waitForTimeout(1200); h = await an();
check(/Líquido médio/.test(h) && /Último líquido/.test(h) && /Variação do líquido/.test(h) && /Consignados no último/.test(h), 'recorte Tudo: mostra líquido médio, último líquido, variação e consignados');
check(/Salário: bruto e líquido/.test(h) && /Descontos em folha/.test(h) && /Conferência dos consignados/.test(h), 'cartões: salário bruto x líquido, descontos em folha e conferência dos consignados');
check(/parcela 26 em fevereiro de 2024 e parcela 28 em março de 2024 \(era para ser a 27\)/i.test(h), 'a conferência acusa o pulo da parcela 26 para 28');
check(await page.evaluate(() => document.querySelectorAll('#ccqAnalises svg').length) >= 2, 'os gráficos (bruto x líquido e descontos) foram desenhados');
await page.click('[data-an-recorte="12"]'); await page.waitForTimeout(800);
check(/Nenhum contracheque guardado neste período/.test(await an()), 'recorte 12 meses também respeita o período');
await page.click('[data-an-recorte="tudo"]'); await page.waitForTimeout(500);

// vários arquivos: o mês já guardado vem desmarcado
await page.evaluate(() => document.querySelector('#drawer .dr-it[data-fin="pf"]').click()); await page.waitForTimeout(1200);
await page.setInputFiles('#ccqArq', ['/tmp/lg-cc-lote-1a3.pdf', '/tmp/lg-cc-lote-abr.pdf']); t = await esperar();
console.log('LOTE 2:', t.slice(0, 300));
check(await page.evaluate(() => document.querySelectorAll('#ccqLote tr[data-ccq-lin]').length) === 4, 'dois arquivos (3 + 1 página) = 4 linhas');
check(await page.evaluate(() => [...document.querySelectorAll('#ccqLote [data-ccq-marca]')].map((c) => c.checked ? 1 : 0).join('')) === '0001' && /já guardado/.test(t) && /Guardar 1 no histórico/.test(t), 'jan, fev e mar (já guardados) vêm desmarcados; só abril vem marcado');
await page.click('[data-ccq="lote-guardar"]'); await page.waitForTimeout(2500);
ds = await docs(); check(ds.length === 4 && ds.some((d) => d.id === 'cc_2024-04'), 'guardou só o de abril (total 4 no histórico)');
check(await rec() === 0, 'continua sem lançar salário');
check(erros.length === 0, 'sem erros de script' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
