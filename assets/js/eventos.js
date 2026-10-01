import { addColaborador, pintarChips, pintarDetalhe, pintarListaServicos, pintarMiniaturas, pintarSugestoes, rascunho, receberArquivos, salvarApontamento } from "./acompanhamento.js";
import { abrirFormServico, excluirServico, gravarServico } from "./cadastro.js";
import { abrirMenuDados, exportarApontamentos, exportarServicos, fazerBackup, restaurar } from "./dados.js";
import { fmtLongo, hojeISO } from "./datas.js";
import { mostrarErro } from "./erros.js";
import { estado } from "./estado.js";
import { carregarExemplo } from "./exemplo.js";
import { abrirFoto, galeria, pintarLightbox } from "./galeria.js";
import { abrirLocais, acaoLocais } from "./locais.js";
import { local } from "./localizacoes.js";
import { abrirLote, gravarLote } from "./lote.js";
import { abrirImportacao, baixarModelo, gravarImportacao, receberPlanilha } from "./importacao.js";
import { abrirEdicaoLote, acaoEdicaoLote, aplicarEdicaoLote } from "./edicaoLote.js";
import { abrirCodigos, corrigirCodigos } from "./codigos.js";
import { pintarTudo, trocarAba } from "./navegacao.js";
import { abrirTriagem, acaoTriagem } from "./triagem.js";
import { pintarPainel } from "./painel.js";
import { iniciarTarefa, pintarPlanejamento } from "./planejamento.js";
import { STATUS } from "./servicos.js";
import { apagar, salvar } from "./supabase.js";
import { $, aviso, fecharModal } from "./ui.js";

/* ------------------------------------------------------------
   EVENTOS
   ------------------------------------------------------------ */
document.addEventListener("click", function(ev){
  const alvo = ev.target;
  const btn = alvo.closest ? alvo.closest("[data-acao],[data-sel],[data-fechar],[data-foto],[data-nav],[data-sug],[data-remove-chip],[data-remove-foto],[data-filtro-local],[data-loc-acao],[data-tri],[data-ed]") : null;

  /* fechar modal ao clicar na cortina */
  if(alvo.id === "cortina" || alvo.id === "lightbox"){ fecharModal(); return; }
  if(!btn) return;

  if(btn.hasAttribute("data-fechar")){ fecharModal(); return; }

  /* filtro por frente/pavimento: clicar de novo no que já está
     marcado volta um nível (pavimento -> frente -> todas) */
  if(btn.hasAttribute("data-filtro-local")){
    const idLocal = btn.getAttribute("data-filtro-local");
    const ativo = btn.getAttribute("aria-pressed") === "true";
    if(ativo && idLocal){
      const l = idLocal === "__sem" ? null : local(idLocal);
      estado.filtros.local = l && l.pai_id ? l.pai_id : "";
    } else {
      estado.filtros.local = idLocal;
    }
    pintarPainel();
    return;
  }
  if(btn.hasAttribute("data-loc-acao")){ acaoLocais(btn.getAttribute("data-loc-acao"), btn.getAttribute("data-id")); return; }
  if(btn.hasAttribute("data-tri")){ acaoTriagem(btn.getAttribute("data-tri"), btn.getAttribute("data-id")); return; }
  if(btn.hasAttribute("data-ed")){ acaoEdicaoLote(btn.getAttribute("data-ed")); return; }

  if(btn.hasAttribute("data-sel")){
    estado.selecionado = btn.getAttribute("data-sel");
    pintarListaServicos(); pintarDetalhe();
    return;
  }

  if(btn.hasAttribute("data-foto")){
    abrirFoto(btn.getAttribute("data-foto"), btn.getAttribute("data-srv"));
    return;
  }

  if(btn.hasAttribute("data-nav")){
    const p = Number(btn.getAttribute("data-nav"));
    galeria.i = (galeria.i + p + galeria.fotos.length) % galeria.fotos.length;
    pintarLightbox();
    return;
  }

  if(btn.hasAttribute("data-sug")){ addColaborador(btn.getAttribute("data-sug")); return; }

  if(btn.hasAttribute("data-remove-chip")){
    rascunho.colaboradores.splice(Number(btn.getAttribute("data-remove-chip")), 1);
    pintarChips(); pintarSugestoes();
    return;
  }

  if(btn.hasAttribute("data-remove-foto")){
    const i = Number(btn.getAttribute("data-remove-foto"));
    const f = rascunho.fotos[i];
    rascunho.fotos.splice(i, 1);
    apagar("fotos", f).catch(mostrarErro);
    pintarMiniaturas();
    return;
  }

  const acao = btn.getAttribute("data-acao");
  const idAlvo = btn.getAttribute("data-id");

  if(acao === "novo")    abrirFormServico(null);
  if(acao === "nova-tarefa"){ trocarAba("planejamento"); abrirFormServico(null, true); }
  if(acao === "iniciar")  iniciarTarefa(idAlvo);
  if(acao === "editar")  abrirFormServico(idAlvo);
  if(acao === "excluir-servico") excluirServico(idAlvo);
  if(acao === "acompanhar"){
    estado.selecionado = idAlvo;
    estado.filtros.lista = "todos";
    $("#filtroLista").value = "todos";
    trocarAba("acompanhamento");
  }
  if(acao === "triagem") abrirTriagem();
  if(acao === "duplicar") abrirFormServico(null, true, { duplicarDe: idAlvo });
  if(acao === "lote") abrirLote();
  if(acao === "importar") abrirImportacao();
  if(acao === "modelo-planilha") baixarModelo();
  if(acao === "editar-lote") abrirEdicaoLote(btn.getAttribute("data-origem"));
  if(acao === "codigos") abrirCodigos();
  if(acao === "limpar"){
    estado.filtros.busca = ""; estado.filtros.status = ""; estado.filtros.resp = ""; estado.filtros.titulo = ""; estado.filtros.local = "";
    $("#busca").value = ""; $("#filtroStatus").value = ""; $("#filtroResp").value = ""; $("#filtroTitulo").value = "";
    pintarPainel();
  }
  if(acao === "exemplo") carregarExemplo();
  if(acao === "csv-servicos")     exportarServicos();
  if(acao === "csv-apontamentos") exportarApontamentos();
  if(acao === "backup")           fazerBackup();
  if(acao === "restaurar")        $("#arquivoBackup").click();
  if(acao === "apagar-apont")     apagarApontamento(btn.getAttribute("data-srv"), btn.getAttribute("data-ap"));
});

