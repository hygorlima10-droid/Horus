// Testa que Inicial/Acordo "sem honorários" não pedem divisão nem repasse a parceiro (nem mostram o selo "Repasse" no quadro).
// Suba antes:  npx wrangler dev --local --persist-to .dev-data --var SENHA:senha-de-teste-123 --port 8802
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8802', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const agora = new Date().toISOString();
let r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.9' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const api = (m, p, b) => fetch(B + '/api/db/' + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
for (const col of ['casos', 'termosAcordo', 'alvaras', 'clientes', 'despesas', 'receitasManuais', 'metas', 'saldos', 'config', 'extratos', 'obraMov']) for (const d of (await (await api('GET', col)).json()).docs) await api('DELETE', col + '/' + d.id);
const divisao = { partes: [{ oab: '', nome: 'Murilo Falone Rocha', pct: 100 }, { oab: 'zz', nome: 'Outro Advogado', pct: 0 }] };
const base = { tipo: 'inicial', origem: 'murilo', prioridade: 'normal', status: 'protocolado', statusDesde: agora, nomeAcao: 'Ação de Regresso', clienteIds: [], criadoEm: agora, atualizadoEm: agora, divisao };
await api('PUT', 'casos/sem1', Object.assign({}, base, { cliente: 'Complem', modalidadeHonorario: 'sem_honorarios', valorHonorarios: 0 }));
await api('PUT', 'casos/com1', Object.assign({}, base, { cliente: 'Cliente Com Honorarios', modalidadeHonorario: 'fixo', formaPagamento: 'avista', valorHonorarios: 1000, avista: { data: '2099-01-01', pago: false } }));
await api('PUT', 'config/backup', { ultimoEm: agora });
const br = await chromium.launch(); const page = await (await br.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); const erros = []; page.on('pageerror', e => erros.push(e.message)); await page.route(/fonts\./, r => r.abort());
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(2800);

// 1) as contas: sem honorários, nada a repassar (mesmo com divisão antiga gravada)
const d = await page.evaluate(() => { const h = window.__horusTeste; const doc = { modalidadeHonorario: 'sem_honorarios', divisao: { partes: [{ oab: '', nome: 'Murilo', pct: 100 }, { oab: 'zz', nome: 'X', pct: 0 }] } }; const com = Object.assign({}, doc, { modalidadeHonorario: 'fixo' }); return { sem: h.repasseDoc(doc), com: h.repasseDoc(com), acordoSem: h.repasseDoc({ semHonorarios: true, divisao: doc.divisao }) }; });
check(d.sem === null && d.acordoSem === null, 'Inicial "Sem honorários" e Acordo sem honorários: não há repasse (mesmo com divisão antiga gravada)');
check(d.com && d.com.percentual === 100, 'com honorários a divisão continua valendo (controle)');

// 2) o quadro das Iniciais: sem selo "Repasse" nos sem honorários
await page.evaluate(() => document.querySelector('[data-tab="peticoes"]').click()); await page.waitForTimeout(1200);
const cards = await page.evaluate(() => Array.from(document.querySelectorAll('.kanban-card')).map(c => ({ t: c.innerText.replace(/\s+/g, ' '), rep: !!c.querySelector('.badge-repasse') })));
const cSem = cards.find(c => /Complem/.test(c.t)), cCom = cards.find(c => /Cliente Com Honorarios/.test(c.t));
check(cSem && !cSem.rep && /Sem honorários/.test(cSem.t), 'quadro: o card sem honorários não mostra "Repasse"');
check(cCom && cCom.rep, 'quadro: o card com honorários mostra o selo de repasse (controle)');

// 3) a ficha: a divisão não é exigida nem validada sem honorários
await page.evaluate(() => window.__horusTeste.fichas.abrirNovo()); await page.waitForTimeout(500);
const f = await page.evaluate(async () => {
  const h = window.__horusTeste; h.rcS.div.casos = { partes: [{ oab: 'aa', nome: 'A', pct: 10 }, { oab: '', nome: 'Murilo', pct: 50 }] };   // soma 60: inválida
  const err = document.createElement('div'), com = {}, sem = {};
  document.querySelector('#segModalidade [data-value="fixo"]').click(); await new Promise(r => setTimeout(r, 50));
  const okCom = h.rcDivAplicar('casos', com, err);
  document.querySelector('#segModalidade [data-value="sem_honorarios"]').click(); await new Promise(r => setTimeout(r, 120));
  const okSem = h.rcDivAplicar('casos', sem, err);
  return { okCom, errCom: err.textContent, okSem, semDiv: sem.divisao, semRep: sem.repasse, semFlag: h.rcSemHonor('casos'), nota: document.getElementById('rcDiv_casos').innerText };
});
check(f.okCom === false && /somar 100%/.test(f.errCom), 'com honorários: divisão que não soma 100% continua barrando (controle)');
check(f.okSem === true && f.semDiv === null && f.semRep === null, 'sem honorários: a divisão não é exigida e é gravada vazia');
check(/Sem honorários: não há valor a dividir nem a repassar/.test(f.nota), 'sem honorários: a ficha explica que não há o que dividir, no lugar da tabela de divisão');
check(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
