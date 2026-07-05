import { DeploymentHardware } from "@/components/home/deployment-hardware";
import { HeroSection } from "@/components/home/hero-section";
import { HowItWorks } from "@/components/home/how-it-works";

const HomePage = () => (
  <>
    <HeroSection />
    <HowItWorks />
    <DeploymentHardware />
  </>
);

export default HomePage;
