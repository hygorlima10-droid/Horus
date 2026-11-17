// Boas-vindas no Início e quadros (kanban) no computador: saudação por horário e nome, colunas legíveis (≥ 236 px, cartões compactos),
// "Editar colunas" na linha da busca, coluna vazia em faixa (abre ao arrastar) e botão "Ampliar quadro" (menu só com ícones, lembrado).  Use: node test/rodar.mjs quadros
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8812', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const r0 = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.91' } }); const ck = r0.headers.get('set-cookie').split(';')[0];
const f = (m, p, b) => fetch(B + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(async r => ({ s: r.status, j: await r.json().catch(() => ({})) }));
const dia = n => new Date(Date.now() - 3 * 3600e3 + n * 864e5).toISOString().slice(0, 10), agora = new Date().toISOString();
for (const d of (await f('GET', '/api/db/casos')).j.docs || []) if (d.id.startsWith('qz')) await f('DELETE', '/api/db/casos/' + d.id);
for (const d of (await f('GET', '/api/db/alvaras')).j.docs || []) if (d.id.startsWith('qz')) await f('DELETE', '/api/db/alvaras/' + d.id);
const NOMES = ['Marinho do Carmo Marques da Silva', 'Ray Costa Ávila', 'Alexandre Barbosa', 'Rafael de Paula'];
for (let i = 0; i < 4; i++) await f('PUT', '/api/db/casos/qz' + i, { tipo: 'inicial', cliente: NOMES[i] + ' QZ', nomeAcao: 'Ação de Rescisão Contratual c/c Despejo Rural', origem: 'proprio', prioridade: 'normal', status: i % 2 ? 'aguardando_cliente' : 'pendente', statusDesde: agora, modalidadeHonorario: 'fixo', formaPagamento: 'avista', valorHonorarios: 1500, avista: { data: dia(10), pago: false }, parcelas: [], clienteIds: [], criadoEm: agora, atualizadoEm: agora });
for (let i = 0; i < 6; i++) await f('PUT', '/api/db/alvaras/qz' + i, { numeroProcesso: '5368644-67.2026.8.09.01' + (10 + i), partes: 'Ciclano de Tal x Banco Bradesco S/A QZ', origem: 'proprio', valorTotalHonorarios: 5000, valorMeuHonorario: 4000, status: 'pendente', fase: ['protocolada', 'aguardando', 'expedido', 'banco', 'protocolada', 'aguardando'][i], faseDesde: dia(-3), previsaoLevantamento: dia(5), clienteIds: [], criadoEm: agora, atualizadoEm: agora });
const br = await chromium.launch(); const erros = [];
async function abrir(w, h) {
  const page = await (await br.newContext({ viewport: { width: w, height: h }, timezoneId: 'America/Sao_Paulo' })).newPage(); await page.route(/fonts\./, x => x.abort());
  await page.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { } }); page.on('pageerror', e => erros.push(String(e)));
  await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(3500);
  return page;
}
const t = (page, sel) => page.locator(sel).innerText().then(x => x.replace(/\s+/g, ' '));
const aba = async (page, tab, sub) => { await page.evaluate(x => document.querySelector('#drawer [data-tab="' + x + '"]').click(), tab); await page.waitForTimeout(900); if (sub) { await page.evaluate(re => { const b = Array.from(document.querySelectorAll('.md-abas button')).find(x => x.offsetParent && new RegExp(re).test(x.innerText)); b && b.click(); }, sub); await page.waitForTimeout(700); } };

// ---- boas-vindas
let page = await abrir(1440, 900);
const hBr = new Date(Date.now() - 3 * 3600e3).getUTCHours(), esperado = hBr >= 5 && hBr < 12 ? 'Bom dia' : (hBr >= 12 && hBr < 18 ? 'Boa tarde' : 'Boa noite');
await page.evaluate(() => document.querySelector('#drawer [data-tab="inicio"]').click()); await page.waitForTimeout(800);
const sau = await t(page, '#iniSauda');
check(sau.startsWith(esperado + ', Hygor'), 'o Início abre com a boas-vindas e o nome (proprietário sem usuário cadastrado é o Hygor): ' + sau);
check(/(segunda|terça|quarta|quinta|sexta)-feira|sábado|domingo/i.test(sau), 'mostra o dia da semana e a data: ' + sau);
const per = await page.evaluate(() => [0, 4, 5, 11, 12, 17, 18, 23].map(h => window.__horusTeste.qdPeriodo(h)[0]));
check(per.join('|') === 'Boa noite|Boa noite|Bom dia|Bom dia|Boa tarde|Boa tarde|Boa noite|Boa noite', 'os períodos: bom dia 5h–11h59, boa tarde 12h–17h59, boa noite 18h–4h59: ' + per.join(', '));
check(await page.evaluate(() => { const T = window.__horusTeste, e0 = T.esS.eu; T.esS.eu = { nome: 'Kamyla Souza Lima', papel: 'estagiario' }; const a = T.qdNome(); T.esS.eu = { nome: '', papel: 'advogado' }; const b = T.qdNome(); T.esS.eu = e0; return a === 'Kamyla' && b === ''; }), 'usa o primeiro nome do usuário (e, sem nome cadastrado, só a saudação)');
if (process.env.FOTOS) await page.screenshot({ path: process.env.FOTOS + '/q-inicio.png' });
await page.close();

