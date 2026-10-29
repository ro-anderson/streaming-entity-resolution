import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useTrace } from "../api/trace";
import { tenantName } from "../logic/repository";

function navClass({ isActive }: { isActive: boolean }): string {
  return isActive ? "nav-link active" : "nav-link";
}

export function Layout({ actions, children }: { actions?: ReactNode; children: ReactNode }) {
  const trace = useTrace();
  const reviewCount = trace.data?.filter((event) => event.outcome === "review").length;
  const tenant = trace.data === undefined ? null : tenantName(trace.data);
  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <div className="brand">
            <span className="brand-name">Resolver</span>
            {tenant !== null && <span className="mono small muted">tenant · {tenant}</span>}
          </div>
          <nav className="nav" aria-label="Seções">
            <NavLink to="/replay" className={navClass}>
              Replay
            </NavLink>
            <NavLink to="/review" className={navClass}>
              Revisão{" "}
              {reviewCount !== undefined && <span className="nav-count">{reviewCount}</span>}
            </NavLink>
            <NavLink to="/entities" className={navClass}>
              Entidades
            </NavLink>
          </nav>
        </div>
        {actions}
      </header>
      {children}
    </div>
  );
}
