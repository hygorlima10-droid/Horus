/* ============================================================
   DELEGADAS (prefixo dg) — a "planilha" de tarefas delegadas da equipe, dentro do app (substitui a do Google Sheets).
   - Coleção `delegadas` (um documento por tarefa), COMPARTILHADA: toda a equipe vê, lança, edita, conclui e exclui (a Lixeira guarda 30 dias).
   - Computador: tabela com a primeira linha em branco para lançar (setinhas com busca para cliente, processo, responsável, delegado por, prioridade e status);
     Tab passa para a célula seguinte, Enter grava a linha, Esc descarta. Qualquer linha se corrige na própria célula (grava na hora, com "Desfazer").
   - Celular: cartões agrupados por prazo e ficha curta ("Mais detalhes" guarda o resto).
   - Abas: Abertas, Painel da equipe (por pessoa e status) e Concluídas. Responsáveis: chaves como na Agenda (OAB do advogado, u:<id> do usuário, n:Nome sem acesso).
   - Esta área não aparece no calendário da Agenda (decisão do proprietário).
   ============================================================ */
var DG_STATUS = [['afazer', 'A fazer', 's1'], ['andamento', 'Em andamento', 's2'], ['aguardando', 'Aguardando cliente', 's3'], ['revisao', 'Em revisão', 's4'], ['protocolada', 'Protocolada', 's5'], ['concluida', 'Concluída', 's5']];
var DG_REPETE = [['mensal', 'todo mês'], ['semanal', 'toda semana'], ['anual', 'todo ano'], ['unica', 'uma vez']], DG_DOW = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
var DG_AVISAR = [[0, 'no dia'], [1, '1 dia antes'], [2, '2 dias antes'], [3, '3 dias antes'], [5, '5 dias antes'], [7, '7 dias antes']];
var DG_REPETE_T = [['semanal', 'toda semana'], ['diaria', 'todo dia útil'], ['mensal', 'todo mês']];
var DG_PRIO = [['Alta', 'alta'], ['Média', 'media'], ['Baixa', 'baixa']];
var dgS = { novoFixa: null, docs: [], ok: false, carregando: false, erro: '', aba: 'abertas', fPessoa: '', fStatus: '', fPrio: '', soAtr: false, novo: null, dd: null, ficha: null, tick: 0 };

function dgTarefas(){ return dgS.docs.filter(function(d){ return d.tipo !== 'fixa'; }); }
function dgFixas(){ return dgS.docs.filter(function(d){ return d.tipo === 'fixa'; }); }
function dgFeita(d){ return d.status === 'protocolada' || d.status === 'concluida'; }
function dgStatusDe(v){ for (var i = 0; i < DG_STATUS.length; i++) if (DG_STATUS[i][0] === v) return DG_STATUS[i]; return DG_STATUS[0]; }
function dgMe(){ var k = (typeof esMinhasChaves === 'function') ? esMinhasChaves() : []; return k.length ? k[0] : ''; }
function dgNovoVazio(){ var me = dgMe(); return { titulo: '', cliente: '', clienteId: '', processo: '', resp: me, delegadoPor: me, prioridade: 'Média', status: 'afazer', trabalhar: '', fatal: '', obs: '', fixa: false, repete: 'semanal', dow: 1, dia: 1 }; }
function dgPessoas(){
  var l = (esS.equipeAg || []).map(function(x){ return { k: x.oab, nome: String(x.nome || '').replace(/ \(estagiário\)$/, ''), tipo: x.oab.indexOf('u:') === 0 ? 'est' : (x.oab.indexOf('n:') === 0 ? 'sem' : 'adv') }; });
  var me = dgMe(); if (me && !l.some(function(p){ return p.k === me; })) l.push({ k: me, nome: esNomeChave(me), tipo: 'adv' });
  return l;
}
function dgNome(k){ return k ? esNomeChave(k) : ''; }
function dgCurto(k){ return String(dgNome(k)).split(/\s+/)[0] || ''; }
function dgCor(k){ var cores = ['#C98500', '#2A78D6', '#17895A', '#8B5CF6', '#D93B3B', '#0E8FA6'], h = 0, s = String(k || ''); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 997; return cores[h % cores.length]; }
function dgAv(k){ if (!k) return ''; var sem = String(k).indexOf('n:') === 0; return '<span class="agc-av' + (sem ? ' agc-sem' : '') + '"' + (sem ? '' : ' style="background:' + dgCor(k) + ';color:#fff"') + ' title="' + escapeHtml(dgNome(k)) + '">' + escapeHtml(agdSigla(dgNome(k))) + '</span>'; }
function dgPrioCls(p){ return p === 'Alta' ? 'alta' : (p === 'Baixa' ? 'baixa' : 'media'); }
function dgClienteDoProcesso(num){
  var n = prNum(num), p = null; for (var i = 0; i < prDocs.length; i++) if (prNum(prDocs[i].numero) === n && n){ p = prDocs[i]; break; }
  if (!p) return { id: '', nome: '' };
  var ids = Array.isArray(p.clienteIds) ? p.clienteIds : []; for (var j = 0; j < ids.length; j++){ var c = clientes.filter(function(x){ return x.id === ids[j]; })[0]; if (c) return { id: c.id, nome: c.nome }; }
  return { id: '', nome: p.cliente || '' };
}
function dgDias(d){
  if (dgEhFixaT(d)){ var ef = dgTFixaEstado(d); if (!ef.prox || ef.est === 'feita') return { t: '', c: '' }; var uf = agUteis(ef.prox.data); return uf < 0 ? { t: '−' + (-uf) + (uf === -1 ? ' útil' : ' úteis'), c: 'atr' } : (uf === 0 ? { t: 'hoje', c: 'atr' } : { t: uf + (uf === 1 ? ' útil' : ' úteis'), c: uf <= 3 ? 'brv' : 'ok' }); }
  if (dgFeita(d) || !d.fatal) return { t: '', c: '' };
  var u = agUteis(d.fatal);
  if (u < 0) return { t: '−' + (-u) + (u === -1 ? ' útil' : ' úteis'), c: 'atr' };
  if (u === 0) return { t: 'hoje', c: 'atr' };
  return { t: u + (u === 1 ? ' útil' : ' úteis'), c: u <= 3 ? 'brv' : 'ok' };
}
function dgOrdem(a, b){
  var fa = a.fatal || '9999-99-99', fb = b.fatal || '9999-99-99';
  if (fa !== fb) return fa < fb ? -1 : 1;
  var pa = a.prioridade === 'Alta' ? 0 : (a.prioridade === 'Baixa' ? 2 : 1), pb = b.prioridade === 'Alta' ? 0 : (b.prioridade === 'Baixa' ? 2 : 1);
  return pa - pb || String(a.titulo || '').localeCompare(String(b.titulo || ''), 'pt-BR');
}
function dgFiltradas(){
  var hoje = agHoje();
  var l = dgTarefas().filter(function(d){
    if (dgFeita(d)) return false;
    if (dgS.fPessoa && (d.resp || '') !== dgS.fPessoa) return false;
    if (dgS.fPrio && d.prioridade !== dgS.fPrio) return false;
    var fx = dgEhFixaT(d);
    if (!fx && dgS.fStatus && d.status !== dgS.fStatus) return false;
    if (dgS.soAtr){ if (fx){ if (dgTFixaEstado(d).est !== 'atrasada') return false; } else if (!(d.fatal && d.fatal < hoje)) return false; }
    return true;
  });
  return l.filter(dgEhFixaT).sort(dgOrdemFixa).concat(l.filter(function(d){ return !dgEhFixaT(d); }).sort(dgOrdem));   /* as fixas ficam nas primeiras linhas */
}

/* ---------- dados ---------- */
function dgCarregar(silencioso){
  if (dgS.carregando) return Promise.resolve();
  dgS.carregando = true; if (!silencioso) dgS.erro = '';
  var todos = [], pagina = function(depois){
    return pbApi('/api/db/delegadas?limit=500' + (depois ? '&after=' + encodeURIComponent(depois) : '')).then(function(r){
      (r.docs || []).forEach(function(x){ var d = x.data || {}; d.id = x.id; todos.push(d); });
      return r.mais && r.docs && r.docs.length ? pagina(r.docs[r.docs.length - 1].id) : null;
    });
  };
  return pagina('').then(function(){ dgS.docs = todos; dgS.ok = true; dgS.erro = ''; dgCacheEst = {}; })
    .catch(function(e){ if (silencioso && dgS.ok) return; dgS.erro = e.message; dgS.ok = true; })   /* falha numa atualização automática não apaga o que está na tela */
    .then(function(){ dgS.carregando = false; if (activeTab === 'delegadas') dgRender(); });
}
function dgSemId(d){ var o = {}; Object.keys(d).forEach(function(k){ if (k !== 'id') o[k] = d[k]; }); return o; }
function dgGravar(d){
  d.atualizadoEm = new Date().toISOString();
  var corpo = dgSemId(d);
  if (d.id) return pbApi('/api/db/delegadas/' + encodeURIComponent(d.id), 'PUT', corpo).then(function(){ return d; });
  return pbApi('/api/db/delegadas', 'POST', corpo).then(function(j){ d.id = j.id; return d; });
}
function dgDoc(id){ for (var i = 0; i < dgS.docs.length; i++) if (dgS.docs[i].id === id) return dgS.docs[i]; return null; }
/* altera só os campos mudados de uma linha já gravada: o servidor junta ao documento que está gravado AGORA (?mesclar=1), então duas pessoas
   mexendo em campos diferentes da mesma linha não se sobrescrevem; devolve o documento já juntado. opcoes.semRender: não redesenha (ex.: ao digitar o título). */
function dgSalvarCampos(id, patch, desfazer, opcoes){
  var d = dgDoc(id); if (!d) return Promise.resolve();
  opcoes = opcoes || {}; patch = Object.assign({}, patch);
  var antes = {}; Object.keys(patch).forEach(function(k){ antes[k] = d[k] === undefined ? null : d[k]; });
  if (patch.status){
    if (dgFeita({ status: patch.status }) && !dgFeita(d)){ patch.concluidoEm = agHoje(); patch.concluidoPor = dgMe(); }
    if (!dgFeita({ status: patch.status })){ patch.concluidoEm = ''; patch.concluidoPor = ''; }
    antes.concluidoEm = d.concluidoEm === undefined ? '' : d.concluidoEm; antes.concluidoPor = d.concluidoPor === undefined ? '' : d.concluidoPor;
  }
  patch.atualizadoEm = new Date().toISOString();
  var aplicar = function(doc){ dgCacheEst = {}; dgS.docs = dgS.docs.map(function(x){ return x.id === id ? doc : x; }); };
  return pbApi('/api/db/delegadas/' + encodeURIComponent(id) + '?mesclar=1', 'PUT', patch).then(function(r){
    var novo = r && r.doc ? Object.assign({}, r.doc, { id: id }) : Object.assign({}, d, patch);
    aplicar(novo); if (!opcoes.semRender) dgRender();
    if (desfazer) toast('Salvo.', 'Desfazer', function(){ pbApi('/api/db/delegadas/' + encodeURIComponent(id) + '?mesclar=1', 'PUT', Object.assign({}, antes, { atualizadoEm: new Date().toISOString() })).then(function(r2){ aplicar(r2 && r2.doc ? Object.assign({}, r2.doc, { id: id }) : Object.assign({}, dgDoc(id) || d, antes)); dgRender(); }).catch(function(e){ toast('Não consegui desfazer: ' + e.message); }); });
    return novo;
  }).catch(function(e){ toast('Não consegui salvar: ' + e.message); dgCarregar(); });
}
function dgSalvarNovo(){
  dgLerNovo(); var n = dgS.novo; if (!n || !String(n.titulo || '').trim()){ toast('Digite a tarefa.'); var t = qs('dg_n_titulo'); if (t) t.focus(); return Promise.resolve(); }
  var d = Object.assign({}, n, { titulo: String(n.titulo).trim(), criadoPor: esS.eu ? esS.eu.id : '', criadoEm: new Date().toISOString() });
  if (!d.resp) d.resp = dgMe();
  if (d.fixa){ d.status = 'afazer'; d.fatal = ''; d.trabalhar = ''; d.fixaDesde = agHoje(); d.feitas = {}; } else { delete d.fixa; delete d.repete; delete d.dow; delete d.dia; }
  return dgGravar(d).then(function(){
    dgS.docs.push(d); dgS.novo = dgNovoVazio(); var tl = qs('dg_n_titulo'); if (tl) tl.value = ''; dgRender();
    toast('Tarefa lançada' + (d.resp ? ' · ' + dgCurto(d.resp) : '') + '.'); var t2 = qs('dg_n_titulo'); if (t2) t2.focus();
  }).catch(function(e){ toast('Não consegui lançar: ' + e.message); });
}
/* calculadora de prazos do app (regimes, dias úteis, feriados do TJGO): devolve o prazo fatal e o "trabalhar até" */
function dgContar(id){
  if (typeof pzAbrir !== 'function') return;
  pzAbrir({ retorno: function(res){
    if (id === 'ficha'){ var f = qs('dgf_fatal'), t = qs('dgf_trabalhar'); if (f) f.value = res.vencimento; if (t && res.trabalhar) t.value = res.trabalhar; try{ fichaMaisEm(qs('overlayDgC')); }catch(e){} return; }
    dgAplicar(id, { fatal: res.vencimento, trabalhar: res.trabalhar || '' }, false);
  } });
}
function dgLerNovo(){ var t = qs('dg_n_titulo'); if (t && dgS.novo) dgS.novo.titulo = t.value; }

