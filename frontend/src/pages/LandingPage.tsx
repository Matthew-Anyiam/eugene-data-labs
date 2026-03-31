import {
  Hero,
  LiveDemo,
  AICapabilities,
  HowItWorks,
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
      <LiveDemo />
      <AICapabilities />
      <HowItWorks />
      <CodeShowcase />
      <FeatureShowcase />
      <UseCases />
      <BottomCTA />
    </div>
  );
}
