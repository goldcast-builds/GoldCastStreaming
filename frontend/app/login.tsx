import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Permite verificar se o endpoint está ativo ao abrir diretamente no navegador
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        success: true,
        message: "Edge Function request-trial online e operacional!",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  }

  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const { mac, device_key } = body;

    if (!mac) {
      return new Response(
        JSON.stringify({ success: false, message: "Endereço MAC não informado." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Bloqueio anti-fraude: verifica se o aparelho já realizou teste
    const { data: existingDevice } = await supabase
      .from("devices")
      .select("*")
      .eq("mac", mac)
      .maybeSingle();

    if (existingDevice && existingDevice.trial_used) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "O teste gratuito de 3 horas já foi utilizado neste aparelho.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    // 2. Chama a API de criação rápida (~100ms)
    const apiUrl = "https://painel.dytop.org/dashboard/api/?fast_test=";
    const sessionCookie = "PHPSESSID=mlt8jtrgms6u3qt8nh4h7oecf1";

    const panelResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
        "Cookie": sessionCookie,
        "Referer": "https://painel.dytop.org/dashboard/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:157.0) Gecko/20100101 Firefox/157.0",
      },
    });

    const rawData = await panelResponse.json();
    const msgText: string = rawData?.data?.message || JSON.stringify(rawData);

    // 3. Extrai utilizador e senha diretamente do link M3U retornado
    let username = "";
    let password = "";

    const userMatch = msgText.match(/username=([^&"'\s<]+)/i) || msgText.match(/USU[ÁA]RIO\s*[:*]+\s*([a-zA-Z0-9_-]+)/i);
    if (userMatch) username = userMatch[1].trim();

    const passMatch = msgText.match(/password=([^&"'\s<]+)/i) || msgText.match(/SENHA\s*[:*]+\s*([a-zA-Z0-9_-]+)/i);
    if (passMatch) password = passMatch[1].trim();

    // 4. Salva a concessão no Supabase com utilizador e senha vinculados ao MAC
    await supabase.from("devices").upsert({
      mac: mac,
      device_key: device_key || "000000",
      trial_used: true,
      assigned_user: username,
      assigned_pass: password,
      created_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Teste de 3 horas liberado!",
        username: username,
        password: password,
        serverUrl: "http://newbrtop.online:8080",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
