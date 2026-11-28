// Advogado e familiar com Finanças têm, em Configurações, a linha "Extratos: regras que você ensinou" (as regras que o app aprendeu nos extratos DELES; ninguém vê as dos outros).
// Grupo 'familiar' (porta 8820):  node test/rodar.mjs familiar-regras-extrato
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8820', TOK = { fin: 'tok-fam-fin-0000000000000000000000000007', obra: 'tok-fam-obra-000000000000000000000000006' };
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const br = await chromium.launch(); const erros = [];
async function abrir(q) { const ctx = await br.newContext({ viewport: { width: 390, height: 844 } }); await ctx.addCookies([{ name: 'sessao', value: TOK[q], url: B }]); const p = await ctx.newPage(); p.on('pageerror', (e) => erros.push(e.message)); await p.route(/fonts\./, (r) => r.abort()); await p.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { } }); await p.goto(B + '/'); await p.waitForFunction(() => window.__horusEu && window.__horusEu.pronto, null, { timeout: 60000 }); await p.waitForTimeout(3000); return { ctx, p }; }
let { ctx, p } = await abrir('fin');
await p.evaluate(() => document.querySelector('#drawer [data-tab="configuracoes"]').click()); await p.waitForTimeout(800);
check(await p.locator('#cfWrap [data-cf="extregras"]').count() === 1, 'familiar com Finanças vê "Extratos: regras que você ensinou" em Configurações');
await p.click('#cfWrap [data-cf="extregras"]'); await p.waitForTimeout(1200);
check(await p.locator('#overlayExt.show').count() === 1, 'a linha abre a tela das regras (as dele)');
await ctx.close();
({ ctx, p } = await abrir('obra'));
await p.evaluate(() => document.querySelector('#drawer [data-tab="configuracoes"]').click()); await p.waitForTimeout(800);
check(await p.locator('#cfWrap [data-cf="extregras"]').count() === 0, 'familiar só com a Construção não vê essa linha');
await ctx.close(); await br.close();
check(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
