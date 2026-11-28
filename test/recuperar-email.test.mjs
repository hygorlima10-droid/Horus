// Testa a recuperação da senha por código enviado ao e-mail (Brevo simulado por um servidor de mentira na porta 8895).
// Servidor SEM LOGIN_ANTIGO, com banco novo e com as variáveis BREVO_API_KEY=chave-teste-brevo, EMAIL_REMETENTE e EMAIL_API_URL (o grupo "acesso-individual" do test/rodar.mjs já faz isso).
import http from 'node:http';
const B = process.env.BASE || 'http://127.0.0.1:8813', CHAVE = process.env.SENHA || 'senha-de-teste-123';
const DONO = 'hygor@exemplo.com.br', NATH = 'nathanny@exemplo.com.br', S1 = 'minha-senha-forte-1', S2 = 'nova-senha-da-nathanny-22', S3 = 'nova-senha-do-dono-333', S4 = 'outra-senha-da-nathanny-44';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const form = (o) => Object.entries(o).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
const enviar = (rota, corpo, { ip = '1.1.1.1', cookie } = {}) => fetch(B + rota, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded', 'cf-connecting-ip': ip, 'user-agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0 Safari/537.36', ...(cookie ? { cookie } : {}) }, body: form(corpo) });
const ck = (r) => (r.headers.get('set-cookie') || '').split(';')[0];
const api = (rota, cookie, opc = {}) => fetch(B + rota, { redirect: 'manual', ...opc, headers: { cookie, ...(opc.headers || {}) } });

// ---- Brevo de mentira ----
const caixa = [];
const srv = http.createServer((req, res) => {
  let corpo = ''; req.on('data', (d) => { corpo += d; }); req.on('end', () => {
    if (req.headers['api-key'] !== 'chave-teste-brevo') { res.writeHead(401); res.end('{}'); return; }
    if (/falha@exemplo/.test(corpo)) { res.writeHead(403, { 'content-type': 'application/json' }); res.end('{"code":"permission_denied","message":"Sender is not valid or authorized IP"}'); return; }
    try { caixa.push(JSON.parse(corpo)); } catch (e) { /* ignora */ }
    res.writeHead(201, { 'content-type': 'application/json' }); res.end('{"messageId":"x"}');
  });
}).listen(8895);
const codigoDe = (m) => { const x = /(\d{6})/.exec(m && m.subject || ''); return x ? x[1] : ''; };

// ---- preparo: dono + uma estagiária convidada ----
let r = await enviar('/login', { senha: CHAVE }, { ip: '9.9.9.2' }); const legado = ck(r);
r = await enviar('/criar-acesso', { nome: 'Hygor', email: DONO, senha: S1, senha2: S1 }, { cookie: legado }); const cDono = ck(r);
r = await api('/api/usuarios', cDono, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome: 'Nathanny Souza', email: NATH, papel: 'estagiario' }) }); const conv = await r.json();
r = await enviar(new URL(conv.link).pathname, { senha: S1, senha2: S1 }); const cNath = ck(r);
check(r.status === 303 && cNath && (await api('/api/db/casos', cNath)).status === 200, 'preparo: a Nathanny aceitou o convite e está logada');

// ---- a tela ----
r = await fetch(B + '/recuperar'); let t = await r.text();
check(r.status === 200 && t.includes('Recuperar o acesso') && t.includes('type="email"') && t.includes('Enviar o código') && t.includes('/recuperar/chave'), 'a tela "Esqueci minha senha" pede o e-mail e oferece a chave de emergência como alternativa');
r = await fetch(B + '/recuperar/chave'); t = await r.text(); check(r.status === 200 && t.includes('Chave de emergência') && t.includes('type="password"'), 'a tela da chave de emergência continua existindo');

// ---- pedir o código ----
r = await enviar('/recuperar', { email: 'ninguem@exemplo.com' }, { ip: '2.2.2.1' }); t = await r.text();
check(r.status === 200 && t.includes('Digite o código') && caixa.length === 0, 'e-mail sem cadastro: a mesma tela de código, e nenhum e-mail é enviado (não revela quem tem acesso)');
r = await enviar('/recuperar', { email: 'sem-arroba' }, { ip: '2.2.2.2' }); check(r.status === 400, 'e-mail inválido é recusado');
r = await enviar('/recuperar', { email: NATH.toUpperCase() }, { ip: '2.2.2.3' }); t = await r.text();
check(r.status === 200 && t.includes('Digite o código') && t.includes('readonly') && caixa.length === 1, 'e-mail cadastrado (sem diferenciar maiúsculas): mostra a tela do código e envia um e-mail');
const m1 = caixa[0];
check(m1.to[0].email === NATH && /^Seu código do Horus: \d{6}$/.test(m1.subject) && m1.textContent.includes(codigoDe(m1)) && /15 minutos/.test(m1.textContent) && m1.sender.email === 'horus@teste.local' && !/senha|hash/i.test(JSON.stringify(m1).replace(/nova senha|a sua senha continua/gi, '')), 'o e-mail vai para o endereço certo, com o código de 6 números, validade de 15 minutos e o remetente configurado');
r = await enviar('/recuperar', { email: NATH }, { ip: '2.2.2.4' }); check(r.status === 200 && caixa.length === 1, 'pedir de novo em menos de 1 minuto não manda outro e-mail');
const COD = codigoDe(m1);

