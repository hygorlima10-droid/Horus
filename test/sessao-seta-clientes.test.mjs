// Testa a seta com todos os clientes na ficha do processo e o tipo de audiência "Sessão de julgamento (sustentação oral)" (campos, tarefa de inscrição, avisos, exclusão).
// Suba antes:  node test/rodar.mjs sessao-seta-clientes
// Suba antes (banco novo):
//   npx wrangler d1 execute controle-juridico --local --persist-to /tmp/dev-data-pub --file schema.sql
//   npx wrangler dev --local --persist-to /tmp/dev-data-pub --var SENHA:senha-de-teste-123 --port 8812
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8812', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10), agora = new Date().toISOString();
const hojeLocal = new Date().toLocaleDateString('sv-SE');
const dia = n => new Date(Date.parse(hoje + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
let r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.13' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const f = (m, p, b) => fetch(B + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(async x => ({ s: x.status, j: await x.json().catch(() => ({})) }));
const docs = async col => (await f('GET', '/api/db/' + col)).j.docs.map(d => ({ id: d.id, ...d.data }));
for (const col of ['casos', 'termosAcordo', 'alvaras', 'clientes', 'despesas', 'receitasManuais', 'metas', 'saldos', 'config', 'extratos', 'obraMov', 'prazosPub', 'agenda', 'processos']) for (const d of (await f('GET', '/api/db/' + col)).j.docs || []) await f('DELETE', '/api/db/' + col + '/' + d.id);
const N1 = '5000777-02.2024.8.09.0107';
for (const [id, nome, tel] of [['k1', 'Carla Gama', '(64) 99999-3333'], ['k2', 'Ana Alfa', ''], ['k3', 'Bruno Beta', '(62) 98888-2222']]) await f('PUT', '/api/db/clientes/' + id, { nome, telefone: tel, pagador: 'cliente', criadoEm: agora });
await f('PUT', '/api/db/processos/p1', { numero: N1, partes: 'Fulano x Banco', orgao: 'TJGO', classe: 'Execução', clienteIds: [], honorarios: 'sem', origem: 'manual', derivado: true, arquivado: false, criadoEm: agora });
const br = await chromium.launch(); const page = await (await br.newContext({ viewport: { width: 1100, height: 900 } })).newPage(); const erros = []; page.on('pageerror', e => erros.push(e.message)); await page.route(/fonts\./, r => r.abort());
await page.addInitScript(() => { try { if (!localStorage.getItem('horus.subaba.v1')) localStorage.setItem('horus.subaba.v1', JSON.stringify({ sub: { processos: 'lista', agenda: 'semana', publicacoes: 'naolidas', clientes: 'lista' }, per: 6 })); } catch (e) { /* sem armazenamento */ } });
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(3000);
const vis = sel => page.evaluate(s => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && e.getClientRects().length > 0; }, sel);

// ---- 1) seta com todos os clientes ----
await page.evaluate(() => document.querySelector('#drawer [data-tab="processos"]').click()); await page.waitForTimeout(900);
await page.evaluate(n => document.querySelector('[data-pr-card="' + n + '"]').click(), N1.replace(/\D/g, '')); await page.waitForTimeout(600);
await page.evaluate(() => document.querySelector('[data-prf="aba"][data-v="dados"]').click()); await page.waitForTimeout(300);
const seta = await page.evaluate(() => { const b = document.querySelector('#prCorpo .cli-seta'); const r = b ? b.getBoundingClientRect() : { width: 0, height: 0 }; return { tem: !!b, w: r.width, h: r.height }; });
check(seta.tem && seta.w >= 36 && seta.h >= 36, 'o campo "Clientes vinculados" tem a seta ▾ (36 px)');
await page.click('#prCorpo .cli-seta'); await page.waitForTimeout(300);
let nomes = await page.evaluate(() => Array.from(document.querySelectorAll('#pr_sugl .cli-sug-item')).map(e => e.querySelector('b').innerText));
check(nomes.join('|') === 'Ana Alfa|Bruno Beta|Carla Gama', 'a seta abre todos os clientes em ordem alfabética: ' + nomes.join(', '));
check(await vis('#pr_clisq') && /\(64\) 99999-3333/.test(await page.evaluate(() => document.getElementById('pr_sugl').innerText)), 'a lista tem a busca no topo e mostra o telefone');
if (process.env.FOTOS) await page.locator('#overlayPr .modal').screenshot({ path: process.env.FOTOS + '/seta-clientes.png' });
await page.fill('#pr_clisq', 'bru'); await page.waitForTimeout(250);
nomes = await page.evaluate(() => Array.from(document.querySelectorAll('#pr_sugl .cli-sug-item')).map(e => e.innerText.replace(/\s+/g, ' ').trim()));
check(nomes.length === 2 && /Bruno Beta/.test(nomes[0]) && /Cadastrar “bru”/.test(nomes[1]), 'a busca filtra pelo nome e oferece cadastrar no fim: ' + nomes.join(' | '));
await page.click('#pr_sugl [data-prf="cli-add"]'); await page.waitForTimeout(300);
check(/Bruno Beta/.test(await page.evaluate(() => document.getElementById('pr_chips').innerText)) && !(await vis('#pr_sug')) , 'tocar no cliente vincula e fecha a lista');
await page.click('#prCorpo .cli-seta'); await page.waitForTimeout(300);
nomes = await page.evaluate(() => Array.from(document.querySelectorAll('#pr_sugl .cli-sug-item b')).map(e => e.innerText));
check(nomes.join('|') === 'Ana Alfa|Carla Gama', 'quem já está vinculado sai da lista: ' + nomes.join(', '));
await page.fill('#pr_clisq', 'zzz'); await page.waitForTimeout(250); await page.click('#pr_sugl [data-prf="cli-new"]'); await page.waitForTimeout(500);
check(await page.evaluate(() => document.getElementById('overlayClienteEdit').classList.contains('show') && document.getElementById('cliNomeInput').value === 'zzz'), '"Cadastrar" no fim da lista abre o cadastro de cliente com o nome digitado');
await page.evaluate(() => { document.getElementById('overlayClienteEdit').classList.remove('show'); document.getElementById('overlayPr').classList.remove('show'); });

// ---- 2) sessão de julgamento ----
const SES = 'Sessão de julgamento (sustentação oral)';
await page.evaluate(d => window.__horusTeste.fichas.agAbrir(null, { tipo: 'audiencia', titulo: 'Apelação — Cooperativa', processo: '5000777-02.2024.8.09.0107', cliente: 'Cooperativa Mista', data: d, hora: '14:00' }), dia(10)); await page.waitForTimeout(600);
check(await page.evaluate(s => Array.from(document.querySelectorAll('#age_audtipo option')).some(o => o.value === s), SES) && await page.evaluate(() => Array.from(document.querySelectorAll('#age_mod option')).some(o => /Plenário virtual/.test(o.textContent))), 'o tipo "Sessão de julgamento (sustentação oral)" e a modalidade "Plenário virtual" estão nas listas');
check(!(await vis('#age_ses_box')), 'os campos da sessão ficam escondidos nos outros tipos');
await page.selectOption('#age_audtipo', SES); await page.waitForTimeout(200);
check(await vis('#age_ses_box') && !(await vis('#age_ses_insc')) && /Data da sessão/.test(await page.evaluate(() => document.getElementById('age_data_l').textContent)), 'escolher o tipo mostra órgão julgador e relator; a inscrição só aparece com "Vou fazer sustentação oral"');
await page.fill('#age_ses_org', '2ª Turma Cível — TJGO'); await page.fill('#age_ses_rel', 'Des. Fulana de Tal'); await page.click('#age_ses_sust'); await page.waitForTimeout(200);
check(await vis('#age_ses_insc'), 'marcar "Vou fazer sustentação oral" mostra "Pedir inscrição até"');
if (process.env.FOTOS) await page.locator('#overlayAg .modal').screenshot({ path: process.env.FOTOS + '/sessao-julgamento.png' });
await page.fill('#age_ses_ate', dia(12)); await page.click('[data-age="salvar"]'); await page.waitForTimeout(400);
check(/precisa ser até a data da sessão/.test(await page.evaluate(() => document.getElementById('age_erro').textContent)), 'inscrição depois da sessão é recusada');
await page.fill('#age_ses_ate', dia(8)); await page.fill('#age_ses_hora', '18:00'); await page.click('[data-age="salvar"]'); await page.waitForTimeout(1500);
let ag = (await docs('agenda')); const aud = ag.find(x => x.tipo === 'audiencia'), tar = ag.find(x => x.sessaoDe);
check(aud && aud.audTipo === SES && aud.sessao && aud.sessao.orgao === '2ª Turma Cível — TJGO' && aud.sessao.relator === 'Des. Fulana de Tal' && aud.sessao.sustentar === true && aud.sessao.inscAte === dia(8), 'a audiência guarda órgão julgador, relator, sustentação e prazo de inscrição');
check(tar && tar.tipo === 'tarefa' && tar.sessaoDe === aud.id && tar.data === dia(8) && tar.hora === '18:00' && /Pedir inscrição para sustentação oral/.test(tar.titulo) && JSON.stringify(tar.avisos) === '[2,1,0]' && !tar.concluido, 'nasce a tarefa "Pedir inscrição para sustentação oral" na data limite, com avisos 2 dias, 1 dia e no dia');
await page.evaluate(() => document.querySelector('#drawer [data-tab="agenda"]').click()); await page.waitForTimeout(900);
for (const v of ['lista', 'meudia']) { await page.evaluate(v => document.querySelector('[data-ag="vista"][data-v="' + v + '"]').click(), v); await page.waitForTimeout(700); }
await page.evaluate(() => document.querySelector('[data-ag="vista"][data-v="lista"]').click()); await page.waitForTimeout(700);
const cartao = await page.evaluate(() => document.getElementById('agCorpo').innerText.replace(/\s+/g, ' '));
check(/Sustentação oral/.test(cartao) && /2ª Turma Cível — TJGO/.test(cartao) && /inscrição até/.test(cartao) && /Pedir inscrição para sustentação oral/.test(cartao), 'a Lista da Agenda mostra o selo "Sustentação oral", o órgão julgador, "inscrição até" e a tarefa da inscrição');
await page.evaluate(() => document.querySelector('[data-ag="vista"][data-v="meudia"]').click()); await page.waitForTimeout(700);
check(!/Não consegui montar/.test(await page.evaluate(() => document.getElementById('agCorpo').innerText)), 'o Meu dia continua montando com uma sessão de julgamento na Agenda');
// marcar inscrição feita: a tarefa é concluída
await page.evaluate(id => window.__horusTeste.fichas.agAbrir('a:' + id), aud.id); await page.waitForTimeout(500);
check(await page.evaluate(() => document.getElementById('age_ses_org').value) === '2ª Turma Cível — TJGO' && await page.evaluate(() => document.getElementById('age_ses_sust').checked), 'ao reabrir, os campos da sessão voltam preenchidos');
await page.click('#age_ses_feita'); await page.click('[data-age="salvar"]'); await page.waitForTimeout(1500);
ag = await docs('agenda');
check(ag.find(x => x.sessaoDe).concluido === true && ag.filter(x => x.sessaoDe).length === 1, '"Inscrição já feita" conclui a tarefa (sem criar outra)');
// desmarcar a sustentação: a tarefa some
await page.evaluate(id => window.__horusTeste.fichas.agAbrir('a:' + id), aud.id); await page.waitForTimeout(500);
await page.click('#age_ses_sust'); await page.click('[data-age="salvar"]'); await page.waitForTimeout(1500);
ag = await docs('agenda');
check(!ag.some(x => x.sessaoDe) && ag.find(x => x.tipo === 'audiencia').sessao.sustentar === false, 'desmarcar a sustentação remove a tarefa da inscrição');
// excluir a sessão leva junto a tarefa
await page.evaluate(id => window.__horusTeste.fichas.agAbrir('a:' + id), aud.id); await page.waitForTimeout(500);
await page.click('#age_ses_sust'); await page.fill('#age_ses_ate', dia(8)); await page.click('[data-age="salvar"]'); await page.waitForTimeout(1500);
check((await docs('agenda')).some(x => x.sessaoDe), 'marcar de novo recria a tarefa');
await page.evaluate(id => window.__horusTeste.fichas.agAbrir('a:' + id), aud.id); await page.waitForTimeout(500);
await page.click('[data-age="excluir"]'); await page.click('[data-age="excluir"]'); await page.waitForTimeout(1500);
check((await docs('agenda')).length === 0, 'excluir a sessão exclui também a tarefa da inscrição');
check(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
