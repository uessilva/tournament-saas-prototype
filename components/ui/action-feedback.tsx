import { CheckIcon } from "@/components/icons";

export function ActionFeedback({
  status,
  message,
}: {
  status: "idle" | "success" | "error";
  message: string;
}) {
  if (status === "idle") {
    return null;
  }

  if (status === "error") {
    return (
      <p role="alert" className="mt-2 text-xs font-bold text-red-700">
        {message}
      </p>
    );
  }

  return (
    <p
      role="status"
      className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-soft-green px-2.5 py-1.5 text-[11px] font-extrabold text-green"
    >
      <CheckIcon className="size-3.5" />
      {message}
    </p>
  );
}
