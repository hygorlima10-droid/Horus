// Delegadas: a "planilha" de tarefas delegadas da equipe dentro do app. Todos (proprietário, advogados e estagiários) veem, lançam, editam, concluem
// e excluem as linhas; lançamento direto na linha (computador) e ficha curta (celular); abas Abertas, Painel e Concluídas.  Use: node test/rodar.mjs delegadas
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8812', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const r0 = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.71' } }); const ck = r0.headers.get('set-cookie').split(';')[0];
const f = (m, p, b) => fetch(B + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(async r => ({ s: r.status, j: await r.json().catch(() => ({})) }));
const dia = n => new Date(Date.now() - 3 * 3600e3 + n * 864e5).toISOString().slice(0, 10);
const lista = async () => (await f('GET', '/api/db/delegadas')).j.docs.map(d => ({ id: d.id, ...d.data }));
await f('POST', '/api/db/clientes', { nome: 'Cooperativa Mista de Leite' }); await f('POST', '/api/db/processos', { numero: '5727644-22.2026.8.09.0107', partes: 'Cooperativa x João', cliente: 'Cooperativa Mista de Leite' });
await f('POST', '/api/db/delegadas', { titulo: 'Tarefa antiga atrasada', resp: '60456/GO', delegadoPor: '60456/GO', prioridade: 'Alta', status: 'andamento', fatal: dia(-5), criadoEm: new Date().toISOString() });
await f('POST', '/api/db/delegadas', { titulo: 'Tarefa já concluída', resp: '60456/GO', prioridade: 'Média', status: 'concluida', concluidoEm: dia(-1), criadoEm: new Date().toISOString() });

const br = await chromium.launch(); const erros = [];
async function abrir(w, h) {
  const page = await (await br.newContext({ viewport: { width: w, height: h }, timezoneId: 'America/Sao_Paulo' })).newPage(); await page.route(/fonts\./, x => x.abort());
  await page.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { } }); page.on('pageerror', e => erros.push(String(e)));
  await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(3500);
  return page;
}
const t = (page, sel) => page.locator(sel).innerText().then(x => x.replace(/\s+/g, ' '));

