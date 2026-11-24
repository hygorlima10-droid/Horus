// Familiar (ex.: irmão do proprietário): conta própria só com os módulos liberados, cofre isolado, sem nada do escritório.  Use: node test/rodar.mjs familiar
const B = process.env.BASE || 'http://127.0.0.1:8820';
const TOK = { dono: 'tok-dono-0000000000000000000000000001', ana: 'tok-adv-ana-00000000000000000000000002', caio: 'tok-est-caio-0000000000000000000000004', fam: 'tok-fam-obra-000000000000000000000000006', fam2: 'tok-fam-fin-0000000000000000000000000007' };
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const quem = (n) => async (m, p, b) => { const x = await fetch(B + p, { method: m, headers: { cookie: 'sessao=' + TOK[n], 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined }); let j = null; try { j = await x.json(); } catch (e) { /* sem corpo */ } return { s: x.status, j }; };
const dono = quem('dono'), ana = quem('ana'), fam = quem('fam'), fam2 = quem('fam2');

let r = await fam('GET', '/api/eu'); check(r.s === 200 && r.j.papel === 'familiar' && JSON.stringify(r.j.modulos) === '["obra"]', 'o familiar entra como "familiar" com o módulo Construção');
r = await fam2('GET', '/api/eu'); check(JSON.stringify(r.j.modulos) === '["obra","financas"]', 'o outro familiar tem Construção e Finanças');

// nada do escritório nem do proprietário
const fora = ['/api/db/casos', '/api/db/clientes', '/api/db/processos', '/api/db/agenda', '/api/db/delegadas', '/api/db/termosAcordo', '/api/db/alvaras', '/api/db/repasses', '/api/db/recebimentos', '/api/db/prazosPub', '/api/db/pecasAprendidas', '/api/db/diasSemExpediente', '/api/db/despesas', '/api/db/receitasManuais', '/api/db/saldos', '/api/db/metas', '/api/db/extratos', '/api/db/_peticoes', '/api/db/_usuarios',
  '/api/backup', '/api/backups', '/api/lixeira', '/api/auditoria', '/api/usuarios', '/api/ler', '/api/recebidos', '/api/atalho', '/api/peticoes', '/api/equipe', '/api/agenda', '/api/djen/estado', '/api/datajud/x', '/api/calendario/x', '/api/planilha/ligada', '/api/historico', '/api/sem-advogado', '/api/restaurar', '/api/enviar'];
let tudo = true; const lista = [];
for (const p of fora) { const x = await fam('GET', p); if (x.s !== 403 && x.s !== 404 && x.s !== 405) { tudo = false; lista.push(p + '=' + x.s); } }
check(tudo, 'só com a Construção, o familiar não abre o escritório nem as finanças do proprietário' + (lista.length ? ' → ' + lista.join(' ') : ''));
const fora2 = ['/api/db/despesas', '/api/db/receitasManuais', '/api/db/saldos', '/api/db/metas', '/api/db/extratos'];
check((await Promise.all(fora2.map((p) => fam('POST', p, { x: 1 })))).every((x) => x.s === 403), 'e não grava finanças enquanto o módulo Finanças não está ligado');
for (const c of ['casos', 'clientes', 'agenda', 'delegadas']) { const x = await fam2('GET', '/api/db/' + c); if (x.s === 200 && (x.j.docs || []).length) { check(false, 'o familiar com Finanças vê ' + c); } }
check((await Promise.all(['casos', 'clientes', 'agenda', 'delegadas', 'processos'].map((c) => fam2('GET', '/api/db/' + c)))).every((x) => x.s === 403), 'nem com Finanças ligadas ele abre o jurídico');
check((await fam('POST', '/api/lote', { ops: [{ acao: 'gravar', colecao: 'casos', id: 'zz', dados: { v: 1 } }] })).s === 403 && (await fam('POST', '/api/lote', { ops: [{ acao: 'gravar', colecao: 'despesas', id: 'zz', dados: { v: 1 } }] })).s === 403, 'nem pelo lote');

// cofre da obra
r = await fam('PUT', '/api/db/obraMov/g1', { tipo: 'gasto', descricao: 'Cimento', valor: 800, status: 'pago', data: '2026-11-20' }); check(r.s === 200, 'o familiar lança um gasto da obra dele');
r = await fam('PUT', '/api/db/config/obra', { nome: 'Casa do irmão', orcamentoTotal: 320000, criadoEm: '2026-11-24T10:00:00Z' }); check(r.s === 200, 'e cria a obra dele (config/obra)');
r = await fam('GET', '/api/db/obraMov'); check(r.s === 200 && r.j.docs.length === 1 && r.j.docs[0].data.descricao === 'Cimento', 'lê só o gasto dele');
r = await fam('GET', '/api/db/config'); check(r.s === 200 && r.j.docs.some((d) => d.id === 'obra' && d.data.orcamentoTotal === 320000), 'a lista de config dele traz a obra dele');
check(!(await fam('GET', '/api/db/config')).j.docs.some((d) => ['planejamento', 'importacaoAuto', 'backup'].includes(d.id)), 'e nenhum documento de configuração do proprietário');
await fam('PUT', '/api/db/config/personalizacao', { colunasPeticao: [{ id: 'x', label: 'Só do irmão' }] });
const globalCfg = ((await dono('GET', '/api/db/config')).j.docs.find((d) => d.id === 'personalizacao') || { data: {} }).data;
check(!JSON.stringify(globalCfg).includes('Só do irmão'), 'a personalização dele não mexe na do escritório');
r = await dono('GET', '/api/db/obraMov'); check(r.j.docs.length === 0, 'o proprietário não vê a obra do irmão (a dele é outra)');
r = await dono('PUT', '/api/db/obraMov/p1', { tipo: 'gasto', descricao: 'Do proprietário', valor: 1, status: 'pago', data: '2026-11-20' });
check((await fam('GET', '/api/db/obraMov')).j.docs.every((d) => d.data.descricao !== 'Do proprietário'), 'e o irmão não vê a obra do proprietário');
check((await ana('GET', '/api/db/obraMov')).s === 403, 'o advogado continua sem a Construção');
check((await dono('GET', '/api/backup')).j.docs.every((d) => !String(d.colecao).includes('@')) && !JSON.stringify((await dono('GET', '/api/backup')).j).includes('Cimento'), 'o backup do proprietário não leva o cofre do irmão');

// índices, comprovantes e exportar
r = await fam('GET', '/api/indices'); check(r.s === 200, 'o familiar lê os índices da calculadora (SINAPI/INCC)');
check((await ana('GET', '/api/indices')).s === 403, 'advogado continua sem os índices');
const comp = await fam('POST', '/api/anexos', { nome: 'nota.pdf', tipo: 'application/pdf', b64: Buffer.from('%PDF-1.4 x').toString('base64') });
check(comp.s === 200, 'o familiar guarda um comprovante');
check((await fam('GET', '/api/anexos/' + comp.j.id)).s === 200 && (await dono('GET', '/api/anexos/' + comp.j.id)).s === 404, 'só ele abre o comprovante dele');
const compD = await dono('POST', '/api/anexos', { nome: 'dono.pdf', tipo: 'application/pdf', b64: Buffer.from('%PDF-1.4 y').toString('base64') });
check((await fam('GET', '/api/anexos/' + compD.j.id)).s === 404 && (await dono('GET', '/api/anexos/' + compD.j.id)).s === 200, 'e o proprietário abre o dele, não o do irmão');
check((await ana('GET', '/api/anexos/' + compD.j.id)).s === 403, 'advogado não usa comprovantes da obra');
r = await fam('GET', '/api/exportar'); check(r.s === 200 && r.j.docs.some((d) => d.colecao === 'obraMov' && d.dados.descricao === 'Cimento') && r.j.docs.some((d) => d.colecao === 'config' || d.colecao === 'configDono') && r.j.anexos.length === 1, 'Exportar devolve os dados dele e a lista de comprovantes');
check(!JSON.stringify(r.j).includes('Do proprietário'), 'sem nada do proprietário');
check((await dono('GET', '/api/exportar')).s === 403, 'a exportação é só do familiar');

// finanças do familiar com o módulo ligado
r = await fam2('PUT', '/api/db/despesas/f1', { nome: 'Escola', valor: 900, coluna: 'pf' }); check(r.s === 200, 'com Finanças ligadas ele grava despesa no cofre dele');
check((await fam2('GET', '/api/db/despesas')).j.docs.length === 1 && (await dono('GET', '/api/db/despesas')).j.docs.every((d) => d.data.nome !== 'Escola') && (await fam('GET', '/api/db/despesas')).s === 403, 'e ninguém mais vê (nem o outro familiar)');
check((await fam2('GET', '/api/db/obraMov')).j.docs.length === 0, 'cada familiar tem a sua obra');

// proprietário gerencia o acesso
r = await dono('GET', '/api/usuarios'); const u6 = r.j.usuarios.find((u) => u.id === 'uf6');
check(u6 && u6.papel === 'familiar' && JSON.stringify(u6.modulos) === '["obra"]', 'o proprietário vê o familiar e os módulos dele na lista de usuários');
r = await dono('PUT', '/api/usuarios/uf6', { modulos: ['obra', 'financas'] }); check(r.s === 200 && JSON.stringify(r.j.modulos) === '["obra","financas"]', 'liga as Finanças para ele');
check((await fam('PUT', '/api/db/despesas/f2', { nome: 'Mercado', valor: 100 })).s === 200, 'e na hora o familiar passa a usá-las');
check((await dono('PUT', '/api/usuarios/uf6', { modulos: [] })).s === 400 && (await dono('PUT', '/api/usuarios/u3', { modulos: ['obra'] })).s === 400, 'módulos: ao menos um, e só para familiar');
r = await dono('POST', '/api/usuarios', { nome: 'Novo Familiar', email: 'novo.fam@teste.local', papel: 'familiar', modulos: ['obra'] }); check(r.s === 200 && /\/convite\//.test(r.j.link), 'o convite de familiar é gerado com os módulos');
check((await dono('POST', '/api/usuarios', { nome: 'Sem Módulo', email: 'sem.mod@teste.local', papel: 'familiar', modulos: [] })).s === 400, 'convite de familiar sem módulo é recusado');
check((await dono('PUT', '/api/usuarios/uf6', { ativo: false })).s === 200 && (await fam('GET', '/api/eu')).s === 401, 'desativar o familiar tira o acesso na hora');
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
