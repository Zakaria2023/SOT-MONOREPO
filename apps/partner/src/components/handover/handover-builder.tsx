"use client";

import {
  addCredential,
  openPack,
  saveAsset,
  submitPack,
} from "@/app/(dashboard)/boqs/[uuid]/handover/actions";
import { HANDOVER_CREDENTIAL_TYPE_LABELS } from "@/db/label";
import { handoverCredentialTypes, type HandoverCredentialType } from "@/db/enum";
import { CheckCircle2, KeyRound, Plus, Send } from "lucide-react";
import { useState, useTransition } from "react";
import { Dropdown, Input, Textarea } from "ui";
import type {
  SelectHandoverAssets,
  SelectHandoverCredentials,
} from "services";

type HandoverBuilderProps = {
  boqUuid: string;
  assets: SelectHandoverAssets[];
  credentials: SelectHandoverCredentials[];
};

type AssetDraft = {
  location: string;
  localIp: string;
  port: string;
};

const credentialOptions = handoverCredentialTypes.map((type) => ({
  value: type,
  label: HANDOVER_CREDENTIAL_TYPE_LABELS[type],
}));

type OpenPackButtonProps = {
  boqUuid: string;
};

export const OpenPackButton = ({ boqUuid }: OpenPackButtonProps) => {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>(undefined);

  const onOpen = () =>
    startTransition(async () => {
      setError(undefined);
      const result = await openPack(boqUuid);
      if (result.error) setError(result.error);
    });

  return (
    <div className="flex flex-col items-start gap-2">
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        type="button"
        onClick={onOpen}
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-60"
      >
        {isPending ? "Opening…" : "Open handover pack"}
      </button>
    </div>
  );
};

export const HandoverBuilder = ({
  boqUuid,
  assets,
  credentials,
}: HandoverBuilderProps) => {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>(undefined);

  const [drafts, setDrafts] = useState<Record<string, AssetDraft>>(() =>
    Object.fromEntries(
      assets.map((asset) => [
        asset.uuid,
        {
          location: asset.location ?? "",
          localIp: asset.localIp ?? "",
          port: asset.port ?? "",
        },
      ]),
    ),
  );

  const [credType, setCredType] = useState<HandoverCredentialType>(
    "offline_access",
  );
  const [credLabel, setCredLabel] = useState("");
  const [credTarget, setCredTarget] = useState("");
  const [credUser, setCredUser] = useState("");
  const [credSecret, setCredSecret] = useState("");
  const [training, setTraining] = useState("");

  const setDraft = (uuid: string, patch: Partial<AssetDraft>) =>
    setDrafts((prev) => ({ ...prev, [uuid]: { ...prev[uuid], ...patch } }));

  const run = (fn: () => Promise<{ error?: string }>) =>
    startTransition(async () => {
      setError(undefined);
      const result = await fn();
      if (result.error) setError(result.error);
    });

  const onSaveAsset = (uuid: string) => {
    const draft = drafts[uuid];
    if (!draft) return;
    run(() => saveAsset(boqUuid, uuid, draft));
  };

  const onAddCredential = () =>
    run(async () => {
      const result = await addCredential(boqUuid, {
        type: credType,
        label: credLabel,
        target: credTarget || undefined,
        username: credUser || undefined,
        secret: credSecret || undefined,
      });
      if (!result.error) {
        setCredLabel("");
        setCredTarget("");
        setCredUser("");
        setCredSecret("");
      }
      return result;
    });

  const onSubmit = () => run(() => submitPack(boqUuid, training || undefined));

  return (
    <div className="flex flex-col gap-8">
      {error && <p className="text-sm text-red-500">{error}</p>}

      <section>
        <h2 className="font-heading text-lg text-ink">As-built devices</h2>
        <p className="mt-1 text-sm text-muted">
          Record where each device went, its local IP, and port.
        </p>
        <div className="mt-4 flex flex-col gap-4">
          {assets.map((asset) => (
            <div
              key={asset.uuid}
              className="rounded-card border border-hairline p-4"
            >
              <p className="font-medium text-ink">{asset.name}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Input
                  label="Location"
                  value={drafts[asset.uuid]?.location ?? ""}
                  onChange={(event) =>
                    setDraft(asset.uuid, { location: event.target.value })
                  }
                />
                <Input
                  label="Local IP"
                  value={drafts[asset.uuid]?.localIp ?? ""}
                  onChange={(event) =>
                    setDraft(asset.uuid, { localIp: event.target.value })
                  }
                />
                <Input
                  label="Port"
                  value={drafts[asset.uuid]?.port ?? ""}
                  onChange={(event) =>
                    setDraft(asset.uuid, { port: event.target.value })
                  }
                />
              </div>
              <button
                type="button"
                onClick={() => onSaveAsset(asset.uuid)}
                disabled={isPending}
                className="mt-3 inline-flex items-center rounded-control border border-hairline px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-hover disabled:opacity-60"
              >
                Save device
              </button>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-heading text-lg text-ink">Access credentials</h2>
        <p className="mt-1 text-sm text-muted">
          The offline logins, cloud-admin ownership, and device access that give
          the customer full control.
        </p>

        {credentials.length > 0 && (
          <div className="mt-4 flex flex-col gap-2">
            {credentials.map((cred) => (
              <div
                key={cred.uuid}
                className="flex items-center gap-2 rounded-control bg-hover px-4 py-2 text-sm text-ink"
              >
                <KeyRound size={14} className="text-primary" />
                {cred.label}
                <span className="text-xs text-faint">
                  · {HANDOVER_CREDENTIAL_TYPE_LABELS[cred.type]}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 rounded-card border border-hairline p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <span className="mb-1.5 block text-sm font-medium text-ink">
                Type
              </span>
              <Dropdown
                options={credentialOptions}
                value={credType}
                onChange={(value) =>
                  setCredType(value as HandoverCredentialType)
                }
              />
            </div>
            <Input
              label="Label"
              placeholder="e.g. NVR offline login"
              value={credLabel}
              onChange={(event) => setCredLabel(event.target.value)}
            />
            <Input
              label="Where it's used"
              placeholder="Device IP / console URL"
              value={credTarget}
              onChange={(event) => setCredTarget(event.target.value)}
            />
            <Input
              label="Username"
              value={credUser}
              onChange={(event) => setCredUser(event.target.value)}
            />
            <Input
              label="Password / secret"
              value={credSecret}
              onChange={(event) => setCredSecret(event.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={onAddCredential}
            disabled={isPending || !credLabel.trim()}
            className="mt-3 inline-flex items-center gap-2 rounded-control border border-hairline px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-hover disabled:opacity-60"
          >
            <Plus size={15} />
            Add credential
          </button>
        </div>
      </section>

      <section>
        <Textarea
          label="Training notes (optional)"
          rows={3}
          placeholder="What you walked the customer through…"
          value={training}
          onChange={(event) => setTraining(event.target.value)}
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={isPending || credentials.length === 0}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-60"
        >
          <Send size={16} />
          {isPending ? "Submitting…" : "Submit for the customer to confirm"}
        </button>
        {credentials.length === 0 && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-faint">
            <CheckCircle2 size={13} />
            Add at least one credential before submitting.
          </p>
        )}
      </section>
    </div>
  );
};
