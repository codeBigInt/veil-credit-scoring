"use client";

import { useState } from "react";

type Version = "v2" | "v1";

export default function ArchitectureToggle() {
  const [version, setVersion] = useState<Version>("v2");

  return (
    <section style={{ margin: "24px 0" }}>
      <div
        style={{
          display: "inline-flex",
          border: "1px solid var(--border)",
          background: "var(--bg-code)",
          marginBottom: "18px",
        }}
        aria-label="Architecture version"
      >
        {(["v2", "v1"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setVersion(item)}
            style={{
              border: 0,
              borderRight: item === "v2" ? "1px solid var(--border)" : 0,
              background: version === item ? "var(--primary)" : "transparent",
              color: version === item ? "oklch(0.98 0 0)" : "var(--fg-muted)",
              cursor: "pointer",
              font: "inherit",
              fontSize: "12px",
              fontWeight: 800,
              letterSpacing: "0.12em",
              padding: "9px 14px",
              textTransform: "uppercase",
            }}
          >
            {item === "v2" ? "v2 current" : "v1 archived"}
          </button>
        ))}
      </div>

      {version === "v2" ? (
        <div>
          <h3>v2: Private Reputation</h3>
          <p>
            Veil v2 is a social and protocol reputation layer. Users prove banded reputation from
            wallet age, protocol diversity, governance activity, LP tenure, cross-chain presence,
            and transaction consistency. Protocols receive a band decision, not raw scores or wallet
            history.
          </p>
          <ol>
            <li>User connects one EVM-compatible wallet through the Veil UI.</li>
            <li>The SDK derives a CKB lock hash and stable Veil identity.</li>
            <li>The user registers identity and submits a reputation proof on Midnight.</li>
            <li>Integrators call `checkReputation` or `Reputation_check` for a minimum band.</li>
            <li>The backend only sponsors DUST and optionally stores encrypted client backups.</li>
          </ol>
        </div>
      ) : (
        <div>
          <h3>v1: Credit Scoring</h3>
          <p>
            The archived architecture centered on backend-submitted issuer events, credit decisions,
            DID/DOB helper endpoints, and lending-specific outputs such as LTV and risk premium. That
            architecture is deprecated and should not be used for new integrations.
          </p>
          <ol>
            <li>Issuer or protocol submitted repayment/liquidation/usage events to a backend.</li>
            <li>The backend aggregated state and submitted Midnight transactions.</li>
            <li>Apps requested credit decisions from the backend API.</li>
            <li>CKB DOB and DID routes were part of the backend responsibility.</li>
          </ol>
        </div>
      )}
    </section>
  );
}
