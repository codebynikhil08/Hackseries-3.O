import { PulseGuardProvider } from './context/PulseGuardContext';

import { Navigation } from './components/sections/Navigation';
import { HeroAndStorytelling } from './components/sections/HeroAndStorytelling';
import { DashboardSection } from './components/dashboard/DashboardSection';
import { Footer } from './components/ui/Footer';

function AppContent() {
  const scrollToDashboard = () => {
    const el = document.getElementById('dashboard');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const scrollToStory = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#F7F5EF] text-[#242923] selection:bg-[#294638] selection:text-[#F7F5EF] flex flex-col">
      <Navigation onJumpToDashboard={scrollToDashboard} onJumpToStory={scrollToStory} />
      <main className="flex-1">
        <HeroAndStorytelling onScrollToDashboard={scrollToDashboard} />
        <DashboardSection />
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <PulseGuardProvider>
      <AppContent />
    </PulseGuardProvider>
  );
}
