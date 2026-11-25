// Aba Despesas no celular (390 px), proprietário: nada passa do cartão, rótulos Origem/Conta visíveis, filtros alinhados.
// Servidor do grupo 'permissoes':  node test/rodar.mjs despesas-aba-celular   (FOTOS=/pasta guarda uma foto)
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8816', TOK = 'tok-dono-0000000000000000000000000001';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const api = async (m, p, b) => fetch(B + '/api/db/' + p, { method: m, headers: { cookie: 'sessao=' + TOK, 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined });
const dia = (n) => new Date(Date.now() - 3 * 3600e3 + n * 864e5).toISOString().slice(0, 10), mes0 = dia(0).slice(0, 7), agora = new Date().toISOString();
await api('PUT', 'despesas/dc1', { nome: 'DC Aluguel do escritório', coluna: 'pj', tipo: 'fixa', valorPadrao: 1500, diaVencimento: 27, categoria: 'estrutura', ativa: true, pagamentos: {}, criadoEm: '2026-01-01T00:00:00.000Z' });
await api('PUT', 'despesas/dc2', { nome: 'DC Cartão', coluna: 'pf', tipo: 'unica', valor: 398.36, data: dia(3), mesReferencia: mes0, categoria: 'pessoal', pago: false, criadoEm: agora });
await api('PUT', 'extratos/dd_' + mes0 + '_dc', { tipo: 'diaadia', mes: mes0, conta: 'dc', coluna: 'pf', cats: { Mercado: { v: 200, n: 1 } }, linhas: [{ id: 'dcl1', d: mes0 + '-02', t: 'DC Supermercado com um nome bem comprido para testar', v: 200, c: 'Mercado', h: 'dch1' }], atualizadoEm: Date.now() });
const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 2 }); await ctx.addCookies([{ name: 'sessao', value: TOK, url: B }]);
const p = await ctx.newPage(); const erros = []; p.on('pageerror', (e) => erros.push(e.message)); await p.route(/fonts\./, (r) => r.abort());
await p.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { } });
await p.goto(B + '/'); await p.waitForFunction(() => window.__horusEu && window.__horusEu.pronto, null, { timeout: 60000 }); await p.waitForTimeout(2500);
await p.evaluate(() => document.querySelector('#drawer [data-fin="despesas"]').click()); await p.waitForTimeout(1200);
if (process.env.FOTOS) await p.screenshot({ path: process.env.FOTOS + '/despesas-celular.png' });
const r = await p.evaluate(() => {
  const sec = document.getElementById('finDespesas'), fora = [];
  sec.querySelectorAll('.financeiro-bloco').forEach((bl) => {
    const R = bl.getBoundingClientRect();
    bl.querySelectorAll('button, h4, input, .seg-btn, .dsp-kv > div, .ct-ja, .financeiro-item').forEach((e) => { const x = e.getBoundingClientRect(); if (x.width < 2) return; if (x.right > R.right + 1 || x.left < R.left - 1) fora.push((e.innerText || e.placeholder || e.tagName).trim().slice(0, 30) + ' (' + Math.round(x.right - R.right) + 'px)'); });
  });
  const rot = [...sec.querySelectorAll('.dsp-rot')].filter((e) => e.offsetParent !== null).map((e) => e.innerText.trim().toLowerCase());
  const grupos = [...sec.querySelectorAll('.dsp-grupo')].map((g) => Math.round(g.getBoundingClientRect().left));
  return { fora, rot, grupos, rolagem: document.documentElement.scrollWidth > window.innerWidth + 1 };
});
check(r.fora.length === 0, 'nada passa do cartão' + (r.fora.length ? ': ' + r.fora.join(' | ') : ''));
check(!r.rolagem, 'a tela não ganha rolagem lateral');
check(r.rot.includes('origem') && r.rot.includes('conta'), 'os rótulos "Origem" e "Conta" aparecem (' + r.rot.join(', ') + ')');
check(r.grupos.length === 2 && r.grupos[0] === r.grupos[1], 'os dois grupos de filtro começam alinhados à esquerda (' + r.grupos.join(', ') + ')');
check(await p.evaluate(() => { const b = document.querySelector('#finDespesas [data-dsp="nova"]'); const R = b.closest('.financeiro-bloco').getBoundingClientRect(), x = b.getBoundingClientRect(); return x.right <= R.right + 1 && x.width > 40; }), '"+ Nova despesa" cabe dentro do cartão');
check(erros.length === 0, 'sem erros de script' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