/* ---------- setinha com busca (popup único) ---------- */
function dgBaseDe(id){ return id === 'novo' ? dgS.novo : (id === 'novofixa' ? dgS.novoFixa : (dgDoc(id) || {})); }
function dgOpcoes(campo, id){
  var base = dgBaseDe(id);
  if (campo === 'repete'){ var contaF = base && base.tipo === 'fixa'; return { itens: (contaF ? DG_REPETE : DG_REPETE_T).map(function(r){ return { v: r[0], l: r[1] }; }) }; }
  if (campo === 'dia'){ var di = []; for (var n = 1; n <= 31; n++) di.push({ v: n, l: 'dia ' + n }); return { itens: di }; }
  if (campo === 'dow') return { itens: DG_DOW.map(function(x, i){ return { v: i, l: x }; }) };
  if (campo === 'avisarDias') return { itens: DG_AVISAR.map(function(a){ return { v: a[0], l: a[1] }; }) };
  if (campo === 'resp' || campo === 'delegadoPor') return { busca: true, itens: dgPessoas().map(function(p){ return { v: p.k, l: p.nome, s: p.tipo === 'est' ? 'estagiário(a)' : (p.tipo === 'sem' ? 'sem acesso ao app' : 'advogado(a)'), av: p.k }; }), vazio: campo === 'resp' ? '' : '' };
  if (campo === 'prioridade') return { itens: DG_PRIO.map(function(p){ return { v: p[0], l: p[0], c: p[1] }; }) };
  if (campo === 'status') return { itens: DG_STATUS.map(function(s){ return { v: s[0], l: s[1], st: s[2] }; }) };
  if (campo === 'cliente'){
    var itens = clientes.filter(function(c){ return !c.arquivado; }).sort(function(a, b){ return String(a.nome).localeCompare(String(b.nome), 'pt-BR'); }).map(function(c){
      var n = prDocs.filter(function(p){ return Array.isArray(p.clienteIds) && p.clienteIds.indexOf(c.id) >= 0; }).length;
      return { v: c.id, l: c.nome, s: n ? n + (n === 1 ? ' processo' : ' processos') : '' };
    });
    return { busca: true, itens: itens, livre: 'texto', limpar: !!(base.cliente || base.clienteId) };
  }
  if (campo === 'processo'){
    var lista = prDocs.filter(function(p){ return !p.arquivado; });
    if (base.clienteId) lista = lista.filter(function(p){ return Array.isArray(p.clienteIds) && p.clienteIds.indexOf(base.clienteId) >= 0; });
    return { busca: true, itens: lista.map(function(p){ return { v: p.numero, l: p.numero, s: [p.partes, p.orgao].filter(Boolean).join(' · ') }; }), livre: 'numero', limpar: !!base.processo };
  }
  return { itens: [] };
}
function dgAbrirDD(btn, campo, id){
  dgFecharDD(); var o = dgOpcoes(campo, id);
  var pop = document.createElement('div'); pop.id = 'dgDD'; pop.className = 'dg-dd'; pop.setAttribute('data-c', campo); pop.setAttribute('data-id', id);
  var r = btn.getBoundingClientRect(), larg = Math.max(r.width, 250);
  pop.style.left = Math.max(8, Math.min(r.left, window.innerWidth - larg - 8)) + 'px'; pop.style.width = larg + 'px';
  var abaixo = window.innerHeight - r.bottom > 260; pop.style[abaixo ? 'top' : 'bottom'] = (abaixo ? r.bottom + 4 : window.innerHeight - r.top + 4) + 'px';
  document.body.appendChild(pop); dgS.dd = { campo: campo, id: id, o: o, q: '' };
  dgDesenharDD(); var inp = pop.querySelector('input'); if (inp) inp.focus();
}
function dgDesenharDD(){
  var pop = qs('dgDD'), S = dgS.dd; if (!pop || !S) return;
  var q = normNome(S.q), itens = S.o.itens.filter(function(x){ return !q || normNome(x.l + ' ' + (x.s || '')).indexOf(q) >= 0; }).slice(0, 40);
  var h = S.o.busca ? '<input type="text" class="dg-dd-q" placeholder="digite para buscar" value="' + escapeHtml(S.q) + '" autocomplete="off">' : '';
  h += '<div class="dg-dd-l">' + itens.map(function(x, i){
    return '<button type="button" class="dg-dd-i" data-dgd="' + i + '">' + (x.av ? dgAv(x.av) : '') + (x.st ? '<span class="dg-st ' + x.st + '">' + escapeHtml(x.l) + '</span>' : '<span class="' + (x.c ? 'dg-pr ' + x.c : '') + '">' + escapeHtml(x.l) + '</span>') + (x.s ? '<small>' + escapeHtml(x.s) + '</small>' : '') + '</button>';
  }).join('') + (itens.length ? '' : '<div class="dg-dd-v">nada encontrado</div>');
  if (S.o.livre && S.q.trim()) h += '<button type="button" class="dg-dd-i dg-dd-liv" data-dgd="livre">' + (S.o.livre === 'texto' ? '+ usar “' + escapeHtml(S.q.trim()) + '” só como texto' : '+ usar o número “' + escapeHtml(S.q.trim()) + '” (ainda não cadastrado)') + '</button>';
  if (S.o.limpar) h += '<button type="button" class="dg-dd-i dg-dd-liv" data-dgd="limpar">limpar</button>';
  pop.innerHTML = h + '</div>'; S.vis = itens;
  var inp = pop.querySelector('input'); if (inp && document.activeElement !== inp){ inp.focus(); try{ inp.setSelectionRange(S.q.length, S.q.length); }catch(e){} }
}
function dgFecharDD(){ var p = qs('dgDD'); if (p) p.remove(); dgS.dd = null; }
function dgEscolher(valor, livre){
  var S = dgS.dd; if (!S) return; var campo = S.campo, id = S.id, patch = {};
  if (campo === 'cliente'){
    if (valor === '' && livre === 'limpar') patch = { cliente: '', clienteId: '' };
    else if (livre) patch = { cliente: valor, clienteId: '' };
    else { var c = clientes.filter(function(x){ return x.id === valor; })[0]; patch = { cliente: c ? c.nome : '', clienteId: valor }; }
    /* trocar o cliente que não tem o processo atual: o processo sai */
    var base = dgBaseDe(id);
    if (patch.clienteId && base.processo){ var dc = dgClienteDoProcesso(base.processo); if (dc.id !== patch.clienteId) patch.processo = ''; }
  } else if (campo === 'processo'){
    if (valor === '' && livre === 'limpar') patch = { processo: '' };
    else { patch = { processo: valor }; var b2 = dgBaseDe(id); if (!b2.cliente && !b2.clienteId){ var dc2 = dgClienteDoProcesso(valor); if (dc2.nome) { patch.cliente = dc2.nome; patch.clienteId = dc2.id; } } }
  } else patch[campo] = valor;
  dgFecharDD(); dgAplicar(id, patch, campo === 'status' || campo === 'resp' || campo === 'prioridade' || campo === 'repete');
}
function dgAplicar(id, patch, desfazer){
  if (id === 'novo'){ dgLerNovo(); Object.assign(dgS.novo, patch); dgRender(); return; }
  if (id === 'novofixa'){ dgLerNovoFixa(); Object.assign(dgS.novoFixa, patch); dgRender(); return; }
  dgSalvarCampos(id, patch, desfazer);
}

