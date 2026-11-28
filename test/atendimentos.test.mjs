// Atendimentos (gravação + transcrição) pela API: criar, enviar trechos de áudio (R2), transcrever um trecho por chamada (provedor simulado), Range do áudio, falantes,
// acesso por papel (proprietário vê tudo; advogado só os dele; estagiário nada) e apagar só o áudio.   Grupo 'atendimentos':  node test/rodar.mjs atendimentos
const B = process.env.BASE || 'http://127.0.0.1:8823';
const TOK = { dono: 'tok-dono-0000000000000000000000000001', ana: 'tok-adv-ana-00000000000000000000000002', bruno: 'tok-adv-bruno-000000000000000000000003', caio: 'tok-est-caio-0000000000000000000000004' };
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const f = (quem, m, p, corpo, cab = {}) => fetch(B + '/api/atendimentos' + p, { method: m, headers: { cookie: 'sessao=' + TOK[quem], ...(corpo && typeof corpo === 'object' && !(corpo instanceof Uint8Array) ? { 'content-type': 'application/json' } : {}), ...cab }, body: corpo === undefined ? undefined : (corpo instanceof Uint8Array || typeof corpo === 'string' ? corpo : JSON.stringify(corpo)) });
const J = async (r) => ({ s: r.status, j: await r.json().catch(() => ({})) });
const audio = (t) => new TextEncoder().encode(t);
// 1) criar
let r = await J(await f('dono', 'POST', '', { titulo: 'Atendimento da Maria', clienteId: 'c1', casoId: 'k1' }));
check(r.s === 201 && r.j.id && r.j.titulo === 'Atendimento da Maria' && r.j.status === 'gravando', 'cria o atendimento (status "gravando" até chegar áudio)');
const id = r.j.id;
// 2) trechos de áudio (cada um é um arquivo completo)
r = await J(await f('dono', 'PUT', `/${id}/trecho/0?dur=300`, audio('1: Bom dia, conte o que aconteceu.\n0: Fui demitido sem justa causa em março.'), { 'content-type': 'audio/mp4' }));
check(r.s === 200 && r.j.ok && r.j.status === 'enviado', 'o trecho 0 sobe e o atendimento fica "enviado"');
r = await J(await f('dono', 'PUT', `/${id}/trecho/1?dur=240`, audio('0: Recebi só metade das verbas.'), { 'content-type': 'audio/webm;codecs=opus' }));
check(r.s === 200, 'o trecho 1 (webm) sobe');
r = await J(await f('dono', 'PUT', `/${id}/trecho/2`, audio('x'), { 'content-type': 'text/plain' }));
check(r.s === 415, 'arquivo que não é áudio é recusado');
r = await J(await f('dono', 'PUT', `/${id}/trecho/3`, new Uint8Array(0), { 'content-type': 'audio/mp4' }));
check(r.s === 400, 'trecho vazio é recusado');
// 3) transcrever, um trecho por chamada
r = await J(await f('dono', 'POST', `/${id}/transcrever`, {}));
check(r.s === 200 && r.j.feito === 0 && r.j.faltam === 1 && r.j.status === 'parcial' && r.j.provedor === 'teste', 'transcreve o trecho 0 (falta 1) e o status vira "parcial"');
r = await J(await f('dono', 'POST', `/${id}/transcrever`, {}));
check(r.j.feito === 1 && r.j.faltam === 0 && r.j.status === 'pronto', 'transcreve o trecho 1 e fica "pronto"');
r = await J(await f('dono', 'POST', `/${id}/transcrever`, {}));
check(r.s === 200 && r.j.feito === null && r.j.faltam === 0, 'nada mais a transcrever');
// 4) o texto inteiro, com os tempos absolutos (o trecho 1 começa em 300 s)
r = await J(await f('dono', 'GET', `/${id}`));
const it = r.j.itens || [];
check(it.length === 3 && it[0].texto === 'Bom dia, conte o que aconteceu.' && it[0].falante === '1' && it[1].ini === 10 && it[2].texto === 'Recebi só metade das verbas.' && it[2].ini === 300, 'a transcrição vem na ordem, com tempos absolutos (o trecho 1 começa em 300 s) e o falante de cada fala');
check(r.j.dur === 540 && r.j.nTrechos === 2 && r.j.provedores !== undefined, 'a duração total soma os trechos');
// 5) áudio: inteiro e com Range (o Safari exige)
let a = await f('dono', 'GET', `/${id}/trecho/0`);
const total = (await a.arrayBuffer()).byteLength;
check(a.status === 200 && a.headers.get('accept-ranges') === 'bytes' && /audio\/mp4/.test(a.headers.get('content-type')), 'o áudio volta inteiro com Accept-Ranges');
a = await f('dono', 'GET', `/${id}/trecho/0`, undefined, { range: 'bytes=0-9' });
check(a.status === 206 && a.headers.get('content-range') === `bytes 0-9/${total}` && (await a.arrayBuffer()).byteLength === 10, 'Range devolve 206 com o pedaço pedido');
a = await f('dono', 'GET', `/${id}/trecho/0`, undefined, { range: 'bytes=999999-' });
check(a.status === 416, 'Range fora do arquivo devolve 416');
// 6) nomes dos falantes e dados
r = await J(await f('dono', 'PUT', `/${id}`, { titulo: 'Maria: demissão', falantes: { 0: 'Cliente', 1: 'Advogado' }, data: '2026-11-20' }));
check(r.s === 200 && r.j.titulo === 'Maria: demissão' && r.j.falantes['0'] === 'Cliente' && r.j.data === '2026-11-20', 'renomeia os falantes e muda título e data');
// 7) lista com filtro por cliente
r = await J(await f('dono', 'GET', '?cliente=c1'));
check(r.s === 200 && r.j.itens.length === 1 && r.j.itens[0].id === id && r.j.itens[0].temTexto && !('itens' in r.j.itens[0]), 'a lista filtra por cliente e não traz o texto');
r = await J(await f('dono', 'GET', '?cliente=outro'));
check(r.j.itens.length === 0, 'outro cliente: lista vazia');
// 8) acesso por papel
check((await f('caio', 'GET', '')).status === 403 && (await f('caio', 'POST', '', {})).status === 403, 'estagiário não acessa');
r = await J(await f('ana', 'POST', '', { titulo: 'Da Ana' })); const idAna = r.j.id;
check(r.s === 201, 'advogada cria o dela');
check((await f('bruno', 'GET', `/${idAna}`)).status === 404 && (await f('ana', 'GET', `/${id}`)).status === 404, 'um advogado não vê o atendimento do outro, nem o do proprietário');
r = await J(await f('ana', 'GET', ''));
check(r.j.itens.length === 1 && r.j.itens[0].id === idAna, 'a advogada lista só o que ela gravou');
r = await J(await f('dono', 'GET', ''));
check(r.j.itens.length === 2, 'o proprietário lista todos');
// 9) falha do provedor: o áudio fica guardado e o erro é claro
await f('ana', 'PUT', `/${idAna}/trecho/0?dur=60`, audio('FALHAR'), { 'content-type': 'audio/mp4' });
r = await J(await f('ana', 'POST', `/${idAna}/transcrever`, {}));
check(r.s === 502 && /áudio está guardado/.test(r.j.erro || '') && r.j.faltam === 1, 'se o reconhecimento falha, o áudio continua guardado e a resposta explica');
// 10) refazer um trecho substitui o áudio e zera a transcrição daquele trecho
await f('ana', 'PUT', `/${idAna}/trecho/0?dur=60`, audio('0: Agora sim.'), { 'content-type': 'audio/mp4' });
r = await J(await f('ana', 'POST', `/${idAna}/transcrever`, {}));
check(r.s === 200 && r.j.status === 'pronto', 'reenviar o trecho e transcrever de novo funciona');
// 11) apagar só o áudio mantém o texto; depois apagar tudo
r = await J(await f('dono', 'DELETE', `/${id}?soAudio=1`));
check(r.s === 200 && r.j.itens.length === 3 && r.j.nComAudio === 0, 'apagar só o áudio mantém a transcrição');
check((await f('dono', 'GET', `/${id}/trecho/0`)).status === 404, 'o áudio apagado some');
r = await J(await f('dono', 'DELETE', `/${id}`));
check(r.s === 200 && (await f('dono', 'GET', `/${id}`)).status === 404, 'apagar tudo remove o atendimento');
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
