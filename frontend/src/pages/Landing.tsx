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
              href="https://tanoshii-computing.com/community"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-text-secondary hover:text-accent-primary transition-colors"
            >
              Community
            </a>
            <a
              href="/docs"
              className="text-sm font-medium text-text-secondary hover:text-accent-primary transition-colors"
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

      {/* Hero Section - Blueprint Futuristic Minimalist Style */}
      <section className="pt-40 pb-32 px-6 text-center relative overflow-hidden blue-print-grid">

        <div className="max-w-4xl mx-auto relative">
          <Badge variant="info" className="mb-6 text-xs px-3 py-1">
            Now in Public Beta
          </Badge>

          <div className="mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border-subtle bg-bg-secondary/50 backdrop-blur-sm mb-8">
              <svg className="w-4 h-4 text-accent-primary" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              <span className="text-sm text-text-secondary">
                Part of{' '}
                <a href="https://tanoshii-computing.com" className="text-accent-primary hover:text-accent-hover transition-colors">
                  Tanoshii Computing
                </a>
                {' '}ecosystem
              </span>
            </div>
          </div>

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
              href="https://tanoshii-computing.com/community"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium rounded border border-border-hover text-accent-primary hover:bg-accent-dim transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 1 1 0 4h-2m-1.5-3.5a4 4 0 1 1 0 5m3.5 2H18a6 6 0 1 0 0-6h-2m-4 0H8a2 2 0 1 0 0 4h2m1.5 3.5a4 4 0 1 1 0-5m-3.5-2H6a6 6 0 1 1 0 6h2" />
              </svg>
              Join Community
            </a>
          </div>

          <p className="mt-6 text-sm text-text-tertiary">
            <a href="https://tanoshii-computing.com" className="hover:text-accent-primary transition-colors">
              tanoshii-computing.com
            </a>
          </p>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-6 relative">
        <div className="absolute left-1/2 -translate-x-1/2 top-0 w-24 h-0.5 bg-gradient-to-r from-transparent via-border-subtle to-transparent"></div>
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-semibold text-center mb-4">How It Works</h2>
          <p className="text-text-secondary text-center mb-12 max-w-xl mx-auto">
            A continuous loop that turns your intent into running software
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {STEPS.map((step) => (
              <div key={step.num} className="text-center group">
                <div className="text-4xl font-display font-bold text-border-subtle group-hover:text-accent-dim mb-3 transition-colors">
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
      <section className="py-20 px-6 relative">
        <div className="absolute left-1/2 -translate-x-1/2 top-0 w-24 h-0.5 bg-gradient-to-r from-transparent via-border-subtle to-transparent"></div>
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-semibold text-center mb-4">Everything You Need</h2>
          <p className="text-text-secondary text-center mb-12 max-w-xl mx-auto">
            Powerful features to automate your development workflow
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="card hover:border-border-hover transition-all duration-200">
                <div className="text-2xl mb-3 text-accent-dim">{feature.icon}</div>
                <h3 className="text-base font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Community CTA */}
      <section className="py-20 px-6 relative">
        <div className="absolute left-1/2 -translate-x-1/2 top-0 w-24 h-0.5 bg-gradient-to-r from-transparent via-border-subtle to-transparent"></div>
        <div className="max-w-6xl mx-auto">
          <div className="card p-8 md:p-12 bg-bg-secondary/50 backdrop-blur-sm">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <div className="inline-flex items-center gap-2 mb-4">
                  <svg className="w-5 h-5 text-accent-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 1 1 0 4h-2m-1.5-3.5a4 4 0 1 1 0 5m3.5 2H18a6 6 0 1 1 0-6h-2m-4 0H8a2 2 0 1 1 0-4h2m1.5 3.5a4 4 0 1 1-3.5 2M6 16l-4-4 4-4" />
                  </svg>
                  <span className="text-sm font-medium text-text-secondary uppercase tracking-wider">Community</span>
                </div>
                <h2 className="text-2xl font-semibold mb-4">Join the Tanoshii Computing Community</h2>
                <p className="text-text-secondary mb-6 leading-relaxed">
                  Connect with fellow builders, share your IntentFoundry projects,
                  get help, and collaborate on the future of intent-driven development.
                </p>
                <div className="flex flex-wrap gap-4">
                  <a
                    href="https://tanoshii-computing.com/community"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium rounded bg-accent-primary text-bg-primary hover:bg-accent-hover transition-all font-semibold"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 1 1 0 4h-2m-1.5-3.5a4 4 0 1 1 0 5m3.5 2H18a6 6 0 1 1 0-6h-2m-4 0H8a2 2 0 1 1 0-4h2m1.5 3.5a4 4 0 1 1-3.5 2M6 16l-4-4 4-4" />
                    </svg>
                    Visit Community
                  </a>
                  <a
                    href="https://tanoshii-computing.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium rounded border border-border-hover text-accent-primary hover:bg-accent-dim transition-all"
                  >
                    Learn More
                  </a>
                </div>
              </div>
              <div className="card bg-bg-tertiary p-6">
                <div className="text-center mb-4">
                  <div className="text-3xl mb-2">⚑</div>
                  <div className="text-sm font-semibold text-text-primary">Tanoshii Computing</div>
                  <div className="text-xs text-text-tertiary mt-1">tanoshii-computing.com</div>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent-primary"></div>
                    <span className="text-text-secondary">Community forums & discussions</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent-primary"></div>
                    <span className="text-text-secondary">Share projects & get feedback</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent-primary"></div>
                    <span className="text-text-secondary">Collaborate with other builders</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent-primary"></div>
                    <span className="text-text-secondary">Get help & share knowledge</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* API Docs CTA */}
      <section className="py-20 px-6 relative">
        <div className="absolute left-1/2 -translate-x-1/2 top-0 w-24 h-0.5 bg-gradient-to-r from-transparent via-border-subtle to-transparent"></div>
        <div className="max-w-6xl mx-auto">
          <div className="card p-8 md:p-12 bg-bg-secondary/50 backdrop-blur-sm">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div className="order-2 md:order-1">
                <div className="card bg-bg-tertiary p-6 font-mono text-sm">
                  <div className="text-accent-primary mb-3 text-xs font-semibold">GET /api/v1/projects</div>
                  <div className="text-text-secondary mb-2">
                    <span className="text-accent-hover">curl</span> -H <span className="text-success">"Authorization: Bearer $TOKEN"</span> \
                  </div>
                  <div className="text-text-secondary">
                    https://api.intentfoundry.com/api/v1/projects
                  </div>
                  <div className="mt-4 pt-4 border-t border-border-subtle">
                    <div className="text-xs text-text-tertiary mb-2">Response (200 OK)</div>
                    <pre className="text-xs text-text-secondary overflow-x-auto">
{`[
  {
    "id": "01KQRSEQK6NT3ER2FWP9CSDNSW",
    "name": "My Project",
    "slug": "my-project"
  }
]`}
                    </pre>
                  </div>
                </div>
              </div>
              <div className="order-1 md:order-2">
                <div className="inline-flex items-center gap-2 mb-4">
                  <svg className="w-5 h-5 text-accent-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                  <span className="text-sm font-medium text-text-secondary uppercase tracking-wider">API</span>
                </div>
                <h2 className="text-2xl font-semibold mb-4">Developer-First API</h2>
                <p className="text-text-secondary mb-6 leading-relaxed">
                  Integrate IntentFoundry into your existing workflow with our comprehensive RESTful API.
                  Full interactive documentation with request/response examples.
                </p>
                <div className="flex flex-wrap gap-4">
                  <a
                    href="/docs"
                    className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium rounded bg-accent-primary text-bg-primary hover:bg-accent-hover transition-all font-semibold"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                    View API Docs
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
            <a href="https://tanoshii-computing.com" className="hover:text-accent-primary transition-colors">Tanoshii Computing</a>
            <a href="https://tanoshii-computing.com/community" className="hover:text-accent-primary transition-colors">Community</a>
            <a href="/docs" className="hover:text-accent-primary transition-colors">API Docs</a>
            <a href="https://github.com" className="hover:text-accent-primary transition-colors">GitHub</a>
            <span>© 2026 IntentFoundry</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
