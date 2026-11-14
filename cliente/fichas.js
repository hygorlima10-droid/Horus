/* ============================================================
   FICHAS DE CADASTRO — Onda 3b
   - "Mais detalhes" (details.f-mais) abre sozinho quando algum campo de dentro já tem valor (edição) e fica fechado num cadastro novo;
   - o padrão de blocos, rótulos e campos está em public/tema.css (.f-sec, .f-mais, .overlay .modal-body)
   ============================================================ */
function fichaPreenchido(el){
  var f = false;
  Array.prototype.forEach.call(el.querySelectorAll('input, textarea, select'), function(c){
    if (f || c.closest('[style*="display:none"]') || c.type === 'hidden') return;
    if (c.type === 'checkbox' || c.type === 'radio'){ if (c.checked) f = true; return; }
    if (c.tagName === 'SELECT'){ if (c.selectedIndex > 0) f = true; return; }
    if (String(c.value || '').trim() !== '') f = true;
  });
  if (f) return true;
  Array.prototype.forEach.call(el.querySelectorAll('.segmented[data-padrao]'), function(sg){
    var a = sg.querySelector('.seg-btn.active'); if (a && a.getAttribute('data-value') !== sg.getAttribute('data-padrao')) f = true;
  });
  return f;
}
function fichaMais(ovId){
  var ov = qs(ovId); if (!ov) return;
  Array.prototype.forEach.call(ov.querySelectorAll('details.f-mais'), function(d){ d.open = fichaPreenchido(d); });
}
(function(){
  /* depois de abrir cada ficha, ajusta o "Mais detalhes" (cada função é redefinida na mesma escopo, como em processos.js) */
  var a1 = abrirNovo, a2 = abrirEdicao, b1 = abrirNovoAcordo, b2 = abrirEdicaoAcordo, c1 = abrirNovoAlvara, c2 = abrirEdicaoAlvara;
  abrirNovo = function(){ var r = a1.apply(this, arguments); try{ fichaMais('overlay'); }catch(e){} return r; };
  abrirEdicao = function(){ var r = a2.apply(this, arguments); try{ fichaMais('overlay'); }catch(e){} return r; };
  abrirNovoAcordo = function(){ var r = b1.apply(this, arguments); try{ fichaMais('overlayAcordo'); }catch(e){} return r; };
  abrirEdicaoAcordo = function(){ var r = b2.apply(this, arguments); try{ fichaMais('overlayAcordo'); }catch(e){} return r; };
  abrirNovoAlvara = function(){ var r = c1.apply(this, arguments); try{ fichaMais('overlayAlvara'); }catch(e){} return r; };
  abrirEdicaoAlvara = function(){ var r = c2.apply(this, arguments); try{ fichaMais('overlayAlvara'); }catch(e){} return r; };
})();
