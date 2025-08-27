"use client"

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ContactSupportDialog } from "./contact-support-dialog";


export function ContactSupport() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  return (
    <>
      <Card>
        <CardHeader className="p-2 pt-0 md:p-4">
          <CardTitle>Need Help?</CardTitle>
          <CardDescription>
            Contact support for any issues or questions.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-2 pt-0 md:p-4 md:pt-0">
          <Button size="sm" className="w-full" onClick={() => setIsDialogOpen(true)}>
            Contact Support
          </Button>
        </CardContent>
      </Card>
      <ContactSupportDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
    </>
  )
}
