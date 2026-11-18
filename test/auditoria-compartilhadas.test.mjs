// Auditoria de tarefas compartilhadas: quem vê, quem altera e quem conclui cada tipo de item da Agenda e das Delegadas (servidor).
// Servidor do grupo 'auditoria':  FOTOS=/tmp/auditoria node test/rodar.mjs auditoria
import fs from 'node:fs';
const B = process.env.BASE || 'http://127.0.0.1:8816', OUT = process.env.FOTOS || '/tmp/auditoria';
const TOK = { dono: 'tok-dono-0000000000000000000000000001', ana: 'tok-adv-ana-00000000000000000000000002', bruno: 'tok-adv-bruno-000000000000000000000003', caio: 'tok-est-caio-0000000000000000000000004', dani: 'tok-est-dani-0000000000000000000000005' };
const api = async (n, m, p, b) => { const x = await fetch(B + p, { method: m, headers: { cookie: 'sessao=' + TOK[n], 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined }); let j = null; try { j = await x.json(); } catch (e) { } return { s: x.status, j }; };
await api('dono', 'PUT', '/api/usuarios/u1', { oabs: ['60456/GO'] });
const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10), dia = (n) => new Date(Date.now() - 3 * 3600e3 + n * 864e5).toISOString().slice(0, 10);
// processo da Ana (Inicial) para o item "com processo"
await api('dono', 'PUT', '/api/db/casos/ac1', { tipo: 'inicial', origem: 'proprio', prioridade: 'normal', status: 'pendente', cliente: 'Cliente da Ana', nomeAcao: 'Ação', numeroProcesso: '0000881-01.2024.8.09.0881', modalidadeHonorario: 'sem_honorarios', advogados: [{ oab: '11111/GO', nome: 'Ana Advogada' }], criadoEm: new Date().toISOString() });
const ITENS = [
  ['T1 tarefa pessoal (Caio, sem responsável)', 'caio', { tipo: 'tarefa', titulo: 'T1 pessoal', data: dia(2) }],
  ['T2 tarefa compartilhada (Caio)', 'caio', { tipo: 'tarefa', titulo: 'T2 compartilhada', data: dia(2), compartilhada: true }],
  ['T3 tarefa com responsável Ana (criada pelo Caio)', 'caio', { tipo: 'tarefa', titulo: 'T3 resp Ana', data: dia(2), resp: ['11111/GO'] }],
  ['T4 prazo do processo da Ana (criado pela Dani)', 'dani', { tipo: 'prazo', titulo: 'T4 prazo proc Ana', data: dia(5), processo: '0000881-01.2024.8.09.0881', resp: ['11111/GO'] }],
  ['T5 audiência com responsável Bruno (criada pelo proprietário)', 'dono', { tipo: 'audiencia', titulo: 'T5 audiência Bruno', data: dia(9), hora: '10:00', resp: ['22222/GO'] }],
  ['T6 tarefa pessoal da Ana', 'ana', { tipo: 'tarefa', titulo: 'T6 pessoal Ana', data: dia(3) }],
];
const quem = ['dono', 'ana', 'bruno', 'caio', 'dani'];
for (const d of (await api('dono', 'GET', '/api/db/agenda')).j.docs.filter((x) => /^T\d /.test(x.data.titulo || ''))) await api('dono', 'DELETE', '/api/db/agenda/' + d.id);
const linhas = [], achados = [];
let i = 0;
for (const [nome, criador, dados] of ITENS) {
  const id = 'auditoria' + (++i); const r = await api(criador, 'PUT', '/api/db/agenda/' + id, dados);
  const vê = {}, edita = {}, conclui = {};
  for (const n of quem) { const l = (await api(n, 'GET', '/api/db/agenda')).j; vê[n] = !!(l.docs || []).find((d) => d.id === id); }
  for (const n of quem) {
    if (!vê[n]) { edita[n] = '—'; conclui[n] = '—'; continue; }
    const at = (await api(n, 'GET', '/api/db/agenda')).j.docs.find((d) => d.id === id).data;
    const e = await api(n, 'PUT', '/api/db/agenda/' + id, { ...at, obs: 'edição de ' + n }); edita[n] = e.s === 200 ? 'sim' : 'não (' + e.s + ')';
    const at2 = (await api('dono', 'GET', '/api/db/agenda')).j.docs.find((d) => d.id === id).data;
    const c = await api(n, 'PUT', '/api/db/agenda/' + id, { ...at2, concluido: true, situacao: 'feito', concluidoPor: n }); conclui[n] = c.s === 200 ? 'sim' : 'não (' + c.s + ')';
    await api('dono', 'PUT', '/api/db/agenda/' + id, { ...at2, concluido: false, situacao: 'afazer', obs: '' });
  }
  linhas.push({ nome, criador, criou: r.s, vê, edita, conclui });
  await api('dono', 'DELETE', '/api/db/agenda/' + id);
}
// Delegadas (tabela de toda a equipe)
const del = await api('caio', 'POST', '/api/db/delegadas', { tipo: 'tarefa', titulo: 'D1 delegada', resp: 'Dani', data: dia(1), concluida: false, criadoEm: new Date().toISOString() });
const idD = del.j && del.j.id; const dd = {};
for (const n of quem) { const l = await api(n, 'GET', '/api/db/delegadas'); dd[n] = l.s === 200 ? !!(l.j.docs || []).find((d) => d.id === idD) : l.s; }
const dEd = {}; for (const n of quem) { const at = ((await api('dono', 'GET', '/api/db/delegadas')).j.docs.find((d) => d.id === idD) || {}).data || {}; const e = await api(n, 'PUT', '/api/db/delegadas/' + idD, { ...at, obs: 'por ' + n }); dEd[n] = e.s; }
await api('dono', 'DELETE', '/api/db/delegadas/' + idD);
await api('dono', 'DELETE', '/api/db/casos/ac1');
// esperado (regra do código): vê = criador, responsável, compartilhada, processo do advogado; dono vê tudo; estagiária vê tudo (permissão padrão "ver agendas")
const esperado = { T1: { dono: 1, ana: 0, bruno: 0, caio: 1, dani: 1 }, T2: { dono: 1, ana: 1, bruno: 1, caio: 1, dani: 1 }, T3: { dono: 1, ana: 1, bruno: 0, caio: 1, dani: 1 }, T4: { dono: 1, ana: 1, bruno: 0, caio: 1, dani: 1 }, T5: { dono: 1, ana: 0, bruno: 1, caio: 1, dani: 1 }, T6: { dono: 1, ana: 1, bruno: 0, caio: 1, dani: 1 } };
for (const l of linhas) { const k = l.nome.slice(0, 2); for (const n of quem) if (!!l.vê[n] !== !!esperado[k][n]) achados.push(k + ': ' + n + ' ' + (l.vê[n] ? 'vê' : 'não vê') + ' (esperado ' + (esperado[k][n] ? 'vê' : 'não vê') + ')'); }
let md = '| Item | criou | ' + quem.join(' | ') + ' |\n|---|---|' + quem.map(() => '---').join('|') + '|\n';
for (const l of linhas) md += '| ' + l.nome + ' | ' + l.criador + ' (' + l.criou + ') | ' + quem.map((n) => (l.vê[n] ? 'vê' : '—') + (l.vê[n] ? ' · edita ' + l.edita[n] + ' · conclui ' + l.conclui[n] : '')).join(' | ') + ' |\n';
md += '\nDelegadas (D1 criada pelo Caio): vê ' + JSON.stringify(dd) + ' · edita (status) ' + JSON.stringify(dEd) + '\n';
fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(OUT + '/compartilhadas.md', md);
console.log(md); console.log('divergências do esperado: ' + (achados.length ? achados.join(' | ') : 'nenhuma'));
process.exit(0);
