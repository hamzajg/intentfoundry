import { Link } from 'react-router-dom';
import { Button, Badge } from '../components/ui';

const FEATURES = [
  {
    icon: '◎',
    title: 'Intent-Driven Development',
    description: 'Define high-level intent and let the system generate, validate, and ship code automatically.',
  },
  {
    icon: '⚙',
    title: 'Architecture Management',
    description: 'Visualize and manage your project architecture with real-time drift detection.',
  },
  {
    icon: '⟳',
    title: 'Automated Loop',
    description: 'Continuous define-generate-validate-ship-reflect cycles with human oversight.',
  },
  {
    icon: '▦',
    title: 'Real-Time Telemetry',
    description: 'Monitor loop health, iteration metrics, and system performance as it happens.',
  },
  {
    icon: '◈',
    title: 'Project Isolation',
    description: 'Each project runs in its own sandbox with dedicated API keys and settings.',
  },
  {
    icon: '⚑',
    title: 'API-First Design',
    description: 'Full programmatic access with RESTful APIs and comprehensive documentation.',
  },
];

const STEPS = [
  { num: '01', title: 'Define Intent', desc: 'Describe what you want to build' },
  { num: '02', title: 'Generate Code', desc: 'AI produces implementation' },
  { num: '03', title: 'Validate & Ship', desc: 'Automated testing and deployment' },
  { num: '04', title: 'Reflect & Learn', desc: 'System improves from feedback' },
];

export function Landing() {
  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      {/* Navigation */}
      <nav className="nav-glass fixed top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <svg className="w-7 h-7 text-accent-primary" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            <span className="font-display text-lg font-semibold tracking-wide">IntentFoundry</span>
          </Link>
          <div className="flex items-center gap-4">
            <a
              href="/docs"
              className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              API Docs
            </a>
            <Link to="/login">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
            <Link to="/register">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 text-center">
        <div className="max-w-4xl mx-auto">
          <Badge variant="info" className="mb-6 text-xs px-3 py-1">
            Now in Public Beta
          </Badge>
          <h1 className="text-5xl md:text-6xl font-bold font-body leading-tight mb-6">
            Build Software with
            <span className="text-gradient block mt-2">Intent, Not Code</span>
          </h1>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed">
            IntentFoundry automates the software development loop. Define what you want,
            and watch as the system generates, validates, and ships your vision.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link to="/register">
              <Button size="lg" className="min-w-[180px]">
                Start Building
              </Button>
            </Link>
            <a
              href="/docs"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium rounded border border-border-hover text-accent-primary hover:bg-accent-dim transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Read the Docs
            </a>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-6 border-t border-border-subtle">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-semibold text-center mb-4">How It Works</h2>
          <p className="text-text-secondary text-center mb-12 max-w-xl mx-auto">
            A continuous loop that turns your intent into running software
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {STEPS.map((step) => (
              <div key={step.num} className="text-center">
                <div className="text-4xl font-display font-bold text-accent-dim mb-3">
                  {step.num}
                </div>
                <h3 className="text-base font-semibold mb-1">{step.title}</h3>
                <p className="text-sm text-text-secondary">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-6 border-t border-border-subtle">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-semibold text-center mb-4">Everything You Need</h2>
          <p className="text-text-secondary text-center mb-12 max-w-xl mx-auto">
            Powerful features to automate your development workflow
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="card hover:border-border-hover">
                <div className="text-2xl mb-3">{feature.icon}</div>
                <h3 className="text-base font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* API Docs CTA */}
      <section className="py-20 px-6 border-t border-border-subtle">
        <div className="max-w-4xl mx-auto text-center">
          <div className="card-raised p-10">
            <h2 className="text-2xl font-semibold mb-3">Developer-First API</h2>
            <p className="text-text-secondary mb-8 max-w-lg mx-auto">
              Integrate IntentFoundry into your existing workflow with our comprehensive RESTful API.
              Full documentation with interactive examples.
            </p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <a
                href="/docs"
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium rounded bg-accent-primary text-bg-primary hover:bg-accent-hover transition-all font-semibold"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                View API Documentation
              </a>
              <a
                href="/docs#authentication"
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium rounded border border-border-hover text-accent-primary hover:bg-accent-dim transition-all"
              >
                Get API Key
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border-subtle">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-accent-primary" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            <span className="text-sm font-display font-semibold">IntentFoundry</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-text-tertiary">
            <a href="/docs" className="hover:text-accent-primary transition-colors">API Docs</a>
            <a href="https://github.com" className="hover:text-accent-primary transition-colors">GitHub</a>
            <span>© 2026 IntentFoundry</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
