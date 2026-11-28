// Audiências no calendário do iPhone (.ics): link secreto por pessoa, só audiências, "só as minhas" × "todas do escritório", opções, link novo e pessoa desativada.
// Banco semeado do grupo 'permissoes':  node test/rodar.mjs calendario
const B = process.env.BASE || 'http://127.0.0.1:8816';
const TOK = { dono: 'tok-dono-0000000000000000000000000001', ana: 'tok-adv-ana-00000000000000000000000002', caio: 'tok-est-caio-0000000000000000000000004' };
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const quem = (n) => async (m, p, b) => { const x = await fetch(B + p, { method: m, headers: { cookie: 'sessao=' + TOK[n], 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined }); let j = null; try { j = await x.json(); } catch (e) { /* sem corpo */ } return { s: x.status, j }; };
const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10), dia = (n) => new Date(Date.parse(hoje + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10), ymd = (iso) => iso.replace(/-/g, '');
const D1 = dia(30), D2 = dia(31), D3 = dia(32), D4 = dia(33), D6 = dia(34), D7 = dia(35);
const dono = quem('dono'), ana = quem('ana'), caio = quem('caio');
const feed = async (url) => { const x = await fetch(url.replace(/^webcal:/, 'http:').replace(/^https:\/\/[^/]+/, B)); return { s: x.status, tipo: x.headers.get('content-type') || '', txt: await x.text() }; };
const ag = (id, o) => dono('PUT', '/api/db/agenda/' + id, { tipo: 'audiencia', situacao: 'afazer', concluido: false, avisos: [5, 2, 1, 0], data: D1, ...o });
for (const d of (await dono('GET', '/api/db/agenda')).j.docs) if (d.id.startsWith('cal-')) await dono('DELETE', '/api/db/agenda/' + d.id);
await ag('cal-1', { titulo: 'Audiência Alfa', cliente: 'Cliente Alfa Ltda', hora: '14:30', resp: ['u:u2'], criadoPor: 'u2', modalidade: 'online', link: 'https://meet.google.com/abc-defg-hij', processo: '5044444-88.2026.8.09.0051', audTipo: 'Conciliação' });
await ag('cal-2', { titulo: 'Audiência Beta', cliente: 'Cliente Beta SA', hora: '16:00', resp: ['u:u3'], criadoPor: 'u3', data: D2 });
await ag('cal-3', { titulo: 'Audiência Gama', cliente: 'Cliente Gama', criadoPor: 'u1', resp: [], data: D3 });
await ag('cal-4', { titulo: 'Audiência cancelada', cliente: 'Cliente Cancelado', hora: '10:00', resp: ['u:u2'], cancelado: true, data: D4 });
await ag('cal-5', { titulo: 'Audiência antiga', cliente: 'Cliente Antigo', hora: '10:00', resp: ['u:u2'], data: '2020-01-10' });
await ag('cal-6', { titulo: 'Prazo que não vai', tipo: 'prazo', cliente: 'Cliente Prazo', resp: ['u:u2'], data: D6 });
await ag('cal-7', { titulo: 'Tarefa que não vai', tipo: 'tarefa', cliente: 'Cliente Tarefa', resp: ['u:u2'], data: D7 });

console.log('\n— a advogada liga o calendário');
let r = await ana('GET', '/api/calendario'); check(r.s === 200 && r.j.ativo === false && !r.j.url, 'começa desligado e sem link');
r = await ana('PUT', '/api/calendario', { ativo: true }); const url1 = r.j.url;
check(r.s === 200 && r.j.ativo === true && /\/cal\/[A-Za-z0-9_-]{32}\.ics$/.test(url1) && /^webcal:\/\//.test(r.j.webcal) && r.j.escopo === 'minhas' && r.j.cliente === true && r.j.alertas === true, 'ao ligar: link secreto de 32 caracteres, webcal e padrões (só as minhas, nome do cliente, alertas)');
let f = await feed(url1);
check(f.s === 200 && /text\/calendar/.test(f.tipo) && /^BEGIN:VCALENDAR\r\n/.test(f.txt) && /END:VCALENDAR\r\n$/.test(f.txt), 'o link abre sem login, como arquivo de calendário (.ics, linhas com CRLF)');
check(/SUMMARY:Audiência · Cliente Alfa Ltda/.test(f.txt) && !/Cliente Beta/.test(f.txt) && !/Cliente Gama/.test(f.txt), '"Só as minhas": só a audiência em que ela é responsável');
check(!/Prazo que não vai|Cliente Prazo|Cliente Tarefa|Cliente Cancelado|Cliente Antigo/.test(f.txt) && (f.txt.match(/BEGIN:VEVENT/g) || []).length === 1, 'prazo, tarefa, audiência cancelada e audiência antiga não entram (1 evento)');
check(new RegExp('DTSTART;TZID=America/Sao_Paulo:' + ymd(D1) + 'T143000').test(f.txt) && new RegExp('DTEND;TZID=America/Sao_Paulo:' + ymd(D1) + 'T153000').test(f.txt), 'horário em America/Sao_Paulo, com 1 hora de duração');
check(/LOCATION:Online/.test(f.txt) && /URL:https:\/\/meet\.google\.com\/abc-defg-hij/.test(f.txt) && /Processo 5044444-88\.2026\.8\.09\.0051/.test(f.txt.replace(/\r\n /g, '')) && /Responsável: Ana/.test(f.txt.replace(/\r\n /g, '')), 'local/sala, endereço da sala e, nas notas, processo e responsável');
check((f.txt.match(/BEGIN:VALARM/g) || []).length === 2 && /TRIGGER:-P1D/.test(f.txt) && /TRIGGER:-PT1H/.test(f.txt), 'alertas de 1 dia e de 1 hora antes');
check(f.txt.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75), 'nenhuma linha passa de 75 bytes (as longas são dobradas)');
r = await ana('PUT', '/api/calendario', { cliente: false, alertas: false }); f = await feed(url1);
check(/SUMMARY:Audiência · 14:30/.test(f.txt) && !/Cliente Alfa/.test(f.txt) && !/VALARM/.test(f.txt), 'sem o nome do cliente (título só com a hora) e sem alertas');
r = await ana('PUT', '/api/calendario', { escopo: 'escritorio', cliente: true }); f = await feed(url1);
check(/Cliente Alfa/.test(f.txt) && !/Cliente Beta/.test(f.txt), '"Todas do escritório" respeita o que a advogada pode ver (a audiência do colega, sem processo dela, não aparece)');

console.log('\n— link novo, desligar e acessos');
r = await ana('POST', '/api/calendario/novo'); const url2 = r.j.url;
check(r.s === 200 && url2 !== url1 && (await feed(url1)).s === 404 && (await feed(url2)).s === 200, '"Gerar um link novo": o antigo morre e o novo funciona');
check((await feed(B + '/cal/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.ics')).s === 404 && (await feed(B + '/cal/curto.ics')).s === 404, 'endereço inventado ou curto: 404');
r = await ana('PUT', '/api/calendario', { ativo: false }); check((await feed(url2)).s === 404 && r.j.ativo === false, 'desligar faz o link parar de funcionar');
await ana('PUT', '/api/calendario', { ativo: true });
r = await caio('PUT', '/api/calendario', { ativo: true }); const urlC = r.j.url; f = await feed(urlC);
check(r.s === 200 && f.s === 200 && (f.txt.match(/BEGIN:VEVENT/g) || []).length === 0, 'o estagiário também gera o dele; "só as minhas" sem audiência dele: calendário vazio');
check((await caio('GET', '/api/calendario')).j.url === urlC && (await ana('GET', '/api/calendario')).j.url !== urlC, 'cada pessoa vê só o próprio link');

console.log('\n— o proprietário');
r = await dono('PUT', '/api/calendario', { ativo: true }); const urlD = r.j.url; f = await feed(urlD);
check(/Cliente Gama/.test(f.txt) && !/Cliente Alfa/.test(f.txt) && !/Cliente Beta/.test(f.txt), '"Só as minhas" do proprietário: as audiências dele (sem responsável) e não as de colegas');
await dono('PUT', '/api/calendario', { escopo: 'escritorio' }); f = await feed(urlD);
check(/Cliente Alfa/.test(f.txt) && /Cliente Beta/.test(f.txt) && /Cliente Gama/.test(f.txt) && (f.txt.match(/BEGIN:VEVENT/g) || []).length === 3, '"Todas do escritório": as 3 audiências ativas');

/* (desativar uma pessoa derruba as sessões dela e não dá para restaurá-las neste banco semeado: o link do calendário de quem está desativado é recusado em src/calendario.js, mas não é exercitado aqui) */
for (const id of ['cal-1', 'cal-2', 'cal-3', 'cal-4', 'cal-5', 'cal-6', 'cal-7']) await dono('DELETE', '/api/db/agenda/' + id);
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
