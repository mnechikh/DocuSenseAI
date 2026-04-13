"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type UserRole = "Admin" | "User";

export interface UserProfile {
  userId: string;
  tenantId: string;
  email: string;
  role: UserRole;
  name: string;
}

export interface DocumentRecord {
  id: string;
  tenantId: string;
  filename: string;
  fileType: string;
  status: "uploaded" | "processing" | "indexed" | "failed";
  timestamp: number;
  chunkCount?: number;
  failureReason?: string;
}

export interface ChatMessage {
  role: "user" | "model";
  content: string;
  citations?: { documentName: string; pageSection?: string }[];
}

export interface ChatSession {
  id: string;
  tenantId: string;
  userId: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}

interface DocuSenseState {
  currentUser: UserProfile | null;
  documents: DocumentRecord[];
  chats: ChatSession[];
  
  // Auth Actions
  login: (email: string, tenantId: string, role: UserRole) => void;
  logout: () => void;
  
  // Document Actions
  addDocument: (doc: DocumentRecord) => void;
  updateDocumentStatus: (id: string, status: DocumentRecord["status"], updates?: Partial<DocumentRecord>) => void;
  deleteDocument: (id: string) => void;
  
  // Chat Actions
  createChat: (title: string) => string;
  addMessageToChat: (chatId: string, message: ChatMessage) => void;
  deleteChat: (chatId: string) => void;
  renameChat: (chatId: string, newTitle: string) => void;
}

export const useStore = create<DocuSenseState>()(
  persist(
    (set) => ({
      currentUser: null,
      documents: [],
      chats: [],
      
      login: (email, tenantId, role) => set({
        currentUser: {
          userId: Math.random().toString(36).substr(2, 9),
          tenantId,
          email,
          role,
          name: email.split('@')[0]
        }
      }),
      
      logout: () => set({ currentUser: null }),
      
      addDocument: (doc) => set((state) => ({
        documents: [doc, ...state.documents]
      })),
      
      updateDocumentStatus: (id, status, updates) => set((state) => ({
        documents: state.documents.map((d) => 
          d.id === id ? { ...d, status, ...updates } : d
        )
      })),
      
      deleteDocument: (id) => set((state) => ({
        documents: state.documents.filter((d) => d.id !== id)
      })),
      
      createChat: (title) => {
        const id = Math.random().toString(36).substr(2, 9);
        set((state) => {
          if (!state.currentUser) return state;
          return {
            chats: [
              {
                id,
                tenantId: state.currentUser.tenantId,
                userId: state.currentUser.userId,
                title,
                messages: [],
                updatedAt: Date.now()
              },
              ...state.chats
            ]
          };
        });
        return id;
      },
      
      addMessageToChat: (chatId, message) => set((state) => ({
        chats: state.chats.map((c) => 
          c.id === chatId ? { 
            ...c, 
            messages: [...c.messages, message],
            updatedAt: Date.now()
          } : c
        )
      })),
      
      deleteChat: (chatId) => set((state) => ({
        chats: state.chats.filter((c) => c.id !== chatId)
      })),
      
      renameChat: (chatId, newTitle) => set((state) => ({
        chats: state.chats.map((c) => 
          c.id === chatId ? { ...c, title: newTitle } : c
        )
      })),
    }),
    {
      name: "docusense-storage",
    }
  )
);
