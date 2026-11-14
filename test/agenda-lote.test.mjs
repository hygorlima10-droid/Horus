// Agenda: ações em vários itens (Selecionar): Peça pronta, Adiar o trabalho, Responsável, Concluir e Excluir, com tudo-ou-nada no servidor, limite e Desfazer.
// Use: node test/rodar.mjs agenda-lote
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8802', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const agora = new Date().toISOString(), hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const dia = n => new Date(Date.parse(hoje + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
let r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.65' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const api = (m, p, b) => fetch(B + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
for (const col of ['agenda', 'processos', 'casos', 'clientes', 'diasSemExpediente']) { const j = await (await api('GET', '/api/db/' + col)).json(); for (const d of j.docs) await api('DELETE', '/api/db/' + col + '/' + d.id); }
await api('PUT', '/api/db/config/backup', { ultimoEm: agora });
const todos = async () => (await (await api('GET', '/api/db/agenda')).json()).docs.map(d => ({ id: d.id, ...d.data }));
const por = async (t) => (await todos()).find(d => d.titulo === t);
const novo = async (o) => (await (await api('POST', '/api/db/agenda', Object.assign({ situacao: 'afazer', concluido: false, avisos: [5, 2, 1, 0], criadoEm: agora }, o))).json()).id;
await novo({ tipo: 'prazo', titulo: 'Lote P1', cliente: 'C1', data: dia(30), trabalhar: hoje });
await novo({ tipo: 'prazo', titulo: 'Lote P2', cliente: 'C2', data: dia(30), trabalhar: hoje });
await novo({ tipo: 'prazo', titulo: 'Lote P3 fatal hoje', cliente: 'C3', data: hoje, trabalhar: dia(-2) });
await novo({ tipo: 'tarefa', titulo: 'Lote T1', cliente: 'C4', data: hoje });
await novo({ tipo: 'tarefa', titulo: 'Lote T2 repete', cliente: 'C5', data: hoje, repete: { tipo: 'util', n: 1, ancora: hoje, serie: 'sx1', proxUtil: true, fim: { tipo: 'nunca' }, modelo: { titulo: 'Lote T2 repete', cliente: 'C5', processo: '', obs: '', avisos: [5, 2, 1, 0], resp: [], compartilhada: false } } });
await novo({ tipo: 'audiencia', titulo: 'Lote audiência', cliente: 'C6', data: dia(3), hora: '10:00' });
const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 420, height: 900 }, timezoneId: 'America/Sao_Paulo' }); const page = await ctx.newPage(); const erros = []; page.on('pageerror', e => erros.push(e.message)); await page.route(/fonts\./, x => x.abort());
await page.addInitScript(() => { try { localStorage.setItem('horus.subaba.v1', JSON.stringify({ sub: { agenda: 'lista' }, per: 6 })); } catch (e) { } });
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(3000);
await page.evaluate(() => document.querySelector('#drawer [data-tab="agenda"]').click()); await page.waitForTimeout(1200);
const txt = (s) => page.evaluate((s) => (document.querySelector(s) || {}).innerText || '', s).then(t => t.replace(/\s+/g, ' '));
const sel = (t) => page.evaluate((t) => { const e = Array.from(document.querySelectorAll('#agCorpo .agsel')).find(x => x.querySelector('.agc-t') && x.querySelector('.agc-t').innerText === t); if (e) e.click(); return !!e; }, t);
const barra = (a) => page.evaluate((a) => { const b = document.querySelector('#agSelBarra [data-lt="' + a + '"]'); if (b && !b.disabled) b.click(); return !!b && !b.disabled; }, a);
const sair = async () => { await page.evaluate(() => { const b = document.querySelector('#agSelBarra [data-lt="sair"]'); if (b) b.click(); }); await page.waitForTimeout(300); };
const entrar = async () => { await page.evaluate(() => document.querySelector('[data-ag="selmodo"]').click()); await page.waitForTimeout(500); };
const espera = (ms = 1300) => page.waitForTimeout(ms);

