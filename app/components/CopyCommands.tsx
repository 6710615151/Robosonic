"use client";

import { useState } from "react";

interface CopyCommandsProps {
  commands: string[];
}

export default function CopyCommands({ commands }: CopyCommandsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const textToCopy = commands.join("\n");
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button type="button" onClick={handleCopy} className={`copy-commands${copied ? " is-copied" : ""}`} aria-live="polite">
      {copied ? "Copied!" : "Copy all"}
    </button>
  );
}
