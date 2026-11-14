// Tarefas que se repetem: regras de cada tipo (motor), editor, próxima criada ao concluir (presa ao calendário, sem acumular), "só esta" × "esta e as próximas", fim e desfazer.
// Use: node test/rodar.mjs tarefas-repetem
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8802', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const agora = new Date().toISOString();
let r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.64' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const api = (m, p, b) => fetch(B + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
for (const col of ['agenda', 'processos', 'casos', 'clientes', 'diasSemExpediente']) { const j = await (await api('GET', '/api/db/' + col)).json(); for (const d of j.docs) await api('DELETE', '/api/db/' + col + '/' + d.id); }
await api('PUT', '/api/db/config/backup', { ultimoEm: agora });
const docs = async (t) => (await (await api('GET', '/api/db/agenda')).json()).docs.map(d => ({ id: d.id, ...d.data })).filter(d => !t || d.titulo === t || (d.repete && d.repete.modelo && d.repete.modelo.titulo === t)).sort((a, b) => a.data.localeCompare(b.data));
const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 420, height: 900 }, timezoneId: 'America/Sao_Paulo' }); const page = await ctx.newPage(); const erros = []; page.on('pageerror', e => erros.push(e.message)); await page.route(/fonts\./, x => x.abort());
await page.addInitScript(() => { try { localStorage.setItem('horus.subaba.v1', JSON.stringify({ sub: { agenda: 'lista' }, per: 6 })); } catch (e) { } });
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(3000);
const P = (rep, anc, ref) => page.evaluate(([rep, anc, ref]) => window.__horusTeste.rpProxima(rep, anc, ref), [rep, anc, ref]);

console.log('\n— regras de repetição (motor)');
let n = await P({ tipo: 'util' }, '2026-11-13', '2026-11-13'); check(n && n.data === '2026-11-16', 'todo dia útil: depois de sexta, segunda (16/11)');
n = await P({ tipo: 'semana', dias: [1] }, '2026-11-16', '2026-11-18'); check(n && n.data === '2026-11-23', 'toda segunda, concluída na quarta: a próxima continua sendo segunda (23/11), presa ao calendário');
n = await P({ tipo: 'semana', dias: [1] }, '2026-10-05', '2026-11-14'); check(n && n.agendada === '2026-11-16', 'não acumula atrasadas: ficou semanas parada, a próxima é a futura mais próxima (16/11)');
n = await P({ tipo: 'semana', dias: [1, 3, 5] }, '2026-11-16', '2026-11-16'); check(n && n.data === '2026-11-18', 'segundas, quartas e sextas: depois de segunda, quarta');
n = await P({ tipo: 'mes', diaMes: 15 }, '2026-10-15', '2026-11-14'); check(n && n.agendada === '2026-11-15' && n.data === '2026-11-16', 'todo dia 15: 15/11 é domingo, vai para o próximo dia útil (16/11)');
n = await P({ tipo: 'mes', diaMes: 15, proxUtil: false }, '2026-10-15', '2026-11-14'); check(n && n.data === '2026-11-15', 'com a opção desligada, fica no domingo (15/11)');
n = await P({ tipo: 'mes', diaMes: 'ultimo' }, '2026-10-30', '2026-10-31'); check(n && n.data === '2026-11-30', 'último dia útil do mês: 30/11');
n = await P({ tipo: 'mes', diaMes: 31 }, '2026-01-31', '2026-01-31'); check(n && n.agendada === '2026-02-28', 'dia 31 em fevereiro: usa o último dia do mês (28/02)');
n = await P({ tipo: 'outro', intervalo: 10, unidade: 'dia' }, '2026-11-01', '2026-11-14'); check(n && n.agendada === '2026-11-21' && n.data === '2026-11-23', 'a cada 10 dias: 21/11 (sábado) vai para 23/11');
n = await P({ tipo: 'outro', intervalo: 3, unidade: 'mes' }, '2026-01-31', '2026-01-31'); check(n && n.agendada === '2026-04-30', 'a cada 3 meses a partir de 31/01: 30/04');
n = await P({ tipo: 'outro', intervalo: 2, unidade: 'semana' }, '2026-11-16', '2026-11-16'); check(n && n.agendada === '2026-11-30', 'a cada 2 semanas: 30/11');
n = await P({ tipo: 'semana', dias: [1], fim: { tipo: 'data', data: '2026-11-20' } }, '2026-11-16', '2026-11-16'); check(n === null, 'termina em uma data: não passa dela');
check((await P({ tipo: 'util', n: 3, fim: { tipo: 'vezes', vezes: 3 } }, '2026-11-13', '2026-11-13')) === null && (await P({ tipo: 'util', n: 2, fim: { tipo: 'vezes', vezes: 3 } }, '2026-11-13', '2026-11-13')) !== null, 'termina depois de N vezes: na 3ª de 3 não cria a próxima');
const l = await page.evaluate(() => window.__horusTeste.rpListar({ tipo: 'semana', dias: [1], n: 1 }, '2026-11-16', 3));
check(JSON.stringify(l) === JSON.stringify(['2026-11-23', '2026-11-30', '2026-12-07']), 'a prévia lista as próximas datas');
const tx = await page.evaluate(() => [window.__horusTeste.rpTexto({ tipo: 'semana', dias: [1] }), window.__horusTeste.rpTexto({ tipo: 'mes', diaMes: 'ultimo' }), window.__horusTeste.rpTexto({ tipo: 'outro', intervalo: 2, unidade: 'semana', fim: { tipo: 'vezes', vezes: 4 }, n: 1 })]);
check(tx[0] === 'toda segunda-feira' && /último dia útil/.test(tx[1]) && /a cada 2 semanas/.test(tx[2]) && /4 vezes/.test(tx[2]), 'os textos: ' + tx.join(' | '));