check(await page.evaluate(() => !!document.querySelector('[data-ag="selmodo"]')), 'a Lista tem o botão "Selecionar"');
await entrar();
check(await page.evaluate(() => !!document.getElementById('agSelBarra') && document.querySelectorAll('#agCorpo .agsel').length >= 6), 'ao selecionar, aparece a barra de ações e cada cartão ganha a caixinha');
await sel('Lote P1'); await sel('Lote P2'); await sel('Lote T1');
check(/3 selecionados/.test(await txt('#agSelBarra')), 'tocar nos cartões seleciona (3 selecionados) e não abre a ficha: ' + (await page.evaluate(() => !document.querySelector('.overlay.show'))));

console.log('\n— Peça pronta em lote');
check(await barra('pronta'), 'a barra oferece "Peça pronta"'); await espera();
let p1 = await por('Lote P1'), p2 = await por('Lote P2'), t1 = await por('Lote T1');
check(p1.situacao === 'pronta' && p2.situacao === 'pronta' && p1.prontaEm === hoje && !p1.concluido && t1.situacao === 'afazer', 'os 2 prazos ficam com a peça pronta (continuam abertos); a tarefa não muda');
check(/2 peças marcadas como prontas/.test(await page.evaluate(() => document.getElementById('toast').innerText)), 'o aviso conta 2 peças e que 1 item ficou de fora');
await page.evaluate(() => document.querySelector('#toast button').click()); await espera();
p1 = await por('Lote P1'); p2 = await por('Lote P2'); check(p1.situacao === 'afazer' && !p1.prontaEm && p2.situacao === 'afazer', '"Desfazer" volta o lote inteiro');

console.log('\n— Adiar o trabalho em lote');
await sel('Lote P1'); await sel('Lote P2'); await sel('Lote T1'); await sel('Lote P3 fatal hoje');
check(await barra('adiar'), 'a barra oferece "Adiar o trabalho"'); await page.waitForTimeout(400);
check(/não muda em lote/.test(await txt('#ltC')) && /podem ser adiados/.test(await txt('#ltC')), 'a folha explica que o prazo fatal não muda em lote');
const rap = await page.evaluate(() => document.querySelector('[data-ltf="adiar-rapido"]').getAttribute('data-d'));
await page.evaluate(() => document.querySelector('[data-ltf="adiar-rapido"]').click()); await espera();
p1 = await por('Lote P1'); p2 = await por('Lote P2'); t1 = await por('Lote T1'); const p3 = await por('Lote P3 fatal hoje');
check(p1.trabalhar === rap && p1.data === dia(30) && p2.trabalhar === rap && t1.data === rap, 'o dia de trabalhar dos prazos e a data da tarefa vão para ' + rap + ', sem mexer no prazo fatal');
check(p3.trabalhar === dia(-2) && p3.data === hoje, 'o prazo que passaria do fatal fica de fora');
await page.evaluate(() => document.querySelector('#toast button').click()); await espera();
p1 = await por('Lote P1'); t1 = await por('Lote T1'); check(p1.trabalhar === hoje && t1.data === hoje, '"Desfazer" volta as datas');

