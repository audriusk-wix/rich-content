import { RichContentTheme, PaletteColors, ThemeUtils } from 'wix-rich-content-common';
import { ReactElement } from 'react';
import { EditorPluginConfig, ViewerPluginConfig } from './types';
export type RicosCssOverride = RichContentTheme;

export interface ThemeGeneratorFunction {
  (colors: PaletteColors, utils: ThemeUtils): Record<string, unknown>;
}

export interface Color {
  name: string;
  reference: string;
  value: string;
}

export type Palette = Color[];

export interface RicosTheme {
  palette?: Palette | PalettePreset;
  parentClass?: string;
}

export interface ThemeStrategyArgs {
  isViewer: boolean;
  plugins?: (EditorPluginConfig & ViewerPluginConfig)[];
}

export interface ThemeStrategyResult {
  theme: RicosCssOverride;
  html?: ReactElement;
}

export type ThemeStrategyFunction = (args: ThemeStrategyArgs) => ThemeStrategyResult;
export type ThemeStrategyCreatorFunction = () => ThemeStrategyFunction;

export type PalettePreset = 'darkTheme';