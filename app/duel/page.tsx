"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Swords } from "lucide-react";

interface Message {
  id: string;
  username: string;
  content: string;
  created_at: string;
  duel_id: string;
}

export default function DuelPage() {
  const params = useSearchParams();
  const s1 = params.get("s1");
  const s2 = params.get("s2");

  const duelId = `${s1}-${s2}`;
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [username] = useState("User_" + Math.floor(Math.random() * 9999));

  // 🔹 Carregar mensagens existentes
  useEffect(() => {
    if (!duelId) return;

    const loadMessages = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("duel_id", duelId)
        .order("created_at", { ascending: true });
      setMessages(data || []);
    };

    loadMessages();

    // 🔹 Escutar em tempo real
    const channel = supabase
      .channel("duel-chat")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `duel_id=eq.${duelId}` },
        (payload) => setMessages((prev) => [...prev, payload.new as Message])
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [duelId]);

  // 🔹 Enviar mensagem
  const sendMessage = async (e: any) => {
    e.preventDefault();
    if (!newMsg.trim()) return;
    await supabase.from("messages").insert({
      duel_id: duelId,
      username,
      content: newMsg.trim(),
    });
    setNewMsg("");
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Swords className="text-blue-400" />
          Duelo de Transmissões
        </h1>
        <button
          onClick={() => (window.location.href = "/")}
          className="bg-zinc-800 hover:bg-zinc-700 text-sm px-4 py-2 rounded-lg"
        >
          ⬅️ Voltar ao Lobby
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {[s1, s2].map((id, i) => (
          <div key={i} className="bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800">
            <div className="aspect-video bg-black flex items-center justify-center">
              {i === 0 ? (
                <iframe
                  width="100%"
                  height="100%"
                  src="https://player.twitch.tv/?channel=felipe_fut&parent=localhost"
                  allowFullScreen
                ></iframe>
              ) : (
                <iframe
                  width="100%"
                  height="100%"
                  src="https://www.youtube.com/embed/watch?v=abcd1234"
                  allowFullScreen
                ></iframe>
              )}
            </div>

            <div className="p-3 border-t border-zinc-800">
              <h2 className="font-semibold text-lg mb-2 text-zinc-300">
                Chat da torcida
              </h2>
              <div className="bg-zinc-800 h-52 overflow-y-auto rounded-md p-2 mb-3 text-sm space-y-1">
                {messages.length === 0 ? (
                  <p className="text-zinc-500 italic">Nenhuma mensagem ainda...</p>
                ) : (
                  messages.map((msg) => (
                    <p key={msg.id}>
                      <span className="text-blue-400">{msg.username}:</span>{" "}
                      {msg.content}
                    </p>
                  ))
                )}
              </div>

              <form onSubmit={sendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={newMsg}
                  onChange={(e) => setNewMsg(e.target.value)}
                  className="flex-1 bg-zinc-700 text-white rounded-lg px-3 py-2 outline-none"
                  placeholder="Digite sua mensagem..."
                />
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 rounded-lg px-4 text-white transition"
                >
                  Enviar
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
