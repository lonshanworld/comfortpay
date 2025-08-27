
"use client"

import { useToast } from "@/hooks/use-toast";
import type { Permissions, User } from "@/lib/types";
import { Copy, CheckCircle, XCircle } from "lucide-react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";
import { Badge } from "../ui/badge";

interface ViewUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
}

const DetailRow = ({ label, value, children }: { label: string, value?: string | number | null, children?: React.ReactNode }) => {
    if (!value && value !== 0 && !children) return null;
    return (
        <div className="grid grid-cols-3 gap-2 text-sm items-center py-1.5">
            <p className="text-muted-foreground col-span-1">{label}</p>
            <div className="col-span-2 font-medium break-words flex items-center gap-2">
                {children ? children : <span>{value}</span>}
            </div>
        </div>
    )
}

const permissionsList: { id: keyof Permissions; label: string }[] = [
  { id: "view_dashboard", label: "View Dashboard" },
  { id: "view_transactions", label: "View Transactions" },
  { id: "edit_transactions", label: "Edit Transactions" },
  { id: "view_merchants", label: "View Merchants" },
  { id: "edit_merchants", label: "Edit Merchants" },
  { id: "view_users", label: "View Users" },
  { id: "edit_users", label: "Edit Users" },
  { id: "manage_settings", label: "Manage Settings" },
];


export function ViewUserDialog({ open, onOpenChange, user }: ViewUserDialogProps) {
    const { toast } = useToast();

    const handleCopy = (value: string, fieldName: string) => {
        navigator.clipboard.writeText(value);
        toast({
            title: "Copied to clipboard",
            description: `${fieldName} has been copied.`,
        });
    }
    
    if (!user) return null;
    
    const userPermissions: Permissions = user.permissions ? JSON.parse(user.permissions) : {};


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>User Details</DialogTitle>
          <DialogDescription>
            Full details for {user.name}.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh]">
            <div className="space-y-4 py-4 pr-6">
                <section>
                     <h4 className="text-sm font-semibold text-primary mb-2">General Information</h4>
                     <div className="space-y-1">
                        <DetailRow label="User ID" >
                            <div className="flex items-center gap-2">
                                <span>{user.id}</span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => handleCopy(user.id, 'User ID')}
                                >
                                    <Copy className="h-3.5 w-3.5" />
                                    <span className="sr-only">Copy User ID</span>
                                </Button>
                             </div>
                        </DetailRow>
                        <DetailRow label="Full Name" value={user.name} />
                        <DetailRow label="Login Email" value={user.email} />
                        <DetailRow label="Role"><Badge variant={user.role === 'Admin' ? 'destructive' : 'secondary'}>{user.role}</Badge></DetailRow>
                        <DetailRow label="Status"><Badge variant={user.status === 'Active' ? "secondary" : "destructive"}>{user.status}</Badge></DetailRow>
                        <DetailRow label="Date Joined" value={new Date(user.createdAt).toLocaleDateString()} />
                     </div>
                </section>
                {user.role === 'Staff' && (
                    <>
                        <Separator />
                        <section>
                            <h4 className="text-sm font-semibold text-primary mb-2">Staff Permissions</h4>
                            <div className="space-y-2">
                                {permissionsList.map(permission => (
                                     <div key={permission.id} className="flex items-center text-sm gap-2">
                                        {userPermissions[permission.id] 
                                            ? <CheckCircle className="h-4 w-4 text-green-500" /> 
                                            : <XCircle className="h-4 w-4 text-muted-foreground" />
                                        }
                                        <span>{permission.label}</span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </>
                )}
            </div>
        </ScrollArea>
         <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
