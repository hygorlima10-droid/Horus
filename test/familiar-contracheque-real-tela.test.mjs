// (arquivo real, não vai para o repositório) : (A) PDF com texto de OCR, palavras da mesma linha em alturas diferentes e sem a coluna QTDE nas linhas zeradas;
// (B) PDF que é só imagem (print impresso em PDF), lido pelo OCR depois de desenhar a página. Servidor do grupo 'familiar':  node test/rodar.mjs familiar-contracheque-pdf-tela
import fs from 'node:fs'; import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8820', TOK = 'tok-fam-fin-0000000000000000000000000007';
const NM = [process.env.TESSERACT, '/tmp/claude-0/-home-user/73bc448f-589a-50cb-a941-bd114c59c1e4/scratchpad/ocr/node_modules/'].filter(Boolean).find((d) => fs.existsSync(d + 'tesseract.js/dist/tesseract.min.js') && fs.existsSync(d + '@tesseract.js-data/por/4.0.0_best_int/por.traineddata.gz'));
const PDFJS = [process.env.PDFJS, '/tmp/claude-0/-home-user/73bc448f-589a-50cb-a941-bd114c59c1e4/scratchpad/pdfjs/package/build/', '/tmp/claude-0/-home-user/73bc448f-589a-50cb-a941-bd114c59c1e4/scratchpad/pdfjs_test/node_modules/pdfjs-dist/build/'].filter(Boolean).find((d) => fs.existsSync(d + 'pdf.min.js'));
if (!NM || !PDFJS) { console.log('  (Tesseract ou pdf.js local não encontrado: teste ignorado; use TESSERACT=/pasta/node_modules e PDFJS=/pasta/build/)'); process.exit(0); }
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 1280, height: 1000 } }); await ctx.addCookies([{ name: 'sessao', value: TOK, url: B }]);
const page = await ctx.newPage(); const erros = []; page.on('pageerror', (e) => erros.push(e.message)); await page.route(/fonts\./, (r) => r.abort());
await page.route(/cdnjs.*pdf\.min\.js/, (r) => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(PDFJS + 'pdf.min.js') })); await page.route(/cdnjs.*pdf\.worker\.min\.js/, (r) => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(PDFJS + 'pdf.worker.min.js') }));
await page.route(/jsdelivr.*tesseract\.min\.js/, (r) => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(NM + 'tesseract.js/dist/tesseract.min.js') }));
await page.route(B + '/__ocr/**', (r) => { const u = new URL(r.request().url()).pathname.replace('/__ocr/', ''); const f = u.startsWith('lang/') ? NM + '@tesseract.js-data/por/4.0.0_best_int/' + u.slice(5) : (u === 'worker.min.js' ? NM + 'tesseract.js/dist/worker.min.js' : NM + 'tesseract.js-core/' + u.replace(/^core\//, '')); if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' }); r.fulfill({ contentType: /\.js$/.test(f) ? 'application/javascript' : (/\.wasm$/.test(f) ? 'application/wasm' : 'application/octet-stream'), body: fs.readFileSync(f) }); });
const T = [['200027', 'SUBSIDIO EFETIVO', '200', '11.167,31'], ['200041', 'ABONO FARDAMENTO', '0', '50,04'], ['200044', 'LOCALIDADE - AC3', '55', '552,00'], ['200042', 'FARDAMENTO', '0', '50,04'], ['200045', 'FAS - MILITAR - ATIVO', '0', '59,29'], ['800004', 'IRRF', '0', '1.852,55'], ['800338', 'CONTRIBUICAO PENSAO E INATIVIDADE', '0', '1.172,57'], ['900044', 'IPASGO BASICO - 6,81%', '0', '680,64'], ['900128', 'BANCO INTERMEDIUM - EMPRESTIMO 01', '25 de 96', '294,00'], ['900235', 'BANCO SAFRA - EMPRESTIMO 01', '31 de 96', '414,70'], ['900236', 'BRB - EMPRESTIMO 01', '13 de 96', '790,05'], ['900378', 'UNIMIL - CONTRIBUICAO', '1', '82,00'], ['900407', 'BRB - EMPRESTIMO 02', '13 de 96', '342,40'], ['900414', 'BRB - EMPRESTIMO 03', '13 de 96', '263,11'], ['900415', 'BRB - EMPRESTIMO 04', '13 de 96', '1.092,60'], ['900424', 'BANCO SAFRA - EMPRESTIMO 02', '15 de 96', '492,90'], ['900507', 'BANCO SANTANDER BRASIL - EMPRESTIMO 02', '10 de 96', '107,74'], ['900508', 'BANCO SANTANDER BRASIL - EMPRESTIMO 03', '6 de 96', '111,00'], ['900685', 'VEMCARD - CARTAO BENEFICIO - SAQUE - LEI 22.449', '1', '1.116,73']];
const REAL = '/tmp/claude-0/-home-user/73bc448f-589a-50cb-a941-bd114c59c1e4/scratchpad/real/';
const arqs = (process.env.REAIS || 'contracheque-real.png').split(',').map((x) => REAL + x).filter((f) => fs.existsSync(f));
await page.goto(B + '/'); await page.waitForTimeout(2500);
page.on('console', (m) => { if (/^DCM-PDF/.test(m.text())) fs.writeFileSync('/tmp/dcm-pdf-ultimo.txt', m.text()); if (/^DCM-OCR/.test(m.text())) fs.writeFileSync('/tmp/dcm-ocr-ultimo.txt', m.text()); });
const cfg = () => page.evaluate((b) => { window.__dcmDebug = true; window.__dcmOcrCfg = { workerPath: b + '/__ocr/worker.min.js', corePath: b + '/__ocr/core', langPath: b + '/__ocr/lang', gzip: true }; }, B);
const card = () => page.evaluate(() => (document.getElementById('ccqCard') || { innerText: '' }).innerText.replace(/\s+/g, ' '));
const topo = () => page.evaluate(() => ((document.getElementById('extTopo') || { innerText: '' }).innerText + ' || ' + [...document.querySelectorAll('.toast,#toast')].map((e) => e.innerText).join(' ')).replace(/\s+/g, ' '));
for (const f of arqs) {
  await page.goto(B + '/'); await page.waitForTimeout(2500); await cfg();
  await page.evaluate(async () => { const j = await (await fetch('/api/db/extratos')).json(); for (const d of j.docs.filter((x) => x.data.tipo === 'documento')) await fetch('/api/db/extratos/' + d.id, { method: 'DELETE' }); });
  await page.reload(); await page.waitForTimeout(2500); await cfg();
  await page.evaluate(() => document.querySelector('#drawer .dr-it[data-fin="pf"]').click()); await page.waitForTimeout(1200);
  const t0 = Date.now(); await page.setInputFiles('#ccqArq', f);
  let t = '', msgs = '';
  for (let i = 0; i < (process.env.ESPERA ? +process.env.ESPERA : 70); i++) { await page.waitForTimeout(2000); t = await card(); msgs += ' ' + await page.evaluate(() => [...document.querySelectorAll('.toast,#toast,[role=status]')].map((e) => e.innerText).join(' ')); if (/Contracheque lido/.test(t) || /Não consegui|não reconheci|Parece um contracheque/.test(msgs)) break; }
  console.log('DOCS', JSON.stringify(await page.evaluate(async () => (await (await fetch('/api/db/extratos')).json()).docs.map((d) => ({ id: d.id, tipo: d.data.tipo, kind: d.data.kind, st: d.data.status, titulo: d.data.titulo, dados: d.data.dados && { selo: d.data.dados.selo, n: (d.data.dados.itens || []).length } })))).slice(0, 600));
  console.log('TOPO', (await topo()).slice(0, 500));
  console.log('ARQUIVO', f.replace(REAL, ''), ((Date.now() - t0) / 1000).toFixed(0) + 's');
  console.log('  CARTAO:', t.slice(0, 500)); console.log('  MSG:', msgs.replace(/\s+/g, ' ').slice(0, 400));
  const ok = /Contracheque lido · abril de 2024/i.test(t) && /Bruto R\$ 11\.769,35/.test(t) && /Descontos em folha R\$ 8\.922,32/.test(t) && /Líquido R\$ 2\.847,03/.test(t);
  check(ok, f.replace(REAL, '') + ': lido (abril/2024, bruto 11.769,35, descontos 8.922,32, líquido 2.847,03)');
  check(/19 linhas · 9 consignados/.test(t), f.replace(REAL, '') + ': 19 linhas e 9 consignados');
}
check(erros.length === 0, 'sem erros de script' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close(); console.log(falhas ? falhas + ' FALHA(S)' : 'tudo certo'); process.exit(falhas ? 1 : 0);
