// Atalho do iPhone: código por pessoa, caixa de entrada individual, arquivos de até 25 MB no R2.  Use: node test/rodar.mjs atalho
const B = process.env.BASE || 'http://127.0.0.1:8819', LEGADO = 'token-de-teste-com-mais-de-24-caracteres';
const TOK = { dono: 'tok-dono-0000000000000000000000000001', ana: 'tok-adv-ana-00000000000000000000000002', bruno: 'tok-adv-bruno-000000000000000000000003', caio: 'tok-est-caio-0000000000000000000000004' };
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const api = async (n, m, p, b) => { const x = await fetch(B + p, { method: m, headers: { cookie: 'sessao=' + TOK[n], 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined }); let j = null; try { j = await x.json(); } catch (e) { /* binário */ } return { s: x.status, j }; };
const envia = async (codigo, nome, tam, extra = {}) => { const bytes = Buffer.alloc(tam, 65); bytes.write('%PDF-1.4\n'); const x = await fetch(B + '/api/enviar', { method: 'POST', headers: { authorization: 'Bearer ' + codigo, 'x-nome': encodeURIComponent(nome), 'content-type': 'application/pdf', ...extra }, body: bytes }); let j = null; try { j = await x.json(); } catch (e) { /* sem corpo */ } return { s: x.status, j }; };

// código pessoal
let r = await api('ana', 'GET', '/api/atalho'); check(r.s === 200 && r.j.tem === false, 'a Ana ainda não tem código');
r = await api('ana', 'POST', '/api/atalho/gerar'); const cAna = r.j.codigo; check(r.s === 200 && /^[a-z0-9]{4}(-[a-z0-9]{4}){3}$/.test(cAna), 'a Ana gera o código: ' + cAna);
r = await api('ana', 'GET', '/api/atalho'); check(r.j.tem && r.j.codigo === cAna && r.j.esperando === 0, 'o código fica guardado e visível para ela (botão Mostrar)');
check((await api('caio', 'GET', '/api/atalho')).s === 403 && (await api('caio', 'GET', '/api/recebidos')).s === 403 && (await api('caio', 'POST', '/api/atalho/gerar')).s === 403, 'estagiário não usa o atalho nem a caixa de entrada');
r = await api('bruno', 'POST', '/api/atalho/gerar'); const cBruno = r.j.codigo; check(cBruno && cBruno !== cAna, 'o Bruno tem outro código');

// envio: cai na caixa de quem enviou
r = await envia(cAna.toUpperCase().replace(/-/g, ''), 'c6 novembro.pdf', 3 * 1024 * 1024); check(r.s === 200 && r.j.ok, 'a Ana envia 3 MB (o código vale em maiúsculas e sem os traços) (' + r.s + ')');
const idA = r.j.id;
check((await api('ana', 'GET', '/api/recebidos')).j.itens.length === 1, 'a caixa da Ana tem 1 arquivo');
check((await api('bruno', 'GET', '/api/recebidos')).j.itens.length === 0, 'a caixa do Bruno não mostra o da Ana');
check((await api('dono', 'GET', '/api/recebidos')).j.itens.length === 0, 'o proprietário não vê a caixa da Ana');
const dl = await fetch(B + '/api/recebidos/' + idA + '?bin=1', { headers: { cookie: 'sessao=' + TOK.ana } }); const buf = Buffer.from(await dl.arrayBuffer());
check(dl.status === 200 && buf.length === 3 * 1024 * 1024 && buf.slice(0, 8).toString() === '%PDF-1.4', 'a Ana baixa o arquivo inteiro (3 MB)');
check((await api('bruno', 'GET', '/api/recebidos/' + idA)).s === 404 && (await api('dono', 'GET', '/api/recebidos/' + idA)).s === 404, 'ninguém mais abre o arquivo dela');
check((await api('bruno', 'DELETE', '/api/recebidos/' + idA)).s === 404, 'nem apaga');
r = await api('ana', 'GET', '/api/atalho'); check(r.j.esperando === 1 && r.j.ultimo && r.j.ultimo.nome === 'c6 novembro.pdf', 'a tela dela mostra o último envio e 1 esperando');

// tamanho
r = await envia(cAna, 'grande.pdf', 26 * 1024 * 1024); check(r.s === 413, 'mais de 25 MB é recusado (' + r.s + ')');
r = await envia(cBruno, 'medio.pdf', 20 * 1024 * 1024); check(r.s === 200, 'um arquivo de 20 MB passa (antes o limite era ~600 KB)');

// apagar libera
check((await api('ana', 'DELETE', '/api/recebidos/' + idA)).s === 200 && (await api('ana', 'GET', '/api/recebidos')).j.itens.length === 0, 'a Ana apaga depois de ler');

// código errado
r = await envia('xxxx-xxxx-xxxx-xxxx', 'x.pdf', 1000); check(r.s === 401, 'código errado é recusado');

// proprietário: lista, link, desligar
r = await api('dono', 'GET', '/api/atalho/pessoas'); const p = r.j.pessoas;
check(r.s === 200 && p.find((x) => x.nome.startsWith('Ana')).tem && p.find((x) => x.nome.startsWith('Bruno')).tem && p.find((x) => x.nome.startsWith('Caio')).aplica === false, 'o proprietário vê quem tem atalho e quem não se aplica');
check((await api('ana', 'GET', '/api/atalho/pessoas')).s === 403 && (await api('ana', 'POST', '/api/atalho/link', { link: 'https://x.y' })).s === 403, 'advogado não vê a lista nem muda o link');
r = await api('dono', 'POST', '/api/atalho/link', { link: 'https://www.icloud.com/shortcuts/abc123' }); check(r.s === 200 && (await api('ana', 'GET', '/api/atalho')).j.link === 'https://www.icloud.com/shortcuts/abc123', 'o link do atalho cadastrado pelo proprietário aparece para os advogados');
check((await api('dono', 'POST', '/api/atalho/link', { link: 'http://inseguro' })).s === 400, 'link sem https é recusado');
const uidAna = p.find((x) => x.nome.startsWith('Ana')).id;
check((await api('dono', 'POST', '/api/atalho/desligar', { uid: uidAna })).s === 200 && (await envia(cAna, 'x.pdf', 1000)).s === 401, 'o proprietário desliga o código da Ana e ele para de valer');
r = await api('ana', 'POST', '/api/atalho/gerar'); const cAna2 = r.j.codigo; check((await envia(cAna2, 'n.pdf', 1000)).s === 200, 'a Ana gera outro e volta a enviar');
await api('ana', 'POST', '/api/atalho/gerar'); check((await envia(cAna2, 'velho.pdf', 1000)).s === 401, 'trocar o código desliga o anterior na hora');

// código antigo (único): vale para o proprietário até ele gerar o dele
r = await envia(LEGADO, 'antigo.pdf', 5000); check(r.s === 200, 'o código antigo ainda funciona para o proprietário');
check((await api('dono', 'GET', '/api/recebidos')).j.itens.length === 1, 'e cai na caixa do proprietário');
r = await api('dono', 'POST', '/api/atalho/gerar'); const cDono = r.j.codigo; check(!!cDono, 'o proprietário gera o código pessoal');
check((await envia(cDono, 'novo.pdf', 5000)).s === 200, 'o código pessoal do proprietário funciona');
check((await envia(LEGADO, 'antigo2.pdf', 5000)).s === 401, 'depois disso o código antigo é desligado');
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
