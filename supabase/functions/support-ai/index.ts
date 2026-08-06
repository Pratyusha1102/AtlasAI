import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const { createClient } = await import("npm:@supabase/supabase-js@2.49.1");
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const message = body?.message;
    const conversationId = body?.conversation_id;

    if (!message || typeof message !== "string") {
      return new Response(
        JSON.stringify({ error: "Message is required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Retrieve relevant chunks via full-text search RPC
    const { data: results, error: searchError } = await supabase.rpc("search_knowledge_chunks", {
      query_text: message,
      match_count: 5,
    });

    if (searchError) {
      return new Response(
        JSON.stringify({ error: "Search failed." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const chunks = results || [];

    if (chunks.length === 0) {
      const fallback = "I don't know based on the current knowledge base. Would you like me to escalate this question to a support specialist?";
      if (conversationId) {
        await supabase.from("support_messages").insert({
          conversation_id: conversationId,
          role: "assistant",
          content: fallback,
          citations: [],
          metadata: { grounded: false },
        });
      }
      return new Response(
        JSON.stringify({ answer: fallback, citations: [], grounded: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const topChunks = chunks.slice(0, 3);
    const context = topChunks.map((c: { content: string }) => c.content).join("\n\n");
    const citations = [...new Set(topChunks.map((c: { document_name: string }) => c.document_name))];

    // Build RAG prompt — in production, send to LLM provider with the context injected
    const answer = `Based on your knowledge base, here's what I found regarding "${message}":\n\n${context.slice(0, 800)}...\n\nThis information comes from ${citations.length} source${citations.length > 1 ? "s" : ""} in your knowledge base.`;

    if (conversationId) {
      await supabase.from("support_messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        content: answer,
        citations,
        metadata: { grounded: true },
      });
    }

    return new Response(
      JSON.stringify({ answer, citations, grounded: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Unable to process the request." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