console.log('\n— editor, conclusão e desfazer');
await page.evaluate(() => document.querySelector('#drawer [data-tab="agenda"]').click()); await page.waitForTimeout(1200);
const set = async (id, v, ev = 'change') => { await page.evaluate(([id, v, ev]) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event(ev, { bubbles: true })); }, [id, v, ev]); await page.waitForTimeout(150); };
const novaTarefa = async (titulo, data, cfg) => {
  await page.evaluate(() => document.querySelector('#agWrap [data-ag="novo"]').click()); await page.waitForTimeout(500);
  await page.evaluate(() => document.querySelector('#overlayAg [data-age="tipo"][data-v="tarefa"]').click()); await page.waitForTimeout(200);
  await set('age_tit', titulo, 'input'); await set('age_data', data);
  await set('age_rep', cfg.tipo); if (cfg.fim) { await set('age_rep_fim', cfg.fim); if (cfg.fv) await set('age_rep_fv', String(cfg.fv), 'input'); }
  await page.evaluate(() => document.querySelector('#overlayAg [data-age="salvar"]').click()); await page.waitForTimeout(1300);
};
await page.evaluate(() => document.querySelector('[data-ag="novo"]') || 0);
await page.evaluate(() => document.querySelector('[data-ag="vista"][data-v="lista"]').click()); await page.waitForTimeout(400);
check(await page.evaluate(() => { document.querySelector('#agWrap [data-ag="novo"]').click(); return true; }), 'abre o editor'); await page.waitForTimeout(400);
await page.evaluate(() => document.querySelector('#overlayAg [data-age="tipo"][data-v="tarefa"]').click()); await page.waitForTimeout(300);
check(await page.evaluate(() => document.getElementById('age_rep_box').style.display !== 'none'), 'tarefa: aparece a seção "Repetir"');
await page.evaluate(() => document.querySelector('#overlayAg [data-age="tipo"][data-v="prazo"]').click()); await page.waitForTimeout(200);
check(await page.evaluate(() => document.getElementById('age_rep_box').style.display === 'none'), 'prazo: não aparece (só tarefas repetem)');
await page.evaluate(() => document.getElementById('overlayAg').classList.remove('show'));
await novaTarefa('Conferir publicações (teste)', '2030-04-01', { tipo: 'semana', fim: 'vezes', fv: 2 });
let a = await docs('Conferir publicações (teste)');
check(a.length === 1 && a[0].repete && a[0].repete.tipo === 'semana' && JSON.stringify(a[0].repete.dias) === '[1]' && a[0].repete.n === 1 && a[0].repete.serie && a[0].repete.modelo.titulo === 'Conferir publicações (teste)', 'a tarefa é salva com a regra (toda segunda), a série e o modelo');
await page.evaluate(() => document.querySelector('[data-ag="vista"][data-v="lista"]').click()); await page.waitForTimeout(600);
check(await page.evaluate(() => Array.from(document.querySelectorAll('#agCorpo .agc')).some(e => /Conferir publicações \(teste\)/.test(e.innerText) && /↻ toda segunda-feira/.test(e.innerText))), 'o cartão mostra "↻ toda segunda-feira · 2 vezes"');
const concluir = (t) => page.evaluate((t) => { const c = Array.from(document.querySelectorAll('#agCorpo .agc')).find(e => e.querySelector('.agc-t') && e.querySelector('.agc-t').innerText === t && !e.querySelector('.agc-ok.on')); c.querySelector('.agc-ok').click(); }, t);
await concluir('Conferir publicações (teste)'); await page.waitForTimeout(1500);
a = await docs('Conferir publicações (teste)');
check(a.length === 2 && a[0].concluido === true && a[1].concluido === false && a[1].data === '2030-04-08' && a[1].repete.n === 2 && a[1].criadaAuto === true, 'concluir cria a próxima (segunda 08/04/2030), aberta, com n = 2');
check(/Concluída\. Próxima: seg 08\/04/.test(await page.evaluate(() => document.getElementById('toast').innerText)), 'o aviso diz "Concluída. Próxima: seg 08/04"');
await page.evaluate(() => document.querySelector('#toast button').click()); await page.waitForTimeout(1500);
a = await docs('Conferir publicações (teste)');
check(a.length === 1 && a[0].concluido === false && a[0].data === '2030-04-01', '"Desfazer" apaga a próxima e reabre a tarefa');
await page.evaluate(() => document.querySelector('[data-ag="vista"][data-v="lista"]').click()); await page.waitForTimeout(500);
await concluir('Conferir publicações (teste)'); await page.waitForTimeout(1400);
await page.evaluate(() => document.querySelector('[data-ag="vista"][data-v="lista"]').click()); await page.waitForTimeout(500);
await concluir('Conferir publicações (teste)'); await page.waitForTimeout(1400);
a = await docs('Conferir publicações (teste)');
check(a.length === 2 && a.every(x => x.concluido) && /repetição terminou/.test(await page.evaluate(() => document.getElementById('toast').innerText)), 'na 2ª de 2 vezes a repetição termina: não cria a terceira');

