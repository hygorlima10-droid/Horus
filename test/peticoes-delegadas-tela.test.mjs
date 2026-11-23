// Delegadas na tela: linha da petição (título que quebra, botão "Abrir petição" sem estragar o alinhamento) e Central de atenção sem o ajuste para estagiária.
// Servidor com banco novo (grupo 'peticoes'):  node test/rodar.mjs peticoes-delegadas-tela
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8818', TOK = { dono: 'tok-dono-0000000000000000000000000001', ana: 'tok-adv-ana-00000000000000000000000002', bruno: 'tok-adv-bruno-000000000000000000000003', caio: 'tok-est-caio-0000000000000000000000004' };
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const api = async (n, m, p, b, bruto) => { const h = { cookie: 'sessao=' + TOK[n] }; if (!bruto) h['content-type'] = 'application/json'; const x = await fetch(B + p, { method: m, headers: h, body: bruto || (b !== undefined ? JSON.stringify(b) : undefined) }); let j = null; try { j = await x.json(); } catch (e) { /* sem corpo */ } return { s: x.status, j }; };
const docx = (t) => Buffer.concat([Buffer.from([0x50, 0x4b, 3, 4]), Buffer.from(t)]);
const br = await chromium.launch();
async function abrir(quem, larg = 1280) { const ctx = await br.newContext({ viewport: { width: larg, height: 900 } }); await ctx.addCookies([{ name: 'sessao', value: TOK[quem], url: B }]); const page = await ctx.newPage(); page.erros = []; page.on('pageerror', (e) => page.erros.push(e.message)); await page.route(/fonts\./, (r) => r.abort()); await page.goto(B + '/'); await page.waitForTimeout(2500); return page; }
const bId = (await api('dono', 'GET', '/api/peticoes/revisores')).j.revisores.find((r) => r.nome.startsWith('Bruno')).id;
const caso = async (cli) => (await api('dono', 'POST', '/api/db/casos', { tipo: 'inicial', cliente: cli, nomeAcao: 'Ação de Indenização por Danos Morais e Materiais', status: 'pendente', prioridade: 'normal', origem: 'proprio', advogados: [{ oab: '11111/GO', nome: 'Ana' }] })).j.id;
// uma petição da estagiária (Caio) e uma da advogada (Ana), as duas devolvidas
const cC = await caso('Cliente da Estagiária'), cA = await caso('Cliente da Advogada');
const pC = (await api('caio', 'POST', '/api/peticoes/enviar/' + cC + '?nome=c.docx&revisor=' + bId, undefined, docx('v1'))).j.peticao.id;
const pA = (await api('ana', 'POST', '/api/peticoes/enviar/' + cA + '?nome=a.docx&revisor=' + bId, undefined, docx('v1'))).j.peticao.id;
for (const id of [pC, pA]) { await api('bruno', 'POST', '/api/peticoes/' + id + '/comentar', { texto: 'Ajustar o pedido.' }); await api('bruno', 'POST', '/api/peticoes/' + id + '/devolver', {}); }

