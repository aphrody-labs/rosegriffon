"use client";

import type { LexicalEditor } from "lexical";
import { createContext, type JSX, useContext } from "react";

const Context = createContext<{
  activeEditor: LexicalEditor;
  $updateToolbar: () => void;
  blockType: string;
  setBlockType: (blockType: string) => void;
  showModal: (title: string, showModal: (onClose: () => void) => JSX.Element) => void;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  isStrikethrough: boolean;
  isCode: boolean;
  isLink: boolean;
}>({
  activeEditor: {} as LexicalEditor,
  $updateToolbar: () => {},
  blockType: "paragraph",
  setBlockType: () => {},
  showModal: () => {},
  isBold: false,
  isItalic: false,
  isUnderline: false,
  isStrikethrough: false,
  isCode: false,
  isLink: false,
});

export function ToolbarContext({
  activeEditor,
  $updateToolbar,
  blockType,
  setBlockType,
  showModal,
  isBold,
  isItalic,
  isUnderline,
  isStrikethrough,
  isCode,
  isLink,
  children,
}: {
  activeEditor: LexicalEditor;
  $updateToolbar: () => void;
  blockType: string;
  setBlockType: (blockType: string) => void;
  showModal: (title: string, showModal: (onClose: () => void) => JSX.Element) => void;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  isStrikethrough: boolean;
  isCode: boolean;
  isLink: boolean;
  children: React.ReactNode;
}) {
  return (
    <Context.Provider
      value={{
        activeEditor,
        $updateToolbar,
        blockType,
        setBlockType,
        showModal,
        isBold,
        isItalic,
        isUnderline,
        isStrikethrough,
        isCode,
        isLink,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useToolbarContext() {
  return useContext(Context);
}
