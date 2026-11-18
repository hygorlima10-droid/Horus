// Estagiária lança prazo, audiência ou tarefa na agenda: ninguém precisa conferir; o proprietário e os advogados responsáveis só recebem o aviso.
// Banco semeado do grupo 'permissoes' + serviço de push de mentira:  node test/rodar.mjs agenda-estagiaria-avisos
import http from 'node:http';
import { novoAparelho, decifrar } from './push.helper.mjs';
const B = process.env.BASE || 'http://127.0.0.1:8816';
const TOK = { dono: 'tok-dono-0000000000000000000000000001', ana: 'tok-adv-ana-00000000000000000000000002', bruno: 'tok-adv-bruno-000000000000000000000003', caio: 'tok-est-caio-0000000000000000000000004' };
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const quem = (n) => async (m, p, b) => { const x = await fetch(B + p, { method: m, headers: { cookie: 'sessao=' + TOK[n], 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined }); let j = null; try { j = await x.json(); } catch (e) { } return { s: x.status, j }; };
const dono = quem('dono'), ana = quem('ana'), bruno = quem('bruno'), caio = quem('caio');
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
const caixa = []; const srv = http.createServer((q, s) => { const p = []; q.on('data', (c) => p.push(c)); q.on('end', () => { caixa.push({ url: q.url, corpo: Buffer.concat(p) }); s.writeHead(201); s.end(''); }); }).listen(9994);
const aps = {}; for (const n of ['dono', 'ana', 'bruno', 'caio']) aps[n] = await novoAparelho();
const lidas = async (nome) => { const o = []; for (const c of caixa.filter((x) => x.url === '/push/' + nome)) o.push(await decifrar(aps[nome], c.corpo)); return o; };
const limpar = () => { caixa.length = 0; };
const ins = (n, f) => f('POST', '/api/notif/inscrever', { endpoint: 'http://127.0.0.1:9994/push/' + n, keys: { p256dh: aps[n].p256dh, auth: aps[n].authB64 } });
await dono('PUT', '/api/usuarios/u1', { oabs: ['60456/GO'] });
for (const [n, f] of [['dono', dono], ['ana', ana], ['bruno', bruno], ['caio', caio]]) await ins(n, f);
await dono('PUT', '/api/notif/config', { equipe: { agenda: true } });
const nomes = (l) => l.map((x) => (x.titulo || '') + ' | ' + (x.corpo || ''));

console.log('\n— a estagiária lança uma audiência (sem conferência)');
limpar(); const r = await caio('PUT', '/api/db/agenda/ea1', { tipo: 'audiencia', titulo: 'Conciliação CEJUSC', data: '2027-02-11', hora: '15:30', processo: '5813570-31.2026.8.09.0087', resp: ['60456/GO', '11111/GO'] }); await esperar(700);
check(r.s === 200, 'a estagiária grava direto na agenda (200), sem etapa de aprovação');
const ag = (await dono('GET', '/api/db/agenda')).j.docs.find((d) => d.id === 'ea1');
check(!!ag && ag.data.titulo === 'Conciliação CEJUSC' && !ag.data.pendente && !ag.data.conferir, 'o proprietário já vê o registro pronto, sem marca de "a conferir"');
const ld = await lidas('dono'), la = await lidas('ana'), lb = await lidas('bruno'), lc = await lidas('caio');
check(ld.length === 1 && /Caio lançou uma audiência na agenda/.test(JSON.stringify(ld[0])) && /11\/02\/2027 às 15:30/.test(JSON.stringify(ld[0])) && /5813570-31/.test(JSON.stringify(ld[0])), 'o proprietário recebe UM aviso: "Caio lançou uma audiência na agenda" com data, hora e processo: ' + nomes(ld).join(' ; ').slice(0, 170));
check(la.length === 1 && /Caio lançou uma audiência/.test(JSON.stringify(la[0])), 'a advogada responsável (Ana) recebe o mesmo aviso, uma vez só (não o "Você foi indicado")');
check(lb.length === 0 && lc.length === 0, 'o Bruno (não é responsável) e a própria estagiária não recebem nada');

console.log('\n— mudar data/hora também avisa; mudar só o texto não');
limpar(); await caio('PUT', '/api/db/agenda/ea1', { ...ag.data, hora: '16:00' }); await esperar(700);
check((await lidas('dono')).length === 1 && /alterou a audiência na agenda/.test(JSON.stringify((await lidas('dono'))[0])) && /16:00/.test(JSON.stringify((await lidas('ana'))[0] || {})), 'alterar a hora avisa o proprietário e a Ana (com o horário novo)');
limpar(); await caio('PUT', '/api/db/agenda/ea1', { ...ag.data, hora: '16:00', obs: 'só uma observação' }); await esperar(500);
check((await lidas('dono')).length === 0, 'editar só observação não gera aviso');

console.log('\n— prazo e tarefa, e quem não é estagiária');
limpar(); await caio('PUT', '/api/db/agenda/ea2', { tipo: 'prazo', titulo: 'Réplica', data: '2026-12-10', resp: ['22222/GO'] }); await esperar(600);
check(/lançou um prazo/.test(JSON.stringify((await lidas('dono'))[0] || {})) && (await lidas('bruno')).length === 1 && (await lidas('ana')).length === 0, 'prazo: o proprietário e o responsável (Bruno) são avisados; a Ana, que não é responsável, não');
limpar(); await caio('PUT', '/api/db/agenda/ea3', { tipo: 'tarefa', titulo: 'Juntar documentos', data: '2026-12-02', resp: ['u:u4'] }); await esperar(600);
check(/lançou uma tarefa/.test(JSON.stringify((await lidas('dono'))[0] || {})), 'tarefa: o proprietário é avisado');
limpar(); await ana('PUT', '/api/db/agenda/ea4', { tipo: 'prazo', titulo: 'Prazo da advogada', data: '2026-12-11', resp: ['11111/GO'] }); await esperar(500);
check(!(await lidas('dono')).some((x) => /lançou/.test(JSON.stringify(x))), 'quando quem lança é advogada, não há aviso de "lançou" (só vale para estagiária)');

console.log('\n— o proprietário pode desligar');
await dono('PUT', '/api/notif/config', { equipe: { agenda: false } });
limpar(); await caio('PUT', '/api/db/agenda/ea5', { tipo: 'audiencia', titulo: 'Outra', data: '2027-03-01', hora: '10:00', resp: ['60456/GO'] }); await esperar(600);
check((await lidas('dono')).length === 0, 'com a chave desligada, o proprietário não recebe');
await dono('PUT', '/api/notif/config', { equipe: { agenda: true } });
for (const id of ['ea1', 'ea2', 'ea3', 'ea4', 'ea5']) await dono('DELETE', '/api/db/agenda/' + id);
for (const n of ['dono', 'ana', 'bruno', 'caio']) await quem(n)('DELETE', '/api/notif/inscrever', { endpoint: 'http://127.0.0.1:9994/push/' + n });
srv.close();
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo.'); process.exit(falhas ? 1 : 0);
