// Ajustes e protocolo da petição em Delegadas quando quem fez a Inicial é ESTAGIÁRIO (advogado fica só na Central de atenção).  Use: node test/rodar.mjs peticoes-delegadas
const B = process.env.BASE || 'http://127.0.0.1:8818';
const TOK = { dono: 'tok-dono-0000000000000000000000000001', ana: 'tok-adv-ana-00000000000000000000000002', bruno: 'tok-adv-bruno-000000000000000000000003', caio: 'tok-est-caio-0000000000000000000000004' };
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const quem = (n) => async (m, p, b, bruto) => { const h = { cookie: 'sessao=' + TOK[n] }; if (!bruto) h['content-type'] = 'application/json'; const x = await fetch(B + p, { method: m, headers: h, body: bruto ? bruto : (b !== undefined ? JSON.stringify(b) : undefined) }); let j = null; try { j = await x.json(); } catch (e) { /* sem corpo */ } return { s: x.status, j }; };
const dono = quem('dono'), ana = quem('ana'), bruno = quem('bruno'), caio = quem('caio');
const docx = (t) => Buffer.concat([Buffer.from([0x50, 0x4b, 3, 4]), Buffer.from(t)]);
const revs = (await dono('GET', '/api/peticoes/revisores')).j.revisores, bId = revs.find((r) => r.nome.startsWith('Bruno')).id;
const caioId = (await caio('GET', '/api/eu')).j.id;
const tarefas = async (petId) => ((await dono('GET', '/api/db/delegadas')).j.docs || []).map((d) => ({ id: d.id, ...d.data })).filter((d) => d.peticaoId === petId);
const caso = async (cli, adv = true) => (await dono('POST', '/api/db/casos', { tipo: 'inicial', cliente: cli, nomeAcao: 'Inventário', status: 'pendente', prioridade: 'normal', origem: 'proprio', advogados: adv ? [{ oab: '11111/GO', nome: 'Ana' }] : [] })).j.id;

// --- autora estagiária ---
const c1 = await caso('Maria Estagiária');
let r = await caio('POST', '/api/peticoes/enviar/' + c1 + '?nome=a.docx&prazo=2026-12-05&revisor=' + bId, undefined, docx('v1')); const pid = r.j.peticao.id;
check(r.s === 200 && (await tarefas(pid)).length === 0, 'enviar para revisão não cria tarefa');
await bruno('POST', '/api/peticoes/' + pid + '/comentar', { texto: 'Ajuste A.' }); await bruno('POST', '/api/peticoes/' + pid + '/comentar', { texto: 'Ajuste B.' });
r = await bruno('POST', '/api/peticoes/' + pid + '/devolver', {}); check(r.s === 200, 'o revisor devolve');
let t = await tarefas(pid);
check(t.length === 1 && t[0].etapa === 'ajuste' && t[0].resp === 'u:' + caioId && t[0].status === 'afazer' && /^Ajustar petição \(2 comentários de Bruno\)$/.test(t[0].titulo), 'devolvida: cria a linha em Delegadas para a estagiária: "' + (t[0] && t[0].titulo) + '"');
check(t[0].cliente === 'Maria Estagiária' && t[0].fatal === '2026-12-05' && t[0].prioridade === 'Alta' && t[0].casoId === c1 && t[0].delegadoPor && /Abrir petição/.test(t[0].obs), 'cliente, prazo fatal, prioridade Alta, delegado por e observação (na ficha)');
check(((await caio('GET', '/api/db/delegadas')).j.docs || []).some((d) => d.id === t[0].id), 'a estagiária vê a linha em Delegadas');
r = await caio('POST', '/api/peticoes/enviar/' + c1 + '?nome=a2.docx', undefined, docx('v2')); check(r.s === 200, 'a estagiária reenvia a v2');
t = await tarefas(pid); check(t.length === 1 && t[0].status === 'concluida' && t[0].concluidoEm, 'ao reenviar, a linha de ajuste é concluída sozinha');
await bruno('POST', '/api/peticoes/' + pid + '/comentar', { texto: 'Mais um.' }); await bruno('POST', '/api/peticoes/' + pid + '/devolver', {});
t = await tarefas(pid); check(t.length === 1 && t[0].status === 'afazer' && /\(1 comentário de Bruno\)/.test(t[0].titulo), 'devolvida de novo: a MESMA linha reabre (sem duplicar) com a nova contagem');
await caio('POST', '/api/peticoes/enviar/' + c1 + '?nome=a3.docx', undefined, docx('v3'));
r = await bruno('POST', '/api/peticoes/' + pid + '/aprovar'); check(r.s === 200, 'o revisor aprova');
t = await tarefas(pid); const aj = t.find((x) => x.etapa === 'ajuste'), pr = t.find((x) => x.etapa === 'protocolo');
check(t.length === 2 && aj.status === 'concluida' && pr && pr.status === 'afazer' && pr.resp === 'u:' + caioId && /^Protocolar petição aprovada \(Bruno aprovou\)$/.test(pr.titulo), 'aprovada: cria a linha de protocolo para a estagiária (e o ajuste fica concluído)');
await dono('PUT', '/api/db/casos/' + c1, { tipo: 'inicial', cliente: 'Maria Estagiária', nomeAcao: 'Inventário', status: 'protocolado', numeroProcesso: '0000009-99.2026.8.09.0001', advogados: [{ oab: '11111/GO', nome: 'Ana' }] });
await dono('GET', '/api/peticoes');
t = await tarefas(pid); check(t.find((x) => x.etapa === 'protocolo').status === 'concluida', 'ao protocolar a Inicial, a linha de protocolo é concluída');

// --- autora advogada: nada em Delegadas ---
const c2 = await caso('João Advogada');
r = await ana('POST', '/api/peticoes/enviar/' + c2 + '?nome=b.docx&revisor=' + bId, undefined, docx('v1')); const pid2 = r.j.peticao.id;
await bruno('POST', '/api/peticoes/' + pid2 + '/comentar', { texto: 'x' }); await bruno('POST', '/api/peticoes/' + pid2 + '/devolver', {});
check((await tarefas(pid2)).length === 0, 'autora advogada: devolvida não cria linha em Delegadas (ela usa a Central de atenção)');
await ana('POST', '/api/peticoes/enviar/' + c2 + '?nome=b2.docx', undefined, docx('v2')); await bruno('POST', '/api/peticoes/' + pid2 + '/aprovar');
check((await tarefas(pid2)).length === 0, 'autora advogada: aprovada também não cria');

// --- apagar a petição remove as linhas automáticas ---
const c3 = await caso('Apagar Petição');
r = await caio('POST', '/api/peticoes/enviar/' + c3 + '?nome=c.docx&revisor=' + bId, undefined, docx('v1')); const pid3 = r.j.peticao.id;
await bruno('POST', '/api/peticoes/' + pid3 + '/comentar', { texto: 'x' }); await bruno('POST', '/api/peticoes/' + pid3 + '/devolver', {});
check((await tarefas(pid3)).length === 1, 'nova devolução cria a linha');
check((await caio('DELETE', '/api/peticoes/' + pid3)).s === 200 && (await tarefas(pid3)).length === 0, 'apagar a petição apaga a linha automática');
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
