import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Generating TTS for text:", text);

    // Sayıları metne dönüştür - tek tek rakam yerine tam söylenmesi için
    const processedText = text
      .replace(/\$(\d+(?:\.\d+)?)/g, (_match: string, num: string) => {
        const numValue = parseFloat(num);
        if (numValue >= 1000000) {
          return `${(numValue / 1000000).toFixed(2)} milyon dolar`;
        } else if (numValue >= 1000) {
          return `${(numValue / 1000).toFixed(2)} bin dolar`;
        }
        return `${numValue.toFixed(2)} dolar`;
      })
      .replace(/₺(\d+(?:\.\d+)?)/g, (_match: string, num: string) => {
        const numValue = parseFloat(num);
        if (numValue >= 1000000) {
          return `${(numValue / 1000000).toFixed(2)} milyon lira`;
        } else if (numValue >= 1000) {
          return `${(numValue / 1000).toFixed(2)} bin lira`;
        }
        return `${numValue.toFixed(2)} lira`;
      })
      .replace(/WAVAX\s*(\d+(?:\.\d+)?)/g, (_match: string, num: string) => {
        return `${parseFloat(num).toFixed(2)} WAVAX`;
      });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { 
            role: "system", 
            content: "Sen bir alarm asistanısın. Verilen metni doğal Türkçe ile seslendirmek için düzenle. Direkt cümleyi söyle, ekstra açıklama yapma. 'Seslendir:', 'dikkat çekici', 'heyecanlı' gibi ifadeler kullanma. Sadece alarm bilgisini anlaşılır şekilde söyle. Sayıları tek tek rakam olarak değil, tam olarak oku (örn: 'yirmi üç bin beş yüz' de)." 
          },
          { role: "user", content: processedText }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const ttsText = data.choices?.[0]?.message?.content || processedText;

    console.log("TTS text generated:", ttsText);

    return new Response(
      JSON.stringify({ text: ttsText }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in alarm-tts:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
