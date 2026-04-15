"use client";

import { useEffect, useState } from "react";
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DocumentRecord } from "@/lib/store";

export function useDocuments(tenantId: string | undefined) {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) { setDocuments([]); setLoading(false); return; }

    const q = query(
      collection(db, "documents"),
      where("tenantId", "==", tenantId),
      orderBy("timestamp", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      setDocuments(snap.docs.map((d) => ({ ...(d.data() as DocumentRecord), id: d.id })));
      setLoading(false);
    }, (err) => {
      console.error("[useDocuments] snapshot error:", err);
      setLoading(false);
    });

    return unsub;
  }, [tenantId]);

  const addDocument = async (doc_: Omit<DocumentRecord, "id"> & { id: string }) => {
    await addDoc(collection(db, "documents"), doc_);
  };

  const updateDocument = async (id: string, updates: Partial<DocumentRecord>) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await updateDoc(doc(db, "documents", id), updates as any);
  };

  const removeDocument = async (id: string) => {
    await deleteDoc(doc(db, "documents", id));
  };

  return { documents, loading, addDocument, updateDocument, removeDocument };
}
