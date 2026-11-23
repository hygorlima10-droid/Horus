// Petição para correção/revisão: envio ao R2, comentários, devolução, aprovação, protocolo e acesso.  Use: node test/rodar.mjs peticoes
const B = process.env.BASE || 'http://127.0.0.1:8818';
const TOK = { dono: 'tok-dono-0000000000000000000000000001', ana: 'tok-adv-ana-00000000000000000000000002', bruno: 'tok-adv-bruno-000000000000000000000003', caio: 'tok-est-caio-0000000000000000000000004', dani: 'tok-est-dani-0000000000000000000000005' };
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const quem = (n) => async (m, p, b, bruto) => { const h = { cookie: 'sessao=' + TOK[n] }; if (!bruto) h['content-type'] = 'application/json'; const x = await fetch(B + p, { method: m, headers: h, body: bruto ? bruto : (b !== undefined ? JSON.stringify(b) : undefined) }); const buf = Buffer.from(await x.arrayBuffer()); let j = null; try { j = JSON.parse(buf.toString()); } catch (e) { /* binário */ } return { s: x.status, j, buf }; };
const dono = quem('dono'), ana = quem('ana'), bruno = quem('bruno'), caio = quem('caio');
const docx = (txt) => Buffer.concat([Buffer.from([0x50, 0x4b, 3, 4]), Buffer.from(txt)]);
const pdf = (txt) => Buffer.from('%PDF-1.4\n' + txt);
const status = async (id) => ((await dono('GET', '/api/db/casos')).j.docs.find((d) => d.id === id) || { data: {} }).data.status;

// uma Inicial da Ana (tipo inicial)
const c = await dono('POST', '/api/db/casos', { tipo: 'inicial', cliente: 'Maria da Silva', nomeAcao: 'Inventário', status: 'pendente', advogados: [{ oab: '11111/GO', nome: 'Ana' }] });
const cid = c.j.id; check(!!cid, 'criou a Inicial de teste');
const ids = (await dono('GET', '/api/peticoes/revisores')).j.revisores; const bId = ids.find((r) => r.nome.startsWith('Bruno')).id, dId = ids.find((r) => r.nome.startsWith('Dono')).id;
check(ids.length === 3 && !ids.some((r) => r.nome.startsWith('Caio')), 'revisores: só advogados e proprietário (estagiário não aparece)');

// envio
let r = await ana('POST', '/api/peticoes/enviar/' + cid + '?nome=' + encodeURIComponent('Inicial Maria.docx'), undefined, docx('v1'));
check(r.s === 400, 'sem escolher o revisor não envia (' + r.s + ')');
r = await ana('POST', '/api/peticoes/enviar/' + cid + '?nome=x.docx&revisor=' + bId, undefined, Buffer.from('texto qualquer'));
check(r.s === 400, 'arquivo que não é Word/PDF de verdade é recusado (' + r.s + ')');
r = await ana('POST', '/api/peticoes/enviar/' + cid + '?nome=x.exe&revisor=' + bId, undefined, docx('v1'));
check(r.s === 400, 'extensão que não é .docx/.pdf é recusada');
r = await fetch(B + '/api/peticoes/enviar/' + cid + '?nome=grande.pdf&revisor=' + bId, { method: 'POST', headers: { cookie: 'sessao=' + TOK.ana, 'content-length': String(26 * 1024 * 1024) }, body: 'x' }).then((x) => ({ s: x.status })).catch(() => ({ s: 413 }));
check(r.s === 413 || r.s === 400, 'arquivo de mais de 25 MB é recusado (' + r.s + ')');
r = await ana('POST', '/api/peticoes/enviar/' + cid + '?nome=' + encodeURIComponent('Inicial Maria.docx') + '&revisor=' + bId, undefined, docx('versao um'));
check(r.s === 200 && r.j.peticao.estado === 'a_corrigir' && r.j.peticao.versoes.length === 1, 'a Ana envia a petição ao Bruno (' + r.s + ')');
const pid = r.j.peticao.id;
check((await status(cid)) === 'a_corrigir', 'a Inicial foi para a coluna "A corrigir"');
const lerPers = async () => (((await dono('GET', '/api/db/config')).j.docs || []).find((d) => d.id === 'personalizacao') || { data: {} }).data;
const cols = ((await lerPers()).colunasPeticao || []).map((x) => x.label);
check(cols.indexOf('A corrigir') >= 0 && cols.indexOf('Devolvida para ajustes') >= 0 && cols.indexOf('Aguardando protocolo') >= 0 && cols.indexOf('Aguardando protocolo') < cols.indexOf('Protocolado'), 'as colunas novas existem no quadro: ' + cols.join(' | '));

