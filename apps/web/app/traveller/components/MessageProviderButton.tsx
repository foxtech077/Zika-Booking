"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { getApiErrorMessage, startConversation } from "@/services/traveller";
import { useState } from "react";

interface MessageProviderButtonProps {
  listingId: string;
  className?: string;
}

export function MessageProviderButton({ listingId, className }: MessageProviderButtonProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => startConversation(listingId),
    onSuccess: (data) => {
      setError(null);
      router.push(`/traveller/messages?conversationId=${encodeURIComponent(data.conversationId)}`);
    },
    onError: (mutationError) => {
      setError(getApiErrorMessage(mutationError, "Unable to open messages right now. Please try again."));
    },
  });

  return (
    <div className={className}>
      <Button
        variant="primary"
        icon={<MessageSquare />}
        className="w-full"
        loading={mutation.isPending}
        onClick={() => {
          setError(null);
          mutation.mutate();
        }}
      >
        Message Provider
      </Button>
      {error && (
        <p className="mt-2 text-xs font-medium text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
