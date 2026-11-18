// Pagamento separado (o pagador, ex.: Murilo, paga a parte de cada advogado direto): divisão com o pagador dentro, parte de cada pessoa, marcador
// "o Murilo recebeu do cliente", relatório do Murilo por pessoa (com seletor das vencidas), livro-caixa por pessoa e status geral da parcela.
// Servidor do grupo 'permissoes':  node test/rodar.mjs pagamento-direto
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8816', TOK = { dono: 'tok-dono-0000000000000000000000000001', ana: 'tok-adv-ana-00000000000000000000000002', bruno: 'tok-adv-bruno-000000000000000000000003' };
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const api = (n) => async (m, p, b) => { const x = await fetch(B + p, { method: m, headers: { cookie: 'sessao=' + TOK[n], 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined }); let j = null; try { j = await x.json(); } catch (e) { } return { s: x.status, j }; };
const dono = api('dono'), ana = api('ana');
const dia = (n) => new Date(Date.now() - 3 * 3600e3 + n * 86400e3).toISOString().slice(0, 10), hoje = dia(0), ontem = dia(-1), mes = hoje.slice(0, 7);
await dono('PUT', '/api/usuarios/u1', { oabs: ['60456/GO'] });
for (const d of (await dono('GET', '/api/db/recebimentos')).j.docs || []) await dono('DELETE', '/api/db/recebimentos/' + d.id);   // só o que este teste cria: os outros testes do grupo dependem do resto do banco
const limpar = async () => { for (const d of (await dono('GET', '/api/db/recebimentos')).j.docs || []) await dono('DELETE', '/api/db/recebimentos/' + d.id); for (const id of ['pd1', 'pd2']) await dono('DELETE', '/api/db/casos/' + id); };
const MUR = { oab: '49308/GO', nome: 'Murilo Falone Rocha' }, HYG = { oab: '60456/GO', nome: 'Dono Teste' }, ANA = { oab: '11111/GO', nome: 'Ana Advogada' };
const base = (cliente, num, extra) => ({ tipo: 'inicial', origem: 'murilo', prioridade: 'normal', status: 'pendente', cliente, nomeAcao: 'Indenização', numeroProcesso: num, modalidadeHonorario: 'fixo', formaPagamento: 'parcelado', valorHonorarios: 50000, parcelas: [{ numero: 1, valor: 50000, data: ontem, pago: false }], advogados: [HYG, ANA, MUR], criadoEm: new Date().toISOString(), ...extra });
// contrato de R$ 50.000: Hygor 10%, Ana 5%, Murilo (quem paga) 85%
await dono('PUT', '/api/db/casos/pd1', base('Indenizacao Direta', '0000831-01.2024.8.09.0831', { divisao: { modo: 'direto', partes: [{ oab: '60456/GO', nome: 'Dono Teste', pct: 10 }, { oab: '11111/GO', nome: 'Ana Advogada', pct: 5 }, { oab: '49308/GO', nome: 'Murilo Falone Rocha', pct: 85, pagador: true }] } }));
// sem divisão (a parte lançada é do proprietário)
await dono('PUT', '/api/db/casos/pd2', base('Sem Divisao', '0000832-02.2024.8.09.0832', { valorHonorarios: 3000, parcelas: [{ numero: 1, valor: 3000, data: ontem, pago: false }], advogados: [HYG, MUR] }));
const br = await chromium.launch();
const nova = async (n, w = 1280) => { const ctx = await br.newContext({ viewport: { width: w, height: 900 } }); await ctx.addCookies([{ name: 'sessao', value: TOK[n], url: B }]); const page = await ctx.newPage(); page.errs = []; page.on('pageerror', (e) => page.errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.|Failed to load resource/.test(m.text())) page.errs.push('console: ' + m.text()); }); await page.route(/fonts\./, (x) => x.abort()); await page.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { } }); await page.goto(B + '/'); await page.waitForFunction(() => window.__horusEu && window.__horusEu.pronto && window.__horusTeste && window.__horusTeste.pdCarregar && document.getElementById('mainTabs'), null, { timeout: 60000 }); await page.waitForTimeout(2500); return page; };
const un = (p, id) => p.evaluate((id) => window.__horusTeste.rcUnidades(id), id);
const rel = async (p, modo = 'murilo') => { await p.evaluate(([m, md]) => window.__horusTeste.abrirRelMurilo(m, md), [mes, modo]); await p.waitForTimeout(400); return { tot: await p.locator('#relMuriloTotais').innerText(), txt: await p.locator('#relMuriloTexto').inputValue(), sel: await p.locator('#relSelLista').innerText() }; };
const fecharRel = (p) => p.evaluate(() => { document.getElementById('overlayRelMurilo').classList.remove('show'); });

