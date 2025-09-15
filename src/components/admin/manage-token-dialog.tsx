
"use client"

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Copy, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Merchant } from "@/lib/types";

// In a real app, this would be a more robust token generation library
const generateToken = () => `cp_tok_${[...Array(24)].map(() => Math.random().toString(36)[2]).join('')}`;

interface ManageTokenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTokenUpdated: () => void;
  merchant: Merchant | null;
}

export function ManageTokenDialog({ open, onOpenChange, onTokenUpdated, merchant }: ManageTokenDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [currentToken, setCurrentToken] = useState(merchant?.token || "");

  useEffect(() => {
    if (merchant && open) {
      setCurrentToken(merchant.token || "");
    }
  }, [merchant, open]);

  const handleCopy = () => {
    navigator.clipboard.writeText(currentToken);
    toast({
      title: "Copied to clipboard!",
      description: "The token has been copied.",
    });
  };

  const handleRegenerate = async () => {
    if (!merchant) return;

    if (!confirm("Are you sure you want to regenerate the token? The old token will be invalidated immediately.")) {
        return;
    }

    setIsLoading(true);
    const newToken = generateToken();
    try {
      const response = await fetch(`/api/merchants/${merchant.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: newToken }),
      });

      if (!response.ok) {
        throw new Error('Failed to regenerate token');
      }
      
      setCurrentToken(newToken);
      toast({
        title: "Token Regenerated",
        description: `A new token has been generated for ${merchant.name}.`,
      });
      onTokenUpdated();

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Uh oh! Something went wrong.",
        description: "There was a problem regenerating the token.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!merchant) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage API Token</DialogTitle>
          <DialogDescription>
            This token is used for the WooCommerce WordPress plugin integration for <strong>{merchant.name}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
            <div className="space-y-1">
                 <p className="text-sm text-muted-foreground">
                    The API token is a secret and should be treated like a password.
                 </p>
                 <div className="flex items-center space-x-2">
                    <Input id="token" value={currentToken} readOnly />
                    <Button type="button" size="sm" className="px-3" onClick={handleCopy}>
                        <span className="sr-only">Copy</span>
                        <Copy className="h-4 w-4" />
                    </Button>
                </div>
            </div>
            <Button
                type="button"
                variant="destructive"
                className="w-full"
                onClick={handleRegenerate}
                disabled={isLoading}
            >
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Regenerate Token
            </Button>
        </div>
        <DialogFooter className="pt-4">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