console.log('\n— só esta × esta e as próximas × parar');
await novaTarefa('Série B (teste)', '2030-05-06', { tipo: 'semana' });
await page.evaluate(() => document.querySelector('[data-ag="vista"][data-v="lista"]').click()); await page.waitForTimeout(500);
await concluir('Série B (teste)'); await page.waitForTimeout(1400);
const editar = async (titulo, novoTit, escopo) => {
  await page.evaluate(() => document.querySelector('[data-ag="vista"][data-v="lista"]').click()); await page.waitForTimeout(500);
  await page.evaluate((t) => Array.from(document.querySelectorAll('#agCorpo .agc')).find(e => e.querySelector('.agc-t').innerText === t && !e.querySelector('.agc-ok.on')).querySelector('[data-ag="abrir"]').click(), titulo); await page.waitForTimeout(600);
  await set('age_tit', novoTit, 'input'); if (escopo) await page.evaluate((v) => { document.querySelector('input[name="age_rep_esc"][value="' + v + '"]').click(); }, escopo);
  await page.evaluate(() => document.querySelector('#overlayAg [data-age="salvar"]').click()); await page.waitForTimeout(1300);
};
await editar('Série B (teste)', 'Só desta ocorrência', 'esta');
let c2 = (await docs()).find(x => x.titulo === 'Só desta ocorrência');
check(!!c2 && c2.repete.modelo.titulo === 'Série B (teste)', '"Só esta": o título muda nesta ocorrência e o modelo da série continua o mesmo');
await page.evaluate(() => document.querySelector('[data-ag="vista"][data-v="lista"]').click()); await page.waitForTimeout(500);
await concluir('Só desta ocorrência'); await page.waitForTimeout(1400);
let c3 = (await docs()).find(x => x.titulo === 'Série B (teste)' && !x.concluido);
check(!!c3 && c3.data === '2030-05-20', 'a próxima volta ao título da série (' + (c3 && c3.data) + ')');
await editar('Série B (teste)', 'Série B renomeada', 'prox');
await page.evaluate(() => document.querySelector('[data-ag="vista"][data-v="lista"]').click()); await page.waitForTimeout(500);
await concluir('Série B renomeada'); await page.waitForTimeout(1400);
let c4 = (await docs()).find(x => x.titulo === 'Série B renomeada' && !x.concluido);
check(!!c4 && c4.data === '2030-05-27', '"Esta e as próximas": a próxima já vem com o novo título (' + (c4 && c4.data) + ')');
// parar de repetir
await page.evaluate(() => document.querySelector('[data-ag="vista"][data-v="lista"]').click()); await page.waitForTimeout(500);
await page.evaluate(() => Array.from(document.querySelectorAll('#agCorpo .agc')).find(e => e.querySelector('.agc-t').innerText === 'Série B renomeada' && !e.querySelector('.agc-ok.on')).querySelector('[data-ag="abrir"]').click()); await page.waitForTimeout(600);
await set('age_rep', 'nao'); await page.evaluate(() => document.querySelector('#overlayAg [data-age="salvar"]').click()); await page.waitForTimeout(1300);
c4 = (await docs()).find(x => x.id === c4.id); check(!c4.repete, '"Não repete" para a série nesta tarefa');
const antes = (await docs()).length;
await page.evaluate(() => document.querySelector('[data-ag="vista"][data-v="lista"]').click()); await page.waitForTimeout(500);
await concluir('Série B renomeada'); await page.waitForTimeout(1300);
check((await docs()).length === antes, 'concluir uma tarefa que deixou de repetir não cria próxima');
check(erros.length === 0, 'sem erros de script' + (erros.length ? ': ' + erros[0] : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTUDO CERTO'); process.exit(falhas ? 1 : 0);
