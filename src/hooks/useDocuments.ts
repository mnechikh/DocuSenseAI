"use client";

import { useEffect, useState } from "react";
import { collection, query, where, orderBy, onSnapshot, setDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
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
  }, [tenantId]);

  const addDocument = async (doc_: Omit<DocumentRecord, "id"> & { id: string }) => {
    const { id, ...data } = doc_;
    await setDoc(doc(db, "documents", id), { ...data, id });
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
