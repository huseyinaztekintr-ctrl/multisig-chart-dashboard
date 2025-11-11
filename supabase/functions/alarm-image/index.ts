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
    const { title, message, tokenSymbol } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Generating image for alarm:", { title, message, tokenSymbol });

    // Alarm tipine göre görsel prompt'u oluştur
    let imagePrompt = "";
    
    if (message.includes("üstüne çıktı") || message.includes("above")) {
      imagePrompt = `A modern, vibrant celebration scene with green arrows pointing upward, ${tokenSymbol || 'cryptocurrency'} symbols, confetti, and glowing effects. Futuristic financial dashboard aesthetic with holographic displays showing success. Ultra high resolution. 16:9 aspect ratio.`;
    } else if (message.includes("altına düştü") || message.includes("below")) {
      imagePrompt = `A sleek, modern alert scene with red arrows pointing downward, ${tokenSymbol || 'cryptocurrency'} symbols, warning indicators, and glowing alert effects. Futuristic financial dashboard aesthetic with holographic displays. Ultra high resolution. 16:9 aspect ratio.`;
    } else if (message.includes("tarih") || message.includes("date")) {
      imagePrompt = `A modern, futuristic clock or calendar visualization with glowing effects, time symbols, and digital displays. ${tokenSymbol || 'cryptocurrency'} symbols integrated subtly. Holographic aesthetic with neon accents. Ultra high resolution. 16:9 aspect ratio.`;
    } else {
      imagePrompt = `A modern, futuristic alert scene with ${tokenSymbol || 'cryptocurrency'} symbols, glowing notification effects, and holographic displays. Financial dashboard aesthetic with vibrant colors. Ultra high resolution. 16:9 aspect ratio.`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          {
            role: "user",
            content: imagePrompt
          }
        ],
        modalities: ["image", "text"]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      // Return default image URL on error
      return new Response(
        JSON.stringify({ 
          imageUrl: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&h=450&fit=crop"
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      console.error("No image URL in response");
      return new Response(
        JSON.stringify({ 
          imageUrl: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&h=450&fit=crop"
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Image generated successfully");

    return new Response(
      JSON.stringify({ imageUrl }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in alarm-image:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        imageUrl: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&h=450&fit=crop"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
