// Alvos de toque: nenhuma tela, sub-aba ou ficha tem algo tocável com menos de 36 px (altura ou largura), no celular de 390 e de 360 px e no computador.
// Caixas de marcar valem pela linha inteira (label). Use: node test/rodar.mjs toque
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8812', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const br = await chromium.launch();
const MEDE = () => {
  const vis = e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0'; };
  const raiz = document.querySelector('.overlay.show') || document.body;
  return Array.from(raiz.querySelectorAll('button, a[href], select, input:not([type=hidden]), textarea, [role=button], [role=tab], summary')).filter(e => vis(e) && !(raiz === document.body && e.closest('#drawer:not(.open)'))).filter(e => {
    const r = ((e.type === 'checkbox' || e.type === 'radio') && e.closest('label') ? e.closest('label') : e).getBoundingClientRect(); return r.height < 36 || r.width < 36;
  }).map(e => { const r = e.getBoundingClientRect(); return (e.tagName.toLowerCase() + '.' + String(e.className).split(/\s+/).filter(Boolean).slice(0, 2).join('.')) + ' "' + (e.innerText || e.value || e.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 22) + '" ' + Math.round(r.width) + 'x' + Math.round(r.height); });
};
const FICHAS = [['abrirNovo', []], ['abrirNovoAcordo', []], ['abrirNovoAlvara', []], ['abrirNovaDespesa', []], ['abrirNovaReceita', []], ['abrirNovaMeta', []], ['abrirTransferencia', []], ['abrirModalSaldo', []], ['abrirClienteEdit', [{ nome: '', pagador: 'cliente' }]], ['agAbrir', [null]], ['prAbrirNovo', [null]], ['pzAbrir', [{}]]];
for (const [w, h] of [[390, 844], [360, 740], [1280, 900]]) {
  const page = await (await br.newContext({ viewport: { width: w, height: h }, timezoneId: 'America/Sao_Paulo' })).newPage(); await page.route(/fonts\./, x => x.abort());
  await page.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { } });
  await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(3500);
  const ruins = [];
  const tabs = await page.evaluate(() => Array.from(document.querySelectorAll('#drawer [data-tab], #drawer [data-fin]')).map(e => e.getAttribute('data-tab') ? ['tab', e.getAttribute('data-tab')] : ['fin', e.getAttribute('data-fin')]));
  for (const [k, v] of tabs) {
    await page.evaluate(([k, v]) => document.querySelector('#drawer [data-' + k + '="' + v + '"]').click(), [k, v]); await page.waitForTimeout(700);
    (await page.evaluate(MEDE)).forEach(x => ruins.push(v + ': ' + x));
    const subs = await page.evaluate(() => Array.from(document.querySelectorAll('.md-abas')).filter(b => b.offsetParent).flatMap(b => Array.from(b.querySelectorAll('button')).map(x => x.innerText.replace(/\s+/g, ' ').trim().slice(0, 20))));
    for (const s of subs) { await page.evaluate((s) => { const b = Array.from(document.querySelectorAll('.md-abas button')).filter(x => x.offsetParent).find(x => x.innerText.replace(/\s+/g, ' ').trim().slice(0, 20) === s); if (b) b.click(); }, s); await page.waitForTimeout(400); (await page.evaluate(MEDE)).forEach(x => ruins.push(v + ' › ' + s + ': ' + x)); }
  }
  for (const [fn, args] of FICHAS) { await page.evaluate(([fn, args]) => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); window.__horusTeste.fichas[fn].apply(null, args); }, [fn, args]); await page.waitForTimeout(400); (await page.evaluate(MEDE)).forEach(x => ruins.push('ficha ' + fn + ': ' + x)); }
  const únicos = [...new Set(ruins)];
  check(tabs.length >= 10 && únicos.length === 0, w + ' px: nada tocável abaixo de 36 px em ' + tabs.length + ' telas e ' + FICHAS.length + ' fichas' + (únicos.length ? ' → ' + únicos.slice(0, 8).join(' | ') : ''));
}
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
