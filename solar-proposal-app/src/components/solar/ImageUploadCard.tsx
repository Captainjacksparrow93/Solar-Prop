"use client";

import { useRef, useState } from "react";
import { Upload, Loader2, CheckCircle, AlertCircle, X } from "lucide-react";
import { toast } from "@/components/ui/Toaster";

interface Props {
  leadId: string;
  existingImageUrl?: string;
  onImageUploaded: (url: string, analyzing: boolean) => void;
}

export function ImageUploadCard({
  leadId,
  existingImageUrl,
  onImageUploaded,
}: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(
    existingImageUrl || null
  );
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await uploadFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      uploadFile(files[0]);
    }
  };

  const uploadFile = async (file: File) => {
    setError(null);
    setUploading(true);

    try {
      // Validate file type
      const validTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!validTypes.includes(file.type)) {
        throw new Error("Invalid file type. Accept JPEG, PNG, WebP only");
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        throw new Error("File too large. Maximum 10MB");
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("leadId", leadId);

      const res = await fetch("/api/solar/upload-image", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }

      const data = await res.json();
      setImageUrl(data.url);
      toast("Image uploaded successfully!", "success");
      onImageUploaded(data.url, true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setError(message);
      toast(message, "error");
    } finally {
      setUploading(false);
    }
  };

  const clearImage = () => {
    setImageUrl(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  if (imageUrl) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <h3 className="text-lg font-semibold text-white">
              Image Uploaded
            </h3>
          </div>
          <button
            onClick={clearImage}
            className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="rounded-lg overflow-hidden border border-slate-700 mb-4">
          <img
            src={imageUrl}
            alt="Building top view"
            className="w-full h-64 object-cover"
          />
        </div>

        <p className="text-sm text-slate-400 text-center">
          Ready to detect zones. Click the "Detect Zones" button to analyze this image.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-white mb-4">
        Upload Building Top View
      </h3>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-xl p-8 transition-all ${
          isDragging
            ? "border-orange-400 bg-orange-400/10"
            : error
              ? "border-red-400 bg-red-400/10"
              : "border-slate-700 hover:border-orange-400/50 hover:bg-slate-800/30"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileSelect}
          disabled={uploading}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />

        <div className="flex flex-col items-center gap-3">
          {uploading ? (
            <>
              <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
              <p className="text-slate-300 font-medium">Uploading...</p>
            </>
          ) : (
            <>
              <Upload className="w-8 h-8 text-slate-400" />
              <div className="text-center">
                <p className="text-slate-200 font-medium">
                  Drag and drop your image here
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  or click to browse
                </p>
              </div>
              <p className="text-xs text-slate-500">
                JPEG, PNG, or WebP • Max 10MB
              </p>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}
    </div>
  );
}
