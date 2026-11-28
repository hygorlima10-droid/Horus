// Tarefa delegada criada de dentro da publicação (terceiro botão). Servidor do grupo 'permissoes':  node test/rodar.mjs delegada-publicacao
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8816', TOK = 'tok-dono-0000000000000000000000000001';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const api = async (m, p, b) => { const x = await fetch(B + p, { method: m, headers: { cookie: 'sessao=' + TOK, 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined }); let j = null; try { j = await x.json(); } catch (e) { } return { s: x.status, j }; };
const dia = (n) => new Date(Date.now() - 3 * 3600e3 + n * 864e5).toISOString().slice(0, 10);
const minhas = async () => ((await api('GET', '/api/db/delegadas')).j.docs || []).filter((d) => d.data && d.data.pubId);
const limpar = async () => { for (const d of await minhas()) await api('DELETE', '/api/db/delegadas/' + d.id); await api('POST', '/api/djen/marcar', { ids: ['103'], lida: null, semPrazo: null, tratada: false }); };
await limpar();
const br = await chromium.launch();
const ctx = await br.newContext({ viewport: { width: 420, height: 900 } }); await ctx.addCookies([{ name: 'sessao', value: TOK, url: B }]);
const p = await ctx.newPage(); p.erros = []; p.on('pageerror', (e) => p.erros.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/fonts\.|Failed to load resource/.test(m.text())) p.erros.push('console: ' + m.text()); });
await p.route(/fonts\./, (x) => x.abort()); await p.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { } });
await p.goto(B + '/'); await p.waitForFunction(() => window.__horusEu && window.__horusEu.pronto && window.__horusTeste && window.__horusTeste.pbCriarDelegada, null, { timeout: 60000 }); await p.waitForTimeout(2500);
const visivel = (sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return getComputedStyle(e).display !== 'none' && r.width > 0 && r.height > 0; }, sel);
const abrirPub = async (id) => {
  await p.evaluate(() => document.querySelector('#drawer [data-tab="publicacoes"]').click()); await p.waitForTimeout(1500);
  await p.evaluate(() => window.__horusTeste.pbCarregar(true)); await p.waitForTimeout(1500);
  await p.evaluate((i) => window.__horusTeste.pbAbrirDetalhe(i), id); await p.waitForSelector('#overlayPb.show', { timeout: 10000 }); await p.waitForTimeout(400);
};

console.log('\n— o botão na ficha da publicação');
await abrirPub('103');
const botoes = await p.evaluate(() => [...document.querySelectorAll('#overlayPb [data-pbd="aud-livre"], #overlayPb [data-pbd="tarefa"], #overlayPb [data-pbd="delegada"]')].map((b) => b.textContent.trim()));
check(botoes.join('|') === 'Criar audiência|Criar tarefa|Criar tarefa delegada', 'a seção tem os três botões, o novo por último: ' + botoes.join(' | '));
check(/agenda e tarefas/i.test(await p.locator('#overlayPb').innerText()), 'a seção passou a se chamar "Agenda e tarefas"');
await p.click('#overlayPb [data-pbd="delegada"]'); await p.waitForTimeout(500);

console.log('\n— a folha curta');
check(await visivel('#overlayPbDg.show'), 'abre a folha "Tarefa delegada"');
check(/Proc\. \d/i.test(await p.locator('#overlayPbDg .pr-hon-cab').innerText()) && /via publicação/i.test(await p.locator('#overlayPbDg .pr-hon-cab').innerText()), 'o cabeçalho mostra o processo e "via publicação"');
check(/^Providência/.test(await p.inputValue('#pbdg_titulo')), 'a tarefa já vem com um título para ajustar');
check(await p.evaluate(() => document.querySelectorAll('#pbdg_pess .pbdg-p.on').length) === 0 && await p.evaluate(() => document.querySelectorAll('#pbdg_pess .pbdg-p').length) >= 3, 'ninguém vem escolhido em "Quem faz": é preciso tocar numa pessoa (B)');
check(await p.evaluate(() => document.getElementById('pbdg_tratada').checked), 'a caixa "Marcar a publicação como tratada" já vem marcada (A)');
check(await p.evaluate(() => { const d = document.querySelector('#overlayPbDg details.f-mais'); return !!d && !d.open && d.contains(document.getElementById('pbdg_trabalhar')); }) && /trabalhar até/i.test(await p.locator('#overlayPbDg details.f-mais summary').innerText()), '"Trabalhar até" fica dentro de "Mais detalhes", fechado (C)');
const alts = await p.evaluate(() => [...document.querySelectorAll('#overlayPbDg .pbdg-p, #overlayPbDg .pbdg-c, #overlayPbDg .f-rod-in .btn')].map((b) => Math.round(b.getBoundingClientRect().height)));
check(alts.length >= 10 && alts.every((h) => h >= 36), 'todos os botões da folha têm altura de toque (' + Math.min(...alts) + ' px no menor)');

