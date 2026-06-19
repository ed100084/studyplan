"use client";

import { useEffect } from "react";

function pendingLabelFor(button: HTMLButtonElement, form: HTMLFormElement) {
  return button.dataset.pendingLabel ?? form.dataset.pendingLabel ?? "處理中...";
}

function markFormPending(event: SubmitEvent) {
  if (event.defaultPrevented) return;

  const form = event.target instanceof HTMLFormElement ? event.target : null;
  if (!form || form.dataset.submitGuard === "off") return;

  const buttons = Array.from(form.querySelectorAll<HTMLButtonElement>('button[type="submit"]'));
  const submitter = event.submitter instanceof HTMLButtonElement ? event.submitter : buttons[0];

  buttons.forEach((button) => {
    button.disabled = true;
    button.setAttribute("aria-disabled", "true");
  });

  if (submitter) {
    submitter.dataset.originalText = submitter.textContent ?? "";
    submitter.textContent = pendingLabelFor(submitter, form);
  }

  form.setAttribute("aria-busy", "true");
}

export function FormSubmitGuard() {
  useEffect(() => {
    document.addEventListener("submit", markFormPending);
    return () => document.removeEventListener("submit", markFormPending);
  }, []);

  return null;
}
