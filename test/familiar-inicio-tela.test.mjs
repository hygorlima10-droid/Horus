// Início do familiar: saudação + Central de atenção com os próximos vencimentos (despesas pessoais, salário previsto e itens da obra), no computador e no celular.
// Servidor do grupo 'familiar':  node test/rodar.mjs familiar-inicio-tela
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8820', TOK = { fam: 'tok-fam-obra-000000000000000000000000006', fam2: 'tok-fam-fin-0000000000000000000000000007' };
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const br = await chromium.launch();
async function abrir(quem, larg = 1280, alt = 900) { const ctx = await br.newContext({ viewport: { width: larg, height: alt } }); await ctx.addCookies([{ name: 'sessao', value: TOK[quem], url: B }]); const page = await ctx.newPage(); page.erros = []; page.recusados = []; page.on('pageerror', (e) => page.erros.push(e.message)); page.on('response', (r) => { if (r.url().startsWith(B + '/api/') && r.status() >= 400 && r.status() !== 404) page.recusados.push(r.status() + ' ' + r.url().replace(B, '')); }); await page.goto(B + '/'); await page.waitForTimeout(2200); return page; }
const itens = (p) => p.evaluate(() => [...document.querySelectorAll('#fmiCentral .fmi-it')].map((e) => e.innerText.replace(/\s+/g, ' ').trim()));
const api = (p, m, u, b) => p.evaluate(async ([m, u, b]) => { const r = await fetch(u, { method: m, headers: { 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }); return r.status; }, [m, u, b]);
const iso = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10), hoje = iso(0);

const p = await abrir('fam2');
check((await p.locator('#tituloTela').innerText()) === 'Início', 'o familiar abre no Início');
check(/Bo(m dia|a tarde|a noite),/.test(await p.evaluate(() => document.getElementById('iniSauda').innerText)), 'saudação do período, com o primeiro nome');
const corpo = await p.evaluate(() => document.getElementById('bodyInicio').innerText.replace(/\s+/g, ' '));
check(/Central de atenção/.test(corpo) && !/Iniciais|Divisão do mês|Honorários|Extratos do banco|Prazos/.test(corpo), 'só a saudação e a Central de atenção (nada do escritório nem da divisão da PJ)');
check(/Tudo em dia/.test(await p.evaluate(() => document.getElementById('fmiCentral').innerText)), 'sem nada vencendo: "Tudo em dia ✓"');
// dados: despesas pessoais, salário previsto e a obra (consórcio com parcela vencendo hoje)
const desp = (id, nome, valor, data) => ({ nome, coluna: 'pf', tipo: 'unica', categoria: 'outros', valor, data, mesReferencia: data.slice(0, 7), pago: false, dataPagamento: null, parciais: [], valorPadrao: null, diaVencimento: null, ativa: true, pausadaAPartirDeMes: null, pagamentos: {} });
await api(p, 'PUT', '/api/db/despesas/i1', desp('i1', 'Energia elétrica', 412.87, iso(-2))); await api(p, 'PUT', '/api/db/despesas/i2', desp('i2', 'Escola', 1200, iso(11))); await api(p, 'PUT', '/api/db/despesas/i3', desp('i3', 'Plano de saúde', 350, iso(25)));
await api(p, 'PUT', '/api/db/receitasManuais/is1', { coluna: 'pf', descricao: 'Salário (contracheque)', recorrente: true, valorPadrao: 2847.03, data: hoje.slice(0, 7) + '-01', mesReferencia: hoje.slice(0, 7), recebimentos: {}, pausadaAPartirDeMes: null, ccqSalario: true });
await p.evaluate(() => document.querySelector('#drawer [data-tab="obra"]').click()); await p.waitForTimeout(900);
await p.click('button:has-text("Criar a obra")'); await p.waitForSelector('#of_ftipo');
await p.fill('#of_nome', 'Casa'); await p.fill('#of_orc', '320000'); await p.selectOption('#of_fstatus', 'aprovado'); await p.fill('#of_fval', '200000'); await p.fill('#of_fprazo', '180'); await p.fill('#of_cparcela', '1350'); await p.fill('#of_cdia', String(Math.min(28, +hoje.slice(8, 10)))); await p.fill('#of_etnome', 'Fundação'); await p.fill('#of_etorc', '30000'); await p.click('#obraFormSalvar'); await p.waitForTimeout(2000);
await p.evaluate(() => document.querySelector('#drawer [data-tab="inicio"]').click()); await p.waitForTimeout(1500);
let l = await itens(p), t = l.join(' | ');
check(l.length >= 4, 'a central lista os vencimentos (' + l.length + '): ' + t.slice(0, 260));
check(/Energia elétrica Pessoal atrasada há 2 dias R\$ 412,87/.test(l[0] || ''), 'a despesa atrasada vem primeiro: "atrasada há 2 dias" (R$ 412,87)');
check(l.some((x) => /Parcela do consórcio Obra/.test(x)), 'a parcela do consórcio aparece com a etiqueta Obra');
check(l.some((x) => /Escola Pessoal vence em 11 dias R\$ 1\.200,00/.test(x)), 'despesa pessoal que vence em 11 dias');
check(l.some((x) => /Salário \(contracheque\) A receber .*\+ R\$ 2\.847,03/.test(x)), 'o salário previsto aparece como "A receber" com + R$ 2.847,03');
check(await p.evaluate(() => !!document.querySelector('#fmiCentral .fmi-d.atr') && !!document.querySelector('#fmiCentral .fmi-w.atr')), 'a atrasada fica em vermelho');
check(!/Plano de saúde/.test(t), 'o que vence só em 25 dias fica de fora (janela de 15 dias)');
// filtros e janela
check(await p.evaluate(() => document.querySelectorAll('#fmiCentral [data-fmi="filtro"]').length === 3), 'com os dois módulos: filtros Tudo, Pessoal e Obra');
await p.click('[data-fmi="filtro"][data-v="obra"]'); await p.waitForTimeout(400); l = await itens(p);
check(l.length >= 1 && l.every((x) => /Obra/.test(x)), 'filtro Obra: só os itens da obra (' + l.length + ')');
await p.click('[data-fmi="filtro"][data-v="pessoal"]'); await p.waitForTimeout(400); l = await itens(p);
check(l.length >= 3 && l.every((x) => !/ Obra /.test(x)) && l.some((x) => /Salário/.test(x)), 'filtro Pessoal: despesas e salário, sem a obra');
await p.click('[data-fmi="filtro"][data-v="tudo"]'); await p.click('[data-fmi="janela"][data-v="30"]'); await p.waitForTimeout(400);
check((await itens(p)).some((x) => /Plano de saúde/.test(x)), 'janela de 30 dias: o plano de saúde (25 dias) entra');
await p.click('[data-fmi="janela"][data-v="7"]'); await p.waitForTimeout(400);
check(!(await itens(p)).some((x) => /Escola/.test(x)), 'janela de 7 dias: a escola (11 dias) sai');
await p.click('[data-fmi="janela"][data-v="15"]'); await p.waitForTimeout(300);
const rod = await p.evaluate(() => document.querySelector('#fmiCentral .fmi-rod').innerText.replace(/\s+/g, ' '));
check(/Atrasado: R\$ 412,87/.test(rod) && /Ver tudo em Finanças/.test(rod), 'rodapé com o total atrasado e o atalho para Finanças: ' + rod);
check(await p.evaluate(() => /^[1-9]/.test(document.getElementById('btBadgeInicio').textContent)), 'o atalho do Início mostra quantos já venceram ou vencem hoje');
await p.click('[data-fmi="item"][data-fmi-tipo="despesa"]'); await p.waitForTimeout(800);
check(await p.evaluate(() => document.querySelectorAll('.overlay.show').length > 0 || /pagar|Pagar|pago|Pago/.test(document.body.innerText)), 'tocar numa despesa abre o pagamento dela');
check(p.erros.length === 0 && p.recusados.length === 0, 'sem erros de script nem pedidos recusados' + (p.erros.length ? ': ' + p.erros.join(' | ') : '') + (p.recusados.length ? ': ' + [...new Set(p.recusados)].join(' | ') : ''));

