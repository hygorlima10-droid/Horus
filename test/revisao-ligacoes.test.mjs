// Testa a revisão de ligações (correções 4 e 6 da análise de interligação): números sem processo cadastrado (inclusive só na Agenda),
// processos sem cliente (com sugestão) e cliente diferente entre o ato e o processo.
// Grupo principal (porta 8812):  node test/rodar.mjs revisao-ligacoes
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8812', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const agora = new Date().toISOString(), hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10), em = (n) => new Date(Date.parse(hoje) + n * 864e5).toISOString().slice(0, 10);
let r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.32' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const f = (m, p, b) => fetch(B + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(async x => ({ s: x.status, j: await x.json().catch(() => ({})) }));
const docs = async col => (await f('GET', '/api/db/' + col)).j.docs.map(d => ({ id: d.id, ...d.data }));
for (const col of ['casos', 'termosAcordo', 'alvaras', 'clientes', 'despesas', 'receitasManuais', 'metas', 'saldos', 'config', 'extratos', 'obraMov', 'prazosPub', 'agenda', 'processos']) for (const d of (await f('GET', '/api/db/' + col)).j.docs) await f('DELETE', '/api/db/' + col + '/' + d.id);
await f('PUT', '/api/db/config/backup', { ultimoEm: agora });
const NA = '5500001-11.2026.8.09.0107', NB = '5500002-22.2026.8.09.0107', NC = '5500003-33.2026.8.09.0107', ND = '5500004-44.2026.8.09.0107', NE = '5500005-55.2026.8.09.0107', NF = '5500006-66.2026.8.09.0107';
await f('PUT', '/api/db/clientes/cl1', { nome: 'Cliente Um', pagador: 'cliente', criadoEm: agora });
await f('PUT', '/api/db/clientes/cl2', { nome: 'Cliente Dois', pagador: 'cliente', criadoEm: agora });
const proc = (n, o) => f('POST', '/api/db/processos', Object.assign({ numero: n, honorarios: 'sem', arquivado: false, origem: 'manual', criadoEm: agora }, o));
const caso = (id, o) => f('PUT', '/api/db/casos/' + id, Object.assign({ tipo: 'inicial', origem: 'proprio', prioridade: 'normal', status: 'pendente', statusDesde: agora, modalidadeHonorario: 'fixo', formaPagamento: 'avista', valorHonorarios: 100, criadoEm: agora }, o));
await proc(NA, { partes: 'A x B', clienteIds: ['cl1'] });
await caso('ia', { cliente: 'Cliente Dois', nomeAcao: 'Ação A', numeroProcesso: NA, clienteIds: ['cl2'] });                       // cliente diferente do processo
await caso('ib', { cliente: 'Cliente Um', nomeAcao: 'Ação B', numeroProcesso: NB, clienteIds: ['cl1'], advogados: [{ oab: '60456/GO', nome: 'Hygor' }] });   // número sem processo
await f('PUT', '/api/db/termosAcordo/ac', { partes: 'Cliente Um', numeroProcesso: NB, clienteIds: ['cl1'], status: 'pendente', criadoEm: agora });
await f('POST', '/api/db/agenda', { tipo: 'prazo', titulo: 'Prazo só na agenda', processo: NC, cliente: 'Fulano da Agenda', data: em(5), situacao: 'afazer', concluido: false });
await proc(ND, { partes: 'Sem Nome Conhecido x Banco', clienteIds: [] });
await caso('id', { cliente: 'Cliente Um', nomeAcao: 'Ação D', numeroProcesso: ND, clienteIds: ['cl1'] });                         // sugestão pelos atos
await proc(NE, { partes: 'Cliente Dois x Banco', clienteIds: [] });                                                          // sugestão pelo nome
await proc(NF, { partes: 'Zé Ninguém x Empresa', clienteIds: [] });                                                          // sem sugestão
const NG = '5500007-77.2026.8.09.0107';                                                                                          // processo COM cliente, mas de uma colega: o filtro "Meus" esconde o cliente da lista
await f('PUT', '/api/db/clientes/cl9', { nome: 'Cliente Colega', pagador: 'cliente', criadoEm: agora });
await proc(NG, { partes: 'Cliente Colega x Banco', clienteIds: ['cl9'], advogados: [{ oab: '11111/GO', nome: 'Ana' }] });
await caso('ig', { cliente: 'Cliente Colega', nomeAcao: 'Ação G', numeroProcesso: NG, clienteIds: ['cl9'], advogados: [{ oab: '11111/GO', nome: 'Ana' }] });

const br = await chromium.launch(), page = await (await br.newContext({ viewport: { width: 1280, height: 900 } })).newPage(), erros = [];
page.on('pageerror', (e) => erros.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.|Failed to load resource/.test(m.text())) erros.push('console: ' + m.text()); });
await page.route(/fonts\./, (x) => x.abort());
await page.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { } });
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(4500);
const shot = async (n) => { if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + 'lg-' + n + '.png', fullPage: true }); };
const C = () => page.locator('#overlayLgRevC').textContent();

