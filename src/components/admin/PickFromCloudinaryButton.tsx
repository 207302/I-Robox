"use client";

import { useState } from "react";
import CloudinaryImagePickerModal from "@/components/admin/CloudinaryImagePickerModal";
import type { CloudinaryFolderId } from "@/lib/cloudinary/adminImageUploadConstants";

type Props = {
  onSelect: (urls: string[]) => void;
  folder?: CloudinaryFolderId;
  multiple?: boolean;
  disabled?: boolean;
  label?: string;
  className?: string;
};

export default function PickFromCloudinaryButton({
  onSelect,
  folder = "irobox/products",
  multiple = true,
  disabled,
  label = "From Cloudinary",
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={
          className ||
          "rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm font-medium text-dark hover:bg-gray-1 disabled:opacity-60"
        }
      >
        {label}
      </button>
      <CloudinaryImagePickerModal
        open={open}
        onClose={() => setOpen(false)}
        onSelect={onSelect}
        defaultFolder={folder}
        multiple={multiple}
      />
    </>
  );
}
