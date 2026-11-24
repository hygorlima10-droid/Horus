// Finanças pessoais do familiar (só PF): menu, sub-abas sem PJ, salário recorrente, divisão do salário, categorias, parcela do consórcio no caixa.
// Servidor com banco novo (grupo 'familiar'):  node test/rodar.mjs familiar-fin-tela
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8820', TOK = { fam2: 'tok-fam-fin-0000000000000000000000000007', dono: 'tok-dono-0000000000000000000000000001' };
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const br = await chromium.launch();
async function abrir(quem, larg = 1280) { const ctx = await br.newContext({ viewport: { width: larg, height: 900 } }); await ctx.addCookies([{ name: 'sessao', value: TOK[quem], url: B }]); const page = await ctx.newPage(); page.erros = []; page.recusados = []; page.on('pageerror', (e) => page.erros.push(e.message)); page.on('response', (r) => { if (r.url().startsWith(B + '/api/') && r.status() >= 400 && r.status() !== 404) page.recusados.push(r.status() + ' ' + r.url().replace(B, '')); }); await page.goto(B + '/'); await page.waitForTimeout(1800); return page; }
const itensMenu = (p) => p.evaluate(() => [...document.querySelectorAll('#drawer .dr-it')].filter((e) => e.offsetParent !== null).map((e) => e.textContent.trim().replace(/\s+/g, ' ')));
const aba = async (p, k) => { await p.evaluate((x) => document.querySelector('#drawer .dr-it[data-fin="' + x + '"]').click(), k); await p.waitForTimeout(900); return p.evaluate(() => document.getElementById('bodyFinanceiro').innerText.replace(/\s+/g, ' ')); };
const FOTO = process.env.FOTO;

const p = await abrir('fam2');
check(JSON.stringify(await itensMenu(p)) === JSON.stringify(['Visão geral', 'Divisão do salário', 'Salário e fixos', 'Patrimônio e metas', 'Orçamento', 'Análises', 'Construção', 'Extratos do banco', 'Fechamento do mês', 'Minha conta', 'Sair']), 'menu dele: Finanças só PF + Construção + Extratos + Fechamento (' + (await itensMenu(p)).join(' | ') + ')');
for (const k of ['resumo', 'geral', 'pf', 'patrimonio', 'orcamento']) {
  const t = await aba(p, k);
  check(!/\bPJ\b|pró-labore|Pró-labore|honorários|Recebi R\$/.test(t), 'aba ' + k + ' sem PJ, pró-labore nem honorários' + (/\bPJ\b|ró-labore|onorários/.test(t) ? ': ' + (t.match(/.{30}(\bPJ\b|ró-labore|onorários).{30}/) || [''])[0] : ''));
}
check((await p.evaluate(() => document.getElementById('headFinanceiro').innerText.replace(/\s+/g, ' '))).includes('Salário e fixos') && !/\bPJ\b/.test(await p.evaluate(() => document.getElementById('headFinanceiro').innerText)), 'as sub-abas no topo: sem PJ, com "Salário e fixos"');

// salário recorrente
await aba(p, 'pf');
await p.click('[data-nova-receita="pf"]'); await p.waitForSelector('#receitaDescInput');
check(!(await p.evaluate(() => { const f = document.getElementById('segReceitaColuna').closest('.field'); return f.offsetParent !== null; })), 'receita: sem a escolha PF/PJ');
await p.fill('#receitaDescInput', 'Salário'); await p.click('#segReceitaFreq [data-value="recorrente"]'); await p.fill('#receitaValorInput', '9800'); await p.click('#saveBtnReceita'); await p.waitForTimeout(1200);
// despesa fixa e uma única com categoria dos filhos
await p.click('[data-nova-despesa="pf"]'); await p.waitForSelector('#despesaNomeInput');
await p.fill('#despesaNomeInput', 'Escola'); await p.click('#segDespesaTipo [data-value="fixa"]'); await p.fill('#despesaValorInput', '1200'); await p.fill('#despesaDiaInput', '5');
await p.click('#catPickBtn'); await p.waitForTimeout(500);
const lista = await p.evaluate(() => document.getElementById('catPick').innerText.replace(/\s+/g, ' '));
check(/Médico dos filhos/.test(lista) && /Remédios dos filhos/.test(lista) && /Fraldas e afins/.test(lista) && /Consórcio/.test(lista), 'categorias dos filhos e do consórcio disponíveis');
check(!/Anuidade OAB|Custas e despesas processuais|Pró-labore e retiradas|Escritório \(PJ\)/.test(lista), 'sem categorias do escritório nem despesas processuais');
check(!/outro lado/.test(lista), 'sem o atalho "mostrar as do outro lado"');
if (FOTO) await p.screenshot({ path: FOTO + '/fin-categorias.png' });
await p.evaluate(() => { const b = [...document.querySelectorAll('#catPick button')].find((x) => /Educação|Filhos e família/.test(x.innerText)); });
await p.keyboard.press('Escape'); await p.waitForTimeout(300);
await p.evaluate(() => { document.getElementById('saveBtnDespesa').click(); }); await p.waitForTimeout(1200);

