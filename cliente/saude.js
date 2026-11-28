/* ============================================================
   SAÚDE DOS DADOS (prefixo sd) — Configurações › Saúde dos dados.
   Um botão "Verificar agora" que confere, SÓ LENDO, os dados que o app já tem na tela e lista o que merece um olhar. Nunca corrige nada sozinho,
   não roda sozinho para mandar aviso (nada de e-mail nem notificação): a única coisa automática é o número (bolinha) de itens em "Atenção".
   - Organizada por ÁREA, em abas: Finanças, Jurídico, Equipe e Sistema (cada papel vê as suas: proprietário todas; advogado Finanças e Jurídico; estagiário Equipe; familiar Finanças).
   - 14 checagens. Cada item tem "Abrir" (vai ao cadastro) e "Dispensar": o item some e VOLTA SÓ SE O DADO MUDAR (a dispensa guarda uma "assinatura" do que foi visto).
   - As dispensas ficam neste aparelho (localStorage, uma lista por pessoa).
   ============================================================ */
var SD_ABAS = [['fin', 'Finanças'], ['jur', 'Jurídico'], ['eq', 'Equipe'], ['sis', 'Sistema']];
var SD_POR_PAPEL = { proprietario: ['fin', 'jur', 'eq', 'sis'], advogado: ['fin', 'jur'], estagiario: ['eq'], familiar: ['fin'] };
var sdS = { aba: '', res: null, quando: 0, aberto: {}, todos: {}, mostrarDisp: false, rodando: false, backup: undefined, pendRecarga: false };

