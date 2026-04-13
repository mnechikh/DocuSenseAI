"use client";

import { useState } from "react";
import { useStore, DocumentRecord } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Upload, 
  FileText, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Plus,
  ArrowUpCircle,
  Info
} from "lucide-react";
import { uploadAndProcessDocumentForAIAnalysis } from "@/ai/flows/upload-and-process-document-for-ai-analysis";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export default function DocumentsPage() {
  const { currentUser, documents, addDocument, updateDocumentStatus, deleteDocument } = useStore();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);

  if (currentUser?.role !== "Admin") {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center p-6">
        <AlertCircle className="w-12 h-12 text-destructive mb-4" />
        <h2 className="text-2xl font-bold">Access Denied</h2>
        <p className="text-muted-foreground">Only administrators can manage documents.</p>
      </div>
    );
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    const allowedTypes = [
      'application/pdf', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
      'text/plain', 
      'text/csv', 
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload PDF, DOCX, TXT, CSV or XLSX.",
        variant: "destructive"
      });
      return;
    }

    const docId = Math.random().toString(36).substr(2, 9);
    const newDoc: DocumentRecord = {
      id: docId,
      tenantId: currentUser.tenantId,
      filename: file.name,
      fileType: file.type.split('/')[1].toUpperCase(),
      status: "uploaded",
      timestamp: Date.now()
    };

    setIsUploading(true);
    addDocument(newDoc);

    try {
      // Step 1: Read file as Data URI locally
      const dataUri = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (err) => {
          console.error("FileReader error:", err);
          reject(new Error("Failed to read local file."));
        };
        reader.readAsDataURL(file);
      });
      
      updateDocumentStatus(docId, "processing");
      
      // Step 2: Send to Server Action (Flow)
      const result = await uploadAndProcessDocumentForAIAnalysis({
        tenantId: currentUser.tenantId,
        documentId: docId,
        filename: file.name,
        fileType: file.type,
        documentDataUri: dataUri
      });

      if (result.status === "processed") {
        updateDocumentStatus(docId, "indexed", { chunkCount: result.chunkCount });
        toast({
          title: "Success",
          description: `${file.name} has been processed and indexed.`
        });
      } else {
        updateDocumentStatus(docId, "failed", { failureReason: result.message });
        toast({
          title: "Processing Failed",
          description: result.message,
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error("Upload error caught in UI:", error);
      const errorMessage = error.message?.includes("exceeded 1 MB limit") 
        ? "The file is too large for the current configuration. Please try a smaller file."
        : "An unexpected error occurred during document upload.";
      
      updateDocumentStatus(docId, "failed", { failureReason: errorMessage });
      toast({
        title: "Upload Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      // Reset input for next selection
      e.target.value = "";
    }
  };

  const tenantDocs = documents.filter(d => d.tenantId === currentUser?.tenantId);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Knowledge Management</h1>
          <p className="text-muted-foreground mt-1">
            Upload and index business documents for your AI workspace.
          </p>
        </div>
        <div className="relative">
          <Input 
            type="file" 
            className="hidden" 
            id="doc-upload" 
            onChange={handleFileUpload}
            disabled={isUploading}
            accept=".pdf,.docx,.txt,.csv,.xlsx"
          />
          <Button asChild className="bg-primary hover:bg-primary/90 shadow-md" disabled={isUploading}>
            <label htmlFor="doc-upload" className={isUploading ? "cursor-not-allowed opacity-70 flex items-center" : "cursor-pointer flex items-center"}>
              {isUploading ? <Clock className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              {isUploading ? "Uploading..." : "Add New Document"}
            </label>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        <Card className="border-none shadow-sm overflow-hidden">
          <CardHeader className="bg-white/50 border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Document Inventory</CardTitle>
                <CardDescription>All indexed material available for RAG</CardDescription>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className="text-[10px] uppercase font-bold text-primary border-primary/20">
                  {tenantDocs.length} Total Files
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="w-[300px]">Filename</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Chunks</TableHead>
                  <TableHead>Date Added</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenantDocs.length > 0 ? (
                  tenantDocs.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          {doc.filename}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px] font-bold">
                          {doc.fileType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {doc.status === "indexed" ? (
                          <div className="flex items-center gap-1.5 text-green-600">
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="text-xs font-semibold">Ready</span>
                          </div>
                        ) : doc.status === "processing" ? (
                          <div className="flex items-center gap-1.5 text-blue-600">
                            <Clock className="w-4 h-4 animate-spin" />
                            <span className="text-xs font-semibold">Indexing</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-destructive">
                            <AlertCircle className="w-4 h-4" />
                            <span className="text-xs font-semibold" title={doc.failureReason}>Error</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground tabular-nums">
                        {doc.chunkCount || "--"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(doc.timestamp).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => deleteDocument(doc.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-40 text-center">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <ArrowUpCircle className="w-10 h-10 opacity-20 mb-3" />
                        <p>No documents found for your tenant.</p>
                        <p className="text-xs">Upload your first file to begin building your knowledge base.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-none shadow-sm bg-accent/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Info className="w-4 h-4 text-accent" />
                Data Privacy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground leading-relaxed">
                All uploaded documents are isolated to your specific tenant index. No other users or tenants can access this data.
              </p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-accent/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Info className="w-4 h-4 text-accent" />
                Processing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Text is extracted, chunked with semantic overlap, and vectorized using high-dimensional embeddings for precise retrieval.
              </p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-accent/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Info className="w-4 h-4 text-accent" />
                Audit Log
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Every upload, deletion, and indexing operation is logged for compliance and security auditing purposes.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
