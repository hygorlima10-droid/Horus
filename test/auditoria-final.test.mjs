// Auditoria de layout e identidade visual por papel e tamanho de tela (não é teste de regressão: gera um relatório em /tmp/auditoria/relatorio.json e capturas).
// Servidor do grupo 'auditoria':  FOTOS=/tmp/auditoria node test/rodar.mjs auditoria
import { createRequire } from 'node:module';
import fs from 'node:fs';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8816', OUT = process.env.FOTOS || '/tmp/auditoria';
fs.mkdirSync(OUT, { recursive: true });
const TOK = { dono: 'tok-dono-0000000000000000000000000001', ana: 'tok-adv-ana-00000000000000000000000002', caio: 'tok-est-caio-0000000000000000000000004' };
const rel = { telas: [], fichas: [] };
const br = await chromium.launch();
const MEDE = () => {
  const vis = (e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && e.offsetParent !== null; };
  const txt = (e) => (e.innerText || e.getAttribute('aria-label') || e.title || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  const raiz = document.querySelector('.overlay.show .modal, .overlay.show') || document;
  const botoes = [...raiz.querySelectorAll('button, a.q-b, [role="button"]')].filter(vis);
  const soTexto = botoes.filter((b) => { const cs = getComputedStyle(b); const semFundo = cs.backgroundColor === 'rgba(0, 0, 0, 0)' || cs.backgroundColor === 'transparent'; const semBorda = parseFloat(cs.borderTopWidth) === 0 && parseFloat(cs.borderLeftWidth) === 0; return semFundo && semBorda && txt(b).length > 1 && !b.querySelector('svg') && !/dr-it|seg-btn|bt-it|tb-btn|icon-btn|fb\b|aba|tab|pb-tg/.test(b.className) && !b.closest('#drawer, #btbar, .btbar, nav, summary'); }).map((b) => txt(b) + ' [' + (b.className || '').toString().slice(0, 30) + ']');
  const pequenos = botoes.filter((b) => { const r = b.getBoundingClientRect(); return (r.height < 32 || r.width < 32) && !b.closest('#drawer'); }).map((b) => txt(b) + ' ' + Math.round(b.getBoundingClientRect().width) + 'x' + Math.round(b.getBoundingClientRect().height));
  const campos = [...raiz.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea')].filter(vis).filter((c) => c.getBoundingClientRect().height < 36).map((c) => (c.id || c.name || c.type) + ' ' + Math.round(c.getBoundingClientRect().height));
  const fontes = {}; [...raiz.querySelectorAll('h1,h2,h3,b,p,span,label,button,div')].filter(vis).slice(0, 400).forEach((e) => { const f = getComputedStyle(e).fontFamily.split(',')[0].replace(/["']/g, '').trim(); fontes[f] = (fontes[f] || 0) + 1; });
  const emoji = (raiz.innerText || '').match(/\p{Extended_Pictographic}/gu) || [];
  return { overflowX: document.documentElement.scrollWidth > innerWidth + 1, soTexto: [...new Set(soTexto)].slice(0, 12), nSoTexto: soTexto.length, pequenos: [...new Set(pequenos)].slice(0, 8), campos: campos.slice(0, 6), fontes, emoji: [...new Set(emoji)].slice(0, 6) };
};
async function abrir(quem, w) {
  const ctx = await br.newContext({ viewport: { width: w, height: w < 600 ? 800 : 900 }, hasTouch: w < 600, isMobile: w < 600 }); await ctx.addCookies([{ name: 'sessao', value: TOK[quem], url: B }]);
  const page = await ctx.newPage(); page.erros = []; page.rec = [];
  page.on('pageerror', (e) => page.erros.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.|Failed to load resource/.test(m.text())) page.erros.push('console: ' + m.text()); });
  page.on('response', (r) => { if (r.url().includes('/api/') && r.status() >= 400) page.rec.push(r.status() + ' ' + r.url().replace(B, '')); });
  await page.route(/fonts\./, (x) => x.abort()); await page.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { } });
  await page.goto(B + '/'); await page.waitForFunction(() => window.__horusEu && window.__horusEu.pronto && window.__horusTeste && window.__horusTeste.abrirNovo && document.getElementById('mainTabs'), null, { timeout: 60000 }); await page.waitForTimeout(2200);
  return page;
}
const nomeArq = (s) => s.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 50);
for (const quem of ['dono', 'ana', 'caio']) for (const w of [1280, 390]) {
  const p = await abrir(quem, w);
  const tabs = await p.evaluate(() => [...new Set([...document.querySelectorAll('#drawer [data-tab]')].map((b) => b.getAttribute('data-tab')))]);
  for (const t of tabs) {
    await p.evaluate((t) => { const b = document.querySelector('#drawer [data-tab="' + t + '"]'); if (b) b.click(); }, t); await p.waitForTimeout(900);
    const subs = await p.evaluate(() => [...document.querySelectorAll('[id^="mdAbas-"] button, #pbSeg button')].filter((b) => b.offsetParent !== null).map((b) => b.textContent.trim().slice(0, 18)));
    const variantes = ['(padrão)', ...[...new Set(subs)].slice(0, 6)];
    for (const v of variantes) {
      if (v !== '(padrão)') { await p.evaluate((v) => { const b = [...document.querySelectorAll('[id^="mdAbas-"] button, #pbSeg button')].find((x) => x.textContent.trim().slice(0, 18) === v); if (b) b.click(); }, v); await p.waitForTimeout(500); }
      const m = await p.evaluate(MEDE); const titulo = await p.locator('#tituloTela').innerText().catch(() => t);
      const id = quem + '|' + w + '|' + t + '|' + v;
      rel.telas.push({ id, titulo, ...m, erros: p.erros.splice(0), rec: p.rec.splice(0) });
      if (v === '(padrão)' && w === 1280 && quem === 'dono') await p.screenshot({ path: OUT + '/tela-' + t + '.png', fullPage: false });
      if (v === '(padrão)' && w === 390 && quem === 'dono') await p.screenshot({ path: OUT + '/cel-' + t + '.png', fullPage: false });
    }
  }
  await p.context().close();
}
// fichas (proprietário) em computador e celular
const FICHAS = [
  ['Inicial (nova)', (T) => T.abrirNovo()], ['Termo de acordo (novo)', (T) => T.abrirNovoAcordo()], ['Alvará (novo)', (T) => T.abrirNovoAlvara()],
  ['Cliente (novo)', (T) => T.abrirClienteEdit({})], ['Cadastrar processo (aba Processos)', (T) => T.prAbrirNovo()],
  ['Despesa nova (PJ)', (T) => T.abrirNovaDespesa('pj')], ['Receita nova (PJ)', (T) => T.abrirNovaReceita('pj')],
];
for (const w of [1280, 390]) {
  const p = await abrir('dono', w);
  for (const [nome, f] of FICHAS) {
    await p.evaluate(f, await p.evaluate(() => 0)).catch(() => { });
    await p.evaluate((src) => { const T = window.__horusTeste; return (new Function('T', 'return (' + src + ')(T)'))(T); }, f.toString()).catch(() => { });
    await p.waitForTimeout(900);
    const campos = await p.evaluate(() => { const raiz = document.querySelector('.overlay.show .modal') || document; return [...raiz.querySelectorAll('label.field-label, .f-sec-t, summary b, h2')].filter((e) => e.offsetParent !== null).map((e) => e.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 60); });
    const m = await p.evaluate(MEDE);
    rel.fichas.push({ id: nome + ' | ' + w, campos, ...m, erros: p.erros.splice(0), rec: p.rec.splice(0) });
    await p.screenshot({ path: OUT + '/ficha-' + nomeArq(nome) + '-' + w + '.png' });
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach((o) => o.classList.remove('show')); });
    await p.waitForTimeout(250);
  }
  // honorários dentro da ficha de processo (modo "Honorários do processo")
  if (w === 1280) {
    await p.evaluate(() => { const T = window.__horusTeste; T.prAbrirNovo(); });
    await p.waitForTimeout(600); await p.evaluate(() => document.querySelectorAll('.overlay.show').forEach((o) => o.classList.remove('show')));
  }
  await p.context().close();
}
fs.writeFileSync(OUT + '/relatorio.json', JSON.stringify(rel, null, 1));
console.log('telas medidas: ' + rel.telas.length + ' · fichas: ' + rel.fichas.length);
process.exit(0);
