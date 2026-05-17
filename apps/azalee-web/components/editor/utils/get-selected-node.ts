import { $isRootNode, type ElementNode, type RangeSelection, type TextNode } from "lexical";

export function getSelectedNode(selection: RangeSelection): TextNode | ElementNode {
  const anchorNode = selection.anchor.getNode();
  const focusNode = selection.focus.getNode();
  if (anchorNode === focusNode) {
    return anchorNode;
  }
  const isBackward = selection.isBackward();
  if (isBackward) {
    return $isRootNode(focusNode) ? focusNode : focusNode.getParentOrThrow();
  } else {
    return $isRootNode(anchorNode) ? anchorNode : anchorNode.getParentOrThrow();
  }
}
