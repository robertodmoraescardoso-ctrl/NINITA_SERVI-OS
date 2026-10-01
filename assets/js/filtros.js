import { estado } from "./estado.js";
import { semLocalizacao, servicoEm, textoLocalizacao } from "./localizacoes.js";
import { duracao, ultimaAtualizacao } from "./servicos.js";

/* ------------------------------------------------------------
   FILTRO E ORDENAÇÃO
   ------------------------------------------------------------ */
export function servicosFiltrados(){
  const f = estado.filtros;
  const termo = f.busca.trim().toLowerCase();

  let lista = estado.servicos.filter(function(s){
    if(f.status === "aberto"){ if(s.status === "concluido") return false; }
    else if(f.status && s.status !== f.status) return false;
    if(f.resp && s.responsavel !== f.resp) return false;
    if(f.titulo && s.titulo !== f.titulo) return false;
    if(f.local && estado.locAtivo){
      if(f.local === "__sem"){ if(!semLocalizacao(s.id)) return false; }
      else if(!servicoEm(s.id, f.local)) return false;
    }
    if(!termo) return true;
    const alvo = [
      s.titulo, s.codigo, s.local, textoLocalizacao(s.id), s.disciplina, s.descricao, s.responsavel,
      (s.equipe || []).join(" "),
      (s.apontamentos || []).map(function(a){
        return (a.observacao || "") + " " + (a.colaboradores || []).join(" ");
      }).join(" ")
    ].join(" ").toLowerCase();
    return alvo.indexOf(termo) !== -1;
  });

  const ordem = f.ordem;
  lista.sort(function(a,b){
    if(ordem === "titulo")   return (a.titulo||"").localeCompare(b.titulo||"","pt-BR");
    if(ordem === "duracao")  return (duracao(b)||0) - (duracao(a)||0);
    if(ordem === "fim")      return (a.fimPrev||"9999").localeCompare(b.fimPrev||"9999");
    if(ordem === "atualizacao") return (ultimaAtualizacao(b)||"").localeCompare(ultimaAtualizacao(a)||"");
    return (a.inicio||"9999").localeCompare(b.inicio||"9999");
  });
  return lista;
}