console.log('\n— aviso na aba Processos');
await page.click('[data-tab="processos"]'); await page.waitForTimeout(1200);
await page.evaluate(() => window.__horusTeste.pdAtualizar()); await page.waitForTimeout(500); await page.evaluate(() => window.__horusTeste.pdAtualizar()); await page.click('#pdSelo'); await page.waitForTimeout(300);
const av = await page.locator('#overlayPendC').innerText();
check(/2 sem processo cadastrado/.test(av) && /1 com cliente diferente/.test(av) && /3 processos sem cliente/i.test(av) && /Atos com ligação a conferir/i.test(av) && !/ligações a revisar/i.test(av), 'o selo Pendências tem dois cartões claros: "Atos com ligação a conferir" (2 sem processo, 1 com cliente diferente) e "3 processos sem cliente" (' + av.replace(/\n/g, ' ').slice(0, 200) + ')');
await page.click('#overlayPendC [data-pdl="lg"]'); await page.waitForSelector('#overlayLgRev.show .es-it'); await shot('rev-sem');
let t = await C();
check(t.includes(NB) && t.includes(NC) && t.includes('Inicial, Acordo') && t.includes('Agenda'), 'aba "Sem processo": o número que está em Inicial e Acordo e o que só está na Agenda');
check(await page.locator('#overlayLgRevC [data-lgr="aba"]').count() === 2 && !(await C()).includes('Sem cliente'), 'a tela "Revisão de ligações" ficou só com "Sem processo" e "Cliente diferente" (a aba "Sem cliente" saiu)');

console.log('\n— cadastrar os processos que faltam');
await page.click('[data-lgr="todos"]'); await page.click('[data-lgr="cadastrar"]'); await page.waitForTimeout(1500);
const ps = await docs('processos'), pb = ps.find((d) => d.numero === NB), pc = ps.find((d) => d.numero === NC);
check(pb && pb.clienteIds.join() === 'cl1' && pb.advogados && pb.advogados[0].oab === '60456/GO' && pb.derivado === true, 'o processo do número da Inicial/Acordo nasce com o cliente e os advogados dos atos');
check(pc && pc.partes === 'Fulano da Agenda' && pc.clienteIds.length === 0, 'o processo que só estava na Agenda nasce com o nome que a Agenda tinha (e cai em "sem cliente")');
check((await C()).includes('Todos os números têm processo cadastrado'), 'a aba esvazia');

console.log('\n— processos sem cliente: uma lista só (Processos › Revisar), do escritório todo');
await page.evaluate(() => document.getElementById('overlayLgRev').classList.remove('show'));
await page.evaluate(() => window.__horusTeste.pdAtualizar()); await page.click('#pdSelo'); await page.waitForTimeout(300);
await page.click('#overlayPendC [data-pdl="imp"]'); await page.waitForTimeout(900); await shot('rev-lista');
const cartoes = () => page.locator('#prLista [data-pr-card]').count();
check(await cartoes() === 4, 'a lista Revisar mostra os 4 processos sem cliente (Zé Ninguém, os dois com sugestão e o que veio da Agenda): ' + await cartoes());
check(/Revisão do escritório/i.test(await page.locator('#prAvisoVinc').innerText()) && /Faltam\s+4\s+processos/i.test(await page.locator('#prAvisoVinc').innerText()), 'o aviso diz "Revisão do escritório" e quantos faltam');
const numD = ND.replace(/\D/g, ''), numE = NE.replace(/\D/g, '');
check(await page.locator('#prLista [data-pr="rev-vinc"][data-n="' + numD + '"]').count() === 1 && await page.locator('#prLista [data-pr="rev-vinc"][data-n="' + numE + '"]').count() === 1, 'os dois que têm sugestão (pelos atos e pelo nome) oferecem "Vincular a …"');
check(await page.locator('#prLista [data-pr="abrir"]').filter({ hasText: 'Abrir ficha' }).count() >= 4, 'o botão "Abrir" agora é "Abrir ficha"');
await page.evaluate(() => window.scrollTo(0, 60));
await page.click('#prLista [data-pr="rev-vinc"][data-n="' + numD + '"]'); await page.waitForTimeout(1500);
let ps2 = await docs('processos'), pd = ps2.find((d) => d.numero === ND);
check(pd.clienteIds.join() === 'cl1' && await cartoes() === 3, 'vincular ao cliente sugerido tira o processo da lista (agora 3) e grava o cliente');
check(/Faltam 3/.test(await page.locator('#toast').textContent()), 'o aviso informa quantos faltam: ' + (await page.locator('#toast').textContent()));
await page.waitForSelector('#overlayImpPerg.show'); await page.click('#overlayImpPerg >> text=Não, sempre revisar'); await page.waitForTimeout(500);   /* primeira vez do cliente: o app pergunta se os próximos vão direto */
check(Math.round(await page.evaluate(() => window.pageYOffset)) >= 50, 'a lista continua no mesmo ponto da rolagem depois da ação (' + Math.round(await page.evaluate(() => window.pageYOffset)) + ' px)');
await page.click('#prLista [data-pr="rev-vinc"][data-n="' + numE + '"]'); await page.waitForTimeout(1500);
if (await page.locator('#overlayImpPerg.show').count()) { await page.click('#overlayImpPerg >> text=Não, sempre revisar'); await page.waitForTimeout(400); }
ps2 = await docs('processos'); const pe = ps2.find((d) => d.numero === NE), pf = ps2.find((d) => d.numero === NF);
check(pe.clienteIds.join() === 'cl2' && pf.clienteIds.length === 0 && await cartoes() === 2, 'o segundo vínculo também some da lista; sobram 2 sem sugestão');

