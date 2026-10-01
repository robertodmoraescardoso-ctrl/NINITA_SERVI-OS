import { SUPABASE_URL, SUPABASE_CHAVE } from "../../config.js";
import { estado } from "./estado.js";
import { fotosDo } from "./servicos.js";

/* ------------------------------------------------------------
   ARMAZENAMENTO — Supabase (nuvem)
   Os dados deixam de morar no aparelho e passam a morar no
   projeto Supabase. Qualquer celular ou computador com internet
   e a senha enxerga exatamente o mesmo painel.
   ------------------------------------------------------------ */

export const BUCKET = "fotos";
export let sb = null;

export function cfgLocal(nome, padrao){
  try { return localStorage.getItem("vn_" + nome) || padrao; } catch(e){ return padrao; }
}
export function guardarCfgLocal(nome, valor){
  try { localStorage.setItem("vn_" + nome, valor); } catch(e){}
}

export let URL_SB   = cfgLocal("url", SUPABASE_URL);
export let CHAVE_SB = cfgLocal("chave", SUPABASE_CHAVE);

export function chaveValida(k){
  const t = String(k || "").trim();
  if(/^sb_secret_/.test(t)) return false;          /* chave errada: essa é de servidor */
  if(ehServiceRole(t)) return false;               /* idem, formato legado */
  return /^sb_publishable_.{20,}$/.test(t) ||      /* formato novo */
         (/^eyJ/.test(t) && t.length > 40);        /* anon legada */
}

export function configurado(){
  return /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(String(URL_SB).trim()) &&
         chaveValida(CHAVE_SB);
}

/* troca a URL e a chave em uso (tela "Ligar à nuvem") */
export function definirConfig(url, chave){
  URL_SB = url;
  CHAVE_SB = chave;
}

/* chave JWT legada com papel service_role: acesso total, nunca no site */
function ehServiceRole(k){
  const partes = String(k || "").trim().split(".");
  if(partes.length !== 3) return false;
  try {
    const carga = JSON.parse(atob(partes[1].replace(/-/g, "+").replace(/_/g, "/")));
    return carga && carga.role === "service_role";
  } catch(e){ return false; }
}

/* Explica em português o que está errado na URL ou na chave.
   Devolve "" quando as duas estão certas. */
export function problemaConfig(url, chave){
  const u = String(url || "").trim();
  const k = String(chave || "").trim();
  if(!u || u.indexOf("COLE") === 0)
    return "Falta a URL do projeto Supabase (formato https://<ref>.supabase.co).";
  if(/\/rest\/v1/i.test(u))
    return "A URL não pode terminar em /rest/v1/. Use só https://<ref>.supabase.co, sem nada depois.";
  if(/^http:\/\//i.test(u))
    return "A URL deve começar com https:// (com s).";
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(u))
    return "A URL \"" + u + "\" não está no formato https://<ref>.supabase.co.";
  if(/^sb_secret_/.test(k) || ehServiceRole(k))
    return "Essa é a chave secreta, que só pode ser usada em servidor. Copie a Publishable key, que começa com sb_publishable_.";
  if(!k)
    return "Falta a chave publicável (Publishable key, começa com sb_publishable_).";
  if(!chaveValida(k))
    return "A chave não está no formato esperado: deve começar com sb_publishable_ (ou eyJ, na chave anon legada).";
  return "";
}

export function conectar(){
  sb = window.supabase.createClient(String(URL_SB).trim(), String(CHAVE_SB).trim(), {
    auth: { persistSession: true, autoRefreshToken: true }
  });
}

/* --- as quatro funções abaixo mantêm a mesma assinatura da
       versão local, então o resto da aplicação não muda --- */

export async function salvar(loja, obj){
  if(loja === "servicos"){
    const r = await sb.from("servicos").upsert({
      id: obj.id, dados: obj, atualizado_em: new Date().toISOString()
    });
    if(r.error) throw r.error;
    return;
  }
  if(loja === "config"){
    const r = await sb.from("config").upsert({ chave: obj.chave, valor: obj.valor });
    if(r.error) throw r.error;
    return;
  }
  if(loja === "fotos"){
    const r = await sb.storage.from(BUCKET).upload(obj.id + ".jpg", obj.blob, {
      contentType: (obj.blob && obj.blob.type) || "image/jpeg", upsert: true
    });
    if(r.error) throw r.error;
    return;
  }
}

export async function apagar(loja, chave){
  if(loja === "servicos"){
    const r = await sb.from("servicos").delete().eq("id", chave);
    if(r.error) throw r.error;
    return;
  }
  if(loja === "config"){
    const r = await sb.from("config").delete().eq("chave", chave);
    if(r.error) throw r.error;
    return;
  }
  if(loja === "fotos"){
    const r = await sb.storage.from(BUCKET).remove([chave + ".jpg"]);
    if(r.error) throw r.error;
    return;
  }
}

/* ids de todas as fotos referenciadas hoje, sem baixar nada */
export function idsFotosAtuais(){
  const out = [];
  estado.servicos.forEach(function(s){
    fotosDo(s).forEach(function(f){ if(out.indexOf(f) === -1) out.push(f); });
  });
  return out;
}

export async function lerTudo(loja){
  if(loja === "servicos"){
    const r = await sb.from("servicos").select("dados").order("atualizado_em", {ascending:false});
    if(r.error) throw r.error;
    return (r.data || []).map(function(l){ return l.dados; }).filter(Boolean);
  }
  if(loja === "fotos"){
    /* usado apenas pelo backup: aqui sim precisa baixar os arquivos */
    const out = [];
    for(const f of idsFotosAtuais()){
      const r = await sb.storage.from(BUCKET).download(f + ".jpg");
      if(r.data) out.push({ id:f, blob:r.data, nome:f + ".jpg" });
    }
    return out;
  }
  return [];
}

export async function ler(loja, chave){
  if(loja === "config"){
    const r = await sb.from("config").select("valor").eq("chave", chave).maybeSingle();
    if(r.error) return null;
    return r.data ? { chave: chave, valor: r.data.valor } : null;
  }
  if(loja === "fotos"){
    const r = await sb.storage.from(BUCKET).download(chave + ".jpg");
    return r.data ? { id: chave, blob: r.data } : null;
  }
  return null;
}