if (process.env.FOTOS) { await p.screenshot({ path: process.env.FOTOS + '/delegada-folha.png' }); await p.evaluate(() => document.getElementById('overlayPbDg').classList.remove('show')); await p.screenshot({ path: process.env.FOTOS + '/delegada-ficha-pub.png' }); await p.evaluate(() => document.getElementById('overlayPbDg').classList.add('show')); }
console.log('\n— lançar para uma pessoa, com prazo');
const chaveBruno = await p.evaluate(() => { const c = [...document.querySelectorAll('#pbdg_pess .pbdg-p')].find((x) => /Bruno/.test(x.textContent)); return c ? c.getAttribute('data-k') : ''; });
check(!!chaveBruno, 'o Bruno aparece entre as pessoas');
await p.fill('#pbdg_titulo', 'Juntar procuração e comprovante de endereço');
await p.click('#pbdg_pess .pbdg-p[data-k="' + chaveBruno + '"]'); await p.click('#pbdg_prazos [data-d="' + dia(1) + '"]'); await p.click('#pbdg_prios [data-v="Alta"]');
await p.click('#overlayPbDg details.f-mais summary'); await p.fill('#pbdg_obs', 'Ver modelo na pasta do cliente'); await p.fill('#pbdg_trabalhar', dia(0));
check(await p.evaluate(() => document.querySelector('#pbdg_pess .pbdg-p.on') !== null && document.querySelector('#pbdg_prazos .pbdg-c.on').textContent === 'Amanhã' && document.querySelector('#pbdg_prios .pbdg-c.on').textContent === 'Alta'), 'pessoa, prazo e prioridade ficam destacados');
await p.click('#pbdg_lancar'); await p.waitForTimeout(1500);
let ds = await minhas(); const t1 = ds.map((d) => d.data).find((d) => d.titulo === 'Juntar procuração e comprovante de endereço');
check(!!t1 && t1.resp === chaveBruno && t1.fatal === dia(1) && t1.prioridade === 'Alta' && t1.status === 'afazer' && t1.pubId === '103' && t1.trabalhar === dia(0) && t1.obs === 'Ver modelo na pasta do cliente' && !!t1.delegadoPor && /\d{7}/.test(t1.processo), 'a tarefa nasce em Delegadas: responsável Bruno, fatal amanhã, Alta, afazer, ligada à publicação e ao processo: ' + JSON.stringify(t1 && { resp: t1.resp, fatal: t1.fatal, pubId: t1.pubId, processo: t1.processo }));
check(!(await visivel('#overlayPbDg.show')), 'a folha fecha depois de lançar');
const pub = (await api('GET', '/api/djen/lista')).j.pubs.find((x) => x.id === '103');
check(pub.lida === true && (pub.tratadas || []).some((t) => t.como === 'delegada'), 'a publicação ficou tratada (como "delegada")');
check(/tarefa delegada · Bruno · até/.test(await p.locator('#overlayPb').innerText()), 'a ficha da publicação mostra a etiqueta "tarefa delegada · Bruno · até dd/mm"');
check(!((await api('GET', '/api/db/agenda')).j.docs || []).some((d) => d.data && /procuração e comprovante/.test(d.data.titulo || '')), 'a tarefa NÃO foi para a Agenda');

console.log('\n— etiqueta abre a tarefa; "via publicação" nas Delegadas');
await p.click('#overlayPb [data-pbd="dgt"]'); await p.waitForTimeout(600);
check(await visivel('#overlayDg.show') && /procuração/.test(await p.inputValue('#dgf_titulo')), 'tocar na etiqueta abre a tarefa na ficha das Delegadas');
await p.evaluate(() => document.querySelectorAll('.overlay.show').forEach((o) => o.classList.remove('show')));
await p.evaluate(() => document.querySelector('#drawer [data-tab="delegadas"]').click()); await p.waitForTimeout(1200);
check(/via publicação/.test(await p.locator('#dgWrap').innerText()), 'na aba Delegadas a tarefa mostra "via publicação"');
await p.evaluate(() => document.querySelector('#drawer [data-tab="publicacoes"]').click()); await p.waitForTimeout(800);
check(await p.evaluate(() => /data-pb="dgt"/.test(window.__horusTeste.pbCartaoHtml('103'))), 'no cartão da lista também aparece a etiqueta');

console.log('\n— sem escolher pessoa fica para mim; sem marcar tratada; título vazio');
await api('POST', '/api/djen/marcar', { ids: ['103'], tratada: false }); await p.evaluate(() => window.__horusTeste.pbCarregar(true)); await p.waitForTimeout(800);
await p.evaluate(() => window.__horusTeste.pbCriarDelegada('103')); await p.waitForTimeout(500);
await p.fill('#pbdg_titulo', ''); await p.click('#pbdg_lancar'); await p.waitForTimeout(300);
check(/Digite a tarefa/.test(await p.locator('#pbdg_erro').innerText()) && (await minhas()).length === 1, 'título vazio: avisa e não cria');
await p.fill('#pbdg_titulo', 'Conferir andamento'); await p.evaluate(() => { document.getElementById('pbdg_tratada').click(); });
await p.click('#pbdg_lancar'); await p.waitForTimeout(1500);
ds = await minhas(); const t2 = ds.map((d) => d.data).find((d) => d.titulo === 'Conferir andamento');
check(!!t2 && !!t2.resp && t2.resp === t2.delegadoPor && t2.fatal === '' && t2.prioridade === 'Média', 'sem escolher pessoa, a tarefa fica para quem lançou (média, sem prazo)');
const pub1 = (await api('GET', '/api/djen/lista')).j.pubs.find((x) => x.id === '103');
check(!(pub1.tratadas || []).some((t) => t.como === 'delegada'), 'com a caixa desmarcada, a publicação não é marcada como tratada');
check(p.erros.length === 0, 'sem erros de JavaScript ' + p.erros.join(' | '));
await limpar(); await br.close();
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo.'); process.exit(falhas ? 1 : 0);
