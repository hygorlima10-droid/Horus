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

const visivel = (pg, sel) => pg.evaluate((q) => { const e = document.querySelector(q); return !!e && e.offsetParent !== null; }, sel);
const p = await abrir('fam2');
check(JSON.stringify(await itensMenu(p)) === JSON.stringify(['Início', 'Visão geral', 'Divisão do salário', 'Salário e fixos', 'Patrimônio e metas', 'Orçamento', 'Análises', 'Construção', 'Extratos do banco', 'Minha conta', 'Sair']), 'menu dele: Finanças só PF + Construção + Extratos, sem Fechamento do mês (' + (await itensMenu(p)).join(' | ') + ')');
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
check(!(await p.evaluate(() => document.querySelector('[data-ffn="plano"]'))) && !/Ajustar plano|plano \d+%/.test(await p.evaluate(() => document.getElementById('bodyFinanceiro').innerText)), 'a Divisão do salário não tem plano em % nem botão "Ajustar plano" (a reserva e as metas têm o alvo no próprio cadastro)');


// Patrimônio e metas: reserva com valor-alvo fixo digitado por ele; nada de PJ, "PF + PJ" nem "Alvo automático"
await aba(p, 'patrimonio');
await p.evaluate(() => { const b = [...document.querySelectorAll('#bodyFinanceiro button, #bodyFinanceiro .btn')].find((x) => /nova meta|criar meta|adicionar meta/i.test(x.textContent)); if (b) b.click(); }); await p.waitForTimeout(700);
check(await visivel(p, '#metaNomeInput'), 'o botão de nova meta abre o formulário de meta');
await p.fill('#metaNomeInput', 'Reserva de emergência'); await p.click('#segMetaTipo [data-value="reserva"]'); await p.waitForTimeout(300);
const fm = await p.evaluate(() => document.getElementById('overlayMeta').innerText.replace(/\s+/g, ' '));
check(await visivel(p, '#metaAlvoInput') && /Valor-alvo da reserva/.test(fm) && !/PJ|PF \+ PJ|CDB próprio|automático/i.test(fm), 'meta de reserva do familiar: campo "Valor-alvo da reserva" e nenhum resquício de PJ/PF ou alvo automático (' + fm.slice(0, 200) + ')');
await p.click('#saveBtnMeta'); await p.waitForTimeout(500);
check(/Informe o valor-alvo da reserva/.test(await p.evaluate(() => document.getElementById('formErrorMeta').textContent)), 'reserva sem valor-alvo: pede o valor');
await p.fill('#metaAlvoInput', '12000'); await p.fill('#metaInicialInput', '5000'); await p.click('#saveBtnMeta'); await p.waitForTimeout(1500);
const pat = await p.evaluate(() => document.getElementById('bodyFinanceiro').innerText.replace(/\s+/g, ' '));
check(/Reserva de emergência/.test(pat) && /41,7% do alvo de R\$ 12\.000,00/.test(pat) && /faltam R\$ 7\.000,00/.test(pat), 'a reserva mostra o alvo fixo dele: 41,7% de R$ 12.000,00, faltam R$ 7.000,00');
check(!/\bPJ\b|PF \+ PJ|Alvo automático|despesas fixas \(/.test(pat), 'Patrimônio e metas do familiar: sem PJ nem "PF + PJ" nem "Alvo automático"');
for (const k of ['resumo', 'geral', 'pf', 'orcamento']) { const tx = await aba(p, k); check(!/\bPJ\b|PF \+ PJ|Hygor \(PJ\)/.test(tx), 'aba ' + k + ' do familiar: sem resquício de PJ' + (/\bPJ\b/.test(tx) ? ': ' + (tx.match(/.{30}\bPJ\b.{30}/) || [''])[0] : '')); }

await aba(p, 'geral');
// "Dinheiro da obra a receber" mora na Divisão do salário (não mais nas Análises) e funciona de lá
const gtxt = () => p.evaluate(() => document.getElementById('finGeral').innerText.replace(/\s+/g, ' '));
check(/Dinheiro da obra a receber/.test(await gtxt()) && await visivel(p, '#anObraPickerBtn'), 'Divisão do salário: tem o cartão "Dinheiro da obra a receber"');
await p.click('#anObraPickerBtn'); await p.waitForTimeout(600);
check(/Escolha a entrada que é para a obra/.test(await gtxt()), 'o botão "Marcar uma entrada como dinheiro da obra" abre a lista, dentro da Divisão do salário');
await p.click('#anObraPickerBtn'); await p.waitForTimeout(400);
await p.setViewportSize({ width: 390, height: 800 }); await p.waitForTimeout(500);
check(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no celular a Divisão do salário cabe na tela (nada sai para fora)');
await p.setViewportSize({ width: 1280, height: 900 }); await p.waitForTimeout(300);

// visão geral e patrimônio com o salário
const rs = await aba(p, 'resumo');
check(/VAI (SOBRAR|FALTAR) NO FIM DO MÊS/i.test(rs), 'visão geral: "vai sobrar/faltar no fim do mês"');
if (FOTO) await p.screenshot({ path: FOTO + '/fin-resumo.png' });

// extratos: conta só pessoal
await p.evaluate(() => document.querySelector('#drawer [data-tab="extratos"]').click()); await p.waitForTimeout(900);
const ex = await p.evaluate(() => document.getElementById('bodyExtratos').innerText.replace(/\s+/g, ' '));
check(/PDF, foto ou arquivo OFX, de qualquer banco/.test(ex) && !/Itaú|Sicoob/.test(ex), 'extratos: texto geral (qualquer banco)');

// análises: sem PJ (o fechamento do mês não existe para o familiar)
for (const [nome, sel] of [['análises', '[data-tab="analises"]']]) {
  await p.evaluate((q) => { document.querySelector('#drawer ' + q).click(); }, sel); await p.waitForTimeout(1400);
  const t = await p.evaluate(() => { const o = [...document.querySelectorAll('.overlay.show')].map((e) => e.innerText).join(' || '); return (o || document.getElementById('bodyAnalises').innerText).replace(/\s+/g, ' '); });
  if (process.env.DEBUG_FT) console.log('DEBUG-' + nome, t.slice(0, 900));
  check(!/\bPJ\b|pró-labore|honorários|Honorários|alvará|Alvará/.test(t), nome + ' sem PJ, pró-labore, honorários nem alvarás' + (/\bPJ\b|ró-labore|onorários|lvará/.test(t) ? ': ' + (t.match(/.{40}(\bPJ\b|ró-labore|onorários|lvará).{40}/) || [''])[0] : ''));
  await p.keyboard.press('Escape'); await p.evaluate(() => document.querySelectorAll('.overlay.show').forEach((e) => e.classList.remove('show')));
}
await p.evaluate(() => document.querySelector('#drawer [data-tab="analises"]').click()); await p.waitForTimeout(900);
await p.evaluate(() => { const b = document.querySelector('[data-an-periodo="fut"]'); if (b) b.click(); }); await p.waitForTimeout(900);
check(!/Dinheiro da obra a receber/.test(await p.evaluate(() => document.getElementById('bodyAnalises').innerText)) && /Principais entradas e saídas previstas/.test(await p.evaluate(() => document.getElementById('bodyAnalises').innerText)), 'Análises (futuro): sem o cartão "Dinheiro da obra a receber", que foi para a Divisão do salário');
// Atalho do iPhone aparece em Minha conta (só com Finanças)
await p.evaluate(() => document.querySelector('#drawer [data-tab="configuracoes"]').click()); await p.waitForTimeout(900);
check(await p.evaluate(() => !!document.querySelector('#cfWrap [data-cf="atalho"]')), 'Minha conta: tem a linha "Atalho do iPhone"');
check(!(await p.evaluate(() => document.getElementById('cfWrap').innerText)).match(/Audiências no calendário/) && /vencimentos da obra e das contas/.test(await p.evaluate(() => document.getElementById('cfWrap').innerText)), 'Minha conta: sem "Audiências no calendário" e com avisos só de obra e contas');
await p.click('#cfWrap [data-cf="notif"]'); await p.waitForTimeout(1200);
const nt = await p.evaluate(() => document.getElementById('ntCorpo').innerText.replace(/\s+/g, ' '));
check(/Vencimentos de hoje/.test(nt) && !/Prazo ou audiência|Publicações novas|Repasses|responsável/.test(nt), 'tela de avisos do celular: só os vencimentos (sem prazos, publicações, repasses): ' + nt.slice(0, 160));
await p.evaluate(() => document.querySelectorAll('.overlay.show').forEach((e) => e.classList.remove('show')));
await p.click('#cfWrap [data-cf="atalho"]'); await p.waitForTimeout(1200);
check(/Atalho do iPhone/.test(await p.evaluate(() => document.body.innerText)) && p.recusados.length === 0, 'o Atalho abre para ele, sem pedido recusado');
check(p.erros.length === 0, 'sem erros de script' + (p.erros.length ? ': ' + p.erros.join(' | ') : ''));
check(p.recusados.length === 0, 'nenhum pedido recusado' + (p.recusados.length ? ': ' + [...new Set(p.recusados)].join(' | ') : ''));
await br.close();
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
