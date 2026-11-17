// Testa na tela as publicações compartilhadas entre responsáveis: selo "tratada por", "fulano leu, sem prazo", filtro "Tratadas por colegas" e a Agenda tratando a publicação.
// Servidor individual com banco semeado (grupo 'permissoes'):  node test/rodar.mjs publicacoes-colegas-tela
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8816', TOK = { dono: 'tok-dono-0000000000000000000000000001', ana: 'tok-adv-ana-00000000000000000000000002', bruno: 'tok-adv-bruno-000000000000000000000003', caio: 'tok-est-caio-0000000000000000000000004', dani: 'tok-est-dani-0000000000000000000000005' };
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const api = async (n, m, pth, b) => { const x = await fetch(B + pth, { method: m, headers: { cookie: 'sessao=' + TOK[n], 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined }); let j = null; try { j = await x.json(); } catch (e) { /* sem corpo */ } return { s: x.status, j }; };
// zera o que testes anteriores do grupo deixaram nas publicações 100 e 102 (leitura própria e tratamento)
for (const n of ['dono', 'ana', 'bruno', 'caio', 'dani']) await api(n, 'POST', '/api/djen/marcar', { ids: ['100', '101', '102', '103'], lida: null, semPrazo: null, tratada: false });
const br = await chromium.launch();
async function abrir(quem) {
  const ctx = await br.newContext({ viewport: { width: 1280, height: 900 } }); await ctx.addCookies([{ name: 'sessao', value: TOK[quem], url: B }]);
  const page = await ctx.newPage(); page.erros = []; page.on('pageerror', (e) => page.erros.push(e.message)); await page.route(/fonts\./, (r) => r.abort());
  await page.addInitScript(() => { try { localStorage.setItem('horus.subaba.v1', JSON.stringify({ sub: { publicacoes: 'todas' }, per: 6 })); } catch (e) { /* sem armazenamento */ } });
  await page.goto(B + '/'); await page.waitForTimeout(2500);
  await page.evaluate(() => document.querySelector('[data-tab="publicacoes"]').click()); await page.waitForTimeout(1400);
  return page;
}
const card = (page, id) => page.evaluate((i) => { const c = document.querySelector('.pb-card[data-cid="' + i + '"]'); return c ? c.innerText.replace(/\s+/g, ' ') : ''; }, id);
const clicaFiltro = (page, k) => page.evaluate((v) => { const b = document.querySelector('[data-pb="filtro"][data-v="' + v + '"]'); if (b) b.click(); }, k);

// a Ana (advogada) cria uma tarefa a partir da publicação 102 pela Agenda: isso vale como tratar
const ana = await abrir('ana');
await ana.evaluate(() => window.__horusTeste.fichas.agAbrir(null, { tipo: 'tarefa', titulo: 'Providência — Intimação 102', processo: '0000003-33.2024.8.09.0003', cliente: 'Cliente Um', data: '2026-12-30', audPubId: '102' })); await ana.waitForTimeout(700);
await ana.click('[data-age="salvar"]'); await ana.waitForTimeout(1400);
const p102 = (await api('ana', 'GET', '/api/djen/lista')).j.pubs.find((p) => p.id === '102');
check(p102.tratadas.some((t) => t.meu && t.como === 'tarefa') && p102.lida === true, 'criar uma tarefa pela Agenda a partir da publicação conta como tratar');

// o Bruno (colega no mesmo processo) vê a 102 como lida, com o selo "tratada por Ana", e o filtro novo
const bruno = await abrir('bruno');
let c102 = await card(bruno, '102');
check(/tratada por Ana/.test(c102) && /lida/i.test(await bruno.evaluate(() => { const c = document.querySelector('.pb-card[data-cid="102"]'); return c ? c.className : ''; })), 'para o Bruno a 102 aparece como lida e com o selo "tratada por Ana"');
check(await bruno.evaluate(() => !!document.querySelector('[data-pb="filtro"][data-v="tratadas"]')), 'aparece o filtro "Tratadas por colegas"');
await clicaFiltro(bruno, 'tratadas'); await bruno.waitForTimeout(500);
check(await bruno.evaluate(() => document.querySelectorAll('.pb-card').length) === 1 && /tratada por Ana/.test(await card(bruno, '102')), 'o filtro mostra só a publicação tratada pela colega');
await clicaFiltro(bruno, 'naolidas'); await bruno.waitForTimeout(400);
check(!/Cooperativa|Intimação 102/.test(await bruno.evaluate(() => document.getElementById('pbListaBox').innerText)) || (await bruno.evaluate(() => document.querySelectorAll('.pb-card[data-cid="102"]').length)) === 0, 'e ela sai da aba "Não lidas" do Bruno');

// só ler: a Ana lê a 100 sem criar nada; a Dani (estagiária) continua vendo como não lida, com "Ana leu, sem prazo"
await api('ana', 'POST', '/api/djen/marcar', { ids: ['100'], lida: true });
const dani = await abrir('dani');
const c100 = await card(dani, '100');
check(/Ana leu, sem prazo/.test(c100) && !(await dani.evaluate(() => (document.querySelector('.pb-card[data-cid="100"]') || { className: '' }).className.includes('lida'))), 'a estagiária continua vendo a 100 como não lida, com o aviso "Ana leu, sem prazo"');
// estagiária trata: advogados continuam sem ver como lida ("preparada por")
await api('dani', 'POST', '/api/djen/marcar', { ids: ['100'], tratada: true, como: 'prazo' });
const ana2 = await abrir('ana'); const c100a = await card(ana2, '100');
check(/preparada por Dani/.test(c100a), 'a Ana vê "preparada por Dani" na 100 que a estagiária tratou');
check([ana, bruno, dani, ana2].every((p) => p.erros.length === 0), 'sem erros de JavaScript');
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
