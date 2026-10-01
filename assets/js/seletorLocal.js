import { estado } from "./estado.js";
import { filhos, frenteDe, frentes, local, NIVEL, textoDeIds } from "./localizacoes.js";
import { esc } from "./ui.js";

/* ------------------------------------------------------------
   SELETOR DE LOCALIZAÇÃO (formulário de cadastro)
   Escolhe a frente, depois um ou vários pavimentos — com atalho
   "do 1º ao 8º" — e, se houver, ambientes/unidades.
   ------------------------------------------------------------ */
const sel = { ids:new Set(), frente:"", el:null };

export function idsSelecionados(){ return Array.from(sel.ids); }

export function montarSeletor(el, idsIniciais){
  sel.el = el;
  sel.ids = new Set(idsIniciais || []);
  const primeira = idsIniciais && idsIniciais.length ? frenteDe(idsIniciais[0]) : null;
  sel.frente = primeira ? primeira.id : "";
  el.addEventListener("click", aoClicar);
  el.addEventListener("change", aoMudar);
  pintar();
}

function chip(l, rotulo){
  const ativo = sel.ids.has(l.id);
  return '<button type="button" class="chip-loc" data-loc="' + l.id + '" aria-pressed="' + ativo + '">' +
    esc(rotulo || l.nome) + '</button>';
}

function pintar(){
  const el = sel.el;
  if(!estado.locAtivo){
    el.innerHTML = '<p class="dica" style="margin:0">' + esc(estado.locErro || "Localização indisponível.") + '</p>';
    return;
  }
  const fs = frentes();
  let h =
    '<div class="seletor-loc__linha">' +
      '<select id="slFrente" aria-label="Frente">' +
        '<option value="">Escolha a frente</option>' +
        fs.map(function(f){ return '<option value="' + f.id + '"' + (f.id === sel.frente ? " selected" : "") + '>' + esc(f.nome) + '</option>'; }).join("") +
      '</select>' +
      (sel.ids.size ? '<button type="button" class="btn btn--p btn--fantasma" data-sl="limpar">Limpar seleção</button>' : '') +
    '</div>';

  if(sel.frente){
    const f = local(sel.frente);
    const pavs = filhos(f.id).filter(function(l){ return l.nivel === NIVEL.PAVIMENTO; });
    h += '<div class="seletor-loc__grupo"><span class="dica">Frente inteira ou pavimentos:</span><div class="chips-loc">' +
           chip(f, f.nome + " (inteira)") + pavs.map(function(p){ return chip(p); }).join("") +
         '</div></div>';
    if(pavs.length > 2){
      const ops = pavs.map(function(p, i){ return '<option value="' + i + '">' + esc(p.nome) + '</option>'; }).join("");
      h += '<div class="seletor-loc__linha"><span class="dica">Marcar do</span>' +
             '<select id="slDe">' + ops + '</select><span class="dica">ao</span>' +
             '<select id="slAte">' + ops.replace('value="' + (pavs.length-1) + '"', 'value="' + (pavs.length-1) + '" selected') + '</select>' +
             '<button type="button" class="btn btn--p" data-sl="faixa">Marcar</button>' +
           '</div>';
    }
    if(!pavs.length){
      h += '<p class="dica" style="margin:4px 0 0">Nenhum pavimento cadastrado nesta frente. Use o botão Locais, no topo, para cadastrar.</p>';
    }
    /* ambientes dos pavimentos marcados */
    pavs.filter(function(p){ return sel.ids.has(p.id); }).forEach(function(p){
      const amb = filhos(p.id);
      if(!amb.length) return;
      h += '<div class="seletor-loc__grupo"><span class="dica">Ambientes do ' + esc(p.nome) + ' (opcional):</span><div class="chips-loc">' +
             amb.map(function(a){ return chip(a); }).join("") + '</div></div>';
    });
  }

  const resumo = textoDeIds(Array.from(sel.ids));
  h += '<div class="seletor-loc__resumo">' + (resumo ? "Selecionado: <strong>" + esc(resumo) + "</strong>" : "Nenhuma localização selecionada") + '</div>';
  el.innerHTML = h;
}

function aoClicar(ev){
  const b = ev.target.closest("[data-loc],[data-sl]");
  if(!b) return;
  const id = b.getAttribute("data-loc");
  if(id){
    if(sel.ids.has(id)){
      sel.ids.delete(id);
      /* desmarcar o pavimento leva junto os ambientes dele */
      if(local(id).nivel === NIVEL.PAVIMENTO) filhos(id).forEach(function(a){ sel.ids.delete(a.id); });
    } else {
      sel.ids.add(id);
    }
  }
  const acao = b.getAttribute("data-sl");
  if(acao === "limpar") sel.ids.clear();
  if(acao === "faixa"){
    const pavs = filhos(sel.frente).filter(function(l){ return l.nivel === NIVEL.PAVIMENTO; });
    let a = Number(sel.el.querySelector("#slDe").value), z = Number(sel.el.querySelector("#slAte").value);
    if(a > z){ const t = a; a = z; z = t; }
    for(let i = a; i <= z; i++) sel.ids.add(pavs[i].id);
  }
  pintar();
}

function aoMudar(ev){
  if(ev.target.id === "slFrente"){ sel.frente = ev.target.value; pintar(); }
}
