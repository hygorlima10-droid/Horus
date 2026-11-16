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
check(/−5 úteis|−4 úteis|−3 úteis/.test(await t(page, '.dg-desk')), 'o prazo vencido mostra os dias úteis em atraso: ' + (await t(page, '.dg-desk')).match(/−\d+ úteis?/));
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
check(erros.length === 0, 'computador: sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
await page.close();

// ---- celular
page = await abrir(390, 844);
await page.evaluate(() => document.querySelector('#drawer [data-tab="delegadas"]').click()); await page.waitForTimeout(1200);
check(!(await page.locator('.dg-desk').isVisible()) && await page.locator('.dg-mob').isVisible() && /atrasadas/i.test(await t(page, '.dg-mob')), 'no celular aparecem cartões agrupados (Atrasadas…), não a tabela');
await page.click('[data-dg="fichanova"]'); await page.waitForTimeout(500);
check(await page.locator('#dgf_titulo').isVisible() && await page.locator('#dgf_resp').isVisible() && await page.locator('#dgf_fatal').isVisible() && await page.locator('#dgf_prioridade').isVisible(), 'a ficha curta tem Tarefa, Responsável, Prazo fatal e Prioridade');
await page.fill('#dgf_titulo', 'Pedir certidão pelo celular'); await page.click('[data-dgfa="salvar"]'); await page.waitForTimeout(1200);
check((await lista()).some(d => d.titulo === 'Pedir certidão pelo celular') && /Pedir certidão pelo celular/.test(await t(page, '.dg-mob')), 'salvar a ficha curta lança a tarefa e ela aparece no cartão');
const idC = (await lista()).find(d => d.titulo === 'Pedir certidão pelo celular').id;
await page.click(`.dg-card[data-dgl="${idC}"] [data-dg="concluir"]`); await page.waitForTimeout(900);
check((await lista()).find(d => d.id === idC).status === 'concluida', 'o botão Concluir do cartão conclui');
check(erros.length === 0, 'celular: sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
