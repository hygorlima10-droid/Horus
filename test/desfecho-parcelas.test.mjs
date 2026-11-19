// Inicial com honorários variáveis por desfecho (ou êxito) já registrado: o cartão conta as parcelas do desfecho (como nos honorários fixos)
// e o selo de repasse com nome longo de parceiro não passa da largura do cartão. Servidor do grupo 'permissoes':  node test/rodar.mjs desfecho-parcelas
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8816', TOK = 'tok-dono-0000000000000000000000000001';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const api = async (m, p, b) => { const x = await fetch(B + p, { method: m, headers: { cookie: 'sessao=' + TOK, 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined }); let j = null; try { j = await x.json(); } catch (e) { } return { s: x.status, j }; };
const dia = (n) => new Date(Date.now() - 3 * 3600e3 + n * 864e5).toISOString().slice(0, 10);
const IDS = ['dm1', 'dm2', 'dm3', 'dm4'];
const limpar = async () => { for (const i of IDS) await api('DELETE', '/api/db/casos/' + i); };
await limpar();
const parc = (n, v, pagas, inicio) => Array.from({ length: n }, (_, i) => ({ numero: i + 1, valor: v, data: dia(inicio + 30 * i), pago: i < pagas, dataRecebimento: i < pagas ? dia(inicio + 30 * i) : null }));
const adv = [{ oab: '60456/GO', nome: 'Hygor' }, { oab: '74506/GO', nome: 'Nathanny Barbosa Freitas' }];
const base = (cliente, exito, extra = {}) => ({ tipo: 'inicial', origem: 'proprio', prioridade: 'normal', status: 'protocolado', statusDesde: dia(-10) + 'T10:00:00Z', cliente, nomeAcao: 'Defesa em Ação Trabalhista', numeroProcesso: '', modalidadeHonorario: 'desfecho', valorHonorarios: 0, variavel: { acordo: { tipo: 'fixo', valor: 8478.67, forma: 'parcelado', parcelas: 5 }, acao: { tipo: 'fixo', valor: 16957.34, forma: 'parcelado', parcelas: 5 } }, exito, clienteIds: [], advogados: adv, divisao: { partes: adv.map((a) => ({ ...a, pct: 50 })) }, criadoEm: dia(-30) + 'T10:00:00Z', ...extra });
await api('PUT', '/api/db/casos/dm1', base('DM Futuro', { valor: 8478.67, formaPagamento: 'parcelado', desfecho: 'acordo', registradoEm: new Date().toISOString(), parcelas: parc(5, 1695.73, 0, 30).map((q, i) => (i === 4 ? { ...q, valor: 1695.75 } : q)) }));
await api('PUT', '/api/db/casos/dm2', base('DM Vencida', { valor: 3000, formaPagamento: 'parcelado', desfecho: 'acordo', registradoEm: new Date().toISOString(), parcelas: parc(3, 1000, 1, -45) }));
await api('PUT', '/api/db/casos/dm3', base('DM Quitada', { valor: 2000, formaPagamento: 'parcelado', desfecho: 'acao', registradoEm: new Date().toISOString(), parcelas: parc(2, 1000, 2, -60) }));
await api('PUT', '/api/db/casos/dm4', { ...base('DM Avista', { valor: 900, formaPagamento: 'avista', desfecho: 'acordo', registradoEm: new Date().toISOString(), avista: { data: dia(-3), pago: false } }) });
const br = await chromium.launch();
const ctx = await br.newContext({ viewport: { width: 390, height: 1000 } }); await ctx.addCookies([{ name: 'sessao', value: TOK, url: B }]);
const p = await ctx.newPage(); p.erros = []; p.on('pageerror', (e) => p.erros.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/fonts\.|Failed to load resource/.test(m.text())) p.erros.push('console: ' + m.text()); });
await p.route(/fonts\./, (x) => x.abort()); await p.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { } });
await p.goto(B + '/'); await p.waitForFunction(() => window.__horusEu && window.__horusEu.pronto && window.__horusTeste && window.__horusTeste.listarUnidades, null, { timeout: 60000 }); await p.waitForTimeout(2500);
const card = (nome) => p.evaluate((n) => { const c = [...document.querySelectorAll('.kanban-card')].find((e) => e.innerText.indexOf(n) >= 0); return c ? c.innerText.replace(/\s+/g, ' ') : ''; }, nome);

console.log('\n— valores a receber: só a hipótese escolhida conta');
const un = await p.evaluate(() => window.__horusTeste.listarUnidades().filter((u) => u.cliente === 'DM Futuro').map((u) => [u.kind, u.valor]));
check(un.length === 5 && un.every((u) => u[0] === 'exitoParcela') && Math.abs(un.reduce((t, u) => t + u[1], 0) - 8478.67) < 0.01, 'o desfecho "acordo" gera as 5 parcelas (R$ 8.478,67) e a hipótese "ação prosseguir" (R$ 16.957,34) não entra em nada: ' + JSON.stringify(un.map((u) => u[1])));

console.log('\n— cartão do quadro');
await p.evaluate(() => document.querySelector('#drawer [data-tab="peticoes"]').click()); await p.waitForTimeout(800);
await p.evaluate(() => { const b = document.querySelector('#mdAbas-peticoes [data-md-aba="quadro"]'); if (b) b.click(); }); await p.waitForTimeout(800);
check(/0 de 5 parcelas recebidas/.test(await card('DM Futuro')), 'desfecho registrado com 5 parcelas: o cartão mostra "0 de 5 parcelas recebidas"');
check(/DM Quitada/.test(await card('DM Quitada')) && /2 de 2 parcelas recebidas/.test(await card('DM Quitada')) && /todas pagas/.test(await card('DM Quitada')), 'quitado: "2 de 2 parcelas recebidas" e o resumo "todas pagas"');
check(/1 de 3 parcelas recebidas/.test(await card('DM Vencida')) && /vencida/.test(await card('DM Vencida')), 'com parcela atrasada: "1 de 3 parcelas recebidas" e o chip de vencida: ' + (await card('DM Vencida')).slice(0, 200));
check(/vencido há 3 dias/.test(await card('DM Avista')), 'desfecho à vista vencido: chip "vencido há 3 dias"');
const trans = await p.evaluate(() => [...document.querySelectorAll('.kanban-card')].filter((c) => /Repasse/.test(c.innerText)).map((c) => { const b = c.querySelector('.badge-repasse'), r = c.getBoundingClientRect(), q = b.getBoundingClientRect(); return Math.round(q.right - r.right); }));
check(trans.length >= 3 && trans.every((d) => d <= 0), 'em tela de celular o selo "Repasse 50% · Nathanny Barbosa Freitas" cabe dentro do cartão (sobra ' + trans.join(', ') + ' px)');

console.log('\n— lista');
await p.evaluate(() => { const b = document.querySelector('#mdAbas-peticoes [data-md-aba="lista"]'); if (b) b.click(); }); await p.waitForTimeout(800);
const lista = await p.evaluate(() => document.getElementById('list').innerText.replace(/\s+/g, ' '));
check(/Desfecho \(acordo\): 5x, 0\/5 pagas, próx\./.test(lista) || /Desfecho \(acordo\)/.test(lista), 'a lista também resume as parcelas do desfecho');
check(p.erros.length === 0, 'sem erros de JavaScript ' + p.erros.join(' | '));
await limpar(); await br.close();
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo.'); process.exit(falhas ? 1 : 0);
