// Finanças: nenhum botão só de texto; tudo em cartão de 36 px (ouro cria, verde paga, vermelho exclui, cinza o resto); formulário de valor em duas linhas.
// Servidor do grupo 'permissoes':  node test/rodar.mjs financas-botoes
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8816', TOK = 'tok-dono-0000000000000000000000000001';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const api = async (m, p, b) => { const x = await fetch(B + '/api/db/' + p, { method: m, headers: { cookie: 'sessao=' + TOK, 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined }); let j = null; try { j = await x.json(); } catch (e) { } return j; };
const dia = (n) => new Date(Date.now() - 3 * 3600e3 + n * 864e5).toISOString().slice(0, 10), mes0 = dia(0).slice(0, 7), agora = new Date().toISOString();
const IDS = { despesas: ['fb1', 'fb2', 'fb3', 'fb4'], receitasManuais: ['fbr1'] };
const limpar = async () => { for (const [c, l] of Object.entries(IDS)) for (const i of l) await api('DELETE', c + '/' + i); };
await limpar();
await api('PUT', 'despesas/fb1', { nome: 'FB Aluguel', coluna: 'pj', tipo: 'fixa', valorPadrao: 1500, diaVencimento: 27, categoria: 'estrutura', ativa: true, pagamentos: {}, criadoEm: '2026-01-01T00:00:00.000Z' });
await api('PUT', 'despesas/fb2', { nome: 'FB Imposto', coluna: 'pj', tipo: 'unica', valor: 63.9, data: dia(5), mesReferencia: mes0, categoria: 'impostos', pago: false, criadoEm: agora });
await api('PUT', 'despesas/fb3', { nome: 'FB Cartão', coluna: 'pf', tipo: 'unica', valor: 398.36, data: dia(3), mesReferencia: mes0, categoria: 'pessoal', pago: false, criadoEm: agora });
await api('PUT', 'despesas/fb4', { nome: 'FB Luz (valor varia)', coluna: 'pj', tipo: 'fixa', valorPadrao: null, diaVencimento: 20, categoria: 'estrutura', ativa: true, pagamentos: {}, criadoEm: '2026-01-01T00:00:00.000Z' });
await api('PUT', 'receitasManuais/fbr1', { descricao: 'FB Receita', valor: 1200, data: dia(-2), mesReferencia: mes0, coluna: 'pj', criadoEm: agora });
const br = await chromium.launch();
const PERMITIDOS = '.info-btn, .fv-tile, .md-fase, .md-at, .md-kpi, .md-card, .rm-parcela, .acao-btn, .md-abas button, .segmented button, .seg-btn, [role=tab], .md-seg button, .md-rng button';
const varrer = (p) => p.evaluate((perm) => {
  const out = [];
  document.querySelectorAll('#bodyFinanceiro button, #bodyFinanceiro a[role=button]').forEach((b) => {
    const r = b.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return; const cs = getComputedStyle(b); if (cs.visibility === 'hidden' || cs.display === 'none') return;
    if (b.matches(perm) || b.closest('.md-abas, .segmented, [role=tablist], .md-seg, .md-rng, .fv-tiles')) return;
    if (/^\d+ meses$/.test((b.innerText || '').trim())) return;   // alternador 6/12 meses (não muda)
    const bw = ['Top', 'Right', 'Bottom', 'Left'].reduce((t, s) => t + parseFloat(cs['border' + s + 'Width'] || 0), 0), semFundo = /rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor);
    if (bw === 0 || semFundo || r.height < 35.5) out.push((b.innerText || b.title || '?').trim().slice(0, 30) + ' [' + b.className.slice(0, 30) + '] h=' + Math.round(r.height) + (bw === 0 ? ' sem borda' : '') + (semFundo ? ' sem fundo' : ''));
  });
  return out;
}, PERMITIDOS);
for (const [larg, nome] of [[390, 'celular'], [1280, 'computador']]) {
  console.log('\n— ' + nome);
  const ctx = await br.newContext({ viewport: { width: larg, height: 1000 } }); await ctx.addCookies([{ name: 'sessao', value: TOK, url: B }]);
  const p = await ctx.newPage(); p.erros = []; p.on('pageerror', (e) => p.erros.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/fonts\.|Failed to load resource/.test(m.text())) p.erros.push('console: ' + m.text()); });
  await p.route(/fonts\./, (x) => x.abort()); await p.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { } });
  await p.goto(B + '/'); await p.waitForFunction(() => window.__horusEu && window.__horusEu.pronto, null, { timeout: 60000 }); await p.waitForTimeout(2500);
  for (const [fin, rot] of [['resumo', 'Visão geral'], ['geral', 'Divisão do mês'], ['pj', 'PJ'], ['pf', 'PF'], ['patrimonio', 'Patrimônio e metas'], ['orcamento', 'Orçamento']]) {
    await p.evaluate((f) => { const b = document.querySelector('#drawer [data-fin="' + f + '"]') || document.querySelector('[data-fin="' + f + '"]'); if (b) b.click(); }, fin); await p.waitForTimeout(1300);
    if (process.env.FOTOS && (fin === 'resumo' || fin === 'geral')) await p.screenshot({ path: process.env.FOTOS + '/fin-botoes-' + nome + '-' + fin + '.png' });
    const ruins = await varrer(p);
    check(ruins.length === 0, rot + ': nenhum botão só de texto' + (ruins.length ? ' — ' + ruins.join(' | ') : ''));
    if (fin === 'pj') {
      const info = await p.evaluate(() => {
        const q = (s) => document.querySelector('#bodyFinanceiro ' + s), cor = (e) => e ? getComputedStyle(e).backgroundColor : '';
        const vis = (e) => e && e.getBoundingClientRect().width > 2, rec = q('[data-nova-receita]'), desp = q('[data-nova-despesa]'), pagar = q('[data-despesa-pagar]'), mais = [...document.querySelectorAll('#bodyFinanceiro .btn-mais')].find(vis), hist = [...document.querySelectorAll('#bodyFinanceiro button')].find((b) => /Hist[óo]rico/.test(b.innerText));
        const r = (e) => e ? e.getBoundingClientRect() : { width: 0, height: 0 };
        return { recPlus: rec ? getComputedStyle(rec, '::before').content : '', recFundo: cor(rec), despPlus: desp ? getComputedStyle(desp, '::before').content : '', pagarFundo: cor(pagar), maisW: Math.round(r(mais).width), maisH: Math.round(r(mais).height), maisFundo: cor(mais), histFundo: cor(hist) };
      });
      check(/"\+"/.test(info.recPlus) && /"\+"/.test(info.despPlus) && info.recFundo !== 'rgba(0, 0, 0, 0)', '"+ Lançar receita" e "+ Nova despesa": dourado com o sinal +');
      check(info.pagarFundo !== 'rgba(0, 0, 0, 0)' && info.pagarFundo !== info.recFundo && info.recFundo !== info.histFundo, '"Marcar paga" é cartão verde (cor diferente do dourado)');
      check(info.maisW === 36 && info.maisH === 36 && info.maisFundo !== 'rgba(0, 0, 0, 0)', 'o "⋯" é um quadrado cinza de 36 × 36');
      check(info.histFundo !== 'rgba(0, 0, 0, 0)', '"Histórico" é cartão cinza');
      // formulário de valor pago (despesa de valor variável)
      const abriu = await p.evaluate(() => {
        const alvo = [...document.querySelectorAll('#bodyFinanceiro *')].filter((e) => e.children.length === 0 && /FB Luz/.test(e.textContent))[0]; if (!alvo) return false;
        let c = alvo; while (c && c.querySelectorAll('[data-despesa-pagar]').length !== 1) c = c.parentElement;
        const b = c && c.querySelector('[data-despesa-pagar]'); if (b) { b.click(); return true; } return false;
      });
      await p.waitForTimeout(600);
      const form = await p.evaluate(() => { const f = document.querySelector('#bodyFinanceiro .financeiro-valor-form'); if (!f) return null; const i = f.querySelector('input').getBoundingClientRect(), bs = [...f.querySelectorAll('button')].map((b) => b.getBoundingClientRect()), fr = f.getBoundingClientRect(); return { campoLargo: i.width >= fr.width * 0.9, abaixo: bs.every((b) => b.top >= i.bottom - 1), lado: bs.length === 2 && Math.abs(bs[0].top - bs[1].top) < 3, alt: bs.map((b) => Math.round(b.height)), fundos: [...f.querySelectorAll('button')].map((b) => getComputedStyle(b).backgroundColor) }; });
      if (process.env.FOTOS) { await p.evaluate(() => { const f = document.querySelector('#bodyFinanceiro .financeiro-valor-form'); if (f) f.scrollIntoView({ block: 'center' }); }); await p.waitForTimeout(300); await p.screenshot({ path: process.env.FOTOS + '/fin-botoes-' + nome + '-pj-form.png' }); }
      check(abriu && !!form, 'ao tocar "Marcar paga" numa despesa de valor variável abre o formulário de valor pago');
      if (form) {
        check(form.campoLargo && form.abaixo && form.lado, 'formulário: o campo ocupa a linha de cima e Confirmar e Cancelar ficam lado a lado embaixo');
        check(form.alt.every((h) => h === 36) && form.fundos.every((c) => c !== 'rgba(0, 0, 0, 0)'), 'Confirmar e Cancelar são cartões de 36 px');
        const ruins2 = await varrer(p); check(ruins2.length === 0, 'com o formulário aberto também não sobra botão só de texto' + (ruins2.length ? ' — ' + ruins2.join(' | ') : ''));
      }
    }
  }
  check(p.erros.length === 0, nome + ': sem erros de JavaScript ' + p.erros.join(' | '));
  await ctx.close();
}
await limpar(); await br.close();
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo.'); process.exit(falhas ? 1 : 0);