// celular
const c = await abrir('fam2', 390, 800);
const barra = await c.evaluate(() => [...document.querySelectorAll('#btbar .bt-it')].filter((e) => e.offsetParent !== null).map((e) => e.textContent.trim().replace(/\d+$/, '')));
check(barra.join('|') === 'Início|Finanças|Construção|Mais', 'barra de baixo do celular: Início, Finanças, Construção e Mais (' + barra.join('|') + ')');
check(await c.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no celular a tela cabe na largura');
const cl = await itens(c); check(cl.length >= 4 && /Energia elétrica/.test(cl[0]), 'no celular a lista aparece com o mesmo conteúdo (' + cl.length + ' itens)');
if (process.env.FOTO) { await c.screenshot({ path: process.env.FOTO + '/familiar-inicio-celular.png' }); await p.screenshot({ path: process.env.FOTO + '/familiar-inicio-pc.png' }); }
check(c.erros.length === 0, 'celular: sem erros de script');

// só Construção: sem filtros e sem itens pessoais
const o = await abrir('fam'); const ol = await itens(o);
check(await o.evaluate(() => document.querySelectorAll('#fmiCentral [data-fmi="filtro"]').length === 0), 'só com a Construção: sem filtro Tudo/Pessoal/Obra');
check(ol.every((x) => /Obra/.test(x)) && !(await o.evaluate(() => /Ver tudo em Finanças/.test(document.getElementById('fmiCentral').innerText))), 'só com a Construção: nenhum item pessoal nem atalho para Finanças');
check(o.erros.length === 0, 'familiar só com Construção: sem erros de script');
await br.close();
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
