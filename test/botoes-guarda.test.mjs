// GUARDA do padrão de botões: nenhuma aba nem sub-aba pode ter botão de ação "solto" (só texto, sem fundo nem borda), e nenhum botão pode passar da borda do cartão
// onde está. Vale no celular (390 px) e no desktop (1280 px). Se falhar, o botão novo precisa ser cartão: use `btn btn-ghost` (ou btn-text/md-link, que já nascem cartão).
// Servidor do grupo 'permissoes':  node test/rodar.mjs botoes-guarda
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8816', TOK = 'tok-dono-0000000000000000000000000001';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const api = (m, p, b) => fetch(B + '/api/db/' + p, { method: m, headers: { cookie: 'sessao=' + TOK, 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined }).then(r => r.status);
const dia = (n) => new Date(Date.now() - 3 * 3600e3 + n * 864e5).toISOString().slice(0, 10), agora = new Date().toISOString();
// dados de exemplo para as telas terem botões: obra completa e processos sem cliente (revisão)
await api('PUT', 'config/backup', { ultimoEm: agora });
await api('PUT', 'config/obra', { nome: 'Casa', orcamentoTotal: 400000, criadoEm: agora,
  financiamento: { status: 'aprovado', valor: 300000, banco: 'Caixa', taxaAnual: 12, sistema: 'sac', prazoMeses: 360, inicioObra: dia(-60).slice(0, 8) + '01', prazoObraMeses: 10, contrapartida: 100000 },
  etapas: [{ id: 'e1', nome: 'Fundação', orcado: 100000, status: 'concluida', ordem: 1 }, { id: 'e2', nome: 'Alvenaria', orcado: 150000, status: 'andamento', ordem: 2 }],
  medicoes: [{ id: 'm1', data: dia(-30), valor: 60000, desc: 'Fundação', etapaIds: ['e1'], status: 'liberada', liberacaoId: 'l1' }, { id: 'm2', data: dia(6), valor: 90000, desc: 'Alvenaria', etapaIds: ['e2'], status: 'prevista', liberacaoId: null }],
  checklist: [{ id: 'k1', fase: 'antes', titulo: 'Alvará de construção', prazo: dia(-2), feito: false }] });
await api('PUT', 'obraMov/gl1', { tipo: 'liberacao', data: dia(-30), valor: 60000, obs: '1ª medição', medicaoId: 'm1', criadoEm: agora });
await api('PUT', 'obraMov/ga1', { tipo: 'aporte', origem: 'pf', data: dia(-45), valor: 50000, criadoEm: agora });
await api('PUT', 'obraMov/gg1', { tipo: 'gasto', etapaId: 'e1', descricao: 'Concreto', fornecedor: 'Usina', valor: 30000, nf: '123', status: 'pago', data: dia(-20), dataPagamento: dia(-20), criadoEm: agora });
await api('PUT', 'obraMov/gg2', { tipo: 'gasto', etapaId: 'e2', descricao: 'Tijolos', fornecedor: 'Olaria', valor: 12000, status: 'apagar', data: dia(-1), vencimento: dia(2), criadoEm: agora });
await api('PUT', 'processos/bg1', { numero: '0000999-99.2026.8.09.0107', partes: 'BANCO ALFA SA x FULANO', clienteIds: [], advogados: [{ oab: '49308/GO', nome: 'Murilo' }], origem: 'diario', honorarios: 'sem', revisar: 'sem-cliente', arquivado: false, criadoEm: agora });

