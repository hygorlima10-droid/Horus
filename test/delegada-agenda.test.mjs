// Tarefa delegada criada de dentro de uma tarefa da Agenda (complementar, ex.: tirar as custas do agravo) e a janela "Adiar" por cima da ficha do prazo.
// Servidor do grupo 'principal':  node test/rodar.mjs delegada-agenda
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8812', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10), agora = new Date().toISOString();
const dia = n => new Date(Date.parse(hoje + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10), br_ = iso => iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);
const r0 = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.97' } }); const ck = r0.headers.get('set-cookie').split(';')[0];
const f = async (m, p, b) => { const x = await fetch(B + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }); return { s: x.status, j: await x.json().catch(() => ({})) }; };
const ag = async () => ((await f('GET', '/api/db/agenda')).j.docs || []).map(d => ({ id: d.id, ...d.data }));
for (const col of ['agenda', 'processos', 'clientes', 'casos', 'config', 'alvaras']) for (const d of (await f('GET', '/api/db/' + col)).j.docs || []) await f('DELETE', '/api/db/' + col + '/' + d.id);
await f('PUT', '/api/db/config/backup', { ultimoEm: agora }); await f('PUT', '/api/db/config/importacaoAuto', { ativo: false, desde: agora }); await f('PUT', '/api/db/config/processosIgnorados', { numeros: {} }); await f('PUT', '/api/db/config/vinculoIniciais', { corte: hoje });
const N1 = '5392788-08.2026.8.09.0107', N2 = '6064267-09.2026.8.09.0108';
await f('PUT', '/api/db/clientes/cli1', { nome: 'Maria Aparecida Souza', telefone: '(62) 99876-5432', pagador: 'cliente', criadoEm: agora });
await f('PUT', '/api/db/clientes/cli2', { nome: 'Cooperativa Teste', pagador: 'cliente', criadoEm: agora });
await f('PUT', '/api/db/processos/d' + N1.replace(/\D/g, ''), { numero: N1, partes: 'Maria Aparecida Souza x Banco Gama S.A.', orgao: 'TJGO · Morrinhos · 1º Vara Cível', classe: 'Procedimento Comum', valorCausa: 15000, clienteIds: ['cli1'], honorarios: 'sem', arquivado: false, origem: 'manual', criadoEm: agora });
const base = { situacao: 'afazer', concluido: false, avisos: [5, 2, 1, 0], criadoEm: agora, pubId: '', audPubId: '' };
await f('PUT', '/api/db/agenda/p1', { ...base, tipo: 'prazo', titulo: 'Contestação', processo: N1, cliente: 'Maria Aparecida Souza', clienteIds: ['cli1'], data: dia(-3), responsaveis: ['Estagiários', 'Hygor Lima Andrade'], partes: ['Maria Aparecida Souza'], obs: 'Juntar procuração e comprovante.', subtipo: 'Contestação - CPC art. 335', prioridade: 'Alta', origem: 'controljus', codigoControlJus: 'PROC-466', trabalhar: dia(-5) });
await f('PUT', '/api/db/agenda/a1', { ...base, tipo: 'audiencia', titulo: 'audiência de conciliação', processo: N2, cliente: 'Cooperativa Teste', clienteIds: ['cli2'], data: dia(2), hora: '13:00', audTipo: 'Conciliação', modalidade: 'online', local: 'Sala virtual do TJGO', link: 'https://meet.google.com/abc-defg-hij', responsaveis: ['Hygor Lima Andrade'] });
await f('PUT', '/api/db/agenda/a2', { ...base, tipo: 'audiencia', titulo: 'audiência CEJUS', processo: '', cliente: 'Outro Cliente', data: dia(2), hora: '13:30', audTipo: 'Conciliação', modalidade: 'presencial', local: 'Fórum de Morrinhos', responsaveis: ['Murilo Falone Rocha'] });
await f('PUT', '/api/db/agenda/t1', { ...base, tipo: 'tarefa', titulo: 'Juntar planilha', processo: '', cliente: '', data: dia(5) });
await f('PUT', '/api/db/agenda/p2', { ...base, tipo: 'prazo', titulo: 'manifestar saneamento', processo: '5368644-67.2026.8.09.0107', cliente: 'Cliente Sem Cadastro', data: dia(7), responsaveis: ['Murilo Falone Rocha'] });
const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'America/Sao_Paulo', permissions: ['clipboard-read', 'clipboard-write'] });
await ctx.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { /* sem armazenamento */ } window.__abertos = []; window.open = (u) => { window.__abertos.push(String(u)); return null; }; });
const page = await ctx.newPage(); const erros = []; page.on('pageerror', e => erros.push(e.message)); await page.route(/fonts\./, x => x.abort());
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(4000);
const t = s => page.evaluate(s => (document.querySelector(s) || {}).innerText || '', s);
const vis = s => page.evaluate(s => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && e.getClientRects().length > 0; }, s);
await page.evaluate(() => document.querySelector('#drawer [data-tab="agenda"]').click()); await page.waitForTimeout(900);

