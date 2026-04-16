import * as React from "react";
import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import axios from "axios";
import { 
  Upload, 
  File, 
  X, 
  Calendar as CalendarIcon, 
  ChevronLeft,
  ChevronRight,
  Cloud,
  CheckCircle2,
  Clock,
  ChevronDown,
  FileText,
  Image as ImageIcon,
  Download as DownloadIcon,
  Loader2
} from "lucide-react";
import { format } from "date-fns";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Toaster } from "sonner";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const CHUNK_SIZE = 1 * 1024 * 1024; // 1MB
const SERVER_URL = "http://localhost:7000"; // Use relative paths for integrated backend

interface UploadedFile {
  id: string;
  name: string;
  size: string;
  type: string;
  date: Date;
  color: string;
  progress?: number;
  isUploading?: boolean;
}

const FILE_COLORS = [
  "bg-emerald-100 text-emerald-500",
  "bg-orange-100 text-orange-500",
  "bg-yellow-100 text-yellow-500",
  "bg-blue-100 text-blue-500",
  "bg-purple-100 text-purple-500",
  "bg-pink-100 text-pink-500",
];

interface CloudVaultProps {
  title?: string;
  maxSize?: number; // in GB per image1 text, though user's older code had 25MB logic parts, the UI says 25GB. Let's stick to the visual 25GB logic for the label, but implementation depends on chunks.
  allowedTypes?: string[];
  onSave?: (files: UploadedFile[]) => void;
  onClose?: () => void;
}

