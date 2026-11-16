// O script que vai dentro da planilha (Apps Script), executado de verdade contra o servidor, com uma planilha de mentira em memória:
// lê as linhas, grava ID e hora, aplica o que o app mandou (status, linha nova) e não duplica. Use: node test/rodar.mjs planilha-script
import { execFileSync } from 'node:child_process';
const B = process.env.BASE || 'http://127.0.0.1:8815', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const r0 = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.93' } }); const ck = r0.headers.get('set-cookie').split(';')[0];
const f = (m, p, b) => fetch(B + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(async r => ({ s: r.status, j: await r.json().catch(() => ({})) }));
await f('POST', '/api/planilha/ligar');
const script = await fetch(B + '/api/planilha/script', { headers: { cookie: ck } }).then(r => r.text());

/* ---- planilha de mentira ---- */
const NL = 1502, NC = 17, cel = Array.from({ length: NL + 1 }, () => Array(NC + 1).fill('')), form = {};
const D = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d, 12)); };
const col = (s) => s.split('').reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0);
const a1 = (s) => { const m = /^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/.exec(s); const c1 = col(m[1]), r1 = +m[2]; return m[3] ? [r1, c1, +m[4] - r1 + 1, col(m[3]) - c1 + 1] : [r1, c1, 1, 1]; };
const range = (r, c, nr = 1, nc = 1) => { if (typeof r === 'string') [r, c, nr, nc] = a1(r); return {
  getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => cel[r + i][c + j])),
  setValues: (v) => { v.forEach((l, i) => l.forEach((x, j) => { cel[r + i][c + j] = x; })); return this; },
  setValue: (v) => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) cel[r + i][c + j] = v; }, getValue: () => cel[r][c],
  getFormulas: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => form[(r + i) + ',' + (c + j)] || '')), getFormula: () => form[r + ',' + c] || '',
  clearContent: () => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) cel[r + i][c + j] = ''; }, copyTo: () => { }, protect: () => ({ setDescription() { return this; }, setWarningOnly() { return this; } }) }; };
const sheet = (nome) => ({ getName: () => nome, getRange: range, getMaxRows: () => NL, setColumnWidth() { } });
const listas = { getRange: () => ({ getValues: () => [['Hygor', 'Advogado'], ['Kamyla', 'Estagiária'], ['Luiza', 'Estagiária'], ['', ''], ['', ''], ['', ''], ['Todos', 'só filtro da Agenda'], ['Como editar', '']] }) };
const ss = { getSheetByName: (n) => (n === 'Controle' ? sheet('Controle') : (n === 'Listas' ? listas : null)), getName: () => 'Controle de Petições e Tarefas', getUrl: () => 'https://docs.google.com/spreadsheets/d/xyz/edit', getSpreadsheetTimeZone: () => 'America/Sao_Paulo' };
const props = {};
const http = (url, o) => { const a = ['-s', '-X', (o.method || 'get').toUpperCase(), '-w', '\n%{http_code}']; for (const [k, v] of Object.entries(o.headers || {})) a.push('-H', k + ': ' + v); if (o.contentType) a.push('-H', 'content-type: ' + o.contentType); if (o.payload) a.push('-d', o.payload); a.push(url);
  const out = execFileSync('curl', a, { encoding: 'utf8' }), i = out.lastIndexOf('\n'); return { getResponseCode: () => Number(out.slice(i + 1)), getContentText: () => out.slice(0, i) }; };
const G = { SpreadsheetApp: { getActive: () => ss, getUi: () => ({ alert() { } }), CopyPasteType: { PASTE_FORMAT: 1 } }, UrlFetchApp: { fetch: http },
  Utilities: { formatDate: (d, tz, fmt) => (fmt === 'yyyy-MM-dd' ? d.toISOString().slice(0, 10) : 'ts-' + Date.now()) }, LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() { } }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) }, ScriptApp: { newTrigger: () => ({ timeBased() { return this; }, everyMinutes() { return this; }, forSpreadsheet() { return this; }, onEdit() { return this; }, create() { } }), getProjectTriggers: () => [], deleteTrigger() { } }, console };
const S = new Function(...Object.keys(G), script + '\nreturn { sincronizarHorus: sincronizarHorus, ligarAoHorus: ligarAoHorus };')(...Object.values(G));
const linha = (n, o) => { const v = { 2: o.proc || '', 3: o.tit || '', 4: o.resp || '', 5: o.delegado || '', 6: o.prio || '', 7: o.status || '', 12: o.fatal ? D(o.fatal) : '', 13: o.interno ? D(o.interno) : '', 15: o.obs || '' }; for (const [c, x] of Object.entries(v)) cel[n][c] = x; };
const ag = async () => (await f('GET', '/api/db/agenda')).j.docs.map(d => ({ id: d.id, ...d.data }));

