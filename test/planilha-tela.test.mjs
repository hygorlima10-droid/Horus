// Planilha ⇄ Agenda (tela): Configurações › Planilha de tarefas (ligar, quem é quem), selo "Planilha" nos cartões e "Também na planilha" ao criar.
// Use: node test/rodar.mjs planilha-tela
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8815', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const r0 = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.92' } }); const ck = r0.headers.get('set-cookie').split(';')[0];
const f = (m, p, b) => fetch(B + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(async r => ({ s: r.status, j: await r.json().catch(() => ({})) }));
const dia = n => new Date(Date.now() - 3 * 3600e3 + n * 864e5).toISOString().slice(0, 10);
const br = await chromium.launch(); const page = await (await br.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'America/Sao_Paulo' })).newPage(); await page.route(/fonts\./, x => x.abort());
await page.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { } });
const erros = []; page.on('pageerror', e => erros.push(String(e)));
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(3500);
const t = async sel => (await page.locator(sel).innerText()).replace(/\s+/g, ' ');
// 1) a tela aparece em Configurações e começa desligada
await page.evaluate(() => document.querySelector('#drawer [data-tab="configuracoes"]').click()); await page.waitForTimeout(700);
check(/Planilha de tarefas/.test(await t('#cfWrap')), 'Configurações tem a linha "Planilha de tarefas"');
await page.click('[data-cf="planilha"]'); await page.waitForTimeout(800);
check(/ainda não está ligada/.test(await t('#overlayPlanilhaC')) && await page.locator('[data-pl="ligar"]').isVisible(), 'desligada: explica e oferece "Ligar a planilha"');
await page.click('[data-pl="ligar"]'); await page.waitForTimeout(900);
check(/Aguardando a planilha/.test(await t('#overlayPlanilhaC')) && /Copiar script/.test(await t('#overlayPlanilhaC')) && /ligarAoHorus/.test(await t('#overlayPlanilhaC')), 'ligada: mostra "Aguardando a planilha" e os 3 passos com "Copiar script"');
// 2) o script da planilha conversa (simulado)
const script = await fetch(B + '/api/planilha/script', { headers: { cookie: ck } }).then(r => r.text()); const chave = /HORUS_CHAVE = '([^']+)'/.exec(script)[1];
const sync = (corpo) => fetch(B + '/api/planilha-sync', { method: 'POST', headers: { authorization: 'Bearer ' + chave, 'content-type': 'application/json' }, body: JSON.stringify(corpo) }).then(r => r.json());
const L = (o) => ({ linha: 4, cliente: '', processo: '', titulo: '', resp: '', delegado: '', prio: '', status: '', fatal: '', interno: '', fixa: false, obs: '', id: '', ...o });
const r1 = await sync({ planilha: 'Controle de Petições e Tarefas', url: 'https://docs.google.com/spreadsheets/d/abc/edit', completo: true, integrantes: [{ nome: 'Hygor', funcao: 'Advogado' }, { nome: 'Kamyla', funcao: 'Estagiária' }, { nome: 'Luiza', funcao: 'Estagiária' }],
  linhas: [L({ linha: 4, processo: '5170137-60.2026.8.09.0108', titulo: 'Planilha de cálculo e andamento', resp: 'Kamyla', delegado: 'Hygor', prio: 'Alta', status: 'Aguardando cliente', fatal: dia(3), interno: dia(1) })] });
