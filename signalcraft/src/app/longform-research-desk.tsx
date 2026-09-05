'use client';

import dynamic from 'next/dynamic';
import type { OpportunityRadarActions } from './opportunity-radar';
import type { ShortformRadarActions } from './shortform-opportunity-radar';
import ConvergedRadar from './converged-radar';
import type { UiLocale } from '@/src/lib/ui-language';

// Keep the production intelligence bundle off the radar scanning path.
const LongformOpportunities = dynamic(() => import('./longform-opportunities'));
type Props = { locale: UiLocale; initialView: 'opportunities' | 'radar' | 'short-radar' | 'all-radar' } & OpportunityRadarActions & ShortformRadarActions;
export default function LongformResearchDesk({ locale, initialView }: Props) {
  if (initialView === 'opportunities') return <main className="longform-research-desk research-desk-shell"><LongformOpportunities locale={locale} embedded/></main>;
  return <ConvergedRadar key={initialView} locale={locale} format={initialView === 'all-radar' ? 'ALL' : initialView === 'short-radar' ? 'SHORTS' : 'LONG_FORM'}/>;
}