// divisão do salário
const dv = await aba(p, 'geral');
check(/Salário e entradas do mês R\$ 9\.800,00/i.test(dv) && /Gastos fixos/.test(dv) && /Livre para o mês/.test(dv), 'a divisão do salário mostra o salário, os gastos fixos e o que sobra: ' + dv.slice(0, 260));
if (FOTO) await p.screenshot({ path: FOTO + '/fin-divisao.png' });
await p.click('[data-ffn="plano"]'); await p.waitForSelector('#of_ffn_fixos'); await p.fill('#of_ffn_fixos', '20'); await p.click('#obraFormSalvar'); await p.waitForTimeout(1200);
check(/plano 20%/.test(await p.evaluate(() => document.getElementById('bodyFinanceiro').innerText)), 'o plano em % é guardado e aparece ao lado');

// visão geral e patrimônio com o salário
const rs = await aba(p, 'resumo');
check(/VAI (SOBRAR|FALTAR) NO FIM DO MÊS/i.test(rs), 'visão geral: "vai sobrar/faltar no fim do mês"');
if (FOTO) await p.screenshot({ path: FOTO + '/fin-resumo.png' });

// extratos: conta só pessoal
await p.evaluate(() => document.querySelector('#drawer [data-tab="extratos"]').click()); await p.waitForTimeout(900);
const ex = await p.evaluate(() => document.getElementById('bodyExtratos').innerText.replace(/\s+/g, ' '));
check(/PDF ou arquivo OFX do seu banco/.test(ex) && !/Itaú|Sicoob|C6/.test(ex), 'extratos: texto geral (qualquer banco)');

// análises e fechamento: sem PJ
for (const [nome, sel] of [['análises', '[data-tab="analises"]'], ['fechamento', '#abrirFechamentoBtn']]) {
  await p.evaluate((q) => { document.querySelector('#drawer ' + q).click(); }, sel); await p.waitForTimeout(1400);
  const t = await p.evaluate(() => { const o = [...document.querySelectorAll('.overlay.show')].map((e) => e.innerText).join(' || '); return (o || document.getElementById('bodyAnalises').innerText).replace(/\s+/g, ' '); });
  if (process.env.DEBUG_FT) console.log('DEBUG-' + nome, t.slice(0, 900));
  check(!/\bPJ\b|pró-labore|honorários|Honorários|alvará|Alvará/.test(t), nome + ' sem PJ, pró-labore, honorários nem alvarás' + (/\bPJ\b|ró-labore|onorários|lvará/.test(t) ? ': ' + (t.match(/.{40}(\bPJ\b|ró-labore|onorários|lvará).{40}/) || [''])[0] : ''));
  await p.keyboard.press('Escape'); await p.evaluate(() => document.querySelectorAll('.overlay.show').forEach((e) => e.classList.remove('show')));
}
// Atalho do iPhone aparece em Minha conta (só com Finanças)
await p.evaluate(() => document.querySelector('#drawer [data-tab="configuracoes"]').click()); await p.waitForTimeout(900);
check(await p.evaluate(() => !!document.querySelector('#cfWrap [data-cf="atalho"]')), 'Minha conta: tem a linha "Atalho do iPhone"');
await p.click('#cfWrap [data-cf="atalho"]'); await p.waitForTimeout(1200);
check(/Atalho do iPhone/.test(await p.evaluate(() => document.body.innerText)) && p.recusados.length === 0, 'o Atalho abre para ele, sem pedido recusado');
check(p.erros.length === 0, 'sem erros de script' + (p.erros.length ? ': ' + p.erros.join(' | ') : ''));
check(p.recusados.length === 0, 'nenhum pedido recusado' + (p.recusados.length ? ': ' + [...new Set(p.recusados)].join(' | ') : ''));
await br.close();
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