// ---- quadro de Iniciais (computador)
page = await abrir(1440, 900); await aba(page, 'peticoes', 'Quadro');
const col = await page.evaluate(() => Array.from(document.querySelectorAll('#kanbanPeticoes .kanban-col')).map(c => ({ vazia: !c.querySelector('.kanban-card'), cls: c.classList.contains('q-vazia'), w: Math.round(c.getBoundingClientRect().width), head: c.querySelector('h4').innerText.replace(/\s+/g, ' ') })));
check(col.filter(c => !c.vazia).length >= 2 && col.filter(c => !c.vazia).every(c => !c.cls && c.w >= 236), 'colunas com cartões têm 236 px ou mais (' + col.filter(c => !c.vazia).map(c => c.w).join(', ') + ')');
check(col.some(c => c.vazia) && col.filter(c => c.vazia).every(c => c.cls && c.w <= 56), 'coluna sem cartões vira faixa estreita (' + col.filter(c => c.vazia).map(c => c.head + ' ' + c.w + ' px').join('; ') + ')');
check(await page.evaluate(() => { const r = document.querySelector('#kanbanPeticoes .q-vazia'); return !!r && !!r.querySelector('.q-rot') && getComputedStyle(r.querySelector('.q-rot')).writingMode.startsWith('vertical'); }), 'o nome da coluna vazia fica na vertical, com o contador');
const nm = await page.evaluate(() => { const n = Array.from(document.querySelectorAll('#kanbanPeticoes .kanban-card .kc-nome')).find(x => /Marinho/.test(x.innerText)); const lh = parseFloat(getComputedStyle(n).lineHeight); return { h: n.getBoundingClientRect().height, lh, txt: n.innerText }; });
check(nm.h <= nm.lh * 2 + 2, 'o nome longo do cliente cabe em até 2 linhas (' + Math.round(nm.h) + ' px de altura): ' + nm.txt);
// arrastar um cartão para a faixa: ela abre
const antes = await page.evaluate(() => { const c = document.querySelector('#kanbanPeticoes .q-vazia'); c.classList.add('drag-over'); const w = c.getBoundingClientRect().width; c.classList.remove('drag-over'); return w; });
check(antes >= 230, 'ao arrastar um cartão por cima, a faixa abre (' + Math.round(antes) + ' px)');
// mover um cartão para a coluna vazia: deixa de ser faixa
const mv = await page.evaluate(() => { const col = document.querySelector('#kanbanPeticoes .q-vazia'); return col.getAttribute('data-pcol'); });
await page.evaluate(() => { const b = document.querySelector('#kanbanPeticoes [data-p-mover$="|aguardando_documentacao"]'); b && b.click(); }); await page.waitForTimeout(1000);
check(await page.evaluate(m => { const c = document.querySelector('#kanbanPeticoes [data-pcol="aguardando_documentacao"]'); return !!c && !c.classList.contains('q-vazia') && !!c.querySelector('.kanban-card'); }, mv), 'quando a coluna recebe um cartão, volta a ser coluna normal');
if (process.env.FOTOS) await page.screenshot({ path: process.env.FOTOS + '/q-iniciais.png' });
// barra numa linha
check(await page.evaluate(() => { const f = document.querySelector('#headPeticoes .filters'); return !!f.querySelector('#editarColunasPeticao') && !!f.querySelector('.q-amplo-btn') && !!f.querySelector('input#buscaInput'); }), '"Editar colunas", a busca e o botão "Ampliar quadro" ficam na mesma linha');
const lin = await page.evaluate(() => { const f = document.querySelector('#headPeticoes .filters'); const ys = ['input#buscaInput', '#editarColunasPeticao', '.q-amplo-btn'].map(s => Math.round(f.querySelector(s).getBoundingClientRect().top)); return ys; });
check(Math.max(...lin) - Math.min(...lin) <= 16, 'na mesma altura (' + lin.join(', ') + ')');
// ampliar quadro
const mw = () => page.evaluate(() => ({ menu: Math.round(document.querySelector('#drawer').getBoundingClientRect().width), main: Math.round(document.querySelector('.main').getBoundingClientRect().left) }));
let w0 = await mw(); check(w0.menu === 264 && /Ampliar quadro/.test(await t(page, '#headPeticoes .q-amplo-btn')), 'o menu começa aberto (264 px) e o botão diz "Ampliar quadro"');
await page.click('#headPeticoes .q-amplo-btn'); await page.waitForTimeout(400);
w0 = await mw(); check(w0.menu === 68 && w0.main === 68 && /Restaurar menu/.test(await t(page, '#headPeticoes .q-amplo-btn')), 'Ampliar quadro: menu só com ícones (68 px), o quadro ganha a largura e o botão vira "Restaurar menu"');
await page.hover('#drawer'); await page.waitForTimeout(400); check((await mw()).menu === 264 && (await mw()).main === 68, 'passando o mouse no menu, ele abre por cima sem empurrar o quadro'); await page.mouse.move(700, 500); await page.waitForTimeout(300);
await aba(page, 'processos'); check((await mw()).menu === 264, 'em outras telas o menu volta ao tamanho normal');
await aba(page, 'alvaras', 'Fases'); check((await mw()).menu === 68 && /Restaurar menu/.test(await t(page, '#headAlvaras .q-amplo-btn')), 'em Alvarás também fica ampliado (a escolha vale para os dois quadros)');
await page.reload(); await page.waitForTimeout(3500); await aba(page, 'peticoes', 'Quadro'); check((await mw()).menu === 68, 'a escolha fica salva neste computador (continua ampliado após recarregar)');
// quadro de Alvarás
await aba(page, 'alvaras', 'Fases');
const colA = await page.evaluate(() => Array.from(document.querySelectorAll('#kanbanAlvaras .kanban-col')).filter(c => c.offsetParent).map(c => ({ vazia: !c.querySelector('.kanban-card'), cls: c.classList.contains('q-vazia'), w: Math.round(c.getBoundingClientRect().width) })));
check(colA.filter(c => !c.vazia).every(c => c.w >= 236 && !c.cls) && colA.filter(c => c.vazia).every(c => c.cls && c.w <= 56), 'Alvarás: colunas com cartões ≥ 236 px e as vazias em faixa (' + colA.map(c => c.w).join(', ') + ')');
if (process.env.FOTOS) await page.screenshot({ path: process.env.FOTOS + '/q-alvaras-amplo.png' });
await page.click('#headAlvaras .q-amplo-btn'); await page.waitForTimeout(300); check((await mw()).menu === 264 && /Ampliar quadro/.test(await t(page, '#headAlvaras .q-amplo-btn')), '"Restaurar menu" devolve o menu ao normal');
await page.evaluate(() => { const b = Array.from(document.querySelectorAll('.md-abas button')).find(x => x.offsetParent && /Lista/.test(x.innerText)); b && b.click(); }); await page.waitForTimeout(500);
check(!(await page.locator('#editarColunasAlvara').isVisible()), '"Editar colunas" não aparece na Lista (só nos quadros)');
// Agenda › Lista: Novo compromisso, Selecionar e Calculadora de prazos na mesma linha
for (const w of [1280, 1000]) {
  await page.setViewportSize({ width: w, height: 800 }); await aba(page, 'agenda'); await page.evaluate(() => { const b = document.querySelector('[data-ag="vista"][data-v="lista"]'); b && b.click(); }); await page.waitForTimeout(700);
  const bt = await page.evaluate(() => Array.from(document.querySelectorAll('.ag-acoes .acao')).map(b => ({ t: b.innerText.trim(), y: Math.round(b.getBoundingClientRect().top), x: Math.round(b.getBoundingClientRect().right) })));
  check(bt.length === 3 && Math.max(...bt.map(b => b.y)) - Math.min(...bt.map(b => b.y)) <= 2 && await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Agenda › Lista em ' + w + ' px: os 3 botões ficam na mesma linha (' + bt.map(b => b.t + ' y=' + b.y).join('; ') + ')');
}
await page.setViewportSize({ width: 1440, height: 900 });
check(erros.length === 0, 'computador: sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
await page.close();

// ---- celular: nada muda no quadro, sem o botão e sem rolagem para o lado
page = await abrir(390, 844);
await page.evaluate(() => document.querySelector('#drawer [data-tab="inicio"]') && document.querySelector('#btbar [data-tab="inicio"]').click()); await page.waitForTimeout(800);
check(/^(Bom dia|Boa tarde|Boa noite), Hygor/.test(await t(page, '#iniSauda')) && await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'celular: a boas-vindas aparece e a tela não rola para o lado');
await aba(page, 'peticoes', 'Quadro').catch(() => { });
check(!(await page.locator('#headPeticoes .q-amplo-btn').isVisible()), 'celular: o botão "Ampliar quadro" não aparece');
if (process.env.FOTOS) await page.screenshot({ path: process.env.FOTOS + '/q-celular.png' });
await page.close();
if (process.env.FOTOS) { const pg = await abrir(1366, 768); await aba(pg, 'agenda'); await pg.evaluate(() => { const b = document.querySelector('[data-ag="vista"][data-v="quadro"]'); b && b.click(); }); await pg.waitForTimeout(800); await pg.screenshot({ path: process.env.FOTOS + '/q-agenda.png' }); await pg.close(); }
await br.close();
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
