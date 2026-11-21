// Avisos do pagamento separado: o proprietário sabe quando outra pessoa recebe ou desfaz; os advogados sabem quando o pagador (Murilo) recebeu do cliente.
// Banco semeado do grupo 'permissoes' + serviço de push de mentira:  node test/rodar.mjs recebimentos-avisos
import http from 'node:http';
import { novoAparelho, decifrar } from './push.helper.mjs';
const B = process.env.BASE || 'http://127.0.0.1:8816';
const TOK = { dono: 'tok-dono-0000000000000000000000000001', ana: 'tok-adv-ana-00000000000000000000000002', bruno: 'tok-adv-bruno-000000000000000000000003' };
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const quem = (n) => async (m, p, b) => { const x = await fetch(B + p, { method: m, headers: { cookie: 'sessao=' + TOK[n], 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined }); let j = null; try { j = await x.json(); } catch (e) { } return { s: x.status, j }; };
const dono = quem('dono'), ana = quem('ana'), bruno = quem('bruno');
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
const caixa = []; const srv = http.createServer((q, s) => { const p = []; q.on('data', (c) => p.push(c)); q.on('end', () => { caixa.push({ url: q.url, corpo: Buffer.concat(p) }); s.writeHead(201); s.end(''); }); }).listen(9994);
const aps = {}; for (const n of ['dono', 'ana', 'bruno']) aps[n] = await novoAparelho();
const lidas = async (nome) => { const o = []; for (const c of caixa.filter((x) => x.url === '/push/' + nome)) o.push(await decifrar(aps[nome], c.corpo)); return o; };
const limpar = () => { caixa.length = 0; };
const ins = (n, f) => f('POST', '/api/notif/inscrever', { endpoint: 'http://127.0.0.1:9994/push/' + n, keys: { p256dh: aps[n].p256dh, auth: aps[n].authB64 } });
await dono('PUT', '/api/usuarios/u1', { oabs: ['60456/GO'] });
for (const [n, f] of [['dono', dono], ['ana', ana], ['bruno', bruno]]) await ins(n, f);
for (const d of (await dono('GET', '/api/db/recebimentos')).j.docs || []) await dono('DELETE', '/api/db/recebimentos/' + d.id);
const A3 = [{ oab: '60456/GO', nome: 'Dono Teste' }, { oab: '11111/GO', nome: 'Ana Advogada' }, { oab: '22222/GO', nome: 'Bruno Advogado' }];
await dono('PUT', '/api/db/casos/ra1', { tipo: 'inicial', origem: 'murilo', prioridade: 'normal', status: 'pendente', cliente: 'Cliente Aviso', nomeAcao: 'Ação', numeroProcesso: '0000861-01.2024.8.09.0861', modalidadeHonorario: 'fixo', formaPagamento: 'avista', valorHonorarios: 10000, avista: { data: '2026-01-10', pago: false }, advogados: A3, divisao: { modo: 'direto', partes: [{ oab: '60456/GO', nome: 'Dono Teste', pct: 50 }, { oab: '11111/GO', nome: 'Ana Advogada', pct: 30 }, { oab: '22222/GO', nome: 'Bruno Advogado', pct: 20 }] }, criadoEm: new Date().toISOString() });
const parte = (oab, extra) => ({ tipo: 'parte', docTipo: 'caso', docId: 'ra1', chave: 'ra1|avista', oab, cliente: 'Cliente Aviso', label: 'Honorários à vista', processo: '00008610120248090861', pago: false, parciais: [], valorBase: 3000, ...extra });

console.log('\n— o proprietário sabe quando outra pessoa recebe ou desfaz');
limpar(); await ana('PUT', '/api/db/recebimentos/ax1', parte('11111/GO', { pago: true, dataRecebimento: '2026-11-18' })); await esperar(500);
let ld = await lidas('dono');
check(ld.length === 1 && /Ana recebeu a parte/.test(JSON.stringify(ld[0])) && /Cliente Aviso/.test(JSON.stringify(ld[0])), 'quando a Ana recebe a parte dela, o proprietário recebe o aviso com o cliente: ' + JSON.stringify(ld).slice(0, 160));
check((await lidas('bruno')).length === 0 && (await lidas('ana')).length === 0, 'o Bruno e a própria Ana não recebem esse aviso');
limpar(); await ana('PUT', '/api/db/recebimentos/ax1', parte('11111/GO', { pago: false })); await esperar(500);
ld = await lidas('dono');
check(ld.length === 1 && /Recebimento desfeito por Ana/.test(JSON.stringify(ld[0])), 'quando a Ana desfaz, o proprietário recebe "Recebimento desfeito por Ana"');
limpar(); await dono('PUT', '/api/db/recebimentos/ax2', parte('60456/GO', { pago: true })); await esperar(400);
check((await lidas('dono')).length === 0, 'o que o próprio proprietário faz não gera aviso para ele');

console.log('\n— o pagador recebeu do cliente: os advogados sabem que já dá para cobrar');
limpar(); await bruno('PUT', '/api/db/recebimentos/mx1', { tipo: 'cliente', docTipo: 'caso', docId: 'ra1', chave: 'ra1|avista', cliente: 'Cliente Aviso', label: 'Honorários à vista', processo: '00008610120248090861', advs: ['60456/GO', '11111/GO', '22222/GO'], desfeito: false, data: '2026-11-18' }); await esperar(600);
const la = await lidas('ana'), lb = await lidas('bruno'), ldn = await lidas('dono');
check(la.length === 1 && /recebeu do cliente/.test(JSON.stringify(la[0])) && ldn.length === 1 && lb.length === 0, 'a Ana e o proprietário recebem "O pagador recebeu do cliente"; o Bruno (quem marcou) não');
limpar(); await bruno('PUT', '/api/db/recebimentos/mx1', { tipo: 'cliente', docTipo: 'caso', docId: 'ra1', chave: 'ra1|avista', cliente: 'Cliente Aviso', label: 'Honorários à vista', processo: '00008610120248090861', advs: ['60456/GO', '11111/GO', '22222/GO'], desfeito: true, data: '' }); await esperar(400);
check((await lidas('ana')).length === 0, 'desfazer o marcador não gera aviso');
for (const d of (await dono('GET', '/api/db/recebimentos')).j.docs || []) await dono('DELETE', '/api/db/recebimentos/' + d.id);
await dono('DELETE', '/api/db/casos/ra1');
for (const n of ['dono', 'ana', 'bruno']) await quem(n)('DELETE', '/api/notif/inscrever', { endpoint: 'http://127.0.0.1:9994/push/' + n });
srv.close();
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo.'); process.exit(falhas ? 1 : 0);
