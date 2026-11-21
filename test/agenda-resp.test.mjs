// Testa a Agenda por pessoa (Fase 5, etapa 5.5, servidor): responsáveis (resp) decidem quem vê e quem altera; carga por pessoa sem vazar conteúdo.
// Banco semeado do grupo 'permissoes':  node test/rodar.mjs agenda-resp
const B = process.env.BASE || 'http://127.0.0.1:8816';
const TOK = { dono: 'tok-dono-0000000000000000000000000001', ana: 'tok-adv-ana-00000000000000000000000002', bruno: 'tok-adv-bruno-000000000000000000000003', edu: 'tok-est-edu-00000000000000000000000000006' };
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const quem = (n) => async (m, p, b) => { const x = await fetch(B + p, { method: m, headers: { cookie: 'sessao=' + TOK[n], 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined }); let j = null; try { j = await x.json(); } catch (e) { /* sem corpo */ } return { s: x.status, j }; };
const dono = quem('dono'), ana = quem('ana'), bruno = quem('bruno'), edu = quem('edu');
const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10), em = (n) => new Date(Date.parse(hoje + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const N1 = '0000001-11.2024.8.09.0001', N2 = '0000002-22.2024.8.09.0002';
for (const d of (await dono('GET', '/api/db/agenda')).j.docs) await dono('DELETE', '/api/db/agenda/' + d.id);
const ag = (id, o) => dono('PUT', '/api/db/agenda/' + id, Object.assign({ tipo: 'prazo', situacao: 'afazer', concluido: false, data: em(1), criadoPor: 'u1' }, o));
await ag('r10', { titulo: 'SEGREDO-10 prazo do processo do Bruno', processo: N2, resp: ['u:u6'] });
await ag('r11', { tipo: 'tarefa', titulo: 'SEGREDO-11 tarefa da Ana', resp: ['11111/GO'], data: em(2) });
await ag('r12', { tipo: 'tarefa', titulo: 'SEGREDO-12 tarefa só do dono' });
await ag('r13', { titulo: 'SEGREDO-13 prazo do processo da Ana (sem responsável)', processo: N1, data: em(2) });
await ag('r14', { titulo: 'SEGREDO-14 já concluído', processo: N1, concluido: true });
await ag('r15', { titulo: 'SEGREDO-15 longe demais', processo: N1, data: em(40) });
await ag('r16', { tipo: 'tarefa', titulo: 'SEGREDO-16 do escritório', compartilhada: true, data: em(3) });
const ids = (r) => (r.j && r.j.docs ? r.j.docs.map((d) => d.id).sort().join(',') : '?' + r.s);

console.log('\n— quem vê');
check(ids(await ana('GET', '/api/db/agenda')) === 'r11,r13,r14,r15,r16', 'Ana vê a tarefa em que é responsável (r11), os prazos do processo dela e a tarefa do escritório; não vê o prazo do processo do Bruno nem a tarefa só do dono');
check(ids(await bruno('GET', '/api/db/agenda')) === 'r10,r16', 'Bruno vê o prazo do processo dele e a do escritório, não a tarefa da Ana');
check(ids(await edu('GET', '/api/db/agenda')) === 'r10,r13,r14,r15,r16', 'estagiário com "ver agendas" desligado vê o que o escolheu como responsável (r10), os prazos de processos e a tarefa do escritório; não vê as tarefas pessoais de ninguém (r11, r12)');

console.log('\n— quem altera');
check((await ana('PUT', '/api/db/agenda/r11', { tipo: 'tarefa', titulo: 'SEGREDO-11 editada', resp: ['11111/GO'], data: em(2), concluido: true, concluidoPor: 'Ana Advogada' })).s === 200, 'o responsável altera e conclui (um só "concluído" para todos)');
check((await bruno('PUT', '/api/db/agenda/r11', { tipo: 'tarefa', titulo: 'x' })).s === 404, 'quem não vê não altera');
check((await edu('PUT', '/api/db/agenda/r10', { tipo: 'prazo', titulo: 'SEGREDO-10 editado pelo estagiário', processo: N2, resp: ['u:u6'], data: em(1) })).s === 200, 'o estagiário responsável também altera');
const r11 = (await dono('GET', '/api/db/agenda')).j.docs.find((d) => d.id === 'r11').data;
check(r11.concluido === true && r11.concluidoPor === 'Ana Advogada' && r11.resp[0] === '11111/GO' && r11.criadoPor === 'u1', 'fica gravado quem concluiu, os responsáveis e o autor original');
await ag('r11', { tipo: 'tarefa', titulo: 'SEGREDO-11 tarefa da Ana', resp: ['11111/GO'], data: em(2) });   // reabre para a contagem

console.log('\n— carga por pessoa (todos veem, sem conteúdo)');
const c = await bruno('GET', '/api/agenda/carga'), j = c.j, p = (k) => j.pessoas.find((x) => x.chave === k);
check(c.s === 200 && j.dias === 7 && j.inicio === hoje && j.pessoas.length >= 3, 'qualquer pessoa logada recebe a carga dos próximos 7 dias');
check(p('11111/GO').total === 2 && p('11111/GO').dias[2] === 2, 'Ana: a tarefa em que é responsável + o prazo sem responsável do processo dela (vai para os advogados do processo): 2 itens, ambos no dia +2');
check(p('u:u6') && p('u:u6').nome === 'Edu Estagiario' && p('u:u6').total === 1 && p('22222/GO').total === 0, 'o responsável explícito (estagiário) leva o prazo, e o advogado do processo não conta o que foi dado a outro');
check(!JSON.stringify(j).includes('SEGREDO') && !JSON.stringify(j).includes('r1'), 'a resposta não traz título, id nem processo de nenhum item');
check(j.pessoas.reduce((t, x) => t + x.total, 0) === 4, 'não contam: concluído, longe demais e a tarefa só do dono; a tarefa do escritório sem responsável conta para quem a criou (4 itens no total)');
check(!(p('11111/GO').dias.slice(3).some((n) => n)), 'cada item cai no dia certo');
check((await edu('GET', '/api/agenda/carga')).s === 200 && (await ana('GET', '/api/agenda/carga?dias=14')).j.dias === 14, 'estagiário também vê; dá para pedir até 14 dias');

console.log('\n— carga por pessoa: tarefas delegadas e atrasadas');
const dowDe = (iso) => new Date(Date.parse(iso + 'T12:00:00Z')).getUTCDay();
const dg = (id, d) => dono('PUT', '/api/db/delegadas/' + id, { prioridade: 'Média', status: 'afazer', criadoEm: new Date().toISOString(), ...d });
await dg('cg1', { titulo: 'SEGREDO-d1 atrasada', resp: '11111/GO', fatal: em(-2) });
await dg('cg2', { titulo: 'SEGREDO-d2 trabalhar amanhã', resp: '11111/GO', trabalhar: em(1), fatal: em(6) });
await dg('cg3', { titulo: 'SEGREDO-d3 sem data', resp: '11111/GO' });
await dg('cg4', { titulo: 'SEGREDO-d4 concluída', resp: '11111/GO', fatal: em(-5), status: 'concluida' });
await dg('cg5', { titulo: 'SEGREDO-d5 conta fixa', tipo: 'fixa', resp: '11111/GO', repete: 'mensal', dia: 5, criadoEm: new Date().toISOString() });
await dg('cg6', { titulo: 'SEGREDO-d6 fixa semanal que vence em 2 dias', resp: '11111/GO', fixa: true, repete: 'semanal', dow: dowDe(em(2)), fixaDesde: em(-1), feitas: {} });
await dg('cg7', { titulo: 'SEGREDO-d7 fixa semanal que venceu há 3 dias e não foi feita', resp: 'u:u6', fixa: true, repete: 'semanal', dow: dowDe(em(-3)), fixaDesde: em(-20), feitas: {} });
await dg('cg8', { titulo: 'SEGREDO-d8 fixa semanal que venceu há 3 dias e foi feita', resp: '22222/GO', fixa: true, repete: 'semanal', dow: dowDe(em(-3)), fixaDesde: em(-20), feitas: { [em(-3)]: { por: 'x' } } });
await dg('cg9', { titulo: 'SEGREDO-d9 trabalhar longe', resp: '22222/GO', trabalhar: em(20), fatal: em(25) });
await ag('cg-a1', { tipo: 'prazo', titulo: 'SEGREDO-a1 prazo vencido', resp: ['11111/GO'], data: em(-4) });
await ag('cg-a2', { tipo: 'audiencia', titulo: 'SEGREDO-a2 audiência que passou', resp: ['11111/GO'], data: em(-4) });
const c2 = await bruno('GET', '/api/agenda/carga'), q = (k) => c2.j.pessoas.find((x) => x.chave === k);
check(q('11111/GO').atrDel === 1 && q('11111/GO').del[1] === 1 && q('11111/GO').delSem === 1 && q('11111/GO').del[2] === 1, 'Ana: 1 delegada atrasada, 1 no dia da data de trabalhar (amanhã), 1 sem data (só no total) e a fixa semanal no dia em que vence; concluída e conta fixa do escritório não contam');
check(q('11111/GO').atrAg === 1 && q('11111/GO').total === 2, 'Agenda: o prazo vencido e não concluído vira "atrasada"; a audiência que já passou não; o total da Agenda (dias/total) continua igual');
check(q('u:u6').atrDel === 1 && q('u:u6').del[4] === 1 && q('22222/GO').atrDel === 0 && q('22222/GO').del.reduce((a, b) => a + b, 0) === 1, 'fixa vencida sem "feita" é atrasada (e volta a vencer na semana seguinte); a marcada como feita não; tarefa com data de trabalhar longe da janela não entra');
check(!JSON.stringify(c2.j).includes('SEGREDO'), 'continua sem título nem id de nenhum item');
for (const id of ['cg1', 'cg2', 'cg3', 'cg4', 'cg5', 'cg6', 'cg7', 'cg8', 'cg9']) await dono('DELETE', '/api/db/delegadas/' + id);
await dono('DELETE', '/api/db/agenda/cg-a1'); await dono('DELETE', '/api/db/agenda/cg-a2');

console.log('\n— equipe para os seletores');
const eq = await ana('GET', '/api/equipe');
check(eq.j.estagiarios.some((e) => e.id === 'u6' && e.nome === 'Edu Estagiario') && eq.j.estagiarios.length >= 3 && !JSON.stringify(eq.j).includes('@'), '/api/equipe traz também os estagiários ativos (id e nome), sem e-mails');
check((await ana('GET', '/api/eu')).j.id === 'u2', '/api/eu informa o id (para reconhecer "eu" como responsável)');
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
