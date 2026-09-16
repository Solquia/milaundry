/**
 * The box a screen is actually being drawn in.
 *
 * On the web that is not the browser window: `web-frame.tsx` holds the app to
 * a phone-width column, and a page that asked `useWindowDimensions()` would
 * lay out a 1440px desktop inside a 430px strip — a second column of prices
 * folded over itself, an aside with nowhere to stand. Everything that changes
 * shape with its width reads it from here instead, and the frame is the one
 * place that decides what that width is.
 *
 * Height is the window's either way: the column is as tall as the screen.
 * Off the web, and in any tree without a provider, this is the window.
 */
import React, { createContext, useContext, useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

export interface Viewport {
  width: number;
  height: number;
}

const ViewportContext = createContext<Viewport | null>(null);

export function ViewportProvider({ width, height, children }: Viewport & { children: React.ReactNode }) {
  const value = useMemo(() => ({ width, height }), [width, height]);
  return <ViewportContext.Provider value={value}>{children}</ViewportContext.Provider>;
}

export function useViewport(): Viewport {
  const window = useWindowDimensions();
  const framed = useContext(ViewportContext);
  return framed ?? { width: window.width, height: window.height };
}