console.log('\n— a parte de cada um (contrato de R$ 50.000: 10% / 5% / 85% do Murilo)');
const pd = await nova('dono'), pa = await nova('ana');
let ud = await un(pd, 'pd1'), ua = await un(pa, 'pd1');
check(ud.length === 1 && ud[0].meu === 5000, 'o proprietário vê a parte dele: R$ 5.000,00 (10%) — e não os R$ 50.000: ' + JSON.stringify(ud.map((x) => x.meu)));
check(ua.length === 1 && ua[0].meu === 2500, 'a Ana vê a parte dela: R$ 2.500,00 (5%): ' + JSON.stringify(ua.map((x) => x.meu)));
check((await un(pd, 'pd2'))[0].meu === 3000, 'processo sem divisão: continua inteiro do proprietário (R$ 3.000,00)');

console.log('\n— o relatório do Murilo só cobra depois que ele recebeu do cliente');
let r = await rel(pa);
check(/Total da sua parte a receber do Murilo/.test(r.tot) && /Aguardando o Murilo receber do cliente/.test(r.sel) && /R\$\s*2\.500,00/.test(r.sel), 'a parcela da Ana aparece em "Aguardando o Murilo receber do cliente", com a parte dela (R$ 2.500,00): ' + r.tot.replace(/\n/g, ' ').slice(0, 90));
check(!/Indenizacao Direta/.test(r.txt), 'e não entra no texto da cobrança');
// seletor: incluir à mão a parcela vencida
await pa.evaluate(() => { const cb = document.querySelector('#relSelLista input[data-rel-agu]'); cb.click(); }); await pa.waitForTimeout(400);
r = { tot: await pa.locator('#relMuriloTotais').innerText(), txt: await pa.locator('#relMuriloTexto').inputValue() };
check(/Indenizacao Direta/.test(r.txt) && /2\.500,00/.test(r.txt), 'a Ana inclui à mão a parcela vencida e ela entra no texto (R$ 2.500,00)');
await pa.evaluate(() => { const cb = document.querySelector('#relSelLista input[data-rel-agu]'); cb.click(); }); await pa.waitForTimeout(300);
await fecharRel(pa);
// marcador: o Murilo recebeu do cliente
await pa.evaluate(() => window.__horusTeste.pdMarcarCliente(window.__horusTeste.pdUnidade('pd1|parcela|1'), true)); await pa.waitForTimeout(600);
r = await rel(pa);
check(/Indenizacao Direta/.test(r.txt) && /2\.500,00/.test(r.txt) && !/Aguardando o Murilo[^\n]*\n[^\n]*Indenizacao/.test(r.sel), 'depois do marcador, a parte da Ana entra sozinha no relatório (R$ 2.500,00)');
await fecharRel(pa);
await pd.evaluate(() => window.__horusTeste.pdCarregar()); await pd.waitForTimeout(800);
r = await rel(pd);
check(/Total da sua parte a receber do Murilo/.test(r.tot) && /Indenizacao Direta[^\n]*5\.000,00|5\.000,00/.test(r.txt) && /Sem Divisao/.test(r.txt) && /3\.000,00/.test(r.txt) && !/50\.000/.test(r.tot + r.txt), 'o relatório do proprietário mostra só a parte dele (R$ 5.000,00, não os R$ 50.000) e o processo sem divisão inteiro (R$ 3.000,00)');
await fecharRel(pd);