// ---- computador
let page = await abrir(1280, 900);
check(await page.evaluate(() => !!document.querySelector('#drawer [data-tab="delegadas"]')), 'o menu tem "Delegadas"');
await page.evaluate(() => document.querySelector('#drawer [data-tab="delegadas"]').click()); await page.waitForTimeout(1200);
check(/Abertas/.test(await t(page, '#dgWrap')) && /Painel da equipe/.test(await t(page, '#dgWrap')) && /Concluídas/.test(await t(page, '#dgWrap')), 'a tela tem as abas Abertas, Painel da equipe e Concluídas');
check(await page.locator('#dg_n_titulo').isVisible() && /Tarefa antiga atrasada/.test(await page.evaluate(() => Array.from(document.querySelectorAll('.dg-t input.dg-t')).map(i => i.value).join('|'))), 'a primeira linha da tabela está em branco para lançar e as tarefas abertas aparecem abaixo');
check(!(await page.evaluate(() => Array.from(document.querySelectorAll('.dg-t input.dg-t')).some(i => i.value === 'Tarefa já concluída'))), 'a tarefa concluída não aparece em Abertas');
const cards = await page.evaluate(() => Array.from(document.querySelectorAll('.dg-ta .dg-nd')).map(e => ({ t: e.innerText.trim(), c: e.className.replace('dg-nd', '').trim(), dica: e.title, w: Math.round(e.getBoundingClientRect().width) })));
const corOk = cards.length > 0 && cards.every(x => { const n = x.t === 'hoje' ? 0 : Number(x.t.replace('−', '-')); return x.c === (n <= 0 ? 'v' : (n <= 3 ? 'a' : 'g')); });
check(corOk && cards.some(x => x.c === 'v' && /^−\d+$/.test(x.t) && /dias? úteis? de atraso/.test(x.dica)) && !/úteis?\b/.test(await page.evaluate(() => Array.from(document.querySelectorAll('.dg-ta .dg-pz')).map(e => e.innerText).join(' '))), 'os dias que faltam viram um cartão colorido só com o número (vermelho: atrasada/hoje; amarelo: 1 a 3; verde: 4 ou mais): ' + cards.map(x => x.t + '=' + x.c).join(', '));
check(await page.evaluate(() => { const g = getComputedStyle(document.querySelector('.dg-ta .dg-nd.v')); return g.backgroundColor !== 'rgba(0, 0, 0, 0)' && g.borderRadius !== '0px'; }), 'o cartão tem fundo colorido e cantos arredondados')
// lançar direto na linha: processo pela setinha com busca completa o cliente
await page.click('tr.dg-novo [data-c="processo"]'); await page.waitForTimeout(300);
check(await page.locator('#dgDD').isVisible() && /5727644-22/.test(await t(page, '#dgDD')), 'a setinha do processo abre com busca e lista os processos cadastrados');
await page.fill('#dgDD .dg-dd-q', '5727644'); await page.click('#dgDD .dg-dd-i'); await page.waitForTimeout(400);
check(/Cooperativa Mista/.test(await t(page, 'tr.dg-novo')) && /5727644-22/.test(await t(page, 'tr.dg-novo')), 'escolher o processo completa o cliente');
await page.fill('#dg_n_titulo', 'Protocolar certidão narrativa'); await page.click('tr.dg-novo [data-c="prioridade"]'); await page.click('#dgDD .dg-dd-i >> text=Alta'); await page.waitForTimeout(300);
await page.fill('tr.dg-novo [data-dgdt="fatal"]', dia(3)); await page.dispatchEvent('tr.dg-novo [data-dgdt="fatal"]', 'change'); await page.waitForTimeout(300);
await page.focus('#dg_n_titulo'); await page.keyboard.press('Enter'); await page.waitForTimeout(1200);
let L = await lista(), n1 = L.find(d => d.titulo === 'Protocolar certidão narrativa');
check(!!n1 && n1.prioridade === 'Alta' && n1.fatal === dia(3) && /5727644-22/.test(n1.processo) && /Cooperativa/.test(n1.cliente) && n1.status === 'afazer' && !!n1.resp && n1.delegadoPor === n1.resp, 'Enter grava a linha: processo, cliente, prioridade Alta, prazo, status "A fazer"; responsável e quem delegou vêm preenchidos');
check((await page.inputValue('#dg_n_titulo')) === '' && await page.evaluate(() => Array.from(document.querySelectorAll('.dg-t input.dg-t')).some(i => i.value === 'Protocolar certidão narrativa')), 'a linha lançada desce para a lista e a linha em branco volta limpa');
// só a tarefa é obrigatória
await page.focus('#dg_n_titulo'); await page.keyboard.press('Enter'); await page.waitForTimeout(500);
check((await lista()).length === L.length, 'sem tarefa digitada, Enter não grava nada');
// corrigir na célula: status pela setinha, com Desfazer
const linha = `tr[data-dgl="${n1.id}"]`;
await page.click(linha + ' [data-c="status"]'); await page.click('#dgDD .dg-dd-i >> text=Em andamento'); await page.waitForTimeout(900);
check((await lista()).find(d => d.id === n1.id).status === 'andamento' && /Desfazer/.test(await t(page, '#toast')), 'mudar o status na célula grava na hora e oferece "Desfazer"');
await page.click('#toast button'); await page.waitForTimeout(900);
check((await lista()).find(d => d.id === n1.id).status === 'afazer', '"Desfazer" volta o status');
// concluir
await page.click(linha + ' [data-dg="concluir"]'); await page.waitForTimeout(900);
const c1 = (await lista()).find(d => d.id === n1.id);
check(c1.status === 'concluida' && c1.concluidoEm === dia(0) && !(await page.locator(linha).count()), 'concluir tira da lista de Abertas e carimba quando foi concluída');
await page.click('.dg-aba >> text=Concluídas'); await page.waitForTimeout(400);
check(/Protocolar certidão narrativa/.test(await t(page, '#dgWrap')) && /Tarefa já concluída/.test(await t(page, '#dgWrap')), 'em Concluídas aparecem as duas');
await page.click('[data-dg="reabrir"][data-id="' + n1.id + '"]'); await page.waitForTimeout(900);
check((await lista()).find(d => d.id === n1.id).status === 'afazer', 'Reabrir devolve a tarefa para as abertas');
await page.click('.dg-aba >> text=Painel da equipe'); await page.waitForTimeout(400);
check(/atrasadas/i.test(await t(page, '#dgWrap')) && /total/i.test(await t(page, '#dgWrap')), 'o Painel da equipe conta por pessoa e status');
// ---- tarefas fixas (alfinete): nas primeiras linhas da mesma tabela, repetem sozinhas, atrasam se não forem feitas
await page.click('.dg-aba >> text=Abertas'); await page.waitForTimeout(400);
await page.fill('#dg_n_titulo', 'Olhar processos de outros estados'); await page.click('tr.dg-novo [data-dg="novafixa"]'); await page.waitForTimeout(300);
check(/toda semana/.test(await t(page, 'tr.dg-novo')) && /repete sozinha/.test(await t(page, 'tr.dg-novo')), 'o alfinete na linha em branco mostra a repetição (toda semana) e troca o prazo por "repete sozinha"');
await page.click('tr.dg-novo [data-c="dow"]'); await page.click('#dgDD .dg-dd-i >> text=quarta'); await page.waitForTimeout(300);
await page.focus('#dg_n_titulo'); await page.keyboard.press('Enter'); await page.waitForTimeout(1200);
const fxT = (await lista()).find(d => d.titulo === 'Olhar processos de outros estados');
check(!!fxT && fxT.fixa === true && fxT.repete === 'semanal' && fxT.dow === 3 && fxT.status === 'afazer' && !fxT.fatal && !!fxT.fixaDesde, 'Enter grava a fixa: semanal, quarta-feira, sem prazo fatal, com a data de início');
const ordem = await page.evaluate(() => Array.from(document.querySelectorAll('.dg-ta tbody tr[data-dgl]')).map(r => r.classList.contains('dg-fx')));
check(ordem.length >= 2 && ordem[0] === true && ordem.indexOf(false) > ordem.lastIndexOf(true), 'a fixa fica nas primeiras linhas (antes das tarefas comuns), na mesma tabela, com o alfinete');
check(await page.evaluate(() => !!document.querySelector('.dg-ta tr.dg-fx .dg-pin svg')) && /Vence|Atrasada|Feita/.test(await t(page, '.dg-ta tr.dg-fx')), 'a linha da fixa tem o símbolo e a situação do ciclo');
// estados do ciclo (datas puras)
const est = await page.evaluate(() => { const T = window.__horusTeste, hoje = new Date(Date.now() - 3 * 3600e3), iso = d => d.toISOString().slice(0, 10), h = iso(hoje), ontem = iso(new Date(+hoje - 864e5)), dw = d => new Date(d + 'T12:00:00Z').getUTCDay(), base = { fixaDesde: '2026-01-01', feitas: {} };
  return { atras: T.dgTFixaEstado({ ...base, repete: 'semanal', dow: dw(ontem) }).est, hoje: T.dgTFixaEstado({ ...base, repete: 'semanal', dow: dw(h) }).est, feita: T.dgTFixaEstado({ ...base, repete: 'semanal', dow: dw(h), feitas: { [h]: { por: 'x', em: h } } }).est, mhoje: T.dgTFixaEstado({ ...base, repete: 'mensal', dia: Number(h.slice(8, 10)) }).est, mfeita: T.dgTFixaEstado({ ...base, repete: 'mensal', dia: Number(h.slice(8, 10)), feitas: { [h.slice(0, 7)]: { por: 'x', em: h } } }).est, nova: T.dgTFixaEstado({ repete: 'semanal', dow: dw(ontem), fixaDesde: h, feitas: {} }).est }; });