// ---- usar o código ----
r = await enviar('/recuperar/codigo', { email: NATH, codigo: '000000', senha: S2, senha2: S2 }, { ip: '3.3.3.1' }); t = await r.text();
check(r.status === 401 && t.includes('Código incorreto'), 'código errado: recusado');
r = await enviar('/recuperar/codigo', { email: NATH, codigo: COD, senha: 'curta', senha2: 'curta' }, { ip: '3.3.3.2' }); check(r.status === 400, 'senha curta é recusada (e o código não é gasto)');
r = await enviar('/recuperar/codigo', { email: NATH, codigo: COD, senha: S2, senha2: S2 + 'x' }, { ip: '3.3.3.3' }); check(r.status === 400, 'senhas diferentes são recusadas');
r = await enviar('/recuperar/codigo', { email: 'ninguem@exemplo.com', codigo: COD, senha: S2, senha2: S2 }, { ip: '3.3.3.4' }); check(r.status === 400, 'o código não serve para outro e-mail');
r = await enviar('/recuperar/codigo', { email: NATH, codigo: COD, senha: S2, senha2: S2 }, { ip: '3.3.3.5' }); const cNath2 = ck(r);
check(r.status === 303 && r.headers.get('location') === '/' && /^sessao=/.test(cNath2), 'código certo e senha boa: cria a nova senha e já entra');
check((await api('/api/db/casos', cNath)).status === 401 && (await api('/api/db/casos', cNath2)).status === 200, 'as sessões antigas da Nathanny caíram; a nova funciona');
check((await api('/api/db/casos', cDono)).status === 200, 'a sessão do dono não é afetada pela troca de senha de outra pessoa');
r = await enviar('/login', { email: NATH, senha: S1 }, { ip: '3.3.3.6' }); check(r.status === 401, 'a senha antiga deixou de valer');
r = await enviar('/login', { email: NATH, senha: S2 }, { ip: '3.3.3.7' }); check(r.status === 303, 'a senha nova entra normalmente');
r = await enviar('/recuperar/codigo', { email: NATH, codigo: COD, senha: S4, senha2: S4 }, { ip: '3.3.3.8' }); check(r.status === 400, 'o código vale uma vez só');

// ---- tentativas ----
r = await enviar('/recuperar', { email: NATH }, { ip: '4.4.4.1' });
check(caixa.length === 2, 'depois que o código é usado, um pedido novo gera outro código (o intervalo de 1 minuto vale só enquanto há um código pendente)');
r = await enviar('/recuperar', { email: DONO }, { ip: '4.4.4.2' }); const mD = caixa[caixa.length - 1], codD = codigoDe(mD);
check(caixa.length === 3 && mD.to[0].email === DONO, 'o dono também recebe o código (a recuperação por e-mail vale para todos)');
for (let i = 0; i < 5; i++) await enviar('/recuperar/codigo', { email: DONO, codigo: '11111' + i, senha: S3, senha2: S3 }, { ip: '5.5.5.' + (i + 1) });
r = await enviar('/recuperar/codigo', { email: DONO, codigo: codD, senha: S3, senha2: S3 }, { ip: '5.5.5.9' }); t = await r.text();
check(r.status === 400 && t.includes('Código inválido ou vencido'), 'depois de 5 códigos errados o código é invalidado, mesmo que o certo seja digitado depois');
r = await enviar('/recuperar', { email: DONO }, { ip: '4.4.4.3' }); const codD2 = codigoDe(caixa[caixa.length - 1]);
check(caixa.length === 4 && codD2 && codD2 !== codD, 'depois de invalidado, dá para pedir um código novo');
r = await enviar('/recuperar/codigo', { email: DONO, codigo: codD2, senha: S3, senha2: S3 }, { ip: '5.5.5.10' }); const cDono2 = ck(r);
check(r.status === 303 && (await api('/api/db/casos', cDono)).status === 401 && (await api('/api/db/casos', cDono2)).status === 200, 'dono: código certo redefine a senha, derruba as sessões antigas dele e entra');
r = await api('/api/auditoria?limite=50', cDono2); let aud = ''; try { aud = JSON.stringify(await r.json()); } catch (e) { /* sem acesso à rota */ }
if (aud) check(/Senha redefinida pelo código enviado ao e-mail/.test(aud) && /Código de recuperação enviado/.test(aud), 'o registro de ações guarda o envio do código e a redefinição');

// ---- falha do provedor: aparece no registro de ações com o motivo, e a tela fala em "tente de novo" ----
r = await api('/api/usuarios', cDono2, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome: 'Pessoa Falha', email: 'falha@exemplo.com', papel: 'estagiario' }) }); const cv2 = await r.json();
await enviar(new URL(cv2.link).pathname, { senha: S1, senha2: S1 });
const antesF = caixa.length;
r = await enviar('/recuperar', { email: 'falha@exemplo.com' }, { ip: '4.4.4.9' }); t = await r.text();
check(r.status === 502 && t.includes('Não consegui enviar o e-mail agora') && caixa.length === antesF, 'quando o Brevo recusa: a tela diz para tentar de novo, sem criar código pendente');
r = await api('/api/auditoria?limite=50', cDono2); aud = ''; try { aud = JSON.stringify(await r.json()); } catch (e) { /* sem acesso */ }
if (aud) check(/Brevo recusou o envio do código de recuperação \(HTTP 403: Sender is not valid or authorized IP\)/.test(aud), 'o registro de ações guarda o motivo da recusa do Brevo (para o proprietário diagnosticar)');
// ---- limite de pedidos por aparelho ----
for (let i = 0; i < 5; i++) await enviar('/recuperar', { email: 'x' + i + '@exemplo.com' }, { ip: '6.6.6.6' });
r = await enviar('/recuperar', { email: NATH }, { ip: '6.6.6.6' }); check(r.status === 429, 'pedidos demais do mesmo aparelho: bloqueia por 15 minutos');
srv.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
