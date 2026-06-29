"use client";

import { Editor } from "@tinymce/tinymce-react";

type Props = {
  value: string;
  onChange: (html: string) => void;
  /** Remount editor when switching page (avoids stale iframe state). */
  editorKey: string;
  height?: number;
};

export default function QuickLinkHtmlEditor({
  value,
  onChange,
  editorKey,
  height = 380,
}: Props) {
  return (
    <div className="mt-1 overflow-hidden rounded-lg border border-gray-3 [&_.tox-tinymce]:rounded-lg">
      <Editor
        key={editorKey}
        licenseKey="gpl"
        tinymceScriptSrc="/tinymce/tinymce.min.js"
        value={value}
        onEditorChange={(html) => onChange(html)}
        init={{
          height,
          menubar: false,
          branding: false,
          promotion: false,
          plugins: ["lists", "link", "autoresize"],
          toolbar:
            "undo redo | blocks | bold italic underline | fontsize | bullist numlist | link | removeformat",
          block_formats: "Paragraph=p; Heading 1=h1; Heading 2=h2; Heading 3=h3; Heading 4=h4",
          font_size_formats: "12pt 14pt 16pt 18pt 20pt 24pt",
          content_style:
            "@import url('https://api.fontshare.com/v2/css?f[]=clash-display@400,500,600,700&display=swap'); body { font-family: 'Clash Display', ui-sans-serif, system-ui, sans-serif; font-size: 14px; font-weight: 500; line-height: 1.6; } h1, h2, h3, h4 { font-weight: 600; }",
          relative_urls: false,
          convert_urls: true,
        }}
      />
    </div>
  );
}
