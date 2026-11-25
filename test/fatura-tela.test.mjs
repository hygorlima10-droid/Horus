// Fatura do cartão (CSV): leitura, aba "Cartão de crédito" em Extratos (conferência com ícones), confirmação, soma com o dia a dia nas Análises (filtro Tudo/Só conta/Só cartão), desfazer.
// Servidor do grupo 'leitor':  node test/rodar.mjs fatura-tela
import fs from 'node:fs'; import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8822', TOK = 'tok-dono-0000000000000000000000000001';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10), mes = hoje.slice(0, 7), dia = (n) => mes + '-' + String(n).padStart(2, '0');
const csv = ['date,title,amount', `${dia(2)},Supermercado Central,"100,00"`, `${dia(3)},Farmacia Saude Total,"50,00"`, `${dia(4)},Uber *Trip,"30,00"`, `${dia(5)},B91*Mundo das Utilidad,"54,00"`, `${dia(6)},Arnaldo Lopes de Mora,"8,00"`, `${dia(7)},Loja Casa Bela - Parcela 1/3,"90,00"`,
  `${dia(8)},Marcoswillianlima,"10,00"`, `${dia(9)},Marcoswillianlima,"15,00"`, `${dia(10)},IOF de compra internacional,"3,61"`, `${dia(10)},IOF de volta de Loja X,"- 3,61"`, `${dia(1)},Pagamento recebido,"- 500,00"`].join('\n');
