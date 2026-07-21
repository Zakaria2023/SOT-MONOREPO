"use client";

import type { LibraryReadModel } from "@/app/(dashboard)/library/action";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

type LibraryDatabaseProps = {
  readModel: LibraryReadModel;
};

// The read-model as JSON — the structured contract the RAG AI loads to draft
// BOQs: clean keys, explicit types, relationships by attribute id, no prose.
export const LibraryDatabase = ({ readModel }: LibraryDatabaseProps) => {
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(readModel, null, 2);

  const copy = () => {
    void navigator.clipboard.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="flex flex-col gap-3 rounded-card border border-hairline bg-surface p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-ink">Read-model (JSON)</p>
          <p className="text-xs text-muted">
            {readModel.groups.length} groups · {readModel.attributes.length}{" "}
            attributes · {readModel.relationships.length} relationships ·{" "}
            {readModel.templates.length} templates. This is what your RAG loads.
          </p>
        </div>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-control border border-hairline px-3 py-1.5 text-sm text-secondary hover:bg-hover"
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="max-h-[70vh] overflow-auto rounded-control border border-hairline bg-page p-4 text-xs leading-relaxed text-secondary">
        {json}
      </pre>
    </div>
  );
};
