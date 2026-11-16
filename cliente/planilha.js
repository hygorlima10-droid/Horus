/* ============================================================
   PLANILHA DE TAREFAS (prefixo pl) — Controle de Petições e Tarefas (Google Sheets) ⇄ Agenda, nos dois sentidos
   - Configurações › Planilha de tarefas: conexão, "quem é quem" (nome da planilha → pessoa do app), o que acompanha e a instalação do script (uma vez);
   - Agenda: selo "Planilha" nos cartões e, ao criar um item, o botão "Também na planilha" (liga a linha nova na aba Controle);
   - o servidor (src/planilha.js) faz a conversa com o script da planilha; aqui só aparece o resultado.
   ============================================================ */
var plS = { ligada: false, mapa: {}, estado: null, carregando: false };
function plApi(url, metodo, corpo){
  return fetch(url, { method: metodo || 'GET', credentials: 'same-origin', cache: 'no-store', headers: corpo !== undefined ? { 'content-type': 'application/json' } : undefined, body: corpo !== undefined ? JSON.stringify(corpo) : undefined })
    .then(function(r){ return (/\/script$/.test(url) ? r.text() : r.json().catch(function(){ return {}; })).then(function(j){ if (!r.ok) throw new Error((j && j.error && j.error.message) || ('Erro ' + r.status)); return j; }); });
}
/* ligada ou não (todo mundo logado pergunta; o editor da Agenda usa) */
function plCarregarLigada(){
  if (!window.__SERVIDOR) return Promise.resolve();
  return plApi('/api/planilha/ligada').then(function(j){ plS.ligada = !!j.ligada; plS.mapa = j.mapa || {}; }).catch(function(){});
}
function plQuando(iso){
  if (!iso) return 'ainda não conversou';
  var s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (s < 90) return 'há ' + (s < 10 ? 'poucos segundos' : s + ' s');
  if (s < 3600) return 'há ' + Math.round(s / 60) + ' min';
  if (s < 86400) return 'há ' + Math.round(s / 3600) + ' h';
  return 'em ' + fmtData(iso.slice(0, 10));
}
/* ---------- tela em Configurações ---------- */
function plAbrir(){
  var ov = sgMontar('overlayPlanilha', 'Planilha de tarefas');
  if (!ov.getAttribute('data-pl')){
    ov.setAttribute('data-pl', '1');
    ov.addEventListener('click', function(e){ var b = e.target.closest ? e.target.closest('[data-pl]') : null; if (b) plClique(b.getAttribute('data-pl'), b); });
    ov.addEventListener('change', function(e){ var t = e.target; if (t && t.getAttribute && t.getAttribute('data-plnome') !== null) plEscolher(t.getAttribute('data-plnome'), t.value); });
  }
  ov.classList.add('show'); qs('overlayPlanilhaC').innerHTML = '<div class="saldo-data">Carregando…</div>';
  plAtualizar();
}
function plAtualizar(){
  return plApi('/api/planilha').then(function(j){ plS.estado = j; plS.ligada = j.ligada && j.conectada; plDesenhar(); }).catch(function(e){ var c = qs('overlayPlanilhaC'); if (c) c.innerHTML = '<div class="form-error">' + escapeHtml(e.message) + '</div>'; });
}
function plDesenhar(){
  var c = qs('overlayPlanilhaC'), E = plS.estado; if (!c || !E) return;
  var h = '', ct = E.contagem || {};
  h += fSec('Conexão', E.ligada ?
    '<div class="pl-st"><span class="pl-dot' + (E.conectada ? '' : ' off') + '"></span><div><b>' + (E.conectada ? 'Conectada' : 'Aguardando a planilha') + '</b><small>' + escapeHtml((E.planilha || 'Controle de Petições e Tarefas') + ' · última conversa ' + plQuando(E.ultimaConversa)) + '</small></div></div>' +
    (E.erro ? '<div class="form-error">Última falha: ' + escapeHtml(E.erro) + '</div>' : '') +
    '<div class="pl-n"><b>' + (ct.ligadas || 0) + '</b> tarefas abertas ligadas · <b>' + (ct.conflitos || 0) + '</b> conflitos · <b>' + (ct.removidas || 0) + '</b> removidas da planilha</div>' +
    '<div class="pl-2"><button type="button" class="f-add" data-pl="atualizar">' + ico('refresh-cw', 16) + 'Atualizar</button>' + (E.url ? '<a class="f-add" href="' + escapeHtml(E.url) + '" target="_blank" rel="noopener">Abrir a planilha</a>' : '') + '</div>'
    : '<div class="pb-aviso">A planilha ainda não está ligada ao app. Toque em <b>Ligar</b> e siga os 3 passos abaixo (leva uns 5 minutos, uma vez só).</div><div class="pl-2"><button type="button" class="btn btn-primary" data-pl="ligar">Ligar a planilha</button></div>');
  if (E.ligada){
    var ops = function(sel){ return '<option value="">sem acesso (só o nome)</option>' + (E.opcoes || []).map(function(o){ return '<option value="' + escapeHtml(o.chave) + '"' + (o.chave === sel ? ' selected' : '') + '>' + escapeHtml(o.nome) + ' · ' + (o.papel === 'estagiario' ? 'estagiário' : (o.papel === 'proprietario' ? 'proprietário' : 'advogado')) + '</option>'; }).join(''); };
    h += fSec('Quem é quem', (E.nomes && E.nomes.length ? E.nomes.map(function(n){
      return '<div class="pl-p"><div><b>' + escapeHtml(n.planilha) + '</b><small>' + escapeHtml(n.funcao || 'na planilha') + '</small></div>' +
        '<select class="filter-select" data-plnome="' + escapeHtml(n.planilha) + '">' + ops(n.chave) + '</select>' +
        (n.usuario ? '<span class="pl-ok">' + ico('check', 13) + ' tem acesso</span>' : '<button type="button" class="f-add" data-pl="convite" data-nome="' + escapeHtml(n.planilha) + '" data-funcao="' + escapeHtml(n.funcao || '') + '">Criar convite</button>') + '</div>';
    }).join('') : '<div class="saldo-data">Os nomes aparecem aqui depois da primeira conversa com a planilha.</div>') + '<div class="saldo-data">Sem usuário, a tarefa continua ligada pelo nome e aparece como “Kamyla (sem acesso)”. Quando a pessoa entra e você a escolhe aqui, tudo passa para ela.</div>');
    h += fSec('O que acompanha nas duas vias', ['Tarefa nova (criada em qualquer lado)', 'Status e conclusão', 'Responsável e “delegado por”', 'Prioridade e observações', 'Prazo fatal e “trabalhar até” (a planilha calcula; o app mostra)'].map(function(t){ return '<div class="pl-ck">' + ico('check', 15) + t + '</div>'; }).join('') + '<div class="pl-ck off">' + ico('x', 15) + 'Despesas do Murilo (ignoradas, por enquanto)</div>');
    h += fSec('Ligar a planilha (uma vez)', '<ol class="pl-ol"><li>Toque em <b>Copiar script</b>.</li><li>Na planilha: <b>Extensões › Apps Script</b>. Toque em <b>+ › Script</b> para criar um <b>arquivo novo</b> (chame de “Horus”), cole nele e salve. <b>Não apague nem mexa no que já existe</b> (Arquivar, despesas).</li><li>Escolha a função <b>ligarAoHorus</b> › Executar › autorize.</li></ol><div class="pl-2"><button type="button" class="f-add" data-pl="script">' + ico('file-text', 16) + 'Copiar script</button><button type="button" class="f-add" data-pl="novachave">Gerar nova chave</button><button type="button" class="f-add pl-perigo" data-pl="desligar">Desligar</button></div><div class="saldo-data">O script tem uma chave secreta só sua: não compartilhe. “Gerar nova chave” invalida o script antigo (cole o novo).</div>');
  }
  c.innerHTML = h;
}
function plClique(a, b){
  if (a === 'atualizar') plAtualizar();
  else if (a === 'ligar') plApi('/api/planilha/ligar', 'POST', {}).then(plAtualizar).catch(function(e){ toast(e.message); });
  else if (a === 'script') plApi('/api/planilha/script').then(function(t){ try{ navigator.clipboard.writeText(t).then(function(){ toast('Script copiado. Cole num arquivo novo em Extensões › Apps Script.'); }, function(){ plMostrarScript(t); }); }catch(x){ plMostrarScript(t); } }).catch(function(e){ toast(e.message); });
  else if (a === 'novachave'){ if (b.getAttribute('data-sure') !== '1'){ b.setAttribute('data-sure', '1'); b.textContent = 'Toque de novo para confirmar'; return; } plApi('/api/planilha/novachave', 'POST', {}).then(function(){ toast('Nova chave gerada. Copie o script de novo.'); plAtualizar(); }); }
  else if (a === 'desligar'){ if (b.getAttribute('data-sure') !== '1'){ b.setAttribute('data-sure', '1'); b.textContent = 'Toque de novo para desligar'; return; } plApi('/api/planilha/desligar', 'POST', {}).then(function(){ toast('Planilha desligada. As tarefas continuam na Agenda.'); plAtualizar(); plCarregarLigada(); }); }
  else if (a === 'convite') plConvidar(b.getAttribute('data-nome'), b.getAttribute('data-funcao'));
}
function plMostrarScript(t){   /* quando o aparelho não deixa copiar sozinho: mostra o texto para copiar à mão */
  var c = qs('overlayPlanilhaC'); if (!c) return;
  c.insertAdjacentHTML('afterbegin', '<div class="f-sec"><div class="f-sec-t">Script (selecione tudo e copie)</div><textarea readonly rows="8" style="font-family:ui-monospace,monospace;font-size:12px;width:100%">' + escapeHtml(t) + '</textarea></div>');
}
function plEscolher(nome, chave){
  var mapa = {}; mapa[nome] = chave;
  plApi('/api/planilha/nomes', 'PUT', { mapa: mapa }).then(function(r){ toast(chave ? 'Pronto: as tarefas de ' + nome + ' passam para essa pessoa.' : 'Ligação desfeita para ' + nome + '.'); try{ agCarregar(); }catch(e){} return plAtualizar(); }).then(plCarregarLigada).catch(function(e){ toast(e.message); });
}
function plConvidar(nome, funcao){
  qs('overlayPlanilha').classList.remove('show'); usAbrir();
  setTimeout(function(){ try{ usNovoForm(); usS.form.nome = nome; usS.form.papel = /estag/i.test(funcao) ? 'estagiario' : 'advogado'; usS.form.perm = usPadrao(usS.form.papel); usS.tela = 'convidar'; usDesenhar(); }catch(e){ console.error('convite', e); } }, 700);
}
/* ---------- Agenda: "Também na planilha" no editor ---------- */
function plEditorHtml(i){
  var d = i && i.doc ? i.doc : null;
  if (d && d.plan && d.plan.id) return '<div class="pl-lig pl-fixo">' + ico('table', 18) + '<div><b>Ligado à planilha</b><small>' + (d.plan.removida ? 'a linha foi removida da planilha' : 'as mudanças aqui e na aba Controle se acompanham') + '</small></div></div>';
  if (i || !plS.ligada) return '';
  return '<label class="pl-lig" for="age_plan">' + ico('table', 18) + '<div><b>Também na planilha</b><small>vai para a aba Controle assim que salvar</small></div><input type="checkbox" id="age_plan" checked class="pl-sw"></label>';
}
/* depois de salvar, avisa se alguém escolhido não tem nome na planilha */
function plAvisoSemNome(chaves){
  var falta = (chaves || []).filter(function(k){ return !plS.mapa[k]; });
  if (falta.length) setTimeout(function(){ toast('Atenção: ' + falta.map(function(k){ return esNomeChave(k); }).join(', ') + ' não está ligado(a) a um nome da planilha; a linha vai sem responsável. Veja em Configurações › Planilha de tarefas.'); }, 1800);
}
(function(){
  var st = document.createElement('style');
  st.textContent = '.pl-st{display:flex;gap:10px;align-items:center}.pl-st small{display:block;color:var(--ink-soft);font-size:var(--t2)}.pl-dot{flex:none;width:12px;height:12px;border-radius:50%;background:var(--success);box-shadow:0 0 0 4px rgba(23,137,90,.18)}.pl-dot.off{background:var(--ink-soft);box-shadow:none}' +
    '.pl-n{font-size:var(--t3);color:var(--ink-soft)}.pl-2{display:flex;gap:8px;flex-wrap:wrap}.pl-2 .f-add{text-decoration:none}.pl-p{display:flex;flex-direction:column;align-items:stretch;gap:6px;padding:10px 0;border-top:1px solid var(--border)}.pl-p .pl-ok{align-self:flex-start}.pl-p small{display:block;color:var(--ink-soft);font-size:var(--t2)}.pl-p select{width:100%}' +
    '.pl-ok{display:inline-flex;align-items:center;gap:4px;color:var(--success);font-weight:700;font-size:var(--t2)}.pl-ck{display:flex;gap:8px;align-items:flex-start;min-height:28px;font-size:var(--t3);color:var(--success)}.pl-ck.off{color:var(--ink-soft)}.pl-ol{margin:0;padding-left:20px;font-size:var(--t3);line-height:1.6}.f-add.pl-perigo{color:var(--urgente)}' +
    '.pl-lig{display:flex;align-items:center;gap:12px;background:rgba(42,120,214,.10);border:1px solid rgba(42,120,214,.35);border-radius:16px;padding:12px 14px;color:var(--info);cursor:pointer}.pl-lig b{display:block;font-size:var(--t3)}.pl-lig small{display:block;font-size:var(--t2);color:var(--ink-soft);font-weight:400}.pl-lig>div{flex:1;min-width:0}.pl-fixo{cursor:default}' +
    'input.pl-sw{appearance:none;-webkit-appearance:none;width:46px;height:26px;border-radius:99px;background:var(--border);position:relative;flex:none;border:0;cursor:pointer;transition:background .15s}input.pl-sw:checked{background:var(--info)}input.pl-sw::after{content:"";position:absolute;left:3px;top:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:transform .15s}input.pl-sw:checked::after{transform:translateX(20px)}' +
    '.pb-tg.pl{background:rgba(42,120,214,.13);color:var(--info);display:inline-flex;align-items:center;gap:4px}';
  document.head.appendChild(st);
  if (window.__SERVIDOR) plCarregarLigada();
  window.__horusTeste = Object.assign(window.__horusTeste || {}, { plAbrir: plAbrir, plCarregarLigada: plCarregarLigada });
})();
