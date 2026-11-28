// Conferir com o extrato (o caminho de volta): camadas de correspondência (bate, data diferente, possível, valor quase igual, soma de linhas, só no app), janela de 3/7/15/30 dias,
// "Usar a data do extrato" (com Desfazer), Dispensar e o aviso de conta ainda não lida.  Grupo 'telas-isoladas':  node test/rodar.mjs conferir-extrato
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8816', TOK = 'tok-dono-0000000000000000000000000001';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const api = (m, p, b) => fetch(B + '/api/db/' + p, { method: m, headers: { cookie: 'sessao=' + TOK, 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined });
const dia = (n) => new Date(Date.now() - 3 * 3600e3 + n * 864e5).toISOString().slice(0, 10), mes0 = dia(0).slice(0, 7), agora = new Date().toISOString();
const br = await chromium.launch(), ctx = await br.newContext({ viewport: { width: 1280, height: 900 } }); await ctx.addCookies([{ name: 'sessao', value: TOK, url: B }]);
const p = await ctx.newPage(); const erros = []; p.on('pageerror', (e) => erros.push(e.message)); await p.route(/fonts\./, (r) => r.abort()); await p.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { } });
await p.goto(B + '/'); await p.waitForFunction(() => window.__horusEu && window.__horusEu.pronto, null, { timeout: 60000 }); await p.waitForTimeout(2500);
// ---- 1) o motor (sem tela): cada camada
const M = (data, valor, nome, tipo = 'saida') => ({ data, valor, tipo, nome });
const L = (d, v, t) => ({ d, v, t });
const e = await p.evaluate(() => {
  const f = window.__horusTeste.cxCasar, r = {};
  const a = f([{ d: '2026-11-10', v: -15000, t: 'ALUGUEL' }], [{ data: '2026-11-10', valor: 15000, tipo: 'saida', nome: 'Aluguel' }], 3); r.bate0 = [a.bate.length, a.bate[0] && a.bate[0].dias, a.so.length];
  const b = f([{ d: '2026-11-11', v: -21000, t: 'CONTADOR ASSESSORIA' }], [{ data: '2026-11-10', valor: 21000, tipo: 'saida', nome: 'Contador' }], 3); r.bate1 = [b.bate.length, b.bate[0] && b.bate[0].dias];
  const c = f([{ d: '2026-11-17', v: -30000, t: 'CDB C6 LIM.GARANT.' }], [{ data: '2026-11-10', valor: 30000, tipo: 'saida', nome: 'Aporte reserva' }], 3); r.janela3 = [c.possivel.length, c.so.length];
  const c7 = f([{ d: '2026-11-17', v: -30000, t: 'CDB C6' }], [{ data: '2026-11-10', valor: 30000, tipo: 'saida', nome: 'Aporte reserva' }], 7); r.janela7 = [c7.possivel.length, c7.possivel[0] && c7.possivel[0].dias, c7.so.length];
  const c30 = f([{ d: '2026-12-01', v: -30000, t: 'CDB C6' }], [{ data: '2026-11-10', valor: 30000, tipo: 'saida', nome: 'Aporte reserva' }], 15); r.fora15 = [c30.possivel.length, c30.so.length];
  const d = f([{ d: '2026-11-26', v: -504800, t: 'CDB C6 LIM.GARANT.' }], [{ data: '2026-11-26', valor: 504862, tipo: 'saida', nome: 'Aporte reserva' }], 3); r.proximo = [d.proximo.length, d.proximo[0] && d.proximo[0].dif];
  const g = f([{ d: '2026-11-20', v: -30000, t: 'A' }, { d: '2026-11-22', v: -40000, t: 'B' }], [{ data: '2026-11-21', valor: 70000, tipo: 'saida', nome: 'Reserva' }], 3); r.agrupado = [g.agrupado.length, g.agrupado[0] && g.agrupado[0].ls.length];
  const h = f([{ d: '2026-11-10', v: -15000, t: 'X' }], [{ data: '2026-11-10', valor: 15000, tipo: 'saida', nome: 'a' }, { data: '2026-11-10', valor: 15000, tipo: 'saida', nome: 'b' }], 3); r.umaSo = [h.bate.length, h.so.length];
  const i = f([{ d: '2026-11-10', v: 15000, t: 'X' }], [{ data: '2026-11-10', valor: 15000, tipo: 'saida', nome: 'a' }], 30); r.tipo = [i.bate.length, i.possivel.length, i.so.length];
  const j = f([{ d: '2026-11-12', v: -15000, t: 'PADARIA DO ZE' }], [{ data: '2026-11-10', valor: 15000, tipo: 'saida', nome: 'Internet Vivo' }], 3); r.nomeDif = [j.bate.length, j.possivel.length, j.possivel[0] && j.possivel[0].nomeDif];
  return r;
});
check(JSON.stringify(e.bate0) === '[1,0,0]', 'mesmo valor e mesma data: bate (0 dias)');
check(JSON.stringify(e.bate1) === '[1,1]', 'mesmo valor, 1 dia de diferença: bate, com 1 dia (data diferente)');
check(JSON.stringify(e.janela3) === '[0,1]' && JSON.stringify(e.janela7) === '[1,7,0]', 'a 7 dias: só no app com janela de 3 dias, possível correspondência (7 dias) com janela de 7');
check(JSON.stringify(e.fora15) === '[0,1]', 'a 21 dias fica de fora da janela de 15');
check(JSON.stringify(e.proximo) === '[1,-62]', 'R$ 5.048,62 no app × R$ 5.048,00 no extrato (o banco aplica só os reais inteiros): valor quase igual');
check(JSON.stringify(e.agrupado) === '[1,2]', 'R$ 700,00 no app = R$ 300,00 + R$ 400,00 no extrato: soma de 2 linhas');
check(JSON.stringify(e.umaSo) === '[1,1]', 'cada linha do banco casa com um lançamento só (o outro fica "só no app")');
check(JSON.stringify(e.tipo) === '[0,0,1]', 'entrada no extrato e saída no app nunca casam');
check(JSON.stringify(e.nomeDif) === '[0,1,true]', 'mesmo valor, 2 dias, nome diferente: possível correspondência (nome diferente), não "bate"');
// ---- 2) a tela: extrato pendente com todas as linhas + lançamentos no app
await api('PUT', 'config/extratos', { contas: { 'c6|pj|1': { coluna: 'pj', rotulo: 'C6 PJ · cc 1', banco: 'C6', confirmada: true }, 'sicoob|pj|2': { coluna: 'pj', rotulo: 'Sicoob PJ · cc 2', banco: 'Sicoob', confirmada: true } } });
await api('PUT', 'despesas/cx-alu', { nome: 'CX Aluguel do escritório', coluna: 'pj', tipo: 'unica', valor: 1500, data: dia(-10), mesReferencia: mes0, categoria: 'estrutura', pago: true, dataPagamento: dia(-10), criadoEm: agora });
await api('PUT', 'despesas/cx-con', { nome: 'CX Contador', coluna: 'pj', tipo: 'unica', valor: 210, data: dia(-8), mesReferencia: mes0, categoria: 'servicos', pago: true, dataPagamento: dia(-8), criadoEm: agora });
await api('PUT', 'metas/cx-res', { tipo: 'reserva', nome: 'CX Reserva', coluna: 'pj', movimentos: [{ id: 'cxm1', tipo: 'aporte', valor: 300, dia: dia(-12), data: agora }, { id: 'cxm2', tipo: 'aporte', valor: 5048.62, dia: dia(-5), data: agora }], criadoEm: agora });
await api('PUT', 'receitasManuais/cx-rec', { coluna: 'pj', nome: 'CX Honorário avulso', valor: 435, data: dia(-6), mesReferencia: mes0, recorrente: false, criadoEm: agora });
await api('PUT', 'despesas/cx-som', { nome: 'CX Reserva em duas partes', coluna: 'pj', tipo: 'unica', valor: 700, data: dia(-9), mesReferencia: mes0, categoria: 'outros', pago: true, dataPagamento: dia(-9), criadoEm: agora });
const todas = [[dia(-10), -150000, 'PIX ALUGUEL ESCRITORIO'], [dia(-7), -21000, 'PIX CONTADOR'], [dia(-5), -30000, 'CDB C6 LIM.GARANT.'], [dia(-5), -504800, 'CDB C6 LIM.GARANT.'], [dia(-10), -25000, 'PIX PARTE A'], [dia(-8), -45000, 'PIX PARTE B'], [dia(-3), 1200000, 'PIX RECEBIDO CLIENTE']];
await api('PUT', 'extratos/arq_cx1', { tipo: 'arquivo', fileId: 'cx1', titulo: 'extrato c6', lidoEm: agora, status: 'pendente', motivo: '', chave: 'c6|pj|1', banco: 'C6', tipoConta: 'pj', ag: '', cc: '1', titular: {}, de: dia(-14), ate: dia(-1), emitido: agora, saldoAtual: null, saldoNovo: false, nTotal: todas.length, nRep: todas.length, nDescartadas: 0, corte: null, lanc: [], todas });
await p.reload(); await p.waitForFunction(() => window.__horusEu && window.__horusEu.pronto, null, { timeout: 60000 }); await p.waitForTimeout(3500);
await p.evaluate(() => window.__horusTeste.extAbrirConferencia()); await p.waitForTimeout(1200);
let cx = await p.locator('#cxBox').innerText().then((x) => x.replace(/\s+/g, ' '));
check(/Conferência com o app/i.test(cx) && /Janela de datas/i.test(cx) && /3 dias/.test(cx) && /30 dias/.test(cx), 'o cartão "Conferência com o app" aparece em "Conferir extratos", com a janela de 3/7/15/30 dias');
check(/Só no app \(\d+\)/i.test(cx) && /CX Honorário avulso/.test(cx) && /CX Aluguel/i.test(cx) === false, 'janela de 3 dias: o honorário avulso está só no app e o aluguel (mesma data) bate');
check(/Data diferente \(1\)/i.test(cx) && /CX Contador/.test(cx) && /1 dia depois/i.test(cx), 'o contador (1 dia depois) aparece em "Data diferente"');
check(/Valor quase igual/i.test(cx) && /CX Reserva/.test(cx), 'o aporte de R$ 5.048,62 aparece como valor quase igual ao CDB de R$ 5.048,00');
check(/Soma de linhas do extrato \(1\)/i.test(cx) && /CX Reserva em duas partes/.test(cx), 'a despesa de R$ 700 aparece como soma de 2 linhas do extrato');
check(/outras contas que ainda não foram lidas \(Sicoob PJ/i.test(cx), 'avisa que a conta do Sicoob ainda não foi lida ("não conferido")');
// janela de 7 dias: o aporte de R$ 300 (12 dias antes do CDB? 7 dias) vira possível correspondência
await p.click('[data-cx="janela"][data-v="7"]'); await p.waitForTimeout(500);
cx = await p.locator('#cxBox').innerText().then((x) => x.replace(/\s+/g, ' '));
check(/Possível correspondência \(1\)/i.test(cx) && /7 dias depois/i.test(cx), 'janela de 7 dias: o aporte de R$ 300 passa a ser "possível correspondência" (7 dias depois)');
// É este: corrige a data do aporte na meta
await p.click('[data-cx="data"][data-cxt="poss"]'); await p.waitForTimeout(1800);
const meta = (await (await api('GET', 'metas')).json()).docs.find((d) => d.id === 'cx-res').data;
check(meta.movimentos.find((x) => x.id === 'cxm1').dia === dia(-5), 'É este: a data do aporte na reserva passou para a do extrato (' + dia(-5) + ')');
// usar a data do extrato (contador) e desfazer
await p.click('[data-cx="data"][data-cxt="dif"]'); await p.waitForTimeout(1800);
let con = (await (await api('GET', 'despesas')).json()).docs.find((d) => d.id === 'cx-con').data;
check(con.dataPagamento === dia(-7), 'Usar a data do extrato: o pagamento do contador passou para ' + dia(-7));
await p.click('#toast button'); await p.waitForTimeout(1800);
con = (await (await api('GET', 'despesas')).json()).docs.find((d) => d.id === 'cx-con').data;
check(con.dataPagamento === dia(-8), 'Desfazer devolve a data de antes (' + dia(-8) + ')');
// dispensar o honorário avulso: some e continua dispensado ao reabrir
const antes = await p.locator('#cxBox [data-cx="disp"][data-cxt="so"]').count();
await p.locator('#cxBox [data-cx="disp"][data-cxt="so"]').first().click(); await p.waitForTimeout(1200);
cx = await p.locator('#cxBox').innerText().then((x) => x.replace(/\s+/g, ' '));
check(!/CX Honorário avulso/.test(cx) && /dispensado/i.test(cx), 'Dispensar tira o item e conta "1 item dispensado"');
await p.evaluate(() => document.getElementById('extGenCancelar').click()); await p.waitForTimeout(300);
await p.evaluate(() => window.__horusTeste.extAbrirConferencia()); await p.waitForTimeout(1200);
check(!/CX Honorário avulso/.test(await p.locator('#cxBox').innerText()), 'ao reabrir a conferência o item dispensado continua fora');
// nada foi gravado sem confirmar o extrato
const ex = (await (await api('GET', 'extratos')).json()).docs.find((d) => d.id === 'arq_cx1').data;
check(ex.status === 'pendente', 'o extrato continua pendente (a conferência não confirma nada)');
// extrato lido antes da função (sem "todas"): avisa para reler
await api('PUT', 'extratos/arq_cx1', { ...ex, todas: undefined });
await p.evaluate(() => document.getElementById('extGenCancelar').click()); await p.waitForTimeout(300);
await p.reload(); await p.waitForFunction(() => window.__horusEu && window.__horusEu.pronto, null, { timeout: 60000 }); await p.waitForTimeout(3500);
await p.evaluate(() => window.__horusTeste.extAbrirConferencia()); await p.waitForTimeout(1200);
check(/lido antes desta função/i.test(await p.locator('#cxBox').innerText()), 'extrato lido antes da função: pede para reler, sem acusar "só no app" por engano');
check(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