export async function apagarApontamento(idServico, idAp){
  const s = estado.servicos.find(function(x){ return x.id === idServico; });
  if(!s) return;
  const ap = (s.apontamentos || []).find(function(a){ return a.id === idAp; });
  if(!ap) return;
  if(!confirm("Excluir o apontamento de " + fmtLongo(ap.data) + " e suas fotos?")) return;
  const antes = s.apontamentos;
  try{
    for(const f of (ap.fotos || [])){
      await apagar("fotos", f);
      if(estado.urls.has(f)){ URL.revokeObjectURL(estado.urls.get(f)); estado.urls.delete(f); }
    }
    s.apontamentos = s.apontamentos.filter(function(a){ return a.id !== idAp; });
    await salvar("servicos", s);
  } catch(e){
    /* a gravação falhou: a tela volta a mostrar o apontamento */
    s.apontamentos = antes;
    pintarTudo();
    mostrarErro(e);
    return;
  }
  pintarTudo();
  aviso("Apontamento excluído");
}

/* eventos delegados de formulário */
document.addEventListener("change", function(ev){
  const t = ev.target;
  if(t.id === "filtroStatus"){ estado.filtros.status = t.value; pintarPainel(); }
  if(t.id === "filtroResp"){ estado.filtros.resp = t.value; pintarPainel(); }
  if(t.id === "filtroTitulo"){ estado.filtros.titulo = t.value; pintarPainel(); }
  if(t.id === "ordenacao"){ estado.filtros.ordem = t.value; pintarPainel(); }
  if(t.id === "filtroLista"){ estado.filtros.lista = t.value; pintarListaServicos(); }
  if(t.id === "filtroDiscPlano") pintarPlanejamento();
  if(t.id === "arquivoFotos"){ receberArquivos(t.files); t.value = ""; }
  if(t.id === "arquivoBackup" && t.files[0]){ restaurar(t.files[0]); t.value = ""; }
  if(t.id === "arquivoPlanilha" && t.files[0]){ receberPlanilha(t.files[0]); t.value = ""; }
  if(t.id === "statusRapido") mudarStatus(t.value);
  if(t.id === "nomeObra"){
    estado.nomeObra = t.value;
    salvar("config", {chave:"obra", valor:t.value}).catch(mostrarErro);
  }
});

export async function mudarStatus(novo){
  const s = estado.servicos.find(function(x){ return x.id === estado.selecionado; });
  if(!s) return;
  const antes = { status:s.status, fimReal:s.fimReal, avanco:s.avanco };
  s.status = novo;
  if(novo === "concluido"){
    if(!s.fimReal) s.fimReal = hojeISO();
    s.avanco = 100;
  } else if(s.fimReal){
    s.fimReal = "";
  }
  try{
    await salvar("servicos", s);
  } catch(e){
    /* não gravou: desfaz na tela para não mostrar um status que o banco não tem */
    s.status = antes.status; s.fimReal = antes.fimReal; s.avanco = antes.avanco;
    pintarTudo();
    mostrarErro(e);
    return;
  }
  pintarTudo();
  aviso("Status alterado para " + STATUS[novo].rot);
}

