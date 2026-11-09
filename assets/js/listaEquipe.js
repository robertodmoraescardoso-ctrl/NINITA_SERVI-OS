import { abrirEfetivo, ativos } from "./efetivo.js";
import { estado } from "./estado.js";
import { $, esc } from "./ui.js";

/* ------------------------------------------------------------
   EQUIPE PREVISTA — lista suspensa com o efetivo cadastrado
   Usada no cadastro de serviço. Os nomes escolhidos continuam
   gravados como antes (lista de nomes no campo "equipe"), num
   campo escondido #fEquipe, então o resto do sistema não muda.
   Com o efetivo vazio, a lista avisa e leva ao cadastro.
   ------------------------------------------------------------ */
const sel = { nomes:new Set(), busca:"" };

/* A lista aparece sempre que o efetivo existe no banco (migração 003),
   mesmo vazio: nesse caso ela avisa e leva ao cadastro do efetivo.
   O texto livre só volta se a migração 003 não tiver rodado. */
export function usaListaEquipe(){ return estado.progAtivo; }

export function htmlEquipe(nomes){
  if(!usaListaEquipe()){
    return '<input type="text" id="fEquipe" value="' + esc((nomes || []).join(", ")) + '" placeholder="Nomes separados por vírgula">';
  }
  return '<input type="hidden" id="fEquipe" value="">' +
    '<div class="lista-suspensa">' +
      '<button type="button" class="lista-suspensa__botao" id="fEquipeBotao" aria-expanded="false" aria-controls="fEquipePainel">Escolher colaboradores</button>' +
      '<div class="lista-suspensa__painel oculto" id="fEquipePainel">' +
        '<input type="text" id="fEquipeBusca" placeholder="Buscar nome ou função" autocomplete="off">' +
        '<div class="lista-suspensa__itens" id="fEquipeLista"></div>' +
        '<div class="lista-suspensa__pe"><button type="button" class="btn btn--p" data-eq="limpar">Desmarcar todos</button>' +
          '<button type="button" class="btn btn--p btn--marca" data-eq="fechar">Pronto</button></div>' +
      '</div>' +
      '<div class="chips-loc" id="fEquipeEscolhidos"></div>' +
    '</div>';
}

export function montarEquipe(modal, nomes){
  if(!usaListaEquipe()) return;
  sel.nomes = new Set(nomes || []);
  sel.busca = "";
  modal.addEventListener("click", aoClicar);
  modal.addEventListener("change", aoMudar);
  modal.addEventListener("input", function(ev){
    if(ev.target.id === "fEquipeBusca"){ sel.busca = ev.target.value; pintarLista(); }
  });
  pintarLista();
  pintarEscolhidos();
}

function pintarLista(){
  const termo = sel.busca.trim().toLowerCase();
  /* quem já estava na equipe mas não está no efetivo continua aparecendo */
  const doEfetivo = ativos().map(function(c){ return { nome:c.nome, funcao:c.funcao || "Sem função" }; });
  const nomesEfetivo = new Set(doEfetivo.map(function(p){ return p.nome; }));
  const fora = Array.from(sel.nomes).filter(function(n){ return !nomesEfetivo.has(n); })
    .map(function(n){ return { nome:n, funcao:"Fora do efetivo" }; });
  const grupos = new Map();
  doEfetivo.concat(fora)
    .filter(function(p){ return !termo || (p.nome + " " + p.funcao).toLowerCase().indexOf(termo) !== -1; })
    .forEach(function(p){ if(!grupos.has(p.funcao)) grupos.set(p.funcao, []); grupos.get(p.funcao).push(p); });
  const funcoes = Array.from(grupos.keys()).sort(function(a,b){ return a.localeCompare(b, "pt-BR"); });
  const vazio = ativos().length ? "" :
    '<div class="aviso" style="margin:4px 0 8px">O efetivo ainda está vazio. Importe a planilha do RH no botão Efetivo para escolher as pessoas aqui.' +
    '<p style="margin:6px 0 0"><button type="button" class="btn btn--p btn--marca" data-eq="efetivo">Abrir o Efetivo</button></p></div>';
  $("#fEquipeLista").innerHTML = vazio + (funcoes.length ? funcoes.map(function(f){
    return '<div class="lista-suspensa__grupo"><span class="dica">' + esc(f) + '</span>' +
      grupos.get(f).sort(function(a,b){ return a.nome.localeCompare(b.nome, "pt-BR"); }).map(function(p){
        return '<label class="lista-suspensa__item"><input type="checkbox" class="eq-marca" value="' + esc(p.nome) + '"' +
          (sel.nomes.has(p.nome) ? " checked" : "") + '> ' + esc(p.nome) + '</label>';
      }).join("") + '</div>';
  }).join("") : (ativos().length ? '<p class="dica">Ninguém com esse nome ou função.</p>' : ''));
}

function pintarEscolhidos(){
  const nomes = Array.from(sel.nomes).sort(function(a,b){ return a.localeCompare(b, "pt-BR"); });
  $("#fEquipe").value = nomes.join(", ");
  $("#fEquipeBotao").textContent = nomes.length ? nomes.length + " colaborador(es) escolhido(s)" : "Escolher colaboradores";
  $("#fEquipeEscolhidos").innerHTML = nomes.map(function(n){
    return '<span class="chip-loc chip-loc--fixo">' + esc(n) +
      ' <button type="button" data-eq-tirar="' + esc(n) + '" aria-label="Tirar ' + esc(n) + '">&times;</button></span>';
  }).join("");
}

function abrirFechar(abrir){
  const painel = $("#fEquipePainel");
  const aberto = abrir === undefined ? painel.classList.contains("oculto") : abrir;
  painel.classList.toggle("oculto", !aberto);
  $("#fEquipeBotao").setAttribute("aria-expanded", String(aberto));
  if(aberto) setTimeout(function(){ $("#fEquipeBusca").focus(); }, 20);
}

function aoClicar(ev){
  const t = ev.target;
  if(t.id === "fEquipeBotao"){ abrirFechar(); return; }
  const b = t.closest ? t.closest("[data-eq],[data-eq-tirar]") : null;
  if(!b) return;
  if(b.hasAttribute("data-eq-tirar")){ sel.nomes.delete(b.getAttribute("data-eq-tirar")); pintarLista(); pintarEscolhidos(); }
  if(b.getAttribute("data-eq") === "fechar") abrirFechar(false);
  if(b.getAttribute("data-eq") === "efetivo"){
    if(confirm("Abrir o Efetivo fecha este cadastro sem salvar. Continuar?")) abrirEfetivo();
    return;
  }
  if(b.getAttribute("data-eq") === "limpar"){ sel.nomes.clear(); pintarLista(); pintarEscolhidos(); }
}

function aoMudar(ev){
  if(!ev.target.classList.contains("eq-marca")) return;
  ev.target.checked ? sel.nomes.add(ev.target.value) : sel.nomes.delete(ev.target.value);
  pintarEscolhidos();
}

