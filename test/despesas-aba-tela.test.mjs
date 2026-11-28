// Sub-aba Despesas (familiar): fica depois de "Salário e fixos"; o lançamento saiu de "Salário e fixos" (ficou a linha-resumo com "Ver em Despesas").
// Servidor do grupo 'familiar':  node test/rodar.mjs despesas-aba-tela
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8820', TOK = 'tok-fam-fin-0000000000000000000000000007';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 1280, height: 1000 } }); await ctx.addCookies([{ name: 'sessao', value: TOK, url: B }]);
const p = await ctx.newPage(); const erros = []; p.on('pageerror', (e) => erros.push(e.message)); await p.route(/fonts\./, (r) => r.abort());
await p.goto(B + '/'); await p.waitForTimeout(2500);
const aba = async (k) => { await p.evaluate((x) => document.querySelector('#drawer .dr-it[data-fin="' + x + '"]').click(), k); await p.waitForTimeout(900); };
const vis = (s) => p.evaluate((x) => { const e = document.querySelector(x); return !!e && e.offsetParent !== null; }, s);
await aba('pf');
const barra = await p.evaluate(() => [...document.querySelectorAll('[data-mf-aba]')].map((b) => b.textContent.trim()).join('|'));
check(/Salário e fixos\|Despesas\|/.test(barra), 'a sub-aba Despesas fica logo depois de "Salário e fixos" (' + barra + ')');
check(await p.evaluate(() => /Ver em Despesas/.test(document.getElementById('colunaFinanceiroPf').innerText)), 'em "Salário e fixos" ficou a linha-resumo com "Ver em Despesas"');
check(!(await vis('[data-nova-despesa]')), 'o botão de lançar despesa não está mais em "Salário e fixos"');
await p.click('[data-dsp="ir"]'); await p.waitForTimeout(900);
check(await vis('#finDespesas') && await vis('#finDespesas [data-nova-despesa]'), 'o botão leva à aba Despesas, onde está o lançamento');
const t = () => p.evaluate(() => document.getElementById('finDespesas').innerText.replace(/\s+/g, ' '));
check(/gasto no mês/i.test(await t()) && /cadastradas/i.test(await t()), 'a aba mostra o gasto do mês e a divisão cadastradas / conta / cartão');
check(!/PF e PJ/.test(await t()), 'perfil familiar não tem o filtro PF/PJ');
await p.click('[data-dsp="nova"]'); await p.waitForSelector('#despesaNomeInput');
await p.fill('#despesaNomeInput', 'Escola'); await p.fill('#despesaValorInput', '800').catch(() => {}); await p.fill('#despesaDiaInput', '5').catch(() => {});
await p.click('#saveBtnDespesa'); await p.waitForTimeout(1500);
check(/Escola/.test(await t()), '“+ Nova despesa” lança na própria aba e a despesa aparece nela');
await p.click('[data-dsp-f="origem"][data-v="conta"]'); await p.waitForTimeout(400);
check(!/Escola/.test(await t()), 'filtro Origem = Conta (extrato) esconde as cadastradas');
await p.click('[data-dsp-f="origem"][data-v="tudo"]'); await p.waitForTimeout(400);
check(/Escola/.test(await t()), 'filtro Tudo mostra de novo');
// conta (extrato) e cartão aparecem na aba, com selo de origem; o total soma tudo
const mm = new Date().toISOString().slice(0, 7);
await p.evaluate(async ({ mm }) => {
  const put = (id, b) => fetch('/api/db/extratos/' + id, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
  await put('dd_' + mm + '_c', { tipo: 'diaadia', mes: mm, conta: 'c', coluna: 'pf', cats: { Mercado: { v: 200, n: 1 } }, linhas: [{ id: 'z1', d: mm + '-02', t: 'Supermercado Teste', v: 200, c: 'Mercado', h: 'h1' }], atualizadoEm: Date.now() });
  await put('dd_' + mm + '_k', { tipo: 'diaadia', mes: mm, conta: 'k', coluna: 'pf', origem: 'cartao', cats: { Outros: { v: 50, n: 1 } }, linhas: [{ id: 'z2', d: mm + '-03', t: 'Loja do Cartao', v: 50, c: 'Outros', h: 'h2' }], atualizadoEm: Date.now() });
}, { mm });
await p.reload(); await p.waitForTimeout(2500); await aba('despesas');
let tt = await t();
check(/Supermercado Teste/.test(tt) && /Loja do Cartao/.test(tt), 'as linhas da conta e do cartão aparecem na aba Despesas');
check(/R\$ 200,00/.test(tt) && /R\$ 50,00/.test(tt) && /Cartão/.test(tt) && /Conta/.test(tt), 'com valor e selo de origem (Conta / Cartão)');
await p.click('[data-dsp-f="origem"][data-v="cartao"]'); await p.waitForTimeout(400); tt = await t();
check(/Loja do Cartao/.test(tt) && !/Supermercado Teste/.test(tt), 'filtro Cartão mostra só as compras do cartão');
await p.click('[data-dsp-f="origem"][data-v="tudo"]'); await p.fill('#dspBusca', 'superm'); await p.waitForTimeout(400); tt = await t();
check(/Supermercado Teste/.test(tt) && !/Loja do Cartao/.test(tt), 'a busca filtra conta e cartão por nome');
await aba('pf');
check(/Despesas do mês/.test(await p.evaluate(() => document.getElementById('colunaFinanceiroPf').innerText)) && /Pago/.test(await p.evaluate(() => document.getElementById('colunaFinanceiroPf').innerText)), 'a linha-resumo em Salário e fixos mostra pago e pendente');
// editar uma despesa de fatura de cartão pelo formulário NÃO pode soltar o vínculo com a fatura (senão ela voltaria a contar como gasto)
await p.evaluate(async (mm) => { await fetch('/api/db/despesas/dcfx', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome: 'Fatura Editavel final 1234', coluna: 'pf', tipo: 'unica', categoria: 'cartao', valor: 321, data: mm + '-20', mesReferencia: mm, pago: false, faturaId: 'dcm_vinculo', faturaChave: 'k', origemDocumento: true, criadoEm: '2026-01-01T00:00:00.000Z' }) }); }, mm);
await p.reload(); await p.waitForTimeout(2500); await aba('despesas');
await p.evaluate(() => document.querySelector('[data-menu-toggle="dcfx"]').click()); await p.waitForTimeout(400);
await p.evaluate(() => document.querySelector('[data-despesa-editar="dcfx"]').click()); await p.waitForSelector('#despesaNomeInput');
await p.fill('#despesaNomeInput', 'Fatura Editavel final 1234 (ajustada)'); await p.click('#saveBtnDespesa'); await p.waitForTimeout(1500);
const dd = await p.evaluate(async () => (await (await fetch('/api/db/despesas')).json()).docs.find((d) => d.id === 'dcfx')?.data || {});
check(/ajustada/.test(dd.nome) && dd.faturaId === 'dcm_vinculo' && dd.faturaChave === 'k' && dd.origemDocumento === true, 'editar a despesa da fatura pelo formulário mantém o vínculo com a fatura (faturaId)');
check(erros.length === 0, 'sem erros de script' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
