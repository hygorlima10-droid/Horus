// Gráfico de linha dos módulos (ex.: "Os preços estão subindo?" na Construção): não passa da largura de um cartão e os números não se sobrepõem,
// com os dados reais da foto (12 meses, 1.855 … 2.026), no celular e no computador. Use: node test/rodar.mjs grafico-linha
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8812', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const br = await chromium.launch(); const erros = [];
for (const [w, h, nome] of [[390, 844, 'celular 390'], [360, 740, 'celular 360'], [1440, 900, 'computador 1440']]) {
  const page = await (await br.newContext({ viewport: { width: w, height: h }, timezoneId: 'America/Sao_Paulo' })).newPage(); await page.route(/fonts\./, x => x.abort());
  page.on('pageerror', e => erros.push(String(e)));
  await page.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { } });
  await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(3000);
  const r = await page.evaluate(() => {
    const { mdLinha, mdCard, MD_COR } = window.__horusTeste;
    const meses = ['2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
    const dados = [1855, 1855, 1891, 1891, 1902, 1915, 1928, 1958, 2009, 2009, 2024, 2026];
    const cont = document.createElement('div'); cont.id = 'tGraf'; cont.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#fff;overflow:auto;padding:12px';
    cont.innerHTML = mdCard('Os preços estão subindo?', mdLinha(meses, dados, MD_COR.ouro, { id: 'calc', titulo: 'Custo do m²', fmt: v => Math.round(v).toLocaleString('pt-BR') })); document.body.appendChild(cont);
    const svg = cont.querySelector('svg'), sw = svg.getBoundingClientRect(), sh = sw.height;
    const tx = Array.from(svg.querySelectorAll('text')).filter(t => /\d/.test(t.textContent)).map(t => t.getBoundingClientRect());
    let sobre = 0; for (let i = 0; i < tx.length; i++) for (let j = i + 1; j < tx.length; j++) { const a = tx[i], b = tx[j]; if (a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5) sobre++; }
    const rot = Array.from(svg.querySelectorAll('text')).length, ult = Array.from(svg.querySelectorAll('text')).some(t => t.textContent === '2.026');
    return { w: sw.width, h: sh, sobre, valores: tx.length, ult, rot };
  });
  check(r.w <= 445, nome + ': o gráfico não passa de um cartão (' + Math.round(r.w) + ' px de largura, ' + Math.round(r.h) + ' de altura)');
  check(r.sobre === 0, nome + ': nenhum número se sobrepõe (' + r.valores + ' rótulos de valor)');
  check(r.ult, nome + ': o último valor (2.026) continua visível');
  if (process.env.FOTOS) await page.screenshot({ path: process.env.FOTOS + '/grafico-' + w + '.png' });
  await page.close();
}
check(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
