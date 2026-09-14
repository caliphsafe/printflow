"use client";

import { useMemo, useState } from "react";
import FloatingSaveBar from "@/components/FloatingSaveBar";
import { useUnsavedChanges } from "@/components/useUnsavedChanges";
import { readApiResponse } from "@/lib/client-api-response";

type Settings = {
  customerNumber?: string;
  environment?: "production" | "test";
  sftpConfigured?: boolean;
  sftpHost?: string;
  sftpPort?: number;
  sftpUsername?: string;
  catalogFilePath?: string;
  shippingMethod?: string;
  emailConfirmation?: string;
  poEnabled?: boolean;
  shippingAddress?: {
    customer?: string;
    attn?: string;
    address?: string;
    address2?: string;
    city?: string;
    state?: string;
    zip?: string;
    residential?: boolean;
  };
};

type Props = {
  connected: boolean;
  accountHint?: string;
  initialSettings?: Settings | null;
};

const emptyAddress = {
  customer: "",
  attn: "",
  address: "",
  address2: "",
  city: "",
  state: "",
  zip: "",
  residential: false
};

export default function SanMarIntegration({
  connected: initialConnected,
  accountHint,
  initialSettings
}: Props) {
  const [connected, setConnected] = useState(initialConnected);
  const [credentials, setCredentials] = useState({
    username: "",
    password: "",
    customerNumber: initialSettings?.customerNumber || "",
    environment: initialSettings?.environment || "production",
    sftpPassword: ""
  });

  const initial: Settings = {
    customerNumber: initialSettings?.customerNumber || "",
    environment: initialSettings?.environment || "production",
    sftpConfigured: initialSettings?.sftpConfigured === true,
    sftpHost: initialSettings?.sftpHost || "ftp.sanmar.com",
    sftpPort: Number(initialSettings?.sftpPort || 2200),
    sftpUsername:
      initialSettings?.sftpUsername ||
      initialSettings?.customerNumber ||
      "",
    catalogFilePath:
      initialSettings?.catalogFilePath ||
      "SanMarPDD/SanMar_SDL_N.csv",
    shippingMethod: initialSettings?.shippingMethod || "UPS",
    emailConfirmation: initialSettings?.emailConfirmation || "",
    poEnabled: initialSettings?.poEnabled === true,
    shippingAddress: {
      ...emptyAddress,
      ...(initialSettings?.shippingAddress || {})
    }
  };

  const [settings, setSettings] = useState<Settings>(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [sftpPassword, setSftpPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [message, setMessage] = useState("");

  const dirty = useMemo(
    () => JSON.stringify(settings) !== saved || Boolean(sftpPassword),
    [settings, saved, sftpPassword]
  );

  useUnsavedChanges(dirty);

  const address = settings.shippingAddress || emptyAddress;

  const patchAddress = (key: string, value: string | boolean) =>
    setSettings({
      ...settings,
      shippingAddress: {
        ...address,
        [key]: value
      }
    });

  async function connect() {
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch(
        "/api/admin/suppliers/sanmar/connection",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...credentials,
            sftpHost: settings.sftpHost,
            sftpPort: settings.sftpPort,
            sftpUsername:
              settings.sftpUsername ||
              credentials.customerNumber,
            catalogFilePath: settings.catalogFilePath
          })
        }
      );

      const data = await readApiResponse(response);

      if (!response.ok || !data.ok) {
        setMessage(
          data.error ||
            `Connection failed (HTTP ${response.status}).`
        );
        return;
      }

      setConnected(true);
      setMessage(
        "SanMar Web Services connected. Add the separate SFTP password below to sync the visual catalog."
      );
      location.reload();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Connection failed."
      );
    } finally {
      setBusy(false);
    }
  }

  async function persistSettings(): Promise<boolean> {
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch(
        "/api/admin/suppliers/sanmar/connection",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...settings,
            sftpPassword
          })
        }
      );

      const data = await readApiResponse(response);

      if (!response.ok) {
        setMessage(
          data.error ||
            `Unable to save SanMar settings (HTTP ${response.status}).`
        );
        return false;
      }

      const next = {
        ...settings,
        sftpConfigured: data.sftpConfigured === true
      };

      setSettings(next);
      setSaved(JSON.stringify(next));
      setSftpPassword("");
      setMessage("SanMar catalog and order settings saved.");
      return true;
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to save SanMar settings."
      );
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function save(): Promise<void> {
    await persistSettings();
  }

  async function syncCatalog() {
    if (dirty) {
      const savedOk = await persistSettings();
      if (!savedOk) return;
    }

    setSyncBusy(true);
    setMessage("");

    const syncStartedAt = new Date().toISOString();
    let cursor = 0;
    let lastProgress = -1;
    let cachedStyleCount = 0;

    try {
      for (let pass = 0; pass < 250; pass += 1) {
        const response = await fetch(
          "/api/admin/suppliers/sanmar/catalog-sync",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              cursor,
              syncStartedAt
            })
          }
        );

        const data = await readApiResponse(response);

        if (!response.ok || !data.ok) {
          setMessage(
            data.error ||
              `SanMar catalog sync failed (HTTP ${response.status}).`
          );
          return;
        }

        cachedStyleCount = Number(
          data.cachedStyleCount || cachedStyleCount || 0
        );

        const progress = Number(data.progress || 0);
        const nextCursor = Number(data.nextCursor || 0);

        if (progress !== lastProgress) {
          setMessage(
            `Syncing SanMar catalog… ${progress}% · ${cachedStyleCount.toLocaleString()} styles cached`
          );
          lastProgress = progress;
        }

        if (data.done === true) {
          setMessage(
            `SanMar catalog synced successfully. ${cachedStyleCount.toLocaleString()} styles are ready to browse.`
          );
          return;
        }

        if (!Number.isFinite(nextCursor) || nextCursor <= cursor) {
          setMessage(
            "SanMar sync stopped because the catalog cursor did not advance. No data was deleted. Please send the Vercel log for /api/admin/suppliers/sanmar/catalog-sync."
          );
          return;
        }

        cursor = nextCursor;
      }

      setMessage(
        "SanMar sync exceeded the safe number of catalog chunks. No data was deleted. Please send the catalog-sync Vercel log."
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to sync the SanMar catalog."
      );
    } finally {
      setSyncBusy(false);
    }
  }

  if (!connected) {
    return (
      <div className="admin-card">
        <p className="eyebrow">SANMAR CONNECTION</p>
        <h3>Connect SanMar</h3>
        <p>
          Use the SanMar.com Web Services credentials first.
          The daily visual catalog uses the separate SFTP password
          SanMar issued after onboarding.
        </p>

        <div className="integration-form">
          <label>
            <span>SanMar.com username</span>
            <input
              value={credentials.username}
              onChange={(event) =>
                setCredentials({
                  ...credentials,
                  username: event.target.value
                })
              }
            />
          </label>

          <label>
            <span>SanMar.com password</span>
            <input
              type="password"
              value={credentials.password}
              onChange={(event) =>
                setCredentials({
                  ...credentials,
                  password: event.target.value
                })
              }
            />
          </label>

          <label>
            <span>SanMar customer number</span>
            <input
              value={credentials.customerNumber}
              onChange={(event) =>
                setCredentials({
                  ...credentials,
                  customerNumber: event.target.value
                })
              }
            />
          </label>

          <label>
            <span>Environment</span>
            <select
              value={credentials.environment}
              onChange={(event) =>
                setCredentials({
                  ...credentials,
                  environment: event.target.value as
                    | "production"
                    | "test"
                })
              }
            >
              <option value="production">Production</option>
              <option value="test">Test</option>
            </select>
          </label>

          <label>
            <span>SanMar FTP password (optional now)</span>
            <input
              type="password"
              value={credentials.sftpPassword}
              onChange={(event) =>
                setCredentials({
                  ...credentials,
                  sftpPassword: event.target.value
                })
              }
            />
            <small>
              This is the separate FTP password from SanMar,
              not your SanMar.com password.
            </small>
          </label>
        </div>

        {message && <div className="error-message">{message}</div>}

        <button
          className="primary-button"
          disabled={busy}
          onClick={connect}
        >
          {busy ? "Testing SanMar…" : "Connect SanMar"}
        </button>
      </div>
    );
  }

  return (
    <section className="admin-card ss-integration-card">
      <div className="card-heading">
        <div>
          <p className="eyebrow">SANMAR</p>
          <h2>Catalog + Web Services</h2>
          <p>Connected {accountHint || "account"}</p>
        </div>
        <span className="status-pill connected">
          Connected
        </span>
      </div>

      <p>
        The product browser is fed by SanMar&apos;s SFTP
        catalog in small server-safe chunks. Exact style
        selection still refreshes Web Services pricing,
        inventory, and media.
      </p>

      <h3>Visual catalog access</h3>

      <div className="settings-two-col">
        <label>
          <span>Customer / SFTP username</span>
          <input
            value={settings.sftpUsername || ""}
            onChange={(event) =>
              setSettings({
                ...settings,
                sftpUsername: event.target.value
              })
            }
          />
          <small>
            SanMar documents the SFTP username as your
            customer number.
          </small>
        </label>

        <label>
          <span>
            {settings.sftpConfigured
              ? "Replace FTP password"
              : "FTP password"}
          </span>
          <input
            type="password"
            value={sftpPassword}
            onChange={(event) =>
              setSftpPassword(event.target.value)
            }
            placeholder={
              settings.sftpConfigured
                ? "Saved — leave blank to keep"
                : "Separate SanMar FTP password"
            }
          />
        </label>

        <label>
          <span>SFTP host</span>
          <input
            value={settings.sftpHost || "ftp.sanmar.com"}
            onChange={(event) =>
              setSettings({
                ...settings,
                sftpHost: event.target.value
              })
            }
          />
        </label>

        <label>
          <span>SFTP port</span>
          <input
            type="number"
            value={settings.sftpPort || 2200}
            onChange={(event) =>
              setSettings({
                ...settings,
                sftpPort:
                  Number(event.target.value) || 2200
              })
            }
          />
        </label>

        <label className="full-field">
          <span>Catalog file</span>
          <input
            value={
              settings.catalogFilePath ||
              "SanMarPDD/SanMar_SDL_N.csv"
            }
            onChange={(event) =>
              setSettings({
                ...settings,
                catalogFilePath: event.target.value
              })
            }
          />
          <small>
            SDL_N is the preferred browse index. PrintFlow
            also discovers the actual SanMarPDD filename
            case-insensitively if this path does not match.
          </small>
        </label>
      </div>

      <div className="integration-actions">
        <button
          className="primary-button"
          disabled={syncBusy || busy}
          onClick={syncCatalog}
        >
          {syncBusy
            ? "Syncing SanMar catalog…"
            : "Save + sync SanMar catalog"}
        </button>
      </div>

      <h3 style={{ marginTop: 24 }}>
        One-click blank ordering
      </h3>

      <p className="field-help">
        SanMar requires separate PO-integration onboarding
        and EDEV testing before production SubmitPO is
        enabled. Keep this off until SanMar confirms your
        production account is approved for PO submission.
      </p>

      <div className="settings-two-col">
        <label className="toggle-row supplier-toggle">
          <input
            type="checkbox"
            checked={settings.poEnabled === true}
            onChange={(event) =>
              setSettings({
                ...settings,
                poEnabled: event.target.checked
              })
            }
          />
          <span>
            SanMar production PO submission is approved
          </span>
        </label>

        <label>
          <span>Shipping method</span>
          <select
            value={settings.shippingMethod || "UPS"}
            onChange={(event) =>
              setSettings({
                ...settings,
                shippingMethod: event.target.value
              })
            }
          >
            <option value="UPS">UPS Ground</option>
            <option value="UPS 2ND DAY">
              UPS 2nd Day
            </option>
            <option value="UPS 3RD DAY">
              UPS 3rd Day
            </option>
            <option value="UPS NEXT DAY">
              UPS Next Day
            </option>
            <option value="USPS PP">
              USPS Ground Advantage
            </option>
            <option value="USPS APP">
              USPS Priority Mail
            </option>
            <option value="PSST">PSST</option>
          </select>
        </label>

        <label>
          <span>Confirmation email</span>
          <input
            value={settings.emailConfirmation || ""}
            onChange={(event) =>
              setSettings({
                ...settings,
                emailConfirmation: event.target.value
              })
            }
          />
        </label>
      </div>

      <h3>Default SanMar ship-to address</h3>

      <div className="settings-two-col">
        <label>
          <span>Company / recipient</span>
          <input
            value={address.customer || ""}
            onChange={(event) =>
              patchAddress("customer", event.target.value)
            }
          />
        </label>

        <label>
          <span>Attention</span>
          <input
            value={address.attn || ""}
            onChange={(event) =>
              patchAddress("attn", event.target.value)
            }
          />
        </label>

        <label className="full-field">
          <span>Street address</span>
          <input
            value={address.address || ""}
            onChange={(event) =>
              patchAddress("address", event.target.value)
            }
          />
        </label>

        <label>
          <span>Suite / address 2</span>
          <input
            value={address.address2 || ""}
            onChange={(event) =>
              patchAddress("address2", event.target.value)
            }
          />
        </label>

        <label>
          <span>City</span>
          <input
            value={address.city || ""}
            onChange={(event) =>
              patchAddress("city", event.target.value)
            }
          />
        </label>

        <label>
          <span>State</span>
          <input
            maxLength={2}
            value={address.state || ""}
            onChange={(event) =>
              patchAddress(
                "state",
                event.target.value.toUpperCase()
              )
            }
          />
        </label>

        <label>
          <span>ZIP</span>
          <input
            value={address.zip || ""}
            onChange={(event) =>
              patchAddress("zip", event.target.value)
            }
          />
        </label>

        <label className="toggle-row supplier-toggle">
          <input
            type="checkbox"
            checked={address.residential === true}
            onChange={(event) =>
              patchAddress(
                "residential",
                event.target.checked
              )
            }
          />
          <span>Residential address</span>
        </label>
      </div>

      {message && (
        <div
          className={
            /unable|failed|required|error|http|timeout|stopped|exceeded|missing|could not/i.test(
              message
            )
              ? "error-message catalog-message"
              : "success-message"
          }
        >
          {message}
        </div>
      )}

      <FloatingSaveBar
        dirty={dirty}
        busy={busy}
        onSave={save}
        message="Save SanMar catalog and ordering settings."
      />
    </section>
  );
}
