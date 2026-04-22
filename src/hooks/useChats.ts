"use client";

import { useEffect, useState } from "react";
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, arrayUnion, getDoc
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
      // The Firestore SDK can enter an unrecoverable internal state after a
      // permission error on a live listener.  Terminate the client and hard-
      // reload so it restarts cleanly with a fresh token.
      if (err.message?.includes('INTERNAL ASSERTION FAILED') ||
          err.code === 'permission-denied' ||
          err.message?.includes('Missing or insufficient permissions')) {
        import('@/lib/firebase').then(({ db }) => {
          import('firebase/firestore').then(({ terminate }) => {
            terminate(db).catch(() => {}).finally(() => window.location.reload());
          });
        });
      }
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
    // Firestore rejects undefined field values (e.g. citations with no pageSection).
    // JSON round-trip strips all undefined keys before the write.
    const safeMessage = JSON.parse(JSON.stringify(message));
    await updateDoc(doc(db, "chats", chatId), {
      messages: arrayUnion(safeMessage),
      updatedAt: Date.now(),
    });
  };

  /** Patch a single message at msgIdx (e.g. to add executedAction). */
  const patchMessage = async (
    chatId: string,
    msgIdx: number,
    patch: Partial<ChatMessage>
  ) => {
    const snap = await getDoc(doc(db, "chats", chatId));
    if (!snap.exists()) return;
    const data = snap.data() as ChatSession;
    const messages = [...data.messages];
    if (msgIdx < 0 || msgIdx >= messages.length) return;
    messages[msgIdx] = JSON.parse(JSON.stringify({ ...messages[msgIdx], ...patch }));
    await updateDoc(doc(db, "chats", chatId), { messages, updatedAt: Date.now() });
  };

  const renameChat = async (chatId: string, title: string) => {
    await updateDoc(doc(db, "chats", chatId), { title });
  };

  const removeChat = async (chatId: string) => {
    await deleteDoc(doc(db, "chats", chatId));
  };

  return { chats, loading, createChat, addMessage, patchMessage, renameChat, removeChat };
}