/* ---------- desenho ---------- */
/* processo + botão de copiar o número (para colar no sistema do tribunal) */
function dgCelProc(id, num){
  var sel = dgCelSel('processo', id, num ? escapeHtml(num) : (id === 'novo' ? 'Processo' : '—'), !num);
  return num ? '<div class="dg-fatal">' + sel + '<button type="button" class="dg-mini" data-dg="copiar" data-n="' + escapeHtml(num) + '" aria-label="Copiar o número do processo" title="Copiar o número do processo">' + (typeof AGD_COPIA === 'string' ? AGD_COPIA : 'Copiar') + '</button></div>' : sel;
}
function dgCelSel(campo, id, rotulo, vazio, extra){ return '<button type="button" class="dg-sel' + (vazio ? ' vazio' : '') + '" data-dg="dd" data-c="' + campo + '" data-id="' + id + '">' + rotulo + '<i>▾</i></button>'; }
function dgRotResp(k){ return k ? '<span class="dg-pess">' + dgAv(k) + escapeHtml(dgCurto(k)) + '</span>' : 'escolher'; }
function dgLinhaNova(){
  var n = dgS.novo, st = dgStatusDe(n.status), rep = DG_REPETE_T.filter(function(r){ return r[0] === n.repete; })[0] || DG_REPETE_T[0];
  var cStatus = n.fixa ? dgCelSel('repete', 'novo', escapeHtml(rep[1]), false) : dgCelSel('status', 'novo', escapeHtml(st[1]), false);
  var cTrab = n.fixa ? (n.repete === 'semanal' ? dgCelSel('dow', 'novo', escapeHtml(DG_DOW[Number(n.dow)] || 'dia'), false) : (n.repete === 'mensal' ? dgCelSel('dia', 'novo', 'dia ' + (n.dia || 1), false) : '<span class="mut">—</span>')) :
    '<input type="date" class="dg-dt" data-dgdt="trabalhar" data-id="novo" value="' + escapeHtml(n.trabalhar) + '">';
  var cFatal = n.fixa ? '<span class="mut">repete sozinha</span>' : '<div class="dg-fatal"><input type="date" class="dg-dt" data-dgdt="fatal" data-id="novo" value="' + escapeHtml(n.fatal) + '"><button type="button" class="dg-mini" data-dg="contar" data-id="novo" title="Contar o prazo (início + dias, com os feriados do TJGO)">' + ico('calendar-days', 14) + '</button></div>';
  return '<tr class="dg-novo"><td>' + dgCelSel('cliente', 'novo', n.cliente ? escapeHtml(n.cliente) : 'Cliente', !n.cliente) + '</td>' +
    '<td>' + dgCelProc('novo', n.processo) + '</td>' +
    '<td><div class="dg-fatal"><input type="text" id="dg_n_titulo" class="dg-in" placeholder="Digite a tarefa e tecle Enter" value="' + escapeHtml(n.titulo) + '" maxlength="200" autocomplete="off"><button type="button" class="dg-pinbtn' + (n.fixa ? ' on' : '') + '" data-dg="novafixa" title="Tarefa fixa: se repete sozinha e fica nas primeiras linhas" aria-pressed="' + (n.fixa ? 'true' : 'false') + '">' + dgPin(15) + '</button></div></td>' +
    '<td>' + dgCelSel('resp', 'novo', dgRotResp(n.resp), !n.resp) + '</td>' +
    '<td>' + dgCelSel('delegadoPor', 'novo', dgRotResp(n.delegadoPor), !n.delegadoPor) + '</td>' +
    '<td>' + dgCelSel('prioridade', 'novo', escapeHtml(n.prioridade), false) + '</td>' +
    '<td>' + cStatus + '</td><td>' + cTrab + '</td><td>' + cFatal + '</td>' +
    '<td class="dg-acao"><button type="button" class="btn btn-primary dg-ok" data-dg="salvarnovo" title="Lançar (Enter)">Lançar</button></td></tr>';
}
function dgLinhaFixa(d){
  var ch = dgTFixaChip(d), id = escapeHtml(d.id), dias = dgDias(d), prox = ch.est.prox;
  return '<tr class="dg-fx" data-dgl="' + id + '"><td>' + dgCelSel('cliente', d.id, d.cliente ? escapeHtml(d.cliente) : '—', !d.cliente) + '</td>' +
    '<td>' + dgCelProc(d.id, d.processo) + '</td>' +
    '<td><div class="dg-fatal"><span class="dg-pin" title="Tarefa fixa">' + dgPin(15) + '</span><input type="text" class="dg-in dg-t" data-dgt="' + id + '" value="' + escapeHtml(d.titulo || '') + '" maxlength="200" title="' + escapeHtml(d.titulo || '') + '"></div></td>' +
    '<td>' + dgCelSel('resp', d.id, dgRotResp(d.resp), !d.resp) + '</td>' +
    '<td>' + dgCelSel('delegadoPor', d.id, dgRotResp(d.delegadoPor), !d.delegadoPor) + '</td>' +
    '<td>' + dgCelSel('prioridade', d.id, '<b class="dg-pr ' + dgPrioCls(d.prioridade) + '">' + escapeHtml(d.prioridade || 'Média') + '</b>', false) + '</td>' +
    '<td><button type="button" class="dg-st ' + ch.cls + ' dg-stbtn" data-dg="tfixafeita" data-id="' + id + '" title="' + (ch.est.est === 'feita' ? 'Toque para desfazer' : 'Toque para marcar como feita') + '">' + escapeHtml(ch.t) + '</button></td>' +
    '<td><span class="dg-rep">' + escapeHtml(dgRepTexto(d)) + '</span></td>' +
    '<td>' + (prox ? '<span class="dg-rep">' + escapeHtml(DG_DOW[pbDow(prox.data)].slice(0, 3) + ' ' + fmtData(prox.data).slice(0, 5)) + '</span>' : '<span class="mut">—</span>') + '</td>' +
    '<td class="dg-acao"><span class="dg-dias ' + dias.c + '">' + dias.t + '</span> <button type="button" class="dg-mini" data-dg="ficha" data-id="' + id + '" title="Abrir a ficha completa (repetição, observações)">' + ico('maximize', 14) + '</button> <button type="button" class="dg-mini ok" data-dg="tfixafeita" data-id="' + id + '" title="' + (ch.est.est === 'feita' ? 'Desfazer' : 'Feita neste ciclo') + '">' + ico('check', 14) + '</button></td></tr>';
}
function dgLinha(d){
  if (dgEhFixaT(d)) return dgLinhaFixa(d);
  var dias = dgDias(d), st = dgStatusDe(d.status);
  return '<tr data-dgl="' + escapeHtml(d.id) + '"><td>' + dgCelSel('cliente', d.id, d.cliente ? escapeHtml(d.cliente) : '—', !d.cliente) + '</td>' +
    '<td>' + dgCelProc(d.id, d.processo) + '</td>' +
    '<td><input type="text" class="dg-in dg-t" data-dgt="' + escapeHtml(d.id) + '" value="' + escapeHtml(d.titulo || '') + '" maxlength="200" title="' + escapeHtml(d.titulo || '') + '"></td>' +
    '<td>' + dgCelSel('resp', d.id, dgRotResp(d.resp), !d.resp) + '</td>' +
    '<td>' + dgCelSel('delegadoPor', d.id, dgRotResp(d.delegadoPor), !d.delegadoPor) + '</td>' +
    '<td>' + dgCelSel('prioridade', d.id, '<b class="dg-pr ' + dgPrioCls(d.prioridade) + '">' + escapeHtml(d.prioridade || 'Média') + '</b>', false) + '</td>' +
    '<td>' + dgCelSel('status', d.id, '<span class="dg-st ' + st[2] + '">' + escapeHtml(st[1]) + '</span>', false) + '</td>' +
    '<td><input type="date" class="dg-dt" data-dgdt="trabalhar" data-id="' + escapeHtml(d.id) + '" value="' + escapeHtml(d.trabalhar || '') + '"></td>' +
    '<td><input type="date" class="dg-dt" data-dgdt="fatal" data-id="' + escapeHtml(d.id) + '" value="' + escapeHtml(d.fatal || '') + '"></td>' +
    '<td class="dg-acao"><span class="dg-dias ' + dias.c + '">' + dias.t + '</span> <button type="button" class="dg-mini" data-dg="ficha" data-id="' + escapeHtml(d.id) + '" title="Abrir a ficha completa">' + ico('maximize', 14) + '</button> <button type="button" class="dg-mini" data-dg="tornarfixa" data-id="' + escapeHtml(d.id) + '" title="Tornar fixa (se repete sozinha)">' + dgPin(14) + '</button> <button type="button" class="dg-mini ok" data-dg="concluir" data-id="' + escapeHtml(d.id) + '" title="Concluir">' + ico('check', 14) + '</button></td></tr>';
}
function dgCartaoFixa(d){
  var ch = dgTFixaChip(d), id = escapeHtml(d.id);
  return '<div class="dg-card dg-cfx ' + (ch.est.est === 'atrasada' ? 'atr' : '') + '" data-dgl="' + id + '"><div class="dg-card-t" data-dg="ficha" data-id="' + id + '"><b><span class="dg-pin">' + dgPin(14) + '</span> ' + escapeHtml(d.titulo || '') + '</b>' + ((d.cliente || d.processo) ? '<small>' + escapeHtml([d.cliente, d.processo].filter(Boolean).join(' · ')) + '</small>' : '') + '</div>' + (d.processo ? '<div class="dg-card-l"><button type="button" class="dg-bt" data-dg="copiar" data-n="' + escapeHtml(d.processo) + '">' + (typeof AGD_COPIA === 'string' ? AGD_COPIA : '') + ' Copiar o número</button></div>' : '') +
    '<div class="dg-card-l"><span class="dg-st ' + ch.cls + '">' + escapeHtml(ch.t) + '</span><span class="mut">' + escapeHtml(dgRepTexto(d)) + '</span></div>' +
    '<div class="dg-card-l">' + dgAv(d.resp) + '<span>' + escapeHtml(dgCurto(d.resp) || 'sem responsável') + '</span>' + (d.delegadoPor ? '<span class="mut">· delegado por ' + escapeHtml(dgCurto(d.delegadoPor)) + '</span>' : '') + '</div>' +
    '<div class="dg-card-l"><button type="button" class="dg-bt ok" data-dg="tfixafeita" data-id="' + id + '">' + ico('check', 14) + ' ' + (ch.est.est === 'feita' ? 'Desfazer' : 'Feita neste ciclo') + '</button><button type="button" class="dg-bt" data-dg="ficha" data-id="' + id + '">Editar</button></div></div>';
}
function dgCartao(d){
  if (dgEhFixaT(d)) return dgCartaoFixa(d);
  var dias = dgDias(d), st = dgStatusDe(d.status);
  return '<div class="dg-card ' + (dias.c === 'atr' ? 'atr' : '') + '" data-dgl="' + escapeHtml(d.id) + '"><div class="dg-card-t" data-dg="ficha" data-id="' + escapeHtml(d.id) + '"><b>' + escapeHtml(d.titulo || '') + '</b>' +
    ((d.cliente || d.processo) ? '<small>' + escapeHtml([d.cliente, d.processo].filter(Boolean).join(' · ')) + '</small>' : '') + '</div>' + (d.processo ? '<div class="dg-card-l"><button type="button" class="dg-bt" data-dg="copiar" data-n="' + escapeHtml(d.processo) + '">' + (typeof AGD_COPIA === 'string' ? AGD_COPIA : '') + ' Copiar o número</button></div>' : '') +
    '<div class="dg-card-l"><span class="dg-st ' + st[2] + '">' + escapeHtml(st[1]) + '</span><b class="dg-pr ' + dgPrioCls(d.prioridade) + '">' + escapeHtml(d.prioridade || 'Média') + '</b>' + (d.fatal ? '<span class="mut">fatal ' + escapeHtml(fmtData(d.fatal).slice(0, 5)) + '</span>' : '') + (dias.t ? '<span class="dg-dias ' + dias.c + '">' + dias.t + '</span>' : '') + '</div>' +
    '<div class="dg-card-l">' + dgAv(d.resp) + '<span>' + escapeHtml(dgCurto(d.resp) || 'sem responsável') + '</span>' + (d.delegadoPor ? '<span class="mut">· delegado por ' + escapeHtml(dgCurto(d.delegadoPor)) + '</span>' : '') + '</div>' +
    '<div class="dg-card-l"><button type="button" class="dg-bt" data-dg="status" data-id="' + escapeHtml(d.id) + '">' + escapeHtml(st[1]) + ' ▾</button><button type="button" class="dg-bt" data-dg="ficha" data-id="' + escapeHtml(d.id) + '">Editar</button><button type="button" class="dg-bt ok" data-dg="concluir" data-id="' + escapeHtml(d.id) + '">' + ico('check', 14) + ' Concluir</button></div></div>';
}
function dgFiltrosHtml(){
  var pessoas = dgPessoas(), chip = function(v, t, on, a){ return '<button type="button" class="dg-chip' + (on ? ' on' : '') + '" data-dg="' + a + '" data-v="' + escapeHtml(v) + '">' + escapeHtml(t) + '</button>'; };
  var h = '<div class="dg-fil">' + chip('', 'Todas', !dgS.fPessoa, 'fpessoa') + pessoas.filter(function(p){ return p.tipo !== 'adv' || dgTarefas().some(function(d){ return d.resp === p.k; }); }).map(function(p){ return chip(p.k, String(p.nome).split(' ')[0], dgS.fPessoa === p.k, 'fpessoa'); }).join('');
  h += '<select class="dg-fs" data-dgf="status"><option value="">Status</option>' + DG_STATUS.filter(function(s){ return s[0] !== 'protocolada' && s[0] !== 'concluida'; }).map(function(s){ return '<option value="' + s[0] + '"' + (dgS.fStatus === s[0] ? ' selected' : '') + '>' + s[1] + '</option>'; }).join('') + '</select>';
  h += '<select class="dg-fs" data-dgf="prio"><option value="">Prioridade</option>' + DG_PRIO.map(function(p){ return '<option' + (dgS.fPrio === p[0] ? ' selected' : '') + '>' + p[0] + '</option>'; }).join('') + '</select>';
  h += chip('', 'Só atrasadas', dgS.soAtr, 'fatr') + '<button type="button" class="btn btn-primary dg-mobnovo" data-dg="fichanova">' + ico('plus', 16) + ' Delegar tarefa</button></div>';
  return h;
}
function dgAbertasHtml(){
  var l = dgFiltradas(), hoje = agHoje(), h = dgFiltrosHtml(), cand = dgCandidatasFixa().length;
  if (cand) h += '<div class="pb-aviso dg-conv-av"><span>' + dgPin(14) + ' <b>' + cand + (cand === 1 ? ' tarefa diz' : ' tarefas dizem') + ' “Tarefa Fixa”.</b> Quer transformar em fixas (repetem sozinhas, nas primeiras linhas)?</span> <button type="button" class="btn btn-primary pb-b" data-dg="convlista">Revisar e converter</button></div>';
  h += '<div class="dg-desk"><div class="dg-tw"><table class="dg-t dg-ta"><thead><tr><th>Cliente</th><th>Processo</th><th>Tarefa *</th><th>Responsável</th><th>Delegado por</th><th>Prior.</th><th>Status</th><th>Trabalhar até</th><th>Prazo fatal</th><th></th></tr></thead><tbody>' + dgLinhaNova() + l.map(dgLinha).join('') + '</tbody></table></div>' +
    (l.length ? '' : '<div class="saldo-data" style="margin:10px 4px">Nenhuma tarefa aberta' + (dgS.fPessoa || dgS.fStatus || dgS.fPrio || dgS.soAtr ? ' com esse filtro' : '') + '. Lance a primeira na linha em destaque.</div>') +
    '<div class="saldo-data dg-dica">Digite a tarefa e tecle <b>Enter</b> (ou toque em Lançar). <b>Tab</b> passa para a célula ao lado; <b>Esc</b> limpa a linha. Para corrigir, toque na célula: grava na hora.</div></div>';
  /* celular: cartões por atraso */
  var grupos = [['Atrasadas', function(d){ return d.fatal && d.fatal < hoje; }], ['Esta semana', function(d){ return d.fatal && d.fatal >= hoje && d.fatal <= pbSoma(hoje, 7); }], ['Depois', function(d){ return d.fatal && d.fatal > pbSoma(hoje, 7); }], ['Sem prazo', function(d){ return !d.fatal; }]];
  var lc = l.filter(function(d){ return !dgEhFixaT(d); }), lfx = l.filter(dgEhFixaT);
  h += '<div class="dg-mob">' + lfx.map(dgCartao).join('') + (lc.length ? grupos.map(function(g){ var it = lc.filter(g[1]); return it.length ? '<div class="dg-sec' + (g[0] === 'Atrasadas' ? ' atr' : '') + '">' + g[0] + ' · ' + it.length + '</div>' + it.map(dgCartao).join('') : ''; }).join('') : (lfx.length ? '' : '<div class="saldo-data" style="margin:10px 4px">Nenhuma tarefa aberta. Toque em “Delegar tarefa”.</div>')) + '</div>';
  return h;
}
function dgPainelHtml(){
  var por = {}, hoje = agHoje(); dgPessoas().forEach(function(p){ por[p.k] = { k: p.k, nome: p.nome, tipo: p.tipo, c: { afazer: 0, andamento: 0, aguardando: 0, revisao: 0 }, atr: 0, tot: 0 }; });
  dgTarefas().forEach(function(d){ if (dgFeita(d)) return; var fxe = dgEhFixaT(d) ? dgTFixaEstado(d) : null; if (fxe && fxe.est === 'feita') return; var k = d.resp || ''; if (!por[k]) por[k] = { k: k, nome: k ? dgNome(k) : 'Sem responsável', tipo: 'sem', c: { afazer: 0, andamento: 0, aguardando: 0, revisao: 0 }, atr: 0, tot: 0 }; por[k].c[fxe ? 'afazer' : d.status] = (por[k].c[fxe ? 'afazer' : d.status] || 0) + 1; por[k].tot++; if (fxe ? fxe.est === 'atrasada' : (d.fatal && d.fatal < hoje)) por[k].atr++; });
  var l = Object.keys(por).map(function(k){ return por[k]; }).filter(function(p){ return p.tot > 0 || p.tipo === 'est'; }).sort(function(a, b){ return b.tot - a.tot || String(a.nome).localeCompare(String(b.nome), 'pt-BR'); });
  var cel = function(n, cls){ return '<td class="dg-n' + (n ? ' ' + (cls || '') : ' z') + '">' + (n || '·') + '</td>'; };
  return '<div class="dg-tw"><table class="dg-t dg-p"><thead><tr><th>Pessoa</th><th>A fazer</th><th>Em andamento</th><th>Aguardando</th><th>Em revisão</th><th>Atrasadas</th><th>Total</th></tr></thead><tbody>' +
    l.map(function(p){ return '<tr><td><span class="dg-pess">' + dgAv(p.k) + escapeHtml(p.nome) + '</span></td>' + cel(p.c.afazer) + cel(p.c.andamento) + cel(p.c.aguardando) + cel(p.c.revisao) + cel(p.atr, 'atr') + '<td class="dg-n"><b>' + p.tot + '</b></td></tr>'; }).join('') + '</tbody></table></div>' +
    '<div class="saldo-data" style="margin:8px 4px">Só tarefas abertas. “Atrasadas” = prazo fatal já passou.</div>';
}
function dgConcluidasHtml(){
  var l = dgTarefas().filter(dgFeita).sort(function(a, b){ return String(b.concluidoEm || '').localeCompare(String(a.concluidoEm || '')); }).slice(0, 200);
  if (!l.length) return '<div class="saldo-data" style="margin:10px 4px">Nada concluído ainda.</div>';
  return '<div class="dg-tw"><table class="dg-t"><thead><tr><th>Concluída em</th><th>Tarefa</th><th>Cliente / processo</th><th>Responsável</th><th>Status</th><th></th></tr></thead><tbody>' + l.map(function(d){
    var st = dgStatusDe(d.status);
    return '<tr><td>' + (d.concluidoEm ? escapeHtml(fmtData(d.concluidoEm).slice(0, 5)) : '—') + '</td><td>' + escapeHtml(d.titulo || '') + '</td><td class="mut">' + escapeHtml([d.cliente, d.processo].filter(Boolean).join(' · ')) + '</td><td><span class="dg-pess">' + dgAv(d.resp) + escapeHtml(dgCurto(d.resp)) + '</span></td><td><span class="dg-st ' + st[2] + '">' + escapeHtml(st[1]) + '</span></td><td class="dg-acao"><button type="button" class="dg-bt" data-dg="reabrir" data-id="' + escapeHtml(d.id) + '">Reabrir</button> <button type="button" class="dg-mini" data-dg="ficha" data-id="' + escapeHtml(d.id) + '" title="Abrir">' + ico('maximize', 14) + '</button></td></tr>';
  }).join('') + '</tbody></table></div>';
}
function dgRender(){
  var el = qs('dgWrap'); if (!el) return; dgCss();
  if (!dgS.novo) dgS.novo = dgNovoVazio();
  if (!dgS.ok){ el.innerHTML = '<div class="saldo-data" style="margin:12px 4px">Carregando as tarefas…</div>'; dgCarregar(); return; }
  if (dgS.erro){ el.innerHTML = '<div class="pb-aviso">Não consegui carregar as tarefas: ' + escapeHtml(dgS.erro) + '</div><div class="pb-acts"><button type="button" class="btn btn-primary pb-b" data-dg="recarregar">Tentar de novo</button></div>'; return; }
  var t = qs('dg_n_titulo'), tinha = t && document.activeElement === t, pos = tinha ? t.selectionStart : 0; if (t && dgS.novo) dgS.novo.titulo = t.value;
  dgLerNovoFixa();
  var abas = [['abertas', 'Abertas'], ['painel', 'Painel da equipe'], ['fixas', 'Fixas (contas)'], ['concluidas', 'Concluídas']];
  el.innerHTML = '<div class="dg-abas">' + abas.map(function(a){ return '<button type="button" class="dg-aba' + (dgS.aba === a[0] ? ' on' : '') + '" data-dg="aba" data-v="' + a[0] + '">' + a[1] + '</button>'; }).join('') + '</div>' +
    (dgS.aba === 'painel' ? dgPainelHtml() : (dgS.aba === 'concluidas' ? dgConcluidasHtml() : (dgS.aba === 'fixas' ? dgFixasHtml() : dgAbertasHtml())));
  if (tinha){ var t2 = qs('dg_n_titulo'); if (t2){ t2.focus(); try{ t2.setSelectionRange(pos, pos); }catch(e){} } }
}



