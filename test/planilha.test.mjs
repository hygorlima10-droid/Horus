// Planilha ⇄ Agenda (servidor): ligar, chave, importação das linhas, mescla por campo nos dois sentidos, criação nos dois lados, removida/arquivada, mapa de nomes.
// O script da planilha (Apps Script) é simulado aqui: manda as linhas e aplica o que o servidor devolve. Use: node test/rodar.mjs planilha
const B = process.env.BASE || 'http://127.0.0.1:8815', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const r0 = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.91' } }); const ck = r0.headers.get('set-cookie').split(';')[0];
const f = (m, p, b) => fetch(B + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(async r => ({ s: r.status, j: await r.json().catch(() => ({})) }));
const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const ag = async () => (await f('GET', '/api/db/agenda')).j.docs.map(d => ({ id: d.id, ...d.data }));
const INTEGRANTES = [{ nome: 'Hygor', funcao: 'Advogado' }, { nome: 'Kamyla', funcao: 'Estagiária' }, { nome: 'Luiza', funcao: 'Estagiária' }];

// ---- ligar e a chave
check((await f('GET', '/api/planilha/ligada')).j.ligada === false, 'começa desligada');
await f('POST', '/api/planilha/ligar');
const est0 = (await f('GET', '/api/planilha')).j;
check(est0.ligada === true && est0.conectada === false, 'ligar gera a chave; ainda não houve conversa');
const script = await fetch(B + '/api/planilha/script', { headers: { cookie: ck } }).then(r => r.text());
const chave = (/HORUS_CHAVE = '([^']+)'/.exec(script) || [])[1], urlSync = (/HORUS_URL = '([^']+)'/.exec(script) || [])[1];
check(!!chave && /\/api\/planilha-sync$/.test(urlSync) && /function sincronizarHorus/.test(script) && /ligarAoHorus/.test(script) && /ID Horus/.test(script), 'o script gerado traz a chave, o endereço e as funções');
const sync = (corpo, k = chave) => fetch(B + '/api/planilha-sync', { method: 'POST', headers: { authorization: 'Bearer ' + k, 'content-type': 'application/json' }, body: JSON.stringify(corpo) }).then(async r => ({ s: r.status, j: await r.json().catch(() => ({})) }));
check((await sync({ linhas: [] }, 'errada')).s === 401 && (await fetch(B + '/api/planilha-sync', { method: 'POST', body: '{}' })).status === 401, 'sem a chave certa a rota recusa (401)');

// ---- planilha → app: importação (linha concluída não entra; número com quebra de linha é limpo)
const L = (o) => ({ linha: 4, cliente: '', processo: '', titulo: '', resp: '', delegado: '', prio: '', status: '', fatal: '', interno: '', fixa: false, obs: '', id: '', ...o });
let linhas = [
  L({ linha: 4, processo: '\r\n5170137-60.2026.8.09.0108', titulo: 'Planilha de cálculo e andamento', resp: 'Kamyla', delegado: 'Hygor', prio: 'Média', status: 'Em revisão', fatal: '2026-11-18', interno: '2026-11-13' }),
  L({ linha: 5, titulo: 'lembrar impugnação', resp: 'Luiza', status: 'Concluída', fatal: '2026-11-18' }),
  L({ linha: 6, titulo: 'Olhar processos de outros estados', resp: 'Kamyla', delegado: 'Hygor', prio: 'Alta', status: '' }),
];
let r1 = await sync({ planilha: 'Controle de Petições e Tarefas', completo: true, integrantes: INTEGRANTES, linhas });
check(r1.s === 200 && r1.j.ids.length === 2 && r1.j.aplicar.length === 0 && r1.j.novas.length === 0, 'primeira conversa: 2 itens importados (o concluído não entra) e 2 IDs devolvidos para a planilha');
let docs = await ag(), dA = docs.find(d => /cálculo/.test(d.titulo)), dC = docs.find(d => /outros estados/.test(d.titulo));
check(docs.length === 2 && dA.tipo === 'prazo' && dA.processo === '5170137-60.2026.8.09.0108' && dA.data === '2026-11-18' && dA.trabalhar === '2026-11-13' && dA.situacao === 'pronta' && dA.respNome === 'Kamyla' && dA.delegadoPor === 'Hygor' && dA.prioridade === 'Média', 'o item vira prazo, com número formatado, datas, "Em revisão" = peça pronta, responsável e delegado');
check(dC.tipo === 'tarefa' && dC.situacao === 'afazer' && dC.prioridade === 'Alta', 'sem processo e sem data vira tarefa; status vazio = a fazer');
linhas[0].id = r1.j.ids.find(x => x.linha === 4).id; linhas[2].id = r1.j.ids.find(x => x.linha === 6).id;
const est1 = (await f('GET', '/api/planilha')).j;
check(est1.conectada === true && est1.contagem.ligadas === 2 && est1.nomes.map(n => n.planilha).join() === 'Hygor,Kamyla,Luiza', 'a tela de configuração sabe os nomes da planilha e quantas tarefas estão ligadas');

// ---- sem mudança nenhuma: nada acontece
let r2 = await sync({ completo: true, integrantes: INTEGRANTES, linhas });
check(r2.j.ids.length === 0 && r2.j.aplicar.length === 0 && r2.j.novas.length === 0 && (await ag()).length === 2, 'conversa seguinte sem mudanças: nada novo, nada duplicado');

// ---- app → planilha: concluir no app vira "Protocolada" (é prazo)
const hAntes = (await f('GET', '/api/planilha-sync-ping-inexistente')).s;
await f('PUT', '/api/db/agenda/' + dA.id, { ...dA, id: undefined, situacao: 'feito', concluido: true, concluidoEm: hoje });
const ping = await fetch(B + '/api/planilha-sync', { headers: { authorization: 'Bearer ' + chave } }).then(r => r.json());
check(ping.pendente === true, 'o "ping" leve avisa que há algo do app para a planilha');
let r3 = await sync({ completo: true, integrantes: INTEGRANTES, linhas });
check(r3.j.aplicar.length === 1 && r3.j.aplicar[0].id === linhas[0].id && r3.j.aplicar[0].campos.status === 'Protocolada' && Object.keys(r3.j.aplicar[0].campos).join() === 'status', 'concluir um prazo no app manda só "Protocolada" para a linha certa');
linhas[0].status = 'Protocolada';   // a planilha aplicou
let r4 = await sync({ completo: true, integrantes: INTEGRANTES, linhas });
check(r4.j.aplicar.length === 0 && (await ag()).find(d => d.id === dA.id).concluido === true, 'depois de aplicado, as duas pontas concordam e não há vai-e-vem');
check((await fetch(B + '/api/planilha-sync', { headers: { authorization: 'Bearer ' + chave } }).then(r => r.json())).pendente === false, 'e o "ping" volta a dizer que não há nada pendente');

// ---- planilha → app por campo: título e status da outra linha
linhas[2].titulo = 'Olhar processos de outros estados (MG, PB, DF)'; linhas[2].status = 'Em andamento'; linhas[2].resp = 'Luiza';
await sync({ completo: true, integrantes: INTEGRANTES, linhas });
dC = (await ag()).find(d => d.id === dC.id);
check(dC.titulo === 'Olhar processos de outros estados (MG, PB, DF)' && dC.situacao === 'elaboracao' && dC.respNome === 'Luiza', 'mudança na planilha (título, status, responsável) chega ao app');

// ---- conflito: o mesmo campo mudou nos dois lados; vale a planilha
await f('PUT', '/api/db/agenda/' + dC.id, { ...dC, id: undefined, obs: 'obs do app' });
linhas[2].obs = 'obs da planilha';
let r5 = await sync({ completo: true, integrantes: INTEGRANTES, linhas });
dC = (await ag()).find(d => d.id === dC.id);
check(dC.obs === 'obs da planilha' && dC.plan.conflito && dC.plan.conflito.campo === 'obs' && r5.j.aplicar.length === 0, 'mesmo campo mexido nos dois lados: vale a planilha e o app registra o conflito');

// ---- app → planilha: item criado no app com "Também na planilha"
const criado = await f('POST', '/api/db/agenda', { tipo: 'tarefa', titulo: 'Protocolar certidão narrativa', processo: '5727644-22.2026.8.09.0107', data: '2026-11-20', situacao: 'afazer', concluido: false, avisos: [5, 2, 1, 0], resp: [], respNome: 'Kamyla', prioridade: 'Alta', planilha: true, criadoEm: new Date().toISOString() });
let r6 = await sync({ completo: true, integrantes: INTEGRANTES, linhas });
const nova = r6.j.novas[0];
check(r6.j.novas.length === 1 && /^h-/.test(nova.id) && nova.campos.titulo === 'Protocolar certidão narrativa' && nova.campos.resp === 'Kamyla' && nova.campos.prio === 'Alta' && nova.campos.status === 'A fazer' && nova.campos.fatalManual === '2026-11-20' && nova.campos.processo === '5727644-22.2026.8.09.0107', 'item criado no app sai como linha nova (título, responsável, prioridade, status e prazo manual)');
let r6b = await sync({ completo: true, integrantes: INTEGRANTES, linhas });
check(r6b.j.novas.length === 1 && r6b.j.novas[0].id === nova.id, 'enquanto a planilha não confirma, o mesmo ID é oferecido de novo (o script não duplica a linha)');
linhas.push(L({ linha: 7, id: nova.id, processo: nova.campos.processo, titulo: nova.campos.titulo, resp: 'Kamyla', delegado: nova.campos.delegado, prio: 'Alta', status: 'A fazer', fatal: '2026-11-20', interno: '2026-11-19' }));
let r7 = await sync({ completo: true, integrantes: INTEGRANTES, linhas });
const dN = (await ag()).find(d => d.id === criado.j.id);
check(r7.j.novas.length === 0 && r7.j.aplicar.length === 0 && !dN.plan.pendente && dN.trabalhar === '2026-11-19' && (await ag()).length === 3, 'com a linha confirmada tudo se encaixa (sem duplicar) e o "prazo interno" da planilha vira "trabalhar até"');

// ---- linha removida / arquivada
linhas = linhas.filter(l => l.id !== linhas[2].id);   // a linha da outra tarefa sumiu da planilha (excluída à mão)
await sync({ completo: true, integrantes: INTEGRANTES, linhas });
const dRem = (await ag()).find(d => d.titulo.startsWith('Olhar processos'));
check(dRem.plan.removida === true && dRem.situacao === 'elaboracao', 'linha excluída à mão: o item fica no app como "removida da planilha", sem apagar nada');
const dArq = (await ag()).find(d => d.id === dA.id);
check(dArq.concluido === true, 'a linha já concluída que saiu (arquivada) continua concluída no app');
// segurança: leitura vazia suspeita não marca nada
const antesRem = (await ag()).filter(d => d.plan && d.plan.removida).length;
await sync({ completo: true, integrantes: INTEGRANTES, linhas: [] });
check((await ag()).filter(d => d.plan && d.plan.removida).length === antesRem, 'uma leitura vazia (falha na planilha) não marca nada como removido');

// ---- mapa de nomes
const est2 = (await f('GET', '/api/planilha')).j;
check(est2.nomes.every(n => n.chave === '') && Array.isArray(est2.opcoes), 'sem usuários no app, os nomes ficam sem acesso (ligados só pelo nome)');
check((await f('PUT', '/api/planilha/nomes', { mapa: { Kamyla: 'u:naoexiste' } })).j.ok === true && (await f('GET', '/api/planilha')).j.nomes.find(n => n.planilha === 'Kamyla').chave === '', 'uma pessoa que não existe é recusada no mapa');

// ---- desligar
await f('POST', '/api/planilha/desligar');
check((await sync({ linhas: [] })).s === 401 && (await f('GET', '/api/planilha/ligada')).j.ligada === false, 'ao desligar, a chave deixa de valer');
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
