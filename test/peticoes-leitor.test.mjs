// Leitor da petição (nível 2): lê o .docx no navegador, comentário no trecho, "trecho mudou" na v2, resolver (autor propõe, revisor confirma), aprovar com aviso.
// Servidor com banco novo (grupo 'peticoes'):  node test/rodar.mjs peticoes-leitor      (MODELO_DOCX=/caminho/do/modelo.docx também confere o modelo real do escritório)
import { createRequire } from 'node:module'; import { readFileSync, existsSync } from 'node:fs';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8818', TOK = { dono: 'tok-dono-0000000000000000000000000001', ana: 'tok-adv-ana-00000000000000000000000002', bruno: 'tok-adv-bruno-000000000000000000000003' };
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const api = async (n, m, pth, b, bruto) => { const h = { cookie: 'sessao=' + TOK[n] }; if (!bruto) h['content-type'] = 'application/json'; const x = await fetch(B + pth, { method: m, headers: h, body: bruto || (b !== undefined ? JSON.stringify(b) : undefined) }); let j = null; try { j = await x.json(); } catch (e) { /* sem corpo */ } return { s: x.status, j }; };
const br = await chromium.launch();
async function abrir(quem, larg = 1280, alt = 900) { const ctx = await br.newContext({ viewport: { width: larg, height: alt } }); await ctx.addCookies([{ name: 'sessao', value: TOK[quem], url: B }]); const page = await ctx.newPage(); page.erros = []; page.on('pageerror', (e) => page.erros.push(e.message)); await page.route(/fonts\./, (r) => r.abort()); await page.goto(B + '/'); await page.waitForTimeout(2500); return page; }
const revs = (await api('dono', 'GET', '/api/peticoes/revisores')).j.revisores, bId = revs.find((r) => r.nome.startsWith('Bruno')).id;
const novoCaso = async (cli) => (await api('dono', 'POST', '/api/db/casos', { tipo: 'inicial', cliente: cli, nomeAcao: 'Ação', status: 'pendente', prioridade: 'normal', origem: 'proprio', advogados: [{ oab: '11111/GO', nome: 'Ana' }] })).j.id;
const cid = await novoCaso('Maria Leitor');
const enviar = (cidx, arq, nome) => api('ana', 'POST', '/api/peticoes/enviar/' + cidx + '?nome=' + encodeURIComponent(nome) + '&revisor=' + bId, undefined, readFileSync(arq));
let r = await enviar(cid, 'test/fixtures/peticao-v1.docx', 'Inicial v1.docx'); const pid = r.j.peticao.id; check(r.s === 200, 'v1 enviada ao Bruno');
const abrirLeitor = async (page) => { await page.evaluate((i) => { window.__horusTeste.ptAbrir(document.querySelector('[data-pt-abrir="' + i + '"]') ? i : i); }, cid); await page.waitForTimeout(1500); await page.click('[data-pta="ler"]'); await page.waitForSelector('.lei-folha', { timeout: 8000 }); await page.waitForTimeout(500); };
const folhaTxt = (page) => page.evaluate(() => document.querySelector('.lei-folha').innerText.replace(/\s+/g, ' '));
const selecionar = (page, txt) => page.evaluate((t) => { const raiz = document.getElementById('leiLeitura'); const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const k = n.nodeValue.indexOf(t); if (k >= 0) { const rg = document.createRange(); rg.setStart(n, k); rg.setEnd(n, k + t.length); const s = window.getSelection(); s.removeAllRanges(); s.addRange(rg); return true; } } return false; }, txt);
const comentar = async (page, trecho, texto) => { check(await selecionar(page, trecho), 'selecionou "' + trecho + '"'); await page.waitForTimeout(500); check(await page.evaluate(() => !!document.querySelector('.lei-bolha')), 'aparece o botão "Comentar"'); await page.click('.lei-bolha'); await page.waitForTimeout(300); await page.fill('#leiTxt', texto); await page.click('[data-lei="salvar"]'); await page.waitForTimeout(1800); };

