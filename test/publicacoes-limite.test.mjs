// Limite da lista de publicações: teto de 3.000 e as não lidas antigas (mais velhas que a janela de 90 dias) entram sempre.
// Servidor com banco novo (grupo 'diario-isolado'):  node test/rodar.mjs publicacoes-limite
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
const B = process.env.BASE || 'http://127.0.0.1:8815', SENHA = 'senha-de-teste-123', DADOS = process.env.DADOS || '/tmp/dev-data-pub';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const dia = (n) => new Date(Date.now() - 3 * 3600e3 - n * 864e5).toISOString().slice(0, 10);
const r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.61' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const f = (m, p, b) => fetch(B + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(async x => ({ s: x.status, j: await x.json().catch(() => ({})) }));
await f('PUT', '/api/db/config/backup', { ultimoEm: new Date().toISOString() });
const doc = (id, data, extra) => JSON.stringify({ id, data, processo: '6' + String(id.replace(/\D/g, '')).padStart(19, '0').slice(-19), tipo: 'Decisão', oabs: ['o1'], lida: false, notificada: true, trecho: 'Intimação ' + id, ...extra }).replace(/'/g, "''");
const linhas = [];
for (let i = 0; i < 3100; i++) linhas.push("('_pub','p" + i + "','" + doc(String(800000000 + i), dia(1 + (i % 80))) + "',1)");   // 3.100 publicações dentro da janela de 90 dias
linhas.push("('_pub','900000001','" + doc('900000001', dia(130)) + "',1)");                               // velha e ainda não lida: tem que aparecer
linhas.push("('_pub','900000002','" + doc('900000002', dia(131), { lida: true }) + "',1)");                      // velha e já lida: não precisa aparecer
linhas.push("('_pub','900000003','" + doc('900000003', dia(132), { tratadas: [{ uid: 'u1', nome: 'X', papel: 'proprietario', em: '2026-01-01T00:00:00Z', como: 'prazo' }] }) + "',1)");   // velha e tratada: não precisa
const sql = path.join(os.tmpdir(), 'horus-limite.sql'); let corpo = '';
for (let i = 0; i < linhas.length; i += 400) corpo += 'INSERT INTO docs (colecao,id,dados,atualizado) VALUES ' + linhas.slice(i, i + 400).join(',') + ';\n';
fs.writeFileSync(sql, corpo);
execSync('npx wrangler d1 execute controle-juridico --local --persist-to ' + DADOS + ' --file ' + sql, { cwd: path.resolve(import.meta.dirname, '..'), stdio: 'ignore' });
fs.rmSync(sql, { force: true });

const j = (await f('GET', '/api/djen/lista?dias=90')).j, ids = new Set((j.pubs || []).map(p => p.id));
check(Array.isArray(j.pubs) && j.pubs.length === 3001, 'a lista traz o teto de 3.000 da janela + 1 antiga não lida (e não 1.500): ' + (j.pubs || []).length);
check(ids.has('900000001') && j.antigas === 1, 'a publicação com 130 dias, ainda não lida, aparece mesmo fora da janela de 90 dias');
check(!ids.has('900000002') && !ids.has('900000003'), 'as antigas já lidas ou já tratadas não voltam para a lista');
check(j.truncado === true, 'avisa que o corte aconteceu (truncado = true)');
check((await f('POST', '/api/djen/marcar', { ids: ['900000001'], lida: true })).j.alteradas === 1 && !(new Set(((await f('GET', '/api/djen/lista?dias=90')).j.pubs || []).map(p => p.id))).has('900000001'), 'depois de lida, a antiga sai da lista');
const curta = (await f('GET', '/api/djen/lista?dias=10')).j;
check(curta.truncado === false && curta.pubs.length < 3000, 'com uma janela curta (10 dias) não há corte: ' + curta.pubs.length + ' publicações');
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