// quem vê
check((await bruno('GET', '/api/peticoes')).j.itens.length === 1, 'o revisor vê a petição');
check((await caio('GET', '/api/peticoes')).j.itens.length === 1, 'a estagiária vê a petição do escritório');
check((await dono('GET', '/api/peticoes')).j.itens.length === 1, 'o proprietário vê');
const d1 = await bruno('GET', '/api/peticoes/' + pid + '/arquivo?v=1');
check(d1.s === 200 && d1.buf.toString().endsWith('versao um'), 'o revisor baixa a versão 1 (conteúdo igual)');

// quem pode agir
check((await ana('POST', '/api/peticoes/' + pid + '/aprovar')).s === 403, 'quem fez a Inicial não aprova a própria petição');
check((await caio('POST', '/api/peticoes/' + pid + '/comentar', { texto: 'oi' })).s === 403, 'a estagiária não comenta no lugar do revisor');
check((await bruno('POST', '/api/peticoes/' + pid + '/devolver', {})).s === 400, 'não devolve sem nenhum comentário');
r = await bruno('POST', '/api/peticoes/' + pid + '/comentar', { texto: 'Falta o endereço do herdeiro.' });
check(r.s === 200 && r.j.peticao.comentarios.length === 1, 'o revisor comenta');
const anc = { p: 3, ini: 10, fim: 22, quote: 'um trecho aqui', antes: 'antes ', depois: ' depois', paragrafo: 'texto do paragrafo' };
check((await bruno('POST', '/api/peticoes/' + pid + '/comentar', { texto: 'x', ancora: { p: 1, ini: 5, fim: 2, quote: 'a' } })).s === 400, 'âncora inválida (fim antes do início) é recusada');
r = await bruno('POST', '/api/peticoes/' + pid + '/comentar', { texto: 'Comentário no trecho.', ancora: anc });
const cTrecho = r.j.comentario;
check(r.s === 200 && r.j.peticao.comentarios.some((c) => c.id === cTrecho && c.ancora && c.ancora.quote === 'um trecho aqui' && c.estado === 'aberto'), 'comentário no trecho guarda a âncora e nasce "aberto"');
check((await ana('POST', '/api/peticoes/' + pid + '/comentar', { texto: 'eu também' })).s === 403, 'quem fez a Inicial não comenta (só o revisor)');
r = await bruno('POST', '/api/peticoes/' + pid + '/devolver', { texto: 'Ajuste também o pedido de tutela.' });
check(r.s === 200 && r.j.peticao.estado === 'devolvida' && r.j.peticao.comentarios.length === 3, 'o revisor devolve para ajustes');
check((await status(cid)) === 'devolvida', 'a Inicial foi para "Devolvida para ajustes"');
check((await bruno('POST', '/api/peticoes/enviar/' + cid + '?nome=y.docx', undefined, docx('x'))).s === 403, 'o revisor não manda versão enquanto está com o autor');

// resolver: o autor propõe, o revisor confirma
const res = (q, acao, id2) => q('POST', '/api/peticoes/' + pid + '/resolver', { comentario: id2 || cTrecho, acao });
check((await bruno('POST', '/api/peticoes/' + pid + '/resolver', { comentario: cTrecho, acao: 'propor' })).s === 403, 'o revisor não "propõe" (isso é do autor)');
check((await res(ana, 'resolver')).s === 403, 'o autor não confirma como resolvido');
r = await res(ana, 'propor'); check(r.s === 200 && r.j.peticao.comentarios.find((c) => c.id === cTrecho).estado === 'proposto', 'o autor propõe o comentário como resolvido');
check((await res(ana, 'propor')).s === 409, 'não propõe duas vezes');
r = await res(bruno, 'reabrir'); check(r.s === 200 && r.j.peticao.comentarios.find((c) => c.id === cTrecho).estado === 'aberto', 'o revisor reabre');
await res(ana, 'propor'); r = await res(bruno, 'resolver'); check(r.s === 200 && r.j.peticao.comentarios.find((c) => c.id === cTrecho).estado === 'resolvido', 'o revisor confirma: resolvido');
check((await res(caio, 'propor')).s === 403, 'a estagiária não mexe no estado dos comentários');