check(est.atras === 'atrasada' && est.hoje === 'hoje' && est.feita === 'feita' && est.mhoje === 'hoje' && est.mfeita === 'feita' && est.nova !== 'atrasada', 'ciclo: não feita vira atrasada, vence hoje, feita no ciclo, mensal, e a fixa nova não cobra o que passou antes de existir: ' + JSON.stringify(est));
// feita neste ciclo (um toque) e desfazer
await page.click(`tr[data-dgl="${fxT.id}"] .dg-stbtn`); await page.waitForTimeout(1000);
const fxF = (await lista()).find(d => d.id === fxT.id);
check(Object.keys(fxF.feitas || {}).length === 1 && fxF.status === 'afazer' && (await lista()).some(d => d.id === fxT.id), 'um toque marca o ciclo como feito (quem e quando) e a fixa continua na lista, não vai para Concluídas');
await page.click(`tr[data-dgl="${fxT.id}"] .dg-stbtn`); await page.waitForTimeout(900);
check(Object.keys((await lista()).find(d => d.id === fxT.id).feitas || {}).length === 0, 'tocar de novo desfaz');
const alin = await page.evaluate(() => { const x = e => { const td = e.closest('td'); return Math.round(e.getBoundingClientRect().left - td.getBoundingClientRect().left); }; const f = document.querySelector('.dg-ta tr.dg-fx .dg-nd'), n = document.querySelector('.dg-ta tr:not(.dg-fx):not(.dg-novo) .dg-nd'); return { f: f ? x(f) : null, n: n ? x(n) : null }; });
check(alin.f !== null && alin.n !== null && Math.abs(alin.f - alin.n) <= 1, 'o cartão dos dias fica no mesmo lugar da coluna nas linhas comuns e nas fixas (' + alin.n + ' px e ' + alin.f + ' px da borda da coluna)');
// copiar o processo e coluna Cliente mais estreita, com ênfase na descrição
await page.context().grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => { });
check(await page.locator('.dg-ta [data-dg="copiar"]').count() >= 1, 'as linhas com processo têm o botão de copiar o número');
await page.locator('.dg-ta [data-dg="copiar"]').first().click(); await page.waitForTimeout(500);
check(/copiad/i.test(await t(page, '#toast')), 'copiar o número do processo avisa "copiado"');
// ---- tabela compacta: 7 colunas, cliente e processo juntos (com o botão de copiar), prazos juntos, ações em ✓ e ⋯
const cab = await page.evaluate(() => Array.from(document.querySelectorAll('.dg-ta thead th')).map(x => ({ t: x.textContent.trim(), w: Math.round(x.getBoundingClientRect().width) })));
check(cab.length === 7 && cab.map(x => x.t).join('|') === 'Tarefa *|Cliente / processo|Responsável|Prior.|Status|Prazos|', 'a tabela tem 7 colunas: ' + cab.map(x => x.t).join(' | '));
check(cab[1].w >= 200 && cab[1].w <= 240 && cab[0].w >= 260, 'Cliente / processo ocupa ~220 px e a Tarefa fica com o resto (' + cab[0].w + ' px)');
const linhaCP = await page.evaluate(() => { const r = Array.from(document.querySelectorAll('.dg-ta tr[data-dgl]')).find(x => x.querySelector('[data-dg="copiar"]')); const td = r.children[1]; return { cli: !!td.querySelector('[data-c="cliente"]'), proc: !!td.querySelector('[data-c="processo"]'), copia: !!td.querySelector('[data-dg="copiar"]'), alt: Math.round(r.getBoundingClientRect().height), resp: !!r.children[2].querySelector('[data-c="resp"]') && !!r.children[2].querySelector('[data-c="delegadoPor"]'), datas: r.children[5].querySelectorAll('input[type=date]').length, acoes: Array.from(r.querySelectorAll('.dg-acao [data-dg]')).map(b => b.getAttribute('data-dg')) }; });
check(linhaCP.cli && linhaCP.proc && linhaCP.copia && linhaCP.resp && linhaCP.datas === 2 && linhaCP.alt <= 72 && linhaCP.acoes.join(',') === 'concluir,mais', 'a linha: cliente e processo (com copiar) na mesma célula, responsável + "por", duas datas na célula Prazos, ações só ✓ e ⋯ (altura ' + linhaCP.alt + ' px)');
check(await page.evaluate(() => getComputedStyle(document.querySelector('.dg-ta td:first-child')).position === 'sticky'), 'a coluna Tarefa fica fixa à esquerda quando há rolagem');
// menu ⋯: ficha completa, tornar fixa e excluir (com confirmação)
await f('POST', '/api/db/delegadas', { titulo: 'Tarefa para excluir pelo menu', resp: '60456/GO', prioridade: 'Baixa', status: 'afazer', criadoEm: new Date().toISOString() });
await page.reload(); await page.waitForTimeout(3500); await page.evaluate(() => document.querySelector('#drawer [data-tab="delegadas"]').click()); await page.waitForTimeout(1200);
const idEx = (await lista()).find(d => d.titulo === 'Tarefa para excluir pelo menu').id;
await page.click('tr[data-dgl="' + idEx + '"] [data-dg="mais"]'); await page.waitForTimeout(300);
const itensMais = await t(page, '#dgDD');
check(/Abrir a ficha completa/.test(itensMais) && /Tornar fixa/.test(itensMais) && /Excluir/.test(itensMais), 'o ⋯ oferece ficha completa, tornar fixa e excluir: ' + itensMais);
await page.click('#dgDD .dg-dd-i >> text=Abrir a ficha completa'); await page.waitForTimeout(500);
check(/Tarefa para excluir pelo menu/.test(await page.locator('#dgf_titulo').inputValue()), 'a ficha completa abre pelo ⋯'); await page.click('[data-dgfa="cancelar"]'); await page.waitForTimeout(300);
await page.click('tr[data-dgl="' + idEx + '"] [data-dg="mais"]'); await page.click('#dgDD .dg-dd-i >> text=Excluir'); await page.waitForTimeout(300);
check(/Toque de novo para excluir/.test(await t(page, '#dgDD')) && (await lista()).some(d => d.id === idEx), 'excluir pede um segundo toque e ainda não apagou');
await page.click('#dgDD .dg-dd-i >> text=Toque de novo'); await page.waitForTimeout(1000);
check(!(await lista()).some(d => d.id === idEx) && !(await page.locator('tr[data-dgl="' + idEx + '"]').count()), 'o segundo toque exclui (vai para a Lixeira)');
// busca por texto (nomes únicos por execução: o banco do teste guarda o que as execuções anteriores criaram)
const U = 'q' + Math.random().toString(36).slice(2, 8), PROC = '00' + String(Math.floor(10000 + Math.random() * 89999)) + '-56.2025.8.09.0051';
await f('POST', '/api/db/delegadas', { titulo: 'Certidão ' + U + ' de objeto e pé', cliente: 'Silva ' + U + ' & Cia Ltda', processo: PROC, resp: '60456/GO', prioridade: 'Alta', status: 'afazer', fatal: dia(4), obs: 'pedir ao cartório ' + U, criadoEm: new Date().toISOString() });
await f('POST', '/api/db/delegadas', { titulo: 'Réplica ' + U + ' à contestação', cliente: 'Maria Silva ' + U, resp: '60456/GO', prioridade: 'Média', status: 'afazer', criadoEm: new Date().toISOString() });
await page.reload(); await page.waitForTimeout(3500); await page.evaluate(() => document.querySelector('#drawer [data-tab="delegadas"]').click()); await page.waitForTimeout(1200);
const nLinhas = () => page.locator('.dg-ta tr[data-dgl]').count(), todas0 = await nLinhas();
await page.fill('#dg_q', 'certidao ' + U); await page.waitForTimeout(300);
check(await nLinhas() === 1 && /^1 de \d+ tarefa /.test(await t(page, '.dg-cont')) && await page.locator('.dg-desk mark').count() >= 1, 'buscar "certidao" (sem acento) acha "Certidão" e mostra "1 de N tarefa": ' + await t(page, '.dg-cont'));
await page.fill('#dg_q', 'silva ' + U); await page.waitForTimeout(300);
check(await nLinhas() === 2 && /Silva/i.test(await page.locator('.dg-ta mark').first().innerText()), 'buscar "silva" acha nos clientes das duas tarefas e destaca o trecho');
await page.fill('#dg_q', 'silva certid ' + U); await page.waitForTimeout(300);
check(await nLinhas() === 1, 'várias palavras: precisa ter todas (em qualquer campo)');
await page.fill('#dg_q', PROC.replace(/\D/g, '')); await page.waitForTimeout(300);
check(await nLinhas() === 1, 'o número do processo acha sem pontos nem traços');
await page.fill('#dg_q', 'cartorio ' + U); await page.waitForTimeout(300);
check(await nLinhas() === 1, 'a busca também olha as observações');
await page.fill('#dg_q', 'zzzxyz'); await page.waitForTimeout(300);
check(await nLinhas() === 0 && /Nenhuma tarefa aberta com “zzzxyz”/.test(await t(page, '.dg-desk .dg-vazio')) && await page.locator('.dg-desk .dg-vazio [data-dg="limparbusca"]').count() === 1, 'sem resultado: mensagem com "Limpar busca"');
await page.click('.dg-desk .dg-vazio [data-dg="limparbusca"]'); await page.waitForTimeout(300);
check(await nLinhas() === todas0 && (await page.inputValue('#dg_q')) === '' && await page.evaluate(() => document.activeElement.id === 'dg_q'), 'limpar a busca devolve todas as tarefas e o cursor volta para o campo');
await page.fill('#dg_q', 'Tarefa já concl'); await page.waitForTimeout(300);
check(await nLinhas() === 0 && /procurar também nas Concluídas \(\d+\)/.test(await t(page, '.dg-desk .dg-vazio')), 'sem resultado nas abertas, oferece procurar nas Concluídas');
await page.click('.dg-desk [data-dg="buscaconcl"]'); await page.waitForTimeout(400);
check(/Tarefa já concluída/.test(await t(page, '#dgWrap')) && /^\d+ de \d+ conclu/.test(await t(page, '.dg-cont')), 'a busca vale também na aba Concluídas e continua: ' + await t(page, '.dg-cont'));
await page.focus('#dg_q'); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
check((await page.inputValue('#dg_q')) === '', 'Esc limpa a busca');
await page.click('.dg-aba >> text=Abertas'); await page.waitForTimeout(300);
// "Minhas atrasadas" e o número no menu
await page.evaluate(() => { const T = window.__horusTeste; T.esS.eu = { id: 'u1', papel: 'proprietario', oabs: ['60456/GO'] }; });
await page.click('.dg-aba >> text=Painel'); await page.click('.dg-aba >> text=Abertas'); await page.waitForTimeout(400);
const selo = (await page.locator('#menuNDelegadas').innerText()).trim();
check(/^\d+$/.test(selo) && Number(selo) >= 1, 'o número vermelho no menu mostra as minhas tarefas atrasadas: ' + selo);
check(await page.locator('.dg-chip-atr').count() === 1 && new RegExp('Minhas atrasadas · ' + selo).test(await t(page, '.dg-chip-atr')) && /Só atrasadas · \d+/.test(await t(page, '.dg-fil')), 'o atalho "Minhas atrasadas · N" e o total "Só atrasadas · N" aparecem nos filtros');
await page.click('.dg-chip-atr'); await page.waitForTimeout(300);
const soMinhas = await page.evaluate(() => Array.from(document.querySelectorAll('.dg-ta tr[data-dgl]')).map(r => r.querySelector('input.dg-t').value));
check(soMinhas.length === Number(selo) && soMinhas.includes('Tarefa antiga atrasada') && !soMinhas.some(x => x.includes(U)), 'tocar em "Minhas atrasadas" mostra só as minhas vencidas (' + soMinhas.length + ')');
await page.click('.dg-chip-atr'); await page.waitForTimeout(300);
check(await nLinhas() >= soMinhas.length + 1, 'tocar de novo volta a lista inteira');
// sem rolagem para os lados em 1440 px
const p14 = await abrir(1440, 900); await p14.evaluate(() => document.querySelector('#drawer [data-tab="delegadas"]').click()); await p14.waitForTimeout(1200);
const m14 = await p14.evaluate(() => { const w = document.querySelector('.dg-tw'); return { vis: w.clientWidth, tot: w.scrollWidth }; });
check(m14.tot <= m14.vis + 1, 'em 1440 px a tabela cabe inteira, sem rolar para os lados (' + m14.tot + ' de ' + m14.vis + ' px)'); if (process.env.FOTOS) await p14.screenshot({ path: process.env.FOTOS + '/delegadas-1440.png' }); await p14.close();
if (process.env.FOTOS) { await page.screenshot({ path: process.env.FOTOS + '/delegadas-1280.png' }); await page.fill('#dg_q', 'silva ' + U); await page.waitForTimeout(300); await page.screenshot({ path: process.env.FOTOS + '/delegadas-1280-busca.png' }); await page.fill('#dg_q', ''); await page.waitForTimeout(200); }
// converter as que já dizem "Tarefa Fixa"
await f('POST', '/api/db/delegadas', { titulo: 'Conferir pauta das audiências. Tarefa Fixa', resp: '60456/GO', prioridade: 'Média', status: 'afazer', fatal: dia(2), criadoEm: new Date().toISOString() });
await page.reload(); await page.waitForTimeout(3500);
await page.evaluate(() => document.querySelector('#drawer [data-tab="delegadas"]').click()); await page.waitForTimeout(1200);
check(/dizem|diz “Tarefa Fixa”|Tarefa Fixa/i.test(await t(page, '.dg-conv-av')), 'aparece o aviso para converter as tarefas que dizem "Tarefa Fixa"');
await page.click('[data-dg="convlista"]'); await page.waitForTimeout(500);
check(/Conferir pauta das audiências/.test(await t(page, '#overlayDgConvC')) && /era “Conferir pauta das audiências. Tarefa Fixa”/.test(await t(page, '#overlayDgConvC')), 'a lista de conversão mostra o nome sem a palavra e como era antes');
await page.click('[data-dgcv="converter"]'); await page.waitForTimeout(1500);
const cv = (await lista()).find(d => /Conferir pauta/.test(d.titulo));
check(cv.fixa === true && cv.repete === 'semanal' && cv.titulo === 'Conferir pauta das audiências' && !cv.fatal, 'converter vira fixa semanal, tira a palavra "Tarefa Fixa" do nome e limpa o prazo');
// Central de atenção: fixa que vence hoje, para o responsável
const dowHoje = await page.evaluate(() => new Date(Date.now() - 3 * 3600e3).getUTCDay());
await f('POST', '/api/db/delegadas', { titulo: 'Fixa que vence hoje', resp: '60456/GO', prioridade: 'Média', status: 'afazer', fixa: true, repete: 'semanal', dow: dowHoje, dia: 1, fixaDesde: '2026-01-01', feitas: {}, criadoEm: new Date().toISOString() });
await page.reload(); await page.waitForTimeout(3500);
const cen = await page.evaluate(async () => { const T = window.__horusTeste; await new Promise(r => setTimeout(r, 1500)); const e0 = T.esS.eu; T.esS.eu = { id: 'u1', papel: 'proprietario', oabs: ['60456/GO'] }; const a = T.dgTFixasAtencao().map(x => x.titulo); const id = T.dgS.docs.find(d => d.titulo === 'Fixa que vence hoje').id; await T.dgTFixaFeita(id); const b = T.dgTFixasAtencao().map(x => x.titulo); T.esS.eu = e0; return { a, b }; });
check(cen.a.includes('Fixa que vence hoje') && !cen.b.includes('Fixa que vence hoje'), 'a fixa que vence hoje aparece na Central de atenção do responsável e sai quando é marcada como feita: ' + JSON.stringify(cen));
await page.evaluate(() => document.querySelector('#drawer [data-tab="delegadas"]').click()); await page.waitForTimeout(1200);   // a página foi recarregada
// ---- Fixas (contas do escritório): linha em branco, vencimentos e Central de atenção
await page.click('.dg-aba >> text=Fixas'); await page.waitForTimeout(500);
check(await page.locator('#dg_f_titulo').isVisible() && /só lembrete/i.test(await t(page, '#dgWrap')), 'a aba Fixas tem a linha em branco e explica que é só lembrete');
await page.fill('#dg_f_titulo', 'Internet do escritório'); await page.fill('#dg_f_valor', '189,90');
await page.click('tr.dg-novo [data-c="dia"]'); await page.click('#dgDD .dg-dd-i >> text=dia 15'); await page.waitForTimeout(300);
await page.focus('#dg_f_titulo'); await page.keyboard.press('Enter'); await page.waitForTimeout(1200);
const fx = (await lista()).find(d => d.titulo === 'Internet do escritório');
check(!!fx && fx.tipo === 'fixa' && fx.valor === 189.9 && fx.repete === 'mensal' && fx.dia === 15 && fx.avisarDias === 3, 'Enter cadastra a conta: valor 189,90, todo mês, dia 15, avisar 3 dias antes');
await page.click('.dg-aba >> text=Abertas'); await page.waitForTimeout(300);
check(!(await page.evaluate(() => Array.from(document.querySelectorAll('.dg-t input.dg-t')).some(i => i.value === 'Internet do escritório'))), 'a conta fixa não aparece na lista de tarefas abertas');
// vencimentos (datas puras)
const oc = await page.evaluate(() => { const o = window.__horusTeste.dgOcorrencias; return { fev: o({ repete: 'mensal', dia: 31 }, '2026-02-01', '2026-02-28').map(x => x.data), sem: o({ repete: 'semanal', dow: 1 }, '2026-11-16', '2026-11-30').map(x => x.data), ano: o({ repete: 'anual', data: '2025-12-20' }, '2026-11-01', '2026-12-31').map(x => x.data), un: o({ repete: 'unica', data: '2026-12-05' }, '2026-11-01', '2026-12-31').map(x => x.data), mes: o({ repete: 'mensal', dia: 10 }, '2026-11-15', '2027-01-20').map(x => x.data) }; });
check(JSON.stringify(oc.fev) === '["2026-02-28"]' && JSON.stringify(oc.sem) === '["2026-11-16","2026-11-23","2026-11-30"]' && JSON.stringify(oc.ano) === '["2026-12-20"]' && JSON.stringify(oc.un) === '["2026-12-05"]' && JSON.stringify(oc.mes) === '["2026-12-10","2027-01-10"]', 'vencimentos: dia 31 vira o último dia do mês, semanal, anual, uma vez e mensal: ' + JSON.stringify(oc));
// Central de atenção: conta que vence amanhã aparece e some ao marcar como paga
const am = dia(1), dd = Number(am.slice(8, 10));
await f('POST', '/api/db/delegadas', { tipo: 'fixa', titulo: 'Anuidade que vence amanhã', valor: 450, repete: 'mensal', dia: dd, dow: 1, data: '', avisarDias: 3, resp: '', pagas: [], criadoEm: new Date().toISOString() });
await f('POST', '/api/db/delegadas', { tipo: 'fixa', titulo: 'Conta longe demais', valor: 10, repete: 'unica', dia: 1, data: dia(40), avisarDias: 3, resp: '', pagas: [], criadoEm: new Date().toISOString() });
await page.reload(); await page.waitForTimeout(3800);
await page.evaluate(() => document.querySelector('#drawer [data-tab="inicio"]').click()); await page.waitForTimeout(1200);
const cent = await t(page, '#atencaoLista');
check(/Anuidade que vence amanhã/.test(cent) && /Amanhã/.test(cent) && !/Conta longe demais/.test(cent), 'a conta que vence amanhã aparece na Central de atenção (e a que está longe, não): ' + cent.slice(0, 120));
await page.click('[data-fixa-pagar^="' + (await lista()).find(d => d.titulo === 'Anuidade que vence amanhã').id + '"]'); await page.waitForTimeout(1200);
const pg = (await lista()).find(d => d.titulo === 'Anuidade que vence amanhã');
const sumiu = !(await page.locator('#atencaoSection').isVisible()) || !/Anuidade que vence amanhã/.test(await t(page, '#atencaoLista'));   // sem nada pendente a Central inteira se esconde
check(pg.pagas.length === 1 && sumiu, 'tocar na conta marca como paga neste ciclo e ela sai da Central');
// quem vê a conta na Central: estagiário e proprietário, não o advogado
const vis = await page.evaluate(() => { const T = window.__horusTeste, x = { origem: 'fixa' }, p0 = window.__papel, r = {}; for (const p of ['proprietario', 'estagiario', 'advogado']) { window.__papel = p; r[p] = !!T.ppItemAtencaoOk(x); } window.__papel = p0; return r; });
check(vis.proprietario && vis.estagiario && !vis.advogado, 'a conta fixa aparece na Central do proprietário e do estagiário, não na do advogado: ' + JSON.stringify(vis));
check(erros.length === 0, 'computador: sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
await page.close();

// ---- celular
page = await abrir(390, 844);
await page.evaluate(() => document.querySelector('#drawer [data-tab="delegadas"]').click()); await page.waitForTimeout(1200);
check(!(await page.locator('.dg-desk').isVisible()) && await page.locator('.dg-mob').isVisible() && /atrasadas/i.test(await t(page, '.dg-mob')), 'no celular aparecem cartões agrupados (Atrasadas…), não a tabela');
if (process.env.FOTOS) { await page.screenshot({ path: process.env.FOTOS + '/delegadas-390.png' }); await page.fill('#dg_q', 'silva'); await page.waitForTimeout(300); await page.screenshot({ path: process.env.FOTOS + '/delegadas-390-busca.png' }); await page.fill('#dg_q', ''); await page.waitForTimeout(200); }
await page.click('[data-dg="fichanova"]'); await page.waitForTimeout(500);
check(await page.locator('#dgf_titulo').isVisible() && await page.locator('#dgf_resp').isVisible() && await page.locator('#dgf_fatal').isVisible() && await page.locator('#dgf_prioridade').isVisible(), 'a ficha curta tem Tarefa, Responsável, Prazo fatal e Prioridade');
await page.fill('#dgf_titulo', 'Pedir certidão pelo celular'); await page.click('[data-dgfa="salvar"]'); await page.waitForTimeout(1200);
check((await lista()).some(d => d.titulo === 'Pedir certidão pelo celular') && /Pedir certidão pelo celular/.test(await t(page, '.dg-mob')), 'salvar a ficha curta lança a tarefa e ela aparece no cartão');
const idC = (await lista()).find(d => d.titulo === 'Pedir certidão pelo celular').id;
await page.click(`.dg-card[data-dgl="${idC}"] [data-dg="concluir"]`); await page.waitForTimeout(900);
check((await lista()).find(d => d.id === idC).status === 'concluida', 'o botão Concluir do cartão conclui');
check(erros.length === 0, 'celular: sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