fs.writeFileSync('/tmp/fatura-teste_2099-01-01.csv', csv);
const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 1280, height: 1000 } }); await ctx.addCookies([{ name: 'sessao', value: TOK, url: B }]);
const p = await ctx.newPage(); const erros = []; p.on('pageerror', (e) => erros.push(e.message)); await p.route(/fonts\./, (r) => r.abort());
await p.goto(B + '/'); await p.waitForTimeout(2500);
await p.evaluate(() => document.querySelector('#drawer [data-tab="extratos"]').click()); await p.waitForTimeout(1200);
check(await p.evaluate(() => [...document.querySelectorAll('#fatAbas button')].map((b) => b.textContent.trim()).join('|') === 'Conta bancária|Cartão de crédito'), 'Extratos tem as sub-abas "Conta bancária" e "Cartão de crédito"');
await p.evaluate(() => { document.getElementById('impArq').style.display = 'block'; });
await p.setInputFiles('#impArq', '/tmp/fatura-teste_2099-01-01.csv'); await p.waitForTimeout(3500);
const cartao = () => p.evaluate(() => (document.getElementById('fatCartao') || { innerText: '' }).innerText.replace(/\s+/g, ' '));
let t = await cartao();
check(/Faturas para conferir \(1\)/.test(t) && /Cartão de crédito/.test(await p.evaluate(() => document.querySelector('#fatAbas .on').textContent)), 'ao enviar o CSV, o app abre a aba Cartão de crédito com 1 fatura para conferir');
check(/Vencimento — informe/.test(t) && !/2099/.test(await p.evaluate(() => document.querySelector('#fatCartao input[type=date]').value)), 'o CSV não traz vencimento: o app pergunta (não usa o nome do arquivo)');
check(/Supermercado/.test(t) && /Farmácia/.test(t) && /R\$ 100,00/.test(t), 'compras reconhecidas por categoria (Supermercado, Farmácia…)');
if (process.env.DEBUG_FT) console.log('DEBUG-T', t.slice(0, 1800));
check(/Marcoswillianlima 2 lançamentos R\$ 25,00/.test(t) && /Mundo das Utilidad/.test(t.split(/sem categoria/i)[1] || '') && /Arnaldo Lopes de Mora/.test(t.split(/sem categoria/i)[1] || ''), 'nomes duvidosos ("Mundo das Utilidades" ≠ imposto DAS, "Mora" ≠ juros) vão para decidir; mesmo estabelecimento fica agrupado');
check(/Pagamento recebido/.test(t) && /IOF que se anula/.test(t), 'pagamento da fatura anterior e IOF que se anulam não contam como gasto');
check(/falta 2 × R\$ 90,00|faltam 2 × R\$ 90,00/.test(t), 'compra parcelada 1/3 mostra o que falta (2 × R$ 90,00)');
const icones = await p.evaluate(() => ({ lin: document.querySelectorAll('#fatCartao [data-fat-card] .fat-cat').length, ic: document.querySelectorAll('#fatCartao [data-fat-card] .fat-cat .cat-ic svg').length, bot: document.querySelectorAll('#fatCartao [data-fat-card] .cat-pk-btn .cat-ic').length }));
check(icones.ic >= 4 && icones.bot >= 3, 'as categorias do cartão têm ÍCONE, como nos extratos (' + icones.ic + ' nas linhas, ' + icones.bot + ' nos seletores)');
// escolhe categorias das pendentes e o vencimento, e confirma
await p.evaluate(() => { const s = [...document.querySelectorAll('#fatCartao select[data-fat-k]')]; const pg = (k, v) => { const e = s.find((x) => x.getAttribute('data-fat-k').toLowerCase().startsWith(k)); if (e) { if (![...e.options].some((o) => o.value === v)) e.add(new Option(v, v)); e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); } }; pg('marcoswillian', 'Restaurantes e bares'); });
await p.waitForTimeout(500);
if (process.env.DEBUG_FT) console.log('DEBUG-SEL', await p.evaluate(() => JSON.stringify(window.__horusTeste.fatS.sel) + ' | ' + [...document.querySelectorAll('#fatCartao select[data-fat-k]')].map((e) => e.getAttribute('data-fat-k') + '=' + e.value).join(';')));
await p.fill('#fatCartao input[type=date]', dia(20)); await p.dispatchEvent('#fatCartao input[type=date]', 'change'); await p.waitForTimeout(400);
await p.click('#fatCartao [data-fat="confirmar"]'); await p.waitForTimeout(2200);
const docs = await p.evaluate(async () => (await (await fetch('/api/db/extratos')).json()).docs.map((d) => d.data).filter((d) => d.tipo === 'diaadia' && d.origem === 'cartao'));
const soma = docs.reduce((t, d) => t + Object.values(d.cats).reduce((a, c) => a + c.v, 0), 0), nLin = docs.reduce((t, d) => t + d.linhas.length, 0);
check(docs.length >= 1 && Math.abs(soma - 357) < 0.005 && nLin === 8, 'a fatura vira dia a dia do cartão: ' + nLin + ' lançamentos, R$ ' + soma.toFixed(2) + ' (esperado 8 e R$ 357,00 = 100+50+30+54+8+90+10+15)');
if (process.env.DEBUG_FT) console.log('DEBUG-CATS', JSON.stringify(docs.map((d) => d.cats)));
check(docs.every((d) => d.coluna === 'pf' || d.coluna === 'pj') && docs.some((d) => d.cats['Restaurantes e bares'] && d.cats['Restaurantes e bares'].v === 25), 'a categoria escolhida vale para o estabelecimento agrupado (R$ 25,00 em Restaurantes e bares)');
t = await cartao();
check(/Faturas lançadas \(1\)/.test(t) && /Compras por categoria/.test(t) && /Total do cartão no mês R\$ 357,00/.test(t), 'a aba mostra "Faturas lançadas (1)" e o total do cartão no mês, por categoria');
check(await p.evaluate(() => document.querySelectorAll('#fatCartao .ini-card:not(.fat-ja) .fat-cat .cat-ic svg').length >= 4), 'as compras lançadas por categoria também têm ícone');
// a fatura também vira DESPESA no mês do FECHAMENTO (dia 26), pelo total, pendente
const fechaEsp = (() => { let a = +mes.slice(0, 4), m = +mes.slice(5, 7); if (20 <= 26) { m--; if (m < 1) { m = 12; a--; } } return a + '-' + String(m).padStart(2, '0') + '-26'; })();   // o vencimento do teste é o dia 20: o cartão fechou no dia 26 do mês anterior
const despF = async () => p.evaluate(async () => (await (await fetch('/api/db/despesas')).json()).docs.map((d) => ({ id: d.id, ...d.data })).filter((d) => d.faturaId));
let df = await despF();
check(df.length === 1 && df[0].mesReferencia === fechaEsp.slice(0, 7) && df[0].data === fechaEsp && Math.abs(df[0].valor - 357) < 0.005 && df[0].pago === false && df[0].categoria === 'cartao' && /^Fatura /.test(df[0].nome), 'a fatura virou despesa pendente no mês do FECHAMENTO (dia 26: ' + fechaEsp + '), R$ 357,00, e não no do vencimento: ' + JSON.stringify(df.map((d) => [d.nome, d.data, d.valor, d.pago])));
// lançada antes desta regra (sem despesa): botão "Lançar como despesa de <mês do vencimento>"
await p.evaluate(async (id) => { await fetch('/api/db/despesas/' + id, { method: 'DELETE' }); }, df[0].id); await p.reload(); await p.waitForTimeout(2500);
await p.evaluate(() => document.querySelector('#drawer [data-tab="extratos"]').click()); await p.waitForTimeout(800);
await p.evaluate(() => { const b = document.querySelector('#fatAbas [data-v="cartao"]'); if (b) b.click(); }); await p.waitForTimeout(500);
check(/Lançar como despesa de/.test(await cartao()), 'fatura já lançada e sem despesa: aparece o botão "Lançar como despesa de <mês do fechamento>"');
await p.click('#fatCartao [data-fat="despesa"]'); await p.waitForTimeout(1500);
df = await despF(); check(df.length === 1 && df[0].mesReferencia === fechaEsp.slice(0, 7) && !/Lançar como despesa de/.test(await cartao()), 'o botão cria a despesa no mês do fechamento (e some)');
// Análises: o cartão soma com o dia a dia da conta; filtro de origem
await p.evaluate(() => document.querySelector('#drawer [data-tab="analises"]').click()); await p.waitForTimeout(1500);
await p.evaluate(() => { const b = document.querySelector('[data-an-periodo="hist"]'); if (b) b.click(); }); await p.waitForTimeout(1500);
const an = () => p.evaluate(() => document.getElementById('bodyAnalises').innerText.replace(/\s+/g, ' '));
check(await p.evaluate(() => [...document.querySelectorAll('[data-fat-origem]')].map((b) => b.textContent.trim()).join('|') === 'Tudo|Só conta|Só cartão'), 'Análises: filtro Tudo / Só conta / Só cartão aparece quando há fatura lançada');
check(/Supermercado/.test(await an()), 'Análises (Tudo): o cartão entra nas categorias junto com o dia a dia');
await p.click('[data-fat-origem="cartao"]'); await p.waitForTimeout(800);
check(/Supermercado/.test(await an()) && /Farmácia/.test(await an()), 'Análises (Só cartão): mostra as categorias do cartão');
await p.click('[data-fat-origem="conta"]'); await p.waitForTimeout(800);
check(!/Farmácia e medicamentos/.test((await an()).split('Para onde o dinheiro vai')[1] || ''), 'Análises (Só conta): as compras do cartão saem');
await p.click('[data-fat-origem="tudo"]'); await p.waitForTimeout(300);
// desfazer
await p.evaluate(() => document.querySelector('#drawer [data-tab="extratos"]').click()); await p.waitForTimeout(900);
await p.evaluate(() => { const b = document.querySelector('#fatAbas [data-v="cartao"]'); if (b) b.click(); }); await p.waitForTimeout(500);
await p.click('#fatCartao [data-fat="desfazer"]'); await p.waitForTimeout(1500);
const depois = await p.evaluate(async () => (await (await fetch('/api/db/extratos')).json()).docs.map((d) => d.data).filter((d) => d.tipo === 'diaadia' && d.origem === 'cartao').length);
check(depois === 0 && /Faturas para conferir \(1\)/.test(await cartao()), 'Desfazer: o dia a dia do cartão sai e a fatura volta para conferir');
check((await despF()).length === 0, 'Desfazer também apaga a despesa da fatura');
check(erros.length === 0, 'sem erros de script' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
