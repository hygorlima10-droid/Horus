// Foto/print de comprovante lido de verdade pelo Tesseract.js (OCR em português, no navegador), sem simulação.
// Servidor do grupo 'leitor':  node test/rodar.mjs leitor-ocr-tela    (precisa de: TESSERACT=/pasta/node_modules com tesseract.js, tesseract.js-core e @tesseract.js-data/por)
import fs from 'node:fs'; import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8822', TOK = 'tok-dono-0000000000000000000000000001';
const NM = [process.env.TESSERACT, '/tmp/claude-0/-home-user/73bc448f-589a-50cb-a941-bd114c59c1e4/scratchpad/ocr/node_modules/'].filter(Boolean).find((d) => fs.existsSync(d + 'tesseract.js/dist/tesseract.min.js') && fs.existsSync(d + '@tesseract.js-data/por/4.0.0_best_int/por.traineddata.gz'));
if (!NM) { console.log('  (Tesseract local não encontrado: teste ignorado; use TESSERACT=/pasta/node_modules)'); process.exit(0); }
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 1000, height: 1300 }, deviceScaleFactor: 2 }); await ctx.addCookies([{ name: 'sessao', value: TOK, url: B }]);
const page = await ctx.newPage(); const erros = []; page.on('pageerror', (e) => erros.push(e.message)); page.on('console', (m) => { if (/ocr|tess|worker|wasm/i.test(m.text())) console.log('CONSOLE', m.text().slice(0, 200)); }); page.on('requestfailed', (r) => console.log('REQFAIL', r.url().slice(0, 120), r.failure() && r.failure().errorText)); await page.route(/fonts\./, (r) => r.abort());
const servir = (re, arq, tipo) => page.route(re, (r) => r.fulfill({ contentType: tipo, body: fs.readFileSync(arq) }));
await servir(/jsdelivr.*tesseract\.min\.js/, NM + 'tesseract.js/dist/tesseract.min.js', 'application/javascript');
await page.route(B + '/__ocr/**', (r) => { const u = new URL(r.request().url()).pathname.replace('/__ocr/', ''); const f = u.startsWith('lang/') ? NM + '@tesseract.js-data/por/4.0.0_best_int/' + u.slice(5) : (u === 'worker.min.js' ? NM + 'tesseract.js/dist/worker.min.js' : NM + 'tesseract.js-core/' + u.replace(/^core\//, '')); if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' }); r.fulfill({ contentType: /\.js$/.test(f) ? 'application/javascript' : (/\.wasm$/.test(f) ? 'application/wasm' : 'application/octet-stream'), body: fs.readFileSync(f), headers: /\.gz$/.test(f) ? { 'content-encoding': 'identity' } : {} }); });
// imagem de um comprovante (como a captura de tela de um app)
const hoje = new Date().toISOString().slice(0, 10), dd = hoje.split('-').reverse().join('/');
const html = `<html><body style="margin:0;background:#fff;font:34px Arial;color:#111;width:1000px;padding:40px;box-sizing:border-box"><h1 style="font-size:46px">Comprovante de transferência</h1><p>${dd} - 09:42:10</p><p style="color:#555;font-size:28px">Valor</p><p style="font-size:44px"><b>R$ 1.350,00</b></p><p style="color:#555;font-size:28px">Tipo de transferência</p><p>Pix</p><p style="color:#555;font-size:28px">Destino</p><p style="color:#555;font-size:28px">Nome</p><p>Caixa Consorcios Ltda</p><p style="color:#555;font-size:28px">Instituição</p><p>CAIXA ECONOMICA FEDERAL</p><p style="color:#555;font-size:28px">Origem</p><p style="color:#555;font-size:28px">Nome</p><p>Hygor L A</p><p style="color:#555;font-size:28px">ID da transação</p><p>E18236120${hoje.replace(/-/g, '')}0942aB3dE5gH7jK</p></body></html>`;
const p2 = await ctx.newPage(); await p2.setContent(html); await p2.screenshot({ path: '/tmp/lg-foto-real.png', fullPage: true }); await p2.close();
await page.goto(B + '/'); await page.waitForTimeout(2500);
await page.evaluate((b) => { window.__dcmOcrCfg = { workerPath: b + '/__ocr/worker.min.js', corePath: b + '/__ocr/core', langPath: b + '/__ocr/lang', gzip: true }; }, B);
await page.evaluate(() => document.querySelector('#drawer [data-tab="extratos"]').click()); await page.waitForTimeout(1000);
await page.evaluate(() => { document.getElementById('impArq').style.display = 'block'; });
const lidos = () => page.evaluate(async () => (await (await fetch('/api/db/extratos')).json()).docs.filter((d) => d.data.tipo === 'documento').map((d) => d.data));
await page.setInputFiles('#impArq', '/tmp/lg-foto-real.png');
for (let i = 0; i < 90; i++) { await page.waitForTimeout(2000); if ((await lidos()).some((x) => x.dados && x.dados.viaFoto)) break; }
console.log('TOPO:', (await page.evaluate(() => document.getElementById('extTopo').innerText)).replace(/\s+/g, ' ').slice(0, 600)); const reqs = []; 
const docs = await lidos(), d = docs.find((x) => x.dados && x.dados.viaFoto);
console.log('LIDO PELO OCR:', JSON.stringify(d ? { kind: d.kind, valor: d.dados.valor, data: d.dados.data, hora: d.dados.hora, destino: d.dados.destino, origem: d.dados.origem, e2e: d.dados.e2e, selo: d.dados.selo, provas: d.dados.provas } : null));
check(!!d && d.kind === 'comprovante', 'a foto real foi lida pelo OCR e reconhecida como comprovante');
check(d && d.dados.valor === 135000, 'valor lido: R$ 1.350,00');
check(d && d.dados.data === hoje, 'data lida: ' + dd);
check(d && /Consorcios/i.test((d.dados.destino || {}).nome || ''), 'quem recebeu: Caixa Consorcios Ltda');
check(d && d.dados.selo === 'amarelo', 'foto sempre com selo AMARELO (confira os valores)');
check(erros.length === 0, 'sem erros de script' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close();
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