// correção e reenvio a outro revisor
r = await ana('POST', '/api/peticoes/enviar/' + cid + '?nome=' + encodeURIComponent('Inicial Maria v2.docx') + '&revisor=' + dId, undefined, docx('versao dois'));
check(r.s === 200 && r.j.peticao.estado === 'a_corrigir' && r.j.peticao.versoes.length === 2 && r.j.peticao.revisor.id === dId, 'a Ana corrige e reenvia a outro revisor (proprietário)');
check((await status(cid)) === 'a_corrigir', 'voltou para "A corrigir"');
check((await dono('GET', '/api/peticoes/' + pid + '/arquivo?v=1')).s === 200, 'a versão 1 continua guardada enquanto não protocola');

// aprovar
check((await bruno('POST', '/api/peticoes/' + pid + '/aprovar')).s === 403, 'o revisor anterior não aprova mais');
r = await dono('POST', '/api/peticoes/' + pid + '/aprovar');
check(r.s === 200 && r.j.peticao.estado === 'aprovada', 'o novo revisor aprova');
const colProt = ((await lerPers()).colunasPeticao || []).find((x) => x.label === 'Aguardando protocolo');
check((await status(cid)) === colProt.id, 'a Inicial foi para "Aguardando protocolo"');

// protocolar: só a versão final fica
await dono('PUT', '/api/db/casos/' + cid, { tipo: 'inicial', cliente: 'Maria da Silva', nomeAcao: 'Inventário', status: 'protocolado', numeroProcesso: '0000009-99.2026.8.09.0001', advogados: [{ oab: '11111/GO', nome: 'Ana' }] });
r = await dono('GET', '/api/peticoes');
const it = r.j.itens[0];
check(it.estado === 'protocolada' && it.versoes.length === 1 && it.versoes[0].n === 2, 'depois de protocolar fica só a versão final');
check((await dono('GET', '/api/peticoes/' + pid + '/arquivo?v=1')).s === 404, 'a versão antiga foi apagada do armazenamento');
check((await dono('GET', '/api/peticoes/' + pid + '/arquivo?v=2')).buf.toString().endsWith('versao dois'), 'a versão final continua disponível');
check((await ana('DELETE', '/api/peticoes/' + pid)).s === 409, 'petição protocolada não é apagada');

// acesso: advogado sem relação não vê nem baixa
const c2 = await dono('POST', '/api/db/casos', { tipo: 'inicial', cliente: 'Cliente Reservado', status: 'pendente', advogados: [{ oab: '11111/GO', nome: 'Ana' }] });
r = await ana('POST', '/api/peticoes/enviar/' + c2.j.id + '?nome=r.pdf&revisor=' + dId, undefined, pdf('reservado'));
const pid2 = r.j.peticao.id;
check(r.s === 200 && (await bruno('GET', '/api/peticoes')).j.itens.every((x) => x.id !== pid2), 'advogado que não participa nem revisa não vê a petição');
check((await bruno('GET', '/api/peticoes/' + pid2 + '/arquivo')).s === 403, 'e não consegue baixar o arquivo');
check((await caio('DELETE', '/api/peticoes/' + pid2)).s === 403, 'a estagiária não apaga');
// o estado não se grava pela API genérica
check((await ana('POST', '/api/db/_peticoes', { estado: 'aprovada' })).s >= 400, 'a coleção de petições não abre pela API genérica');
// uso
r = await dono('GET', '/api/peticoes/uso');
check(r.s === 200 && r.j.bytes > 0 && r.j.nivel === 'ok' && r.j.classeA >= 3 && r.j.maxArquivo === 25 * 1024 * 1024, 'o consumo do mês aparece (' + r.j.bytes + ' bytes, ' + r.j.classeA + ' gravações)');
check((await ana('DELETE', '/api/peticoes/' + pid2)).s === 200, 'quem fez a Inicial apaga a petição ainda não protocolada');
check((await dono('GET', '/api/peticoes/uso')).j.bytes < r.j.bytes, 'o espaço é liberado ao apagar');
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
