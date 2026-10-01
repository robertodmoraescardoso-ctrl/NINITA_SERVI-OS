import { diasUteis, fmtLongo, hojeISO } from "./datas.js";
import { explicarErro } from "./erros.js";
import { estado } from "./estado.js";
import { textoLocalizacao } from "./localizacoes.js";
import { servicosFiltrados } from "./filtros.js";
import { prepararFotos } from "./fotos.js";
import { pintarTudo } from "./navegacao.js";
import { avancoFisico, dataReferencia, diasAtraso, duracao, fotosDo, quantExecutada, quantPrevista, STATUS } from "./servicos.js";
import { apagar, idsFotosAtuais, lerTudo, salvar } from "./supabase.js";
import { $, aviso, fecharModal } from "./ui.js";

/* ------------------------------------------------------------
   DADOS: exportar, backup, restaurar
   ------------------------------------------------------------ */
export function baixar(nome, conteudo, tipo){
  const blob = conteudo instanceof Blob ? conteudo : new Blob([conteudo], {type:tipo});
  const u = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = u; a.download = nome; document.body.appendChild(a); a.click();
  setTimeout(function(){ URL.revokeObjectURL(u); a.remove(); }, 500);
}

export function csv(linhas){
  /* ; como separador e BOM: o Excel em pt-BR abre direto, sem assistente */
  const txt = linhas.map(function(l){
    return l.map(function(c){
      const v = c == null ? "" : String(c);
      return /[";\n]/.test(v) ? '"' + v.replace(/"/g,'""') + '"' : v;
    }).join(";");
  }).join("\r\n");
  return new Blob(["\uFEFF" + txt], {type:"text/csv;charset=utf-8"});
}

export function exportarServicos(){
  const linhas = [[
    "Código","Título","Disciplina","Localização","Local","Status","Início","Término previsto","Término real",
    "Dias corridos","Dias úteis","Atraso (dias)","Avanço (%)","Unidade","Quant. prevista","Quant. executada",
    "Saldo","Avanço físico (%)","Responsável","Equipe","Apontamentos","Fotos","Escopo"
  ]];
  servicosFiltrados().forEach(function(s){
    linhas.push([
      s.codigo, s.titulo, s.disciplina, textoLocalizacao(s.id), s.local, (STATUS[s.status]||{}).rot,
      fmtLongo(s.inicio), fmtLongo(s.fimPrev), s.fimReal ? fmtLongo(s.fimReal) : "",
      duracao(s), s.inicio ? diasUteis(s.inicio, dataReferencia(s)) : "",
      diasAtraso(s), s.avanco || 0, s.unidade || "", quantPrevista(s) || "", quantExecutada(s) || "",
      quantPrevista(s) ? quantPrevista(s) - quantExecutada(s) : "", avancoFisico(s) === null ? "" : avancoFisico(s),
      s.responsavel, (s.equipe||[]).join(", "),
      (s.apontamentos||[]).length, fotosDo(s).length, s.descricao
    ]);
  });
  baixar("servicos-obra-" + hojeISO() + ".csv", csv(linhas));
}

export function exportarApontamentos(){
  const linhas = [["Código","Serviço","Data","Avanço (%)","Quant. executada","Unidade","Efetivo","Colaboradores","Fotos","Observação"]];
  servicosFiltrados().forEach(function(s){
    (s.apontamentos||[]).slice().sort(function(a,b){ return (a.data||"").localeCompare(b.data||""); })
      .forEach(function(a){
        linhas.push([
          s.codigo, s.titulo, fmtLongo(a.data), a.avanco == null ? "" : a.avanco,
          a.quantidade || "", s.unidade || "",
          a.efetivo || "", (a.colaboradores||[]).join(", "), (a.fotos||[]).length, a.observacao
        ]);
      });
  });
  baixar("apontamentos-obra-" + hojeISO() + ".csv", csv(linhas));
}

export function blobParaBase64(blob){
  return new Promise(function(ok){
    const r = new FileReader();
    r.onload = function(){ ok(String(r.result).split(",")[1]); };
    r.readAsDataURL(blob);
  });
}
export function base64ParaBlob(b64, tipo){
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for(let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], {type: tipo || "image/jpeg"});
}

