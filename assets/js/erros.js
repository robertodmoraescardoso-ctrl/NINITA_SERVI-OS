import { aviso } from "./ui.js";

/* ------------------------------------------------------------
   TRATAMENTO CENTRAL DE ERROS
   Toda falha de rede ou do Supabase vira uma frase em português
   na tela. O detalhe técnico continua no console (F12) para
   quem precisar investigar.
   ------------------------------------------------------------ */

/* mensagem de erro em português, para não mostrar jargão de API */
export function explicarErro(e){
  const t = String((e && (e.message || e.error_description)) || e || "");
  if(/Failed to fetch|NetworkError|Load failed/i.test(t))
    return "Sem conexão com a internet. O lançamento não foi gravado — mantenha esta tela aberta e tente de novo.";
  if(/Invalid login credentials/i.test(t)) return "E-mail ou senha incorretos.";
  if(/Email not confirmed/i.test(t)) return "Este usuário ainda não foi confirmado no Supabase.";
  if(/JWT|expired|not authenticated/i.test(t)) return "Sua sessão expirou. Entre novamente.";
  if(/row-level security|permission|policy/i.test(t))
    return "O banco recusou a operação. Rode de novo o script de configuração no Supabase.";
  if(/relation .* does not exist|schema cache/i.test(t))
    return "As tabelas ainda não existem no Supabase. Rode o script de configuração.";
  if(/Bucket not found/i.test(t))
    return "O depósito de fotos não existe no Supabase. Rode o script de configuração.";
  return t || "Não foi possível concluir a operação.";
}

/* mostra o erro na tela e registra o detalhe no console */
export function mostrarErro(e){
  console.error(e);
  aviso(explicarErro(e), "erro");
}

/* Rede de segurança: qualquer falha que escape de um try/catch
   (gravação sem tratamento, erro de programação) também aparece
   na tela, em vez de sumir em silêncio no console. */
export function instalarCapturaGlobal(){
  window.addEventListener("unhandledrejection", function(ev){
    mostrarErro(ev.reason);
  });
  window.addEventListener("error", function(ev){
    /* erros de carregamento de imagem/arquivo não têm ev.error */
    if(ev.error) mostrarErro(ev.error);
  });
}