await f('PUT', '/api/db/agenda/ag1', { ...base, tipo: 'prazo', titulo: 'Agravo de Instrumento', processo: N1, cliente: 'Maria Aparecida Souza', clienteIds: ['cli1'], data: dia(6), trabalhar: dia(3) });
await page.reload(); await page.waitForTimeout(3500);
await page.evaluate(() => document.querySelector('#drawer [data-tab="agenda"]').click()); await page.waitForTimeout(900);
await page.evaluate(() => { const c = document.querySelector('[data-k="a:ag1"]'); if (c) c.click(); }); await page.waitForTimeout(800);
check(await vis('#overlayAgDet.show') && /Agravo de Instrumento/.test(await t('#agdC')), 'abre a ficha do prazo "Agravo de Instrumento"');
check(await page.evaluate(() => !!document.querySelector('#agdC [data-agd="delegar"]')) && /Tarefas delegadas/.test(await t('#agdC')), 'a ficha da tarefa tem o botão "Criar tarefa delegada"');
// "Adiar…" abre por cima da ficha (antes ficava atrás)
await page.evaluate(() => document.querySelector('#agdC [data-agd="adiar"]').click()); await page.waitForTimeout(600);
check(await page.evaluate(() => { const o = [...document.querySelectorAll('.overlay.show')], u = o[o.length - 1]; if (!u || u.id === 'overlayAgDet') return false; const r = u.querySelector('.modal').getBoundingClientRect(), x = document.elementFromPoint(r.x + r.width / 2, r.y + 40); return !!x && !!x.closest('#' + u.id) && document.body.lastElementChild === u; }), '"Adiar…" abre por CIMA da ficha do prazo e dá para tocar nela');
await page.evaluate(() => { const o = [...document.querySelectorAll('.overlay.show')].pop(); if (o && o.id !== 'overlayAgDet'){ const x = o.querySelector('[id$="X"], .icon-btn'); if (x) x.click(); else o.classList.remove('show'); } }); await page.waitForTimeout(300);
// criar a tarefa delegada complementar
await page.evaluate(() => document.querySelector('#agdC [data-agd="delegar"]').click()); await page.waitForTimeout(600);
check(await vis('#overlayAgDg.show') && /Agravo de Instrumento/.test(await t('#overlayAgDgC')) && /N1/.test('N1') && (await page.evaluate(() => document.getElementById('agdg_obs').value)).includes('Complementar à tarefa “Agravo de Instrumento”'), 'a janela da delegada abre por cima, mostra de qual tarefa vem e já traz a observação "Complementar à tarefa …"');
await page.click('#overlayAgDg [data-agdg="lancar"]'); await page.waitForTimeout(300);
check(/Digite a tarefa/.test(await t('#agdg_erro')), 'sem escrever a tarefa não lança');
await page.fill('#agdg_titulo', 'Tirar as custas do agravo de instrumento');
await page.click('#agdg_pess [data-agdg="resp"] >> nth=0'); await page.click('#agdg_prazos [data-agdg="prazo"] >> nth=1');
await page.click('#overlayAgDg [data-agdg="lancar"]'); await page.waitForTimeout(1500);
const dg = ((await f('GET', '/api/db/delegadas')).j.docs || []).map(d => ({ id: d.id, ...d.data })).filter(d => d.agendaKey === 'a:ag1');
check(dg.length === 1 && dg[0].titulo === 'Tirar as custas do agravo de instrumento' && dg[0].processo === N1 && dg[0].cliente === 'Maria Aparecida Souza' && dg[0].status === 'afazer' && dg[0].fatal === dia(1) && !!dg[0].resp && dg[0].agendaTitulo === 'Agravo de Instrumento', 'a tarefa delegada nasce ligada ao processo, ao cliente e à tarefa da Agenda, com responsável e prazo ' + JSON.stringify(dg[0] && { p: dg[0].processo, a: dg[0].agendaKey, f: dg[0].fatal }));
check(!(await vis('#overlayAgDg.show')) && /Tirar as custas do agravo de instrumento/.test(await t('#agdC')), 'a janela fecha e a ficha da tarefa passa a listar a delegada criada');
await page.evaluate(() => document.querySelector('#agdC [data-agd="dgt"]').click()); await page.waitForTimeout(900);
check(await page.evaluate(() => [...document.querySelectorAll('.overlay.show')].some((o) => /Dg/.test(o.id) || /Tirar as custas/.test(o.innerText))), 'tocar na delegada listada abre a ficha dela nas Delegadas');
check(erros.length === 0, 'sem erros de script' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
