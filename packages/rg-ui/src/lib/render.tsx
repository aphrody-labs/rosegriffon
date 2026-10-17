"use client";

import { useRender } from "@base-ui/react/use-render";
import {
  Children,
  isValidElement,
  type ComponentProps,
  type ElementType,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";

export type PrimitiveProps<T extends ElementType> = Omit<ComponentProps<T>, "className"> & {
  className?: string;
  asChild?: boolean;
};

export function childRender(asChild: boolean | undefined, children: ReactNode): ReactElement | undefined {
  if (!asChild) return undefined;
  const child = Children.only(children);
  if (!isValidElement(child)) throw new Error("asChild requires one React element");
  return child;
}

/** Composants qui rendent eux-mêmes un vrai <button> (ex. `Button` sans `asChild`). */
const NATIVE_BUTTON_COMPONENTS = new WeakSet<object>();

export function markNativeButton<T extends object>(component: T): T {
  NATIVE_BUTTON_COMPONENTS.add(component);
  return component;
}

/**
 * Valeur de `nativeButton` pour un déclencheur Base UI rendu via `asChild` :
 * vrai si l'élément final est un <button>, y compris quand l'enfant est notre
 * `Button`. Sans cela, `<XTrigger asChild><Button/></XTrigger>` annonçait un
 * non-bouton alors que le DOM contient un <button> (avertissement Base UI et
 * attributs `role`/`aria-disabled` superflus).
 */
export function rendersNativeButton(child: ReactElement | undefined): boolean {
  if (!child) return true;
  if (child.type === "button") return true;
  if (typeof child.type === "object" || typeof child.type === "function") {
    const props = child.props as { asChild?: boolean };
    return NATIVE_BUTTON_COMPONENTS.has(child.type) && !props.asChild;
  }
  return false;
}

export function Slot({
  children,
  ref,
  ...props
}: HTMLAttributes<HTMLElement> & { children?: ReactNode; ref?: Ref<HTMLElement> }) {
  return useRender({ render: childRender(true, children), ref, props });
}
