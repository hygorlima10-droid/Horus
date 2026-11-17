// Testa o texto e a fonte da mensagem de cobrança: relatório do Murilo (sem vencimento/atraso, sem repetição) e cobrança de cliente (uma linha por item, saudação pela hora).
// Suba antes:  npx wrangler dev --local --persist-to .dev-data --var SENHA:senha-de-teste-123 --port 8802
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8802', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const dia = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10), agora = new Date().toISOString();
let r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.8' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const api = (m, p, b) => fetch(B + '/api/db/' + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
for (const col of ['casos', 'termosAcordo', 'alvaras', 'clientes', 'despesas', 'receitasManuais', 'metas', 'saldos', 'config', 'extratos', 'obraMov']) for (const d of (await (await api('GET', col)).json()).docs) await api('DELETE', col + '/' + d.id);
const caso = (id, cliente, origem, ps) => api('PUT', 'casos/' + id, { tipo: 'inicial', cliente, nomeAcao: 'Cobrança', origem, prioridade: 'normal', status: 'pendente', statusDesde: agora, modalidadeHonorario: 'fixo', formaPagamento: 'parcelado', valorHonorarios: ps.reduce((t, p) => t + p.valor, 0), parcelas: ps.map((p, i) => ({ numero: i + 1, valor: p.valor, data: p.data, pago: false })), clienteIds: [], criadoEm: agora, atualizadoEm: agora });
await caso('c1', 'Joana Murilo', 'murilo', [{ valor: 1000, data: dia(-40) }, { valor: 1000, data: dia(-10) }]);
await caso('c3', 'Ana Própria', 'proprio', [{ valor: 700, data: dia(-3) }, { valor: 300, data: dia(-12) }]);
await api('PUT', 'termosAcordo/a1', { partes: 'Complem x Maurício', numeroProcesso: '1', origem: 'murilo', status: 'pendente', valorTotal: 9000, valorMeuHonorario: 2277.14, data: dia(-4), clienteIds: [], criadoEm: agora, atualizadoEm: agora });
await api('PUT', 'config/backup', { ultimoEm: agora });
const br = await chromium.launch(); const page = await (await br.newContext({ viewport: { width: 420, height: 900 } })).newPage(); const erros = []; page.on('pageerror', e => erros.push(e.message)); await page.route(/fonts\./, r => r.abort());
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(2500);
const texto = () => page.evaluate(() => document.getElementById('relMuriloTexto').value);
const fecha = () => page.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
const conta = (t, re) => (t.match(re) || []).length;

// 1) Relatório do Murilo
await page.evaluate(() => document.getElementById('abrirRelMuriloBtn').click()); await page.waitForTimeout(800);
let t = await texto();
check(/^\*Prestação de contas — honorários\*\nMurilo, segue o que tenho a receber\.\nReferência: /.test(t), 'Murilo: abre com título, saudação e referência');
check(!/vencid|atras|venc\.|venceu|⚠|há \d+ dias?/i.test(t), 'Murilo: não fala em vencimento, atraso nem dias de atraso e não tem o símbolo de alerta');
check(!/[━═]/.test(t) && !/SUBTOTAL/i.test(t), 'Murilo: sem linhas decorativas e sem subtotais repetidos');
check(/\*1\) A receber até \d\d\/\d\d\/\d{4} — R\$\s*[\d.]+,\d\d\*/.test(t), 'Murilo: o total da seção fica na linha do título');
check(/\*Petições iniciais\*/.test(t) && /\*Termos de acordo\*/.test(t) && conta(t, /Petição inicial/g) === 0, 'Murilo: itens agrupados por tipo, sem repetir o tipo em cada item');
check(/• Joana Murilo — Cobrança/.test(t), 'Murilo: o item mostra cliente e ação');
check(conta(t, /Total geral/gi) <= 1 && /Qualquer divergência, me avise que confiro\. Obrigado!$/.test(t), 'Murilo: no máximo um total geral e fecha com o agradecimento');
const tiles = await page.evaluate(() => document.getElementById('relMuriloTotais').innerText);
check(!/Atrasado|Vence em/i.test(tiles) && /A receber até/.test(tiles), 'Murilo: os cartões de total não mostram "Atrasado" nem "Vence em"');
const fonte = await page.evaluate(() => getComputedStyle(document.getElementById('relMuriloTexto')).fontFamily);
check(/Inter/.test(fonte) && !/mono/i.test(fonte), 'a caixa do texto usa a fonte padrão do app (' + fonte.slice(0, 40) + '…)');
await fecha();

// 2) Cobrança de cliente
await page.evaluate(() => document.getElementById('abrirCobrancaProprioBtn').click()); await page.waitForTimeout(800);
t = await texto();
check(/^(Bom dia|Boa tarde|Boa noite), Ana! Tudo bem\?\n/.test(t), 'Cliente: a saudação segue a hora do dia e usa só o primeiro nome');
check(conta(t, /Ana/g) === 1, 'Cliente: o nome aparece só na saudação');
check(/Conferindo aqui, há honorários com vencimento já passado:/.test(t) && !/advocatícios/.test(t), 'Cliente: introdução curta (tom "atraso")');
check(!/Valor:/.test(t) && !/\(em atraso\)/.test(t) && !/ venc\. /.test(t), 'Cliente: sem a linha "Valor:" e sem "(em atraso)" repetido');
check(/venceu em \d\d\/\d\d, há 3 dias — R\$\s*700,00/.test(t) && /há 12 dias — R\$\s*300,00/.test(t), 'Cliente: cada item numa linha só, com "há N dias" e o valor no fim');
check(/\*Total em aberto: R\$\s*1\.000,00\*/.test(t), 'Cliente: "Total em aberto" quando tudo já venceu (sem "até" o fim do mês)');
check(/Consegue me dizer quando poderá regularizar\? Se já pagou, é só enviar o comprovante para eu dar baixa\. Obrigado!$/.test(t) && conta(t, /Obrigado/g) === 1, 'Cliente: fechamento curto, com um só "Obrigado"');
await page.selectOption('#relTom', 'firme'); await page.waitForTimeout(300); t = await texto();
check(/^Prezado\(a\) Ana, (bom dia|boa tarde|boa noite)\./.test(t) && /regularizar em até 5 dias/.test(t), 'Cliente: tom firme — "Prezado(a) Ana, boa tarde." e prazo de 5 dias');
await page.selectOption('#relTom', 'amigavel'); await page.waitForTimeout(300); t = await texto();
check(/Passando para lembrar dos honorários pendentes:/.test(t) && /Se já pagou, é só me enviar o comprovante/.test(t), 'Cliente: tom amigável');
check(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
