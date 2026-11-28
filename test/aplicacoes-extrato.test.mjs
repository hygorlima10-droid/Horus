// Conferir com o extrato, etapa 2: tipos de aplicação (automática, manual, resgate, rendimento) por pessoa, destino por conta (reserva × outra aplicação),
// resgate sugerido como retirada da reserva e conferência do total líquido da reserva com o extrato.  Grupo 'telas-isoladas':  node test/rodar.mjs aplicacoes-extrato
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8816', TOK = 'tok-dono-0000000000000000000000000001';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const api = (m, p, b) => fetch(B + '/api/db/' + p, { method: m, headers: { cookie: 'sessao=' + TOK, 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined });
const dia = (n) => new Date(Date.now() - 3 * 3600e3 + n * 864e5).toISOString().slice(0, 10), agora = new Date().toISOString();
const br = await chromium.launch(), ctx = await br.newContext({ viewport: { width: 1280, height: 900 } }); await ctx.addCookies([{ name: 'sessao', value: TOK, url: B }]);
const p = await ctx.newPage(); const erros = []; p.on('pageerror', (e) => erros.push(e.message)); await p.route(/fonts\./, (r) => r.abort()); await p.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) {} });
const pronto = async () => { await p.waitForFunction(() => window.__horusEu && window.__horusEu.pronto, null, { timeout: 60000 }); await p.waitForTimeout(3000); };
// ---- dados: duas contas (C6 = reserva; Sicoob = outra aplicação), meta de reserva e dois extratos pendentes
await api('PUT', 'config/extratos', { contas: { 'c6|pj|1': { coluna: 'pj', rotulo: 'C6 PJ · cc 1', banco: 'C6', confirmada: true }, 'sicoob|pj|2': { coluna: 'pj', rotulo: 'Sicoob PJ · cc 2', banco: 'Sicoob', confirmada: true, aplicacao: 'outra' } }, iniciado: true, dataCorte: dia(-60) });
await api('PUT', 'metas/ap-res', { tipo: 'reserva', nome: 'AP Reserva', coluna: 'pj', movimentos: [{ id: 'a0', tipo: 'inicial', valor: 2000, dia: dia(-40), data: agora }, { id: 'a1', tipo: 'aporte', valor: 1000, dia: dia(-10), data: agora }, { id: 'a2', tipo: 'aporte', valor: 250, dia: dia(-9), data: agora }, { id: 'a3', tipo: 'aporte', valor: 500, dia: dia(-8), data: agora }], criadoEm: agora });
const lc = (h, d, s, v, n = '') => ({ h, d, s, n, o: '', v });
const c6 = [lc('h1', dia(-7), 'CDB C6 LIM.GARANT.', -30000), lc('h2', dia(-7), 'REND PAGO APLIC AUT MAIS', 120), lc('h3', dia(-12), 'APLICACAO CDB', -80000), lc('h4', dia(-8), 'RESGATE CDB', 40000), lc('h5', dia(-9), 'APLICACAO CDB', -25000), lc('h6', dia(-6), 'PIX ENVIADO MERCADO BOM', -5000, 'MERCADO BOM')];
const sic = [lc('s1', dia(-5), 'APLICACAO RDC', -50000), lc('s2', dia(-4), 'RESGATE RDC', 30000)];
const doc = (id, chave, banco, cc, lanc, todas) => ({ tipo: 'arquivo', fileId: id, titulo: id, lidoEm: agora, status: 'pendente', motivo: '', chave, banco, tipoConta: 'pj', ag: '', cc, titular: {}, de: dia(-14), ate: dia(-1), emitido: agora, saldoAtual: null, saldoNovo: false, nTotal: lanc.length, lanc, todas });
await api('PUT', 'extratos/arq_apc6', doc('apc6', 'c6|pj|1', 'C6', '1', c6, [[dia(-10), -100000, 'APLICACAO CDB'], [dia(-9), -25000, 'APLICACAO CDB'], [dia(-8), 40000, 'RESGATE CDB'], [dia(-7), -30000, 'CDB C6 LIM.GARANT.']])); await api('PUT', 'extratos/arq_apsic', doc('apsic', 'sicoob|pj|2', 'Sicoob', '2', sic, [[dia(-5), -50000, 'APLICACAO RDC'], [dia(-4), 30000, 'RESGATE RDC']]));
await p.goto(B + '/'); await pronto();
// ---- 1) o classificador
const e = await p.evaluate(() => {
  const f = window.__horusTeste.apClassificar, k = (t, v) => { const r = f(t, v); return r ? r.tipo : null; };
  return { auto: k('Cdb C6 Lim.Garant.', -30000), manual: k('Aplicação RDC', -50000), resgate: k('Resgate RDC', 30000), rend: k('Rend pago aplic aut mais', 120), autoResg: k('Resgate Cdb Lim Garant', 400),
    mercado: k('PIX ENVIADO MERCADO BOM', -5000), aplicativo: k('APLICATIVO XYZ', -100), cdbEntrada: k('CDB C6', 5000), invest: k('Invest Fácil C6', -100), outroBanco: k('Aplicação Automática Itaú', -2000), lci: k('Aplic LCI Inter', -9000) };
});
check(e.auto === 'auto' && e.autoResg === 'auto', '"Cdb C6 Lim.Garant." (saída e resgate) é aplicação automática');
check(e.manual === 'manual' && e.resgate === 'resgate' && e.rend === 'rendimento', '"Aplicação RDC" é manual, "Resgate RDC" é resgate e "Rend pago aplic aut mais" é rendimento');
check(e.mercado === null && e.aplicativo === null && e.cdbEntrada === null, 'compra comum, palavra parecida ("aplicativo") e CDB entrando sem a palavra resgate não são reconhecidos');
check(e.invest === 'auto' && e.outroBanco === 'auto' && e.lci === 'manual', 'palavras prontas de outros bancos (Invest Fácil, aplicação automática, LCI) funcionam');
// ---- 2) a lista da pessoa: acrescentar, tirar e voltar
const l = await p.evaluate(async () => {
  const T = window.__horusTeste, o = {};
  o.antes = T.apClassificar('CDB INTER PREMIUM', -100) ? 'x' : null; o.rdcAntes = T.apClassificar('RDC PRE', -100) && T.apClassificar('RDC PRE', -100).tipo;
  await T.apAdicionar('manual', 'Inter Premium'); o.depois = T.apClassificar('INTER PREMIUM FLEX', -100) && T.apClassificar('INTER PREMIUM FLEX', -100).tipo;
  await T.apRemover('manual', 'RDC'); o.rdcSem = T.apClassificar('RDC PRE', -100) ? 'x' : null; o.apliSegue = T.apClassificar('APLICACAO RDC', -100) && T.apClassificar('APLICACAO RDC', -100).tipo;
  await T.apAdicionar('manual', 'RDC'); o.rdcVolta = T.apClassificar('RDC PRE', -100) && T.apClassificar('RDC PRE', -100).tipo;
  const ap = T.apAprender([{ act: 'reserva', v: -1000, l: { n: 'XP Corretora Ltda', s: '' } }]); o.aprende = ap && ap.aplicacoes.extras.manual;
  return o;
});
check(l.depois === 'manual', 'acrescentar "inter premium" à lista: a linha passa a ser reconhecida');
check(l.rdcSem === null && l.apliSegue === 'manual' && l.rdcVolta === 'manual', 'tirar "rdc" da lista: "RDC PRE" deixa de ser reconhecida ("Aplicação RDC" segue pela palavra aplicação); ao devolver, volta');
check(JSON.stringify(l.aprende) === JSON.stringify(['INTER PREMIUM', 'XP CORRETORA LTDA']), 'o app aprende as primeiras palavras do favorecido quando a linha desconhecida vai para a reserva: ' + JSON.stringify(l.aprende));
let cfg = (await (await api('GET', 'config')).json()).docs.find((d) => d.id === 'extratos').data;
check(cfg.aplicacoes && cfg.aplicacoes.extras.manual.includes('INTER PREMIUM') && cfg.contas['sicoob|pj|2'].aplicacao === 'outra', 'a lista fica guardada na configuração da pessoa (e a conta do Sicoob segue como "outra aplicação")');
// ---- 3) a revisão do extrato: o que cada linha vira
const rv = await p.evaluate(() => window.__horusTeste.extConstruirRevisao().views.map((v) => ({ s: v.l.s, act: v.act, ap: v.ap && v.ap.tipo, m: v.motivo })));
const por = (s) => rv.find((v) => v.s === s);
check(por('CDB C6 LIM.GARANT.').act === 'ignorar' && /automática/.test(por('CDB C6 LIM.GARANT.').m), 'C6: "Cdb C6 Lim.Garant." (automática) é ignorada: não é aporte nem gasto');
check(por('REND PAGO APLIC AUT MAIS').act === 'ignorar', 'C6: rendimento é ignorado');
check(rv.filter((v) => v.s === 'APLICACAO CDB' && v.act === 'reserva').length === 1 && rv.filter((v) => v.s === 'APLICACAO CDB' && v.act === 'ja').length === 1, 'C6 (conta da reserva): a aplicação de R$ 800 vira aporte e a de R$ 250 (já lançada) vira "já está lançado"');
check(por('RESGATE CDB').act === 'reservaResgate', 'C6: o resgate de R$ 400 vira sugestão de retirada da reserva');
check(por('PIX ENVIADO MERCADO BOM').ap === undefined, 'compra comum não é tratada como aplicação');
check(por('APLICACAO RDC').act === 'ignorar' && /outra aplicação/.test(por('APLICACAO RDC').m) && por('RESGATE RDC').act === 'ignorar', 'Sicoob (outra aplicação): aplicação e resgate só ficam registrados, sem mexer na reserva');
// aplicar o resgate
const ap1 = await p.evaluate(async () => { const T = window.__horusTeste, v = T.extConstruirRevisao().views.find((x) => x.l.s === 'RESGATE CDB'); await T.extAplicarLinha(v, {}); return true; });
let meta = (await (await api('GET', 'metas')).json()).docs.find((d) => d.id === 'ap-res').data;
const ret = (meta.movimentos || []).find((x) => x.tipo === 'retirada');
check(ap1 && ret && ret.valor === -400 && ret.dia === dia(-8) && ret.origemExtrato === true, 'confirmar o resgate lança uma retirada de R$ 400 na reserva, na data do extrato');
await api('PUT', 'metas/ap-res', { ...meta, movimentos: meta.movimentos.filter((x) => x.tipo !== 'retirada') });
await p.reload(); await pronto();
// ---- 4) reserva × extrato (total líquido)
await p.evaluate(() => window.__horusTeste.apAbrirReserva()); await p.waitForTimeout(1000);
let t = await p.locator('#extCorpo').innerText().then((x) => x.replace(/\s+/g, ' '));
check(/Reserva · /i.test(t) && /Extrato \(aplicações − resgates\) R\$\s?850,00/.test(t) && /App \(aportes − retiradas\) R\$\s?1\.750,00/.test(t) && /Diferença R\$\s?900,00/.test(t), 'mostra o total líquido do extrato (R$ 1.000 + 250 − 400 = R$ 850) e o do app (R$ 1.750), diferença R$ 900: ' + t.slice(0, 260));
check(/Só no app \(1\)/i.test(t) && /Só no extrato \(1\)/i.test(t) && /RESGATE CDB/i.test(t) && /AP Reserva · R\$\s?500,00/.test(t), 'lista o aporte de R$ 500 que está só no app e o resgate de R$ 400 que está só no extrato: ' + t.slice(0, 700));
check(!/LIM\.GARANT/i.test(t) && !/Sicoob/i.test(t), 'a aplicação automática e a conta do Sicoob (outra aplicação) ficam fora da conferência da reserva');
await p.click('[data-ap="lanca"]'); await p.waitForTimeout(1800);
meta = (await (await api('GET', 'metas')).json()).docs.find((d) => d.id === 'ap-res').data;
const r2 = (meta.movimentos || []).find((x) => x.tipo === 'retirada');
t = await p.locator('#extCorpo').innerText().then((x) => x.replace(/\s+/g, ' '));
check(r2 && r2.valor === -400 && r2.dia === dia(-8) && /Diferença R\$\s?500,00/.test(t) && !/Só no extrato/i.test(t), 'Lançar retirada: grava R$ 400 na reserva e a diferença cai para R$ 500 (o aporte só do app)');
await p.click('#toast button'); await p.waitForTimeout(1800);
meta = (await (await api('GET', 'metas')).json()).docs.find((d) => d.id === 'ap-res').data;
check(!(meta.movimentos || []).some((x) => x.tipo === 'retirada'), 'Desfazer remove a retirada lançada');
await p.click('[data-ap="janela"][data-v="30"]'); await p.waitForTimeout(600);
check(await p.locator('[data-ap="janela"][data-v="30"].active').count() === 1, 'a janela de datas é ajustável (3, 7, 15, 30 dias)');
await p.click('[data-ap="conferida"]'); await p.waitForTimeout(1200);
cfg = (await (await api('GET', 'config')).json()).docs.find((d) => d.id === 'extratos').data;
check(cfg.reservaConferidaEm === dia(0), '"Marcar a reserva como conferida" guarda a data de hoje (some o aviso da Saúde dos dados)');
await p.evaluate(() => document.getElementById('extGenCancelar').click());
// ---- 5) Configurações: a tela de palavras e de destino por conta
await p.evaluate(() => { document.querySelector('[data-aba="configuracoes"]') && document.querySelector('[data-aba="configuracoes"]').click(); });
await p.evaluate(() => window.__horusTeste.apAbrirConfig()); await p.waitForTimeout(800);
t = await p.locator('#extCorpo').innerText().then((x) => x.replace(/\s+/g, ' '));
check(/Aplicação automática/.test(t) && /Aplicação manual/.test(t) && /Resgate/.test(t) && /Rendimento/.test(t) && /rdc/.test(t) && /Onde fica a sua reserva/.test(t), 'a tela mostra os 4 tipos com as palavras prontas e o destino por conta');
await p.fill('[data-ap-in="auto"]', 'caixa tem'); await p.click('[data-ap="add"][data-t="auto"]'); await p.waitForTimeout(1200);
cfg = (await (await api('GET', 'config')).json()).docs.find((d) => d.id === 'extratos').data;
check(cfg.aplicacoes.extras.auto.includes('CAIXA TEM'), 'acrescentar palavra pela tela grava na lista da pessoa');
await p.click('[data-ap="tira"][data-t="rendimento"][data-f="RENTABILIDADE"]'); await p.waitForTimeout(1200);
cfg = (await (await api('GET', 'config')).json()).docs.find((d) => d.id === 'extratos').data;
check(cfg.aplicacoes.removidas.rendimento.includes('RENTABILIDADE') && await p.locator('.ap-chip.ap-off').count() === 1, 'tirar palavra pronta pela tela: fica riscada e dá para devolver');
await p.selectOption('[data-ap-conta="sicoob|pj|2"]', 'reserva'); await p.waitForTimeout(1200);
cfg = (await (await api('GET', 'config')).json()).docs.find((d) => d.id === 'extratos').data;
check(cfg.contas['sicoob|pj|2'].aplicacao === 'reserva', 'mudar o destino da conta pela tela grava na conta');
check(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
