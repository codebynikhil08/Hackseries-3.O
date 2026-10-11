import { Shield, ArrowUp } from 'lucide-react';


export const Footer: React.FC = () => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="w-full bg-[#E6E8DC]/50 border-t border-[#294638]/12 py-16 px-6 lg:px-16 text-[#242923]">
      <div className="max-w-7xl mx-auto space-y-12">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 border-b border-[#294638]/10 pb-12">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#294638] flex items-center justify-center text-[#F7F5EF]">
                <Shield className="w-4 h-4" />
              </div>
              <span className="font-editorial text-2xl font-bold tracking-tight text-[#242923]">
                PulseGuard
              </span>
            </div>
            <p className="text-xs text-[#242923]/70 max-w-md leading-relaxed font-light">
              Autonomous physiological radar combining multi-signal photoplethysmography with baseline-deviation intelligence.
            </p>
          </div>

          <button
            onClick={scrollToTop}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border border-[#294638]/15 text-xs font-mono font-medium hover:bg-[#F7F5EF] transition-colors cursor-pointer"
          >
            <span>Return to Top</span>
            <ArrowUp className="w-3.5 h-3.5 text-[#294638]" />
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-[#242923]/60">
          <div>
            © {new Date().getFullYear()} PulseGuard Systems. All rights reserved.
          </div>
          <div className="text-center sm:text-right text-[11px] max-w-lg">
            Non-diagnostic research demonstrator. Readings are simulated or recorded and do not constitute formal medical care.
          </div>
        </div>
      </div>
    </footer>
  );
};