/* ---------- TAREFAS FIXAS (símbolo de alfinete): ficam nas primeiras linhas da mesma tabela, se repetem sozinhas e ficam atrasadas se não forem feitas ---------- */
function dgEhFixaT(d){ return !!d && d.fixa === true && d.tipo !== 'fixa'; }
function dgPin(t){ return '<svg width="' + (t || 14) + '" height="' + (t || 14) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 17v5"/><path d="M9 3h6l-1 6 4 4v2H6v-2l4-4-1-6z"/></svg>'; }
function dgSemanaDe(iso){ return pbSoma(iso, -((pbDow(iso) + 6) % 7)); }
function dgMesmoCiclo(f, a, b){ return f.repete === 'semanal' ? dgSemanaDe(a) === dgSemanaDe(b) : (f.repete === 'mensal' ? a.slice(0, 7) === b.slice(0, 7) : a === b); }
/* estado da fixa agora: atrasada (alguma vez já vencida e não feita), hoje, feita (o ciclo atual está feito) ou pendente (vence adiante) */
var dgCacheEst = {};
function dgTFixaEstado(f){
  var hoje = agHoje(), chave = f.id ? f.id + '|' + (f.atualizadoEm || '') + '|' + hoje : '';
  if (chave && dgCacheEst[chave]) return dgCacheEst[chave];
  var r = dgTFixaEstado0(f, hoje); if (chave) dgCacheEst[chave] = r; return r;
}
function dgTFixaEstado0(f, hoje){
  var feitas = f.feitas || {}, occ = dgOcorrencias(f, dgFixaDe(f), pbSoma(hoje, f.repete === 'diaria' ? 45 : (f.repete === 'mensal' ? 35 : 8))), prox = null, cur = null, i;
  for (i = 0; i < occ.length; i++){ if (!prox && !feitas[occ[i].c]) prox = occ[i]; if (!cur && dgMesmoCiclo(f, occ[i].data, hoje)) cur = occ[i]; }
  var ks = Object.keys(feitas).sort(), lf = ks.length ? Object.assign({ c: ks[ks.length - 1] }, feitas[ks[ks.length - 1]]) : null, est;
  if (prox && prox.data < hoje) est = 'atrasada';
  else if (prox && prox.data === hoje) est = 'hoje';
  else if (cur && feitas[cur.c]) est = 'feita';
  else est = 'pendente';
  return { est: est, prox: prox, cur: cur, feita: lf };
}
function dgRepTexto(f){
  if (f.repete === 'diaria') return 'todo dia útil';
  if (f.repete === 'mensal') return 'todo mês · dia ' + (f.dia || '?');
  return 'toda semana · ' + (DG_DOW[Number(f.dow)] || '?');
}
function dgTFixaChip(d){
  var e = dgTFixaEstado(d), cls = e.est === 'atrasada' ? 'atr' : (e.est === 'hoje' ? 's3' : (e.est === 'feita' ? 's5' : 's1')), t;
  if (e.est === 'atrasada') t = 'Atrasada desde ' + fmtData(e.prox.data).slice(0, 5);
  else if (e.est === 'hoje') t = 'Vence hoje';
  else if (e.est === 'feita') t = 'Feita' + (e.feita ? ' · ' + (dgCurto(e.feita.por) || '') + ' ' + fmtData(String(e.feita.dia || e.feita.em || '').slice(0, 10)).slice(0, 5) : '');
  else t = 'Vence ' + (e.prox ? (DG_DOW[pbDow(e.prox.data)] || '').slice(0, 3) + ' ' + fmtData(e.prox.data).slice(0, 5) : '—');
  return { cls: cls, t: t, est: e };
}
function dgOrdemFixa(a, b){
  var ra = { atrasada: 0, hoje: 1, pendente: 2, feita: 3 }, ea = dgTFixaEstado(a), eb = dgTFixaEstado(b);
  return (ra[ea.est] - ra[eb.est]) || String((ea.prox || {}).data || '9999').localeCompare(String((eb.prox || {}).data || '9999')) || String(a.titulo || '').localeCompare(String(b.titulo || ''), 'pt-BR');
}
/* "Feita": marca o ciclo (ou desmarca, se já estava feita) sem tirar a tarefa da lista */
function dgTFixaFeita(id){
  var d = dgDoc(id); if (!d) return Promise.resolve(); var e = dgTFixaEstado(d), feitas = Object.assign({}, d.feitas || {});
  if (e.est === 'feita' && e.cur && feitas[e.cur.c]) delete feitas[e.cur.c];
  else if (e.prox) feitas[e.prox.c] = { por: dgMe(), em: new Date().toISOString(), dia: agHoje() };
  else return Promise.resolve();
  var ks = Object.keys(feitas).sort(); while (ks.length > 40) delete feitas[ks.shift()];
  return dgSalvarCampos(id, { feitas: feitas }, true).then(function(){ try{ renderPainelAtencao(); }catch(x){} });
}
/* Central de atenção: a fixa que vence hoje ou já venceu, para quem é o responsável */
function dgTFixasAtencao(){
  if (!dgS.ok) return [];
  var meus = (typeof esMinhasChaves === 'function') ? esMinhasChaves() : [], out = [];
  dgTarefas().forEach(function(d){
    if (!dgEhFixaT(d) || !d.resp || meus.indexOf(d.resp) < 0) return;
    var e = dgTFixaEstado(d); if (e.est !== 'atrasada' && e.est !== 'hoje') return;
    out.push({ id: d.id, c: e.prox.c, data: e.prox.data, titulo: d.titulo, atrasada: e.est === 'atrasada' });
  });
  return out;
}
function dgTFixaCentralChip(it){
  var dd = Math.round((Date.parse(it.data + 'T12:00:00Z') - Date.parse(agHoje() + 'T12:00:00Z')) / 86400000);
  return '<div class="stall-chip' + (it.atrasada ? '' : ' tipo-murilo') + '" data-tfixa-feita="' + escapeHtml(it.id) + '" title="Toque para marcar como feita">' + upData(it.data, it.atrasada ? 'up-d-atraso' : 'up-d-hoje') +
    '<div class="up-top"><span>' + escapeHtml(it.titulo || 'Tarefa') + ' ' + (it.atrasada ? '<span class="est est-atraso">Atrasada</span>' : '<span class="up-tag-hoje">HOJE</span>') + '</span></div>' +
    '<div class="up-when">Tarefa fixa · ' + (it.atrasada ? 'venceu em ' : 'vence ') + fmtData(it.data) + ' · toque para marcar como feita</div></div>';
}
/* as tarefas que já dizem "Tarefa Fixa" (como na planilha antiga): a pessoa aprova a conversão */
function dgLimpaTitulo(t){ return String(t || '').replace(/[\s.,;:–-]*tarefa\s*fixa\.?\s*$/i, '').trim() || String(t || '').trim(); }
function dgCandidatasFixa(){ return dgTarefas().filter(function(d){ return !dgEhFixaT(d) && !dgFeita(d) && (/tarefa\s*fixa/i.test(d.titulo || '') || /tarefa\s*fixa/i.test(d.obs || '')); }); }
function dgAbrirConversao(){
  var ov = sgMontar('overlayDgConv', 'Converter em tarefas fixas'), l = dgCandidatasFixa();
  var h = '<div class="saldo-data" style="margin:0 0 8px">Estas tarefas dizem “Tarefa Fixa”. Escolha quais viram <b>fixas</b> (ficam nas primeiras linhas, com o alfinete) e como se repetem. A palavra sai do nome.</div>';
  h += l.length ? l.map(function(d){
    var dw = d.fatal ? pbDow(d.fatal) : 1, dm = d.fatal ? Number(d.fatal.slice(8, 10)) : 1;
    return '<div class="dg-conv" data-id="' + escapeHtml(d.id) + '"><label class="ad-it" style="border:0;padding:4px 0"><input type="checkbox" data-cv="ok" checked><span class="ad-t"><b>' + escapeHtml(dgLimpaTitulo(d.titulo)) + '</b><small class="saldo-data" style="display:block">' + escapeHtml(dgCurto(d.resp) || 'sem responsável') + (d.titulo !== dgLimpaTitulo(d.titulo) ? ' · era “' + escapeHtml(d.titulo) + '”' : '') + '</small></span></label>' +
      '<div class="dg-conv-l"><select data-cv="rep">' + DG_REPETE_T.map(function(r){ return dgOpt(r[1], r[0], r[0] === 'semanal'); }).join('') + '</select>' +
      '<select data-cv="dow">' + DG_DOW.map(function(x, i){ return dgOpt(x, String(i), i === dw); }).join('') + '</select>' +
      '<select data-cv="dia" style="display:none">' + Array.apply(null, Array(31)).map(function(_, i){ return dgOpt('dia ' + (i + 1), String(i + 1), i + 1 === dm); }).join('') + '</select></div></div>';
  }).join('') : '<div class="saldo-data">Nenhuma tarefa com “Tarefa Fixa” no nome ou nas observações.</div>';
  h += '<div class="f-rod-in"><button type="button" class="btn btn-ghost" data-dgcv="cancelar">Cancelar</button>' + (l.length ? '<button type="button" class="btn btn-primary" data-dgcv="converter">Converter as marcadas</button>' : '') + '</div>';
  qs('overlayDgConvC').innerHTML = h; ov.classList.add('show');
}
function dgConverter(){
  var linhas = Array.prototype.slice.call(document.querySelectorAll('#overlayDgConvC .dg-conv')), seq = Promise.resolve(), n = 0;
  linhas.forEach(function(el){
    if (!el.querySelector('[data-cv="ok"]').checked) return;
    var id = el.getAttribute('data-id'), d = dgDoc(id); if (!d) return;
    var rep = el.querySelector('[data-cv="rep"]').value, patch = { fixa: true, repete: rep, dow: Number(el.querySelector('[data-cv="dow"]').value), dia: Number(el.querySelector('[data-cv="dia"]').value), titulo: dgLimpaTitulo(d.titulo), obs: String(d.obs || '').replace(/tarefa\s*fixa\.?/ig, '').trim(), status: 'afazer', fatal: '', trabalhar: '', fixaDesde: agHoje(), feitas: {} };
    n++; seq = seq.then(function(){ return dgSalvarCampos(id, patch, false); });
  });
  seq.then(function(){ qs('overlayDgConv').classList.remove('show'); toast(n + (n === 1 ? ' tarefa virou fixa.' : ' tarefas viraram fixas.')); try{ renderPainelAtencao(); }catch(e){} });
}

/* ---------- FIXAS: contas do escritório que se repetem (só lembrete; não mexe em Finanças) ---------- */
function dgFixaVazia(){ return { tipo: 'fixa', titulo: '', valor: '', repete: 'mensal', dia: 10, dow: 1, data: '', avisarDias: 3, resp: dgMe(), pagas: [], obs: '' }; }
function dgUltimoDia(ano, mes){ return new Date(Date.UTC(ano, mes, 0)).getUTCDate(); }
function dgNum2(n){ return (n < 10 ? '0' : '') + n; }
/* as datas em que a conta vence entre de e ate; c = identificador do ciclo (para marcar "paga") */
function dgOcorrencias(f, de, ate){
  var out = [], d, y, m;
  if (f.repete === 'diaria'){ for (d = de; d <= ate; d = pbSoma(d, 1)) if (!pbNaoUtil(d)) out.push({ c: d, data: d }); return out; }
  if (f.repete === 'unica'){ if (f.data && f.data >= de && f.data <= ate) out.push({ c: f.data, data: f.data }); return out; }
  if (f.repete === 'semanal'){ for (d = de; d <= ate; d = pbSoma(d, 1)) if (pbDow(d) === Number(f.dow)) out.push({ c: d, data: d }); return out; }
  if (f.repete === 'anual'){ var md = String(f.data || '').slice(5); if (!/^\d{2}-\d{2}$/.test(md)) return out; for (y = Number(de.slice(0, 4)); y <= Number(ate.slice(0, 4)); y++){ var dt = y + '-' + md; if (dt >= de && dt <= ate) out.push({ c: String(y), data: dt }); } return out; }
  m = de.slice(0, 7);
  while (m <= ate.slice(0, 7)){
    var dia = Math.min(Number(f.dia) || 1, dgUltimoDia(Number(m.slice(0, 4)), Number(m.slice(5, 7)))), dm = m + '-' + dgNum2(dia);
    if (dm >= de && dm <= ate) out.push({ c: m, data: dm }); m = deslocarMes(m, 1);
  }
  return out;
}
function dgPagaEm(f, c){ return (f.pagas || []).indexOf(c) >= 0; }
/* a partir de quando olhar: no máximo o ciclo anterior ainda em atraso (semana: 6 dias; mês: 20; dia útil: só hoje; conta anual: 31) e nunca antes de a conta/fixa existir (só a "uma vez" vale desde sempre) */
function dgFixaDe(f){
  if (f.repete === 'unica') return '0000-01-01';
  var base = pbSoma(agHoje(), f.repete === 'semanal' ? -6 : (f.repete === 'diaria' ? 0 : (f.repete === 'mensal' ? -20 : -31))), cri = String(f.fixaDesde || f.criadoEm || '').slice(0, 10);
  return cri && cri > base ? cri : base;
}
/* a próxima conta ainda não paga (pode estar atrasada) */
function dgFixaProxima(f){
  var hoje = agHoje(), occ = dgOcorrencias(f, dgFixaDe(f), pbSoma(hoje, 400)).filter(function(o){ return !dgPagaEm(f, o.c); });
  return occ.length ? { c: occ[0].c, data: occ[0].data, atrasada: occ[0].data < hoje } : null;
}
function dgFixaVence(f){
  if (f.repete === 'semanal') return DG_DOW[Number(f.dow)] || '—';
  if (f.repete === 'mensal') return 'dia ' + (f.dia || '?');
  return f.data ? fmtData(f.data).slice(0, f.repete === 'anual' ? 5 : 10) : '—';
}
/* Central de atenção (estagiários e proprietário): contas que vencem em breve ou já venceram e ainda não foram marcadas como pagas */
function dgFixasAtencao(){
  if (!dgS.ok){ if (!dgS.carregando) dgCarregar(true).then(function(){ try{ renderPainelAtencao(); }catch(e){} }); return []; }
  var hoje = agHoje(), out = [];
  dgFixas().forEach(function(f){
    if (f.ativa === false) return;
    var lim = pbSoma(hoje, Number(f.avisarDias) || 0);
    dgOcorrencias(f, dgFixaDe(f), lim).forEach(function(o){ if (!dgPagaEm(f, o.c)) out.push({ id: f.id, c: o.c, data: o.data, titulo: f.titulo, valor: Number(f.valor) || 0, resp: f.resp }); });
  });
  return out;
}
function dgFixaChip(it, atrasado){
  var dd = Math.round((Date.parse(it.data + 'T12:00:00Z') - Date.parse(agHoje() + 'T12:00:00Z')) / 86400000);
  var estado = atrasado ? '<span class="est est-atraso">Atrasada</span>' : (dd === 0 ? '<span class="up-tag-hoje">HOJE</span>' : '<span class="est ' + (dd <= 3 ? 'est-breve' : 'est-ok') + '">' + (dd === 1 ? 'Amanhã' : 'Em ' + dd + ' dias') + '</span>');
  return '<div class="stall-chip' + (atrasado ? '' : ' tipo-murilo') + '" data-fixa-pagar="' + escapeHtml(it.id + '|' + it.c) + '" title="Toque para marcar como paga">' + upData(it.data, atrasado ? 'up-d-atraso' : (dd === 0 ? 'up-d-hoje' : '')) +
    '<div class="up-top"><span>' + escapeHtml(it.titulo || 'Conta') + ' ' + estado + '</span>' + (it.valor ? '<span>' + fmtMoeda(it.valor) + '</span>' : '') + '</div>' +
    '<div class="up-when">Conta do escritório · ' + (atrasado ? 'venceu em ' : 'vence em ') + fmtData(it.data) + (it.resp ? ' · ' + escapeHtml(dgCurto(it.resp)) : '') + ' · toque para marcar como paga</div></div>';
}
function dgFixaPagar(id, c){
  var f = dgDoc(id); if (!f || dgPagaEm(f, c)) return;
  dgSalvarCampos(id, { pagas: (f.pagas || []).concat([c]).slice(-36) }, true).then(function(){ try{ renderPainelAtencao(); }catch(e){} });
}
function dgLerNovoFixa(){ var t = qs('dg_f_titulo'), v = qs('dg_f_valor'); if (dgS.novoFixa){ if (t) dgS.novoFixa.titulo = t.value; if (v) dgS.novoFixa.valor = v.value; } }
function dgValorNum(v){ var x = String(v == null ? '' : v).trim(); if (!x) return ''; if (x.indexOf(',') >= 0) x = x.replace(/\./g, '').replace(',', '.'); var n = Number(x); return isFinite(n) && n >= 0 ? n : ''; }
function dgSalvarNovaFixa(){
  dgLerNovoFixa(); var n = dgS.novoFixa; if (!n || !String(n.titulo || '').trim()){ toast('Digite o nome da conta.'); var t = qs('dg_f_titulo'); if (t) t.focus(); return Promise.resolve(); }
  if ((n.repete === 'anual' || n.repete === 'unica') && !n.data){ toast('Escolha a data de vencimento.'); return Promise.resolve(); }
  var d = Object.assign({}, n, { titulo: String(n.titulo).trim(), valor: dgValorNum(n.valor), criadoPor: esS.eu ? esS.eu.id : '', criadoEm: new Date().toISOString() });
  return dgGravar(d).then(function(){ dgS.docs.push(d); dgS.novoFixa = dgFixaVazia(); var t1 = qs('dg_f_titulo'), v1 = qs('dg_f_valor'); if (t1) t1.value = ''; if (v1) v1.value = ''; dgRender(); toast('Conta cadastrada.'); try{ renderPainelAtencao(); }catch(e){} var t2 = qs('dg_f_titulo'); if (t2) t2.focus(); }).catch(function(e){ toast('Não consegui cadastrar: ' + e.message); });
}
function dgCelVence(f, id){
  if (f.repete === 'semanal') return dgCelSel('dow', id, escapeHtml(DG_DOW[Number(f.dow)] || 'dia'), false);
  if (f.repete === 'mensal') return dgCelSel('dia', id, 'dia ' + (f.dia || '?'), false);
  return '<input type="date" class="dg-dt" data-dgdt="data" data-id="' + id + '" value="' + escapeHtml(f.data || '') + '">';
}
function dgFixaLinha(f, novo){
  var id = novo ? 'novofixa' : escapeHtml(f.id), rep = DG_REPETE.filter(function(r){ return r[0] === f.repete; })[0] || DG_REPETE[0], av = DG_AVISAR.filter(function(a){ return a[0] === Number(f.avisarDias); })[0] || DG_AVISAR[3];
  var prox = novo ? null : dgFixaProxima(f), estado = '';
  if (!novo) estado = prox ? '<span class="dg-dias ' + (prox.atrasada ? 'atr' : (Math.round((Date.parse(prox.data + 'T12:00:00Z') - Date.parse(agHoje() + 'T12:00:00Z')) / 86400000) <= 3 ? 'brv' : 'ok')) + '">' + (prox.atrasada ? 'venceu ' : 'próxima ') + escapeHtml(fmtData(prox.data).slice(0, 5)) + '</span>' : '<span class="dg-dias ok">quitada</span>';
  return '<tr class="' + (novo ? 'dg-novo' : '') + '"' + (novo ? '' : ' data-dgl="' + id + '"') + '><td>' + (novo ? '<input type="text" id="dg_f_titulo" class="dg-in" placeholder="Ex.: Aluguel" value="' + escapeHtml(f.titulo) + '" maxlength="120" autocomplete="off">' : '<input type="text" class="dg-in dg-t" data-dgt="' + id + '" value="' + escapeHtml(f.titulo || '') + '" maxlength="120">') + '</td>' +
    '<td>' + (novo ? '<input type="text" id="dg_f_valor" class="dg-in" inputmode="decimal" placeholder="R$ (opcional)" value="' + escapeHtml(f.valor) + '" autocomplete="off" style="min-width:120px">' : '<input type="text" class="dg-in dg-t" inputmode="decimal" data-dgv="' + id + '" value="' + escapeHtml(f.valor === '' || f.valor == null ? '' : String(f.valor).replace('.', ',')) + '" placeholder="—" style="min-width:110px">') + '</td>' +
    '<td>' + dgCelSel('repete', id, escapeHtml(rep[1]), false) + '</td><td>' + dgCelVence(f, id) + '</td><td>' + dgCelSel('resp', id, dgRotResp(f.resp), !f.resp) + '</td><td>' + dgCelSel('avisarDias', id, escapeHtml(av[1]), false) + '</td>' +
    '<td class="dg-acao">' + (novo ? '<button type="button" class="btn btn-primary dg-ok" data-dg="salvarfixa">Cadastrar</button>' : estado + ' ' + (prox ? '<button type="button" class="dg-mini ok" data-dg="fixapaga" data-id="' + id + '" data-c="' + escapeHtml(prox.c) + '" title="Marcar esta conta como paga">' + ico('check', 14) + '</button> ' : '') + '<button type="button" class="dg-mini" data-dg="fixaficha" data-id="' + id + '" title="Abrir">' + ico('maximize', 14) + '</button>') + '</td></tr>';
}
function dgFixasHtml(){
  if (!dgS.novoFixa) dgS.novoFixa = dgFixaVazia();
  var l = dgFixas().filter(function(f){ return f.ativa !== false; }).sort(function(a, b){ var pa = dgFixaProxima(a), pb = dgFixaProxima(b); return (pa ? pa.data : '9999') < (pb ? pb.data : '9999') ? -1 : 1; });
  var h = '<div class="saldo-data" style="margin:2px 4px 8px">Contas do escritório que se repetem (aluguel, internet, anuidades…). <b>Só lembrete</b>: não mexe em Finanças. Elas aparecem na <b>Central de atenção</b> dos estagiários quando faltam os dias escolhidos em “Avisar”, até alguém marcar como paga.</div>';
  h += '<div class="dg-desk"><div class="dg-tw"><table class="dg-t"><thead><tr><th>Conta</th><th>Valor</th><th>Repete</th><th>Vence</th><th>Quem lembra</th><th>Avisar</th><th></th></tr></thead><tbody>' + dgFixaLinha(dgS.novoFixa, true) + l.map(function(f){ return dgFixaLinha(f, false); }).join('') + '</tbody></table></div>' +
    (l.length ? '' : '<div class="saldo-data" style="margin:10px 4px">Nenhuma conta cadastrada. Use a linha em destaque.</div>') + '</div>';
  h += '<div class="dg-mob"><button type="button" class="btn btn-primary" style="width:100%;margin:0 0 10px" data-dg="fixaficha" data-id="novo">' + ico('plus', 16) + ' Nova conta</button>' + l.map(function(f){
    var pr = dgFixaProxima(f);
    return '<div class="dg-card ' + (pr && pr.atrasada ? 'atr' : '') + '"><div class="dg-card-t" data-dg="fixaficha" data-id="' + escapeHtml(f.id) + '"><b>' + escapeHtml(f.titulo || '') + '</b><small>' + escapeHtml(dgFixaVence(f) + ' · ' + (DG_REPETE.filter(function(r){ return r[0] === f.repete; })[0] || DG_REPETE[0])[1] + (f.valor ? ' · ' + fmtMoeda(Number(f.valor)) : '')) + '</small></div>' +
      '<div class="dg-card-l">' + (pr ? '<span class="dg-dias ' + (pr.atrasada ? 'atr' : 'ok') + '">' + (pr.atrasada ? 'venceu ' : 'próxima ') + escapeHtml(fmtData(pr.data).slice(0, 5)) + '</span>' : '<span class="dg-dias ok">quitada</span>') + (f.resp ? '<span class="mut">· ' + escapeHtml(dgCurto(f.resp)) + '</span>' : '') + '</div>' +
      '<div class="dg-card-l">' + (pr ? '<button type="button" class="dg-bt ok" data-dg="fixapaga" data-id="' + escapeHtml(f.id) + '" data-c="' + escapeHtml(pr.c) + '">' + ico('check', 14) + ' Paga</button>' : '') + '<button type="button" class="dg-bt" data-dg="fixaficha" data-id="' + escapeHtml(f.id) + '">Editar</button></div></div>';
  }).join('') + '</div>';
  return h;
}
function dgAbrirFichaFixa(id){
  var ov = sgMontar('overlayDg', 'Tarefa delegada'), novo = id === 'novo', f = novo ? dgFixaVazia() : (dgDoc(id) || null); if (!f) return;
  dgS.ficha = novo ? 'novofixa' : id; ov.querySelector('h2').textContent = novo ? 'Nova conta' : 'Conta do escritório';
  var pess = dgPessoas(), fld = function(rot, html, i){ return '<div class="field"><label class="field-label" for="dgf_' + i + '">' + rot + '</label>' + html + '</div>'; };
  var h = fSec('Conta', fld('Conta *', '<input type="text" id="dgf_titulo" maxlength="120" value="' + escapeHtml(f.titulo || '') + '" placeholder="Ex.: Aluguel, internet, anuidade">', 'titulo') + fld('Valor (opcional)', '<input type="text" id="dgf_valor" inputmode="decimal" value="' + escapeHtml(f.valor === '' || f.valor == null ? '' : String(f.valor).replace('.', ',')) + '" placeholder="R$">', 'valor') +
      fld('Repete', '<select id="dgf_repete">' + DG_REPETE.map(function(r){ return dgOpt(r[1], r[0], f.repete === r[0]); }).join('') + '</select>', 'repete') +
      '<div id="dgf_w_dia">' + fld('Dia do mês', '<select id="dgf_dia">' + Array.apply(null, Array(31)).map(function(_, i){ return dgOpt('dia ' + (i + 1), String(i + 1), Number(f.dia) === i + 1); }).join('') + '</select>', 'dia') + '</div>' +
      '<div id="dgf_w_dow">' + fld('Dia da semana', '<select id="dgf_dow">' + DG_DOW.map(function(x, i){ return dgOpt(x, String(i), Number(f.dow) === i); }).join('') + '</select>', 'dow') + '</div>' +
      '<div id="dgf_w_data">' + fld('Data', '<input type="date" id="dgf_data" value="' + escapeHtml(f.data || '') + '">', 'data') + '</div>' +
      fld('Quem lembra', '<select id="dgf_resp">' + dgOpt('—', '', !f.resp) + pess.map(function(p){ return dgOpt(p.nome, p.k, p.k === f.resp); }).join('') + '</select>', 'resp') +
      fld('Avisar com antecedência', '<select id="dgf_avisar">' + DG_AVISAR.map(function(a){ return dgOpt(a[1], String(a[0]), Number(f.avisarDias) === a[0]); }).join('') + '</select>', 'avisar') + fld('Observações', '<textarea id="dgf_obs" rows="2" maxlength="500">' + escapeHtml(f.obs || '') + '</textarea>', 'obs'));
  h += '<div class="form-error" id="dgf_erro"></div><div class="f-rod-in">' + (novo ? '' : '<button type="button" class="btn btn-ghost" data-dgfa="excluir" id="dgf_exc">Excluir</button>') + '<button type="button" class="btn btn-ghost" data-dgfa="cancelar">Cancelar</button><button type="button" class="btn btn-primary" data-dgfa="salvarfixa">' + (novo ? 'Cadastrar' : 'Salvar') + '</button></div>';
  qs('overlayDgC').innerHTML = h; ov.classList.add('show');
  var ajusta = function(){ var r = qs('dgf_repete').value; qs('dgf_w_dia').style.display = r === 'mensal' ? '' : 'none'; qs('dgf_w_dow').style.display = r === 'semanal' ? '' : 'none'; qs('dgf_w_data').style.display = (r === 'anual' || r === 'unica') ? '' : 'none'; };
  qs('dgf_repete').addEventListener('change', ajusta); ajusta();
}
function dgSalvarFichaFixa(){
  var v = function(i){ var e = qs('dgf_' + i); return e ? e.value : ''; }, err = qs('dgf_erro');
  var p = { titulo: v('titulo').trim(), valor: dgValorNum(v('valor')), repete: v('repete') || 'mensal', dia: Number(v('dia')) || 10, dow: Number(v('dow')) || 0, data: v('data'), resp: v('resp'), avisarDias: Number(v('avisar')) || 0, obs: v('obs') };
  if (!p.titulo){ if (err) err.textContent = 'Digite o nome da conta.'; return; }
  if ((p.repete === 'anual' || p.repete === 'unica') && !p.data){ if (err) err.textContent = 'Escolha a data de vencimento.'; return; }
  if (dgS.ficha === 'novofixa'){
    var d = Object.assign({}, dgFixaVazia(), p, { criadoPor: esS.eu ? esS.eu.id : '', criadoEm: new Date().toISOString() });
    dgGravar(d).then(function(){ dgS.docs.push(d); qs('overlayDg').classList.remove('show'); dgRender(); toast('Conta cadastrada.'); try{ renderPainelAtencao(); }catch(e){} }).catch(function(e){ if (err) err.textContent = 'Não consegui cadastrar: ' + e.message; });
  } else dgSalvarCampos(dgS.ficha, p, false).then(function(){ qs('overlayDg').classList.remove('show'); try{ renderPainelAtencao(); }catch(e){} });
}

/* ---------- ficha (celular e "abrir a ficha completa") ---------- */
function dgOpt(l, v, sel){ return '<option value="' + escapeHtml(v) + '"' + (sel ? ' selected' : '') + '>' + escapeHtml(l) + '</option>'; }
function dgAbrirFicha(id, forcaFixa){
  var ovI = id === 'fixa-nova' || forcaFixa === true; if (id === 'fixa-nova') id = 'novo'; var ov = sgMontar('overlayDg', 'Tarefa delegada'), novo = id === 'novo' || !id, d = novo ? Object.assign({}, dgNovoVazio(), dgS.novo ? { titulo: '' } : {}) : (dgDoc(id) || null); if (!d) return;
  dgS.ficha = novo ? 'novo' : id; dgS.fichaBase = novo ? null : JSON.parse(JSON.stringify(d)); ov.querySelector('h2').textContent = 'Tarefa delegada';
  var pess = dgPessoas(), selP = function(campo, val){ return '<select id="dgf_' + campo + '">' + dgOpt(campo === 'resp' ? 'escolher' : '—', '', !val) + pess.map(function(p){ return dgOpt(p.nome + (p.tipo === 'est' ? ' (estagiário)' : (p.tipo === 'sem' ? ' (sem acesso)' : '')), p.k, p.k === val); }).join('') + '</select>'; };
  var fld = function(rot, html, f){ return '<div class="field"><label class="field-label" for="dgf_' + f + '">' + rot + '</label>' + html + '</div>'; };
  var h = fSec('Tarefa', fld('Tarefa *', '<textarea id="dgf_titulo" rows="2" maxlength="200" placeholder="O que precisa ser feito">' + escapeHtml(d.titulo || '') + '</textarea>', 'titulo') +
      fld('Responsável', selP('resp', d.resp), 'resp') + '<div id="dgf_w_fatal">' + fld('Prazo fatal', '<div class="dg-fatal"><input type="date" id="dgf_fatal" value="' + escapeHtml(d.fatal || '') + '"><button type="button" class="dg-bt" data-dg="contar" data-id="ficha">' + ico('calendar-days', 14) + ' Contar</button></div>', 'fatal') + '</div>' +
      fld('Prioridade', '<select id="dgf_prioridade">' + DG_PRIO.map(function(p){ return dgOpt(p[0], p[0], d.prioridade === p[0]); }).join('') + '</select>', 'prioridade') +
      '<div class="field"><label class="ad-it" style="border:0;padding:6px 0"><input type="checkbox" id="dgf_fixa"' + (d.fixa ? ' checked' : '') + '><span class="ad-t"><span class="dg-pin">' + dgPin(14) + '</span> <b>Tarefa fixa</b> <small class="saldo-data">se repete sozinha e fica nas primeiras linhas</small></span></label>' +
      '<div id="dgf_w_fx"><div class="field"><label class="field-label" for="dgf_repete">Repete</label><select id="dgf_repete">' + DG_REPETE_T.map(function(r){ return dgOpt(r[1], r[0], (d.repete || 'semanal') === r[0]); }).join('') + '</select></div>' +
      '<div class="field" id="dgf_w_dow"><label class="field-label" for="dgf_dow">Dia da semana</label><select id="dgf_dow">' + DG_DOW.map(function(x, i){ return dgOpt(x, String(i), Number(d.dow == null ? 1 : d.dow) === i); }).join('') + '</select></div>' +
      '<div class="field" id="dgf_w_dia"><label class="field-label" for="dgf_dia">Dia do mês</label><select id="dgf_dia">' + Array.apply(null, Array(31)).map(function(_, i){ return dgOpt('dia ' + (i + 1), String(i + 1), Number(d.dia || 1) === i + 1); }).join('') + '</select></div>' +
      '<div class="saldo-data">Se não for feita até o dia, fica <b>atrasada</b>. “Feita” vale por semana, mês ou dia, e a tarefa volta sozinha no próximo ciclo.</div></div></div>');
  h += fMais('cliente · processo · delegado por · status · trabalhar até · observações',
    fld('Cliente', '<input type="text" id="dgf_cliente" list="dgf_clis" value="' + escapeHtml(d.cliente || '') + '" autocomplete="off" placeholder="escolha ou digite"><datalist id="dgf_clis">' + clientes.filter(function(c){ return !c.arquivado; }).map(function(c){ return '<option value="' + escapeHtml(c.nome) + '">'; }).join('') + '</datalist>', 'cliente') +
    fld('Processo', '<input type="text" id="dgf_processo" list="dgf_procs" value="' + escapeHtml(d.processo || '') + '" autocomplete="off" placeholder="escolha ou digite o número"><datalist id="dgf_procs">' + prDocs.filter(function(p){ return !p.arquivado; }).map(function(p){ return '<option value="' + escapeHtml(p.numero) + '">' + escapeHtml(p.partes || '') + '</option>'; }).join('') + '</datalist>', 'processo') +
    fld('Delegado por', selP('delegadoPor', d.delegadoPor), 'delegadoPor') +
    fld('Status', '<select id="dgf_status">' + DG_STATUS.map(function(s){ return dgOpt(s[1], s[0], d.status === s[0]); }).join('') + '</select>', 'status') +
    fld('Trabalhar até', '<input type="date" id="dgf_trabalhar" value="' + escapeHtml(d.trabalhar || '') + '">', 'trabalhar') +
    fld('Observações', '<textarea id="dgf_obs" rows="3" maxlength="2000">' + escapeHtml(d.obs || '') + '</textarea>', 'obs'));
  h += '<div class="form-error" id="dgf_erro"></div><div class="f-rod-in">' + (novo ? '' : '<button type="button" class="btn btn-ghost" data-dgfa="excluir" id="dgf_exc">Excluir</button>') + '<button type="button" class="btn btn-ghost" data-dgfa="cancelar">Cancelar</button><button type="button" class="btn btn-primary" data-dgfa="salvar">' + (novo ? 'Lançar' : 'Salvar') + '</button></div>';
  qs('overlayDgC').innerHTML = h; ov.classList.add('show'); try{ fichaMaisEm(qs('overlayDgC')); }catch(e){}
  var ajFx = function(){ var f = qs('dgf_fixa').checked, r = qs('dgf_repete').value; qs('dgf_w_fx').style.display = f ? '' : 'none'; qs('dgf_w_dow').style.display = r === 'semanal' ? '' : 'none'; qs('dgf_w_dia').style.display = r === 'mensal' ? '' : 'none'; qs('dgf_w_fatal').style.display = f ? 'none' : ''; };
  qs('dgf_fixa').addEventListener('change', ajFx); qs('dgf_repete').addEventListener('change', ajFx); ajFx();
  if (ovI){ qs('dgf_fixa').checked = true; ajFx(); }
  if (novo){ var t = qs('dgf_titulo'); if (t) t.focus(); }
}
function dgLerFicha(){
  var v = function(i){ var e = qs('dgf_' + i); return e ? e.value : ''; }, cli = v('cliente').trim(), proc = v('processo').trim();
  var c = clientes.filter(function(x){ return normNome(x.nome) === normNome(cli); })[0], dc = (!cli && proc) ? dgClienteDoProcesso(proc) : { id: '', nome: '' };
  return { titulo: v('titulo').trim(), resp: v('resp'), fatal: v('fatal'), prioridade: v('prioridade') || 'Média', cliente: c ? c.nome : (cli || dc.nome), clienteId: c ? c.id : dc.id, processo: proc, delegadoPor: v('delegadoPor'), status: v('status') || 'afazer', trabalhar: v('trabalhar'), obs: v('obs'), fixa: !!(qs('dgf_fixa') && qs('dgf_fixa').checked), repete: v('repete') || 'semanal', dow: Number(v('dow')) || 0, dia: Number(v('dia')) || 1 };
}
function dgSalvarFicha(){
  var p = dgLerFicha(), err = qs('dgf_erro'); if (!p.titulo){ if (err) err.textContent = 'Digite a tarefa.'; return; }
  var antes = dgS.ficha === 'novo' ? null : dgDoc(dgS.ficha);
  if (p.fixa){ p.fatal = ''; p.trabalhar = ''; p.status = 'afazer'; if (!antes || !antes.fixa){ p.fixaDesde = agHoje(); p.feitas = {}; } }
  if (dgS.ficha === 'novo'){
    var d = Object.assign({}, p, { resp: p.resp || dgMe(), delegadoPor: p.delegadoPor || dgMe(), criadoPor: esS.eu ? esS.eu.id : '', criadoEm: new Date().toISOString() });
    if (dgFeita(d)){ d.concluidoEm = agHoje(); d.concluidoPor = dgMe(); }
    dgGravar(d).then(function(){ dgS.docs.push(d); qs('overlayDg').classList.remove('show'); dgRender(); toast('Tarefa lançada' + (d.resp ? ' · ' + dgCurto(d.resp) : '') + '.'); }).catch(function(e){ if (err) err.textContent = 'Não consegui lançar: ' + e.message; });
  } else {
    var base0 = dgS.fichaBase || antes || {}, so = {}; Object.keys(p).forEach(function(k){ if (JSON.stringify(p[k]) !== JSON.stringify(base0[k] === undefined ? (typeof p[k] === 'boolean' ? false : '') : base0[k])) so[k] = p[k]; });   /* só o que mudou: não sobrescreve o que outra pessoa alterou enquanto a ficha estava aberta */
    if (!Object.keys(so).length){ qs('overlayDg').classList.remove('show'); return; }
    dgSalvarCampos(dgS.ficha, so, false).then(function(){ qs('overlayDg').classList.remove('show'); });
  }
}

/* ---------- eventos ---------- */
function dgIniciar(){
  var w = qs('dgWrap'); if (!w || w.getAttribute('data-ok')) return; w.setAttribute('data-ok', '1');
  w.addEventListener('click', function(e){
    var b = e.target.closest ? e.target.closest('[data-dg]') : null; if (!b) return;
    var a = b.getAttribute('data-dg'), id = b.getAttribute('data-id'), v = b.getAttribute('data-v');
    if (a === 'dd'){ e.stopPropagation(); if (dgS.dd && dgS.dd.campo === b.getAttribute('data-c') && dgS.dd.id === id){ dgFecharDD(); return; } dgLerNovo(); dgAbrirDD(b, b.getAttribute('data-c'), id); }
    else if (a === 'aba'){ dgS.aba = v; dgRender(); }
    else if (a === 'fpessoa'){ dgS.fPessoa = v; dgRender(); }
    else if (a === 'fatr'){ dgS.soAtr = !dgS.soAtr; dgRender(); }
    else if (a === 'copiar') agdCopiarNumero(b.getAttribute('data-n'));
    else if (a === 'contar') dgContar(id);
    else if (a === 'novafixa'){ dgLerNovo(); dgS.novo.fixa = !dgS.novo.fixa; dgRender(); }
    else if (a === 'tfixafeita') dgTFixaFeita(id);
    else if (a === 'tornarfixa') dgAbrirFicha(id, true);
    else if (a === 'convlista') dgAbrirConversao();
    else if (a === 'salvarnovo') dgSalvarNovo();
    else if (a === 'salvarfixa') dgSalvarNovaFixa();
    else if (a === 'fixaficha') dgAbrirFichaFixa(id);
    else if (a === 'fixapaga') dgFixaPagar(id, b.getAttribute('data-c'));
    else if (a === 'ficha') dgAbrirFicha(id);
    else if (a === 'fichanova') dgAbrirFicha('novo');
    else if (a === 'concluir') dgSalvarCampos(id, { status: 'concluida' }, true);
    else if (a === 'reabrir') dgSalvarCampos(id, { status: 'afazer' }, true);
    else if (a === 'status'){ dgLerNovo(); dgAbrirDD(b, 'status', id); }
    else if (a === 'recarregar'){ dgS.erro = ''; dgS.ok = false; dgRender(); }
  });
  w.addEventListener('change', function(e){
    var t = e.target; if (!t || !t.getAttribute) return;
    if (t.getAttribute('data-dgt')) { var id = t.getAttribute('data-dgt'), d = dgDoc(id), nv = t.value.trim(); if (d && nv && nv !== d.titulo) dgSalvarCampos(id, { titulo: nv }, false, { semRender: true }); else if (d && !nv) t.value = d.titulo || ''; }
    else if (t.getAttribute('data-dgv')){ var idv = t.getAttribute('data-dgv'), dv = dgDoc(idv); if (dv){ var nvv = dgValorNum(t.value); dgSalvarCampos(idv, { valor: nvv }, false, { semRender: true }); } }
    else if (t.getAttribute('data-dgdt')) dgAplicar(t.getAttribute('data-id'), (function(o){ o[t.getAttribute('data-dgdt')] = t.value; return o; })({}), false);
    else if (t.getAttribute('data-dgf') === 'status'){ dgS.fStatus = t.value; dgRender(); }
    else if (t.getAttribute('data-dgf') === 'prio'){ dgS.fPrio = t.value; dgRender(); }
  });
  w.addEventListener('keydown', function(e){
    if (e.target && e.target.id === 'dg_n_titulo'){
      if (e.key === 'Enter'){ e.preventDefault(); dgSalvarNovo(); }
      else if (e.key === 'Escape'){ dgS.novo = dgNovoVazio(); e.target.value = ''; dgRender(); var t = qs('dg_n_titulo'); if (t) t.focus(); }
    } else if (e.target && (e.target.id === 'dg_f_titulo' || e.target.id === 'dg_f_valor')){
      if (e.key === 'Enter'){ e.preventDefault(); dgSalvarNovaFixa(); }
    } else if (e.target && e.target.getAttribute && (e.target.getAttribute('data-dgt') || e.target.getAttribute('data-dgv')) && e.key === 'Enter'){ e.target.blur(); }
  });
  /* setinha: escolher, buscar e fechar */
  document.addEventListener('click', function(e){
    var pop = qs('dgDD'); if (!pop) return;
    var i = e.target.closest ? e.target.closest('[data-dgd]') : null;
    if (i && pop.contains(i)){
      var k = i.getAttribute('data-dgd'), S = dgS.dd; if (!S) return;
      if (k === 'livre') dgEscolher(S.q.trim(), 'livre');
      else if (k === 'limpar') dgEscolher('', 'limpar');
      else dgEscolher(S.vis[Number(k)].v, false);
      return;
    }
    if (!pop.contains(e.target) && !(e.target.closest && e.target.closest('[data-dg="dd"]'))) dgFecharDD();
  });
  document.addEventListener('input', function(e){ var t = e.target; if (t && t.classList && t.classList.contains('dg-dd-q') && dgS.dd){ dgS.dd.q = t.value; dgDesenharDD(); } });
  document.addEventListener('keydown', function(e){
    if (!dgS.dd) return;
    if (e.key === 'Escape'){ dgFecharDD(); return; }
    if (e.key === 'Enter' && e.target && e.target.classList && e.target.classList.contains('dg-dd-q')){ e.preventDefault(); var S = dgS.dd; if (S.vis && S.vis.length) dgEscolher(S.vis[0].v, false); else if (S.o.livre && S.q.trim()) dgEscolher(S.q.trim(), 'livre'); }
  });
  window.addEventListener('resize', dgFecharDD);
  document.addEventListener('click', function(e){ var b = e.target.closest ? e.target.closest('[data-dgcv]') : null; if (!b) return; var a = b.getAttribute('data-dgcv'); if (a === 'cancelar') qs('overlayDgConv').classList.remove('show'); else if (a === 'converter') dgConverter(); });
  document.addEventListener('change', function(e){ var t = e.target; if (!t || !t.getAttribute || t.getAttribute('data-cv') !== 'rep') return; var ln = t.closest('.dg-conv'); ln.querySelector('[data-cv="dow"]').style.display = t.value === 'semanal' ? '' : 'none'; ln.querySelector('[data-cv="dia"]').style.display = t.value === 'mensal' ? '' : 'none'; });
  var ov = null;
  document.addEventListener('click', function(e){
    var b = e.target.closest ? e.target.closest('[data-dgfa]') : null; if (!b) return;
    var a = b.getAttribute('data-dgfa');
    if (a === 'cancelar') qs('overlayDg').classList.remove('show');
    else if (a === 'salvar') dgSalvarFicha();
    else if (a === 'salvarfixa') dgSalvarFichaFixa();
    else if (a === 'excluir'){
      if (b.getAttribute('data-sure') !== '1'){ b.setAttribute('data-sure', '1'); b.textContent = 'Confirmar exclusão'; return; }
      var id = dgS.ficha; pbApi('/api/db/delegadas/' + encodeURIComponent(id), 'DELETE').then(function(){ dgS.docs = dgS.docs.filter(function(x){ return x.id !== id; }); qs('overlayDg').classList.remove('show'); dgRender(); toast('Tarefa excluída (a Lixeira guarda por 30 dias).'); }).catch(function(er){ toast('Não consegui excluir: ' + er.message); });
    }
  });
  /* a tabela é de todos: atualiza sozinha enquanto a tela está aberta (sem mexer se alguém está digitando) */
  if (!dgS.tick) dgS.tick = setInterval(function(){
    if (document.visibilityState === 'hidden' || activeTab !== 'delegadas' || dgS.dd || (qs('overlayDg') && qs('overlayDg').classList.contains('show'))) return;
    var f = document.activeElement; if (f && f.closest && f.closest('#dgWrap') && /INPUT|TEXTAREA|SELECT/.test(f.tagName) && (f.value || f.id !== 'dg_n_titulo')) return;
    dgCarregar(true);
  }, 20000);
}
function dgAbrir(){ dgIniciar(); dgRender(); if (dgS.ok) dgCarregar(true); }

/* ---------- estilo ---------- */
function dgCss(){
  if (document.getElementById('dgCss')) return;
  var st = document.createElement('style'); st.id = 'dgCss';
  st.textContent = '.dg-abas{display:flex;gap:6px;margin:4px 0 10px;flex-wrap:wrap}.dg-aba{border:0;background:var(--surface-2);color:var(--ink-soft);border-radius:99px;padding:8px 14px;min-height:40px;font:inherit;font-weight:700;cursor:pointer}.dg-aba.on{background:var(--ink);color:var(--bg)}' +
    '.dg-fil{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:0 0 10px}.dg-chip{border:1px solid var(--border);background:var(--surface);border-radius:99px;padding:6px 12px;min-height:36px;font:inherit;font-size:var(--t2);cursor:pointer;color:var(--ink)}.dg-chip.on{background:rgba(201,133,0,.12);border-color:var(--accent);color:var(--accent);font-weight:700}' +
    '.dg-fs{border:1px solid var(--border);border-radius:99px;background:var(--surface);padding:6px 10px;min-height:36px;font:inherit;font-size:var(--t2);color:var(--ink)}.dg-mobnovo{margin-left:auto}' +
    '.dg-tw{overflow-x:auto;background:var(--surface);border-radius:16px;box-shadow:0 1px 3px rgba(0,0,0,.06)}.dg-t{border-collapse:collapse;width:100%;font-size:var(--t2);min-width:1040px}.dg-t th{text-align:left;color:var(--ink-soft);font-size:var(--t1);text-transform:uppercase;letter-spacing:.04em;padding:8px 8px;border-bottom:1px solid var(--border);background:var(--surface-2);white-space:nowrap}.dg-t td{padding:6px 6px;border-bottom:1px solid var(--border);vertical-align:middle}' +
    '.dg-novo td{background:rgba(201,133,0,.07);border-bottom:2px solid var(--accent)}.dg-p{min-width:0}.dg-n{text-align:center;font-variant-numeric:tabular-nums}.dg-n.z{color:var(--ink-soft)}.dg-n.atr{color:var(--urgente);font-weight:800}' +
    '.dg-sel{display:flex;justify-content:space-between;align-items:center;gap:6px;width:100%;min-height:36px;border:1.5px solid var(--border);border-radius:9px;background:var(--surface);color:var(--ink);padding:4px 8px;font:inherit;font-size:var(--t2);text-align:left;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dg-sel i{font-style:normal;color:var(--ink-soft);font-size:10px;flex:none}.dg-sel.vazio{color:var(--ink-soft)}.dg-sel:hover{border-color:var(--accent)}' +
    '.dg-in,.dg-dt{width:100%;min-height:36px;border:1.5px solid var(--border);border-radius:9px;background:var(--surface);color:var(--ink);padding:4px 8px;font:inherit;font-size:var(--t2)}.dg-t .dg-in{min-width:220px}.dg-t .dg-dt{min-width:128px}.dg-t .dg-t{border-color:transparent;background:transparent}.dg-t .dg-t:hover,.dg-t .dg-t:focus{border-color:var(--accent);background:var(--surface)}' +
    '.dg-st{display:inline-block;border-radius:99px;padding:2px 10px;font-size:var(--t1);font-weight:700}.dg-st.s1{background:var(--surface-2);color:var(--ink-soft)}.dg-st.s2{background:rgba(42,120,214,.14);color:#2A78D6}.dg-st.s3{background:rgba(201,133,0,.16);color:#8a5a00}.dg-st.s4{background:rgba(139,92,246,.15);color:#6d44c9}.dg-st.s5{background:rgba(23,137,90,.14);color:#17895A}' +
    '.dg-pr{font-weight:800}.dg-pr.alta{color:var(--urgente)}.dg-pr.media{color:#C98500}.dg-pr.baixa{color:#17895A}.dg-pess{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}.dg-acao{white-space:nowrap;text-align:right}.dg-dias{font-size:var(--t1);font-weight:800;margin-right:4px}.dg-dias.atr{color:var(--urgente)}.dg-dias.brv{color:#C98500}.dg-dias.ok{color:#17895A}' +
    '.dg-mini{border:1px solid var(--border);background:var(--surface);border-radius:8px;min-width:36px;min-height:36px;cursor:pointer;color:var(--ink-soft);display:inline-grid;place-items:center}.dg-mini.ok{color:#17895A}.dg-mini:hover{border-color:var(--accent)}.dg-ok{min-height:36px;padding:0 14px}.dg-dica{margin:8px 4px 0}' +
    '.dg-dd{position:fixed;z-index:9000;background:var(--surface);border:1px solid var(--border);border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,.22);padding:6px;max-height:320px;display:flex;flex-direction:column}.dg-dd-q{width:100%;min-height:36px;border:1.5px solid var(--border);border-radius:8px;padding:4px 8px;font:inherit;font-size:var(--t2);background:var(--surface);color:var(--ink);margin-bottom:4px}.dg-dd-l{overflow-y:auto}' +
    '.dg-dd-i{display:flex;align-items:center;flex-wrap:wrap;gap:6px;width:100%;text-align:left;border:0;background:transparent;border-radius:8px;padding:8px;min-height:38px;font:inherit;font-size:var(--t2);color:var(--ink);cursor:pointer}.dg-dd-i:hover{background:var(--surface-2)}.dg-dd-i small{flex-basis:100%;color:var(--ink-soft);font-size:var(--t1)}.dg-dd-liv{color:var(--accent);font-weight:700}.dg-dd-v{padding:10px;color:var(--ink-soft)}' +
    '.dg-mob{display:none}.dg-sec{font-size:var(--t1);font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-soft);margin:12px 4px 6px}.dg-sec.atr{color:var(--urgente)}.dg-card{background:var(--surface);border:1px solid var(--border);border-left:4px solid #C98500;border-radius:14px;padding:10px 12px;margin-bottom:8px}.dg-card.atr{border-left-color:var(--urgente)}' +
    '.dg-card-t{cursor:pointer}.dg-card-t b{display:block;font-size:var(--t3,15px)}.dg-card-t small{color:var(--ink-soft);font-size:var(--t1)}.dg-card-l{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px;font-size:var(--t2)}.dg-bt{border:1px solid var(--border);background:var(--surface);border-radius:99px;padding:6px 12px;min-height:36px;font:inherit;font-size:var(--t2);font-weight:600;color:var(--ink);cursor:pointer;display:inline-flex;align-items:center;gap:4px}.dg-bt.ok{background:#17895A;border-color:#17895A;color:#fff}' +
    '.dg-ta th:first-child,.dg-ta td:first-child{width:118px;max-width:118px}.dg-ta td:first-child .dg-sel{max-width:118px}.dg-ta td:nth-child(3){width:34%}.dg-ta td:nth-child(3) .dg-in{min-width:340px}.dg-ta{min-width:1180px}' +
    '.dg-fx td{background:rgba(201,133,0,.07)}.dg-pin{color:#C98500;display:inline-flex;vertical-align:middle;flex:none}.dg-pinbtn{border:1.5px solid var(--border);background:var(--surface);color:var(--ink-soft);border-radius:9px;min-width:38px;min-height:36px;cursor:pointer;display:inline-grid;place-items:center;flex:none}.dg-pinbtn.on{border-color:var(--accent);background:rgba(201,133,0,.14);color:var(--accent)}.dg-rep{font-size:var(--t2);color:var(--ink-soft);white-space:nowrap}.dg-stbtn{border:0;cursor:pointer;font:inherit;font-size:var(--t1);font-weight:700;min-height:30px}.dg-st.atr{background:rgba(217,59,59,.14);color:var(--urgente)}.dg-cfx{background:rgba(201,133,0,.06)}.dg-conv{border-top:1px solid var(--border);padding:8px 0}.dg-conv-l{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px}.dg-conv-l select{min-height:38px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--ink);padding:4px 8px;font:inherit}.dg-conv-av{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:10px}' +
    '.dg-fatal{display:flex;gap:6px;align-items:center}.dg-fatal .dg-dt{flex:1}.dg-mobnovo{display:none}@media(max-width:820px){.dg-desk{display:none}.dg-mob{display:block}.dg-mobnovo{display:inline-flex}.dg-fil .dg-fs{flex:1}}';
  document.head.appendChild(st);
}
/* a tarefa fixa pendente na Central de atenção: tocar marca como feita (sem abrir a aba Delegadas) */
document.addEventListener('click', function(e){ var c = e.target.closest ? e.target.closest('[data-tfixa-feita]') : null; if (c) dgTFixaFeita(c.getAttribute('data-tfixa-feita')); });
/* a conta na Central de atenção funciona sem abrir a aba Delegadas */
document.addEventListener('click', function(e){ var c = e.target.closest ? e.target.closest('[data-fixa-pagar]') : null; if (!c) return; var pr = c.getAttribute('data-fixa-pagar').split('|'); dgFixaPagar(pr[0], pr.slice(1).join('|')); });
(function(){ window.__horusTeste = Object.assign(window.__horusTeste || {}, { dgS: dgS, dgAbrir: dgAbrir, dgDias: dgDias, dgOcorrencias: dgOcorrencias, dgFixaProxima: dgFixaProxima, ppItemAtencaoOk: ppItemAtencaoOk, dgTFixaEstado: dgTFixaEstado, dgTFixasAtencao: dgTFixasAtencao, dgTFixaFeita: dgTFixaFeita, dgCandidatasFixa: dgCandidatasFixa }); })();