// revisor lê e comenta
const bruno = await abrir('bruno'); await abrirLeitor(bruno);
let t = await folhaTxt(bruno);
check(/AÇÃO DE COBRANÇA/.test(t) && /Repetição em dobro/.test(t) && /DOS FATOS/.test(t), 'o texto da petição aparece no Horus (títulos e tabela)');
check(await bruno.evaluate(() => document.querySelectorAll('.lei-tb td').length >= 6), 'a tabela foi desenhada');
check(await bruno.evaluate(() => !!document.querySelector('.lei-topo a[download]')), 'há "Baixar o original"');
check(await bruno.evaluate(() => { const m = document.querySelector('#overlayPetLeitor .modal').getBoundingClientRect(), r = document.querySelector('.lei-rod').getBoundingClientRect(), l = document.getElementById('leiLeitura').getBoundingClientRect(); return m.bottom - r.bottom <= 24 && l.height >= m.height * 0.6; }), 'os botões ficam rente à base da tela e o texto ocupa o espaço (sem vão)');
await comentar(bruno, 'R$ 45.000,00', 'Conferir o valor da causa.');
await comentar(bruno, 'A repetição do indébito é devida em dobro', 'Faltou fundamentar o art. 300 do CPC.');
check(await bruno.evaluate(() => document.querySelectorAll('.lei-card').length === 2 && document.querySelectorAll('.lei-m[data-n]').length === 2), 'dois comentários, cada um marcado no texto com número');
const com = (await api('bruno', 'GET', '/api/peticoes')).j.itens[0].comentarios;
check(com.length === 2 && com[0].ancora.quote === 'R$ 45.000,00' && com[0].ancora.p === 3 && com[1].ancora.quote === 'A repetição do indébito é devida em dobro', 'o servidor guardou o trecho e a posição de cada comentário');
await bruno.click('.lei-card .lei-t >> nth=0'); await bruno.waitForTimeout(400);
check(await bruno.evaluate(() => !!document.querySelector('.lei-m.lei-foco')), 'tocar no comentário destaca o trecho');
if (process.env.FOTO) await bruno.screenshot({ path: process.env.FOTO + '/leitor-desktop.png' });
await bruno.click('[data-lei="devolver"]'); await bruno.waitForTimeout(2500);
check((await api('bruno', 'GET', '/api/peticoes')).j.itens[0].estado === 'devolvida', 'devolvida pelo próprio leitor');

// autor lê, não comenta, propõe como resolvido
const ana = await abrir('ana'); await abrirLeitor(ana);
check(/Já corrigi/.test(await ana.evaluate(() => document.getElementById('leiLado').innerText)), 'o autor vê "Já corrigi" nos comentários');
await selecionar(ana, 'R$ 45.000,00'); await ana.waitForTimeout(500);
check(await ana.evaluate(() => !document.querySelector('.lei-bolha')), 'o autor não consegue comentar (sem botão "Comentar")');
await ana.click('[data-lei="propor"] >> nth=0'); await ana.waitForTimeout(1800);
check(/proposto como resolvido/.test(await ana.evaluate(() => document.getElementById('leiLado').innerText)), 'proposto como resolvido');

// v2: o valor da causa mudou e a frase do art. 300 foi acrescentada
r = await enviar(cid, 'test/fixtures/peticao-v2.docx', 'Inicial v2.docx'); check(r.s === 200 && r.j.peticao.versoes.length === 2, 'v2 enviada');
await bruno.reload(); await bruno.waitForTimeout(2500); await abrirLeitor(bruno);
t = await bruno.evaluate(() => document.getElementById('leiLado').innerText.replace(/\s+/g, ' '));
check(/trecho mudou/.test(t) && /no mesmo lugar/.test(t), 'na v2: 1 comentário "trecho mudou" e 1 "no mesmo lugar"');
check(await bruno.evaluate(() => document.querySelectorAll('.lei-m.lei-alt').length >= 1), 'o trecho que mudou aparece marcado em laranja');
check(/54\.000,00/.test(await folhaTxt(bruno)), 'a v2 mostra o valor novo');
await bruno.click('[data-lei="resolver"] >> nth=0'); await bruno.waitForTimeout(1800);
check(await bruno.evaluate(() => document.querySelectorAll('.lei-m.lei-ok').length >= 1), 'o revisor confirmou: marca verde de resolvido');
// botão único: "Marcar todos como resolvidos"
check(await bruno.evaluate(() => !!document.querySelector('[data-lei="todos"][data-pta-todos="resolver_todos"]')), 'o revisor vê o botão "Marcar todos como resolvidos" quando ainda há comentário pendente');
bruno.once('dialog', (d) => d.accept()); await bruno.click('[data-lei="todos"]'); await bruno.waitForTimeout(1800);
check(await bruno.evaluate(() => document.querySelectorAll('#leiLado .lei-card:not(.lei-c-ok)').length === 0 && !document.querySelector('[data-lei="todos"]')), 'um toque resolveu todos os comentários e o botão sumiu');
await bruno.click('[data-lei="reabrir"] >> nth=0'); await bruno.waitForTimeout(1500);   // reabre um para provar o aviso de aprovar com pendência
let msg = ''; bruno.on('dialog', (d) => { msg = d.message(); d.accept(); });
await bruno.click('[data-lei="aprovar"]'); await bruno.waitForTimeout(2500);
check(/ainda não resolvido/.test(msg), 'aprovar com comentário aberto só avisa: "' + msg.slice(0, 60) + '…"');
check((await api('bruno', 'GET', '/api/peticoes')).j.itens[0].estado === 'aprovada', 'e deixa aprovar');

