// Testa as Finanças da advogada na tela (cofre pessoal): ela abre PJ/PF/Divisão/Patrimônio/Orçamento/Análises/Extratos com os dados SÓ dela,
// o menu mostra "Ana (PJ)", Construção e Relatório do Murilo continuam fechados, ninguém além dela vê o que ela lança (outro advogado, estagiário, proprietário).
// Servidor individual com banco semeado (grupo 'permissoes'):  node test/rodar.mjs financas-advogado-tela
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8816', TOK = { dono: 'tok-dono-0000000000000000000000000001', ana: 'tok-adv-ana-00000000000000000000000002', bruno: 'tok-adv-bruno-000000000000000000000003', caio: 'tok-est-caio-0000000000000000000000004' };
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const api = async (n, m, pth, b) => { const x = await fetch(B + pth, { method: m, headers: { cookie: 'sessao=' + TOK[n], 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined }); let j = null; try { j = await x.json(); } catch (e) { } return { s: x.status, j }; };
const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10), mes = hoje.slice(0, 7), agora = new Date().toISOString();
const br = await chromium.launch();
async function abrir(quem, largura = 1280) {
  const ctx = await br.newContext({ viewport: { width: largura, height: 900 } }); await ctx.addCookies([{ name: 'sessao', value: TOK[quem], url: B }]);
  const page = await ctx.newPage(); page.recusados = []; page.erros = [];
  page.on('response', (r) => { if (r.url().includes('/api/') && r.status() >= 400) page.recusados.push(r.status() + ' ' + r.url().replace(B, '')); });
  page.on('pageerror', (e) => page.erros.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.|Failed to load resource/.test(m.text())) page.erros.push('console: ' + m.text()); });
  await page.route(/fonts\./, (x) => x.abort());
  await page.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { } });
  await page.goto(B + '/'); await page.waitForFunction(() => window.__horusEu && window.__horusEu.pronto && document.getElementById('mainTabs'), null, { timeout: 60000 }); await page.waitForTimeout(1500);
  return page;
}
// dados só da Ana (pelo servidor, que os põe no cofre dela)
await api('ana', 'PUT', '/api/db/despesas/anad1', { nome: 'Anuidade da OAB da Ana', coluna: 'pj', tipo: 'unica', valor: 777, data: hoje, mesReferencia: mes, categoria: 'impostos', pago: false, criadoEm: agora });
await api('ana', 'PUT', '/api/db/receitasManuais/anar1', { descricao: 'Consultoria da Ana', coluna: 'pj', valor: 2500, mesReferencia: mes, data: hoje, recorrente: false, criadoEm: agora });
await api('ana', 'PUT', '/api/db/saldos/pj', { coluna: 'pj', saldoAtual: 4321, atualizadoEm: agora, historico: [{ valor: 4321, data: agora }] });

console.log('\n— a advogada abre as Finanças dela');
{
  const p = await abrir('ana');
  const menu = await p.evaluate(() => [...document.querySelectorAll('#drawer .dr-it')].filter((e) => e.offsetParent !== null).map((e) => e.textContent.trim()));
  check(menu.some((t) => t.includes('Ana (PJ)')) && !menu.some((t) => t.includes('Hygor (PJ)')), 'o menu mostra "Ana (PJ)" e não "Hygor (PJ)"');
  await p.evaluate(() => document.querySelector('#drawer [data-tab="financeiro"][data-fin="pj"]').click()); await p.waitForTimeout(900);
  check(await p.locator('#bodyFinanceiro').isVisible(), 'a aba Finanças abre para ela');
  check((await p.locator('#tituloTela').innerText()) === 'Ana (PJ)', 'o título da tela é "Ana (PJ)": ' + await p.locator('#tituloTela').innerText());
  const tx = await p.locator('#colunaFinanceiroPj').innerText();
  check(/Anuidade da OAB da Ana/.test(tx) && /4\.321,00/.test(tx), 'a PJ dela mostra a despesa e o saldo dela: ' + tx.replace(/\n/g, ' | ').slice(0, 140));
  check(!/Aluguel/.test(tx), 'a PJ dela não mostra o "Aluguel" do proprietário');
  for (const t of ['analises', 'extratos']) {
    await p.evaluate((t) => document.querySelector('#drawer [data-tab="' + t + '"]').click(), t); await p.waitForTimeout(600);
    check((await p.locator('#tituloTela').innerText()) !== 'Início', 'a tela "' + t + '" abre para ela');
  }
  await p.evaluate(() => { const b = document.createElement('button'); b.setAttribute('data-tab', 'obra'); b.className = 'dr-it'; document.getElementById('mainTabs').appendChild(b); b.click(); b.remove(); }); await p.waitForTimeout(300);
  check((await p.locator('#tituloTela').innerText()) === 'Início', 'a Construção não abre');
  check(!(await p.locator('#abrirRelMuriloBtn').isVisible()) && !(await p.locator('#backupBtn').isVisible()) && !(await p.locator('#abrirLerDocBtn').isVisible()), 'sem Relatório do Murilo, backup nem leitura por foto/PDF (IA)');
  check(p.recusados.length === 0, 'nenhum pedido recusado pelo servidor' + (p.recusados.length ? ': ' + [...new Set(p.recusados)].join(' | ') : ''));
  check(p.erros.length === 0, 'sem erros de JavaScript' + (p.erros.length ? ': ' + p.erros.join(' | ') : ''));
  // lança uma despesa pela tela e confere que foi para o cofre dela
  await api('ana', 'PUT', '/api/db/despesas/anad2', { nome: 'Despesa lançada depois', coluna: 'pj', tipo: 'unica', valor: 10, data: hoje, mesReferencia: mes, categoria: 'outros', pago: true, criadoEm: agora });
  await p.context().close();
}

