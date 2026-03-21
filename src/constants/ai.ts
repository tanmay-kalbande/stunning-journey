import { ModelProvider } from '../types';

export const AI_SUITE_NAME = 'Injin Stack';
export const APP_AI_BRANDLINE = 'Pustakam Injin';

export const ZHIPU_PROVIDER: ModelProvider = 'zhipu';

export const ZHIPU_MODELS: Array<{
  provider: ModelProvider;
  model: 'glm-5' | 'glm-5-turbo' | 'glm-4.7' | 'glm-4.7-flashx';
  name: string;
  tagline: string;
}> = [
  {
    provider: ZHIPU_PROVIDER,
    model: 'glm-5',
    name: 'GLM-5 Maharaja',
    tagline: 'Flagship depth for the heaviest chapters',
  },
  {
    provider: ZHIPU_PROVIDER,
    model: 'glm-5-turbo',
    name: 'GLM-5 Turbo Tez',
    tagline: 'Fast premium drafting with sharp structure',
  },
  {
    provider: ZHIPU_PROVIDER,
    model: 'glm-4.7',
    name: 'GLM-4.7 Ustad',
    tagline: 'Balanced long-form teaching voice',
  },
  {
    provider: ZHIPU_PROVIDER,
    model: 'glm-4.7-flashx',
    name: 'GLM-4.7 FlashX Bijli',
    tagline: 'Lightning response for rapid generation',
  },
];

export const DEFAULT_ZHIPU_MODEL = ZHIPU_MODELS[1].model;
