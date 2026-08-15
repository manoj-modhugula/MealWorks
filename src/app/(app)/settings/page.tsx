"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { Clock, Monitor, Moon, Sun } from "lucide-react";
import { Alert, Card, Page, PageHeader, PageSkeleton } from "@/components/ui";
import {
  useTheme,
  type ThemePreference,
} from "@/components/theme-provider";
import { deviceTimeZone } from "@/lib/client-date";
import { getCache, setCache } from "@/lib/client-cache";
import {
  SYSTEM_TZ,
  systemTzLabel,
  timezoneGroups,
} from "@/lib/timezones";

type SettingsCache = {
  name: string;
  emailEnabled: boolean;
  emailTimeLocal: string;
  timezone: string;
  digest: {
    createdAt: string;
    payload: { headline?: string; summary?: string };
  } | null;
};

const THEME_OPTIONS: {
  value: ThemePreference;
  label: string;
  Icon: typeof Sun;
}[] = [
  { value: "system", label: "System", Icon: Monitor },
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "schedule", label: "Auto", Icon: Clock },
];

export default function SettingsPage() {
  const {
    preference,
    setPreference,
    schedule,
    setSchedule,
    scheduleStatus,
  } = useTheme();
  const cached0 = getCache<SettingsCache>("settings");
  const [loading, setLoading] = useState(!cached0);
  const [emailEnabled, setEmailEnabled] = useState(
    cached0?.emailEnabled ?? false
  );
  const [emailTimeLocal, setEmailTimeLocal] = useState(
    cached0?.emailTimeLocal || "07:00"
  );
  const [timezone, setTimezone] = useState(cached0?.timezone || "");
  const [deviceTz, setDeviceTz] = useState("");
  const tzGroups = timezoneGroups();
  const [name, setName] = useState(cached0?.name || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deleteOtp, setDeleteOtp] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [digest, setDigest] = useState<{
    createdAt: string;
    payload: { headline?: string; summary?: string };
  } | null>(cached0?.digest ?? null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    const detected = deviceTimeZone();
    setDeviceTz(detected);
    const cached = getCache<SettingsCache>("settings");
    if (cached) {
      setName(cached.name);
      setEmailEnabled(cached.emailEnabled);
      setEmailTimeLocal(cached.emailTimeLocal);
      setTimezone(cached.timezone || detected);
      setDigest(cached.digest);
      setLoading(false);
    } else if (!timezone) {
      setTimezone(detected);
    }
    let cancelled = false;
    (async () => {
      try {
        const me = await fetch("/api/me").then((r) => r.json());
        if (cancelled) return;
        const n = me.user?.name || "";
        if (n) setName(n);
        let en = false;
        let t = "07:00";
        let tz = detected;
        if (me.prefs) {
          en = !!me.prefs.emailEnabled;
          t = me.prefs.emailTimeLocal || "07:00";
          tz = me.prefs.timezone || detected;
          setEmailEnabled(en);
          setEmailTimeLocal(t);
          setTimezone(tz);
        } else setTimezone(detected);
        const d = await fetch("/api/digests/latest").then((r) => r.json());
        if (cancelled) return;
        setDigest(d.digest);
        setCache<SettingsCache>(
          "settings",
          {
            name: n || name,
            emailEnabled: en,
            emailTimeLocal: t,
            timezone: tz,
            digest: d.digest,
          },
          2 * 60_000
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function sendTest() {
    setMessage("");
    setError("");
    setTesting(true);
    try {
      const res = await fetch("/api/digests/test", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Test send failed");
        return;
      }
      setMessage(data.message || "Test digest sent");
      const d = await fetch("/api/digests/latest").then((r) => r.json());
      setDigest(d.digest);
    } catch {
      setError("Test send failed");
    } finally {
      setTesting(false);
    }
  }

  async function saveDigest() {
    setMessage("");
    setError("");
    const res = await fetch("/api/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        emailEnabled,
        emailTimeLocal,
        timezone,
        runAi: false,
      }),
    });
    if (res.ok) setMessage("Digest settings saved");
    else setError("Could not save");
  }

  async function sendStepUp() {
    setMessage("");
    setError("");
    setSendingCode(true);
    try {
      const res = await fetch("/api/identity/stepup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Could not send code");
      else setMessage(data.message || "If this email can be used, we sent a code.");
    } finally {
      setSendingCode(false);
    }
  }

  async function saveAccount() {
    setMessage("");
    setError("");
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        currentPassword: currentPassword || undefined,
        newPassword: newPassword || undefined,
        otp: otp || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Update failed");
      return;
    }
    setMessage("Account updated");
    setCurrentPassword("");
    setNewPassword("");
    setOtp("");
  }

  async function deleteAccount() {
    setMessage("");
    setError("");
    if (
      !window.confirm(
        "Delete your MealWorks account and personal data? Menus posted for the office stay."
      )
    ) {
      return;
    }
    const res = await fetch("/api/account", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otp: deleteOtp, confirmEmail }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not delete");
      return;
    }
    await signOut({ callbackUrl: "/" });
  }

  if (loading) {
    return (
      <Page>
        <PageHeader title="Settings" />
        <PageSkeleton rows={4} />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader title="Settings" />

      <div className="space-y-4">
        {message && <Alert tone="good">{message}</Alert>}
        {error && <Alert tone="bad">{error}</Alert>}

        <div className="card-grid-2 settings-grid">
          <Card className="settings-card">
            <div className="settings-card-head">
              <h2 className="card-title">Appearance</h2>
            </div>
            <div className="settings-card-body">
              <div
                className="theme-seg"
                role="radiogroup"
                aria-label="Color theme"
              >
                {THEME_OPTIONS.map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={preference === value}
                    data-active={preference === value}
                    className="theme-seg-btn"
                    onClick={() => setPreference(value)}
                  >
                    <Icon size={15} strokeWidth={2} aria-hidden />
                    {label}
                  </button>
                ))}
              </div>

              {preference === "schedule" ? (
                <div className="theme-schedule">
                  <p className="label !mb-2">Dark hours</p>
                  <div className="field-row-2">
                    <div>
                      <label className="label" htmlFor="theme-dark-from">
                        From
                      </label>
                      <div className="field-shell">
                        <input
                          id="theme-dark-from"
                          className="field field-native"
                          type="time"
                          value={schedule.darkFrom}
                          onChange={(e) =>
                            setSchedule({ darkFrom: e.target.value || "20:00" })
                          }
                        />
                      </div>
                    </div>
                    <div>
                      <label className="label" htmlFor="theme-dark-to">
                        Until
                      </label>
                      <div className="field-shell">
                        <input
                          id="theme-dark-to"
                          className="field field-native"
                          type="time"
                          value={schedule.darkTo}
                          onChange={(e) =>
                            setSchedule({ darkTo: e.target.value || "07:00" })
                          }
                        />
                      </div>
                    </div>
                  </div>
                  <p className="theme-schedule-status" role="status">
                    {scheduleStatus}
                  </p>
                </div>
              ) : (
                <p className="theme-schedule-status" role="status">
                  {scheduleStatus}
                </p>
              )}
            </div>
          </Card>

          <Card className="settings-card">
            <div className="settings-card-head">
              <h2 className="card-title">Morning digest</h2>
            </div>
            <div className="settings-card-body">
              <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={emailEnabled}
                  onChange={(e) => setEmailEnabled(e.target.checked)}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                Enable email digests
              </label>
              <div className="field-row-2">
                <div>
                  <label className="label">Time</label>
                  <div className="field-shell">
                    <input
                      className="field field-native"
                      type="time"
                      value={emailTimeLocal}
                      onChange={(e) => setEmailTimeLocal(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Timezone</label>
                  <div className="field-shell">
                    <select
                      className="field field-native"
                      value={
                        !timezone || timezone === deviceTz
                          ? SYSTEM_TZ
                          : timezone
                      }
                      onChange={(e) => {
                        const v = e.target.value;
                        setTimezone(v === SYSTEM_TZ ? deviceTz : v);
                      }}
                    >
                      <option value={SYSTEM_TZ}>
                        {systemTzLabel(deviceTz)}
                      </option>
                      {timezone &&
                        timezone !== deviceTz &&
                        !tzGroups.some((g) =>
                          g.zones.includes(timezone)
                        ) && (
                          <option value={timezone}>
                            {timezone.replace(/_/g, " ")}
                          </option>
                        )}
                      {tzGroups.map((g) => (
                        <optgroup key={g.region} label={g.region}>
                          {g.zones.map((z) => (
                            <option key={z} value={z}>
                              {z.replace(/_/g, " ")}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <div className="settings-card-actions">
              <button type="button" className="btn btn-primary" onClick={saveDigest}>
                Save
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={testing}
                onClick={sendTest}
              >
                {testing ? "Sending…" : "Send test email"}
              </button>
            </div>
          </Card>

          <Card className="settings-card">
            <div className="settings-card-head">
              <h2 className="card-title">Latest digest</h2>
            </div>
            <div className="settings-card-body">
              {!digest && (
                <p className="text-sm text-[var(--muted)]">None yet.</p>
              )}
              {digest && (
                <div>
                  {(() => {
                    const when = new Date(digest.createdAt);
                    const dateChip = when.toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    });
                    const timeChip = when.toLocaleTimeString(undefined, {
                      hour: "numeric",
                      minute: "2-digit",
                    });
                    return (
                      <div className="flex flex-wrap gap-1.5" aria-label="Sent at">
                        <span className="chip !cursor-default !py-1 !text-xs pointer-events-none">
                          {dateChip}
                        </span>
                        <span className="chip !cursor-default !py-1 !text-xs pointer-events-none">
                          {timeChip}
                        </span>
                      </div>
                    );
                  })()}
                  <p className="card-title mt-2.5">{digest.payload.headline}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {digest.payload.summary}
                  </p>
                </div>
              )}
            </div>
          </Card>

          <Card className="settings-card">
            <div className="settings-card-head">
              <h2 className="card-title">Account</h2>
            </div>
            <div className="settings-card-body">
              <div>
                <label className="label">Name</label>
                <input
                  className="field"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="field-row-2">
                <div>
                  <label className="label">Current password</label>
                  <input
                    className="field"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
                <div>
                  <label className="label">New password (10+)</label>
                  <input
                    className="field"
                    type="password"
                    minLength={10}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="account-otp">
                  Email code
                </label>
                <div className="flex flex-wrap gap-2">
                  <input
                    id="account-otp"
                    className="field min-w-[8rem] flex-1 tracking-[0.2em]"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={otp}
                    onChange={(e) =>
                      setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={sendingCode}
                    onClick={sendStepUp}
                  >
                    {sendingCode ? "Sending…" : "Send code"}
                  </button>
                </div>
              </div>
            </div>
            <div className="settings-card-actions">
              <button type="button" className="btn btn-primary" onClick={saveAccount}>
                Update account
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => signOut({ callbackUrl: "/" })}
              >
                Sign out
              </button>
            </div>
          </Card>

          <Card className="settings-card">
            <div className="settings-card-head">
              <h2 className="card-title">Delete account</h2>
              <p className="settings-card-desc">
                Removes your profile, prefs, and matches. Office menus stay.
              </p>
            </div>
            <div className="settings-card-body">
              <div>
                <label className="label" htmlFor="delete-email">
                  Type your email
                </label>
                <input
                  id="delete-email"
                  className="field"
                  type="email"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="delete-otp">
                  Email code
                </label>
                <input
                  id="delete-otp"
                  className="field tracking-[0.2em]"
                  inputMode="numeric"
                  maxLength={6}
                  value={deleteOtp}
                  onChange={(e) =>
                    setDeleteOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                />
              </div>
            </div>
            <div className="settings-card-actions">
              <button type="button" className="btn btn-danger" onClick={deleteAccount}>
                Delete my account
              </button>
            </div>
          </Card>
        </div>
      </div>
    </Page>
  );
}