console.log('\n— Responsável em lote');
await page.evaluate(() => window.__horusTeste.ltDefinirEquipe([{ oab: '11111/GO', nome: 'Ana Advogada' }, { oab: '22222/GO', nome: 'Bruno Advogado' }]));
await sel('Lote T1'); await sel('Lote P1'); await barra('resp'); await page.waitForTimeout(400);
await page.evaluate(() => { document.querySelector('#ltC [data-ltr="11111/GO"]').click(); document.querySelector('[data-ltf="resp-ok"]').click(); }); await espera();
t1 = await por('Lote T1'); p1 = await por('Lote P1');
check(JSON.stringify(t1.resp) === '["11111/GO"]' && JSON.stringify(p1.resp) === '["11111/GO"]', 'Responsável: acrescenta a pessoa nos 2 itens');
await sel('Lote T1'); await sel('Lote P1'); await barra('resp'); await page.waitForTimeout(400);
await page.evaluate(() => { document.querySelector('#ltC [data-ltr="22222/GO"]').click(); document.querySelector('#ltRespModo [data-ltm="subst"]').click(); document.querySelector('[data-ltf="resp-ok"]').click(); }); await espera();
t1 = await por('Lote T1'); check(JSON.stringify(t1.resp) === '["22222/GO"]', 'Substituir troca o responsável');

console.log('\n— Concluir em lote (e tarefa que se repete)');
await sel('Lote P2'); await sel('Lote T2 repete'); await barra('concluir'); await page.waitForTimeout(400);
check(/1 prazo vira “peça protocolada”/.test(await txt('#ltC')) && /Tarefas que se repetem criam a próxima/.test(await txt('#ltC')), 'a folha explica: prazo vira peça protocolada e tarefa que repete cria a próxima');
await page.evaluate(() => document.querySelector('[data-ltf="concluir-ok"]').click()); await espera(1800);
p2 = await por('Lote P2'); let t2 = (await todos()).filter(d => d.titulo === 'Lote T2 repete').sort((a, b) => a.data.localeCompare(b.data));
check(p2.concluido === true && p2.protocoladoEm === hoje && p2.situacao === 'feito', 'o prazo foi concluído com a data do protocolo');
check(t2.length === 2 && t2[0].concluido === true && t2[1].concluido === false && t2[1].repete.n === 2, 'a tarefa que se repete foi concluída e a próxima foi criada');
await page.evaluate(() => document.querySelector('#toast button').click()); await espera(1800);
p2 = await por('Lote P2'); t2 = (await todos()).filter(d => d.titulo === 'Lote T2 repete');
check(p2.concluido === false && t2.length === 1 && t2[0].concluido === false, '"Desfazer" reabre os dois e apaga a próxima ocorrência criada');

console.log('\n— Excluir em lote');
await sel('Lote T1'); await barra('excluir'); await page.waitForTimeout(400);
check(/Lixeira/.test(await txt('#ltC')), 'a folha avisa que vai para a Lixeira');
await page.evaluate(() => document.querySelector('[data-ltf="excluir-ok"]').click()); await espera();
check(!(await por('Lote T1')), 'o item foi excluído');
await page.evaluate(() => document.querySelector('#toast button').click()); await espera();
t1 = await por('Lote T1'); check(!!t1 && t1.titulo === 'Lote T1', '"Desfazer" traz o item de volta');

console.log('\n— limite de 25');
for (let k = 0; k < 28; k++) await novo({ tipo: 'tarefa', titulo: 'Massa ' + k, data: dia(1 + (k % 5)) });
await sair(); await page.reload(); await page.waitForTimeout(3000); await page.evaluate(() => document.querySelector('#drawer [data-tab="agenda"]').click()); await page.waitForTimeout(1200);
await page.evaluate(() => document.querySelector('[data-ag="vista"][data-v="lista"]').click()); await page.waitForTimeout(500); await entrar();
await page.evaluate(() => document.querySelector('#agSelBarra [data-lt="todos"]').click()); await page.waitForTimeout(400);
check(/25 selecionados/.test(await txt('#agSelBarra')), 'Selecionar todos os visíveis para em 25 (o máximo por vez)');
await sair();
check(await page.evaluate(() => !document.getElementById('agSelBarra') && !document.querySelector('#agCorpo .agsel')), 'Cancelar sai do modo de seleção');
check(erros.length === 0, 'sem erros de script' + (erros.length ? ': ' + erros[0] : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTUDO CERTO'); process.exit(falhas ? 1 : 0);
