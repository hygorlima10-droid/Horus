// Datas "fixas": roda a lógica de datas das tarefas fixas e das contas fixas (cliente/delegadas.js) com o "hoje" simulado em dezenas de dias seguidos, em todos os dias da semana,
// nos fins de mês e na virada do ano, sem servidor e sem depender do dia em que o teste roda.  Pega o tipo de falha que "vai e volta" conforme o dia da semana.
// Use: node test/rodar.mjs datas-fixas
import { readFileSync } from 'node:fs';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const src = readFileSync(new URL('../cliente/delegadas.js', import.meta.url), 'utf8');
function funcao(nome) {   // devolve o texto de "function nome(...){...}" (casa as chaves, ignorando textos entre aspas)
  const i = src.indexOf('function ' + nome + '('); if (i < 0) throw new Error('não achei ' + nome);
  let d = 0, q = null, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { const c = src[k]; if (q) { if (c === '\\') k++; else if (c === q) q = null; continue; } if (c === "'" || c === '"') { q = c; continue; } if (c === '{') d++; else if (c === '}') { d--; if (d === 0) return src.slice(i, k + 1); } }
  throw new Error('chaves não fecham em ' + nome);
}
const NOMES = ['dgUltimoDia', 'dgNum2', 'dgOcorrencias', 'dgPagamentos', 'dgPagaEm', 'dgCicloData', 'dgTarefaFixaDe', 'dgFixaDe', 'dgFixaProxima', 'dgFixaAtrasadas', 'dgFixasAtencao', 'dgFixas', 'dgSemanaDe', 'dgMesmoCiclo', 'dgTFixaEstado', 'dgTFixaEstado0', 'dgDoc', 'dgTFixaFeita'];
const prelude = `
var __hoje = '2026-11-20', dgCacheEst = {}, DG_DOW = ['domingo','segunda','terça','quarta','quinta','sexta','sábado'], dgS = { docs: [], ok: true, carregando: false };
function agHoje(){ return __hoje; }
function pbSoma(iso, n){ return new Date(Date.parse(iso + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10); }
function pbDow(iso){ return new Date(iso + 'T12:00:00Z').getUTCDay(); }
function pbNaoUtil(iso){ var w = pbDow(iso); return w === 0 || w === 6; }
function deslocarMes(ym, n){ var a = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)) - 1 + n; a += Math.floor(m / 12); m = ((m % 12) + 12) % 12; return a + '-' + String(m + 1).padStart(2, '0'); }
function dgMe(){ return 'u:teste'; }
function renderPainelAtencao(){}
function dgSalvarCampos(id, patch){ var d = dgDoc(id); Object.assign(d, patch); dgCacheEst = {}; return Promise.resolve(d); }
`;
const fabrica = new Function(prelude + NOMES.map(funcao).join('\n') + '\nreturn { setHoje: function(h){ __hoje = h; dgCacheEst = {}; }, S: dgS, limpaCache: function(){ dgCacheEst = {}; }, dgOcorrencias, dgTFixaEstado, dgTFixaFeita, dgFixasAtencao, dgFixaAtrasadas, dgFixaProxima, dgPagamentos, pbSoma, pbDow, dgUltimoDia };');
const A = fabrica(), dias = (de, n) => Array.from({ length: n }, (_, i) => A.pbSoma(de, i));
const hojes = dias('2026-11-20', 75);   // 20/11/2026 a 02/02/2027: fim de mês, virada de ano, todos os dias da semana

// A) tarefa fixa: o que se marca como "feita" sempre se desfaz com outro toque, em qualquer dia, qualquer dia da semana e qualquer data de criação
let n = 0, ruins = [];
for (const hoje of hojes) for (const repete of ['semanal', 'mensal']) for (const v of (repete === 'semanal' ? [0, 1, 2, 3, 4, 5, 6] : [1, 5, 15, 28, 31])) for (const antes of [0, 4, 15, 45]) {
  A.setHoje(hoje); const doc = { id: 't', fixa: true, repete, dow: v, dia: v, fixaDesde: A.pbSoma(hoje, -antes), feitas: {} }; A.S.docs = [doc];
  const e0 = A.dgTFixaEstado(doc).est; await A.dgTFixaFeita('t'); n++;
  if (Object.keys(doc.feitas).length) {
    A.limpaCache(); const eo = A.dgTFixaEstado(doc), e1 = eo.est, rot = hoje + ' ' + repete + ' ' + v + ' criada há ' + antes + 'd';
    if (!eo.prox && e1 !== 'feita') { ruins.push(rot + ' (marcou e a tarefa não mostra nada nem tem o que desfazer)'); continue; }   // a falha que existia: marcada adiantada, sem próximo ciclo à vista, não aparecia como feita e não desfazia
    if (e1 === 'feita') { await A.dgTFixaFeita('t'); A.limpaCache(); if (Object.keys(doc.feitas).length !== 0 || A.dgTFixaEstado(doc).est !== e0) ruins.push(rot + ' (aparece como feita, mas outro toque não desfez)'); }   // se ainda há um próximo ciclo, a tarefa passa a mostrar "vence ..." (progresso visível; o aviso "Salvo · Desfazer" cobre o engano)
  }
}
check(ruins.length === 0, 'tarefa fixa: marcar e desmarcar volta ao estado de antes em ' + n + ' combinações de dia, dia da semana e data de criação' + (ruins.length ? ' — falham ' + ruins.length + ': ' + ruins.slice(0, 4).join(' | ') : ''));

