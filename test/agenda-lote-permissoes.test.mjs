// Ações em lote na Agenda: o servidor confere cada item (tudo ou nada) com as mesmas regras da alteração comum.
// Banco semeado do grupo 'permissoes':  node test/rodar.mjs agenda-lote-permissoes
const B = process.env.BASE || 'http://127.0.0.1:8816';
const TOK = { dono: 'tok-dono-0000000000000000000000000001', ana: 'tok-adv-ana-00000000000000000000000002', caio: 'tok-est-caio-0000000000000000000000004' };
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const quem = (n) => async (m, p, b) => { const x = await fetch(B + p, { method: m, headers: { cookie: 'sessao=' + TOK[n], 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined }); let j = null; try { j = await x.json(); } catch (e) { /* sem corpo */ } return { s: x.status, j }; };
const dono = quem('dono'), ana = quem('ana');
const doc = (o) => ({ tipo: 'tarefa', titulo: 'x', data: '2030-06-03', situacao: 'afazer', concluido: false, avisos: [5, 2, 1, 0], ...o });
await dono('PUT', '/api/db/agenda/lt-a', doc({ titulo: 'Tarefa da Ana', criadoPor: 'u2', resp: ['u:u2'] }));
await dono('PUT', '/api/db/agenda/lt-b', doc({ titulo: 'Tarefa pessoal do proprietário', criadoPor: 'u1', resp: [] }));
const ler = async (id) => { const j = (await dono('GET', '/api/db/agenda')).j.docs.find((d) => d.id === id); return j ? j.data : null; };
let r = await ana('POST', '/api/lote', { ops: [{ acao: 'gravar', colecao: 'agenda', id: 'lt-a', dados: doc({ titulo: 'Tarefa da Ana', criadoPor: 'u2', resp: ['u:u2'], data: '2030-06-04' }) }, { acao: 'gravar', colecao: 'agenda', id: 'lt-b', dados: doc({ titulo: 'Tarefa pessoal do proprietário', criadoPor: 'u1', resp: [], data: '2030-06-04' }) }] });
check(r.s >= 400 && (await ler('lt-a')).data === '2030-06-03' && (await ler('lt-b')).data === '2030-06-03', 'a advogada não consegue incluir no lote um item que não é dela, e NADA é gravado (nem o dela): ' + r.s);
r = await ana('POST', '/api/lote', { ops: [{ acao: 'gravar', colecao: 'agenda', id: 'lt-a', dados: doc({ titulo: 'Tarefa da Ana', criadoPor: 'u2', resp: ['u:u2'], data: '2030-06-04' }) }] });
check(r.s === 200 && (await ler('lt-a')).data === '2030-06-04', 'com só o item dela, o lote passa');
r = await ana('POST', '/api/lote', { ops: [{ acao: 'excluir', colecao: 'agenda', id: 'lt-b' }] });
check(r.s >= 400 && !!(await ler('lt-b')), 'ela também não exclui o item do proprietário pelo lote');
for (const id of ['lt-a', 'lt-b']) await dono('DELETE', '/api/db/agenda/' + id);
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
