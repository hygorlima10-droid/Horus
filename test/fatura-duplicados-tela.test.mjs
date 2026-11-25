// Fatura do cartão: não lançar duas vezes (como nos extratos): compra já lançada por outra fatura/arquivo e lançamento manual de mesmo valor e data.
// Servidor do grupo 'leitor':  node test/rodar.mjs fatura-duplicados-tela
import fs from 'node:fs'; import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8822', TOK = 'tok-dono-0000000000000000000000000001';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10), mes = hoje.slice(0, 7), dia = (n) => mes + '-' + String(n).padStart(2, '0');
fs.writeFileSync('/tmp/fatura-dupA.csv', ['date,title,amount', `${dia(2)},Supermercado Central,"100,00"`, `${dia(3)},Farmacia Saude Total,"50,00"`, `${dia(4)},Uber *Trip,"30,00"`].join('\n'));
fs.writeFileSync('/tmp/fatura-dupB.csv', ['date,title,amount', `${dia(2)},Supermercado Central,"100,00"`, `${dia(5)},Padaria Nova,"20,00"`, `${dia(6)},Netflix Entretenimento,"39,90"`, `${dia(7)},Lanche Bom,"12,00"`].join('\n'));
const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 1280, height: 1000 } }); await ctx.addCookies([{ name: 'sessao', value: TOK, url: B }]);
const p = await ctx.newPage(); const erros = []; p.on('pageerror', (e) => erros.push(e.message)); await p.route(/fonts\./, (r) => r.abort());
const api = (m, u, b) => p.evaluate(async ([m, u, b]) => (await fetch(u, { method: m, headers: { 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined })).status, [m, u, b]);
await p.goto(B + '/'); await p.waitForTimeout(2500);
await p.evaluate(() => document.querySelector('#drawer [data-tab="extratos"]').click()); await p.waitForTimeout(1000);
await p.evaluate(() => { document.getElementById('impArq').style.display = 'block'; });
const cartao = () => p.evaluate(() => (document.getElementById('fatCartao') || { innerText: '' }).innerText.replace(/\s+/g, ' '));
const linhasCartao = () => p.evaluate(async () => (await (await fetch('/api/db/extratos')).json()).docs.map((d) => d.data).filter((d) => d.tipo === 'diaadia' && d.origem === 'cartao').flatMap((d) => d.linhas));
// 1ª fatura: lança tudo
await p.setInputFiles('#impArq', '/tmp/fatura-dupA.csv'); await p.waitForTimeout(3000);
let t = await cartao(); check(!/Já lançados — não serão lançados de novo/.test(t), '1ª fatura: nada repetido, nada marcado como já lançado');
await p.fill('#fatCartao input[type=date]', dia(20)); await p.dispatchEvent('#fatCartao input[type=date]', 'change'); await p.waitForTimeout(300);
await p.click('#fatCartao [data-fat="confirmar"]'); await p.waitForTimeout(2000);
let l = await linhasCartao(); check(l.length === 3 && l.every((x) => x.h), '1ª fatura lançada: 3 lançamentos, cada um com a impressão digital (dia, nome, valor) guardada');
// lançamento manual: Netflix R$ 39,90 já pago no dia 6
check(await api('PUT', '/api/db/despesas/man1', { nome: 'Netflix', coluna: 'pf', tipo: 'unica', categoria: 'outros', valor: 39.9, data: dia(6), mesReferencia: mes, pago: true, dataPagamento: dia(6), pagoEm: new Date().toISOString(), parciais: [], ativa: true, pagamentos: {}, criadoEm: new Date().toISOString() }) === 200, 'despesa manual "Netflix" R$ 39,90 paga no dia 6 criada');
await p.reload(); await p.waitForTimeout(2500);
await p.evaluate(() => document.querySelector('#drawer [data-tab="extratos"]').click()); await p.waitForTimeout(1000);
await p.evaluate(() => { document.getElementById('impArq').style.display = 'block'; });
// 2ª fatura (fatura aberta exportada de novo + compras novas)
await p.setInputFiles('#impArq', '/tmp/fatura-dupB.csv'); await p.waitForTimeout(3000);
t = await cartao();
if (process.env.DEBUG_FT) console.log('DEBUG-T', t.slice(0, 1500));
check(/Já lançados — não serão lançados de novo \(2/i.test(t), '2ª fatura: 2 lançamentos já existem e não serão lançados de novo');
check(/Supermercado Central/.test(t) && /mesmo dia, nome e valor/.test(t), 'a compra repetida de outra fatura é apontada ("mesmo dia, nome e valor")');
check(/Netflix Entretenimento/.test(t) && /despesa paga ou aporte/.test(t), 'a compra que já existe como despesa paga no app (mesmo valor e data) é apontada');
await p.fill('#fatCartao input[type=date]', dia(21)); await p.dispatchEvent('#fatCartao input[type=date]', 'change'); await p.waitForTimeout(300);
await p.click('#fatCartao [data-fat="confirmar"]'); await p.waitForTimeout(2200);
l = await linhasCartao();
check(l.length === 5 && l.filter((x) => /Supermercado Central/.test(x.t)).length === 1 && !l.some((x) => /Netflix/.test(x.t)) && l.some((x) => /Padaria Nova/.test(x.t)) && l.some((x) => /Lanche Bom/.test(x.t)), 'só as 2 compras novas entraram (total 5 lançamentos): sem Supermercado repetido nem Netflix duplicada (' + l.map((x) => x.t).join(' | ') + ')');
check(erros.length === 0, 'sem erros de script' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
