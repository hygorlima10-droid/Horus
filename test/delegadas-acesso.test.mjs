// Delegadas é de toda a equipe: proprietário, advogados e estagiários veem, lançam, editam, concluem e excluem as linhas.  Use: node test/rodar.mjs delegadas-acesso
const B = process.env.BASE || 'http://127.0.0.1:8816';
const TOK = { dono: 'tok-dono-0000000000000000000000000001', ana: 'tok-adv-ana-00000000000000000000000002', bruno: 'tok-adv-bruno-000000000000000000000003', caio: 'tok-est-caio-0000000000000000000000004' };
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const quem = (n) => async (m, p, b) => { const x = await fetch(B + p, { method: m, headers: { cookie: 'sessao=' + TOK[n], 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined }); let j = null; try { j = await x.json(); } catch (e) { } return { s: x.status, j }; };
const dono = quem('dono'), ana = quem('ana'), bruno = quem('bruno'), caio = quem('caio');
const nomes = async (f) => ((await f('GET', '/api/db/delegadas')).j.docs || []).map((d) => d.data.titulo).sort().join('|');

const c1 = await caio('POST', '/api/db/delegadas', { titulo: 'Criada pela estagiária', resp: 'u:x', prioridade: 'Média', status: 'afazer' });
check(c1.s === 200 || c1.s === 201, 'a estagiária lança uma tarefa (' + c1.s + ')');
const id = c1.j.id;
check((await nomes(dono)) === 'Criada pela estagiária' && (await nomes(ana)) === 'Criada pela estagiária' && (await nomes(bruno)) === 'Criada pela estagiária', 'todos veem a tarefa: proprietário e os dois advogados');
const e1 = await ana('PUT', '/api/db/delegadas/' + id, { titulo: 'Criada pela estagiária', resp: 'u:x', prioridade: 'Alta', status: 'andamento' });
check(e1.s === 200, 'a advogada edita a tarefa de outra pessoa (' + e1.s + ')');
const e2 = await bruno('PUT', '/api/db/delegadas/' + id, { titulo: 'Criada pela estagiária', resp: 'u:x', prioridade: 'Alta', status: 'concluida', concluidoEm: '2026-11-16' });
check(e2.s === 200 && ((await caio('GET', '/api/db/delegadas')).j.docs.find((d) => d.id === id) || { data: {} }).data.status === 'concluida', 'o outro advogado conclui, e a estagiária vê concluída');
const c2 = await ana('POST', '/api/db/delegadas', { titulo: 'Criada pela advogada para a estagiária', resp: 'u:x', prioridade: 'Baixa', status: 'afazer' });
const e3 = await caio('PUT', '/api/db/delegadas/' + c2.j.id, { titulo: 'Criada pela advogada para a estagiária', resp: 'u:x', prioridade: 'Baixa', status: 'andamento' });
check(c2.s < 300 && e3.s === 200, 'a estagiária atualiza a tarefa que a advogada delegou a ela');
const d1 = await caio('DELETE', '/api/db/delegadas/' + id);
check(d1.s === 200 && !(await nomes(dono)).includes('Criada pela estagiária'), 'a estagiária pode excluir (a Lixeira guarda 30 dias): ' + d1.s);
const lix = await dono('GET', '/api/lixeira');
check(JSON.stringify(lix.j).includes('Tarefa delegada'), 'a exclusão foi para a Lixeira com o rótulo "Tarefa delegada"');
const reg = await dono('GET', '/api/auditoria?limite=20');
check(reg.s === 200 && JSON.stringify(reg.j).includes('Tarefa delegada'), 'o registro de ações mostra "Tarefa delegada"');
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