const TABS = ['inicio', 'peticoes', 'acordos', 'alvaras', 'clientes', 'arquivados', 'obra', 'publicacoes', 'agenda', 'processos', 'delegadas', 'analises', 'extratos', 'financeiro', 'configuracoes'];
const br = await chromium.launch();
const coletar = (page) => page.evaluate(() => {
  const alfa = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c || ''); if (!m) return 0; const p = m[1].split(',').map(Number); return p.length > 3 ? p[3] : 1; };
  const vis = (e) => { const r = e.getBoundingClientRect(); if (r.width < 4 || r.height < 4) return false; for (let p = e; p && p !== document.body; p = p.parentElement) { const s = getComputedStyle(p); if (s.display === 'none' || s.visibility === 'hidden') return false; } return true; };
  /* EXCEÇÕES (não são botões de ação): sub-abas, controle segmentado, ícone de informação, linha de menu de configurações, números do calendário */
  const EXC = '.md-abas button, .md-per button, .segmented button, .seg-btn, .info-btn, .pb-mi, .dg-sel, .dg-mini.cpy, .cal-dia, [role=tab], [data-ag="dia"], [data-cal]';   // md-per = seletor de período do resumo; dg-sel e dg-mini.cpy = células compactas da planilha das Delegadas (desktop)
  const corpo = Array.from(document.querySelectorAll('[id^="body"]')).filter((e) => e.id !== 'body' && getComputedStyle(e).display !== 'none');
  const soltos = [], estouros = [], vistos = new Set();
  for (const r0 of corpo) for (const e of r0.querySelectorAll('button, a[href], [role=button]')) {
    if (vistos.has(e) || !vis(e) || e.closest('#drawer, .bottom-nav, nav') || e.matches(EXC) || e.closest('.md-abas')) continue; vistos.add(e);
    const r = e.getBoundingClientRect(), cs = getComputedStyle(e), bw = Math.max(parseFloat(cs.borderTopWidth) || 0, parseFloat(cs.borderLeftWidth) || 0);
    const borda = bw >= 1 && alfa(cs.borderTopColor) > 0.05 && cs.borderTopStyle !== 'none', fundo = alfa(cs.backgroundColor) > 0.05, txt = (e.innerText || e.getAttribute('aria-label') || e.title || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    if (/^\d{1,2}$/.test(txt)) continue;   // dias do calendário
    if (!(fundo || borda) || r.height < 28) soltos.push(txt + ' [' + (e.className || e.tagName).toString().slice(0, 40) + ']');
    const c = e.closest('.ini-card, .financeiro-bloco, .md-card, .ob-gasto, .ob-etapa, .pb-card, .kanban-card');
    if (c && c !== e) { const cr = c.getBoundingClientRect(); if (r.right > cr.right + 1 || r.left < cr.left - 1) estouros.push(txt); }
  }
  return { soltos, estouros, lateral: document.documentElement.scrollWidth > innerWidth + 1 };
});
for (const [w, nome] of [[390, 'celular'], [1280, 'desktop']]) {
  console.log('\n— ' + nome + ' (' + w + ' px)');
  const ctx = await br.newContext({ viewport: { width: w, height: 900 } }); await ctx.addCookies([{ name: 'sessao', value: TOK, url: B }]);
  const page = await ctx.newPage(); await page.route(/fonts\./, (r) => r.abort());
  await page.goto(B + '/'); await page.waitForTimeout(2800);
  let total = 0; const ruins = [];
  for (const t of TABS) {
    await page.evaluate((k) => { const b = document.querySelector('[data-tab="' + k + '"]'); if (b) b.click(); }, t); await page.waitForTimeout(1100);
    const subs = await page.evaluate(() => Array.from(document.querySelectorAll('[id^="body"] .md-abas button')).filter((b) => b.offsetWidth > 0).map((b, i) => i));
    for (const i of [-1].concat(subs.slice(0, 8))) {
      if (i >= 0) { await page.evaluate((n) => { const b = Array.from(document.querySelectorAll('[id^="body"] .md-abas button')).filter((x) => x.offsetWidth > 0)[n]; if (b) b.click(); }, i); await page.waitForTimeout(700); }
      await page.evaluate(() => document.querySelectorAll('[id^="body"] details').forEach((d) => { try { d.open = true; } catch (e) { /* ok */ } }));
      const r = await coletar(page); total++;
      if (r.soltos.length) ruins.push(t + (i >= 0 ? ' › sub ' + i : '') + ': soltos → ' + r.soltos.slice(0, 5).join(' | '));
      if (r.estouros.length) ruins.push(t + (i >= 0 ? ' › sub ' + i : '') + ': passa do cartão → ' + r.estouros.slice(0, 5).join(' | '));
      if (r.lateral) ruins.push(t + (i >= 0 ? ' › sub ' + i : '') + ': tela com rolagem lateral');
    }
  }
  check(ruins.length === 0, total + ' telas conferidas, nenhum botão solto nem fora do cartão' + (ruins.length ? ':\n      ' + ruins.join('\n      ') : ''));
  await ctx.close();
}
// limpa o que criou
for (const [c, ids] of [['obraMov', ['gl1', 'ga1', 'gg1', 'gg2']], ['processos', ['bg1']]]) for (const id of ids) await api('DELETE', c + '/' + id);
await api('DELETE', 'config/obra');
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