document.addEventListener("input", function(ev){
  if(ev.target.id === "apQuant"){
    const prev = Number(ev.target.getAttribute("data-prev")) || 0;
    const jaFeito = Number(ev.target.getAttribute("data-exec")) || 0;
    const agora = Number(ev.target.value) || 0;
    if(prev > 0){
      $("#apAvanco").value = Math.min(100, Math.round(((jaFeito + agora) / prev) * 100));
    }
  }
  if(ev.target.id === "buscaPlano"){
    clearTimeout(document._tp);
    document._tp = setTimeout(pintarPlanejamento, 160);
  }
  if(ev.target.id === "busca"){
    estado.filtros.busca = ev.target.value;
    clearTimeout(document._t);
    document._t = setTimeout(pintarPainel, 160);
  }
});

document.addEventListener("keydown", function(ev){
  if(ev.key === "Escape"){ fecharModal(); return; }
  if(ev.target.id === "entradaColab" && (ev.key === "Enter" || ev.key === "," || ev.key === ";")){
    ev.preventDefault();
    addColaborador(ev.target.value);
    ev.target.value = "";
  }
  if(ev.target.id === "entradaColab" && ev.key === "Backspace" && !ev.target.value && rascunho.colaboradores.length){
    rascunho.colaboradores.pop(); pintarChips(); pintarSugestoes();
  }
  if($("#lightbox")){
    if(ev.key === "ArrowRight"){ galeria.i = (galeria.i + 1) % galeria.fotos.length; pintarLightbox(); }
    if(ev.key === "ArrowLeft"){ galeria.i = (galeria.i - 1 + galeria.fotos.length) % galeria.fotos.length; pintarLightbox(); }
  }
});

/* botões fixos do cabeçalho e da barra */
$("#btnIrPlano").addEventListener("click", function(){ trocarAba("planejamento"); });
$("#btnNovaTarefa").addEventListener("click", function(){ abrirFormServico(null, true); });
$("#tabPlano").addEventListener("click", function(){ trocarAba("planejamento"); });
$("#btnDados").addEventListener("click", abrirMenuDados);
$("#btnLocais").addEventListener("click", abrirLocais);
$("#btnImprimir").addEventListener("click", function(){ window.print(); });
$("#tabPainel").addEventListener("click", function(){ trocarAba("painel"); });
$("#tabAcomp").addEventListener("click", function(){ trocarAba("acompanhamento"); });
$("#visaoQuadro").addEventListener("click", function(){
  estado.visao = "quadro";
  $("#visaoQuadro").setAttribute("aria-pressed","true");
  $("#visaoTempo").setAttribute("aria-pressed","false");
  pintarPainel();
});
$("#visaoTempo").addEventListener("click", function(){
  estado.visao = "tempo";
  $("#visaoQuadro").setAttribute("aria-pressed","false");
  $("#visaoTempo").setAttribute("aria-pressed","true");
  pintarPainel();
});

/* delegação para o botão de gravar dentro do modal */
document.addEventListener("click", function(ev){
  const b = ev.target.closest ? ev.target.closest("#btnGravarServico, #btnGravarOutro, #btnGravarLote, #btnGravarImportacao, #btnAplicarLote, #btnCorrigirCodigos, #btnSalvarApont, #btnLimparApont, #zonaFotos") : null;
  if(!b) return;
  if(b.id === "btnGravarServico") gravarServico(b.getAttribute("data-id") || null);
  if(b.id === "btnGravarOutro")   gravarServico(null, true);
  if(b.id === "btnGravarLote")    gravarLote();
  if(b.id === "btnGravarImportacao") gravarImportacao();
  if(b.id === "btnAplicarLote")   aplicarEdicaoLote();
  if(b.id === "btnCorrigirCodigos") corrigirCodigos();
  if(b.id === "btnSalvarApont")   salvarApontamento();
  if(b.id === "zonaFotos")        $("#arquivoFotos").click();
  if(b.id === "btnLimparApont"){
    rascunho.colaboradores = []; rascunho.fotos = [];
    $("#apObs").value = ""; $("#entradaColab").value = "";
    pintarChips(); pintarSugestoes(); pintarMiniaturas();
  }
});

/* arrastar e soltar fotos */
["dragenter","dragover"].forEach(function(e){
  document.addEventListener(e, function(ev){
    const z = ev.target.closest ? ev.target.closest("#zonaFotos") : null;
    if(z){ ev.preventDefault(); z.classList.add("sobre"); }
  });
});
document.addEventListener("dragleave", function(ev){
  const z = ev.target.closest ? ev.target.closest("#zonaFotos") : null;
  if(z) z.classList.remove("sobre");
});
document.addEventListener("drop", function(ev){
  const z = ev.target.closest ? ev.target.closest("#zonaFotos") : null;
  if(!z) return;
  ev.preventDefault();
  z.classList.remove("sobre");
  if(ev.dataTransfer && ev.dataTransfer.files) receberArquivos(ev.dataTransfer.files);
});
