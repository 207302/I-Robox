"use client";
import React, { createContext, useContext, useState } from "react";

interface PreviewSliderType {
  isModalPreviewOpen: boolean;
  previewStartIndex: number;
  openPreviewModal: (startIndex?: number) => void;
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

  const openPreviewModal = (startIndex = 0) => {
    setPreviewStartIndex(Math.max(0, startIndex));
    setIsModalOpen(true);
  };

  const closePreviewModal = () => {
    setIsModalOpen(false);
  };

  return (
    <PreviewSlider.Provider
      value={{ isModalPreviewOpen, previewStartIndex, openPreviewModal, closePreviewModal }}
    >
      {children}
    </PreviewSlider.Provider>
  );
};
