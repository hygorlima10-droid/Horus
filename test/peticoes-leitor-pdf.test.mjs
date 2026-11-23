// Leitor de PDF da petição (etapa C): página fiel (pdf.js), texto selecionável, comentário no trecho, reencontro na v2 e comentário da página em PDF escaneado.
// Precisa do pdf.js local (como o teste de extratos):  PDFJS=/pasta/do/pdfjs/build/  (npm pack pdfjs-dist@3.11.174).  MODELO_PDF=/caminho/modelo.pdf confere o modelo real.
//   node test/rodar.mjs peticoes-leitor-pdf
import { createRequire } from 'node:module'; import fs from 'node:fs';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const PDFJS = process.env.PDFJS || '/tmp/claude-0/-home-user/73bc448f-589a-50cb-a941-bd114c59c1e4/scratchpad/pdfjs/package/build/';
const B = process.env.BASE || 'http://127.0.0.1:8818', TOK = { dono: 'tok-dono-0000000000000000000000000001', ana: 'tok-adv-ana-00000000000000000000000002', bruno: 'tok-adv-bruno-000000000000000000000003' };
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
if (!fs.existsSync(PDFJS + 'pdf.min.js')) { console.log('  (pulado: pdf.js local não encontrado em ' + PDFJS + ')'); process.exit(0); }
const api = async (n, m, pth, b, bruto) => { const h = { cookie: 'sessao=' + TOK[n] }; if (!bruto) h['content-type'] = 'application/json'; const x = await fetch(B + pth, { method: m, headers: h, body: bruto || (b !== undefined ? JSON.stringify(b) : undefined) }); let j = null; try { j = await x.json(); } catch (e) { /* sem corpo */ } return { s: x.status, j }; };
const br = await chromium.launch();
async function abrir(quem, larg = 1280, alt = 900) { const ctx = await br.newContext({ viewport: { width: larg, height: alt } }); await ctx.addCookies([{ name: 'sessao', value: TOK[quem], url: B }]); const page = await ctx.newPage(); page.erros = []; page.on('pageerror', (e) => page.erros.push(e.message));
  await page.route(/fonts\./, (r) => r.abort()); await page.route(/cdnjs.*pdf\.min\.js/, (r) => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(PDFJS + 'pdf.min.js') })); await page.route(/cdnjs.*pdf\.worker\.min\.js/, (r) => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(PDFJS + 'pdf.worker.min.js') }));
  await page.goto(B + '/'); await page.waitForTimeout(2500); return page; }
const revs = (await api('dono', 'GET', '/api/peticoes/revisores')).j.revisores, bId = revs.find((r) => r.nome.startsWith('Bruno')).id;
const novoCaso = async (cli) => (await api('dono', 'POST', '/api/db/casos', { tipo: 'inicial', cliente: cli, nomeAcao: 'Ação', status: 'pendente', prioridade: 'normal', origem: 'proprio', advogados: [{ oab: '11111/GO', nome: 'Ana' }] })).j.id;
const enviar = (cid, arq, nome) => api('ana', 'POST', '/api/peticoes/enviar/' + cid + '?nome=' + encodeURIComponent(nome) + '&revisor=' + bId, undefined, fs.readFileSync(arq));
const abrirLeitor = async (page, cid) => { await page.evaluate(() => ['overlayPetLeitor', 'overlayPet'].forEach((i) => { const e = document.getElementById(i); if (e) e.classList.remove('show'); })); await page.evaluate((i) => window.__horusTeste.ptAbrir(i), cid); await page.waitForTimeout(1500); await page.click('[data-pta="ler"]'); await page.waitForSelector('.lei-pg', { timeout: 15000 }); await page.waitForSelector('.lei-tl span, .lei-pgh', { timeout: 15000 }); await page.waitForTimeout(1500); };
/* seleciona um texto da camada de texto da página 1 (pode atravessar vários trechos) */
const selecionar = (page, txt, pg = 1) => page.evaluate(([t, pg]) => { const tl = document.querySelector('.lei-pg[data-pg="' + pg + '"] .lei-tl'); const sp = [...tl.querySelectorAll('span')]; let tot = '', ini = []; sp.forEach((s) => { ini.push(tot.length); tot += s.textContent; }); const k = tot.indexOf(t); if (k < 0) return false;
  const loc = (pos) => { for (let i = sp.length - 1; i >= 0; i--) if (ini[i] <= pos) return [sp[i].firstChild, pos - ini[i]]; }; const a = loc(k), b = loc(k + t.length - 1); const rg = document.createRange(); rg.setStart(a[0], a[1]); rg.setEnd(b[0], b[1] + 1); const s = window.getSelection(); s.removeAllRanges(); s.addRange(rg); return true; }, [txt, pg]);
const comentar = async (page, trecho, texto) => { check(await selecionar(page, trecho), 'selecionou "' + trecho + '" no PDF'); await page.waitForTimeout(500); check(await page.evaluate(() => !!document.querySelector('.lei-bolha')), 'aparece o botão "Comentar"'); await page.click('.lei-bolha'); await page.waitForTimeout(300); await page.fill('#leiTxt', texto); await page.click('[data-lei="salvar"]'); await page.waitForTimeout(1800); };