export async function fazerBackup(){
  aviso("Gerando backup, aguarde...");
  const fotos = await lerTudo("fotos");
  const pacote = { versao:1, em:new Date().toISOString(), obra:estado.nomeObra, servicos:estado.servicos, fotos:[],
    /* cópia da árvore de locais e das ligações (só para consulta; a restauração não as altera) */
    localizacoes:estado.localizacoes, ligacoes:Array.from(estado.ligacoes.entries()).map(function(p){ return { servico_id:p[0], localizacoes:Array.from(p[1]) }; }) };
  for(const f of fotos){
    pacote.fotos.push({ id:f.id, nome:f.nome, tipo:f.blob.type, dados: await blobParaBase64(f.blob) });
  }
  baixar("backup-obra-" + hojeISO() + ".json", JSON.stringify(pacote), "application/json");
  aviso("Backup gerado com " + pacote.fotos.length + " foto(s)");
}

export async function restaurar(arquivo){
  try{
    const pacote = JSON.parse(await arquivo.text());
    if(!pacote.servicos) throw new Error("formato");
    if(!confirm("Restaurar " + pacote.servicos.length + " serviço(s) do backup? Isso substitui o que está hoje na nuvem, para todos os aparelhos.")) return;

    const antigas = idsFotosAtuais();
    for(const s of estado.servicos) await apagar("servicos", s.id);
    for(const f of antigas) await apagar("fotos", f);
    estado.urls.forEach(function(u){ URL.revokeObjectURL(u); });
    estado.urls.clear();

    for(const f of (pacote.fotos || [])){
      await salvar("fotos", { id:f.id, blob:base64ParaBlob(f.dados, f.tipo), nome:f.nome, em:pacote.em });
    }
    for(const s of pacote.servicos) await salvar("servicos", s);
    estado.servicos = pacote.servicos;
    estado.nomeObra = pacote.obra || "";
    $("#nomeObra").value = estado.nomeObra;
    await prepararFotos();
    fecharModal();
    pintarTudo();
    aviso("Backup restaurado");
  } catch(e){
    /* arquivo ilegível é uma coisa; falha de rede no meio da restauração é outra
       e precisa ser dita com clareza, porque a nuvem pode ter ficado incompleta */
    if(e instanceof SyntaxError || (e && e.message === "formato")){
      aviso("Arquivo inválido. Use um backup gerado por esta ferramenta.", "erro");
    } else {
      console.error(e);
      aviso("A restauração foi interrompida: " + explicarErro(e) + " Recarregue a página e confira os serviços.", "erro");
    }
  }
}

export function abrirMenuDados(){
  $("#modais").innerHTML =
  '<div class="cortina" id="cortina">' +
    '<div class="modal" style="max-width:520px" role="dialog" aria-modal="true" aria-label="Dados">' +
      '<div class="modal__cab"><h2>Dados</h2><button class="fechar" data-fechar aria-label="Fechar">&times;</button></div>' +
      '<div class="modal__corpo" style="display:grid;gap:10px">' +
        '<button class="btn" data-acao="csv-servicos">Exportar serviços para Excel (.csv)</button>' +
        '<button class="btn" data-acao="csv-apontamentos">Exportar apontamentos para Excel (.csv)</button>' +
        '<button class="btn" data-acao="backup">Gerar backup completo (.json, inclui fotos)</button>' +
        '<button class="btn" data-acao="restaurar">Restaurar de um backup</button>' +
        '<button class="btn" data-acao="importar">Importar serviços de planilha (.xlsx ou .csv)</button>' +
        '<button class="btn" data-acao="modelo-planilha">Baixar modelo de planilha</button>' +
        '<button class="btn" data-acao="codigos">Corrigir códigos repetidos</button>' +
        '<input type="file" id="arquivoBackup" accept="application/json,.json" hidden>' +
        '<p class="dica" style="margin:4px 0 0">' +
          'Os dados ficam no seu projeto Supabase e aparecem em qualquer aparelho com a mesma senha. ' +
          'O backup serve como cópia de segurança fora da nuvem e para migrar de projeto.' +
        '</p>' +
      '</div>' +
    '</div>' +
  '</div>';
}