// B) conta fixa: o vencimento não pago continua atrasado (sem limite de dias) até o pagamento ser registrado
const ult = (a, m) => A.dgUltimoDia(a, m), pad = (x) => String(x).padStart(2, '0');
let nb = 0, ruinsB = [];
for (const hoje of hojes.filter((_, i) => i % 3 === 0)) for (const dia of [1, 5, 15, 28, 29, 30, 31]) for (const antes of [10, 40, 100, 200]) {
  A.setHoje(hoje); const cri = A.pbSoma(hoje, -antes);
  const doc = { id: 'c', tipo: 'fixa', titulo: 'Conta', repete: 'mensal', dia, avisarDias: 0, resp: '', pagas: [], criadoEm: cri + 'T10:00:00Z' }; A.S.docs = [doc];
  const esperado = []; for (let y = Number(cri.slice(0, 4)), m = Number(cri.slice(5, 7)); ; m++) { if (m > 12) { m = 1; y++; } const d = y + '-' + pad(m) + '-' + pad(Math.min(dia, ult(y, m))); if (d >= hoje) break; if (d >= cri) esperado.push(d); }
  const atuais = A.dgFixasAtencao().map((x) => x.data).filter((d) => d < hoje).sort(); nb++;
  if (JSON.stringify(atuais) !== JSON.stringify(esperado)) ruinsB.push(hoje + ' dia ' + dia + ' criada há ' + antes + 'd: ' + atuais.length + ' x ' + esperado.length);
  if (A.dgFixaAtrasadas(doc) !== esperado.length) ruinsB.push(hoje + ' dia ' + dia + ': contador de atrasadas ' + A.dgFixaAtrasadas(doc) + ' x ' + esperado.length);
  for (const d of esperado) doc['pg_' + d.slice(0, 7)] = { data: hoje, valor: 1, venc: d };
  if (A.dgFixasAtencao().some((x) => x.data < hoje)) ruinsB.push(hoje + ' dia ' + dia + ': pagou tudo e ainda aparece atrasada');
}
check(ruinsB.length === 0, 'conta fixa mensal: todo vencimento não pago desde a criação aparece como atrasado (sem limite de dias) e some ao pagar, em ' + nb + ' combinações' + (ruinsB.length ? ' — falham ' + ruinsB.length + ': ' + ruinsB.slice(0, 4).join(' | ') : ''));

// C) conta semanal e ocorrências
let ruinsC = [];
for (const hoje of hojes.filter((_, i) => i % 4 === 0)) for (let dow = 0; dow < 7; dow++) {
  A.setHoje(hoje); const cri = A.pbSoma(hoje, -30), doc = { id: 'w', tipo: 'fixa', repete: 'semanal', dow, avisarDias: 0, pagas: [], criadoEm: cri + 'T10:00:00Z' }; A.S.docs = [doc];
  const esperado = dias(cri, 30).filter((d) => A.pbDow(d) === dow && d < hoje), atuais = A.dgFixasAtencao().map((x) => x.data).filter((d) => d < hoje).sort();
  if (JSON.stringify(atuais) !== JSON.stringify(esperado)) ruinsC.push(hoje + ' dow ' + dow);
}
check(ruinsC.length === 0, 'conta semanal: os vencimentos atrasados são exatamente os dias da semana escolhidos' + (ruinsC.length ? ' — falham: ' + ruinsC.slice(0, 4).join(' | ') : ''));
const oc = (r, de, ate) => A.dgOcorrencias(r, de, ate).map((x) => x.data);
check(JSON.stringify(oc({ repete: 'mensal', dia: 31 }, '2027-01-01', '2027-05-31')) === '["2027-01-31","2027-02-28","2027-03-31","2027-04-30","2027-05-31"]' && oc({ repete: 'mensal', dia: 31 }, '2028-02-01', '2028-02-29')[0] === '2028-02-29', 'dia 31 vira o último dia do mês (28, 29 em ano bissexto, 30 e 31)');
check(oc({ repete: 'anual', data: '2024-02-29' }, '2026-01-01', '2026-12-31').length <= 1 && JSON.stringify(oc({ repete: 'unica', data: '2026-12-05' }, '2026-01-01', '2026-12-31')) === '["2026-12-05"]', 'conta anual e "uma vez" geram no máximo uma data por período');
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