function sdPapel(){ var e = window.__horusEu || {}; return e.papel || 'proprietario'; }
function sdAbasPermitidas(){ return SD_POR_PAPEL[sdPapel()] || []; }
function sdDias(a, b){ return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000); }
function sdN(s){ return String(typeof normNome === 'function' ? normNome(s) : String(s || '').toLowerCase()).replace(/\s+/g, ' ').trim(); }
function sdMoeda(v){ return fmtMoeda(Number(v) || 0); }
function sdSig(s){ var h = 5381; s = String(s); for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
function sdPlural(n, um, varios){ return n + ' ' + (n === 1 ? um : varios); }
function sdProcTxt(n){ var d = String(n || '').replace(/\D/g, ''); return d.length === 20 ? d.slice(0, 7) + '-' + d.slice(7, 9) + '.' + d.slice(9, 13) + '.' + d.slice(13, 14) + '.' + d.slice(14, 16) + '.' + d.slice(16) : String(n || ''); }

/* ---------- dispensas (por pessoa, neste aparelho) ---------- */
function sdChaveLS(){ var e = window.__horusEu || {}; return 'horus.saude.v1.' + (e.id || 'u'); }
function sdDispLer(){ try{ return JSON.parse(localStorage.getItem(sdChaveLS()) || '{}') || {}; }catch(e){ return {}; } }
function sdDispGravar(o){ try{ localStorage.setItem(sdChaveLS(), JSON.stringify(o)); }catch(e){} }

/* ---------- navegação (fecha a janela e abre o cadastro) ---------- */
function sdFechar(){ var ov = qs('overlaySd'); if (ov) ov.classList.remove('show'); }
function sdIrFin(aba, busca){
  sdFechar(); try{ setActiveTab('financeiro'); }catch(e){}
  var b = document.querySelector('#drawer [data-fin="' + aba + '"]'); if (b) b.click();
  if (busca && aba === 'despesas' && typeof dspS !== 'undefined'){ try{ dspS.q = busca; if (typeof dspAplicar === 'function') dspAplicar(); }catch(e){} }
}
function sdIrAba(tab){ sdFechar(); try{ setActiveTab(tab); }catch(e){} }

/* ---------- as checagens: cada uma devolve itens { k (chave estável), t (título), s (detalhe), sig (assinatura do dado), go (abrir) } ---------- */
function sdFinDup(){
  var out = [], g = {};
  (despesas || []).forEach(function(d){
    if (d.tipo !== 'unica' || d.transferenciaId) return;
    var v = Number(d.valor != null ? d.valor : d.valorPadrao) || 0, dia = d.data || d.mesReferencia || '';
    var k = 'd|' + (d.coluna || '') + '|' + sdN(d.nome) + '|' + v.toFixed(2) + '|' + dia; (g[k] = g[k] || []).push(d);
  });
  Object.keys(g).forEach(function(k){
    var l = g[k]; if (l.length < 2) return; var d = l[0], v = Number(d.valor != null ? d.valor : d.valorPadrao) || 0, dia = d.data || d.mesReferencia || '';
    out.push({ k: k, t: (d.nome || 'Sem nome') + ' · ' + sdMoeda(v), s: l.length + ' despesas iguais' + (dia ? ' em ' + (dia.length === 10 ? fmtData(dia) : dia) : '') + ' (' + (d.coluna === 'pj' ? 'PJ' : 'PF') + ')', sig: l.map(function(x){ return x.id; }).sort().join(','), go: function(){ sdIrFin('despesas', d.nome || ''); } });
  });
  var r = {};
  (receitasManuais || []).forEach(function(x){
    if (x.transferenciaId) return; var v = Number(x.valor) || 0, k = 'r|' + (x.coluna || '') + '|' + sdN(x.descricao) + '|' + v.toFixed(2) + '|' + (x.data || x.mesReferencia || ''); (r[k] = r[k] || []).push(x);
  });
  Object.keys(r).forEach(function(k){
    var l = r[k]; if (l.length < 2) return; var x = l[0];
    out.push({ k: k, t: (x.descricao || 'Receita') + ' · ' + sdMoeda(x.valor), s: l.length + ' receitas iguais' + (x.data ? ' em ' + fmtData(x.data) : '') + ' (' + (x.coluna === 'pj' ? 'PJ' : 'PF') + ')', sig: l.map(function(y){ return y.id; }).sort().join(','), go: function(){ sdIrFin(x.coluna === 'pj' ? 'pj' : 'pf'); } });
  });
  (metas || []).forEach(function(m){
    var g2 = {}; (m.movimentos || []).forEach(function(x){ if (x.tipo === 'inicial') return; var k = 'm|' + m.id + '|' + x.tipo + '|' + (Number(x.valor) || 0).toFixed(2) + '|' + x.dia; (g2[k] = g2[k] || []).push(x); });
    Object.keys(g2).forEach(function(k){
      var l = g2[k]; if (l.length < 2) return; var x = l[0], rot = x.tipo === 'aporte' ? 'aporte' : (x.tipo === 'retirada' ? 'retirada' : 'rendimento');
      out.push({ k: k, t: (m.nome || 'Meta') + ' · ' + rot + ' de ' + sdMoeda(Math.abs(Number(x.valor) || 0)), s: l.length + ' movimentos iguais em ' + fmtData(x.dia), sig: l.map(function(y){ return y.id; }).sort().join(','), go: function(){ sdIrFin('patrimonio'); } });
    });
  });
  return out;
}
/* transferência PJ ↔ PF: a despesa de um lado e a receita do outro têm o mesmo código; se só existe um dos lados, o saldo das duas contas fica errado */
function sdFinTransf(){
  var m = {};
  (despesas || []).forEach(function(d){ if (d.transferenciaId){ var o = m[d.transferenciaId] = m[d.transferenciaId] || { d: null, r: null }; o.d = d; } });
  (receitasManuais || []).forEach(function(x){ if (x.transferenciaId){ var o = m[x.transferenciaId] = m[x.transferenciaId] || { d: null, r: null }; o.r = x; } });
  var out = [];
  Object.keys(m).forEach(function(id){
    var o = m[id]; if (o.d && o.r) return;
    var ex = o.d || o.r, valor = o.d ? (o.d.valor != null ? o.d.valor : o.d.valorPadrao) : o.r.valor;
    out.push({ k: id, t: (o.d ? o.d.nome : o.r.descricao) || 'Transferência', s: 'Só existe ' + (o.d ? 'a despesa (' + (o.d.coluna === 'pj' ? 'PJ' : 'PF') + ')' : 'a receita (' + (o.r.coluna === 'pj' ? 'PJ' : 'PF') + ')') + ' de ' + sdMoeda(valor) + '; falta o outro lado', sig: id + '|' + (o.d ? 'd' : 'r') + '|' + (Number(valor) || 0), go: function(){ if (o.d) sdIrFin('despesas', o.d.nome || ''); else sdIrFin(o.r.coluna === 'pj' ? 'pj' : 'pf'); } });
  });
  return out;
}
function sdFinOutros(){
  if (typeof catRcColeta !== 'function' || typeof CAT_PRONTO !== 'undefined' && !CAT_PRONTO) return [];
  var c = catRcColeta(), out = [];
  c.desp.concat(c.dd).forEach(function(x){
    out.push({ k: x.k + ':' + x.id, t: x.t + ' · ' + sdMoeda(x.v), s: 'está em “Outros” · sugestão: ' + x.sug + (x.d ? ' · ' + fmtData(x.d) : ''), sig: x.sug + '|' + x.v, go: function(){ sdFechar(); try{ catRcAbrir(); }catch(e){} } });
  });
  return out;
}
function sdFinFatura(){
  var out = [];
  (extratos || []).forEach(function(doc){
    if (doc.tipo !== 'documento' || doc.kind !== 'fatura' || doc.status !== 'concluido' || !doc.dados || !doc.dados.diferenca || !doc.dados.diferenca.v) return;
    var x = doc.dados, df = x.diferenca;
    out.push({ k: doc.id, t: (doc.titulo || 'Fatura do cartão'), s: 'total ' + fatM(x.total) + ' · compras lidas ' + fatM(x.soma) + ' · diferença ' + (df.v > 0 ? '' : '− ') + fatM(Math.abs(df.v)), sig: x.total + '|' + x.soma + '|' + df.v, go: function(){ sdIrAba('extratos'); } });
  });
  return out;
}
function sdFinReserva(){
  var out = [], hoje = todayISO();
  (metas || []).forEach(function(m){
    if (m.tipo !== 'reserva') return;
    var ult = ''; (m.movimentos || []).forEach(function(x){ if ((x.tipo === 'rendimento' || x.tipo === 'inicial') && String(x.dia || '') > ult) ult = String(x.dia); });
    if (!ult) ult = String(m.criadoEm || '').slice(0, 10); if (!ult) return;
    var n = sdDias(ult, hoje); if (n < 40) return;
    out.push({ k: m.id, t: m.nome || 'Reserva de emergência', s: 'valor conferido pela última vez há ' + n + ' dias (' + fmtData(ult) + '): confira com o extrato do banco', sig: m.id + '|' + ult, go: function(){ sdFechar(); try{ sdIrFin('patrimonio'); abrirMovMeta(m.id, 'atualizar'); }catch(e){} } });
  });
  return out;
}
/* ---- jurídico ---- */
var SD_SUFIXOS = { sa: 1, s: 1, a: 1, ltda: 1, me: 1, epp: 1, eireli: 1, cia: 1, companhia: 1, de: 1, da: 1, do: 1, das: 1, dos: 1, e: 1 };
function sdCanon(nome){ return sdN(nome).split(' ').filter(function(t){ return t && !SD_SUFIXOS[t]; }).join(' '); }
function sdParecidos(a, b){
  var ca = sdCanon(a), cb = sdCanon(b); if (!ca || !cb) return false; if (ca === cb) return true;
  var A = ca.split(' '), B = cb.split(' '); if (A.length < 2 || B.length < 2) return false;
  var sh = 0; A.forEach(function(w){ if (B.indexOf(w) >= 0) sh++; });
  return sh / (A.length + B.length - sh) >= 0.8;
}
function sdJurClientes(){
  var out = [], l = (clientes || []).filter(function(c){ return !c.arquivado && c.nome; });
  for (var i = 0; i < l.length; i++) for (var j = i + 1; j < l.length; j++){
    if (!sdParecidos(l[i].nome, l[j].nome)) continue;
    var a = l[i], b = l[j]; if (String(a.nome).localeCompare(String(b.nome), 'pt-BR') > 0){ var tmp = a; a = b; b = tmp; }   /* ordem alfabética: o texto não muda de uma vez para outra */
    var nProc = (prDocs || []).filter(function(p){ return (p.clienteIds || []).indexOf(a.id) >= 0 || (p.clienteIds || []).indexOf(b.id) >= 0; }).length;
    out.push({ k: [a.id, b.id].sort().join('+'), t: a.nome + ' ≈ ' + b.nome, s: '2 cadastros' + (nProc ? ' · ' + sdPlural(nProc, 'processo', 'processos') : ''), sig: a.id + '|' + a.nome + '|' + b.id + '|' + b.nome, go: function(){ sdFechar(); try{ abrirClienteEdit({ id: a.id }); }catch(e){} } });
  }
  return out;
}
function sdJurSemCliente(){
  if (typeof prOk !== 'undefined' && !prOk) return [];
  var out = [];
  (prDocs || []).forEach(function(p){
    if (p.arquivado || (p.clienteIds && p.clienteIds.length)) return;
    out.push({ k: p.id, t: sdProcTxt(p.numero), s: (p.partes || 'sem partes') + ' · nenhum cliente vinculado', sig: p.id + '|' + (p.partes || ''), go: function(){ sdFechar(); try{ prAbrir(p.numero); }catch(e){} } });
  });
  return out;
}
function sdJurSemAdv(){
  var j = typeof esS !== 'undefined' ? esS.sem : null; if (!j || !Array.isArray(j.itens)) return [];
  return j.itens.map(function(x){ return { k: x.colecao + ':' + x.id, t: (x.titulo || x.numero || x.rotulo), s: x.rotulo + ' sem advogado definido' + (x.sugestao && x.sugestao.length ? ' · sugestão: ' + x.sugestao.map(function(s){ return s.nome; }).join(', ') : ''), sig: x.colecao + ':' + x.id + '|' + (x.sugestao || []).length, go: function(){ sdFechar(); try{ esAbrirRev(); }catch(e){} } }; });
}
function sdJurPubs(){
  if (typeof pbS === 'undefined' || !pbS.carregado || typeof pbGrupos !== 'function') return [];
  var corte = (function(){ var d = new Date(Date.parse(todayISO() + 'T12:00:00Z') - 30 * 864e5); return d.toISOString().slice(0, 10); })(), out = [];
  pbGrupos(pbVisiveis()).forEach(function(p){
    if (!p.data || p.data >= corte || pbLidaG(p) || pbSemPrazoG(p) || pbPrazoGrupo(p)) return;
    out.push({ k: String(p.id), t: sdProcTxt(p.processo) || 'Publicação sem processo', s: 'publicada em ' + fmtData(p.data) + ' · há ' + sdDias(p.data, todayISO()) + ' dias · sem leitura e sem prazo', sig: String(p.id), go: function(){ sdIrAba('publicacoes'); } });
  });
  return out;
}
function sdJurSemProc(){
  if (typeof prOk !== 'undefined' && !prOk) return [];
  var tem = {}; (prDocs || []).forEach(function(p){ var n = prNum(p.numero); if (n) tem[n] = 1; });
  var out = [];
  [['casos', casos, 'Inicial', function(id){ abrirEdicao(id); }], ['acordos', acordos, 'Acordo', function(id){ abrirEdicaoAcordo(id); }], ['alvaras', alvaras, 'Alvará', function(id){ abrirEdicaoAlvara(id); }]].forEach(function(g){
    (g[1] || []).forEach(function(c){
      if (c.arquivado) return; var n = prNum(c.numeroProcesso || c.numero); if (!n || tem[n]) return;
      out.push({ k: g[0] + ':' + c.id, t: (c.cliente || 'Sem cliente') + ' · ' + g[2], s: 'processo ' + sdProcTxt(c.numeroProcesso || c.numero) + ' não está cadastrado em Processos', sig: g[0] + ':' + c.id + '|' + n, go: function(){ sdFechar(); try{ g[3](c.id); }catch(e){} } });
    });
  });
  return out;
}
function sdJurPartes(){
  var por = {};
  [[casos, 'Inicial'], [acordos, 'Acordo'], [alvaras, 'Alvará']].forEach(function(g){
    (g[0] || []).forEach(function(c){ if (c.arquivado) return; var n = prNum(c.numeroProcesso || c.numero); if (!n || !c.cliente) return; (por[n] = por[n] || []).push({ nome: c.cliente, tipo: g[1] }); });
  });
  var out = [];
  Object.keys(por).forEach(function(n){
    var l = por[n], dif = false; for (var i = 0; i < l.length && !dif; i++) for (var j = i + 1; j < l.length; j++) if (!sdParecidos(l[i].nome, l[j].nome)){ dif = true; break; }
    if (!dif) return; var nomes = []; l.forEach(function(x){ if (nomes.indexOf(x.nome) < 0) nomes.push(x.nome); });
    out.push({ k: n, t: sdProcTxt(n), s: 'cadastros com clientes diferentes: ' + nomes.join(' · '), sig: n + '|' + nomes.sort().join('|'), go: function(){ sdFechar(); try{ prAbrir(n); }catch(e){} } });
  });
  return out;
}
/* ---- equipe ---- */
function sdEqContas(){
  if (typeof dgS === 'undefined' || !dgS.ok || typeof dgFixasAtencao !== 'function') return [];
  var hoje = todayISO(), out = [];
  dgFixasAtencao().forEach(function(it){
    if (it.data >= hoje) return;
    out.push({ k: it.id + '|' + it.c, t: it.titulo || 'Conta', s: 'venceu em ' + fmtData(it.data) + ' · há ' + sdDias(it.data, hoje) + ' dias' + (it.valor ? ' · ' + sdMoeda(it.valor) : ''), sig: it.id + '|' + it.c, go: function(){ sdIrAba('delegadas'); try{ dgS.aba = 'fixas'; dgRender(); }catch(e){} } });
  });
  return out;
}
function sdEqTarefas(){
  if (typeof dgS === 'undefined' || !dgS.ok) return [];
  var out = [];
  dgTarefas().forEach(function(d){
    if (dgFeita(d) || (typeof dgEhFixaT === 'function' && dgEhFixaT(d))) return;
    var sem = []; if (!d.resp) sem.push('sem responsável'); if (!d.fatal && !d.trabalhar) sem.push('sem data');
    if (!sem.length) return;
    out.push({ k: d.id, t: d.titulo || 'Tarefa', s: sem.join(' e '), sig: d.id + '|' + (d.resp || '') + '|' + (d.fatal || '') + '|' + (d.trabalhar || ''), go: function(){ sdFechar(); try{ dgAbrirFicha(d.id); }catch(e){} } });
  });
  return out;
}
/* ---- sistema ---- */
function sdSisBackup(){
  if (sdS.backup === undefined || sdS.backup === null) return [];
  var l = sdS.backup, hoje = todayISO(), ult = l.length ? String(l[0].dia || '') : '';
  if (!ult) return [{ k: 'nenhum', t: 'Nenhum backup automático encontrado', s: 'o servidor guarda uma cópia toda segunda-feira', sig: 'nenhum', go: function(){ sdFechar(); var b = qs('backupBtn'); if (b) b.click(); } }];
  var n = sdDias(ult, hoje); if (n <= 8) return [];
  return [{ k: ult, t: 'Último backup automático: ' + fmtData(ult), s: 'faz ' + n + ' dias (o servidor faz um por semana)', sig: ult, go: function(){ sdFechar(); var b = qs('backupBtn'); if (b) b.click(); } }];
}

var SD_CHECKS = [
  { id: 'fin-dup', aba: 'fin', gr: 'a', t: 'Lançamentos duplicados', sub: 'despesas, receitas e reserva iguais', run: sdFinDup },
  { id: 'fin-transf', aba: 'fin', gr: 'a', t: 'Transferência sem o outro lado', sub: 'PJ ↔ PF com só uma das pontas', run: sdFinTransf },
  { id: 'fin-outros', aba: 'fin', gr: 'c', t: 'Despesas em “Outros” com categoria sugerida', sub: 'reclassificar em lote', run: sdFinOutros },
  { id: 'fin-fatura', aba: 'fin', gr: 'c', t: 'Fatura: total diferente das compras', sub: 'cartões já confirmados', run: sdFinFatura },
  { id: 'fin-reserva', aba: 'fin', gr: 'c', t: 'Reserva sem conferência há 40+ dias', sub: 'conferir com o extrato do banco', run: sdFinReserva },
  { id: 'jur-clientes', aba: 'jur', gr: 'a', t: 'Clientes com nome quase igual', sub: 'possível cadastro repetido', run: sdJurClientes },
  { id: 'jur-semcliente', aba: 'jur', gr: 'c', t: 'Processos sem cliente vinculado', sub: 'cadastro de Processos', run: sdJurSemCliente },
  { id: 'jur-semadv', aba: 'jur', gr: 'c', t: 'Registros sem advogado definido', sub: 'Iniciais, acordos, alvarás e processos', papeis: ['proprietario'], run: sdJurSemAdv },
  { id: 'jur-pubs', aba: 'jur', gr: 'c', t: 'Publicações pendentes há mais de 30 dias', sub: 'sem leitura e sem prazo cadastrado', papeis: ['proprietario', 'advogado'], run: sdJurPubs },
  { id: 'jur-semproc', aba: 'jur', gr: 'c', t: 'Iniciais, acordos e alvarás sem processo', sub: 'o número não está em Processos', run: sdJurSemProc },
  { id: 'jur-partes', aba: 'jur', gr: 'c', t: 'Mesmo processo, clientes diferentes', sub: 'registros do mesmo número com partes que não batem', run: sdJurPartes },
  { id: 'eq-contas', aba: 'eq', gr: 'a', t: 'Contas fixas do escritório atrasadas', sub: 'Delegadas › Fixas', run: sdEqContas },
  { id: 'eq-tarefas', aba: 'eq', gr: 'c', t: 'Tarefas sem responsável ou sem data', sub: 'Delegadas', run: sdEqTarefas },
  { id: 'sis-backup', aba: 'sis', gr: 'c', t: 'Backup com mais de 8 dias', sub: 'cópia automática do servidor', papeis: ['proprietario'], run: sdSisBackup }
];
function sdChecksDoPapel(){
  var abas = sdAbasPermitidas(), p = sdPapel();
  return SD_CHECKS.filter(function(c){ return abas.indexOf(c.aba) >= 0 && (!c.papeis || c.papeis.indexOf(p) >= 0); });
}

/* ---------- verificar ---------- */
function sdCarregarExtras(){
  var l = [];
  if (sdPapel() === 'proprietario'){
    l.push(fetch('/api/backups', { credentials: 'same-origin', cache: 'no-store' }).then(function(r){ return r.ok ? r.json() : null; }).then(function(j){ sdS.backup = j && Array.isArray(j.itens) ? j.itens : null; }).catch(function(){ sdS.backup = null; }));
    if (typeof esJson === 'function') l.push(esJson('/api/sem-advogado').then(function(j){ esS.sem = j; }).catch(function(){}));
  }
  if (typeof dgS !== 'undefined' && !dgS.ok && !dgS.carregando && typeof dgCarregar === 'function' && sdChecksDoPapel().some(function(c){ return c.aba === 'eq'; })) l.push(dgCarregar(true).catch(function(){}));
  if (typeof pbS !== 'undefined' && !pbS.carregado && !pbS.carregando && typeof pbCarregar === 'function' && sdChecksDoPapel().some(function(c){ return c.id === 'jur-pubs'; })) l.push(pbCarregar(true).catch(function(){}));
  return Promise.all(l);
}
function sdCalcular(){
  var res = {};
  sdChecksDoPapel().forEach(function(c){ var it = []; try{ it = c.run() || []; }catch(e){ console.error('saúde dos dados: ' + c.id, e); } res[c.id] = it; });
  sdS.res = res; sdS.quando = Date.now();
  sdAtualizarTela();
}
function sdVerificar(comRede){
  var e = window.__horusEu; if (!e || !e.pronto) return Promise.resolve();
  if (sdS.rodando) return Promise.resolve();
  sdS.rodando = true; sdCalcular();
  if (!comRede){ sdS.rodando = false; return Promise.resolve(); }
  return sdCarregarExtras().then(function(){ sdCalcular(); }).catch(function(){}).then(function(){ sdS.rodando = false; sdAtualizarTela(); });
}
/* itens que valem (os dispensados com a mesma assinatura ficam de fora) */
function sdVisiveis(c){
  var disp = sdDispLer(), todos = (sdS.res && sdS.res[c.id]) || [], vis = [], ocultos = [];
  todos.forEach(function(it){ if (disp[c.id + '|' + it.k] === it.sig) ocultos.push(it); else vis.push(it); });
  return { vis: vis, ocultos: ocultos };
}
function sdContagens(){
  var porAba = {}, atencao = 0, total = 0, ocultos = 0;
  sdChecksDoPapel().forEach(function(c){ var v = sdVisiveis(c); porAba[c.aba] = (porAba[c.aba] || 0) + v.vis.length; total += v.vis.length; ocultos += v.ocultos.length; if (c.gr === 'a') atencao += v.vis.length; });
  return { porAba: porAba, atencao: atencao, total: total, ocultos: ocultos };
}

/* ---------- bolinha (número de itens em "Atenção") ---------- */
function sdBolinhaDrawer(){
  var it = document.querySelector('#drawer [data-tab="configuracoes"]'); if (!it) return null;
  var s = qs('menuNSaude'); if (!s){ s = document.createElement('span'); s.className = 'dr-n red'; s.id = 'menuNSaude'; it.appendChild(s); }
  return s;
}
function sdAtualizarTela(){
  if (!sdS.res) return;
  var c = sdContagens(), b = sdBolinhaDrawer(); if (b) b.textContent = c.atencao > 0 ? String(c.atencao) : '';
  var ln = document.querySelector('#cfWrap [data-cf="saude"] .cf-seta'); if (ln){ var n = ln.parentNode.querySelector('.sd-bol'); if (c.atencao > 0){ if (!n){ n = document.createElement('span'); n.className = 'sd-bol'; ln.parentNode.insertBefore(n, ln); } n.textContent = String(c.atencao); } else if (n) n.remove(); }
  var ov = qs('overlaySd'); if (ov && ov.classList.contains('show')) sdDesenhar();
}

/* ---------- tela ---------- */
function sdQuando(){
  if (!sdS.quando) return 'ainda não verificado';
  var d = new Date(sdS.quando), hh = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2), hoje = new Date();
  return (d.toDateString() === hoje.toDateString() ? 'hoje' : fmtData(d.toISOString().slice(0, 10))) + ' às ' + hh;
}
function sdItemHtml(c, it, dispensado){
  return '<div class="sd-it"><div class="sd-itt"><b>' + escapeHtml(it.t) + '</b><small>' + escapeHtml(it.s) + '</small></div><div class="sd-acts">' +
    (dispensado ? '<button type="button" class="btn btn-ghost" data-sd="rest" data-id="' + c.id + '" data-k="' + escapeHtml(it.k) + '">Restaurar</button>' :
      '<button type="button" class="btn btn-ghost" data-sd="ir" data-id="' + c.id + '" data-k="' + escapeHtml(it.k) + '">Abrir</button><button type="button" class="btn btn-ghost" data-sd="disp" data-id="' + c.id + '" data-k="' + escapeHtml(it.k) + '">Dispensar</button>') + '</div></div>';
}
function sdDesenhar(){
  var box = qs('overlaySdC'); if (!box) return;
  var abas = sdAbasPermitidas(), ct = sdContagens();
  if (abas.indexOf(sdS.aba) < 0) sdS.aba = abas[0] || '';
  var h = '<div class="sd-top"><span class="saldo-data">Verificado ' + escapeHtml(sdQuando()) + '</span><button type="button" class="btn btn-primary" data-sd="rodar"' + (sdS.rodando ? ' disabled' : '') + '>' + ico('refresh-cw', 16) + ' ' + (sdS.rodando ? 'Verificando…' : 'Verificar agora') + '</button></div>';
  if (abas.length > 1) h += '<div class="sd-tabs">' + SD_ABAS.filter(function(a){ return abas.indexOf(a[0]) >= 0; }).map(function(a){ var n = ct.porAba[a[0]] || 0; return '<button type="button" class="dg-aba sd-tab' + (sdS.aba === a[0] ? ' on' : '') + '" data-sd="aba" data-v="' + a[0] + '">' + a[1] + (n ? ' <b class="sd-n' + (sdS.aba === a[0] ? ' on' : '') + '">' + n + '</b>' : '') + '</button>'; }).join('') + '</div>';
  var checks = sdChecksDoPapel().filter(function(c){ return c.aba === sdS.aba; }), comItens = [], ok = [], ocultosAba = [];
  checks.forEach(function(c){ var v = sdVisiveis(c); if (v.vis.length) comItens.push({ c: c, v: v }); else ok.push(c); v.ocultos.forEach(function(it){ ocultosAba.push({ c: c, it: it }); }); });
  comItens.sort(function(a, b){ return (a.c.gr === b.c.gr ? 0 : (a.c.gr === 'a' ? -1 : 1)); });
  if (!sdS.res) h += '<div class="financeiro-vazio">Verificando…</div>';
  else if (!comItens.length) h += '<div class="sd-vazio">' + ico('check-circle', 20) + '<span>Nada a olhar nesta área. Tudo certo.</span></div>';
  comItens.forEach(function(x){
    var c = x.c, aberto = sdS.aberto[c.id] !== false && (sdS.aberto[c.id] || c.gr === 'a'), lim = sdS.todos[c.id] ? 999 : 6;
    h += '<div class="sd-ck ' + (c.gr === 'a' ? 'a' : 'c') + '"><button type="button" class="sd-ckh" data-sd="ck" data-id="' + c.id + '" aria-expanded="' + (aberto ? 'true' : 'false') + '"><span class="sd-ckt">' + escapeHtml(c.t) + '<small>' + escapeHtml(c.sub) + '</small></span><span class="sd-n ' + (c.gr === 'a' ? 'r' : 'am') + '">' + x.v.vis.length + '</span><span class="sd-seta">' + (aberto ? '⌄' : '›') + '</span></button>';
    if (aberto){
      h += '<div class="sd-its">' + x.v.vis.slice(0, lim).map(function(it){ return sdItemHtml(c, it, false); }).join('') + (x.v.vis.length > lim ? '<button type="button" class="btn btn-ghost sd-mais" data-sd="todos" data-id="' + c.id + '">Ver todos (' + x.v.vis.length + ')</button>' : '') + '</div>';
    }
    h += '</div>';
  });
  if (ok.length) h += '<div class="sd-ok"><div class="sd-ok-t">' + ico('check-circle', 16) + ' Tudo certo nesta área · ' + sdPlural(ok.length, 'checagem', 'checagens') + '</div><div class="sd-ok-l">' + ok.map(function(c){ return '<span>' + escapeHtml(c.t) + '</span>'; }).join('') + '</div></div>';
  if (ocultosAba.length){
    h += '<button type="button" class="btn btn-ghost sd-disp-b" data-sd="mostrarDisp">' + (sdS.mostrarDisp ? 'Esconder' : 'Mostrar') + ' ' + sdPlural(ocultosAba.length, 'item dispensado', 'itens dispensados') + '</button>';
    if (sdS.mostrarDisp) h += '<div class="sd-its sd-disp">' + ocultosAba.map(function(x){ return sdItemHtml(x.c, x.it, true); }).join('') + '<div class="saldo-data">Um item dispensado volta sozinho se o dado dele mudar.</div></div>';
  }
  box.innerHTML = h;
}
function sdAcharItem(id, k){ var r = sdS.res && sdS.res[id]; if (!r) return null; for (var i = 0; i < r.length; i++) if (r[i].k === k) return r[i]; return null; }
function sdClique(a, b){
  var id = b.getAttribute('data-id'), k = b.getAttribute('data-k');
  if (a === 'aba'){ sdS.aba = b.getAttribute('data-v'); sdDesenhar(); }
  else if (a === 'rodar') sdVerificar(true);
  else if (a === 'ck'){ var c0 = SD_CHECKS.filter(function(x){ return x.id === id; })[0], atual = sdS.aberto[id] !== undefined ? sdS.aberto[id] : (c0 && c0.gr === 'a'); sdS.aberto[id] = !atual; sdDesenhar(); }
  else if (a === 'todos'){ sdS.todos[id] = true; sdDesenhar(); }
  else if (a === 'mostrarDisp'){ sdS.mostrarDisp = !sdS.mostrarDisp; sdDesenhar(); }
  else if (a === 'ir'){ var it = sdAcharItem(id, k); if (it && it.go) it.go(); }
  else if (a === 'disp'){
    var it2 = sdAcharItem(id, k); if (!it2) return; var d = sdDispLer(), chave = id + '|' + k, antes = d[chave]; d[chave] = it2.sig; sdDispGravar(d); sdAtualizarTela();
    toast('Item dispensado. Ele volta se o dado mudar.', 'Desfazer', function(){ var d2 = sdDispLer(); if (antes === undefined) delete d2[chave]; else d2[chave] = antes; sdDispGravar(d2); sdAtualizarTela(); });
  }
  else if (a === 'rest'){ var d3 = sdDispLer(); delete d3[id + '|' + k]; sdDispGravar(d3); sdAtualizarTela(); }
}
function sdAbrir(){
  var ov = sgMontar('overlaySd', 'Saúde dos dados');
  if (!ov.getAttribute('data-sd')){
    ov.setAttribute('data-sd', '1');
    ov.addEventListener('click', function(e){ var b = e.target.closest ? e.target.closest('[data-sd]') : null; if (b && !b.disabled) sdClique(b.getAttribute('data-sd'), b); });
  }
  sdS.mostrarDisp = false; sdS.todos = {};
  var abas = sdAbasPermitidas(); if (abas.indexOf(sdS.aba) < 0) sdS.aba = abas[0] || '';
  sdCalcular();
  var ct = sdContagens(); if (abas.length > 1 && !(ct.porAba[sdS.aba])){ var primeira = abas.filter(function(a){ return ct.porAba[a]; })[0]; if (primeira) sdS.aba = primeira; }
  sdDesenhar(); ov.classList.add('show');
  sdVerificar(true);
}
function sdCss(){
  if (document.getElementById('sdCss')) return;
  var st = document.createElement('style'); st.id = 'sdCss';
  st.textContent = '.sd-top{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 10px}.sd-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px}.sd-tab .sd-n{margin-left:4px}' +
    '.sd-n{display:inline-grid;place-items:center;min-width:22px;height:20px;padding:0 6px;border-radius:7px;font-size:12px;font-weight:800;line-height:1;background:var(--surface-2);color:var(--ink)}.sd-n.on{background:rgba(255,255,255,.25);color:inherit}.sd-n.r{background:#D93B3B;color:#fff}.sd-n.am{background:#F2B01E;color:#3b2a00}' +
    '.sd-ck{background:var(--surface);border:1px solid var(--border);border-left:4px solid #F2B01E;border-radius:14px;margin:0 0 8px;overflow:hidden}.sd-ck.a{border-left-color:#D93B3B}' +
    '.sd-ckh{display:flex;align-items:center;gap:10px;width:100%;min-height:48px;border:0;background:transparent;font:inherit;text-align:left;padding:8px 12px;cursor:pointer;color:var(--ink)}.sd-ckt{flex:1;min-width:0;font-weight:700}.sd-ckt small{display:block;font-weight:400;color:var(--ink-soft);font-size:var(--t1)}.sd-seta{color:var(--ink-soft);flex:none}' +
    '.sd-its{padding:0 12px 8px}.sd-it{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;border-top:1px solid var(--border);padding:8px 0}.sd-itt{flex:1 1 180px;min-width:0}.sd-itt b{display:block;overflow-wrap:anywhere}.sd-itt small{display:block;color:var(--ink-soft);font-size:var(--t1);overflow-wrap:anywhere}.sd-acts{display:flex;gap:6px;flex-wrap:wrap;margin-left:auto}' +
    '.sd-mais,.sd-disp-b{margin:8px 0 0}.sd-ok{background:var(--surface);border:1px solid var(--border);border-left:4px solid #17895A;border-radius:14px;padding:10px 12px;margin:10px 0}.sd-ok-t{font-weight:700;color:#17895A;display:flex;align-items:center;gap:6px}.sd-ok-l{display:flex;flex-direction:column;gap:2px;margin-top:6px;color:var(--ink-soft);font-size:var(--t2)}' +
    '.sd-vazio{display:flex;align-items:center;gap:8px;background:var(--surface);border-radius:14px;padding:16px;color:#17895A;font-weight:700}.sd-bol{display:inline-grid;place-items:center;min-width:22px;height:20px;padding:0 6px;border-radius:7px;font-size:12px;font-weight:800;background:#D93B3B;color:#fff;margin-right:6px}.sd-disp{margin-top:6px}';
  document.head.appendChild(st);
}
(function(){
  sdCss(); sdBolinhaDrawer();
  var cf0 = (typeof cfRender === 'function') ? cfRender : null;
  if (cf0) cfRender = function(){ var r = cf0.apply(this, arguments); try{ sdAtualizarTela(); }catch(e){} return r; };
  setTimeout(function(){ sdVerificar(true); }, 9000);
  setInterval(function(){ if (!document.hidden) sdVerificar(true); }, 180000);
  window.addEventListener('horus-escopo', function(){ if (sdS.res) sdCalcular(); });
  window.__horusTeste = Object.assign(window.__horusTeste || {}, { sdS: sdS, sdVerificar: sdVerificar, sdCalcular: sdCalcular, sdContagens: sdContagens, sdChecksDoPapel: sdChecksDoPapel, sdAbrir: sdAbrir });
})();
