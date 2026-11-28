// Planilha ⇄ Agenda com pessoas do app: nomes da planilha ligados automaticamente (primeiro nome), visibilidade do item por responsável e aviso
// "Nova tarefa para você" no celular de quem recebe a tarefa. Banco semeado do grupo 'permissoes' + "serviço de push" de mentira:  node test/rodar.mjs planilha-avisos
import http from 'node:http';
import { novoAparelho, decifrar } from './push.helper.mjs';
const B = process.env.BASE || 'http://127.0.0.1:8816';
const TOK = { dono: 'tok-dono-0000000000000000000000000001', ana: 'tok-adv-ana-00000000000000000000000002', bruno: 'tok-adv-bruno-000000000000000000000003', caio: 'tok-est-caio-0000000000000000000000004' };
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const quem = (n) => async (m, p, b) => { const x = await fetch(B + p, { method: m, headers: { cookie: 'sessao=' + TOK[n], 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined }); let j = null; try { j = await x.json(); } catch (e) { } return { s: x.status, j: j || {} }; };
const dono = quem('dono'), ana = quem('ana'), bruno = quem('bruno'), caio = quem('caio');
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
const caixa = []; http.createServer((q, s) => { const p = []; q.on('data', (c) => p.push(c)); q.on('end', () => { caixa.push({ url: q.url, corpo: Buffer.concat(p) }); s.writeHead(201); s.end(''); }); }).listen(9994);
const aps = {}; for (const n of ['ana', 'bruno', 'caio']) aps[n] = await novoAparelho();
const lidas = async (nome) => { const o = []; for (const c of caixa.filter((x) => x.url === '/push/' + nome)) o.push(await decifrar(aps[nome], c.corpo)); return o; };
for (const [n, f] of [['ana', ana], ['bruno', bruno], ['caio', caio]]) await f('POST', '/api/notif/inscrever', { endpoint: 'http://127.0.0.1:9994/push/' + n, keys: { p256dh: aps[n].p256dh, auth: aps[n].authB64 } });
await dono('POST', '/api/planilha/ligar'); const script = await fetch(B + '/api/planilha/script', { headers: { cookie: 'sessao=' + TOK.dono } }).then((r) => r.text()); const chave = /HORUS_CHAVE = '([^']+)'/.exec(script)[1];
const sync = (corpo) => fetch(B + '/api/planilha-sync', { method: 'POST', headers: { authorization: 'Bearer ' + chave, 'content-type': 'application/json' }, body: JSON.stringify(corpo) }).then((r) => r.json());
const L = (o) => ({ linha: 4, cliente: '', processo: '', titulo: '', resp: '', delegado: '', prio: '', status: '', fatal: '', interno: '', fixa: false, obs: '', id: '', ...o });
const INT = [{ nome: 'Ana', funcao: 'Advogada' }, { nome: 'Bruno', funcao: 'Advogado' }, { nome: 'Caio', funcao: 'Estagiário' }, { nome: 'Hitallo', funcao: 'Advogado' }];

// 1) a primeira conversa importa em silêncio (nenhum aviso) e liga os nomes pelo primeiro nome
let r1 = await sync({ completo: true, integrantes: INT, linhas: [L({ linha: 4, titulo: 'Tarefa antiga da Ana', resp: 'Ana', delegado: 'Hitallo', status: 'A fazer', fatal: '2026-12-10' })] }); await esperar(400);
check((await lidas('ana')).length === 0, 'a importação inicial não manda aviso nenhum (não enche o celular)');
const est = (await dono('GET', '/api/planilha')).j, porNome = Object.fromEntries(est.nomes.map((n) => [n.planilha, n.usuario && n.usuario.nome]));
check(/Ana/.test(porNome.Ana || '') && /Bruno/.test(porNome.Bruno || '') && /Caio/.test(porNome.Caio || '') && !porNome.Hitallo, 'Ana, Bruno e Caio são ligados sozinhos pelo primeiro nome; Hitallo (sem usuário) fica só pelo nome');
const docs0 = (await dono('GET', '/api/db/agenda')).j.docs.map((d) => ({ id: d.id, ...d.data })), d0 = docs0.find((d) => d.titulo === 'Tarefa antiga da Ana');
check(Array.isArray(d0.resp) && d0.resp.length === 1 && /^[0-9]{5}\/GO$/.test(d0.resp[0]), 'o item importado já nasce com a Ana como responsável (OAB dela)');
check((await ana('GET', '/api/db/agenda')).j.docs.some((d) => d.data.titulo === 'Tarefa antiga da Ana') && !(await bruno('GET', '/api/db/agenda')).j.docs.some((d) => d.data.titulo === 'Tarefa antiga da Ana'), 'ela enxerga o item na agenda dela; o Bruno, não');