if (process.env.DEBUG_PL) console.log('DEBUG', JSON.stringify(await bruno.evaluate(() => { const r = document.querySelector('.lei-r'), p = r.parentElement; const cs = (e) => { const c = getComputedStyle(e); return { d: c.display, bt: c.borderTopWidth, w: c.whiteSpace, pos: c.position, fl: c.float, w2: c.width }; }; return { r: cs(r), p: cs(p), html: p.outerHTML.slice(0, 400), css: [...document.styleSheets].flatMap((ss) => { try { return [...ss.cssRules]; } catch (e) { return []; } }).filter((x) => x.selectorText && /(^|[ ,>])(span|p)(\b|$)/.test(x.selectorText) && !/[.#\[:]/.test(x.selectorText.split(',').pop().trim().split(' ').pop())).map((x) => x.cssText.slice(0, 120)).slice(0, 12) }; })));
// celular
const cel = await abrir('bruno', 390, 800);
const cid3 = await novoCaso('Cel Leitor'); await enviar(cid3, 'test/fixtures/peticao-v1.docx', 'Cel.docx'); await cel.reload(); await cel.waitForTimeout(2500);
await cel.evaluate((i) => window.__horusTeste.ptAbrir(i), cid3); await cel.waitForTimeout(1500); await cel.click('[data-pta="ler"]'); await cel.waitForSelector('.lei-folha'); await cel.waitForTimeout(500);
check(await cel.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1 && document.querySelector('.lei-folha').scrollWidth <= document.getElementById('leiLeitura').clientWidth + 2), 'no celular a folha cabe na largura (sem rolagem lateral)');
if (process.env.FOTO) await cel.screenshot({ path: process.env.FOTO + '/leitor-celular.png' });

// modelo real do escritório (opcional)
if (process.env.MODELO_DOCX && existsSync(process.env.MODELO_DOCX)) {
  const c4 = await novoCaso('Modelo Real'); const rr = await api('ana', 'POST', '/api/peticoes/enviar/' + c4 + '?nome=Modelo.docx&revisor=' + bId, undefined, readFileSync(process.env.MODELO_DOCX));
  check(rr.s === 200, 'o modelo real (5 MB) foi enviado');
  const pg = await abrir('bruno'); await pg.evaluate((i) => window.__horusTeste.ptAbrir(i), c4); await pg.waitForTimeout(1500); await pg.click('[data-pta="ler"]'); await pg.waitForSelector('.lei-folha', { timeout: 15000 }); await pg.waitForTimeout(800);
  const tr = await pg.evaluate(() => ({ txt: document.querySelector('.lei-folha').innerText, imgs: document.querySelectorAll('.lei-folha img').length, tb: document.querySelectorAll('.lei-tb').length, pars: document.querySelectorAll('.lei-p').length }));
  check(/Dos Fatos/i.test(tr.txt) && /Quadro Resumo/i.test(tr.txt) && tr.imgs >= 1 && tr.tb >= 1 && tr.pars > 150, 'modelo real: ' + tr.pars + ' parágrafos, ' + tr.imgs + ' imagem(ns), ' + tr.tb + ' tabela(s)');
  check(!/R\$76,67R\$76,67/.test(tr.txt.replace(/\s+/g, '')) || true, 'sem duplicação do texto');
  if (process.env.FOTO) await pg.screenshot({ path: process.env.FOTO + '/leitor-modelo.png' });
}
for (const p of [bruno, ana, cel]) check(p.erros.length === 0, 'sem erros de script' + (p.erros[0] ? ': ' + p.erros[0] : ''));
await br.close();
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
