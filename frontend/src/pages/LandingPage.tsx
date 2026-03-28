import {
  Hero,
  DataSources,
  StatsBar,
  CodeShowcase,
  FeatureShowcase,
  UseCases,
  BottomCTA,
} from '../components/landing/Hero';

export function LandingPage() {
  return (
    <div>
      <Hero />
      <DataSources />
      <StatsBar />
      <CodeShowcase />
      <FeatureShowcase />
      <UseCases />
      <BottomCTA />
    </div>
  );
}