// 2) linha nova na planilha delegada à Ana: ela recebe o aviso
const id1 = r1.ids[0].id;
let r2 = await sync({ completo: true, integrantes: INT, linhas: [L({ linha: 4, id: id1, titulo: 'Tarefa antiga da Ana', resp: 'Ana', delegado: 'Hitallo', status: 'A fazer', fatal: '2026-12-10' }), L({ linha: 5, titulo: 'Protocolar certidão narrativa', resp: 'Ana', delegado: 'Hitallo', prio: 'Alta', status: 'A fazer', fatal: '2026-12-20' })] }); await esperar(500);
let m = await lidas('ana');
check(m.length === 1 && /Protocolar certidão narrativa/.test(JSON.stringify(m[0])) && /Hitallo/.test(JSON.stringify(m[0])), 'linha nova delegada à Ana: o celular dela avisa, dizendo quem delegou e o quê: ' + JSON.stringify(m[0] || {}).slice(0, 140));
check((await lidas('bruno')).length === 0 && (await lidas('caio')).length === 0, 'ninguém mais recebe');

// 3) trocar o responsável na planilha: o novo responsável é avisado
const id2 = r2.ids[0].id;
await sync({ completo: true, integrantes: INT, linhas: [L({ linha: 4, id: id1, titulo: 'Tarefa antiga da Ana', resp: 'Ana', delegado: 'Hitallo', status: 'A fazer', fatal: '2026-12-10' }), L({ linha: 5, id: id2, titulo: 'Protocolar certidão narrativa', resp: 'Caio', delegado: 'Hitallo', prio: 'Alta', status: 'A fazer', fatal: '2026-12-20' })] }); await esperar(500);
m = await lidas('caio');
check(m.length === 1 && /Protocolar certidão narrativa/.test(JSON.stringify(m[0])), 'trocar o responsável na planilha avisa o novo responsável (Caio)');
const dTroca = (await caio('GET', '/api/db/agenda')).j.docs.find((d) => d.data.titulo === 'Protocolar certidão narrativa');
check(!!dTroca && !(await ana('GET', '/api/db/agenda')).j.docs.some((d) => d.data.titulo === 'Protocolar certidão narrativa' && false), 'e o item passa a aparecer na agenda do Caio (estagiário)');

// 3b) item antigo com responsável "só pelo nome" (n:Caio) e o Caio já tem usuário: a próxima conversa religa ao usuário, em silêncio (sem aviso)
{ const antes = (await lidas('caio')).length, doc = (await dono('GET', '/api/db/agenda')).j.docs.find((d) => d.data.titulo === 'Protocolar certidão narrativa');
  await dono('PUT', '/api/db/agenda/' + doc.id, { ...doc.data, id: undefined, resp: ['n:Caio'] });
  await sync({ completo: true, integrantes: INT, linhas: [L({ linha: 4, id: id1, titulo: 'Tarefa antiga da Ana', resp: 'Ana', delegado: 'Hitallo', status: 'A fazer', fatal: '2026-12-10' }), L({ linha: 5, id: id2, titulo: 'Protocolar certidão narrativa', resp: 'Caio', delegado: 'Hitallo', prio: 'Alta', status: 'A fazer', fatal: '2026-12-20' })] }); await esperar(500);
  const depois = (await dono('GET', '/api/db/agenda')).j.docs.find((d) => d.id === doc.id).data;
  check(depois.resp.length === 1 && /^u:/.test(depois.resp[0]) && (await lidas('caio')).length === antes, 'resposta "n:Caio" é religada ao usuário Caio na conversa seguinte, sem mandar aviso'); }

// 3c) carga por pessoa: "n:Caio" (nome da planilha) e o usuário Caio são a MESMA pessoa: uma linha só, com a tarefa contada nele
{ const amanha = new Date(Date.now() - 3 * 3600e3 + 864e5).toISOString().slice(0, 10);
  await dono('POST', '/api/db/agenda', { tipo: 'tarefa', titulo: 'Carga do Caio por nome', data: amanha, situacao: 'afazer', concluido: false, avisos: [], resp: ['n:Caio'], criadoEm: new Date().toISOString() });
  const car = (await dono('GET', '/api/agenda/carga?dias=7')).j, nomesC = car.pessoas.map((p) => p.nome), caioU = car.pessoas.find((p) => p.chave.startsWith('u:') && /Caio/.test(p.nome));
  check(!car.pessoas.some((p) => p.chave === 'n:Caio') && new Set(nomesC).size === nomesC.length && !!caioU && caioU.total >= 1, 'carga por pessoa: o nome da planilha ("n:Caio") e o usuário Caio viram uma linha só (' + nomesC.join(', ') + ')'); }

// 4) escolher manualmente outra pessoa no mapa (Hitallo → Bruno): os itens do Hitallo passam para ele
await dono('PUT', '/api/planilha/nomes', { mapa: { Hitallo: (est.opcoes.find((o) => /Bruno/.test(o.nome)) || {}).chave } });
check((await dono('GET', '/api/planilha')).j.nomes.find((n) => n.planilha === 'Hitallo').usuario.nome.includes('Bruno'), 'o proprietário pode ligar um nome da planilha a outra pessoa pela tela (mapa de nomes)');
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
