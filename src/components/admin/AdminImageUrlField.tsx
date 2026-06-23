"use client";

import { useState } from "react";
import PickFromCloudinaryButton from "@/components/admin/PickFromCloudinaryButton";
import type { CloudinaryFolderId } from "@/lib/cloudinary/adminImageUploadConstants";

type Props = {
  name: string;
  label?: string;
  folder: CloudinaryFolderId;
  value?: string;
  onChange?: (url: string) => void;
  defaultValue?: string;
  className?: string;
};

/** URL input with a Cloudinary library picker (marketing forms). */
export default function AdminImageUrlField({
  name,
  label = "Image URL",
  folder,
  value,
  onChange,
  defaultValue = "",
  className = "",
}: Props) {
  const [internal, setInternal] = useState(defaultValue);
  const url = value !== undefined ? value : internal;

  function setUrl(next: string) {
    if (onChange) onChange(next);
    else setInternal(next);
  }

  return (
    <label className={className}>
      <span className="text-sm font-medium">{label}</span>
      <div className="mt-1 flex flex-wrap gap-2">
        <input
          name={name}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://… or pick from Cloudinary"
          className="min-w-0 flex-1 rounded-lg border border-gray-3 px-3 py-2 text-sm"
        />
        <PickFromCloudinaryButton
          folder={folder}
          multiple={false}
          label="Pick image"
          onSelect={(urls) => {
            if (urls[0]) setUrl(urls[0]);
          }}
        />
      </div>
    </label>
  );
}
