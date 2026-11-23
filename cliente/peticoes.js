/* ============================================================
   PETIÇÃO PARA CORREÇÃO/REVISÃO (prefixo pt) — aba Iniciais
   Quem fez a Inicial envia a petição (.docx ou .pdf, até 25 MB) e ESCOLHE quem revisa. O revisor comenta (nível 1: comentários por escrito)
   e devolve ou aprova. Devolvida, a Inicial volta para quem a fez; corrigida, é reenviada ao mesmo revisor ou a outro.
   Aprovada, vai para "Aguardando protocolo": o advogado protocola ou delega o protocolo. Ao protocolar, só a versão final fica guardada.
   Os arquivos ficam no R2 e o estado no servidor (rotas /api/peticoes); aqui só a tela.
   ============================================================ */
var PT_MAX = 25 * 1024 * 1024;
var ptS = { itens: [], uso: null, sig: '', em: 0, revisores: null, casoId: null, enviando: false, nota: '' };
var PT_ROTULO = { a_corrigir: 'Com o revisor', devolvida: 'Devolvida para ajustes', aprovada: 'Aprovada', protocolada: 'Protocolada' };
function ptEu(){ return (typeof esS !== 'undefined' && esS.eu) || window.__horusEu || {}; }
function ptDoCaso(id){
  var l = ptS.itens.filter(function(p){ return p.casoId === id; });
  return l.filter(function(p){ return p.estado !== 'protocolada'; })[0] || l[0] || null;
}
function ptPrimeiro(n){ return String(n || '').split(/\s+/)[0]; }
function ptTam(b){ return b >= 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; }
function ptDataHora(iso){ var d = new Date(iso); if (isNaN(d)) return ''; return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
function ptCarregar(){
  if (!window.__SERVIDOR) return Promise.resolve();
  return esJson('/api/peticoes').then(function(j){
    var sig = JSON.stringify(j.itens.map(function(p){ return [p.id, p.estado, p.atualizadoEm, p.versoes.length, p.comentarios.length]; })) + (j.uso ? j.uso.nivel + j.uso.pct : '');
    ptS.uso = j.uso; ptS.em = Date.now();
    if (sig === ptS.sig) return;
    ptS.sig = sig; ptS.itens = j.itens;
    /* o servidor muda o estágio da Inicial e cria as colunas novas: relê as Iniciais e, se preciso, a personalização */
    ptRelerCasos(j.itens.length && !STATUS_LABEL['a_corrigir']);
    try{ renderKanbanPeticoes(); }catch(e){}
    try{ renderPainelAtencao(); }catch(e){}
    if (ptS.casoId && qs('overlayPet') && qs('overlayPet').classList.contains('show')) ptDesenhar();
  }).catch(function(){});
}
function ptRelerCasos(comConfig){
  try{
    if (window.__horusDb){ var p = [window.__horusDb.recarregar('casos')]; if (comConfig) p.push(window.__horusDb.recarregar('config')); return Promise.all(p).catch(function(){}); }
  }catch(e){}
  return Promise.resolve();
}
/* ---------- cartão do quadro ---------- */
function ptChip(c){
  var p = ptDoCaso(c.id); if (!p) return '';
  var t = p.estado === 'a_corrigir' ? 'Petição com ' + ptPrimeiro(p.revisor.nome) : (p.estado === 'devolvida' ? 'Petição devolvida · v' + p.versoes[p.versoes.length - 1].n : (p.estado === 'aprovada' ? 'Petição aprovada · v' + p.versoes[p.versoes.length - 1].n : 'Petição guardada'));
  return '<div class="kc-chips"><button type="button" class="pt-chip pt-e-' + p.estado + '" data-pt-abrir="' + escapeHtml(c.id) + '">' + escapeHtml(t) + '</button></div>';
}
var ptCardOrig = cardKanbanPeticao;
cardKanbanPeticao = function(c){
  var h = ptCardOrig(c), chip = ptChip(c);
  if (chip) h = h.replace('<div class="kc-valor">', chip + '<div class="kc-valor">');
  return h.replace('<button type="button" data-p-abrir="' + c.id + '">Abrir</button>', '<button type="button" data-p-abrir="' + c.id + '">Abrir</button><button type="button" data-pt-abrir="' + c.id + '">Petição para revisão…</button>');
};
/* ---------- Central de atenção ---------- */
function ptAtencao(){
  var eu = ptEu(), l = [];
  ptS.itens.forEach(function(p){
    var meu = eu.id && ((p.estado === 'a_corrigir' && p.revisor.id === eu.id) || ((p.estado === 'devolvida' || p.estado === 'aprovada') && p.criadoPor.id === eu.id));
    if (meu) l.push(p);
  });
  return l;
}
function ptCentralChip(p){
  var t = p.estado === 'a_corrigir' ? 'Revisar' : (p.estado === 'devolvida' ? 'Ajustar' : 'Protocolar');
  var q = p.comentarios.filter(function(c){ return c.v === p.versoes[p.versoes.length - 1].n && c.papel === 'revisor'; }).length;
  var sub = p.estado === 'a_corrigir' ? ptPrimeiro(p.criadoPor.nome) + ' enviou a v' + p.versoes[p.versoes.length - 1].n : (p.estado === 'devolvida' ? q + (q === 1 ? ' comentário' : ' comentários') + ' de ' + ptPrimeiro(p.revisor.nome) : 'aprovada por ' + ptPrimeiro(p.revisor.nome) + ': protocole ou delegue');
  return '<div class="stall-chip pt-central" data-pt-abrir="' + escapeHtml(p.casoId) + '">' + upData(String(p.atualizadoEm).slice(0, 10), '') +
    '<div class="up-top"><span>Petição de ' + escapeHtml(p.cliente || 'Sem nome') + ' <span class="est est-breve">' + t + '</span></span></div>' +
    '<div class="up-when">' + escapeHtml(sub) + (p.prazo ? ' · prazo ' + fmtData(p.prazo) : '') + ' · toque para abrir</div></div>';
}
function ptUsoAlerta(){
  var u = ptS.uso; if (!u || u.nivel === 'ok' || !(typeof ppDono === 'function' && ppDono())) return null;
  return u;
}
function ptUsoChip(u){
  var r = u.nivel === 'bloqueado' ? 'Novos envios bloqueados' : (u.nivel === 'critico' ? 'Quase no limite' : 'Aproximando-se do limite');
  return '<div class="stall-chip pt-central pt-alerta ' + (u.nivel === 'atencao' ? 'pt-a-ouro' : 'pt-a-verm') + '" data-pt-uso="1"><div class="up-data"><b>' + Math.round(u.pct) + '%</b><span>do limite</span></div>' +
    '<div class="up-top"><span>Arquivos das petições: ' + r + '</span></div><div class="up-when">Limite gratuito do mês (' + (u.qual === 'armazenamento' ? 'espaço' : (u.qual === 'gravacoes' ? 'envios' : 'leituras')) + '). Toque para ver os detalhes.</div></div>';
}
/* ---------- folha da petição ---------- */
function ptRevisoresCarregar(){
  if (ptS.revisores) return Promise.resolve(ptS.revisores);
  return esJson('/api/peticoes/revisores').then(function(j){ ptS.revisores = j.revisores || []; return ptS.revisores; }).catch(function(){ return []; });
}
function ptSelRevisor(id, atual){
  var eu = ptEu();
  var l = (ptS.revisores || []).filter(function(r){ return r.id !== eu.id; });
  return '<select id="' + id + '" class="pt-in"><option value="">Escolha quem vai revisar…</option>' + l.map(function(r){ return '<option value="' + escapeHtml(r.id) + '"' + (r.id === atual ? ' selected' : '') + '>' + escapeHtml(r.nome) + (r.papel === 'proprietario' ? ' (proprietário)' : '') + '</option>'; }).join('') + '</select>';
}
function ptAbrir(casoId){
  ptS.casoId = casoId; ptS.nota = '';
  var ov = sgMontar('overlayPet', 'Petição para revisão');
  if (!ov.getAttribute('data-pt')){
    ov.setAttribute('data-pt', '1');
    ov.addEventListener('click', function(e){ var b = e.target.closest ? e.target.closest('[data-pta]') : null; if (b) ptAcao(b.getAttribute('data-pta'), b); });
    ov.addEventListener('change', function(e){ if (e.target && e.target.id === 'ptArq') ptArquivoEscolhido(); });
  }
  ov.classList.add('show');
  qs('overlayPetC').innerHTML = '<div class="pt-vazio">Carregando…</div>';
  Promise.all([ptCarregar(), ptRevisoresCarregar()]).then(function(){ ptDesenhar(); });
}
function ptArquivoEscolhido(){
  var f = qs('ptArq') && qs('ptArq').files[0], n = qs('ptArqNome'); if (!n) return;
  if (!f){ n.textContent = 'Nenhum arquivo escolhido (.docx ou .pdf, até 25 MB)'; return; }
  var ok = /\.(docx|pdf)$/i.test(f.name) && f.size <= PT_MAX;
  n.innerHTML = '<b>' + escapeHtml(f.name) + '</b> · ' + ptTam(f.size) + (ok ? '' : ' · <span class="pt-erro">' + (f.size > PT_MAX ? 'passa de 25 MB' : 'só .docx ou .pdf') + '</span>');
}
function ptVersoesHtml(p){
  return '<div class="pt-sec"><div class="pt-t">Versões</div>' + p.versoes.slice().reverse().map(function(v, i){
    return '<div class="pt-ver"><span class="pt-vn">v' + v.n + '</span><span class="pt-vt"><b>' + escapeHtml(v.nome) + '</b><small>' + escapeHtml(v.por.nome) + ' · ' + ptDataHora(v.em) + ' · ' + ptTam(v.tam) + '</small></span>' +
      '<a class="pt-baixar" href="/api/peticoes/' + p.id + '/arquivo?v=' + v.n + '" download>Baixar</a></div>';
  }).join('') + '</div>';
}
function ptComentariosHtml(p){
  var atual = p.versoes[p.versoes.length - 1].n;
  if (!p.comentarios.length) return '<div class="pt-sec"><div class="pt-t">Comentários</div><div class="pt-vazio">Nenhum comentário ainda.</div></div>';
  return '<div class="pt-sec"><div class="pt-t">Comentários (' + p.comentarios.length + ')</div>' + p.comentarios.map(function(c){
    return '<div class="pt-com pt-c-' + c.papel + '"><div class="pt-com-t">' + escapeHtml(c.texto) + '</div><div class="pt-com-m">' + escapeHtml(c.por.nome) + ' · ' + ptDataHora(c.em) + ' · v' + c.v + (c.v === atual ? '' : ' (versão anterior)') + '</div></div>';
  }).join('') + '</div>';
}
function ptHistoricoHtml(p){
  return '<details class="pt-sec pt-hist"><summary>Histórico (' + p.eventos.length + ')</summary>' + p.eventos.slice().reverse().map(function(e){ return '<div class="pt-ev"><span>' + ptDataHora(e.em) + '</span> ' + escapeHtml(e.por) + ': ' + escapeHtml(e.txt) + '</div>'; }).join('') + '</details>';
}
function ptEnvioHtml(p, rotulo, revAtual){
  return '<div class="pt-sec pt-envio"><div class="pt-t">' + rotulo + '</div>' +
    '<label class="pt-arq"><input type="file" id="ptArq" accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"><span class="pt-arq-b">Escolher arquivo</span><span id="ptArqNome" class="pt-arq-n">Nenhum arquivo escolhido (.docx ou .pdf, até 25 MB)</span></label>' +
    '<label class="pt-l">Quem vai revisar</label>' + ptSelRevisor('ptRev', revAtual || '') +
    '<label class="pt-l">Prazo (opcional)</label><input type="date" id="ptPrazo" class="pt-in" value="' + escapeHtml(p ? p.prazo || '' : '') + '">' +
    '<label class="pt-l">Recado (opcional)</label><textarea id="ptRecado" class="pt-in" rows="2" maxlength="500" placeholder="Ex.: conferir o pedido de tutela e o valor da causa."></textarea>' +
    '<button type="button" class="pt-bt pt-escuro" data-pta="enviar">' + (p ? 'Reenviar para revisão' : 'Enviar para revisão') + '</button></div>';
}
function ptDesenhar(){
  var c = qs('overlayPetC'); if (!c || !ptS.casoId) return;
  var caso = casos.filter(function(x){ return x.id === ptS.casoId; })[0] || {}, p = ptDoCaso(ptS.casoId), eu = ptEu(), u = ptS.uso;
  var topo = '<div class="pt-cab"><b>' + escapeHtml(caso.cliente || (p && p.cliente) || '') + '</b>' + (caso.nomeAcao ? ' · ' + escapeHtml(caso.nomeAcao) : '') + '</div>';
  var aviso = ptS.nota ? '<div class="pt-nota">' + escapeHtml(ptS.nota) + '</div>' : '';
  var trava = u && u.bloqueado ? '<div class="pt-nota pt-nota-verm">O limite gratuito de arquivos do mês foi atingido: novos envios estão bloqueados. Dá para baixar e comentar o que já está guardado. O proprietário pode liberar espaço apagando petições antigas.</div>' : '';
  var h = topo + aviso + trava;
  if (!p){
    h += '<div class="pt-sec"><div class="pt-t">Petição</div><div class="pt-vazio">Nenhum arquivo enviado ainda. Envie o Word ou o PDF; a pessoa que você escolher revisa e comenta, e a petição volta para você ajustar.</div></div>' + (u && u.bloqueado ? '' : ptEnvioHtml(null, 'Enviar para revisão', ''));
  } else {
    h += '<div class="pt-sec"><div class="pt-t">Petição · <span class="pt-chip pt-e-' + p.estado + '">' + PT_ROTULO[p.estado] + '</span></div>' +
      '<div class="pt-linha">Feita por <b>' + escapeHtml(p.criadoPor.nome) + '</b> · revisor <b>' + escapeHtml(p.revisor.nome) + '</b>' + (p.prazo ? ' · prazo ' + fmtData(p.prazo) : '') + '</div></div>';
    h += ptVersoesHtml(p) + ptComentariosHtml(p);
    if (p.estado === 'a_corrigir' && p.souRevisor){
      var q = p.comentarios.filter(function(x){ return x.papel === 'revisor' && x.v === p.versoes[p.versoes.length - 1].n; }).length;
      h += '<div class="pt-sec"><div class="pt-t">Sua revisão</div><textarea id="ptCom" class="pt-in" rows="3" maxlength="2000" placeholder="Escreva o comentário (um por vez)…"></textarea>' +
        '<button type="button" class="pt-bt" data-pta="comentar">Adicionar comentário</button>' +
        '<button type="button" class="pt-bt pt-ouro" data-pta="devolver">Devolver para ajustes' + (q ? ' · ' + q + (q === 1 ? ' comentário' : ' comentários') : '') + '</button>' +
        '<button type="button" class="pt-bt" data-pta="aprovar">Aprovar sem alterações</button></div>';
    }
    if (p.estado === 'a_corrigir' && p.souAutor && !p.souRevisor){
      h += '<div class="pt-sec"><div class="pt-t">Passar para outro revisor</div>' + ptSelRevisor('ptRev2', p.revisor.id) + '<button type="button" class="pt-bt" data-pta="reencaminhar">Passar a revisão</button></div>';
    }
    if (p.estado === 'devolvida' && p.souAutor){
      h += (u && u.bloqueado ? '' : ptEnvioHtml(p, 'Enviar a versão ajustada (v' + (p.versoes[p.versoes.length - 1].n + 1) + ')', p.revisor.id));
    }
    if (p.estado === 'aprovada'){
      h += '<div class="pt-sec"><div class="pt-t">Aprovada: protocolar</div><div class="pt-linha">Pede o número do processo, como já funciona hoje. Ao protocolar, só a versão final fica guardada.</div>' +
        '<button type="button" class="pt-bt pt-escuro" data-pta="protocolar">Protocolar agora</button><button type="button" class="pt-bt" data-pta="delegar">Delegar o protocolo…</button><div id="ptDelBox"></div></div>';
    }
    if (p.estado === 'protocolada') h += '<div class="pt-sec"><div class="pt-linha">Protocolada. A versão final fica guardada para consulta.</div></div>';
    h += ptHistoricoHtml(p);
    if (p.estado !== 'protocolada' && p.souAutor) h += '<div class="pt-sec"><button type="button" class="pt-bt pt-del" data-pta="apagar">Apagar esta petição</button></div>';
  }
  if (typeof ppDono === 'function' && ppDono() && u) h += '<div class="pt-rodape">Espaço usado: ' + ptTam(u.bytes) + ' de ' + ptTam(u.limiteBytes) + ' (' + u.pct + '%) · <button type="button" class="pt-link" data-pta="uso">detalhes</button></div>';
  c.innerHTML = h;
}
function ptRecarregarFolha(nota){ ptS.nota = nota || ''; ptS.sig = ''; return ptRelerCasos(true).then(ptCarregar).then(function(){ ptDesenhar(); }); }
function ptEnviar(p){
  var f = qs('ptArq') && qs('ptArq').files[0], rev = qs('ptRev') && qs('ptRev').value;
  if (!f){ toast('Escolha o arquivo da petição.'); return; }
  if (!/\.(docx|pdf)$/i.test(f.name)){ toast('Envie um arquivo .docx ou .pdf.'); return; }
  if (f.size > PT_MAX){ toast('O arquivo passa de 25 MB.'); return; }
  if (!rev){ toast('Escolha quem vai revisar.'); return; }
  if (ptS.enviando) return; ptS.enviando = true;
  var bt = qs('overlayPetC').querySelector('[data-pta="enviar"]'); if (bt){ bt.disabled = true; bt.textContent = 'Enviando…'; }
  var url = '/api/peticoes/enviar/' + encodeURIComponent(ptS.casoId) + '?nome=' + encodeURIComponent(f.name) + '&revisor=' + encodeURIComponent(rev) + '&prazo=' + encodeURIComponent((qs('ptPrazo') || {}).value || '') + '&recado=' + encodeURIComponent((qs('ptRecado') || {}).value || '');
  fetch(url, { method: 'POST', credentials: 'same-origin', body: f }).then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){ if (!r.ok) throw new Error((j.error && j.error.message) || ('Erro ' + r.status)); return j; }); })
    .then(function(){ ptS.enviando = false; toast('Petição enviada para revisão.'); return ptRecarregarFolha('Enviada. Você será avisado quando voltar.'); })
    .catch(function(e){ ptS.enviando = false; toast('Não consegui enviar: ' + e.message); ptDesenhar(); });
}
function ptAcao(a, bt){
  var p = ptDoCaso(ptS.casoId), id = p && p.id;
  var enc = function(m, corpo, ok){ return esJson('/api/peticoes/' + id + '/' + m, 'POST', corpo || {}).then(function(){ return ptRecarregarFolha(ok); }).catch(function(e){ toast(e.message); }); };
  if (a === 'enviar') return ptEnviar(p);
  if (a === 'comentar'){ var t = (qs('ptCom') || {}).value || ''; if (!t.trim()){ toast('Escreva o comentário.'); return; } return enc('comentar', { texto: t }, 'Comentário adicionado.'); }
  if (a === 'devolver'){ var t2 = (qs('ptCom') || {}).value || ''; return enc('devolver', { texto: t2 }, 'Devolvida para ajustes. A Inicial voltou para quem a fez.'); }
  if (a === 'aprovar'){ if (!confirm('Aprovar a petição sem alterações? A Inicial vai para "Aguardando protocolo".')) return; return enc('aprovar', {}, 'Aprovada. A Inicial está em "Aguardando protocolo".'); }
  if (a === 'reencaminhar'){ var r = (qs('ptRev2') || {}).value; if (!r){ toast('Escolha o revisor.'); return; } return enc('reencaminhar', { revisor: r }, 'Revisão passada para outro revisor.'); }
  if (a === 'apagar'){ if (!confirm('Apagar a petição e os arquivos enviados? Isso não pode ser desfeito.')) return; return esJson('/api/peticoes/' + id, 'DELETE').then(function(){ ptS.sig = ''; return ptCarregar(); }).then(function(){ qs('overlayPet').classList.remove('show'); toast('Petição apagada.'); }).catch(function(e){ toast(e.message); }); }
  if (a === 'protocolar'){ qs('overlayPet').classList.remove('show'); var col = ptStatusProtocolado(); try{ mudarStatusCaso(ptS.casoId, col); }catch(e){ toast('Abra a Inicial e mova para "Protocolado".'); } setTimeout(ptCarregar, 3000); return; }
  if (a === 'delegar') return ptDelegarAbrir();
  if (a === 'delegarok') return ptDelegarGravar();
  if (a === 'uso') return ptUsoAbrir();
}
function ptStatusProtocolado(){ return STATUS_ORDEM.indexOf('protocolado') >= 0 ? 'protocolado' : STATUS_ORDEM[STATUS_ORDEM.length - 1]; }
/* delegar o protocolo: cria a tarefa em Delegadas com o aviso de onde está o arquivo final */
function ptDelegarAbrir(){
  var box = qs('ptDelBox'); if (!box) return;
  var l = typeof dgPessoas === 'function' ? dgPessoas().filter(function(x){ return x.tipo !== 'sem'; }) : [];
  box.innerHTML = '<div class="pt-del-box"><label class="pt-l">Quem vai protocolar</label><select id="ptDelResp" class="pt-in"><option value="">Escolha…</option>' + l.map(function(x){ return '<option value="' + escapeHtml(x.k) + '">' + escapeHtml(x.nome) + (x.tipo === 'est' ? ' (estagiário)' : '') + '</option>'; }).join('') + '</select><button type="button" class="pt-bt pt-escuro" data-pta="delegarok">Criar a tarefa em Delegadas</button></div>';
}
function ptDelegarGravar(){
  var r = (qs('ptDelResp') || {}).value; if (!r){ toast('Escolha quem vai protocolar.'); return; }
  var caso = casos.filter(function(x){ return x.id === ptS.casoId; })[0] || {}, p = ptDoCaso(ptS.casoId) || {}, me = typeof dgMe === 'function' ? dgMe() : '';
  var d = { titulo: 'Protocolar: ' + (caso.cliente || '') + (caso.nomeAcao ? ' — ' + caso.nomeAcao : ''), cliente: caso.cliente || '', clienteId: (caso.clienteIds && caso.clienteIds[0]) || '', processo: caso.numeroProcesso || '', resp: r, delegadoPor: me, prioridade: 'Alta', status: 'afazer', trabalhar: '', fatal: p.prazo || '',
    obs: 'Petição aprovada por ' + ((p.revisor || {}).nome || 'revisor') + '. Baixe o arquivo final na aba Iniciais › cartão › Petição para revisão. Ao protocolar, mova a Inicial para Protocolado (informando o número do processo).', peticaoId: p.id || '', criadoPor: ptEu().id || '', criadoEm: new Date().toISOString() };
  dgGravar(d).then(function(){ toast('Tarefa criada em Delegadas.'); var b = qs('ptDelBox'); if (b) b.innerHTML = '<div class="pt-nota">Tarefa de protocolo criada para ' + escapeHtml(dgNome(r)) + '.</div>'; }).catch(function(e){ toast('Não consegui criar a tarefa: ' + e.message); });
}
/* ---------- armazenamento (só o proprietário) ---------- */
function ptBarra(rot, usado, lim, txt){ var pc = Math.min(100, usado / lim * 100); return '<div class="pt-bar"><div class="pt-bar-t"><span>' + rot + '</span><span>' + txt + '</span></div><div class="pt-bar-f"><i style="width:' + Math.max(pc, usado > 0 ? 1 : 0) + '%" class="' + (pc >= 95 ? 'pt-b-verm' : (pc >= 80 ? 'pt-b-ouro' : '')) + '"></i></div></div>'; }
function ptUsoAbrir(){
  var ov = sgMontar('overlayPetUso', 'Armazenamento das petições');
  ov.classList.add('show'); qs('overlayPetUsoC').innerHTML = '<div class="pt-vazio">Carregando…</div>';
  esJson('/api/peticoes/uso').then(function(u){
    ptS.uso = u;
    var msg = u.nivel === 'bloqueado' ? '<div class="pt-nota pt-nota-verm"><b>Limite atingido.</b> Novos envios estão bloqueados para não gerar cobrança. Baixar e comentar continuam funcionando. Apague petições antigas ou amplie o plano do R2.</div>' : (u.nivel === 'critico' ? '<div class="pt-nota pt-nota-verm"><b>Quase no limite (' + u.pct + '%).</b> Novos envios param em 100%.</div>' : (u.nivel === 'atencao' ? '<div class="pt-nota"><b>Atenção: ' + u.pct + '% do limite gratuito.</b> O aviso aparece uma vez por faixa a cada mês.</div>' : '<div class="pt-nota pt-nota-ok">Tudo certo: bem abaixo do limite gratuito.</div>'));
    qs('overlayPetUsoC').innerHTML = msg +
      ptBarra('Espaço usado', u.bytes, u.limiteBytes, ptTam(u.bytes) + ' de ' + ptTam(u.limiteBytes)) +
      ptBarra('Gravações no mês (envios)', u.classeA, u.limiteA, u.classeA.toLocaleString('pt-BR') + ' de ' + u.limiteA.toLocaleString('pt-BR')) +
      ptBarra('Leituras no mês (downloads)', u.classeB, u.limiteB, u.classeB.toLocaleString('pt-BR') + ' de ' + u.limiteB.toLocaleString('pt-BR')) +
      '<div class="pt-linha" style="margin-top:10px">' + u.arquivos + (u.arquivos === 1 ? ' arquivo guardado' : ' arquivos guardados') + '. Limite gratuito do R2: 10 GB guardados, 1 milhão de gravações e 10 milhões de leituras por mês. Ao protocolar, só a versão final de cada petição é mantida.</div>';
  }).catch(function(e){ qs('overlayPetUsoC').innerHTML = '<div class="pt-nota pt-nota-verm">' + escapeHtml(e.message) + '</div>'; });
}
/* ---------- ligações ---------- */
(function(){
  var st = document.createElement('style');
  st.textContent = '.pt-chip{display:inline-block;border:0;border-radius:999px;padding:3px 10px;font-size:var(--t1);font-weight:700;background:var(--surface-2);color:var(--ink);cursor:pointer;font-family:inherit}' +
    '.pt-e-a_corrigir{background:#FBEFD2;color:#8A5A0B}.pt-e-devolvida{background:#FDE3E3;color:#B42323}.pt-e-aprovada{background:#DDF3E5;color:#16683A}.pt-e-protocolada{background:#E3E8FB;color:#2F3E9E}' +
    '.pt-cab{font-size:var(--t4);margin-bottom:8px}.pt-sec{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:12px;margin:10px 0}.pt-t{font-size:var(--t1);font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--ink-soft);margin-bottom:8px}' +
    '.pt-vazio,.pt-linha{font-size:var(--t2);color:var(--ink-soft);line-height:1.45}.pt-linha b{color:var(--ink)}.pt-in{width:100%;box-sizing:border-box;border:1px solid var(--border);border-radius:10px;padding:10px;font:inherit;font-size:var(--t3);background:var(--bg);color:var(--ink);margin-bottom:8px}' +
    '.pt-l{display:block;font-size:var(--t1);font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--ink-soft);margin:8px 0 4px}.pt-bt{display:block;width:100%;box-sizing:border-box;margin:8px 0 0;padding:12px;border-radius:12px;border:1px solid var(--border);background:var(--surface);color:var(--ink);font:inherit;font-weight:700;font-size:var(--t3);cursor:pointer}' +
    '.pt-escuro{background:#12172A;color:#fff;border-color:#12172A}.pt-ouro{background:#B7791E;color:#fff;border-color:#B7791E}.pt-del{color:var(--urgente)}.pt-bt[disabled]{opacity:.6}' +
    '.pt-arq{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:center;border:1.5px dashed var(--border);border-radius:12px;padding:10px;cursor:pointer}.pt-arq input{position:absolute;opacity:0;width:1px;height:1px}.pt-arq-b{background:var(--accent);color:#fff;border-radius:9px;padding:8px 12px;font-weight:700;font-size:var(--t2)}.pt-arq-n{font-size:var(--t2);color:var(--ink-soft);word-break:break-all}.pt-arq-n b{color:var(--ink)}.pt-erro{color:var(--urgente);font-weight:700}' +
    '.pt-ver{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;padding:6px 0;border-top:1px solid var(--border)}.pt-ver:first-of-type{border-top:0}.pt-vn{font-weight:800;background:var(--surface-2);border-radius:8px;padding:4px 8px;font-size:var(--t2)}.pt-vt{display:flex;flex-direction:column;min-width:0;font-size:var(--t3)}.pt-vt b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pt-vt small{color:var(--ink-soft);font-size:var(--t1)}' +
    '.pt-baixar{font-weight:700;color:var(--accent);text-decoration:none;font-size:var(--t2);padding:6px 10px;border:1px solid var(--border);border-radius:9px}' +
    '.pt-com{border-left:3px solid #B7791E;background:var(--bg);border-radius:8px;padding:8px 10px;margin:6px 0}.pt-c-autor{border-left-color:var(--accent)}.pt-com-t{font-size:var(--t3);white-space:pre-wrap;line-height:1.4}.pt-com-m{font-size:var(--t1);color:var(--ink-soft);margin-top:4px}' +
    '.pt-hist summary{cursor:pointer;font-weight:700;font-size:var(--t2)}.pt-ev{font-size:var(--t2);color:var(--ink-soft);padding:3px 0}.pt-ev span{font-weight:700;color:var(--ink)}' +
    '.pt-nota{background:#FBEFD2;color:#6B4509;border-radius:10px;padding:10px 12px;font-size:var(--t2);margin:8px 0;line-height:1.4}.pt-nota-verm{background:#FDE3E3;color:#8E1B1B}.pt-nota-ok{background:#DDF3E5;color:#16683A}' +
    '.pt-rodape{font-size:var(--t1);color:var(--ink-soft);text-align:center;margin:12px 0}.pt-link{border:0;background:none;color:var(--accent);font:inherit;font-weight:700;cursor:pointer;padding:0;text-decoration:underline}' +
    '.pt-bar{margin:12px 0}.pt-bar-t{display:flex;justify-content:space-between;gap:8px;font-size:var(--t2);margin-bottom:4px}.pt-bar-f{height:9px;background:var(--surface-2);border-radius:99px;overflow:hidden}.pt-bar-f i{display:block;height:100%;background:var(--success);border-radius:99px}.pt-bar-f i.pt-b-ouro{background:#B7791E}.pt-bar-f i.pt-b-verm{background:var(--urgente)}' +
    '.pt-central{cursor:pointer}.pt-a-ouro{border-left:4px solid #B7791E}.pt-a-verm{border-left:4px solid var(--urgente)}.pt-del-box{margin-top:8px}';
  document.head.appendChild(st);
  document.addEventListener('click', function(e){
    var b = e.target.closest ? e.target.closest('[data-pt-abrir]') : null;
    if (b){ var d = b.closest ? b.closest('details') : null; if (d) d.removeAttribute('open'); e.stopPropagation(); ptAbrir(b.getAttribute('data-pt-abrir')); return; }
    var u = e.target.closest ? e.target.closest('[data-pt-uso]') : null; if (u) ptUsoAbrir();
  }, true);
  if (typeof CF_LINHAS !== 'undefined') CF_LINHAS.splice(3, 0, { id: 'petarm', ic: 'archive', t: 'Armazenamento das petições', s: 'espaço usado e limite gratuito do mês', go: function(){ ptUsoAbrir(); } });
  if (window.__SERVIDOR){ setTimeout(ptCarregar, 1500); setInterval(function(){ if (!document.hidden) ptCarregar(); }, 60000); document.addEventListener('visibilitychange', function(){ if (!document.hidden) ptCarregar(); }); }
  window.__horusTeste = Object.assign(window.__horusTeste || {}, { ptS: ptS, ptCarregar: ptCarregar, ptAbrir: ptAbrir, ptAtencao: ptAtencao, ptUsoAlerta: ptUsoAlerta, ptUsoAbrir: ptUsoAbrir, ptUsoChip: ptUsoChip, ptCentralChip: ptCentralChip });
})();