const cid = await novoCaso('Maria PDF'); let r = await enviar(cid, 'test/fixtures/peticao-v1.pdf', 'Inicial v1.pdf'); const pid = r.j.peticao.id; check(r.s === 200, 'v1 em PDF enviada');
const bruno = await abrir('bruno'); await abrirLeitor(bruno, cid);
check(await bruno.evaluate(() => document.querySelectorAll('.lei-pg canvas').length >= 1 && document.querySelectorAll('.lei-tl span').length > 5), 'a página do PDF foi desenhada (imagem fiel + texto selecionável)');
check(/AÇÃO DE COBRANÇA/.test(await bruno.evaluate(() => document.querySelector('.lei-tl').textContent)), 'o texto da página foi lido do PDF');
await comentar(bruno, 'R$ 45.000,00', 'Conferir o valor da causa.');
await comentar(bruno, 'AÇÃO DE COBRANÇA', 'Detalhar o tipo de cobrança.');
let com = (await api('bruno', 'GET', '/api/peticoes')).j.itens[0].comentarios;
check(com.length === 2 && com[0].ancora.quote === 'R$ 45.000,00' && com[0].ancora.pag === 1 && com[1].ancora.quote === 'AÇÃO DE COBRANÇA', 'o servidor guardou o trecho e a página');
check(await bruno.evaluate(() => document.querySelectorAll('.lei-pm[data-n]').length === 2 && document.querySelectorAll('.lei-card').length === 2), 'os dois trechos aparecem marcados e numerados');
if (process.env.DEBUG_PL) console.log('DEBUG', JSON.stringify(await bruno.evaluate(() => { const e = document.querySelector('.lei-pm'); const c = getComputedStyle(e); const r = e.getBoundingClientRect(); return { bg: c.backgroundColor, col: c.color, pos: c.position, disp: c.display, w: r.width, h: r.height, x: r.x, y: r.y, fs: c.fontSize, cls: e.className, bf: getComputedStyle(e, '::before').content }; })));
if (process.env.FOTO) await bruno.screenshot({ path: process.env.FOTO + '/leitor-pdf.png' });
await bruno.click('[data-lei="devolver"]'); await bruno.waitForTimeout(2500);

// v2 em PDF: valor mudou, o outro trecho continua
r = await enviar(cid, 'test/fixtures/peticao-v2.pdf', 'Inicial v2.pdf'); check(r.s === 200, 'v2 em PDF enviada');
await bruno.reload(); await bruno.waitForTimeout(2500); await abrirLeitor(bruno, cid);
const lado = await bruno.evaluate(() => document.getElementById('leiLado').innerText.replace(/\s+/g, ' '));
check(/trecho mudou/.test(lado) && /no mesmo lugar/.test(lado), 'na v2: "trecho mudou" (valor) e "no mesmo lugar" (cobrança)');
check(await bruno.evaluate(() => document.querySelectorAll('.lei-pm.lei-alt').length >= 1), 'o trecho que mudou aparece em laranja');

// PDF escaneado: comentário da página
const c2 = await novoCaso('Escaneada'); await enviar(c2, 'test/fixtures/peticao-escaneada.pdf', 'Escaneada.pdf');
await abrirLeitor(bruno, c2);
check(/escaneada/.test(await bruno.evaluate(() => document.querySelector('.lei-pgh').innerText)), 'a página sem texto é identificada como escaneada');
await bruno.click('[data-lei="pagina"]'); await bruno.waitForTimeout(400); await bruno.fill('#leiTxt', 'Assinatura ilegível nesta página.'); await bruno.click('[data-lei="salvar"]'); await bruno.waitForTimeout(1800);
const cp = (await api('bruno', 'GET', '/api/peticoes')).j.itens.find((x) => x.casoId === c2).comentarios;
check(cp.length === 1 && cp[0].ancora.pagina === true && cp[0].ancora.pag === 1, 'comentário da página guardado (' + (cp[0] && cp[0].ancora.quote) + ')');
check(await bruno.evaluate(() => document.querySelectorAll('.lei-pgb').length === 1 && /Página 1/.test(document.getElementById('leiLado').innerText)), 'o selo da página e o comentário aparecem');

// celular
const cel = await abrir('bruno', 390, 800); await abrirLeitor(cel, cid);
check(await cel.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1 && document.querySelector('.lei-pg').getBoundingClientRect().width <= document.getElementById('leiLeitura').clientWidth + 2), 'no celular a página cabe na largura');
if (process.env.FOTO) await cel.screenshot({ path: process.env.FOTO + '/leitor-pdf-celular.png' });

if (process.env.MODELO_PDF && fs.existsSync(process.env.MODELO_PDF)) {
  const c4 = await novoCaso('Modelo PDF'); const rr = await enviar(c4, process.env.MODELO_PDF, 'Modelo.pdf'); check(rr.s === 200, 'o modelo real em PDF foi enviado');
  const pg = await abrir('bruno'); await abrirLeitor(pg, c4);
  const tr = await pg.evaluate(() => ({ n: document.querySelectorAll('.lei-pg').length, txt: document.querySelector('.lei-tl') ? document.querySelector('.lei-tl').textContent : '', cv: document.querySelectorAll('.lei-pg canvas').length }));
  check(tr.n >= 20 && /Piracanjuba/.test(tr.txt) && tr.cv >= 1, 'modelo real: ' + tr.n + ' páginas, página 1 com texto e imagem desenhada');
  if (process.env.FOTO) await pg.screenshot({ path: process.env.FOTO + '/leitor-pdf-modelo.png' });
}
for (const p of [bruno, cel]) check(p.erros.length === 0, 'sem erros de script' + (p.erros[0] ? ': ' + p.erros[0] : ''));
await br.close();
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
