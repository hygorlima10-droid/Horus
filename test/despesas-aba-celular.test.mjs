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
const parc = [['2', 60], ['8', 50], ['13', 110], ['15', 50], ['21', 50]].map(([d, v], i) => ({ id: 'ab' + i, valor: v, data: mes0 + '-' + d.padStart(2, '0') }));
await api('PUT', 'despesas/dc3', { nome: 'DC Combustível', coluna: 'pf', tipo: 'fixa', valorPadrao: 600, diaVencimento: null, categoria: 'transporte', ativa: true, pagamentos: { [mes0]: { pago: false, valor: 600, parciais: parc } }, criadoEm: '2026-01-01T00:00:00.000Z' });
for (let i = 0; i < 4; i++) await api('PUT', 'despesas/dcp' + i, { nome: 'DC Paga ' + i, coluna: 'pj', tipo: 'unica', valor: 100 + i, data: dia(-2), mesReferencia: mes0, categoria: 'outros', pago: true, dataPagamento: dia(-1), criadoEm: agora });
const mesAnt = new Date(Date.now() - 3 * 3600e3); mesAnt.setUTCDate(1); mesAnt.setUTCMonth(mesAnt.getUTCMonth() - 1); const mAnt = mesAnt.toISOString().slice(0, 7);
await api('PUT', 'despesas/dcf', { nome: 'Fatura Teste final 9999', coluna: 'pf', tipo: 'unica', categoria: 'cartao', valor: 1894.63, data: dia(0), mesReferencia: mes0, pago: false, observacoes: 'Fatura do cartão (fecha em 26/' + mes0.slice(5) + '/' + mes0.slice(0, 4) + ', vence em 09/12/2026). Compras por categoria em Extratos › Cartão de crédito', criadoEm: agora });   // sem faturaId (como a que perdeu o vínculo ao ser editada)
await api('PUT', 'extratos/dcm_dcfat', { tipo: 'documento', kind: 'fatura', status: 'concluido', titulo: 'x', dados: { vencimento: mes0 + '-28', fechamento: mes0 + '-26', total: 189463, soma: 15000 } });
await api('PUT', 'extratos/dd_' + mAnt + '_cartao_dcfat', { tipo: 'diaadia', mes: mAnt, conta: 'cartao:dcm_dcfat', coluna: 'pf', origem: 'cartao', fatura: 'dcm_dcfat', cats: { Outros: { v: 150, n: 2 } }, linhas: [{ id: 'dcc1', d: mAnt + '-10', t: 'DC LOJA DO CARTAO A', v: 100, c: 'Outros', h: 'dcc1' }, { id: 'dcc2', d: mAnt + '-12', t: 'DC LOJA DO CARTAO B', v: 50, c: 'Outros', h: 'dcc2' }], atualizadoEm: Date.now() });
const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 2 }); await ctx.addCookies([{ name: 'sessao', value: TOK, url: B }]);
const p = await ctx.newPage(); const erros = []; p.on('pageerror', (e) => erros.push(e.message)); await p.route(/fonts\./, (r) => r.abort());
await p.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { } });
await p.goto(B + '/'); await p.waitForFunction(() => window.__horusEu && window.__horusEu.pronto, null, { timeout: 60000 }); await p.waitForTimeout(2500);
await p.evaluate(() => document.querySelector('#drawer [data-fin="despesas"]').click()); await p.waitForTimeout(1200);
// abre os abatimentos do combustível
await p.evaluate(() => { const b = [...document.querySelectorAll('#finDespesas .btn-abat-lista')][0]; if (b) b.click(); }); await p.waitForTimeout(600);
if (process.env.FOTOS) { await p.screenshot({ path: process.env.FOTOS + '/despesas-celular.png' }); await p.evaluate(() => { const e = document.querySelector('#finDespesas .abat-lista'); if (e) e.scrollIntoView({ block: 'center' }); }); await p.waitForTimeout(300); await p.screenshot({ path: process.env.FOTOS + '/despesas-celular-abat.png' }); await p.evaluate(() => document.querySelector('#dspCad_pj').scrollIntoView({ block: 'start' })); await p.waitForTimeout(300); await p.screenshot({ path: process.env.FOTOS + '/despesas-celular-pj.png' }); await p.evaluate(() => window.scrollTo(0, 0)); }
const ov = await p.evaluate(() => {
  const inter = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1, out = [];
  const it = [...document.querySelectorAll('#finDespesas .financeiro-item')].find((x) => x.querySelector('.abat-lista'));
  if (it){ const li = it.querySelector('.abat-lista').getBoundingClientRect(), dir = it.querySelector('.financeiro-item-right'); if (dir){ const bs = [...dir.querySelectorAll('button, .v')].map((x) => x.getBoundingClientRect()); const ls = [...it.querySelectorAll('.abat-lin, .abat-lin button')].map((x) => x.getBoundingClientRect()); if (ls.some((l) => bs.some((b) => inter(l, b)))) out.push('abatimentos sobrepõem os botões do item'); if (li.right > it.getBoundingClientRect().right + 1) out.push('lista de abatimentos passa do cartão'); } }
  const blocos = [...document.querySelectorAll('#finDespesas .financeiro-bloco')].filter((b) => b.offsetParent !== null).map((b) => b.getBoundingClientRect());
  for (let i = 1; i < blocos.length; i++) if (blocos[i].top < blocos[i - 1].bottom - 1) out.push('cartões sobrepostos (' + i + ')');
  return out;
});
check(ov.length === 0, 'abatimentos do combustível e cartões da aba não se sobrepõem' + (ov.length ? ': ' + ov.join(' | ') : ''));
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
// compras do cartão no mês da FATURA (não na data da compra), mesmo as já lançadas
await p.evaluate(() => document.querySelector('[data-dsp-f="origem"][data-v="cartao"]').click()); await p.waitForTimeout(500);
const cart = await p.evaluate(() => (document.querySelector('#dspLin') || { innerText: '' }).innerText.replace(/\s+/g, ' '));
check(/DC LOJA DO CARTAO A/i.test(cart) && /DC LOJA DO CARTAO B/i.test(cart), 'as compras do cartão aparecem no mês da fatura (mesmo com data do mês anterior)');
const kv = await p.evaluate(() => document.querySelector('#finDespesas .dsp-kv').innerText.replace(/\s+/g, ' '));
check(/R\$ 150,00 CART/i.test(kv) && /R\$ 1\.894,63 FATURAS A PAGAR/i.test(kv), 'o total do cartão (R$ 150,00) e as faturas a pagar (R$ 1.894,63) aparecem; a fatura sem vínculo é reconhecida pelo texto');
check(erros.length === 0, 'sem erros de script' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
