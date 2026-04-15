"use client";

import { useEffect, useState } from "react";
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, arrayUnion, serverTimestamp
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ChatSession, ChatMessage } from "@/lib/store";

export function useChats(tenantId: string | undefined, userId: string | undefined) {
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId || !userId) { setChats([]); setLoading(false); return; }

    const q = query(
      collection(db, "chats"),
      where("tenantId", "==", tenantId),
      where("userId", "==", userId),
      orderBy("updatedAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      setChats(snap.docs.map((d) => ({ ...(d.data() as ChatSession), id: d.id })));
      setLoading(false);
    }, (err) => {
      console.error("[useChats] snapshot error:", err);
      setLoading(false);
    });

    return unsub;
  }, [tenantId, userId]);

  const createChat = async (title: string, tenantId: string, userId: string): Promise<string> => {
    const ref = await addDoc(collection(db, "chats"), {
      tenantId,
      userId,
      title,
      messages: [],
      updatedAt: Date.now(),
    });
    return ref.id;
  };

  const addMessage = async (chatId: string, message: ChatMessage) => {
    await updateDoc(doc(db, "chats", chatId), {
      messages: arrayUnion(message),
      updatedAt: Date.now(),
    });
  };

  const renameChat = async (chatId: string, title: string) => {
    await updateDoc(doc(db, "chats", chatId), { title });
  };

  const removeChat = async (chatId: string) => {
    await deleteDoc(doc(db, "chats", chatId));
  };

  return { chats, loading, createChat, addMessage, renameChat, removeChat };
}
