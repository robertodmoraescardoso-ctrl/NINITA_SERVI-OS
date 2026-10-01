import { explicarErro } from "./erros.js";
import { estado } from "./estado.js";
import { textoOnde } from "./inferencia.js";
import { pintarTudo } from "./navegacao.js";
import { proximosCodigos } from "./servicos.js";
import { salvar } from "./supabase.js";
import { $, aviso, esc, fecharModal } from "./ui.js";

/* ------------------------------------------------------------
   CÓDIGOS REPETIDOS
   Serviços cadastrados antes do bloqueio de código repetido podem
   ter o mesmo código. Em cada grupo, o mais antigo fica com o
   código; os outros recebem códigos livres. Mostra antes de gravar.
   ------------------------------------------------------------ */
function proposta(){
  const grupos = new Map();
  estado.servicos.forEach(function(s){
    const c = (s.codigo || "").trim();
    if(!c) return;
    if(!grupos.has(c)) grupos.set(c, []);
    grupos.get(c).push(s);
  });
  const repetidos = Array.from(grupos.values()).filter(function(g){ return g.length > 1; });
  const trocar = [];
  repetidos.forEach(function(g){
    g.slice().sort(function(a,b){ return (a.criadoEm || "").localeCompare(b.criadoEm || ""); })
      .slice(1).forEach(function(s){ trocar.push(s); });
  });
  const novos = proximosCodigos(trocar.length);
  return trocar.map(function(s, i){ return { s:s, de:s.codigo, para:novos[i] }; });
}

export function abrirCodigos(){
  const lista = proposta();
  $("#modais").innerHTML =
  '<div class="cortina" id="cortina">' +
    '<div class="modal modal--largo" role="dialog" aria-modal="true" aria-label="Corrigir códigos repetidos">' +
      '<div class="modal__cab"><h2>Códigos repetidos</h2><button class="fechar" data-fechar aria-label="Fechar">&times;</button></div>' +
      '<div class="modal__corpo">' +
        (lista.length
          ? '<p class="dica" style="margin-top:0">Em cada código repetido, o serviço cadastrado primeiro mantém o código. Os demais recebem um código novo, como abaixo. Nada foi gravado ainda.</p>' +
            '<div class="painel-tabela"><table class="tabela"><thead><tr><th>Código atual</th><th>Novo código</th><th>Serviço</th><th>Local</th></tr></thead><tbody>' +
            lista.map(function(p){
              return '<tr><td class="cod">' + esc(p.de) + '</td><td><strong>' + esc(p.para) + '</strong></td>' +
                '<td class="tit">' + esc(p.s.titulo) + '</td><td class="sub">' + esc(textoOnde(p.s) || "—") + '</td></tr>';
            }).join("") + '</tbody></table></div>'
          : '<div class="vazio"><h3>Nenhum código repetido</h3><p>Todos os serviços têm código único.</p></div>') +
      '</div>' +
      '<div class="modal__pe"><button class="btn" data-fechar>Fechar</button>' +
        (lista.length ? '<button class="btn btn--marca" id="btnCorrigirCodigos">Renumerar ' + lista.length + ' serviço(s)</button>' : '') +
      '</div>' +
    '</div>' +
  '</div>';
}

export async function corrigirCodigos(){
  const lista = proposta();
  if(!lista.length || !confirm("Trocar o código de " + lista.length + " serviço(s)?")) return;
  let n = 0;
  try{
    for(const p of lista){
      const novo = Object.assign({}, p.s, { codigo:p.para });
      await salvar("servicos", novo);
      p.s.codigo = p.para;
      n++;
    }
  } catch(e){
    console.error(e);
    aviso("Parou no " + (n + 1) + "º: " + explicarErro(e) + " Os " + n + " anteriores foram renumerados.", "erro");
    pintarTudo();
    return;
  }
  fecharModal();
  pintarTudo();
  aviso(n + " código(s) corrigido(s)");
}