console.log('\n— a parte dela nos honorários (divisão)');
{
  const A = [{ oab: '11111/GO', nome: 'Ana Advogada' }, { oab: '22222/GO', nome: 'Bruno Advogado' }];
  const base = (cliente, num, extra) => ({ tipo: 'inicial', origem: 'proprio', prioridade: 'normal', status: 'pendente', cliente, nomeAcao: 'Ação', numeroProcesso: num, modalidadeHonorario: 'fixo', formaPagamento: 'avista', valorHonorarios: 1000, avista: { data: hoje, pago: false }, advogados: A, criadoEm: agora, ...extra });
  await api('dono', 'PUT', '/api/db/casos/fadiv', base('Honorario com divisao', '0000801-01.2024.8.09.0801', { divisao: { partes: [{ oab: '11111/GO', nome: 'Ana Advogada', pct: 60 }, { oab: '22222/GO', nome: 'Bruno Advogado', pct: 40 }] } }));
  await api('dono', 'PUT', '/api/db/casos/fasem', base('Honorario sem divisao', '0000802-02.2024.8.09.0802', {}));
  await api('dono', 'PUT', '/api/db/casos/fauni', base('Honorario so da Ana', '0000803-03.2024.8.09.0803', { advogados: [A[0]] }));
  const p = await abrir('ana');
  const u = await p.evaluate(() => ({ div: window.__horusTeste.rcUnidades('fadiv'), sem: window.__horusTeste.rcUnidades('fasem'), uni: window.__horusTeste.rcUnidades('fauni') }));
  check(u.div.length === 1 && Math.abs(u.div[0].fator - 0.6) < 1e-9 && u.div[0].meu === 600, 'com divisão 60/40, a parte da Ana é 60% (R$ 600 de R$ 1.000): ' + JSON.stringify(u.div));
  check(u.sem.length === 1 && u.sem[0].fator === 0 && u.sem[0].meu === 0, 'vários advogados e sem divisão: não entra nas finanças dela (não dá para saber a parte): ' + JSON.stringify(u.sem));
  check(u.uni.length === 1 && u.uni[0].fator === 1 && u.uni[0].meu === 1000, 'processo só dela: tudo é dela: ' + JSON.stringify(u.uni));
  await p.context().close();
  for (const id of ['fadiv', 'fasem', 'fauni']) await api('dono', 'DELETE', '/api/db/casos/' + id);
}

console.log('\n— ninguém mais vê o que é dela');
{
  const lst = async (n, c) => ((await api(n, 'GET', '/api/db/' + c)).j.docs || []).map((d) => d.id).join(',');
  check(!/anad/.test(await lst('bruno', 'despesas')), 'outro advogado (Bruno) não vê as despesas da Ana');
  check(/Aluguel|d1/.test(await lst('dono', 'despesas')) && !/anad/.test(await lst('dono', 'despesas')), 'o proprietário continua vendo só as dele (a da Ana não aparece)');
  check((await api('caio', 'GET', '/api/db/despesas')).s === 403, 'o estagiário continua sem Finanças');
  const p = await abrir('bruno');
  await p.evaluate(() => document.querySelector('#drawer [data-tab="financeiro"][data-fin="pj"]').click()); await p.waitForTimeout(900);
  const tb = await p.locator('#colunaFinanceiroPj').innerText();
  check(!/Ana|Aluguel|4\.321/.test(tb) && (await p.evaluate(() => document.querySelector('#drawer [data-fin="pj"] .lab').textContent.trim())) === 'Bruno (PJ)', 'o Bruno abre a PJ dele sem os dados da Ana (nem os do proprietário) e com o rótulo "Bruno (PJ)": ' + tb.replace(/\n/g, ' | ').slice(0, 100));
  await p.context().close();
}
await br.close();
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo.'); process.exit(falhas ? 1 : 0);
