import { abrirFormServico } from "./cadastro.js";
import { mostrarErro } from "./erros.js";
import { estado } from "./estado.js";
import { chavePavimento, sugerir } from "./inferencia.js";
import { criarPavimentos } from "./locais.js";
import { definirLigacoes, filhos, semLocalizacao, textoDeIds } from "./localizacoes.js";
import { pintarTudo } from "./navegacao.js";
import { $, aviso, esc } from "./ui.js";

/* ------------------------------------------------------------
   TRIAGEM — serviços antigos ainda sem localização
   Cada linha mostra o que a inferência encontrou no título e no
   campo Local. Aceitar grava a ligação; "Escolher" abre o cadastro
   do serviço para classificar à mão.
   ------------------------------------------------------------ */
function pendentes(){
  return estado.servicos
    .filter(function(s){ return semLocalizacao(s.id); })
    .sort(function(a,b){ return (a.codigo||"").localeCompare(b.codigo||"", "pt-BR", {numeric:true}); });
}

function textoSugestao(sug){
  if(sug.tipo !== "ok") return "";
  return sug.frente.nome + (sug.pavimentos.length ? " · " + sug.pavimentos.map(function(p){
    return p.nome + (p.id ? "" : " (novo)");
  }).join(", ") : " (frente inteira)");
}

export function abrirTriagem(){
  if(!estado.locAtivo){ aviso(estado.locErro, "erro"); return; }
  const lista = pendentes();
  const comSugestao = lista.filter(function(s){ return sugerir(s).tipo === "ok"; });

  const linhas = lista.map(function(s){
    const sug = sugerir(s);
    return '<tr>' +
      '<td><span class="cod">' + esc(s.codigo) + '</span><div class="tit">' + esc(s.titulo) + '</div>' +
        (s.local ? '<div class="sub">Local: ' + esc(s.local) + '</div>' : '') + '</td>' +
      '<td>' + (sug.tipo === "ok"
        ? '<strong>' + esc(textoSugestao(sug)) + '</strong>'
        : '<span class="sub">Sem sugestão: ' + esc(sug.motivo) + '</span>') + '</td>' +
      '<td><div class="acoes">' +
        (sug.tipo === "ok" ? '<button class="btn btn--p btn--marca" data-tri="aceitar" data-id="' + s.id + '">Aceitar</button>' : '') +
        '<button class="btn btn--p" data-tri="escolher" data-id="' + s.id + '">Escolher</button>' +
      '</div></td>' +
    '</tr>';
  }).join("");

  $("#modais").innerHTML =
  '<div class="cortina" id="cortina">' +
    '<div class="modal modal--largo" role="dialog" aria-modal="true" aria-label="Classificar serviços sem localização">' +
      '<div class="modal__cab"><h2>Serviços sem localização (' + lista.length + ')</h2>' +
        '<button class="fechar" data-fechar aria-label="Fechar">&times;</button></div>' +
      '<div class="modal__corpo">' +
        (lista.length
          ? '<p class="dica" style="margin-top:0">A sugestão vem do título e do campo Local de cada serviço. Confira antes de aceitar. ' +
              '"(novo)" indica pavimento que ainda não existe e será criado.</p>' +
            (comSugestao.length > 1
              ? '<p><button class="btn btn--marca" data-tri="todas">Aceitar as ' + comSugestao.length + ' sugestões</button></p>' : '') +
            '<div class="painel-tabela"><table class="tabela"><thead><tr><th>Serviço</th><th>Sugestão</th><th></th></tr></thead>' +
            '<tbody>' + linhas + '</tbody></table></div>'
          : '<div class="vazio"><h3>Tudo classificado</h3><p>Todos os serviços têm localização.</p></div>') +
      '</div>' +
    '</div>' +
  '</div>';
}

/* grava a sugestão, criando antes os pavimentos que faltam */
async function aplicar(servico, sug){
  const novos = sug.pavimentos.filter(function(p){ return !p.id; }).map(function(p){ return p.nome; });
  if(novos.length) await criarPavimentos(sug.frente.id, novos);
  const pavs = filhos(sug.frente.id);
  const ids = sug.pavimentos.length
    ? sug.pavimentos.map(function(p){
        const achado = pavs.find(function(x){ return chavePavimento(x.nome) === chavePavimento(p.nome); });
        return achado && achado.id;
      }).filter(Boolean)
    : [sug.frente.id];
  await definirLigacoes(servico.id, ids);
  return textoDeIds(ids);
}

export async function acaoTriagem(acao, id){
  try{
    if(acao === "escolher"){ abrirFormServico(id, false, { deTriagem:true }); return; }
    if(acao === "aceitar"){
      const s = estado.servicos.find(function(x){ return x.id === id; });
      const txt = await aplicar(s, sugerir(s));
      aviso(s.codigo + " → " + txt);
    }
    if(acao === "todas"){
      const lista = pendentes().filter(function(s){ return sugerir(s).tipo === "ok"; });
      if(!confirm("Gravar a localização sugerida para " + lista.length + " serviço(s)?")) return;
      let n = 0;
      for(const s of lista){ await aplicar(s, sugerir(s)); n++; }
      aviso(n + " serviço(s) classificados");
    }
  } catch(e){ mostrarErro(e); }
  abrirTriagem();
  pintarTudo();
}