console.log('\n— o filtro "Meus" não esconde a revisão nem inventa "sem cliente"');
await page.evaluate(() => window.__horusEscopo.aplicar('meus')); await page.waitForTimeout(800);
const meus = await page.evaluate(() => ({ sem: window.__horusTeste.lgRevCalcular().semCli.map(x => x.numero), n: document.querySelectorAll('#prLista [data-pr-card]').length }));
check(!meus.sem.includes('5500007-77.2026.8.09.0107') && meus.sem.length === 2, 'com "Meus" ligado, o processo que tem cliente de uma colega NÃO vira "sem cliente" (' + meus.sem.length + ' sem cliente de verdade)');
check(meus.n === 2, 'e a lista Revisar continua mostrando os processos sem cliente (' + meus.n + '), mesmo não sendo "meus"');
await page.evaluate(() => window.__horusEscopo.aplicar('escritorio')); await page.waitForTimeout(500);

console.log('\n— cliente diferente entre ato e processo');
await page.evaluate(() => window.__horusTeste.pdAtualizar()); await page.click('#pdSelo'); await page.click('#overlayPendC [data-pdl="lg"]'); await page.waitForSelector('#overlayLgRev.show');
await page.click('[data-lgr="aba"][data-k="dif"]'); await page.waitForTimeout(300); await shot('rev-dif');
t = await C();
check(t.includes('Cliente no inicial') && t.includes('Cliente Dois') && t.includes('Cliente Um'), 'mostra o cliente de cada lado');
await page.click('[data-lgr="ajusta-proc"]'); await page.waitForTimeout(1200);
check((await docs('processos')).find((d) => d.numero === NA).clienteIds.join() === 'cl2' && (await C()).includes('Nenhuma divergência'), '"Usar o do ato no processo" acerta o processo e a divergência some');

console.log('\n— lista longa: as linhas não se sobrepõem');
const LONGO = 'Fulano de Tal e Beltrano da Silva, Cicrana Souza Lima e Empresa Comercial de Materiais Elétricos Ltda x Banco Grande Nacional S/A e outros';
for (let i = 0; i < 40; i++) await proc('56' + String(100000 + i).slice(1) + '-1' + (i % 10) + '.2026.8.09.0107', { partes: LONGO + ' ' + i, clienteIds: [] });
await page.reload(); await page.waitForTimeout(3500); await page.click('[data-tab="processos"]'); await page.waitForTimeout(1000);
await page.evaluate(() => window.__horusTeste.pdAtualizar()); await page.waitForTimeout(500); await page.evaluate(() => window.__horusTeste.pdAtualizar()); await page.click('#pdSelo'); await page.waitForTimeout(300);
await page.click('#overlayPendC [data-pdl="imp"]'); await page.waitForTimeout(1200); await shot('rev-longa');
const lin = await page.evaluate(() => { const its = Array.from(document.querySelectorAll('#prLista [data-pr-card]')); const r = its.map(e => e.getBoundingClientRect()); let sobre = 0; for (let i = 1; i < r.length; i++) if (r[i].top < r[i - 1].bottom - 1) sobre++; return { n: its.length, sobre, rola: document.documentElement.scrollHeight > innerHeight, lateral: document.documentElement.scrollWidth > innerWidth + 1, filhos: its.filter(e => Array.from(e.querySelectorAll('button')).some(b => b.getBoundingClientRect().right > e.getBoundingClientRect().right + 1)).length }; });
check(lin.n >= 30 && lin.rola && lin.sobre === 0 && lin.filhos === 0 && !lin.lateral, 'com ' + lin.n + ' processos a lista rola, nenhum cartão fica por cima do outro (' + lin.sobre + ' sobreposições) nem passa da largura');
check(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
