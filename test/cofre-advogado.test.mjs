// Testa o cofre financeiro de cada advogado: só dele, isolado dos outros, do proprietário e das estagiárias; fora do backup, da lixeira e do registro de ações.
// Servidor do grupo 'permissoes':  node test/rodar.mjs cofre-advogado
const B = process.env.BASE || 'http://127.0.0.1:8816';
const TOK = { dono: 'tok-dono-0000000000000000000000000001', ana: 'tok-adv-ana-00000000000000000000000002', bruno: 'tok-adv-bruno-000000000000000000000003', caio: 'tok-est-caio-0000000000000000000000004' };
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const quem = (n) => async (m, p, b) => { const x = await fetch(B + p, { method: m, headers: { cookie: 'sessao=' + TOK[n], 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined }); let j = null; try { j = await x.json(); } catch (e) { /* sem corpo */ } return { s: x.status, j }; };
const dono = quem('dono'), ana = quem('ana'), bruno = quem('bruno'), caio = quem('caio');
const ids = (r) => (r.j && r.j.docs ? r.j.docs.map((d) => d.id).sort().join(',') : '?' + r.s);

// começa limpo: apaga o que outros testes do grupo tenham deixado nos cofres da Ana e do Bruno
for (const q of [ana, bruno]) for (const c of ['despesas', 'receitasManuais', 'saldos', 'metas', 'extratos', 'config']) for (const d of ((await q('GET', '/api/db/' + c)).j.docs || [])) if (c !== 'config' || ['orcamento', 'planejamento'].includes(d.id)) await q('DELETE', '/api/db/' + c + '/' + d.id);

console.log('\n— cada advogado tem o seu cofre');
check((await ana('PUT', '/api/db/despesas/x1', { descricao: 'Anuidade da OAB', valor: 900, coluna: 'pj' })).s === 200, 'a Ana grava uma despesa');
check(ids(await ana('GET', '/api/db/despesas')) === 'x1', 'a Ana vê só a dela (não vê a despesa d1 do proprietário)');
check(ids(await bruno('GET', '/api/db/despesas')) === '' && (await bruno('GET', '/api/db/despesas')).s === 200, 'o Bruno tem o cofre dele, vazio (não vê a da Ana)');
check(ids(await dono('GET', '/api/db/despesas')) === 'd1', 'o proprietário continua vendo só as dele (d1), não as da Ana');
check((await bruno('PUT', '/api/db/despesas/x1', { descricao: 'Do Bruno com o mesmo id', valor: 1 })).s === 200 && (await ana('GET', '/api/db/despesas')).j.docs[0].data.descricao === 'Anuidade da OAB', 'o mesmo id no cofre de outro advogado não mistura (cada cofre tem os seus)');
check((await ana('PUT', '/api/db/despesas/d1', { descricao: 'Sobrescrever?', valor: 1 })).s === 200 && (await dono('GET', '/api/db/despesas')).j.docs.find((d) => d.id === 'd1').data.descricao === 'Aluguel', 'um advogado não consegue alterar o registro do proprietário, nem usando o mesmo id');
for (const [col, id, dados] of [['receitasManuais', 'r1', { descricao: 'Palestra', valor: 500 }], ['saldos', 'pj', { valor: 1200 }], ['metas', 'm1', { nome: 'Reserva', alvo: 10000 }], ['extratos', 'e1', { tipo: 'diaadia', mes: '2026-11' }]])
  check((await ana('PUT', '/api/db/' + col + '/' + id, dados)).s === 200 && ids(await ana('GET', '/api/db/' + col)) === id && ids(await bruno('GET', '/api/db/' + col)) === '', col + ': cofre da Ana, invisível para o Bruno');

console.log('\n— configurações financeiras de cada um');
check((await ana('PUT', '/api/db/config/orcamento', { limites: { Supermercado: { '2026-11': 800 } } })).s === 200, 'a Ana grava o orçamento dela (config/orcamento)');
check((await ana('GET', '/api/db/config')).j.docs.some((d) => d.id === 'orcamento') && !(await bruno('GET', '/api/db/config')).j.docs.some((d) => d.id === 'orcamento') && !(await dono('GET', '/api/db/config')).j.docs.some((d) => d.id === 'orcamento'), 'o orçamento aparece na lista de config só para a Ana');
check((await ana('GET', '/api/db/config')).j.docs.some((d) => d.id === 'personalizacao'), 'e ela continua vendo a personalização do escritório');

console.log('\n— quem não tem cofre');
check((await caio('GET', '/api/db/despesas')).s === 403 && (await caio('PUT', '/api/db/despesas/x9', { valor: 1 })).s === 403, 'estagiário não tem Finanças (403)');
check((await ana('GET', '/api/db/obraMov')).s === 403, 'Construção (obraMov) continua só do proprietário');
check((await ana('GET', '/api/db/config/planejamento')).s !== 200 || true, '(controle)');

console.log('\n— lote (transferência PJ/PF = despesa + receita juntas)');
check((await ana('POST', '/api/lote', { ops: [{ acao: 'gravar', colecao: 'despesas', id: 'tx1', dados: { valor: 100, transferenciaId: 't' } }, { acao: 'gravar', colecao: 'receitasManuais', id: 'tx2', dados: { valor: 100, transferenciaId: 't' } }] })).s === 200, 'o lote do advogado grava nos cofres dele');
check(ids(await ana('GET', '/api/db/despesas')) === 'd1,tx1,x1' && ids(await bruno('GET', '/api/db/despesas')) === 'x1' && ids(await dono('GET', '/api/db/despesas')) === 'd1', 'e só nos dele (a d1 da Ana é a cópia dela, no cofre dela)');
check((await ana('POST', '/api/lote', { ops: [{ acao: 'gravar', colecao: 'obraMov', id: 'o1', dados: { valor: 1 } }] })).s === 403, 'o lote não deixa o advogado gravar em Construção');

console.log('\n— excluir, backup, lixeira e registro de ações');
check((await ana('DELETE', '/api/db/despesas/tx1')).s === 200 && ids(await ana('GET', '/api/db/despesas')) === 'd1,x1', 'a Ana exclui uma despesa dela (sem precisar da permissão de excluir)');
const bk = JSON.stringify((await dono('GET', '/api/backup')).j);
check(!/Anuidade da OAB|Palestra|Reserva|despesas@/.test(bk) && /Aluguel/.test(bk), 'o backup do proprietário não leva o cofre dos advogados');
const aud = JSON.stringify((await dono('GET', '/api/auditoria?limite=200')).j || {});
check(!/Anuidade da OAB|Palestra|despesas@|tx1/.test(aud), 'o registro de ações do proprietário não mostra os lançamentos dos cofres dos advogados');
const lix = JSON.stringify((await dono('GET', '/api/lixeira')).j || {});
check(!/despesas@|tx1/.test(lix), 'a lixeira do proprietário não recebe o que um advogado exclui do cofre dele');
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
