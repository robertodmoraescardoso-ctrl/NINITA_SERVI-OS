/* ------------------------------------------------------------
   UTILITÁRIOS DE TELA
   ------------------------------------------------------------ */
export const $  = function(s, ctx){ return (ctx||document).querySelector(s); };
export const $$ = function(s, ctx){ return Array.prototype.slice.call((ctx||document).querySelectorAll(s)); };

export function id(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }

export function esc(t){
  return String(t == null ? "" : t)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

export function fecharModal(){ $("#modais").innerHTML = ""; }

/* ------------------------------------------------------------
   AVISOS
   Mensagem curta no rodapé. Erros ficam mais tempo na tela e
   com a faixa em vermelho, para não passarem despercebidos.
   ------------------------------------------------------------ */
let tempoAviso = null;
export function aviso(txt, tipo){
  const t = $("#toast");
  const erro = tipo === "erro";
  t.textContent = txt;
  t.classList.toggle("toast--erro", erro);
  t.classList.add("ver");
  clearTimeout(tempoAviso);
  tempoAviso = setTimeout(function(){ t.classList.remove("ver"); }, erro ? 7000 : 3200);
}
