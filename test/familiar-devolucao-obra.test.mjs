// Familiar: a DEVOLUÇÃO de sobra da obra (Construção → conta dele) e o APORTE na obra mexem no saldo calculado (que não é mais informado).
// Servidor do grupo 'familiar':  node test/rodar.mjs familiar-devolucao-obra
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8820', TOK = 'tok-fam-fin-0000000000000000000000000007';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 1280, height: 1000 } }); await ctx.addCookies([{ name: 'sessao', value: TOK, url: B }]);
const p = await ctx.newPage(); const erros = []; p.on('pageerror', (e) => erros.push(e.message)); await p.route(/fonts\./, (r) => r.abort());
const api = (m, u, b) => p.evaluate(async ([m, u, b]) => { const r = await fetch(u, { method: m, headers: { 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }); return r.status; }, [m, u, b]);
await p.goto(B + '/'); await p.waitForTimeout(2000);
const hero = async () => { await p.reload(); await p.waitForTimeout(2200); await p.evaluate(() => document.querySelector('#drawer .dr-it[data-fin="pf"]').click()); await p.waitForTimeout(1200); return p.evaluate(() => document.querySelector('.fp-hero').innerText.replace(/\s+/g, ' ')); };
let h = await hero();
check(/Saldo atual R\$ 0,00/i.test(h), 'sem nada lançado: saldo atual R$ 0,00 (' + h.slice(0, 40) + ')');
// devolução de R$ 1.000,00 da obra para ele
check(await api('PUT', '/api/db/obraMov/dev1', { tipo: 'retirada', destino: 'pf', data: hoje, valor: 1000, obs: 'sobra da fase 1', criadoEm: new Date().toISOString() }) === 200, 'devolução de R$ 1.000,00 gravada (Construção → ele)');
h = await hero(); check(/Saldo atual R\$ 1\.000,00/i.test(h), 'a devolução SOMA no saldo dele: R$ 1.000,00 (' + h.slice(0, 40) + ')');
// aporte dele na obra de R$ 300,00
check(await api('PUT', '/api/db/obraMov/apo1', { tipo: 'aporte', origem: 'pf', data: hoje, valor: 300, obs: 'material', criadoEm: new Date().toISOString() }) === 200, 'aporte de R$ 300,00 na obra gravado');
h = await hero(); check(/Saldo atual R\$ 700,00/i.test(h), 'o aporte na obra TIRA do saldo dele: R$ 700,00 (' + h.slice(0, 40) + ')');
// data futura não conta ainda
const fut = new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10);
await api('PUT', '/api/db/obraMov/dev2', { tipo: 'retirada', destino: 'pf', data: fut, valor: 500, obs: 'futura', criadoEm: new Date().toISOString() });
h = await hero(); check(/Saldo atual R\$ 700,00/i.test(h), 'devolução com data futura ainda não entra no saldo');
// Divisão do salário (Opção A): "+ Devolvido da obra no mês" em linha separada, fora dos percentuais, somando no livre
await api('DELETE', '/api/db/obraMov/dev2');   // a devolução futura (se cair no mesmo mês) atrapalharia a conta do exemplo
await api('PUT', '/api/db/receitasManuais/sal1', { coluna: 'pf', descricao: 'Salário', recorrente: false, valor: 13000, data: hoje, mesReferencia: hoje.slice(0, 7), criadoEm: new Date().toISOString() });
await api('PUT', '/api/db/despesas/dsp1', { nome: 'Escola', coluna: 'pf', tipo: 'unica', categoria: 'outros', valor: 9000, data: hoje, mesReferencia: hoje.slice(0, 7), pago: true, dataPagamento: hoje, pagoEm: new Date().toISOString(), parciais: [], ativa: true, pagamentos: {}, criadoEm: new Date().toISOString() });
await p.reload(); await p.waitForTimeout(2200);
await p.evaluate(() => document.querySelector('#drawer .dr-it[data-fin="geral"]').click()); await p.waitForTimeout(1200);
const dvT = await p.evaluate(() => document.getElementById('bodyFinanceiro').innerText.replace(/\s+/g, ' '));
check(/Salário e entradas do mês R\$ 13\.000,00/i.test(dvT), 'Divisão: a base é só o salário (R$ 13.000,00), a devolução não entra');
check(/Livre do salário R\$ 3\.700,00/.test(dvT) && /\+ Devolvido da obra no mês .* R\$ 1\.000,00/.test(dvT) && /Livre para o mês R\$ 4\.700,00/.test(dvT), 'Opção A (13.000 − 9.000 de despesas − 300 de aporte na obra): "Livre do salário" R$ 3.700,00, linha "+ Devolvido da obra no mês" R$ 1.000,00 e "Livre para o mês" R$ 4.700,00 (' + (dvT.match(/Livre do salário.{0,260}/) || [''])[0] + ')');
check(!/Devolvido da obra no mês/.test(await (async () => { await api('DELETE', '/api/db/obraMov/dev1'); await api('DELETE', '/api/db/obraMov/dev2'); await p.reload(); await p.waitForTimeout(2200); await p.evaluate(() => document.querySelector('#drawer .dr-it[data-fin="geral"]').click()); await p.waitForTimeout(1200); return p.evaluate(() => document.getElementById('bodyFinanceiro').innerText.replace(/\s+/g, ' ')); })()), 'sem devolução no mês: a linha some e o livre volta a ser só "Livre para o mês"');
await api('PUT', '/api/db/obraMov/dev1', { tipo: 'retirada', destino: 'pf', data: hoje, valor: 1000, obs: 'sobra da fase 1', criadoEm: new Date().toISOString() });
await p.reload(); await p.waitForTimeout(2200);
await p.evaluate(() => document.querySelector('#drawer .dr-it[data-fin="pf"]').click()); await p.waitForTimeout(1200);
await p.click('[data-ver-lanc="pf"]'); await p.waitForTimeout(800);
const lanc = await p.evaluate(() => document.getElementById('overlayLanc') ? document.getElementById('overlayLanc').innerText.replace(/\s+/g, ' ') : document.body.innerText.replace(/\s+/g, ' '));
check(/Devolução de sobra da obra/.test(lanc) && /Saldo atual \(calculado\)/.test(lanc), 'em "Lançamentos" a devolução aparece (Devolução de sobra da obra) e o saldo é o calculado');
check(erros.length === 0, 'sem erros de script' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
