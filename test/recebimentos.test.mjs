// Pagamento separado: a coleção `recebimentos` (livro-caixa de cada pessoa por parcela + marcador "o pagador recebeu do cliente").
// Servidor do grupo 'permissoes':  node test/rodar.mjs recebimentos
const B = process.env.BASE || 'http://127.0.0.1:8816';
const TOK = { dono: 'tok-dono-0000000000000000000000000001', ana: 'tok-adv-ana-00000000000000000000000002', bruno: 'tok-adv-bruno-000000000000000000000003', caio: 'tok-est-caio-0000000000000000000000004' };
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const quem = (n) => async (m, p, b) => { const x = await fetch(B + p, { method: m, headers: { cookie: 'sessao=' + TOK[n], 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined }); let j = null; try { j = await x.json(); } catch (e) { } return { s: x.status, j }; };
const dono = quem('dono'), ana = quem('ana'), bruno = quem('bruno'), caio = quem('caio');
const ids = (r) => (r.j && r.j.docs ? r.j.docs.map((d) => d.id).sort().join(',') : '?' + r.s);
const negado = (r) => r.s === 403 || r.s === 404;
const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
for (const d of (await dono('GET', '/api/db/recebimentos')).j.docs || []) await dono('DELETE', '/api/db/recebimentos/' + d.id);
const A3 = [{ oab: '60456/GO', nome: 'Dono Teste' }, { oab: '11111/GO', nome: 'Ana Advogada' }, { oab: '22222/GO', nome: 'Bruno Advogado' }];
const caso = (cliente, num, adv) => ({ tipo: 'inicial', origem: 'murilo', prioridade: 'normal', status: 'pendente', cliente, nomeAcao: 'Ação', numeroProcesso: num, modalidadeHonorario: 'fixo', formaPagamento: 'parcelado', valorHonorarios: 50000, parcelas: [{ numero: 1, valor: 50000, data: hoje, pago: false }], advogados: adv, divisao: { modo: 'direto', partes: [] }, criadoEm: new Date().toISOString() });
await dono('PUT', '/api/db/casos/rb1', caso('Cliente Tres', '0000821-01.2024.8.09.0821', A3));
await dono('PUT', '/api/db/casos/rb2', caso('Cliente So Bruno', '0000822-02.2024.8.09.0822', [A3[2]]));
const parte = (docId, oab, extra) => ({ tipo: 'parte', docTipo: 'caso', docId, chave: docId + '|parcela|1', oab, processo: '00008210120248090821', pago: false, parciais: [], ...extra });
const cli = (docId, extra) => ({ tipo: 'cliente', docTipo: 'caso', docId, chave: docId + '|parcela|1', processo: '00008210120248090821', advs: ['60456/GO', '11111/GO', '22222/GO'], data: hoje, ...extra });

console.log('\n— cada um registra o recebimento dele');
check((await ana('PUT', '/api/db/recebimentos/ra1', parte('rb1', '11111/GO', { pago: true, dataRecebimento: hoje }))).s === 200, 'a Ana registra o recebimento dela');
check(negado(await ana('PUT', '/api/db/recebimentos/ra2', parte('rb1', '22222/GO', { pago: true }))), 'a Ana não registra o recebimento do Bruno');
check(negado(await ana('PUT', '/api/db/recebimentos/ra3', parte('rb2', '11111/GO', { pago: true }))), 'a Ana não registra em processo onde não está cadastrada');
check((await bruno('PUT', '/api/db/recebimentos/rbr1', parte('rb1', '22222/GO', { pago: false, parciais: [{ data: hoje, valor: 1000 }] }))).s === 200, 'o Bruno registra um recebimento parcial dele');
check(negado(await caio('PUT', '/api/db/recebimentos/rc1', parte('rb1', '11111/GO', { pago: true }))), 'o estagiário não registra recebimento');
check((await dono('PUT', '/api/db/recebimentos/rd1', parte('rb1', '60456/GO', { pago: true }))).s === 200 && (await dono('PUT', '/api/db/recebimentos/rd2', parte('rb1', '22222/GO', { pago: true }))).s === 200, 'o proprietário registra o dele e também por outra pessoa');

console.log('\n— quem vê o quê');
check(ids(await ana('GET', '/api/db/recebimentos')) === 'ra1', 'a Ana vê só o recebimento dela (não vê o do Bruno nem o do proprietário)');
check(ids(await bruno('GET', '/api/db/recebimentos')) === 'rbr1,rd2' || ids(await bruno('GET', '/api/db/recebimentos')) === 'rbr1', 'o Bruno vê só os dele: ' + ids(await bruno('GET', '/api/db/recebimentos')));
check(ids(await dono('GET', '/api/db/recebimentos')) === 'ra1,rbr1,rd1,rd2', 'o proprietário vê todos: ' + ids(await dono('GET', '/api/db/recebimentos')));
check((await caio('GET', '/api/db/recebimentos')).s === 200 && ids(await caio('GET', '/api/db/recebimentos')) === '', 'o estagiário não vê nenhum');

console.log('\n— o marcador "o pagador recebeu do cliente"');
check((await ana('PUT', '/api/db/recebimentos/mc1', cli('rb1'))).s === 200, 'a Ana marca que o Murilo recebeu do cliente nesta parcela');
check(/mc1/.test(ids(await bruno('GET', '/api/db/recebimentos'))) && /mc1/.test(ids(await dono('GET', '/api/db/recebimentos'))), 'o Bruno e o proprietário veem o marcador');
check(!/mc1/.test(ids(await caio('GET', '/api/db/recebimentos'))), 'o estagiário não vê o marcador');
check(negado(await bruno('PUT', '/api/db/recebimentos/mc2', cli('rb1', { chave: 'rb2|parcela|1', docId: 'rb2', processo: '00008220220248090822', advs: ['22222/GO'] }))) === false, 'o Bruno marca em processo dele (rb2)');
check(negado(await ana('PUT', '/api/db/recebimentos/mc3', cli('rb2', { chave: 'rb2|parcela|1', processo: '00008220220248090822', advs: ['11111/GO'] }))), 'a Ana não marca em processo onde não está (mesmo falsificando a lista de advogados)');
check((await bruno('PUT', '/api/db/recebimentos/mc1', cli('rb1', { data: hoje, desfeito: true }))).s === 200, 'quem é do processo corrige o marcador');

console.log('\n— o que não muda e desfazer');
check(negado(await ana('PUT', '/api/db/recebimentos/ra1', parte('rb1', '22222/GO', { pago: true }))), 'a pessoa de um recebimento não muda (a Ana não passa o dela para o Bruno)');
check((await ana('DELETE', '/api/db/recebimentos/ra1')).s === 200, 'a Ana desfaz o recebimento dela');
check(negado(await ana('DELETE', '/api/db/recebimentos/rbr1')), 'a Ana não apaga o do Bruno');
check(ids(await ana('GET', '/api/db/recebimentos')) === 'mc1', 'depois de desfazer, a Ana só vê o marcador: ' + ids(await ana('GET', '/api/db/recebimentos')));
check((await dono('GET', '/api/backup')).s === 200, 'o backup do proprietário continua funcionando com a nova coleção');
for (const d of (await dono('GET', '/api/db/recebimentos')).j.docs || []) await dono('DELETE', '/api/db/recebimentos/' + d.id);
await dono('DELETE', '/api/db/casos/rb1'); await dono('DELETE', '/api/db/casos/rb2');
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo.'); process.exit(falhas ? 1 : 0);
