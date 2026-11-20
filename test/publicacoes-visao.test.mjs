// Testa a visão e o aviso das publicações (auditoria de 19/11):
//  - toda publicação nova entra no aviso de quem a vê, mesmo de OAB com "avisar" desligado (notificada = false);
//  - o proprietário em "Minhas" também vê as publicações de OAB sem usuário (ex.: o Murilo), sem esconder a lista;
//  - tipos diferentes nunca viram um cartão só.
// O Diário Oficial é simulado na porta 8890. Suba antes (banco novo):
//   npx wrangler d1 execute controle-juridico --local --persist-to /tmp/dev-data-pub --file schema.sql
//   npx wrangler dev --local --persist-to /tmp/dev-data-pub --var SENHA:senha-de-teste-123 --var DJEN_URL:http://127.0.0.1:8890/api/v1/comunicacao --var DJEN_ESPERA_MS:0 --port 8815
import http from 'node:http';
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8815', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const num = k => '62' + String(k).padStart(5, '0') + '-10.2026.8.09.0107';
const it = (id, k, tipo, texto, advs) => ({ id, data_disponibilizacao: hoje, siglaTribunal: 'TJGO', tipoComunicacao: 'Intimação', tipoDocumento: tipo, nomeOrgao: 'Morrinhos - 1ª Vara Cível', nomeClasse: 'PROCEDIMENTO COMUM', numero_processo: num(k).replace(/\D/g, ''), numeroprocessocommascara: num(k), link: '', texto: 'Autos n.: ' + num(k) + '\n' + texto, destinatarios: [{ nome: 'Cliente ' + k, polo: 'A' }], destinatarioadvogados: advs.map(o => ({ advogado: { nome: 'Adv ' + o, numero_oab: o, uf_oab: 'GO' } })) });
const SEG = 'PROCESSO EM SEGREDO DE JUSTIÇA. OS ARQUIVOS DA INTIMAÇÃO NÃO FORAM PUBLICADOS.';
let H = [], M = [];
const fake = http.createServer((req, res) => { const u = new URL(req.url, 'http://x'), l = { '60456': H, '49308': M }[u.searchParams.get('numeroOab')] || []; res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ status: 'success', count: l.length, items: Number(u.searchParams.get('pagina') || 1) === 1 ? l : [] })); }).listen(8890);
await new Promise(ok => fake.on('listening', ok));
const r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.52' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const f = (m, p, b) => fetch(B + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(async x => ({ s: x.status, j: await x.json().catch(() => ({})) }));
await f('PUT', '/api/db/config/backup', { ultimoEm: new Date().toISOString() });
const est = (await f('GET', '/api/djen/estado')).j;
// Hygor (principal, avisar ligado) e Murilo (sem usuário, avisar DESLIGADO)
await f('PUT', '/api/djen/oabs', { oabs: est.oabs.filter(o => o.numero === '60456').concat([{ id: '', nome: 'Murilo', numero: '49308', uf: 'GO', ativo: true, escopo: 'tudo', avisar: false }]) });
H = [it(1, 1, 'Decisão', 'DECISÃO\nDefiro o pedido de penhora em face do executado.', ['60456'])];
M = [it(2, 2, 'Sentença', 'SENTENÇA\nJulgo procedente o pedido inicial, com custas.', ['49308'])];
await f('POST', '/api/djen/buscar', { dias: 30 });   // primeira leitura de cada OAB = histórico (não avisa)
check((await f('GET', '/api/djen/estado')).j.aAvisar === 0, 'a primeira leitura (histórico) não vira aviso');
// chegam publicações novas: uma da OAB com "avisar" e duas da OAB do Murilo (avisar desligado), mais um segredo de justiça com dois tipos
H.push(it(3, 3, 'Decisão', 'DECISÃO\nIntime-se a parte autora para se manifestar.', ['60456']));
M.push(it(4, 4, 'Sentença', 'SENTENÇA\nHomologo o acordo celebrado entre as partes.', ['49308']), it(5, 5, 'Decisão', SEG, ['49308']), it(6, 5, 'Outros', SEG, ['49308']));
await f('POST', '/api/djen/buscar', {});
const lista = (await f('GET', '/api/djen/lista?dias=90')).j.pubs;
check(lista.length === 6 && lista.filter(p => ['3', '4', '5', '6'].includes(p.id)).every(p => p.notificada === false), 'toda publicação nova entra no aviso, também as da OAB com "avisar" desligado (Murilo)');
check((await f('GET', '/api/djen/estado')).j.aAvisar === 4, 'o estado conta 4 publicações a avisar');
// o proprietário em "Minhas" vê também as do Murilo (OAB sem usuário)
const meus = (await f('GET', '/api/djen/lista?dias=90&escopo=meus')).j;
check(meus.pubs.length === 6, 'em "Minhas", o proprietário vê as dele e as do Murilo (OAB sem usuário): ' + meus.pubs.length);
check(meus.fora === 0, 'sem outras OABs com usuário, o selo "fora da sua visão" fica zerado');
// na tela: tipos diferentes nunca viram um cartão só
const br = await chromium.launch(); const page = await (await br.newContext({ viewport: { width: 390, height: 900 } })).newPage(); await page.route(/fonts\./, x => x.abort());
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(4500);
await page.evaluate(() => document.querySelector('#drawer [data-tab="publicacoes"]').click()); await page.waitForTimeout(1500);
await page.click('[data-pb="filtro"][data-v="todas"]'); await page.waitForTimeout(500);
const cards = await page.evaluate(() => Array.from(document.querySelectorAll('.pb-card')).map(c => c.innerText));
check(cards.filter(c => c.includes(num(5))).length === 2, 'segredo de justiça com "Decisão" e "Outros" (mesmo texto padrão): dois cartões, nenhum esconde o outro');
check(cards.length === 6, 'na tela aparecem as 6 publicações (inclusive as do Murilo): ' + cards.length);
check(await page.evaluate(() => !window.__horusTeste.pbSeloExiste()), 'sem publicações fora da visão, o selo não aparece');
// o selo aparece quando o servidor informa publicações fora da visão
const selo = await page.evaluate(() => window.__horusTeste.pbSeloTeste(3));
check(/3 publicações do escritório fora da sua visão/.test(selo) && /Ver as do escritório/.test(selo), 'o selo mostra "3 publicações do escritório fora da sua visão" com o botão para ver: ' + selo);
await br.close(); fake.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
