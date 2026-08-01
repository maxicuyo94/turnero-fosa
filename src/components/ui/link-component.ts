import type { ElementType, ReactNode } from "react";

export type NavLinkProps = {
  href: string;
  className?: string;
  children?: ReactNode;
};

/**
 * Anything that renders a navigable link. Defaults to the intrinsic `a` so the
 * library stays framework-free; a Next.js app passes its own `Link` to keep
 * client-side navigation.
 */
export type LinkComponent = ElementType<NavLinkProps>;
