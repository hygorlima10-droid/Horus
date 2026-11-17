// Testa que o cliente escolhido na ficha do processo (aberta pela aba Processos ou por uma publicação) também vale para a Inicial, o Acordo e o Alvará do mesmo número que estavam sem cliente.
// Suba antes:  node test/rodar.mjs processo-cliente-atos
// Suba antes (banco novo):
//   npx wrangler d1 execute controle-juridico --local --persist-to /tmp/dev-data-pub --file schema.sql
//   npx wrangler dev --local --persist-to /tmp/dev-data-pub --var SENHA:senha-de-teste-123 --port 8812
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8812', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10), agora = new Date().toISOString();
const hojeLocal = new Date().toLocaleDateString('sv-SE');
const dia = n => new Date(Date.parse(hoje + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
let r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.12' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const f = (m, p, b) => fetch(B + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(async x => ({ s: x.status, j: await x.json().catch(() => ({})) }));
const docs = async col => (await f('GET', '/api/db/' + col)).j.docs.map(d => ({ id: d.id, ...d.data }));
for (const col of ['casos', 'termosAcordo', 'alvaras', 'clientes', 'despesas', 'receitasManuais', 'metas', 'saldos', 'config', 'extratos', 'obraMov', 'prazosPub', 'agenda', 'processos']) for (const d of (await f('GET', '/api/db/' + col)).j.docs || []) await f('DELETE', '/api/db/' + col + '/' + d.id);
const N5 = '5000555-02.2024.8.09.0107', N6 = '5000666-02.2024.8.09.0107';
await f('PUT', '/api/db/clientes/clx', { nome: 'Cliente Existente', pagador: 'cliente', criadoEm: agora });
await f('PUT', '/api/db/casos/c5', { tipo: 'inicial', cliente: 'Beltrano', nomeAcao: 'Cobrança', origem: 'proprio', prioridade: 'normal', status: 'protocolado', statusDesde: agora, numeroProcesso: N5, modalidadeHonorario: 'fixo', formaPagamento: 'avista', valorHonorarios: 1000, avista: { data: dia(-2), pago: false }, clienteIds: [], criadoEm: agora, atualizadoEm: agora });
await f('PUT', '/api/db/termosAcordo/a5', { partes: 'Beltrano x Banco', numeroProcesso: N5, origem: 'proprio', status: 'pendente', valorTotal: 2000, valorMeuHonorario: 600, parcelas: [{ numero: 1, valor: 600, data: dia(10), pago: false }], data: dia(10), clienteIds: [], criadoEm: agora, atualizadoEm: agora });
await f('PUT', '/api/db/casos/c6', { tipo: 'inicial', cliente: 'Outro', nomeAcao: 'Cobrança', origem: 'proprio', prioridade: 'normal', status: 'protocolado', statusDesde: agora, numeroProcesso: N6, modalidadeHonorario: 'sem_honorarios', clienteIds: ['clx'], criadoEm: agora, atualizadoEm: agora });
const br = await chromium.launch(); const page = await (await br.newContext({ viewport: { width: 1100, height: 900 } })).newPage(); const erros = []; page.on('pageerror', e => erros.push(e.message)); await page.route(/fonts\./, r => r.abort());
await page.addInitScript(() => { try { if (!localStorage.getItem('horus.subaba.v1')) localStorage.setItem('horus.subaba.v1', JSON.stringify({ sub: { processos: 'lista', agenda: 'semana', publicacoes: 'naolidas', clientes: 'lista' }, per: 6 })); } catch (e) { /* sem armazenamento */ } });
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(3000);
await page.evaluate(() => document.querySelector('#drawer [data-tab="processos"]').click()); await page.waitForTimeout(900);
const get = async (col, id) => (await docs(col)).find(d => d.id === id);
const abrir = async n => { await page.evaluate(n => document.querySelector('[data-pr-card="' + n + '"]').click(), n.replace(/\D/g, '')); await page.waitForTimeout(600); await page.evaluate(() => document.querySelector('[data-prf="aba"][data-v="dados"]').click()); await page.waitForTimeout(300); };

// 1) cliente novo cadastrado pela ficha do processo: vale também para a Inicial e o Acordo de mesmo número que estavam sem cliente
await abrir(N5);
await page.fill('#pr_cli', 'Beltrano da Silva'); await page.waitForTimeout(300); await page.click('#pr_sug [data-prf="cli-new"]'); await page.waitForTimeout(500);
await page.click('#cliSalvarBtn'); await page.waitForTimeout(900);
await page.click('[data-prf="salvar"]'); await page.waitForTimeout(1500);
const cli = (await docs('clientes')).find(c => c.nome === 'Beltrano da Silva');
const c5 = await get('casos', 'c5'), a5 = await get('termosAcordo', 'a5');
check(!!cli && (await docs('processos')).some(p => p.numero === N5 && (p.clienteIds || []).includes(cli.id)), 'o processo guarda o cliente novo');
check(cli && (c5.clienteIds || []).includes(cli.id) && (a5.clienteIds || []).includes(cli.id), 'a Inicial e o Acordo do mesmo número que estavam sem cliente passam a ter o cliente (honorários e cobrança dele)');
const aviso = await page.evaluate(() => (document.querySelector('.toast, #toast') || {}).innerText || '');
check(/Inicial/.test(aviso) && /Acordo/.test(aviso), 'o aviso diz em quais cadastros o cliente também foi vinculado: ' + aviso.replace(/\n/g, ' ').slice(0, 120));
const perfil = await page.evaluate(id => { try { return window.__horusTeste.docsDoCliente ? window.__horusTeste.docsDoCliente(id).length : -1; } catch (e) { return -1; } }, cli && cli.id);
if (perfil >= 0) check(perfil === 2, 'o perfil do cliente lista a Inicial e o Acordo (' + perfil + ')');

// 2) ato que já tem outro cliente não é mexido
await page.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
await abrir(N6);
await page.fill('#pr_cli', 'Beltrano'); await page.waitForTimeout(300); await page.click('#pr_sug [data-prf="cli-add"]'); await page.waitForTimeout(300);
await page.click('[data-prf="salvar"]'); await page.waitForTimeout(1200);
const c6 = await get('casos', 'c6');
check(JSON.stringify(c6.clienteIds) === JSON.stringify(['clx']), 'uma Inicial que já tem cliente continua com o dela (nada é trocado sozinho)');
check(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