console.log('\n— cada um marca o recebimento dele (livro-caixa próprio)');
await pa.evaluate(() => window.__horusTeste.pdPagar([{ u: window.__horusTeste.pdUnidade('pd1|parcela|1'), valor: 2500 }])); await pa.waitForTimeout(800);
ua = await un(pa, 'pd1'); ud = await un(pd, 'pd1');
check(ua[0].pago === true && ud[0].pago === false, 'a Ana recebeu a parte dela; a do proprietário continua aberta');
const rb = (await dono('GET', '/api/db/recebimentos')).j.docs.map((d) => d.data);
check(rb.filter((x) => x.tipo === 'parte').length === 1 && rb.find((x) => x.tipo === 'parte').oab === '11111/GO', 'só existe o livro-caixa da Ana (o do proprietário ainda não)');
const doc1 = () => dono('GET', '/api/db/casos').then((r) => r.j.docs.find((d) => d.id === 'pd1').data);
check((await doc1()).parcelas[0].pago === false, 'o cadastro da parcela não foi alterado pela baixa da Ana');
r = await rel(pa);
check(!/Indenizacao Direta/.test(r.txt) || /Já recebido/.test(r.txt + r.sel), 'o recebido sai da cobrança da Ana');
await fecharRel(pa);
check(ua[0].meu === 2500, 'a receita da Ana é a parte dela (R$ 2.500,00)');

console.log('\n— o proprietário recebe a parte dele; a parcela fica quitada para todos');
await pd.evaluate(() => window.__horusTeste.pdCarregar()); await pd.waitForTimeout(500);
await pd.evaluate(() => window.__horusTeste.pdPagar([{ u: window.__horusTeste.pdUnidade('pd1|parcela|1'), valor: 5000 }])); await pd.waitForTimeout(2500);
check((await doc1()).parcelas[0].pago === true, 'com todos os recebedores pagos, o status geral da parcela vira "recebida"');
await pa.evaluate(() => window.__horusTeste.pdCarregar()); await pa.waitForTimeout(500);
await pa.evaluate(() => window.__horusTeste.pdPagar && 0);
// a Ana desfaz: o proprietário (ao recarregar) reabre a parcela
await pa.evaluate(async () => { const u = window.__horusTeste.pdUnidade('pd1|parcela|1'); const L = window.__horusTeste.pdS.lista.find((x) => x.tipo === 'parte'); await fetch('/api/db/recebimentos/' + L.id, { method: 'DELETE', credentials: 'same-origin' }); });
await pd.evaluate(() => window.__horusTeste.pdCarregar()); await pd.waitForTimeout(2500);
check((await doc1()).parcelas[0].pago === false, 'se alguém desfaz o recebimento, o proprietário reabre o status geral da parcela');

console.log('\n— tela: a lista mostra a parte e o recebimento é da pessoa');
await pa.evaluate(() => window.__horusTeste.pdCarregar()); await pa.waitForTimeout(500);
await pa.click('#drawer [data-tab="peticoes"]'); await pa.waitForTimeout(800);
await pa.getByText('Lista', { exact: true }).first().click().catch(() => { }); await pa.waitForTimeout(600);
await pa.locator('.cliente-cell .nome:visible', { hasText: 'Indenizacao Direta' }).first().click(); await pa.waitForTimeout(700);
const chip = await pa.evaluate(() => [...document.querySelectorAll('.pd-chip')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
check(chip.length > 0 && chip.some((t) => /sua parte R\$\s*2\.500,00 \(5%\)/.test(t)) && chip.some((t) => /recebeu do cliente/.test(t)), 'a parcela mostra "sua parte R$ 2.500,00 (5%)" e o marcador do Murilo: ' + JSON.stringify(chip).slice(0, 200));
await pa.evaluate(() => window.__horusTeste.pdS.lista.filter((x) => x.tipo === 'parte').forEach(() => { }));
const marcou = await pa.evaluate(() => { const el = document.querySelector('input[data-parcela="pd1"]'); if (!el) return 'sem caixa'; el.click(); return 'clicou'; }); await pa.waitForTimeout(1200);
check(marcou === 'clicou' && (await dono('GET', '/api/db/recebimentos')).j.docs.some((d) => d.data.tipo === 'parte' && d.data.oab === '11111/GO' && d.data.pago === true), 'clicar na caixa da parcela grava o recebimento da PESSOA (livro-caixa da Ana), não a parcela inteira: ' + marcou);
check((await doc1()).parcelas[0].pago === false, 'e a parcela do cadastro continua em aberto (a do proprietário ainda não foi paga)');
check(pa.errs.length === 0 && pd.errs.length === 0, 'sem erros de JavaScript' + [...pa.errs, ...pd.errs].join(' | '));
await limpar();
await br.close();
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo.'); process.exit(falhas ? 1 : 0);
