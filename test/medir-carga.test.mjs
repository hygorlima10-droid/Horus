// Mede o que o app pede ao servidor: quantas chamadas na abertura, ao trocar de aba e em repouso (segundo plano), o tamanho do que baixa e o tempo até a tela ficar pronta
// (com e sem a simulação de celular: CPU 4x mais lenta e 150 ms de espera em cada chamada, como a distância até o banco).  Grupo 'telas-isoladas':  node test/rodar.mjs medir-carga
// RELATORIO=/pasta/arquivo.json grava os números.  Não falha: serve para acompanhar (o teto de chamadas fica em LIMITE_ABERTURA).
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8816', TOK = 'tok-dono-0000000000000000000000000001', LIMITE_ABERTURA = Number(process.env.LIMITE_ABERTURA || 40);
const br = await chromium.launch(); const rel = {};
async function rodar(nome, { cpu = 1, latencia = 0, repouso = 0 }) {
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'America/Sao_Paulo' }); await ctx.addCookies([{ name: 'sessao', value: TOK, url: B }]);
  const p = await ctx.newPage(); await p.route(/fonts\./, (r) => r.abort());
  await p.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { } window.__lt = []; try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ type: 'longtask', buffered: true }); } catch (e) { } });
  const cdp = await ctx.newCDPSession(p);
  if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  if (latencia) { await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: latencia, downloadThroughput: 1.6e6 / 8 * 5, uploadThroughput: 0.75e6 / 8 * 5 }); }
  const reqs = []; const t0 = Date.now(); let fase = 'abertura';
  p.on('requestfinished', async (r) => { try { const resp = await r.response(); const u = new URL(r.url()); if (!/^\/(api|login|$|index)/.test(u.pathname) && u.pathname !== '/') return; const tam = (await resp.body().catch(() => Buffer.alloc(0))).length; reqs.push({ fase, m: r.method(), u: u.pathname + (u.search ? '?' + u.search.slice(1, 30) : ''), s: resp.status(), b: tam, t: Date.now() - t0, ini: Math.round(r.timing().startTime ? Date.now() - t0 - r.timing().responseEnd : 0) }); } catch (e) { } });
  await p.goto(B + '/'); await p.waitForFunction(() => window.__horusEu && window.__horusEu.pronto, null, { timeout: 120000 });
  const tEu = Date.now() - t0;
  await p.waitForLoadState('networkidle', { timeout: 120000 }).catch(() => { }); const tIdle = Date.now() - t0;
  const nav = await p.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; return { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), transfer: n.transferSize, decoded: n.decodedBodySize }; });
  const lt = await p.evaluate(() => window.__lt); rel[nome + '-longtasks'] = { n: lt.length, totalMs: lt.reduce((a, x) => a + x[1], 0), maiores: lt.sort((a, b) => b[1] - a[1]).slice(0, 6) };
  const tabs = await p.evaluate(() => [...document.querySelectorAll('#drawer [data-tab]')].map((b) => b.getAttribute('data-tab')));
  const porAba = {};
  for (const t of [...new Set(tabs)]) { fase = 'aba:' + t; const antes = reqs.length, ti = Date.now(); await p.evaluate((t) => document.querySelector('#drawer [data-tab="' + t + '"]').click(), t); await p.waitForTimeout(1500); await p.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => { }); porAba[t] = { chamadas: reqs.length - antes, bytes: reqs.slice(antes).reduce((a, x) => a + x.b, 0), ms: Date.now() - ti - 1500 }; }
  let repousoN = 0; if (repouso) { fase = 'repouso'; await p.evaluate(() => document.querySelector('#drawer [data-tab="inicio"]').click()); await p.waitForTimeout(500); const antes = reqs.length; await p.waitForTimeout(repouso * 1000); repousoN = reqs.length - antes; }
  const ab = reqs.filter((x) => x.fase === 'abertura');
  rel[nome] = { msAteEuPronto: tEu, msAteRede: tIdle, navegacao: nav, abertura: { chamadas: ab.length, bytes: ab.reduce((a, x) => a + x.b, 0), maiores: ab.sort((a, b) => b.b - a.b).slice(0, 8).map((x) => `${x.m} ${x.u} ${x.b}B ${x.s}`), lista: ab.map((x) => x.u) }, porAba, repouso: { segundos: repouso, chamadas: repousoN, lista: reqs.filter((x) => x.fase === 'repouso').map((x) => x.u) } };
  await ctx.close();
}
if (process.env.SO !== 'celular') await rodar('sem-simulacao', { repouso: 70 });
await rodar('celular-simulado', { cpu: 4, latencia: 150 });
await br.close();
if (process.env.RELATORIO) writeFileSync(process.env.RELATORIO, JSON.stringify(rel, null, 1));
for (const [k, v] of Object.entries(rel).filter(([k]) => !/longtasks/.test(k))) { console.log('  ' + k + ': tela pronta em ' + v.msAteEuPronto + ' ms, rede quieta em ' + v.msAteRede + ' ms; abertura = ' + v.abertura.chamadas + ' chamadas, ' + Math.round(v.abertura.bytes / 1024) + ' KB; página ' + Math.round(v.navegacao.decoded / 1024) + ' KB (' + Math.round(v.navegacao.transfer / 1024) + ' KB na rede)'); }
if (rel['sem-simulacao']) console.log('  repouso (70 s): ' + rel['sem-simulacao'].repouso.chamadas + ' chamadas em segundo plano');
console.log('  tarefas longas (celular simulado): ' + JSON.stringify(rel['celular-simulado-longtasks']));
const base = rel['sem-simulacao'] || rel['celular-simulado'];
console.log(base.abertura.chamadas <= LIMITE_ABERTURA ? '  ok   abertura dentro do limite de ' + LIMITE_ABERTURA + ' chamadas' : '  FALHA abertura com mais de ' + LIMITE_ABERTURA + ' chamadas');
process.exit(base.abertura.chamadas <= LIMITE_ABERTURA ? 0 : 1);
