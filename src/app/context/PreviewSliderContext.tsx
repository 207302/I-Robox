"use client";
import React, { createContext, useContext, useState } from "react";

export type PreviewGalleryData = {
  images: string[];
  title: string;
};

interface PreviewSliderType {
  isModalPreviewOpen: boolean;
  previewStartIndex: number;
  previewGallery: PreviewGalleryData | null;
  openPreviewModal: (startIndex?: number, gallery?: PreviewGalleryData) => void;
  closePreviewModal: () => void;
}

const PreviewSlider = createContext<PreviewSliderType | undefined>(undefined);

export const usePreviewSlider = () => {
  const context = useContext(PreviewSlider);
  if (!context) {
    throw new Error("usePreviewSlider must be used within a ModalProvider");
  }
  return context;
};

export const PreviewSliderProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [isModalPreviewOpen, setIsModalOpen] = useState(false);
  const [previewStartIndex, setPreviewStartIndex] = useState(0);
  const [previewGallery, setPreviewGallery] = useState<PreviewGalleryData | null>(null);

  const openPreviewModal = (startIndex = 0, gallery?: PreviewGalleryData) => {
    setPreviewStartIndex(Math.max(0, startIndex));
    setPreviewGallery(gallery ?? null);
    setIsModalOpen(true);
  };

  const closePreviewModal = () => {
    setIsModalOpen(false);
    setPreviewGallery(null);
  };

  return (
    <PreviewSlider.Provider
      value={{
        isModalPreviewOpen,
        previewStartIndex,
        previewGallery,
        openPreviewModal,
        closePreviewModal,
      }}
    >
      {children}
    </PreviewSlider.Provider>
  );
};