linha(4, { proc: '\r\n5170137-60.2026.8.09.0108', tit: 'Planilha de cálculo e andamento', resp: 'Kamyla', delegado: 'Hygor', prio: 'Média', status: 'Em revisão', fatal: '2026-11-18', interno: '2026-11-13' });
linha(5, { tit: 'lembrar impugnação', resp: 'Luiza', status: 'Concluída', fatal: '2026-11-18' });
linha(6, { tit: 'Olhar processos de outros estados. Tarefa Fixa', resp: 'Kamyla', delegado: 'Hygor', prio: 'Alta', status: '', fatal: '2026-11-23' }); form['6,11'] = '=HOJE()+3';

// 1) a primeira rodada do script
S.sincronizarHorus({ forcar: true });
let docs = await ag();
check(docs.length === 2 && docs.some(d => d.tipo === 'prazo' && d.processo === '5170137-60.2026.8.09.0108' && d.situacao === 'pronta') && docs.some(d => d.tipo === 'tarefa'), 'o script lê a planilha, o servidor importa 2 itens (o concluído e a linha de histórico ficam de fora)');
check(/^h-/.test(cel[4][16]) && /^h-/.test(cel[6][16]) && cel[5][16] === '' && String(cel[4][17]).length > 3, 'o script grava o ID Horus (coluna P) e a hora (Q) nas linhas importadas');
const est = (await f('GET', '/api/planilha')).j; check(est.conectada && est.url === 'https://docs.google.com/spreadsheets/d/xyz/edit' && est.nomes.length === 3, 'o app passa a mostrar a planilha conectada, o endereço e os 3 nomes (Hygor, Kamyla, Luiza)');

// 2) o app conclui o prazo: a próxima rodada escreve "Protocolada" na linha certa
const dA = docs.find(d => d.tipo === 'prazo');
await f('PUT', '/api/db/agenda/' + dA.id, { ...dA, id: undefined, situacao: 'feito', concluido: true });
S.sincronizarHorus({ forcar: true });
check(cel[4][7] === 'Protocolada' && cel[6][7] === '', 'concluir no app escreve "Protocolada" só na linha dele (a outra não é tocada)');
S.sincronizarHorus({ forcar: true });
check((await ag()).length === 2 && cel[4][7] === 'Protocolada', 'rodada seguinte: tudo igual, sem vai-e-vem');

// 3) item criado no app vira linha nova (e a fórmula da tarefa fixa não é sobrescrita)
await f('POST', '/api/db/agenda', { tipo: 'tarefa', titulo: 'Delegada pelo app', processo: '5727644-22.2026.8.09.0107', data: '2026-11-30', situacao: 'afazer', concluido: false, avisos: [5, 2, 1, 0], resp: [], respNome: 'Luiza', prioridade: 'Alta', planilha: true, criadoEm: new Date().toISOString() });
S.sincronizarHorus({ forcar: true });
const n = cel.findIndex((l, i) => i >= 4 && l[3] === 'Delegada pelo app');
check(n === 7 && cel[n][2] === '5727644-22.2026.8.09.0107' && cel[n][4] === 'Luiza' && cel[n][6] === 'Alta' && cel[n][7] === 'A fazer' && cel[n][11] instanceof Date && cel[n][11].getDate() === 30 && /^h-/.test(cel[n][16]), 'a linha nova aparece logo depois da última (linha 7) com processo, responsável, prioridade, status, prazo manual e ID');
cel[n][12] = D('2026-11-30'); cel[n][13] = D('2026-11-27');   // a planilha calcula o fatal e o interno
S.sincronizarHorus({ forcar: true });
const dN = (await ag()).find(d => d.titulo === 'Delegada pelo app');
check((await ag()).length === 3 && dN.trabalhar === '2026-11-27' && !dN.plan.pendente && cel.filter(l => l[3] === 'Delegada pelo app').length === 1, 'o prazo interno calculado volta como "trabalhar até" e a linha não é duplicada');

// 4) alguém edita a planilha: o app acompanha
cel[6][7] = 'Em andamento'; cel[6][3] = 'Olhar processos de outros estados (MG, PB, DF)';
S.sincronizarHorus({ forcar: true });
const dF = (await ag()).find(d => /outros estados/.test(d.titulo));
check(dF.situacao === 'elaboracao' && /MG, PB, DF/.test(dF.titulo), 'editar status e título na planilha chega ao app');
// 5) a pergunta leve do minuto a minuto não lê a planilha quando nada mudou
props.ultimaCompleta = String(Date.now());
const antes = JSON.stringify(cel[4]); S.sincronizarHorus({});
check(JSON.stringify(cel[4]) === antes, 'sem nada pendente e dentro dos 5 minutos, o script só pergunta e volta (não mexe na planilha)');
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