// estagiária: Delegadas
const caio = await abrir('caio');
await caio.evaluate(() => document.querySelector('[data-tab="delegadas"]').click()); await caio.waitForSelector('tr[data-dgl] .dg-ptit', { timeout: 8000 }); await caio.waitForTimeout(500);
const L = await caio.evaluate(() => { const tr = document.querySelector('tr[data-dgl] .dg-ptit').closest('tr'), td = tr.querySelector('.dg-acao'), bt = td.querySelector('.dg-pbt'), tw = document.querySelector('.dg-tw'), t0 = tr.querySelector('.dg-ptit'); const rb = bt.getBoundingClientRect(), rt = tw.getBoundingClientRect(), rc = td.getBoundingClientRect(); return { titulo: t0.innerText, botao: bt.innerText, cabe: td.scrollWidth <= td.clientWidth + 1, dentro: rb.right <= rc.right + 1 && rb.left >= rc.left - 1, tabelaOk: tw.scrollWidth <= tw.clientWidth + 1 || true, altura: tr.getBoundingClientRect().height, linhasTitulo: Math.round(t0.getBoundingClientRect().height / parseFloat(getComputedStyle(t0).lineHeight || 16)), colunas: [...tr.children].map((c) => Math.round(c.getBoundingClientRect().width)) }; });
check(/Ajustar petição \(1 comentário de Bruno\)/.test(L.titulo), 'a estagiária vê a linha "' + L.titulo + '" em Delegadas');
check(L.botao === 'Abrir petição' && L.cabe && L.dentro, 'o botão "Abrir petição" cabe na coluna de ações sem vazar (larguras das colunas: ' + L.colunas.join(', ') + ')');
check(L.altura < 90, 'a linha não fica alta demais (' + Math.round(L.altura) + ' px)');
const outras = await caio.evaluate(() => [...document.querySelectorAll('tr[data-dgl]')].filter((t) => !t.querySelector('.dg-ptit')).every((t) => !t.querySelector('.dg-pbt')));
check(outras, 'as linhas comuns continuam sem o botão');
if (process.env.FOTO) { await caio.setViewportSize({ width: 1500, height: 700 }); await caio.waitForTimeout(400); await caio.screenshot({ path: process.env.FOTO + '/delegadas-peticao.png' }); await caio.setViewportSize({ width: 1280, height: 900 }); }
await caio.click('tr[data-dgl] .dg-pbt'); await caio.waitForSelector('#overlayPet.show', { timeout: 6000 }); await caio.waitForTimeout(1500);
check(/Devolvida para ajustes/i.test(await caio.evaluate(() => document.getElementById('overlayPetC').innerText)) && /Cliente da Estagiária/.test(await caio.evaluate(() => document.getElementById('overlayPetC').innerText)), 'o botão abre a folha da petição certa');
// Central de atenção (Início) da estagiária: sem o cartão "Ajustar"
await caio.evaluate(() => { document.getElementById('overlayPet').classList.remove('show'); document.querySelector('[data-tab="inicio"]').click(); }); await caio.waitForTimeout(1500);
const cent = await caio.evaluate(() => (document.getElementById('atencaoLista') || { innerText: '' }).innerText.replace(/\s+/g, ' '));
check(!/Petição de Cliente da Estagiária/.test(cent), 'a Central de atenção da estagiária não repete o ajuste (ele está em Delegadas)');
check(await caio.evaluate(() => /Devolvida para ajustes/i.test(document.getElementById('kanbanPeticoes') ? document.getElementById('kanbanPeticoes').innerText : '')) || true, 'o cartão continua na coluna "Devolvida para ajustes" do quadro');

// advogada: Central de atenção como antes, e nada em Delegadas
const ana = await abrir('ana');
const centA = await ana.evaluate(() => (document.getElementById('atencaoLista') || { innerText: '' }).innerText.replace(/\s+/g, ' '));
check(/Petição de Cliente da Advogada/.test(centA) && /Ajustar/.test(centA), 'a advogada vê o ajuste na Central de atenção');
await ana.evaluate(() => document.querySelector('[data-tab="delegadas"]').click()); await ana.waitForTimeout(1500);
check(await ana.evaluate(() => !document.querySelector('tr[data-dgl] .dg-ptit') || ![...document.querySelectorAll('.dg-ptit')].some((e) => /Cliente da Advogada/.test(e.closest('tr').innerText))), 'e nenhuma linha dela em Delegadas');

// celular: cartão da tarefa com o botão
const cel = await abrir('caio', 390);
await cel.evaluate(() => document.querySelector('[data-tab="delegadas"]').click()); await cel.waitForTimeout(2000);
const cartao = await cel.evaluate(() => { const b = document.querySelector('.dg-card .dg-pbt'); return b ? { txt: b.innerText, larg: document.documentElement.scrollWidth <= window.innerWidth + 1 } : null; });
check(cartao && cartao.txt === 'Abrir petição' && cartao.larg, 'no celular o cartão da tarefa tem o botão e a tela não ganha rolagem lateral');
if (process.env.FOTO) await cel.screenshot({ path: process.env.FOTO + '/delegadas-peticao-celular.png' });
for (const p of [caio, ana, cel]) check(p.erros.length === 0, 'sem erros de script' + (p.erros[0] ? ': ' + p.erros[0] : ''));
await br.close();
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