export function CloudVault({ 
  title = "UPLOAD FILES", 
  maxSize = 25, 
  onSave,
  onClose 
}: CloudVaultProps) {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<Record<string, number>>({});
  const [isDragging, setIsDragging] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch files from server
  const fetchFiles = useCallback(async () => {
    try {
      const res = await axios.get(`${SERVER_URL}/api/files`);
      const remoteFiles = (res.data || []).map((file: any, index: number) => ({
        id: file.name,
        name: file.name,
        size: (file.size || 0).toString() + " MB",
        type: file.name.split('.').pop() || "file",
        date: new Date(), // Server might not provide date in this simple API
        color: FILE_COLORS[index % FILE_COLORS.length]
      }));
      setFiles(remoteFiles);
    } catch (err) {
      console.error("Error fetching files", err);
      toast.error("Could not fetch remote files");
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const fileUpload = async (file: File, fileId: string, start: number) => {
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);

    try {
      await axios.post(`${SERVER_URL}/upload/files`, chunk, {
        headers: {
          "Content-Type": "application/octet-stream",
          "x-file-name": fileId,
          "content-range": `${start}-${end - 1}/${file.size}`,
          "file-size": file.size,
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = ((start + progressEvent.loaded) / file.size) * 100;
            setUploadingFiles(prev => ({ ...prev, [fileId]: percentCompleted }));
          }
        }
      });

      if (end < file.size) {
        fileUpload(file, fileId, end);
      } else {
        await axios.post(`${SERVER_URL}/upload/complete`, null, {
          headers: { "x-file-name": fileId }
        });
        toast.success(`${file.name} uploaded!`);
        setUploadingFiles(prev => {
          const next = { ...prev };
          delete next[fileId];
          return next;
        });
        fetchFiles();
      }
    } catch (err) {
      console.error("Chunk upload failed", err);
      setTimeout(() => fileUpload(file, fileId, start), 1000);
    }
  };

  const handleUpload = (newFiles: FileList | null) => {
    if (!newFiles) return;
    
    setIsDragging(false);
    Array.from(newFiles).forEach(file => {
      const fileId = `${file.size}-${file.lastModified}-${file.name}`;
      setUploadingFiles(prev => ({ ...prev, [fileId]: 0 }));
      fileUpload(file, fileId, 0);
    });
  };

  const handleDownload = (filename: string) => {
    try {
      const link = document.createElement("a");
      link.href = `${SERVER_URL}/download/${filename}`;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.info(`Downloading ${filename}`);
    } catch (err) {
      console.error("Download error:", err);
      toast.error("Download failed");
    }
  };

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const { scrollLeft } = scrollRef.current;
      const scrollTo = direction === "left" ? scrollLeft - 200 : scrollLeft + 200;
      scrollRef.current.scrollTo({ left: scrollTo, behavior: "smooth" });
    }
  };

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative w-full max-w-3xl"
    >
      {/* Close Button */}
      <button 
        onClick={onClose}
        className="absolute -top-3 -right-3 z-10 w-8 h-8 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-rose-600 transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      <Card className="border-none shadow-[0_20px_50px_rgba(0,0,0,0.1)] rounded-[3.5rem] overflow-hidden bg-white p-6 md:p-12">
        <CardContent className="p-0 space-y-4 md:space-y-8">
          
          {/* Header Area */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1 flex justify-center md:justify-start">
              <div className="flex items-center gap-6">
                <div className="h-[3px] w-16 bg-orange-400/20 rounded-full hidden sm:block" />
                <h1 className="text-3xl font-black text-orange-500 tracking-[0.1em] uppercase drop-shadow-sm">{title}</h1>
                <div className="h-[3px] w-16 bg-orange-400/20 rounded-full hidden sm:block" />
              </div>
            </div>

            <Popover>
              <PopoverTrigger className={cn(
                buttonVariants({ variant: "outline" }),
                "rounded-xl border-slate-200 text-slate-500 h-11 px-5 gap-3 bg-white shadow-sm font-medium"
              )}>
                <CalendarIcon className="w-4 h-4" />
                <span>Sort by Date</span>
                <ChevronDown className="w-4 h-4 opacity-40 ml-1" />
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
              </PopoverContent>
            </Popover>
          </div>

          {/* Dropzone */}
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={(e) => {
              e.preventDefault();
              handleUpload(e.dataTransfer.files);
            }}
            className={cn(
              "relative rounded-[3.5rem] border-2 border-dashed transition-all duration-500 py-10 md:py-16 px-6 md:px-12 flex flex-col items-center justify-center text-center gap-6",
              isDragging 
                ? "border-blue-400 bg-blue-50/40 scale-[0.99]" 
                : "border-blue-200 bg-white hover:border-blue-300 hover:bg-slate-50/30 shadow-[0_10px_30px_rgba(37,99,235,0.03)]"
            )}
          >
            <input type="file" multiple className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleUpload(e.target.files)} />
            
            <div className="relative mb-2">
              <div className="absolute -inset-6 bg-blue-50/80 rounded-full blur-3xl opacity-50" />
              <div className="relative w-28 h-28 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center justify-center opacity-80">
                  <File className="w-16 h-16 text-blue-300 rotate-[-20deg] translate-x-[-12px] blur-[1px]" />
                  <File className="w-16 h-16 text-blue-400 rotate-[-5deg]" />
                  <File className="w-16 h-16 text-blue-600 rotate-[15deg] translate-x-[12px] shadow-[0_8px_15px_rgba(37,99,235,0.15)]" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center shadow-lg border-4 border-white">
                  <Upload className="w-5 h-5 text-white stroke-[3px]" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-3xl md:text-4xl font-extrabold text-slate-800 tracking-tight">Drag & Drop</h2>
              <p className="text-slate-500 font-medium text-lg">Your files here Or <span className="text-blue-600 font-bold cursor-pointer hover:underline">Browse</span> to upload</p>
              <p className="text-[10px] text-blue-400/80 mt-4 font-black uppercase tracking-[0.2em]">ANY FILES UPTO {maxSize} GB CAN BE UPLOADED</p>
            </div>
          </div>

          {/* Carousel */}
          <div className="relative px-2">
            <button 
              onClick={() => scroll("left")}
              className="absolute -left-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 bg-white border border-slate-100 rounded-full flex items-center justify-center shadow-md hover:bg-slate-50 transition-all hover:scale-110 active:scale-95 text-slate-400"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <div 
              ref={scrollRef}
              className="flex gap-6 overflow-x-auto scrollbar-hide px-8 py-4 snap-x"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              <AnimatePresence mode="popLayout">
                {/* Currently Uploading Files */}
                {Object.entries(uploadingFiles).map(([id, progress]) => {
                  const progressValue = progress as number;
                  return (
                    <motion.div
                      key={`uploading-${id}`}
                      layout
                      initial={{ opacity: 0, scale: 0.8, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="flex-shrink-0 snap-center flex flex-col items-center gap-3"
                    >
                      <div className="relative w-28 h-28 rounded-[2rem] bg-blue-50 flex flex-col items-center justify-center border-2 border-blue-200 border-dashed">
                        <div className="flex flex-col items-center justify-center gap-2 p-4 w-full h-full">
                          <div className="relative flex items-center justify-center">
                            <Loader2 className="w-10 h-10 text-blue-500 animate-spin opacity-20" />
                            <span className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-blue-600">
                              {Math.round(progressValue)}%
                            </span>
                          </div>
                          <div className="w-full bg-blue-100 h-2 rounded-full overflow-hidden shadow-inner">
                            <div 
                              className="bg-blue-500 h-full transition-all duration-300 ease-out shadow-[0_0_8px_rgba(59,130,246,0.5)]" 
                              style={{ width: `${progressValue}%` }} 
                            />
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100 animate-pulse">
                        UPLOADING...
                      </span>
                    </motion.div>
                  );
                })}

                {/* Remote Files */}
                {files.length === 0 && Object.keys(uploadingFiles).length === 0 && (
                  <div className="w-full h-28 flex items-center justify-center text-slate-300 italic font-medium">
                    No files found in vault
                  </div>
                )}
                {files.map((file) => (
                  <motion.div
                    key={file.id}
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="group flex-shrink-0 snap-center flex flex-col items-center gap-3"
                    onClick={() => handleDownload(file.name)}
                  >
                    <div className={cn(
                      "relative w-28 h-28 rounded-[2rem] flex items-center justify-center shadow-sm transition-all group-hover:scale-105 group-hover:shadow-lg cursor-pointer",
                      file.color
                    )}>
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="bg-white/90 p-1 rounded-full shadow-sm">
                          <DownloadIcon className="w-3 h-3 text-slate-600" />
                        </div>
                      </div>
                      {file.type === "pdf" ? <FileText className="w-12 h-12" /> : <ImageIcon className="w-12 h-12" />}
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded-full">
                        {format(file.date, "MMM d, yyyy")}
                      </span>
                      <span className="text-[10px] font-bold text-slate-300 max-w-[80px] truncate">{file.name}</span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <button 
              onClick={() => scroll("right")}
              className="absolute -right-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 bg-white border border-slate-100 rounded-full flex items-center justify-center shadow-md hover:bg-slate-50 transition-all hover:scale-110 active:scale-95 text-slate-400"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Pagination Indicators */}
          <div className="flex items-center justify-center gap-2 py-2">
            <div className="h-[2px] w-20 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full w-2/3 bg-slate-300 rounded-full" />
            </div>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className={cn("w-2 h-2 rounded-full transition-all duration-300", i === 1 ? "bg-slate-400 scale-110" : "bg-slate-200")} />
              ))}
            </div>
            <div className="h-[2px] w-20 bg-slate-100 rounded-full" />
          </div>

          {/* Footer Button */}
          <div className="flex flex-col items-center gap-6 pt-4">
            <div className="w-full flex justify-center">
              <Button 
                onClick={() => onSave?.(files)}
                className="group relative z-10 bg-blue-600 hover:bg-blue-700 text-white rounded-[2rem] px-20 h-16 text-xl font-black shadow-[0_15px_40px_rgba(37,99,235,0.4)] tracking-[0.05em] uppercase transition-all hover:translate-y-[-2px] active:translate-y-[1px] overflow-hidden"
              >
                <div className="absolute inset-x-0 bottom-0 h-1 bg-blue-800 opacity-20" />
                SAVE FILES
              </Button>
            </div>
          </div>

        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans selection:bg-blue-100">
      <Toaster position="top-center" />
      <CloudVault 
        onSave={() => toast.success(`Vault state saved!`)}
        onClose={() => toast.info("Vault closed")}
      />
    </div>
  );
}

