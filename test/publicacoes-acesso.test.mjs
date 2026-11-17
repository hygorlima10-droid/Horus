// Testa as publicações por OAB (Fase 5, etapa 5.3). Mesmo banco semeado do teste 'permissoes' (5 publicações no Diário simulado em _pub).
// Servidor do grupo 'permissoes':  node test/rodar.mjs publicacoes-acesso
const B = process.env.BASE || 'http://127.0.0.1:8816';
const TOK = { dono: 'tok-dono-0000000000000000000000000001', ana: 'tok-adv-ana-00000000000000000000000002', bruno: 'tok-adv-bruno-000000000000000000000003', caio: 'tok-est-caio-0000000000000000000000004', dani: 'tok-est-dani-0000000000000000000000005', edu: 'tok-est-edu-00000000000000000000000000006' };
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const quem = (n) => async (m, p, b) => { const x = await fetch(B + p, { method: m, headers: { cookie: 'sessao=' + TOK[n], 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined }); let j = null; try { j = await x.json(); } catch (e) { /* sem corpo */ } return { s: x.status, j }; };
const dono = quem('dono'), ana = quem('ana'), bruno = quem('bruno'), caio = quem('caio'), edu = quem('edu');
const ids = (r) => (r.j && r.j.pubs ? r.j.pubs.map((p) => p.id).sort().join(',') : '?' + r.s);

// os testes anteriores do grupo mexeram nos dados: volta ao ponto de partida deste (c5 de volta com a Ana; leitura e tratamento zerados)
await dono('PUT', '/api/db/casos/c5', { cliente: 'Cliente Um', numeroProcesso: '0000005-55.2024.8.09.0005', advogados: [{ oab: '11111/GO' }] });
for (const u of [dono, ana, bruno, caio, quem('dani'), edu]) await u('POST', '/api/djen/marcar', { ids: ['100', '101', '102', '103', '104'], lida: null, semPrazo: null, tratada: false });
console.log('\n— quem vê quais publicações');
check(ids(await dono('GET', '/api/djen/lista')) === '100,101,102,103,104', 'proprietário vê todas (sem filtro)');
check(ids(await ana('GET', '/api/djen/lista')) === '100,102,104', 'Ana vê as da OAB dela (100 e a compartilhada 102) e as de processos em que está cadastrada (104: o processo 0000005 é dela, mesmo sem a OAB na publicação)');
check(ids(await bruno('GET', '/api/djen/lista')) === '101,102', 'Bruno vê só as dele (101 e a compartilhada 102)');
check(ids(await caio('GET', '/api/djen/lista')) === '100,101,102,103,104', 'estagiário vê todas (permissão ligada por padrão)');
check((await edu('GET', '/api/djen/lista')).s === 403, 'estagiário com a permissão desligada não vê nenhuma');
check(ids(await dono('GET', '/api/djen/lista?escopo=meus')) === '103', 'o proprietário pode pedir "só as minhas" (sem OAB indicada, vale a principal)');

console.log('\n— contagens e lista de OABs');
const ea = await ana('GET', '/api/djen/estado');
check(ea.j.total === 3 && ea.j.naoLidas === 3 && ea.j.oabs.length === 1 && ea.j.oabs[0].numero === '11111', 'o estado da Ana conta só as dela e mostra só a OAB dela');
check((await dono('GET', '/api/djen/estado')).j.oabs.length === 3 && (await caio('GET', '/api/djen/estado')).j.oabs.length === 3, 'proprietário e estagiário veem as OABs do escritório');

console.log('\n— ler: o "lida" é de cada pessoa');
check((await ana('POST', '/api/djen/marcar', { ids: ['100', '102', '101'], lida: true })).j.alteradas === 2, 'Ana só consegue marcar as que vê (101 é do Bruno e fica de fora)');
check((await ana('GET', '/api/djen/lista')).j.pubs.filter((p) => p.id !== '104').every((p) => p.lida === true) && (await ana('GET', '/api/djen/estado')).j.naoLidas === 1, 'para a Ana ficam lidas (a 104, que ela não marcou, continua não lida)');
check((await bruno('GET', '/api/djen/lista')).j.pubs.every((p) => p.lida === false) && (await dono('GET', '/api/djen/lista')).j.pubs.every((p) => p.lida === false), 'para o Bruno e para o proprietário continuam não lidas (a 102 é das duas OABs)');
check((await bruno('POST', '/api/djen/marcar', { ids: ['100'], lida: true })).j.alteradas === 0, 'não marca publicação de outro advogado');
check((await dono('POST', '/api/djen/marcar', { ids: ['103'], lida: true })).j.alteradas === 1 && (await dono('GET', '/api/djen/lista')).j.pubs.find((p) => p.id === '103').lida === true && (await caio('GET', '/api/djen/lista')).j.pubs.find((p) => p.id === '103').lida === false, 'a leitura do proprietário continua valendo para ele e não muda a do estagiário');
check((await ana('POST', '/api/djen/marcar', { ids: ['100'], semPrazo: true })).j.alteradas === 1 && (await ana('GET', '/api/djen/lista')).j.pubs.find((p) => p.id === '100').semPrazo === true && (await dono('GET', '/api/djen/lista')).j.pubs.find((p) => p.id === '100').semPrazo === false, 'advogado pode dizer "sem prazo" nas dele, e isso vale só para ele (o colega continua vendo a sugestão)');
check((await caio('POST', '/api/djen/marcar', { ids: ['101'], semPrazo: true })).j.alteradas === 1 && !(await dono('GET', '/api/djen/lista')).j.pubs.find((p) => p.id === '101').semPrazo, 'estagiário não mexe em "sem prazo"');

console.log('\n— texto e processo');
check((await ana('GET', '/api/djen/texto?id=101')).s === 404, 'texto de publicação de outro advogado: não encontrada');
check((await ana('GET', '/api/djen/processo?numero=0000002-22.2024.8.09.0002')).s === 403 && (await caio('GET', '/api/djen/processo?numero=1')).s === 400, 'advogado só consulta processos em que está cadastrado');

console.log('\n— o que continua só do proprietário');
for (const [n, u] of [['advogada', ana], ['estagiário', caio]]) check((await u('POST', '/api/djen/buscar', {})).s === 403 && (await u('POST', '/api/djen/importar', {})).s === 403 && (await u('PUT', '/api/djen/oabs', { oabs: [] })).s === 403 && (await u('POST', '/api/djen/advogados', {})).s === 403 && (await u('GET', '/api/djen/teste')).s === 403, n + ': buscar, importar, OABs, completar advogados e teste são recusados (os avisos no celular agora são de cada pessoa, desde a 5.8)');
check((await ana('GET', '/api/datajud/processo?numero=1')).s === 400, 'consulta ao DataJud está liberada (dado público do tribunal)');

console.log('\n— OAB do proprietário (para "só as minhas")');
check((await dono('PUT', '/api/usuarios/u1', { oabs: ['74506/GO'] })).s === 200 && (await dono('PUT', '/api/usuarios/u1', { papel: 'estagiario' })).s === 403 && (await dono('PUT', '/api/usuarios/u1', { ativo: false })).s === 403, 'o proprietário só indica as próprias OABs (papel e situação seguem intocáveis)');
check((await dono('GET', '/api/eu')).j.oabs[0] === '74506/GO' && ids(await dono('GET', '/api/djen/lista?escopo=meus')) === '', 'com OAB indicada, "só as minhas" usa ela (nenhuma publicação de 74506 neste banco)');

console.log('\n— publicações compartilhadas entre responsáveis (tratar × só ler)');
const dani = quem('dani'), pub = async (u, id) => (await u('GET', '/api/djen/lista')).j.pubs.find((p) => p.id === id);
// só ler: o colega continua vendo como não lida, com o aviso de quem leu
check((await bruno('POST', '/api/djen/marcar', { ids: ['102'], lida: true })).j.alteradas === 1, 'Bruno lê a 102 (sem criar nada)');
{ const pa = await pub(ana, '102'); check(pa.lida === true && pa.leuPor.some((x) => x.nome === 'Bruno'), 'a Ana já tinha lido a 102 e passa a ver que o Bruno também leu'); }
check((await ana('POST', '/api/djen/marcar', { ids: ['102'], lida: false })).j.alteradas === 1, 'a Ana volta a 102 para não lida');
{ const pa = await pub(ana, '102'); check(pa.lida === false && pa.leuPor.some((x) => x.nome === 'Bruno') && !pa.lidaAuto, 'para a Ana a 102 está não lida e mostra "Bruno leu"'); }
// tratar: vira lida para os colegas
check((await ana('POST', '/api/djen/marcar', { ids: ['100'], tratada: true, como: 'prazo' })).j.alteradas === 1, 'a Ana trata a 100 (criou um prazo)');
{ const pd = await pub(dono, '100'), pc = await pub(caio, '100'), pa = await pub(ana, '100'); check(pd.lida === true && pd.lidaAuto === true && pd.tratadas[0].nome === 'Ana' && pd.tratadas[0].como === 'prazo' && pc.lida === true && pc.lidaAuto === true && pa.lida === true && pa.lidaAuto === false && pa.tratadas[0].meu === true, 'tratada por advogada: vira lida sozinha para o proprietário e para o estagiário, com o selo de quem tratou'); }
check((await bruno('POST', '/api/djen/marcar', { ids: ['102'], tratada: true, como: 'audiencia' })).j.alteradas === 1, 'o Bruno trata a 102 (criou uma audiência)');
{ const pa = await pub(ana, '102'); check(pa.lida === false && pa.tratadas[0].nome === 'Bruno', 'a escolha explícita de "não lida" da Ana continua valendo, mesmo tratada por outro (ela vê "tratada por Bruno")'); }
check((await ana('POST', '/api/djen/marcar', { ids: ['102'], lida: true })).j.alteradas === 1 && (await ana('GET', '/api/djen/estado')).j.naoLidas === 1, 'a contagem da Ana segue a leitura efetiva (só a 104 pendente)');
// estagiário prepara: advogados continuam vendo como não lida; outros estagiários, lida
check((await caio('POST', '/api/djen/marcar', { ids: ['101'], tratada: true, como: 'tarefa' })).j.alteradas === 1, 'o Caio (estagiário) prepara a 101 (criou uma tarefa)');
{ const pb = await pub(bruno, '101'), pd = await pub(dono, '101'), pdani = await pub(dani, '101'); check(pb.lida === false && pb.tratadas[0].papel === 'estagiario' && pd.lida === false && pdani.lida === true && pdani.lidaAuto === true, 'preparada por estagiário: advogado e proprietário continuam com não lida ("preparada por Caio"); outra estagiária vê como lida'); }
// proprietário trata
check((await dono('POST', '/api/djen/marcar', { ids: ['103'], tratada: true, como: 'prazo' })).j.alteradas === 1 && (await pub(dani, '103')).lida === true && (await pub(caio, '103')).lida === true, 'o proprietário trata a 103: vira lida para as estagiárias');
// desfazer
check((await ana('POST', '/api/djen/marcar', { ids: ['100'], tratada: false, lida: false })).j.alteradas === 1, 'a Ana desfaz o tratamento da 100');
{ const pd = await pub(dono, '100'), pc = await pub(caio, '100'), pa = await pub(ana, '100'); check(pd.lida === false && pc.lida === false && pa.lida === false && pd.tratadas.length === 0, 'desfeito: volta a não lida para todos, sem selo'); }
// "não é prazo" pessoal
check((await ana('POST', '/api/djen/marcar', { ids: ['102'], semPrazo: true, lida: true })).j.alteradas === 1, 'a Ana marca "não é prazo" na 102');
check((await pub(ana, '102')).semPrazo === true && (await pub(bruno, '102')).semPrazo === false && (await pub(dono, '102')).semPrazo === false, '"não é prazo" vale só para a Ana (Bruno e proprietário continuam vendo a sugestão)');
{ const pb = await pub(bruno, '102'); check(pb.leuPor.some((x) => x.nome === 'Ana' && x.semPrazo === true), 'o Bruno vê "Ana: não é prazo"'); }
// visibilidade pelo cadastro do processo
check(!(await pub(bruno, '104')) && !!(await pub(ana, '104')), 'a 104 (processo 0000005) aparece para a Ana, que está cadastrada nele, e não para o Bruno');
check((await caio('POST', '/api/djen/marcar', { ids: ['100'], tratada: true, como: 'prazo' })).j.alteradas === 1 && (await pub(ana, '100')).lida === false, 'estagiária tratando a 100 não limpa para a Ana');
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
