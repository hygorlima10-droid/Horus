// Compartilhar do Android (share_target do manifesto): POST /compartilhar com a sessão de quem está logado guarda o arquivo na caixa DELA.  Use: node test/rodar.mjs atalho-android
const B = process.env.BASE || 'http://127.0.0.1:8819';
const TOK = { dono: 'tok-dono-0000000000000000000000000001', ana: 'tok-adv-ana-00000000000000000000000002', caio: 'tok-est-caio-0000000000000000000000004' };
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const api = async (n, p) => { const x = await fetch(B + p, { headers: { cookie: 'sessao=' + TOK[n] } }); let j = null; try { j = await x.json(); } catch (e) {} return { s: x.status, j }; };
const compartilha = async (quem, arquivos) => { const f = new FormData(); for (const [nome, tipo, conteudo] of arquivos) f.append('arquivos', new Blob([conteudo], { type: tipo }), nome); return fetch(B + '/compartilhar', { method: 'POST', body: f, redirect: 'manual', headers: quem ? { cookie: 'sessao=' + TOK[quem] } : {} }); };

const man = await (await fetch(B + '/manifest.webmanifest')).json();
check(man.share_target && man.share_target.action === '/compartilhar' && man.share_target.method === 'POST' && /multipart/.test(man.share_target.enctype) && man.share_target.params.files[0].name === 'arquivos', 'o manifesto tem o share_target (o Horus aparece no menu Compartilhar do Android)');
check(man.share_target.params.files[0].accept.some((a) => /csv/.test(a)) && man.share_target.params.files[0].accept.some((a) => /pdf/.test(a)) && man.share_target.params.files[0].accept.includes('image/*'), 'aceita PDF, CSV e imagem');

let r = await compartilha('ana', [['Fatura_Itau.pdf', 'application/pdf', '%PDF-1.4 teste'], ['Nubank_2026-12-02.csv', 'text/csv', 'date,title,amount\n2026-11-24,Teste,"1,00"']]);
check(r.status === 303 && /\/\?compartilhado=2$/.test(r.headers.get('location')), 'a Ana compartilha 2 arquivos e volta ao app dizendo "2 recebidos" (' + r.status + ' ' + r.headers.get('location') + ')');
let c = await api('ana', '/api/recebidos'); check(c.j.itens.length === 2 && c.j.itens.some((x) => x.nome === 'Nubank_2026-12-02.csv'), 'os arquivos caem na caixa da Ana');
c = await api('dono', '/api/recebidos'); check(!c.j.itens.some((x) => x.nome === 'Nubank_2026-12-02.csv'), 'o proprietário não vê a caixa da Ana');
r = await compartilha('caio', [['x.pdf', 'application/pdf', '%PDF-1.4']]);
check(r.status === 303 && /compartilhado=0/.test(r.headers.get('location')) && /motivo=/.test(r.headers.get('location')), 'estagiário: não recebe (volta com o motivo)');
r = await compartilha(null, [['x.pdf', 'application/pdf', '%PDF-1.4']]);
check(r.status === 303 && /\/login/.test(r.headers.get('location')), 'sem sessão: vai para o login (nada é guardado)');
r = await compartilha('dono', []);
check(r.status === 303 && /compartilhado=0/.test(r.headers.get('location')), 'compartilhamento sem arquivo: volta avisando que nada chegou');
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
