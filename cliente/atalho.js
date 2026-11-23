/* ============================================================
   ATALHO DO IPHONE (prefixo atl) — Configurações › Atalho do iPhone
   Cada pessoa (proprietário e advogados) tem o SEU código e a SUA caixa de entrada: o extrato mandado pelo iPhone chega só para ela.
   O servidor (src/atalho.js) guarda o código e o arquivo (R2, até 25 MB); o app lê os recebidos na aba Extratos.
   ============================================================ */
var atlS = { info: null, pessoas: null, mostrar: false, nota: '' };
function atlDono(){ return typeof ppDono === 'function' && ppDono(); }
function atlQuando(iso){ if (!iso) return ''; var d = new Date(iso); if (isNaN(d)) return ''; var h = new Date(), mesmo = d.toDateString() === h.toDateString(), ont = new Date(h.getTime() - 864e5).toDateString() === d.toDateString(); return (mesmo ? 'hoje' : (ont ? 'ontem' : String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'))) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
function atlCopiar(txt){
  if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(txt).then(function(){ return true; }, function(){ return atlCopiarVelho(txt); });
  return Promise.resolve(atlCopiarVelho(txt));
}
function atlCopiarVelho(txt){ try{ var t = document.createElement('textarea'); t.value = txt; t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select(); var ok = document.execCommand('copy'); t.remove(); return ok; }catch(e){ return false; } }
/* Texto para um assistente (ChatGPT, Claude…) explicar como montar o atalho no app Atalhos.
   modo 'meu': já leva o código da própria pessoa (o atalho dela). modo 'compartilhar': sem código, para o atalho que o proprietário compartilha (cada um cola o seu ao importar). */
function atlPrompt(modo, codigo){
  var url = location.origin + '/api/enviar', meu = modo !== 'compartilhar' && !!codigo;
  var codTxt = meu ? 'Bearer ' + codigo : 'Bearer {CÓDIGO_DA_PESSOA}';
  return 'Você é especialista no app Atalhos (Shortcuts) do iPhone, em português. Escreva o passo a passo, ação por ação, para criar um atalho chamado "Enviar extrato ao Horus", usando os nomes das ações como aparecem no Atalhos em português (não invente ações).\n\n' +
    'Objetivo: a pessoa compartilha o extrato do banco (PDF, OFX ou ZIP) pela Folha de Compartilhamento e o arquivo é enviado ao meu app (Horus), que lê e monta a conferência. O atalho só envia o arquivo e avisa se deu certo; não abre nenhum app nem site.\n\n' +
    'Servidor: POST ' + url + ' · cabeçalho Authorization: ' + codTxt + ' · cabeçalho X-Nome: nome do arquivo codificado para URL · corpo: o próprio Arquivo. Sucesso: JSON com "ok": true. Erros: 401 (código inválido), 413 (arquivo acima de 25 MB), 429 (muitos arquivos esperando, ou 5 tentativas erradas: aguardar 15 minutos).\n\n' +
    'Comportamento: (1) aceitar Arquivos na folha de compartilhamento (se não houver entrada, pedir para escolher um arquivo); ' +
    (meu ? '(2) guardar o código ' + codigo + ' numa ação Texto no início do atalho e usá-lo no cabeçalho Authorization (com a palavra Bearer e um espaço antes); o código nunca aparece em mensagens ou notificações; '
         : '(2) usar "Pergunta ao importar" para o código (texto da pergunta: "Cole o seu código do Horus (Configurações › Atalho do iPhone)"), guardado numa ação Texto no início e usado no cabeçalho Authorization (com a palavra Bearer e um espaço antes); o código nunca aparece em mensagens ou notificações; ') +
    '(3) Repetir com cada item: obter Nome e Tamanho; se maior que 25 MB, avisar e pular; senão Obter conteúdo do URL (POST, cabeçalhos, corpo = Arquivo) e ler "ok" da resposta; se falhar, mostrar error.message com o nome do arquivo; (4) no fim, apenas uma notificação "N extrato(s) enviado(s) ao Horus." (e, se algum falhou, quais). Não abrir URL nem outro app ao terminar.\n\n' +
    'Inclua: tratamento de falta de conexão, como testar, como trocar o código depois (Editar atalho › ação Texto' + (meu ? '' : ' ou refazer a pergunta de importação') + '), como adicionar à tela de início, e uma frase simples explicando por que o código é pessoal e não deve ser repassado.\n\n' +
    'Formato: lista numerada de ações (nome da ação + o que preencher), depois "Como testar", "Erros comuns (401, 413, 429)"' + (meu ? '.' : ' e "Como compartilhar o atalho com outra pessoa sem passar o código".');
}
function atlAbrir(){
  var ov = sgMontar('overlayAtalho', 'Atalho do iPhone');
  if (!ov.getAttribute('data-atl')){
    ov.setAttribute('data-atl', '1');
    ov.addEventListener('click', function(e){ var b = e.target.closest ? e.target.closest('[data-atla]') : null; if (b) atlAcao(b.getAttribute('data-atla'), b); });
  }
  atlS.mostrar = false; atlS.nota = ''; ov.classList.add('show');
  qs('overlayAtalhoC').innerHTML = '<div class="atl-vazio">Carregando…</div>';
  atlCarregar();
}
function atlCarregar(){
  var ps = [esJson('/api/atalho')]; if (atlDono()) ps.push(esJson('/api/atalho/pessoas').catch(function(){ return { pessoas: [] }; }));
  return Promise.all(ps).then(function(r){ atlS.info = r[0]; atlS.pessoas = r[1] ? r[1].pessoas : null; atlDesenhar(); try{ if (typeof impVerRecebidos === 'function') impVerRecebidos(); }catch(e){} })
    .catch(function(e){ qs('overlayAtalhoC').innerHTML = '<div class="atl-nota atl-verm">' + escapeHtml(e.message) + '</div>'; });
}
function atlMascara(c){ return '•••• •••• •••• ' + c.slice(-4); }
function atlDesenhar(){
  var c = qs('overlayAtalhoC'), i = atlS.info; if (!c || !i) return;
  var h = '<p class="atl-intro">Mande o extrato do banco direto do iPhone para o Horus: no extrato, toque em Compartilhar › <b>Enviar extrato ao Horus</b>. O Horus lê o arquivo e mostra a conferência; nada é lançado antes de você confirmar.</p>' + (atlS.nota ? '<div class="atl-nota atl-ok">' + escapeHtml(atlS.nota) + '</div>' : '');
  /* 1. código */
  h += '<div class="atl-sec"><div class="atl-t"><span class="atl-n">1</span>Seu código pessoal</div>';
  if (!i.tem){
    h += '<div class="atl-vazio">Você ainda não tem um código.' + (i.legado ? ' O código antigo continua valendo até você gerar o seu.' : '') + '</div><button type="button" class="atl-bt atl-esc" data-atla="gerar">Gerar meu código</button>';
  } else {
    h += '<div class="atl-cod" id="atlCod">' + escapeHtml(atlS.mostrar ? i.codigo : atlMascara(i.codigo)) + '</div>' +
      '<div class="atl-duo"><button type="button" class="atl-bt" data-atla="mostrar">' + (atlS.mostrar ? 'Esconder' : 'Mostrar') + '</button><button type="button" class="atl-bt" data-atla="copiar">Copiar</button></div>' +
      '<div class="atl-nota atl-verm">É só seu: quem tiver este código consegue mandar arquivos para a sua caixa. Não repasse.</div>' +
      '<button type="button" class="atl-bt atl-perigo" data-atla="novo">Gerar novo código</button><div class="atl-peq">O código atual deixa de valer na hora. No iPhone, cole o novo no atalho (Atalhos › Editar).</div>';
  }
  h += '</div>';
  /* 2. instalar */
  h += '<div class="atl-sec"><div class="atl-t"><span class="atl-n">2</span>Instalar o atalho no iPhone</div>' +
    (i.link ? '<a class="atl-bt atl-azul" href="' + escapeHtml(i.link) + '" target="_blank" rel="noopener">Adicionar o atalho ao iPhone</a><div class="atl-peq">Abra este link no iPhone. O Atalhos vai perguntar o código: cole o de cima. Depois o atalho aparece em Compartilhar.</div>' : '<div class="atl-vazio">O link do atalho ainda não foi cadastrado.' + (i.dono ? ' Cadastre abaixo.' : ' Peça ao proprietário.') + '</div>');
  h += '<div class="atl-t" style="margin-top:12px">Ou monte o seu atalho com a ajuda de um assistente</div><div class="atl-peq" style="margin:0 0 4px">O iPhone não deixa um app colar texto dentro do Atalhos. Por isso: copie as instruções abaixo, cole num assistente (ChatGPT, Claude…) e siga o passo a passo no app Atalhos. O texto já leva o <b>seu código</b>: use só em assistente de confiança e, se achar que vazou, gere um novo código.</div>' +
    '<button type="button" class="atl-bt" data-atla="prompt"' + (i.tem ? '' : ' disabled') + '>Copiar as instruções com o meu código</button>' +
    '<div class="atl-duo"><button type="button" class="atl-bt" data-atla="compartilhar"' + (i.tem ? '' : ' disabled') + '>Enviar as instruções…</button><a class="atl-bt" href="shortcuts://create-shortcut">Abrir o app Atalhos</a></div>' + (i.tem ? '' : '<div class="atl-peq">Gere o seu código no passo 1 para liberar as instruções.</div>');
  if (i.dono){
    h += '<label class="atl-l">Link do atalho (iCloud)</label><input id="atlLink" class="atl-in" type="url" placeholder="https://www.icloud.com/shortcuts/…" value="' + escapeHtml(i.link || '') + '"><div class="atl-duo"><button type="button" class="atl-bt" data-atla="link">Salvar o link</button><button type="button" class="atl-bt" data-atla="promptc">Instruções para um atalho compartilhável</button></div><div class="atl-peq">Para <b>compartilhar</b> um atalho com a equipe, monte-o com as instruções “compartilhável” (ele pede o código de cada pessoa ao importar e <b>não leva o seu código</b>). Depois gere o link de compartilhamento do iCloud e cole acima.</div>';
  }
  h += '</div>';
  /* 3. testar */
  h += '<div class="atl-sec"><div class="atl-t"><span class="atl-n">3</span>Testar</div>' +
    '<div class="atl-lin"><span>Último envio</span><span>' + (i.ultimo ? '<b>' + escapeHtml(atlQuando(i.ultimo.em)) + '</b> · ' + escapeHtml(i.ultimo.nome) : 'nenhum ainda') + '</span></div>' +
    '<div class="atl-lin"><span>Esperando você conferir</span><span><b>' + i.esperando + (i.esperando === 1 ? ' arquivo' : ' arquivos') + '</b></span></div>' +
    '<button type="button" class="atl-bt" data-atla="atualizar">Atualizar</button>' + (i.esperando ? '<button type="button" class="atl-bt atl-esc" data-atla="extratos">Abrir os extratos recebidos</button>' : '') + '</div>';
  /* quando algo dá errado */
  h += '<div class="atl-sec"><div class="atl-t">Quando algo dá errado</div>' +
    '<div class="atl-lin"><span class="atl-tag atl-er">código recusado</span><span class="atl-peq">gere um novo e cole no atalho</span></div>' +
    '<div class="atl-lin"><span class="atl-tag atl-av">arquivo acima de 25 MB</span><span class="atl-peq">use “Escolher extratos” no app</span></div>' +
    '<div class="atl-lin"><span class="atl-tag atl-av">muitos esperando</span><span class="atl-peq">leia os recebidos primeiro</span></div></div>';
  /* proprietário: pessoas */
  if (i.dono && atlS.pessoas){
    h += '<div class="atl-sec"><div class="atl-t">Pessoas com atalho (só o proprietário vê)</div>' + atlS.pessoas.map(function(p){
      var st = !p.aplica ? '<span class="atl-tag atl-cz">não se aplica</span>' : (p.tem ? '<span class="atl-tag atl-ok2">ativo</span>' + (p.ultimo ? '<br><span class="atl-peq">' + escapeHtml(atlQuando(p.ultimo)) + '</span>' : '') : '<span class="atl-tag atl-cz">sem código</span>');
      return '<div class="atl-lin"><span><b>' + escapeHtml(p.nome) + '</b><br><span class="atl-peq">' + (p.papel === 'proprietario' ? 'proprietário' : (p.papel === 'advogado' ? 'advogado(a)' : 'estagiário(a): não usa')) + '</span></span><span style="text-align:right">' + st + (p.tem && p.papel !== 'proprietario' ? '<br><button type="button" class="atl-mini" data-atla="desligar" data-uid="' + escapeHtml(p.id) + '" data-nome="' + escapeHtml(p.nome) + '">Desligar</button>' : '') + '</span></div>';
    }).join('') + '<div class="atl-peq" style="margin-top:8px">Você não vê o código nem o conteúdo dos extratos de ninguém: só quem tem atalho e quando usou.</div></div>';
  }
  c.innerHTML = h;
}
function atlAcao(a, bt){
  var i = atlS.info;
  var gerar = function(){ return esJson('/api/atalho/gerar', 'POST', {}).then(function(){ atlS.mostrar = true; atlS.nota = 'Código gerado. Cole-o no atalho do iPhone.'; return atlCarregar(); }).catch(function(e){ toast(e.message); }); };
  if (a === 'gerar') return gerar();
  if (a === 'novo'){ if (!confirm('Gerar um novo código e desligar o atual? O atalho do iPhone vai parar de enviar até você colar o novo código nele.')) return; return gerar(); }
  if (a === 'mostrar'){ atlS.mostrar = !atlS.mostrar; return atlDesenhar(); }
  if (a === 'copiar') return atlCopiar(i.codigo).then(function(ok){ toast(ok ? 'Código copiado.' : 'Não consegui copiar: toque em Mostrar e copie à mão.'); });
  if (a === 'prompt'){ if (!i.tem){ toast('Gere o seu código primeiro.'); return; } return atlCopiar(atlPrompt('meu', i.codigo)).then(function(ok){ toast(ok ? 'Instruções copiadas, com o seu código. Cole num assistente.' : 'Não consegui copiar.'); }); }
  if (a === 'promptc') return atlCopiar(atlPrompt('compartilhar')).then(function(ok){ toast(ok ? 'Instruções copiadas (sem o seu código).' : 'Não consegui copiar.'); });
  if (a === 'compartilhar'){ if (!i.tem){ toast('Gere o seu código primeiro.'); return; } var tx = atlPrompt('meu', i.codigo); if (navigator.share) return navigator.share({ title: 'Instruções do atalho do Horus', text: tx }).catch(function(){}); return atlCopiar(tx).then(function(ok){ toast(ok ? 'Este aparelho não tem “Compartilhar”: copiei as instruções.' : 'Não consegui copiar.'); }); }
  if (a === 'link'){ var v = ((qs('atlLink') || {}).value || '').trim(); return esJson('/api/atalho/link', 'POST', { link: v }).then(function(){ atlS.nota = v ? 'Link salvo.' : 'Link removido.'; return atlCarregar(); }).catch(function(e){ toast(e.message); }); }
  if (a === 'atualizar'){ atlS.nota = ''; return atlCarregar(); }
  if (a === 'extratos'){ qs('overlayAtalho').classList.remove('show'); try{ setActiveTab('extratos'); }catch(e){} return; }
  if (a === 'desligar'){ var uid = bt.getAttribute('data-uid'), nome = bt.getAttribute('data-nome'); if (!confirm('Desligar o código de ' + nome + '? O atalho dela para de enviar até ela gerar outro.')) return; return esJson('/api/atalho/desligar', 'POST', { uid: uid }).then(function(){ atlS.nota = 'Código de ' + nome + ' desligado.'; return atlCarregar(); }).catch(function(e){ toast(e.message); }); }
}
(function(){
  var st = document.createElement('style');
  st.textContent = '#overlayAtalho .modal-body{gap:0}.atl-intro{font-size:var(--t2);color:var(--ink-soft);line-height:1.45;margin:0 0 10px}.atl-sec{border:1px solid var(--border);border-radius:14px;padding:12px;margin:0 0 10px;background:var(--surface)}' +
    '.atl-t{font-size:var(--t1);font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-soft);margin-bottom:8px}.atl-n{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;background:var(--accent);color:#fff;font-size:11px;font-weight:800;margin-right:6px}' +
    '.atl-cod{font:700 15px ui-monospace,Menlo,monospace;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:10px;letter-spacing:.05em;word-break:break-all}.atl-bt{display:block;width:100%;box-sizing:border-box;border:1px solid var(--border);border-radius:11px;padding:10px;text-align:center;font:inherit;font-weight:800;font-size:var(--t3);margin-top:8px;background:var(--surface);color:var(--ink);cursor:pointer;text-decoration:none}' +
    '.atl-esc{background:#12172A;color:#fff;border-color:#12172A}.atl-azul{background:var(--accent);color:#fff;border-color:var(--accent)}.atl-perigo{color:var(--urgente)}.atl-duo{display:flex;gap:8px}.atl-duo .atl-bt{flex:1}' +
    '.atl-nota{border-radius:10px;padding:9px 11px;font-size:var(--t2);margin:8px 0;line-height:1.4;background:#FBEFD2;color:#6B4509}.atl-verm{background:#FDE3E3;color:#8E1B1B}.atl-ok{background:#DDF3E5;color:#16683A}.atl-peq{color:var(--ink-soft);font-size:var(--t1);margin-top:6px}.atl-vazio{color:var(--ink-soft);font-size:var(--t2)}' +
    '.atl-lin{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 0;border-top:1px solid var(--border);font-size:var(--t2)}.atl-t+.atl-lin{border-top:0}.atl-tag{display:inline-block;border-radius:99px;padding:2px 9px;font-size:10.5px;font-weight:800}' +
    '.atl-er{background:#FDE3E3;color:#B42323}.atl-av{background:#FBEFD2;color:#8A5A0B}.atl-cz{background:#EAEEFB;color:#5b6488}.atl-ok2{background:#DDF3E5;color:#16683A}.atl-l{display:block;font-size:var(--t1);font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--ink-soft);margin:10px 0 4px}' +
    '.atl-in{width:100%;box-sizing:border-box;border:1px solid var(--border);border-radius:10px;padding:10px;font:inherit;font-size:var(--t3);background:var(--bg);color:var(--ink)}.atl-bt[disabled]{opacity:.5}a.atl-bt{box-sizing:border-box}.atl-mini{border:1px solid var(--border);background:var(--surface);color:var(--urgente);border-radius:8px;padding:3px 9px;font:700 11px system-ui,sans-serif;cursor:pointer;margin-top:4px}';
  document.head.appendChild(st);
  if (typeof CF_LINHAS !== 'undefined') CF_LINHAS.splice(1, 0, { id: 'atalho', ic: 'file-up', t: 'Atalho do iPhone', s: 'mande o extrato do banco direto do celular', go: function(){ atlAbrir(); } });
  /* advogado: a lista simplificada de Minha conta ganha a linha do atalho */
  if (typeof cfRender === 'function'){
    var cfOrig = cfRender;
    cfRender = function(){
      cfOrig.apply(this, arguments);
      try{ var w = qs('cfWrap'), m = w && w.querySelector('.pb-menu'); if (m && typeof ppPapel === 'function' && ppPapel() === 'advogado' && !m.querySelector('[data-cf="atalho"]')) m.insertAdjacentHTML('beforeend', cfLinha(CF_LINHAS.filter(function(x){ return x.id === 'atalho'; })[0], false)); }catch(e){}
    };
  }
  window.__horusTeste = Object.assign(window.__horusTeste || {}, { atlAbrir: atlAbrir, atlS: atlS, atlPrompt: atlPrompt });
})();
