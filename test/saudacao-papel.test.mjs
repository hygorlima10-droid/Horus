// Boas-vindas no Início de cada pessoa: primeiro nome do usuário (advogada, estagiário) e o horário certo.  Use: node test/rodar.mjs saudacao-papel
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8816';
const TOK = { dono: 'tok-dono-0000000000000000000000000001', ana: 'tok-adv-ana-00000000000000000000000002', caio: 'tok-est-caio-0000000000000000000000004' };
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const hBr = new Date(Date.now() - 3 * 3600e3).getUTCHours(), esperado = hBr >= 5 && hBr < 12 ? 'Bom dia' : (hBr >= 12 && hBr < 18 ? 'Boa tarde' : 'Boa noite');
const br = await chromium.launch();
for (const [q, vp] of [['ana', [1280, 800]], ['caio', [390, 844]], ['dono', [1280, 800]]]) {
  const ctx = await br.newContext({ viewport: { width: vp[0], height: vp[1] } }); await ctx.addCookies([{ name: 'sessao', value: TOK[q], url: B }]);
  const page = await ctx.newPage(); await page.route(/fonts\./, x => x.abort());
  await page.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { } });
  await page.goto(B + '/'); await page.waitForFunction(() => window.__horusEu && window.__horusEu.pronto && document.getElementById('iniSauda') && document.getElementById('iniSauda').innerText.trim(), null, { timeout: 60000 }); await page.waitForTimeout(1500);
  const nomeEu = await page.evaluate(() => (window.__horusEu.nome || '').split(/\s+/)[0]), txt = (await page.locator('#iniSauda h2').innerText()).trim();
  check(txt === esperado + ', ' + (nomeEu || 'Hygor') && (q === 'dono' || nomeEu.length > 0), q + ': "' + txt + '" (primeiro nome de quem está logado)');
  check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), q + ': a boas-vindas não faz a tela rolar para o lado');
  await page.close(); await ctx.close();
}
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