await page.click('[data-pl="atualizar"]'); await page.waitForTimeout(900);
const tp = await t('#overlayPlanilhaC');
check(/Conectada/.test(tp) && /1 tarefas abertas ligadas/.test(tp) && /Abrir a planilha/.test(tp), 'depois da conversa: "Conectada", 1 tarefa ligada e link para abrir a planilha');
check(['Hygor', 'Kamyla', 'Luiza'].every(n => tp.includes(n)) && (await page.locator('[data-pl="convite"]').count()) === 3, 'o "Quem é quem" lista os 3 nomes, cada um com "Criar convite" (ainda sem usuário no app)');
check(/Despesas do Murilo/.test(tp) && /Prazo fatal e “trabalhar até”/.test(tp), 'e mostra o que acompanha nas duas vias');
await page.click('#overlayPlanilha [data-sg="fechar"]').catch(() => page.evaluate(() => document.getElementById('overlayPlanilha').classList.remove('show')));
await page.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
// o processo da tarefa está cadastrado com o Hygor como advogado: isso NÃO pode fazer dele o responsável da tarefa da planilha
await f('POST', '/api/db/processos', { numero: '5170137-60.2026.8.09.0108', partes: 'Wancley x Eurico', cliente: 'Wancley', advogados: [{ oab: '60456/GO', nome: 'Hygor Lima Andrade' }, { oab: '49308/GO', nome: 'Murilo Falone Rocha' }] });
// 3) o selo na Agenda
await page.reload(); await page.waitForTimeout(3500);
await page.evaluate(() => document.querySelector('#drawer [data-tab="agenda"]').click()); await page.waitForTimeout(900);
await page.evaluate(() => { const b = Array.from(document.querySelectorAll('.md-abas button')).filter(x => x.offsetParent).find(x => /Lista/.test(x.innerText)); if (b) b.click(); }); await page.waitForTimeout(600);
const cardDe = (re) => page.evaluate((src) => { const r = new RegExp(src); const c = Array.from(document.querySelectorAll('.agc')).find(x => r.test(x.innerText)); return c ? c.innerText.replace(/\s+/g, ' ') : ''; }, re.source);
// a agenda "Minha" é por RESPONSÁVEL: tarefa que delego a outra pessoa (Kamyla, sem usuário) não aparece nela, só no Escritório
check(!(await cardDe(/Planilha de cálculo/)), 'delegada a outra pessoa: NÃO aparece em "Minha agenda"');
await page.click('#esBarra .es-b[data-k="escritorio"]'); await page.waitForTimeout(700);
const card = await cardDe(/Planilha de cálculo/);
check(/Planilha/.test(card) && /delegado por Hygor/.test(card) && /aguardando cliente/.test(card) && /Kamyla \(sem acesso\)/.test(card) && !/sem responsável/.test(card), 'cartão da Agenda: selo "Planilha", "delegado por Hygor", "aguardando cliente" e "Kamyla (sem acesso)": ' + card.slice(0, 160));
check(await page.evaluate(() => { const c = Array.from(document.querySelectorAll('.agc')).find(x => /Planilha de cálculo/.test(x.innerText)); return !!c && !!c.querySelector('.agc-sem[title*="Kamyla"]') && !!c.querySelector('.agc-proc') && c.querySelectorAll('.agc-av:not(.agc-sem)').length === c.querySelectorAll('.agc-proc .agc-av').length; }), 'responsável = só Kamyla (bolinha tracejada, sem acesso); os advogados do processo aparecem à parte, pequenos, em "processo"');
// 4) criar no app com "Também na planilha"
await page.click('[data-ag="novo"]'); await page.waitForTimeout(600);
check(await page.locator('#age_plan').isChecked(), 'ao criar, "Também na planilha" já vem ligado');
await page.evaluate(() => { const b = Array.from(document.querySelectorAll('#age_seg button')).find(x => /Tarefa/.test(x.innerText)); if (b) b.click(); }); await page.waitForTimeout(300);
await page.fill('#age_tit', 'Delegada pelo app'); await page.fill('#age_data', dia(5));
await page.evaluate(() => { const v = document.getElementById('age_vis'); if (v) { v.value = 'so_eu'; v.dispatchEvent(new Event('change', { bubbles: true })); } });
await page.click('[data-age="salvar"]'); await page.waitForTimeout(1500);
const docs = (await f('GET', '/api/db/agenda')).j.docs.map(d => d.data), dApp = docs.find(d => d.titulo === 'Delegada pelo app');
check(dApp && dApp.planilha === true, 'o item criado no app guarda "planilha: true"');
const r2 = await sync({ completo: true, integrantes: [], linhas: [L({ linha: 4, id: r1.ids[0].id, processo: '5170137-60.2026.8.09.0108', titulo: 'Planilha de cálculo e andamento', resp: 'Kamyla', delegado: 'Hygor', prio: 'Alta', status: 'Aguardando cliente', fatal: dia(3), interno: dia(1) })] });
check(r2.novas.length === 1 && r2.novas[0].campos.titulo === 'Delegada pelo app' && r2.novas[0].campos.fatalManual === dia(5), 'na conversa seguinte a planilha recebe a linha nova');
// 5) editar um item da planilha mostra "Ligado à planilha"
await page.evaluate(() => { const c = Array.from(document.querySelectorAll('.agc')).find(x => /Planilha de cálculo/.test(x.innerText)); c.querySelector('.agc-t').click(); }); await page.waitForTimeout(500);
await page.evaluate(() => { const b = document.querySelector('[data-agd="editar"], [data-ag="abrir"]'); if (b) b.click(); }); await page.waitForTimeout(600);
check(/Ligado à planilha/.test(await page.evaluate(() => (document.getElementById('agEdCorpo') || { innerText: '' }).innerText)), 'ao editar um item ligado, o editor mostra "Ligado à planilha" (sem o botão)');
// seletor de responsáveis: Kamyla e Luiza aparecem como estagiárias sem acesso, e o responsável atual é só a Kamyla
await page.evaluate(() => { const b = document.querySelector('[data-esr="abrir"]'); if (b) b.click(); }); await page.waitForTimeout(400);
const lista = await page.evaluate(() => (document.querySelector('.es-lista') || { innerText: '' }).innerText.replace(/\s+/g, ' '));
check(/Estagiárias \(sem acesso ao app\)/i.test(lista) && /Kamyla/.test(lista) && /Luiza/.test(lista) && /Advogados/i.test(lista), 'o seletor de responsáveis tem o grupo "Estagiárias (sem acesso ao app)" com Kamyla e Luiza: ' + lista.slice(0, 160));
check(await page.evaluate(() => Array.from(document.querySelectorAll('.es-chip')).map(x => x.innerText.trim()).join('|')) === 'Kamyla', 'o editor mostra só a Kamyla como responsável (não os advogados do processo)');
check(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
